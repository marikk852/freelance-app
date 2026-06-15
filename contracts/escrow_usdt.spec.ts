import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';
import { Cell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import { EscrowUsdtContract, EscrowStatus, OP } from './wrappers/EscrowUsdtContract';

// ============================================================
// SafeDeal Escrow USD₮ (jetton) — sandbox-тесты
// jwallet (treasury) выступает заглушкой нашего jetton-wallet:
// контракт валидирует sender==jetton_wallet и шлёт переводы на него.
// ============================================================
describe('Escrow USDT (jetton)', () => {
  let code: Cell;
  beforeAll(async () => { code = await compile('escrow_usdt'); });

  let bc: Blockchain;
  let client: SandboxContract<TreasuryContract>;
  let freelancer: SandboxContract<TreasuryContract>;
  let arbitrator: SandboxContract<TreasuryContract>;
  let attacker: SandboxContract<TreasuryContract>;
  let jwallet: SandboxContract<TreasuryContract>;   // заглушка jetton-wallet эскроу
  let escrow: SandboxContract<EscrowUsdtContract>;

  const FEE = 2;
  const FUTURE = Math.floor(Date.now() / 1000) + 86400 * 7;
  const AMOUNT = toNano('100');  // 100 USD₮ (условно)

  beforeEach(async () => {
    bc = await Blockchain.create();
    client     = await bc.treasury('client');
    freelancer = await bc.treasury('freelancer');
    arbitrator = await bc.treasury('arbitrator');
    attacker   = await bc.treasury('attacker');
    jwallet    = await bc.treasury('jwallet');
    escrow = bc.openContract(EscrowUsdtContract.createFromConfig({
      clientAddr: client.address, freelancerAddr: freelancer.address,
      arbitratorAddr: arbitrator.address, amountUsd: AMOUNT, feePercent: FEE, deadline: FUTURE,
    }, code));
    await escrow.sendDeploy(client.getSender(), toNano('0.1'));
  });

  const setWallet = () => escrow.sendSetJettonWallet(arbitrator.getSender(), jwallet.address);
  const deposit   = (amt: bigint) => escrow.sendTransferNotification(jwallet.getSender(), amt, client.address);

  // ---------- SET_JETTON_WALLET ----------
  it('arbitrator sets jetton wallet; non-arbitrator cannot; only once', async () => {
    await escrow.sendSetJettonWallet(attacker.getSender(), jwallet.address);
    expect((await escrow.getState()).jettonWallet).toBeNull();          // attacker — отклонён

    await setWallet();
    expect((await escrow.getState()).jettonWallet!.equals(jwallet.address)).toBe(true);

    const r = await escrow.sendSetJettonWallet(arbitrator.getSender(), attacker.address);  // повторно
    expect(r.transactions).toHaveTransaction({ to: escrow.address, exitCode: 408 });        // ERR_WALLET_ALREADY_SET
    expect((await escrow.getState()).jettonWallet!.equals(jwallet.address)).toBe(true);     // не перезаписан
  });

  it('deploy + set jetton wallet in one message (backend deploy path)', async () => {
    // Свежий эскроу: первое же сообщение от арбитра = StateInit + OP_SET_JETTON_WALLET
    const e = bc.openContract(EscrowUsdtContract.createFromConfig({
      clientAddr: client.address, freelancerAddr: freelancer.address,
      arbitratorAddr: arbitrator.address, amountUsd: AMOUNT, feePercent: FEE, deadline: FUTURE + 2,
    }, code));
    await e.sendDeployAndSetWallet(arbitrator.getSender(), jwallet.address);
    expect((await e.getState()).jettonWallet!.equals(jwallet.address)).toBe(true);
    // и сразу принимает депозит
    await e.sendTransferNotification(jwallet.getSender(), AMOUNT, client.address);
    expect(await e.getStatus()).toBe(EscrowStatus.FROZEN);
  });

  // ---------- Депозит ----------
  it('rejects deposit before jetton wallet is set (funds-safety)', async () => {
    const r = await deposit(AMOUNT);
    expect(r.transactions).toHaveTransaction({ to: escrow.address, exitCode: 409 });  // ERR_WALLET_NOT_SET
    expect(await escrow.getStatus()).toBe(EscrowStatus.WAITING);
  });

  it('freezes on real deposit from jetton wallet', async () => {
    await setWallet();
    await deposit(AMOUNT);
    const st = await escrow.getState();
    expect(st.status).toBe(EscrowStatus.FROZEN);
    expect(st.amount).toBe(AMOUNT);
  });

  it('rejects FAKE transfer_notification from a non-jetton-wallet address', async () => {
    await setWallet();
    const r = await escrow.sendTransferNotification(attacker.getSender(), AMOUNT, client.address);
    expect(r.transactions).toHaveTransaction({ to: escrow.address, exitCode: 407 });  // ERR_NOT_JETTON_WALLET
    expect(await escrow.getStatus()).toBe(EscrowStatus.WAITING);                       // НЕ заморожен
  });

  it('accumulates top-up deposits (no stranded funds)', async () => {
    await setWallet();
    await deposit(toNano('60'));
    await deposit(toNano('40'));
    const st = await escrow.getState();
    expect(st.status).toBe(EscrowStatus.FROZEN);
    expect(st.amount).toBe(toNano('100'));
  });

  // ---------- RELEASE ----------
  it('release pays freelancer + fee via jetton transfers (arbitrator only)', async () => {
    await setWallet();
    await deposit(AMOUNT);
    const r = await escrow.sendRelease(arbitrator.getSender());
    expect(await escrow.getStatus()).toBe(EscrowStatus.RELEASED);
    // эскроу шлёт jetton transfer'ы своему jetton-wallet
    expect(r.transactions).toHaveTransaction({ from: escrow.address, to: jwallet.address, op: OP.JETTON_TRANSFER });
  });

  it('release rejected for non-arbitrator', async () => {
    await setWallet();
    await deposit(AMOUNT);
    const r = await escrow.sendRelease(attacker.getSender());
    expect(r.transactions).toHaveTransaction({ to: escrow.address, exitCode: 401 });  // ERR_NOT_ARBITRATOR
    expect(await escrow.getStatus()).toBe(EscrowStatus.FROZEN);
  });

  it('double release rejected', async () => {
    await setWallet();
    await deposit(AMOUNT);
    await escrow.sendRelease(arbitrator.getSender());
    const r = await escrow.sendRelease(arbitrator.getSender());
    expect(r.transactions).toHaveTransaction({ to: escrow.address, exitCode: 402 });  // ERR_WRONG_STATUS
  });

  it('release rejected when gas is insufficient (state stays FROZEN)', async () => {
    // отдельный эскроу с минимальным финансированием.
    // deadline+1 → уникальный адрес (иначе совпал бы с `escrow` из beforeEach
    // и унаследовал его баланс 0.1 TON, маскируя нехватку газа).
    const e2 = bc.openContract(EscrowUsdtContract.createFromConfig({
      clientAddr: client.address, freelancerAddr: freelancer.address,
      arbitratorAddr: arbitrator.address, amountUsd: AMOUNT, feePercent: FEE, deadline: FUTURE + 1,
    }, code));
    await e2.sendDeploy(client.getSender(), toNano('0.02'));
    await e2.sendSetJettonWallet(arbitrator.getSender(), jwallet.address, toNano('0.02'));
    await e2.sendTransferNotification(jwallet.getSender(), AMOUNT, client.address, toNano('0.02'));
    const r = await e2.sendRelease(arbitrator.getSender(), toNano('0.01'));  // мало газа
    expect(r.transactions).toHaveTransaction({ to: e2.address, exitCode: 410 });  // ERR_LOW_GAS
    expect(await e2.getStatus()).toBe(EscrowStatus.FROZEN);                        // выплаты не было
  });

  // ---------- REFUND / SPLIT ----------
  it('refund returns to client', async () => {
    await setWallet();
    await deposit(AMOUNT);
    const r = await escrow.sendRefund(arbitrator.getSender());
    expect(await escrow.getStatus()).toBe(EscrowStatus.REFUNDED);
    expect(r.transactions).toHaveTransaction({ from: escrow.address, to: jwallet.address, op: OP.JETTON_TRANSFER });
  });

  it('split distributes between parties', async () => {
    await setWallet();
    await deposit(AMOUNT);
    const r = await escrow.sendSplit(arbitrator.getSender(), 60);
    expect(await escrow.getStatus()).toBe(EscrowStatus.REFUNDED);
    expect(r.transactions).toHaveTransaction({ from: escrow.address, to: jwallet.address, op: OP.JETTON_TRANSFER });
  });

  it('split rejects percent > 100', async () => {
    await setWallet();
    await deposit(AMOUNT);
    const r = await escrow.sendSplit(arbitrator.getSender(), 150);
    expect(r.transactions).toHaveTransaction({ to: escrow.address, exitCode: 406 });  // ERR_INVALID_SPLIT
  });
});

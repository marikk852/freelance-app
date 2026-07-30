import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';
import { Cell, toNano, Address } from '@ton/core';
import { compile } from '@ton/blueprint';
import { EscrowUsdtContract, EscrowStatus } from './wrappers/EscrowUsdtContract';
import { JettonMinter, JettonWallet } from './wrappers/ReferenceJetton';

// ============================================================
// E2E: escrow_usdt.fc против НАСТОЯЩЕГО TEP-74 jetton (не заглушки).
// Полный путь: mint → client jetton-wallet → transfer на эскроу →
// escrow jetton-wallet → transfer_notification → FROZEN →
// release → escrow jetton-wallet → freelancer/arbitrator jetton-wallets.
// Проверяем, что jetton РЕАЛЬНО доходят до получателей.
// ============================================================
describe('Escrow USDT — e2e with real TEP-74 jetton', () => {
  let escrowCode: Cell;
  beforeAll(async () => { escrowCode = await compile('escrow_usdt'); });

  let bc: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;   // admin минтера
  let client: SandboxContract<TreasuryContract>;
  let freelancer: SandboxContract<TreasuryContract>;
  let arbitrator: SandboxContract<TreasuryContract>;
  let minter: SandboxContract<JettonMinter>;
  let escrow: SandboxContract<EscrowUsdtContract>;

  const FEE = 2;
  const UNIT = 1_000_000n;            // USD₮ — 6 знаков
  const AMOUNT = 100n * UNIT;         // 100 USD₮
  const FUTURE = Math.floor(Date.now() / 1000) + 86400 * 7;

  // jetton-кошелёк владельца как открытый контракт
  const jw = (owner: Address) => minter.getWalletAddress(owner)
    .then((addr) => bc.openContract(JettonWallet.createFromAddress(addr)));

  beforeEach(async () => {
    bc = await Blockchain.create();
    deployer   = await bc.treasury('deployer');
    client     = await bc.treasury('client');
    freelancer = await bc.treasury('freelancer');
    arbitrator = await bc.treasury('arbitrator');

    // 1. Деплой эталонного USD₮-минтера + mint клиенту
    minter = bc.openContract(JettonMinter.createFromConfig(deployer.address));
    await minter.sendDeploy(deployer.getSender());
    await minter.sendMint(deployer.getSender(), client.address, AMOUNT);

    // 2. Деплой эскроу
    escrow = bc.openContract(EscrowUsdtContract.createFromConfig({
      clientAddr: client.address, freelancerAddr: freelancer.address,
      arbitratorAddr: arbitrator.address, amountUsd: AMOUNT, feePercent: FEE, deadline: FUTURE,
    }, escrowCode));
    await escrow.sendDeploy(client.getSender(), toNano('0.3'));

    // 3. Арбитр сообщает эскроу адрес ЕГО jetton-wallet (вычислен минтером)
    const escrowJwAddr = await minter.getWalletAddress(escrow.address);
    await escrow.sendSetJettonWallet(arbitrator.getSender(), escrowJwAddr, toNano('0.1'));
  });

  it('client funded with jetton at start', async () => {
    expect(await (await jw(client.address)).getJettonBalance()).toBe(AMOUNT);
  });

  it('deposit via real jetton transfer freezes escrow', async () => {
    const clientJw = await jw(client.address);
    // клиент переводит jetton на эскроу; forwardTon>0 → transfer_notification
    await clientJw.sendTransfer(client.getSender(), {
      to: escrow.address, jettonAmount: AMOUNT, responseAddr: client.address,
      forwardTon: toNano('0.3'), value: toNano('0.6'),
    });

    const st = await escrow.getState();
    expect(st.status).toBe(EscrowStatus.FROZEN);
    expect(st.amount).toBe(AMOUNT);
    // jetton действительно уехали с кошелька клиента на кошелёк эскроу
    expect(await (await jw(client.address)).getJettonBalance()).toBe(0n);
    expect(await (await jw(escrow.address)).getJettonBalance()).toBe(AMOUNT);
  });

  it('full happy path: deposit → release pays freelancer 98 + arbitrator 2', async () => {
    const clientJw = await jw(client.address);
    await clientJw.sendTransfer(client.getSender(), {
      to: escrow.address, jettonAmount: AMOUNT, responseAddr: client.address,
      forwardTon: toNano('0.3'), value: toNano('0.6'),
    });
    expect(await escrow.getStatus()).toBe(EscrowStatus.FROZEN);

    await escrow.sendRelease(arbitrator.getSender());

    expect(await escrow.getStatus()).toBe(EscrowStatus.RELEASED);
    const fee = AMOUNT * BigInt(FEE) / 100n;          // 2 USD₮
    expect(await (await jw(freelancer.address)).getJettonBalance()).toBe(AMOUNT - fee); // 98
    expect(await (await jw(arbitrator.address)).getJettonBalance()).toBe(fee);          // 2
    expect(await (await jw(escrow.address)).getJettonBalance()).toBe(0n);               // эскроу опустел
  });

  it('refund returns full jetton amount to client', async () => {
    const clientJw = await jw(client.address);
    await clientJw.sendTransfer(client.getSender(), {
      to: escrow.address, jettonAmount: AMOUNT, responseAddr: client.address,
      forwardTon: toNano('0.3'), value: toNano('0.6'),
    });

    await escrow.sendRefund(arbitrator.getSender());

    expect(await escrow.getStatus()).toBe(EscrowStatus.REFUNDED);
    expect(await (await jw(client.address)).getJettonBalance()).toBe(AMOUNT);           // вернулись все 100
    expect(await (await jw(escrow.address)).getJettonBalance()).toBe(0n);
  });

  it('split 60/40 distributes jetton between freelancer, client and fee', async () => {
    const clientJw = await jw(client.address);
    await clientJw.sendTransfer(client.getSender(), {
      to: escrow.address, jettonAmount: AMOUNT, responseAddr: client.address,
      forwardTon: toNano('0.3'), value: toNano('0.6'),
    });

    await escrow.sendSplit(arbitrator.getSender(), 60);

    expect(await escrow.getStatus()).toBe(EscrowStatus.REFUNDED);
    const fee = AMOUNT * BigInt(FEE) / 100n;          // 2
    const distributable = AMOUNT - fee;               // 98
    const toFreelancer = distributable * 60n / 100n;  // 58.8
    const toClient = distributable - toFreelancer;    // 39.2
    expect(await (await jw(freelancer.address)).getJettonBalance()).toBe(toFreelancer);
    expect(await (await jw(client.address)).getJettonBalance()).toBe(toClient);
    expect(await (await jw(arbitrator.address)).getJettonBalance()).toBe(fee);
    expect(await (await jw(escrow.address)).getJettonBalance()).toBe(0n);
  });
});

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';
import { Cell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import { EscrowContract, EscrowStatus, EscrowConfig } from './wrappers/EscrowContract';

// ============================================================
// SafeDeal Escrow — Тесты безопасности (Агент 2)
// ============================================================

describe('SafeDeal Escrow Contract', () => {
  let code: Cell;

  // Компилируем контракт один раз перед всеми тестами
  beforeAll(async () => {
    code = await compile('escrow');
  });

  let blockchain  : Blockchain;
  let client      : SandboxContract<TreasuryContract>;
  let freelancer  : SandboxContract<TreasuryContract>;
  let arbitrator  : SandboxContract<TreasuryContract>;
  let attacker    : SandboxContract<TreasuryContract>;
  let escrow      : SandboxContract<EscrowContract>;

  const DEAL_AMOUNT    = toNano('10');   // 10 TON
  const FEE_PERCENT    = 2;
  const FUTURE_DEADLINE = Math.floor(Date.now() / 1000) + 86400 * 7; // +7 дней

  // Создаём свежее окружение перед каждым тестом
  beforeEach(async () => {
    blockchain = await Blockchain.create();

    client     = await blockchain.treasury('client');
    freelancer = await blockchain.treasury('freelancer');
    arbitrator = await blockchain.treasury('arbitrator');
    attacker   = await blockchain.treasury('attacker');

    const config: EscrowConfig = {
      clientAddr    : client.address,
      freelancerAddr: freelancer.address,
      arbitratorAddr: arbitrator.address,
      amountNano    : DEAL_AMOUNT,
      feePercent    : FEE_PERCENT,
      deadline      : FUTURE_DEADLINE,
    };

    escrow = blockchain.openContract(
      EscrowContract.createFromConfig(config, code)
    );

    // Деплоим контракт
    const deployResult = await escrow.sendDeploy(client.getSender(), toNano('0.05'));
    expect(deployResult.transactions).toHaveTransaction({
      from   : client.address,
      to     : escrow.address,
      deploy : true,
      success: true,
    });
  });

  // ==========================================================
  // ТЕСТ 1: Нормальное закрытие сделки
  // ==========================================================
  describe('✅ Нормальная сделка', () => {
    it('should complete full deal flow: deploy → deposit → release', async () => {
      // Шаг 1: начальный статус WAITING
      expect(await escrow.getStatus()).toBe(EscrowStatus.WAITING);

      // Шаг 2: клиент вносит депозит
      const depositResult = await escrow.sendDeposit(
        client.getSender(),
        DEAL_AMOUNT + toNano('0.1') // + газ
      );
      expect(depositResult.transactions).toHaveTransaction({
        from   : client.address,
        to     : escrow.address,
        success: true,
      });
      expect(await escrow.getStatus()).toBe(EscrowStatus.FROZEN);

      // Шаг 3: арбитр освобождает средства фрилансеру
      const freelancerBalanceBefore = await freelancer.getBalance();
      const releaseResult = await escrow.sendRelease(arbitrator.getSender());
      expect(releaseResult.transactions).toHaveTransaction({
        from   : arbitrator.address,
        to     : escrow.address,
        success: true,
      });

      // Проверяем что фрилансер получил ~98% суммы
      const freelancerBalanceAfter = await freelancer.getBalance();
      const received = freelancerBalanceAfter - freelancerBalanceBefore;
      const expectedMin = DEAL_AMOUNT * 97n / 100n; // с учётом газа >= 97%
      expect(received).toBeGreaterThan(expectedMin);

      expect(await escrow.getStatus()).toBe(EscrowStatus.RELEASED);
    });
  });

  // ==========================================================
  // ТЕСТ 2: Возврат при просрочке дедлайна
  // ==========================================================
  describe('⏰ Возврат при просрочке', () => {
    it('should allow refund after deadline passes without deposit', async () => {
      // Переводим время вперёд — дедлайн прошёл
      blockchain.now = FUTURE_DEADLINE + 1;

      // Контракт должен считаться просроченным
      expect(await escrow.getIsExpired()).toBe(true);

      // Арбитр делает refund
      const clientBalanceBefore = await client.getBalance();
      const refundResult = await escrow.sendRefund(arbitrator.getSender());
      expect(refundResult.transactions).toHaveTransaction({
        from   : arbitrator.address,
        to     : escrow.address,
        success: true,
      });

      expect(await escrow.getStatus()).toBe(EscrowStatus.REFUNDED);
    });

    it('should allow refund of frozen funds after deadline', async () => {
      // Клиент внёс депозит
      await escrow.sendDeposit(client.getSender(), DEAL_AMOUNT + toNano('0.1'));
      expect(await escrow.getStatus()).toBe(EscrowStatus.FROZEN);

      // Прошёл дедлайн без выполнения работы
      blockchain.now = FUTURE_DEADLINE + 1;

      // Арбитр возвращает деньги клиенту
      const clientBalanceBefore = await client.getBalance();
      await escrow.sendRefund(arbitrator.getSender());

      const clientBalanceAfter = await client.getBalance();
      expect(clientBalanceAfter).toBeGreaterThan(clientBalanceBefore);
      expect(await escrow.getStatus()).toBe(EscrowStatus.REFUNDED);
    });
  });

  // ==========================================================
  // ТЕСТ 3: Спор и split
  // ==========================================================
  describe('⚖️ Спор и split', () => {
    it('should split funds correctly 70/30', async () => {
      // Клиент вносит депозит
      await escrow.sendDeposit(client.getSender(), DEAL_AMOUNT + toNano('0.1'));
      expect(await escrow.getStatus()).toBe(EscrowStatus.FROZEN);

      const freelancerBefore = await freelancer.getBalance();
      const clientBefore     = await client.getBalance();

      // Арбитр разделяет: 70% фрилансеру, 30% клиенту
      const splitResult = await escrow.sendSplit(arbitrator.getSender(), 70);
      expect(splitResult.transactions).toHaveTransaction({
        from   : arbitrator.address,
        to     : escrow.address,
        success: true,
      });

      const freelancerAfter = await freelancer.getBalance();
      const clientAfter     = await client.getBalance();

      // Фрилансер получил больше клиента
      expect(freelancerAfter - freelancerBefore).toBeGreaterThan(
        clientAfter - clientBefore
      );

      expect(await escrow.getStatus()).toBe(EscrowStatus.REFUNDED);
    });

    it('should split 0/100 (full refund via split)', async () => {
      await escrow.sendDeposit(client.getSender(), DEAL_AMOUNT + toNano('0.1'));

      const clientBefore = await client.getBalance();
      await escrow.sendSplit(arbitrator.getSender(), 0); // 0% фрилансеру
      const clientAfter = await client.getBalance();

      expect(clientAfter).toBeGreaterThan(clientBefore);
    });
  });

  // ==========================================================
  // ТЕСТ 4: Попытка украсть — должна ПРОВАЛИТЬСЯ
  // ==========================================================
  describe('🔒 Попытки кражи (должны провалиться)', () => {
    it('should REJECT release from non-arbitrator (attacker)', async () => {
      // Клиент вносит депозит
      await escrow.sendDeposit(client.getSender(), DEAL_AMOUNT + toNano('0.1'));

      // Злоумышленник пытается вызвать release
      const attackResult = await escrow.sendRelease(attacker.getSender());
      expect(attackResult.transactions).toHaveTransaction({
        from   : attacker.address,
        to     : escrow.address,
        success: false,  // Должно провалиться!
        exitCode: 401,   // ERR_NOT_ARBITRATOR
      });

      // Статус не изменился
      expect(await escrow.getStatus()).toBe(EscrowStatus.FROZEN);
    });

    it('should REJECT release from client', async () => {
      await escrow.sendDeposit(client.getSender(), DEAL_AMOUNT + toNano('0.1'));

      const attackResult = await escrow.sendRelease(client.getSender());
      expect(attackResult.transactions).toHaveTransaction({
        to     : escrow.address,
        success: false,
        exitCode: 401,
      });
    });

    it('should REJECT release from freelancer', async () => {
      await escrow.sendDeposit(client.getSender(), DEAL_AMOUNT + toNano('0.1'));

      const attackResult = await escrow.sendRelease(freelancer.getSender());
      expect(attackResult.transactions).toHaveTransaction({
        to     : escrow.address,
        success: false,
        exitCode: 401,
      });
    });

    it('should REJECT refund from non-arbitrator', async () => {
      await escrow.sendDeposit(client.getSender(), DEAL_AMOUNT + toNano('0.1'));

      const attackResult = await escrow.sendRefund(attacker.getSender());
      expect(attackResult.transactions).toHaveTransaction({
        to     : escrow.address,
        success: false,
        exitCode: 401,
      });
    });

    it('should REJECT split from attacker', async () => {
      await escrow.sendDeposit(client.getSender(), DEAL_AMOUNT + toNano('0.1'));

      const attackResult = await escrow.sendSplit(attacker.getSender(), 100);
      expect(attackResult.transactions).toHaveTransaction({
        to     : escrow.address,
        success: false,
        exitCode: 401,
      });
    });
  });

  // ==========================================================
  // ТЕСТ 5: Двойной release (должен ПРОВАЛИТЬСЯ)
  // ==========================================================
  describe('🚫 Двойные операции (должны провалиться)', () => {
    it('should REJECT double release', async () => {
      await escrow.sendDeposit(client.getSender(), DEAL_AMOUNT + toNano('0.1'));
      await escrow.sendRelease(arbitrator.getSender());

      expect(await escrow.getStatus()).toBe(EscrowStatus.RELEASED);

      // Второй release — должен провалиться
      const secondRelease = await escrow.sendRelease(arbitrator.getSender());
      expect(secondRelease.transactions).toHaveTransaction({
        to     : escrow.address,
        success: false,
        exitCode: 402, // ERR_WRONG_STATUS
      });
    });

    it('should REJECT release before deposit', async () => {
      expect(await escrow.getStatus()).toBe(EscrowStatus.WAITING);

      const result = await escrow.sendRelease(arbitrator.getSender());
      expect(result.transactions).toHaveTransaction({
        to     : escrow.address,
        success: false,
        exitCode: 402,
      });
    });

    it('should REJECT deposit after expiry', async () => {
      blockchain.now = FUTURE_DEADLINE + 1;

      const result = await escrow.sendDeposit(
        client.getSender(),
        DEAL_AMOUNT + toNano('0.1')
      );
      expect(result.transactions).toHaveTransaction({
        to     : escrow.address,
        success: false,
        exitCode: 405, // ERR_EXPIRED
      });
    });
  });

  // ==========================================================
  // ТЕСТ 6: Валидация данных
  // ==========================================================
  describe('🔍 Валидация', () => {
    it('should store correct initial state', async () => {
      const state = await escrow.getState();

      expect(state.status).toBe(EscrowStatus.WAITING);
      expect(state.feePercent).toBe(FEE_PERCENT);
      expect(state.deadline).toBe(FUTURE_DEADLINE);
      expect(state.clientAddr.toString()).toBe(client.address.toString());
      expect(state.freelancerAddr.toString()).toBe(freelancer.address.toString());
      expect(state.arbitratorAddr.toString()).toBe(arbitrator.address.toString());
    });

    it('should REJECT invalid split percent', async () => {
      await escrow.sendDeposit(client.getSender(), DEAL_AMOUNT + toNano('0.1'));

      // TypeScript wrapper должен выбросить ошибку при percent > 100
      await expect(
        escrow.sendSplit(arbitrator.getSender(), 101)
      ).rejects.toThrow('Недопустимый процент split');
    });
  });
});

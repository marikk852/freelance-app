import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
  TupleReader,
} from '@ton/core';

// ============================================================
// Статусы контракта
// ============================================================
export enum EscrowStatus {
  WAITING   = 0,   // Ожидание депозита
  FROZEN    = 1,   // Средства заморожены
  RELEASED  = 2,   // Выплачено фрилансеру
  REFUNDED  = 3,   // Возвращено клиенту
}

// ============================================================
// Операционные коды (должны совпадать с escrow.fc)
// ============================================================
export const OP = {
  DEPOSIT : 1,
  RELEASE : 2,
  REFUND  : 3,
  SPLIT   : 4,
} as const;

// ============================================================
// Параметры инициализации контракта
// ============================================================
export interface EscrowConfig {
  clientAddr     : Address;   // Адрес клиента
  freelancerAddr : Address;   // Адрес фрилансера
  arbitratorAddr : Address;   // Адрес арбитра (кошелёк платформы)
  amountNano     : bigint;    // Сумма сделки в нанотонах
  feePercent     : number;    // Комиссия платформы (2)
  deadline       : number;    // Unix timestamp дедлайна
}

// ============================================================
// EscrowContract — TypeScript обёртка для смарт-контракта
// ============================================================
export class EscrowContract implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  /**
   * Создаёт экземпляр контракта по конфигу.
   * Используется для вычисления адреса перед деплоем.
   */
  static createFromConfig(config: EscrowConfig, code: Cell, workchain = 0): EscrowContract {
    const data = EscrowContract.buildInitData(config);
    const init = { code, data };
    return new EscrowContract(contractAddress(workchain, init), init);
  }

  /**
   * Строит начальные данные ячейки из конфига.
   */
  static buildInitData(config: EscrowConfig): Cell {
    return beginCell()
      .storeUint(EscrowStatus.WAITING, 8)
      .storeAddress(config.clientAddr)
      .storeAddress(config.freelancerAddr)
      .storeAddress(config.arbitratorAddr)
      .storeCoins(config.amountNano)
      .storeUint(config.feePercent, 8)
      .storeUint(config.deadline, 32)
      .endCell();
  }

  /**
   * Деплоит контракт в блокчейн.
   * Вызывается бэкендом при создании новой сделки.
   */
  async deploy(provider: ContractProvider, via: Sender, value: bigint): Promise<void> {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  // ============================================================
  // Методы отправки транзакций
  // ============================================================

  /**
   * Клиент отправляет депозит на контракт.
   * @param amount — сумма сделки + небольшой запас на газ
   */
  async sendDeposit(
    provider: ContractProvider,
    via: Sender,
    amount: bigint
  ): Promise<void> {
    await provider.internal(via, {
      value: amount,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().storeUint(OP.DEPOSIT, 32).endCell(),
    });
  }

  /**
   * Арбитр выплачивает средства фрилансеру.
   * Вызывается только при delivery_approved.
   */
  async sendRelease(
    provider: ContractProvider,
    via: Sender,
    gasAmount: bigint = toNano('0.05')
  ): Promise<void> {
    await provider.internal(via, {
      value: gasAmount,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().storeUint(OP.RELEASE, 32).endCell(),
    });
  }

  /**
   * Арбитр возвращает средства клиенту.
   */
  async sendRefund(
    provider: ContractProvider,
    via: Sender,
    gasAmount: bigint = toNano('0.05')
  ): Promise<void> {
    await provider.internal(via, {
      value: gasAmount,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().storeUint(OP.REFUND, 32).endCell(),
    });
  }

  /**
   * Арбитр делит средства при споре.
   * @param freelancerPercent — процент фрилансеру (0-100)
   */
  async sendSplit(
    provider: ContractProvider,
    via: Sender,
    freelancerPercent: number,
    gasAmount: bigint = toNano('0.05')
  ): Promise<void> {
    if (freelancerPercent < 0 || freelancerPercent > 100) {
      throw new Error(`Недопустимый процент split: ${freelancerPercent}`);
    }
    await provider.internal(via, {
      value: gasAmount,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(OP.SPLIT, 32)
        .storeUint(freelancerPercent, 8)
        .endCell(),
    });
  }

  // ============================================================
  // GET-методы (чтение состояния без транзакций)
  // ============================================================

  /**
   * Получить текущий статус контракта.
   */
  async getStatus(provider: ContractProvider): Promise<EscrowStatus> {
    const result = await provider.get('get_status', []);
    return result.stack.readNumber() as EscrowStatus;
  }

  /**
   * Получить полное состояние контракта.
   */
  async getState(provider: ContractProvider): Promise<{
    status        : EscrowStatus;
    clientAddr    : Address;
    freelancerAddr: Address;
    arbitratorAddr: Address;
    amountNano    : bigint;
    feePercent    : number;
    deadline      : number;
  }> {
    const result = await provider.get('get_state', []);
    const stack: TupleReader = result.stack;

    return {
      status        : stack.readNumber() as EscrowStatus,
      clientAddr    : stack.readAddress(),
      freelancerAddr: stack.readAddress(),
      arbitratorAddr: stack.readAddress(),
      amountNano    : stack.readBigNumber(),
      feePercent    : stack.readNumber(),
      deadline      : stack.readNumber(),
    };
  }

  /**
   * Проверить, просрочен ли контракт.
   */
  async isExpired(provider: ContractProvider): Promise<boolean> {
    const result = await provider.get('is_expired', []);
    return result.stack.readBoolean();
  }

  /**
   * Получить текущий баланс контракта.
   */
  async getBalance(provider: ContractProvider): Promise<bigint> {
    const state = await provider.getState();
    return state.balance;
  }
}

import {
  Address, beginCell, Cell, Contract, contractAddress,
  ContractProvider, Sender, SendMode, toNano, TupleReader,
} from '@ton/core';

export enum EscrowStatus { WAITING = 0, FROZEN = 1, RELEASED = 2, REFUNDED = 3 }

export const OP = {
  RELEASE: 2, REFUND: 3, SPLIT: 4, SET_JETTON_WALLET: 5,
  JETTON_TRANSFER: 0xf8a7ea5, JETTON_TRANSFER_NOTIFY: 0x7362d09c,
} as const;

export interface EscrowUsdtConfig {
  clientAddr    : Address;
  freelancerAddr: Address;
  arbitratorAddr: Address;
  amountUsd     : bigint;  // ожидаемая сумма (vestigial — перезаписывается депозитом)
  feePercent    : number;
  deadline      : number;
}

export class EscrowUsdtContract implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromConfig(config: EscrowUsdtConfig, code: Cell, workchain = 0): EscrowUsdtContract {
    const data = EscrowUsdtContract.buildInitData(config);
    const init = { code, data };
    return new EscrowUsdtContract(contractAddress(workchain, init), init);
  }

  static buildInitData(config: EscrowUsdtConfig): Cell {
    // Раскладка как в контракте: участники вынесены в ref-ячейку,
    // иначе 4 адреса не влезают в корневую ячейку (лимит 1023 бита).
    return beginCell()
      .storeUint(EscrowStatus.WAITING, 8)
      .storeCoins(config.amountUsd)
      .storeUint(config.feePercent, 8)
      .storeUint(config.deadline, 32)
      .storeAddress(null)   // jetton_wallet = addr_none, ставится позже
      .storeRef(beginCell()
        .storeAddress(config.clientAddr)
        .storeAddress(config.freelancerAddr)
        .storeAddress(config.arbitratorAddr)
        .endCell())
      .endCell();
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint): Promise<void> {
    await provider.internal(via, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: beginCell().endCell() });
  }

  /** Арбитр одноразово устанавливает адрес jetton-wallet эскроу. */
  async sendSetJettonWallet(provider: ContractProvider, via: Sender, wallet: Address, value: bigint = toNano('0.05')): Promise<void> {
    await provider.internal(via, {
      value, sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().storeUint(OP.SET_JETTON_WALLET, 32).storeAddress(wallet).endCell(),
    });
  }

  /**
   * Деплой + установка jetton-wallet ОДНИМ сообщением (StateInit + body).
   * Так делает backend: первое сообщение от арбитра инициализирует контракт
   * и сразу обрабатывает OP_SET_JETTON_WALLET. Отправитель ДОЛЖЕН быть арбитром.
   */
  async sendDeployAndSetWallet(provider: ContractProvider, via: Sender, wallet: Address, value: bigint = toNano('0.1')): Promise<void> {
    await provider.internal(via, {
      value, sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().storeUint(OP.SET_JETTON_WALLET, 32).storeAddress(wallet).endCell(),
    });
  }

  /** Симуляция входящего депозита: transfer_notification ОТ jetton-wallet (via). */
  async sendTransferNotification(
    provider: ContractProvider, via: Sender, jettonAmount: bigint, from: Address, value: bigint = toNano('0.1')
  ): Promise<void> {
    await provider.internal(via, {
      value, sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(OP.JETTON_TRANSFER_NOTIFY, 32)
        .storeUint(0, 64)              // query_id
        .storeCoins(jettonAmount)
        .storeAddress(from)            // отправитель jetton (клиент)
        .endCell(),
    });
  }

  async sendRelease(provider: ContractProvider, via: Sender, value: bigint = toNano('0.3')): Promise<void> {
    await provider.internal(via, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: beginCell().storeUint(OP.RELEASE, 32).endCell() });
  }
  async sendRefund(provider: ContractProvider, via: Sender, value: bigint = toNano('0.2')): Promise<void> {
    await provider.internal(via, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: beginCell().storeUint(OP.REFUND, 32).endCell() });
  }
  async sendSplit(provider: ContractProvider, via: Sender, freelancerPercent: number, value: bigint = toNano('0.4')): Promise<void> {
    await provider.internal(via, {
      value, sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().storeUint(OP.SPLIT, 32).storeUint(freelancerPercent, 8).endCell(),
    });
  }

  async getStatus(provider: ContractProvider): Promise<EscrowStatus> {
    return (await provider.get('get_status', [])).stack.readNumber() as EscrowStatus;
  }
  async getState(provider: ContractProvider) {
    const s: TupleReader = (await provider.get('get_state', [])).stack;
    return {
      status        : s.readNumber() as EscrowStatus,
      clientAddr    : s.readAddress(),
      freelancerAddr: s.readAddress(),
      arbitratorAddr: s.readAddress(),
      amount        : s.readBigNumber(),
      feePercent    : s.readNumber(),
      deadline      : s.readNumber(),
      jettonWallet  : s.readAddressOpt(),
    };
  }
  async getBalance(provider: ContractProvider): Promise<bigint> {
    return (await provider.getState()).balance;
  }
}

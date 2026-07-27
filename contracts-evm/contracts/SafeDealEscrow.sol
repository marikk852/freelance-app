// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SafeDealEscrow
 * @notice Некастодиальный эскроу для USDT (ERC-20 на Ethereum / TRC-20 на Tron).
 *         Порт проверенной логики TON-контракта (escrow.fc / escrow_usdt.fc):
 *         клиент замораживает USDT → арбитр вызывает release / refund / split.
 *
 *         Один экземпляр = одна сделка (как на TON). Деплоится и на Ethereum,
 *         и на Tron — TVM бинарно совместим с EVM, Solidity компилируется под обе.
 *
 * @dev    Работает с НАСТОЯЩИМ USDT от Tether, который НАРУШАЕТ ERC-20 (transfer
 *         не возвращает bool). Поэтому все переводы идут через SafeERC20, а не
 *         через голый IERC20 — иначе интеграция ревертится на mainnet USDT.
 *         Замороженная сумма фиксируется по фактически полученному балансу
 *         (защита от fee-on-transfer токенов), а не по номиналу перевода.
 *
 *         ПРАВИЛО: release / refund / split — ТОЛЬКО от arbitrator.
 */
contract SafeDealEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------
    // Статусы сделки (совпадают с TON-контрактом)
    // ------------------------------------------------------------------
    enum Status {
        Waiting,   // 0 — ждём депозита
        Frozen,    // 1 — средства заморожены
        Released,  // 2 — выплачено фрилансеру
        Refunded   // 3 — возвращено клиенту (в т.ч. split)
    }

    // ------------------------------------------------------------------
    // Неизменяемые параметры сделки (заданы при деплое)
    // ------------------------------------------------------------------
    IERC20  public immutable token;        // адрес USDT в этой сети
    address public immutable client;       // плательщик
    address public immutable freelancer;   // исполнитель
    address public immutable arbitrator;   // кошелёк платформы (решает исход + получает комиссию)
    uint256 public immutable amount;        // сумма сделки (в единицах токена, USDT = 6 знаков)
    uint16  public immutable feeBps;        // комиссия платформы в базисных пунктах (200 = 2%)
    uint64  public immutable deadline;      // unix-время; после него возможен refund без депозита

    uint16 public constant MAX_BPS = 10_000; // 100%

    // ------------------------------------------------------------------
    // Изменяемое состояние
    // ------------------------------------------------------------------
    Status  public status;          // текущий статус
    uint256 public frozenAmount;    // фактически замороженная сумма (по балансу)

    // ------------------------------------------------------------------
    // События (для мониторинга backend'ом)
    // ------------------------------------------------------------------
    event Deposited(uint256 amount);
    event Released(uint256 toFreelancer, uint256 fee);
    event Refunded(uint256 toClient);
    event SplitResolved(uint256 toFreelancer, uint256 toClient, uint256 fee);

    // ------------------------------------------------------------------
    // Ошибки (дешевле require-строк по газу)
    // ------------------------------------------------------------------
    error NotArbitrator();
    error WrongStatus();
    error Underfunded(uint256 got, uint256 need);
    error InvalidSplit();
    error DeadlineNotReached();
    error ZeroAddress();

    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) revert NotArbitrator();
        _;
    }

    /**
     * @param _token      адрес контракта USDT в этой сети (ERC-20 / TRC-20)
     * @param _client     адрес клиента
     * @param _freelancer адрес фрилансера
     * @param _arbitrator адрес арбитра (платформа) — получает комиссию
     * @param _amount     сумма сделки в единицах токена (USDT: $100 = 100_000000)
     * @param _feeBps     комиссия платформы, б.п. (200 = 2%)
     * @param _deadline   unix-время дедлайна
     */
    constructor(
        IERC20  _token,
        address _client,
        address _freelancer,
        address _arbitrator,
        uint256 _amount,
        uint16  _feeBps,
        uint64  _deadline
    ) {
        if (
            address(_token) == address(0) ||
            _client == address(0) ||
            _freelancer == address(0) ||
            _arbitrator == address(0)
        ) revert ZeroAddress();
        if (_feeBps > MAX_BPS) revert InvalidSplit();

        token      = _token;
        client     = _client;
        freelancer = _freelancer;
        arbitrator = _arbitrator;
        amount     = _amount;
        feeBps     = _feeBps;
        deadline   = _deadline;
        status     = Status.Waiting;
    }

    // ==================================================================
    // Депозит: клиент замораживает USDT.
    // Клиент ПРЕДВАРИТЕЛЬНО делает approve(escrow, amount) в контракте USDT,
    // затем зовёт deposit() — контракт втягивает средства через transferFrom.
    // Сумму фиксируем по фактически полученному балансу (fee-on-transfer safe).
    // ==================================================================
    function deposit() external nonReentrant {
        if (status != Status.Waiting) revert WrongStatus();

        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balBefore;

        // Недоплата отбивается on-chain (в отличие от TON-jetton, здесь transferFrom
        // атомарен и мы можем требовать точную сумму до заморозки).
        if (received < amount) revert Underfunded(received, amount);

        frozenAmount = received;
        status = Status.Frozen;
        emit Deposited(received);
    }

    // ==================================================================
    // RELEASE: арбитр выплачивает фрилансеру (за вычетом комиссии платформы).
    // ==================================================================
    function release() external onlyArbitrator nonReentrant {
        if (status != Status.Frozen) revert WrongStatus();

        // Checks-Effects-Interactions: статус меняем ДО внешних переводов.
        status = Status.Released;

        uint256 fee          = (frozenAmount * feeBps) / MAX_BPS;
        uint256 toFreelancer = frozenAmount - fee;

        token.safeTransfer(freelancer, toFreelancer);
        if (fee > 0) token.safeTransfer(arbitrator, fee);

        emit Released(toFreelancer, fee);
    }

    // ==================================================================
    // REFUND: арбитр возвращает клиенту весь депозит.
    // Разрешён при Frozen ИЛИ при Waiting после дедлайна (страховка от зависших денег).
    // ==================================================================
    function refund() external onlyArbitrator nonReentrant {
        bool canRefund = status == Status.Frozen ||
            (status == Status.Waiting && block.timestamp > deadline);
        if (!canRefund) revert WrongStatus();

        uint256 toClient = frozenAmount;
        status = Status.Refunded;

        if (toClient > 0) token.safeTransfer(client, toClient);
        emit Refunded(toClient);
    }

    // ==================================================================
    // SPLIT: арбитр делит средства при споре.
    // freelancerBps — доля фрилансера от РАСПРЕДЕЛЯЕМОГО остатка (после комиссии).
    // ==================================================================
    function split(uint16 freelancerBps) external onlyArbitrator nonReentrant {
        if (status != Status.Frozen) revert WrongStatus();
        if (freelancerBps > MAX_BPS) revert InvalidSplit();

        status = Status.Refunded;

        uint256 fee           = (frozenAmount * feeBps) / MAX_BPS;
        uint256 distributable = frozenAmount - fee;
        uint256 toFreelancer  = (distributable * freelancerBps) / MAX_BPS;
        uint256 toClient      = distributable - toFreelancer;

        if (toFreelancer > 0) token.safeTransfer(freelancer, toFreelancer);
        if (toClient > 0)     token.safeTransfer(client, toClient);
        if (fee > 0)          token.safeTransfer(arbitrator, fee);

        emit SplitResolved(toFreelancer, toClient, fee);
    }

    // ==================================================================
    // View-хелперы для backend-мониторинга
    // ==================================================================
    function isExpired() external view returns (bool) {
        return status == Status.Waiting && block.timestamp > deadline;
    }

    function state()
        external
        view
        returns (Status _status, uint256 _frozenAmount, uint256 _contractBalance)
    {
        return (status, frozenAmount, token.balanceOf(address(this)));
    }
}

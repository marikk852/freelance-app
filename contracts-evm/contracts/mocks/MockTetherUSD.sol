// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockTetherUSD
 * @notice Мок НАСТОЯЩЕГО USDT от Tether — намеренно НЕ возвращает bool из
 *         transfer/transferFrom/approve, как реальный контракт на mainnet
 *         (0xdAC17F958D2ee523a2206206994597C13D831ec7). 6 знаков.
 *
 *         Нужен, чтобы доказать: SafeDealEscrow через SafeERC20 корректно
 *         работает с этим нестандартным токеном (голый IERC20 бы ревертился).
 */
contract MockTetherUSD {
    string public constant name = "Tether USD";
    string public constant symbol = "USDT";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 value) external {
        balanceOf[to] += value;
    }

    // ВНИМАНИЕ: без возврата bool — точно как реальный USDT.
    function transfer(address to, uint256 value) external {
        _transfer(msg.sender, to, value);
    }

    function transferFrom(address from, address to, uint256 value) external {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "USDT: allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
    }

    function approve(address spender, uint256 value) external {
        allowance[msg.sender][spender] = value;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "USDT: balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
    }
}

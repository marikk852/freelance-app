// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockFeeUSD
 * @notice Токен с комиссией на перевод (fee-on-transfer): получатель получает
 *         меньше, чем отправлено. Нужен, чтобы проверить, что deposit() отбивает
 *         недобор через проверку фактически полученного баланса (Underfunded).
 */
contract MockFeeUSD {
    uint8 public constant decimals = 6;
    uint256 public constant FEE_BPS = 100; // 1% комиссия на перевод

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 value) external {
        balanceOf[to] += value;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - value;
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "balance");
        uint256 fee = (value * FEE_BPS) / 10_000;
        balanceOf[from] -= value;
        balanceOf[to] += value - fee; // получатель недополучает комиссию
    }
}

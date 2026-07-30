require("@nomicfoundation/hardhat-toolbox");

/**
 * SafeDeal EVM escrow — Hardhat config.
 * Один и тот же контракт компилируется под Ethereum (EVM) и Tron (TVM).
 * Сети деплоя (Sepolia / Tron Nile / mainnet) добавим в фазе 5 через .env.
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
};

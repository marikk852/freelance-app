const { ethers } = require('ethers');
const { TronWeb } = require('tronweb');

// ============================================================
// Валидация и нормализация адресов кошельков по сетям.
//
// Единая точка правды для мультичейн-USDT: и привязка кошелька в профиле,
// и деплой эскроу проверяют адрес одинаково. Ошибка формата здесь дешевле,
// чем деньги, ушедшие в пустоту на выплате.
// ============================================================

const SUPPORTED_CHAINS = ['TON', 'ETH', 'TRON'];

// TON: UQ/EQ/kQ/0Q + 46 base64url-символов
const TON_ADDRESS_RE = /^(UQ|EQ|kQ|0Q)[A-Za-z0-9_-]{46}$/;

/**
 * Проверить адрес для сети.
 * @param {'TON'|'ETH'|'TRON'} chain
 * @param {string} address
 * @returns {boolean}
 */
function isValidAddress(chain, address) {
  if (typeof address !== 'string' || address.length === 0) return false;

  switch (chain) {
    case 'TON':
      return TON_ADDRESS_RE.test(address);
    case 'ETH':
      // ethers отбивает и неверную длину, и битую EIP-55 контрольную сумму
      return ethers.isAddress(address);
    case 'TRON':
      // base58check с проверкой контрольной суммы
      return TronWeb.isAddress(address);
    default:
      return false;
  }
}

/**
 * Привести адрес к каноничному виду (ETH → EIP-55 checksum).
 * Вызывать только после isValidAddress.
 * @param {'TON'|'ETH'|'TRON'} chain
 * @param {string} address
 * @returns {string}
 */
function normalizeAddress(chain, address) {
  return chain === 'ETH' ? ethers.getAddress(address) : address;
}

// Человекочитаемое описание формата — для сообщений об ошибке
const FORMAT_HINT = {
  TON : 'UQ.../EQ.../kQ.../0Q... (48 chars)',
  ETH : '0x + 40 hex chars',
  TRON: 'base58 address starting with T',
};

// Колонка в users, где живёт адрес этой сети
const WALLET_COLUMN = {
  TON : 'ton_wallet_address',
  ETH : 'eth_wallet_address',
  TRON: 'tron_wallet_address',
};

module.exports = {
  SUPPORTED_CHAINS,
  TON_ADDRESS_RE,
  isValidAddress,
  normalizeAddress,
  FORMAT_HINT,
  WALLET_COLUMN,
};

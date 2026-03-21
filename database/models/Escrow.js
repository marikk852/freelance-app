const { query } = require('../db');

// ============================================================
// Модель: Escrow (зеркало состояния смарт-контракта в БД)
// ============================================================

const Escrow = {
  /**
   * Создать запись эскроу после деплоя смарт-контракта.
   * @param {{ contract_id, currency, amount, amount_usd, platform_fee, ton_contract_address }} data
   */
  async create({ contract_id, currency, amount, amount_usd, platform_fee, ton_contract_address }) {
    const { rows } = await query(
      `INSERT INTO escrow
         (contract_id, currency, amount, amount_usd, platform_fee, ton_contract_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [contract_id, currency, amount, amount_usd, platform_fee, ton_contract_address]
    );
    return rows[0];
  },

  /**
   * Найти эскроу по contract_id.
   * @param {string} contractId
   */
  async findByContractId(contractId) {
    const { rows } = await query(
      'SELECT * FROM escrow WHERE contract_id = $1',
      [contractId]
    );
    return rows[0] || null;
  },

  /**
   * Найти эскроу по адресу смарт-контракта TON.
   * @param {string} tonAddress
   */
  async findByTonAddress(tonAddress) {
    const { rows } = await query(
      'SELECT * FROM escrow WHERE ton_contract_address = $1',
      [tonAddress]
    );
    return rows[0] || null;
  },

  /**
   * Зафиксировать получение депозита (деньги заморожены).
   * @param {string} contractId
   * @param {string} txHashIn - хэш транзакции депозита
   */
  async setFrozen(contractId, txHashIn) {
    const { rows } = await query(
      `UPDATE escrow
       SET status = 'frozen', tx_hash_in = $2, frozen_at = NOW()
       WHERE contract_id = $1 RETURNING *`,
      [contractId, txHashIn]
    );
    return rows[0] || null;
  },

  /**
   * Зафиксировать выплату фрилансеру (release).
   * @param {string} contractId
   * @param {string} txHashOut
   */
  async setReleased(contractId, txHashOut) {
    const { rows } = await query(
      `UPDATE escrow
       SET status = 'released', tx_hash_out = $2, released_at = NOW()
       WHERE contract_id = $1 RETURNING *`,
      [contractId, txHashOut]
    );
    return rows[0] || null;
  },

  /**
   * Зафиксировать возврат клиенту (refund).
   * @param {string} contractId
   * @param {string} txHashOut
   */
  async setRefunded(contractId, txHashOut) {
    const { rows } = await query(
      `UPDATE escrow
       SET status = 'refunded', tx_hash_out = $2, released_at = NOW()
       WHERE contract_id = $1 RETURNING *`,
      [contractId, txHashOut]
    );
    return rows[0] || null;
  },
};

module.exports = Escrow;

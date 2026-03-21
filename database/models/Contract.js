const { query, transaction } = require('../db');

// ============================================================
// Модель: Contract (Контракт сделки)
// ============================================================

const Contract = {
  /**
   * Создать черновик контракта.
   * @param {{ room_id, title, description, amount_usd, currency, deadline, criteria }} data
   */
  async create({ room_id, title, description, amount_usd, currency, deadline, criteria }) {
    const { rows } = await query(
      `INSERT INTO contracts
         (room_id, title, description, amount_usd, currency, deadline, criteria)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [room_id, title, description, amount_usd, currency, deadline, JSON.stringify(criteria)]
    );
    return rows[0];
  },

  /**
   * Найти контракт по id.
   * @param {string} contractId - UUID
   */
  async findById(contractId) {
    const { rows } = await query(
      'SELECT * FROM contracts WHERE id = $1',
      [contractId]
    );
    return rows[0] || null;
  },

  /**
   * Найти контракт по room_id.
   * @param {string} roomId
   */
  async findByRoomId(roomId) {
    const { rows } = await query(
      'SELECT * FROM contracts WHERE room_id = $1 ORDER BY created_at DESC LIMIT 1',
      [roomId]
    );
    return rows[0] || null;
  },

  /**
   * Подписать контракт (клиент или фрилансер).
   * @param {string} contractId
   * @param {'client'|'freelancer'} role
   */
  async sign(contractId, role) {
    const column = role === 'client' ? 'signed_by_client' : 'signed_by_freelancer';
    const { rows } = await query(
      `UPDATE contracts
       SET ${column} = TRUE,
           status = CASE
             WHEN signed_by_client = TRUE AND signed_by_freelancer = TRUE THEN 'signed'
             WHEN $2 = 'client' AND signed_by_freelancer = TRUE THEN 'signed'
             WHEN $2 = 'freelancer' AND signed_by_client = TRUE THEN 'signed'
             ELSE 'pending_signature'
           END,
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [contractId, role]
    );
    return rows[0] || null;
  },

  /**
   * Сохранить адрес TON смарт-контракта и перевести в awaiting_payment.
   * @param {string} contractId
   * @param {string} tonAddress
   * @param {number} cryptoAmount
   */
  async setTonContract(contractId, tonAddress, cryptoAmount) {
    const { rows } = await query(
      `UPDATE contracts
       SET ton_contract_address = $2,
           crypto_amount = $3,
           status = 'awaiting_payment',
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [contractId, tonAddress, cryptoAmount]
    );
    return rows[0] || null;
  },

  /**
   * Обновить статус контракта.
   * @param {string} contractId
   * @param {string} status
   */
  async updateStatus(contractId, status) {
    const { rows } = await query(
      `UPDATE contracts SET status = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [contractId, status]
    );
    return rows[0] || null;
  },

  /**
   * Завершить сделку: обновить contracts + rooms + начислить XP.
   * @param {string} contractId
   * @param {string} roomId
   * @param {number} clientId
   * @param {number} freelancerId
   */
  async complete(contractId, roomId, clientId, freelancerId) {
    return transaction(async (client) => {
      // Обновляем контракт
      await client.query(
        `UPDATE contracts SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [contractId]
      );
      // Обновляем комнату
      await client.query(
        `UPDATE rooms SET status = 'completed', closed_at = NOW() WHERE id = $1`,
        [roomId]
      );
      // XP обоим участникам (+200 за закрытие)
      await client.query('SELECT add_xp($1, 200)', [clientId]);
      await client.query('SELECT add_xp($1, 200)', [freelancerId]);
    });
  },
};

module.exports = Contract;

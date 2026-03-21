const { query } = require('../db');

// ============================================================
// Модель: AuditLog
// Все финансовые операции логируются сюда с timestamp.
// Записи НИКОГДА не удаляются.
// ============================================================

const AuditLog = {
  /**
   * Записать финансовую операцию в лог.
   * @param {{ contract_id, action, performed_by, details, tx_hash }} data
   */
  async log({ contract_id, action, performed_by, details = {}, tx_hash = null }) {
    const { rows } = await query(
      `INSERT INTO audit_log (contract_id, action, performed_by, details, tx_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [contract_id, action, performed_by, JSON.stringify(details), tx_hash]
    );
    return rows[0];
  },

  /**
   * Получить все операции по контракту.
   * @param {string} contractId
   */
  async findByContract(contractId) {
    const { rows } = await query(
      `SELECT al.*, u.username AS performed_by_username
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.performed_by
       WHERE al.contract_id = $1
       ORDER BY al.created_at ASC`,
      [contractId]
    );
    return rows;
  },
};

module.exports = AuditLog;

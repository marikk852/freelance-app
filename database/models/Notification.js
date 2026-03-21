const { query } = require('../db');

// ============================================================
// Модель: Notification
// ============================================================

const Notification = {
  /**
   * Создать уведомление для пользователя.
   * @param {{ user_id, type, message, payload }} data
   */
  async create({ user_id, type, message, payload = {} }) {
    const { rows } = await query(
      `INSERT INTO notifications (user_id, type, message, payload)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, type, message, JSON.stringify(payload)]
    );
    return rows[0];
  },

  /**
   * Получить непрочитанные уведомления пользователя.
   * @param {number} userId
   * @param {number} limit
   */
  async findUnread(userId, limit = 20) {
    const { rows } = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1 AND is_read = FALSE
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return rows;
  },

  /**
   * Отметить все уведомления как прочитанные.
   * @param {number} userId
   */
  async markAllRead(userId) {
    await query(
      `UPDATE notifications SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
  },
};

module.exports = Notification;

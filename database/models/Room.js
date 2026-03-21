const { query } = require('../db');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// Модель: Room (Комната сделки)
// ============================================================

const Room = {
  /**
   * Создать новую комнату для клиента.
   * @param {number} clientId - внутренний id клиента
   * @returns {Object} созданная комната с invite_link
   */
  async create(clientId) {
    const inviteLink = uuidv4();
    const { rows } = await query(
      `INSERT INTO rooms (invite_link, client_id)
       VALUES ($1, $2) RETURNING *`,
      [inviteLink, clientId]
    );
    return rows[0];
  },

  /**
   * Найти комнату по invite_link.
   * @param {string} inviteLink
   */
  async findByInviteLink(inviteLink) {
    const { rows } = await query(
      `SELECT r.*,
              c.username AS client_username,
              f.username AS freelancer_username
       FROM rooms r
       LEFT JOIN users c ON c.id = r.client_id
       LEFT JOIN users f ON f.id = r.freelancer_id
       WHERE r.invite_link = $1`,
      [inviteLink]
    );
    return rows[0] || null;
  },

  /**
   * Фрилансер принимает приглашение в комнату.
   * @param {string} roomId
   * @param {number} freelancerId
   */
  async joinAsFreelancer(roomId, freelancerId) {
    const { rows } = await query(
      `UPDATE rooms
       SET freelancer_id = $2, status = 'active', updated_at = NOW()
       WHERE id = $1 AND status = 'waiting' AND freelancer_id IS NULL
       RETURNING *`,
      [roomId, freelancerId]
    );
    return rows[0] || null;
  },

  /**
   * Получить все активные комнаты пользователя.
   * @param {number} userId
   */
  async findActiveByUser(userId) {
    const { rows } = await query(
      `SELECT r.*,
              co.title AS contract_title,
              co.amount_usd,
              co.currency,
              co.status AS contract_status
       FROM rooms r
       LEFT JOIN contracts co ON co.room_id = r.id
       WHERE (r.client_id = $1 OR r.freelancer_id = $1)
         AND r.status NOT IN ('completed', 'cancelled')
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return rows;
  },

  /**
   * Обновить статус комнаты.
   * @param {string} roomId
   * @param {string} status
   */
  async updateStatus(roomId, status) {
    const { rows } = await query(
      `UPDATE rooms SET status = $2,
        closed_at = CASE WHEN $2 IN ('completed','cancelled') THEN NOW() ELSE NULL END
       WHERE id = $1 RETURNING *`,
      [roomId, status]
    );
    return rows[0] || null;
  },
};

module.exports = Room;

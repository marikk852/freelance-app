const { query, transaction } = require('../db');

// ============================================================
// Модель: User
// ============================================================

const User = {
  /**
   * Найти пользователя по telegram_id.
   * @param {number} telegramId
   */
  async findByTelegramId(telegramId) {
    const { rows } = await query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    return rows[0] || null;
  },

  /**
   * Создать нового пользователя или обновить существующего (upsert).
   * @param {{ telegram_id, username, first_name, last_name }} data
   */
  async upsert({ telegram_id, username, first_name, last_name }) {
    const { rows } = await query(
      `INSERT INTO users (telegram_id, username, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_id) DO UPDATE
         SET username   = EXCLUDED.username,
             first_name = EXCLUDED.first_name,
             last_name  = EXCLUDED.last_name,
             updated_at = NOW()
       RETURNING *`,
      [telegram_id, username, first_name, last_name]
    );
    return rows[0];
  },

  /**
   * Register a new user via referral link.
   * Awards 50 coins to referrer per referral.
   * Milestone bonus: +100 extra coins every 5 referrals.
   * Returns { newUser, referrer, isNew }.
   */
  async registerWithReferral({ telegram_id, username, first_name, last_name, referrer_telegram_id }) {
    const existing = await User.findByTelegramId(telegram_id);
    if (existing) {
      return { newUser: existing, referrer: null, isNew: false };
    }

    // Транзакция: регистрация + награда реферера атомарны —
    // нельзя создать пользователя без referral_count++ у реферера
    return transaction(async (client) => {
      const { rows: newRows } = await client.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name, referred_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (telegram_id) DO NOTHING
         RETURNING *`,
        [telegram_id, username, first_name, last_name, referrer_telegram_id]
      );
      const newUser = newRows[0];
      if (!newUser) {
        return { newUser: await User.findByTelegramId(telegram_id), referrer: null, isNew: false };
      }

      const { rows: refRows } = await client.query(
        `UPDATE users
         SET referral_count = referral_count + 1,
             safe_crystals  = safe_crystals + 50,
             updated_at     = NOW()
         WHERE telegram_id = $1
         RETURNING *`,
        [referrer_telegram_id]
      );
      let referrer = refRows[0] || null;

      // Every 5 referrals => milestone bonus +100 coins
      if (referrer && referrer.referral_count % 5 === 0) {
        const { rows: bonusRows } = await client.query(
          `UPDATE users SET safe_crystals = safe_crystals + 100, updated_at = NOW()
           WHERE telegram_id = $1 RETURNING *`,
          [referrer_telegram_id]
        );
        referrer = bonusRows[0] || referrer;
      }

      return { newUser, referrer, isNew: true };
    });
  },

  /**
   * Get referral stats for a user.
   */
  async getReferralStats(telegramId) {
    const { rows } = await query(
      `SELECT referral_count, safe_crystals FROM users WHERE telegram_id = $1`,
      [telegramId]
    );
    return rows[0] || null;
  },

  /**
   * Сохранить TON кошелёк пользователя.
   * @param {number} telegramId
   * @param {string} walletAddress
   */
  async setWallet(telegramId, walletAddress) {
    const { rows } = await query(
      `UPDATE users SET ton_wallet_address = $2, updated_at = NOW()
       WHERE telegram_id = $1 RETURNING *`,
      [telegramId, walletAddress]
    );
    return rows[0] || null;
  },

  /**
   * Начислить XP и обновить уровень.
   * @param {number} userId - внутренний id
   * @param {number} xp - количество XP (50/200/25/10)
   */
  async addXp(userId, xp) {
    await query('SELECT add_xp($1, $2)', [userId, xp]);
  },

  /**
   * Обновить streak при ежедневном входе.
   * @param {number} userId
   */
  async updateStreak(userId) {
    await query('SELECT update_streak($1)', [userId]);
  },

  /**
   * Получить профиль пользователя с полной статистикой.
   * @param {number} telegramId
   */
  async getProfile(telegramId) {
    const { rows } = await query(
      `SELECT u.*,
              COALESCE(r.review_count, 0) AS review_count
       FROM users u
       LEFT JOIN (
         SELECT reviewee_id, COUNT(*) AS review_count
         FROM reviews GROUP BY reviewee_id
       ) r ON r.reviewee_id = u.id
       WHERE u.telegram_id = $1`,
      [telegramId]
    );
    return rows[0] || null;
  },
};

module.exports = User;

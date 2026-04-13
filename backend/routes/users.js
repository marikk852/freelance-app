const express = require('express');
const router  = express.Router();
const { query } = require('../../database/db');
const { User } = require('../../database/models');

// ============================================================
// Routes: /api/users — профиль пользователя
// ============================================================

/**
 * GET /api/users/me
 * Получить профиль текущего пользователя.
 */
router.get('/me', async (req, res) => {
  try {
    const profile = await User.getProfile(req.user.telegramId);
    if (!profile) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * PATCH /api/users/me/wallet
 * Сохранить TON кошелёк пользователя.
 */
router.patch('/me/wallet', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress обязателен' });

    // Validate TON address format
    const TON_ADDRESS_RE = /^(UQ|EQ)[A-Za-z0-9_-]{46}$/;
    if (!TON_ADDRESS_RE.test(walletAddress)) {
      return res.status(400).json({ error: 'Неверный формат TON адреса (ожидается UQ... или EQ...)' });
    }

    const user = await User.setWallet(req.user.telegramId, walletAddress);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/users/:telegramId/portfolio
 * Получить портфолио фрилансера.
 */
router.get('/:telegramId/portfolio', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.title AS contract_title, c.amount_usd, c.currency
       FROM portfolio_items p
       JOIN contracts c ON c.id = p.contract_id
       JOIN users u ON u.id = p.freelancer_id
       WHERE u.telegram_id = $1 AND p.is_visible = TRUE
       ORDER BY p.created_at DESC`,
      [req.params.telegramId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/users/:telegramId/reviews
 * Получить отзывы о пользователе.
 */
router.get('/:telegramId/reviews', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT r.rating, r.comment, r.created_at,
              u.username AS reviewer_username
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       JOIN users rev ON rev.id = r.reviewee_id
       WHERE rev.telegram_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.telegramId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

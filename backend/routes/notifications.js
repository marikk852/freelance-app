const express = require('express');
const router  = express.Router();
const { query } = require('../../database/db');

// ============================================================
// Notifications API — in-app push notifications for Mini App
// ============================================================

/**
 * GET /api/notifications
 * Returns last 50 notifications for the current user.
 */
router.get('/', async (req, res) => {
  try {
    const { telegramId } = req.user;
    const { rows: uRows } = await query(
      `SELECT id FROM users WHERE telegram_id = $1`, [telegramId]
    );
    if (!uRows[0]) return res.json([]);

    const { rows } = await query(
      `SELECT id, type, message, photo_url, is_read, payload, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [uRows[0].id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Notifications] GET /:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Returns the number of unread notifications (for bell badge).
 */
router.get('/unread-count', async (req, res) => {
  try {
    const { telegramId } = req.user;
    const { rows: uRows } = await query(
      `SELECT id FROM users WHERE telegram_id = $1`, [telegramId]
    );
    if (!uRows[0]) return res.json({ count: 0 });

    const { rows } = await query(
      `SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = $1 AND is_read = false`,
      [uRows[0].id]
    );
    res.json({ count: parseInt(rows[0].cnt) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read.
 */
router.patch('/read-all', async (req, res) => {
  try {
    const { telegramId } = req.user;
    const { rows: uRows } = await query(
      `SELECT id FROM users WHERE telegram_id = $1`, [telegramId]
    );
    if (!uRows[0]) return res.json({ ok: true });

    await query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [uRows[0].id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const { telegramId } = req.user;
    const { rows: uRows } = await query(
      `SELECT id FROM users WHERE telegram_id = $1`, [telegramId]
    );
    if (!uRows[0]) return res.json({ ok: true });

    await query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [req.params.id, uRows[0].id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

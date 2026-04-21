const express = require('express');
const router  = express.Router();
const { query } = require('../../database/db');

// ============================================================
// GET /api/livefeed — Real-time deal feed + platform stats
// ============================================================

/**
 * GET /api/livefeed
 * Returns:
 *   stats: { completed, volume_usdt, active, disputes }
 *   events: last 20 real contract events
 */
router.get('/', async (req, res) => {
  try {
    // ---- Platform stats ----
    const statsRes = await query(`
      SELECT
        COUNT(*) FILTER (WHERE c.status = 'completed')                          AS completed,
        COALESCE(SUM(c.amount_usd) FILTER (WHERE c.status = 'completed'), 0)    AS volume_usdt,
        COUNT(*) FILTER (WHERE c.status IN ('active','signed','payment_pending','frozen')) AS active,
        COUNT(*) FILTER (WHERE c.status = 'disputed')                           AS disputes
      FROM contracts c
    `);
    const stats = statsRes.rows[0];

    // ---- Recent events (last 20 contracts with status changes) ----
    const eventsRes = await query(`
      SELECT
        c.id,
        c.title,
        c.amount_usd,
        c.currency,
        c.status,
        c.created_at,
        u.first_name AS client_name,
        u.username   AS client_username
      FROM contracts c
      LEFT JOIN users u ON u.telegram_id = c.client_id
      WHERE c.status IN ('completed','frozen','active','disputed','signed')
      ORDER BY c.created_at DESC
      LIMIT 20
    `);

    const TYPE_MAP = {
      completed     : 'completed',
      frozen        : 'frozen',
      active        : 'new',
      signed        : 'new',
      payment_pending: 'new',
      disputed      : 'disputed',
    };

    const events = eventsRes.rows.map(r => ({
      id       : r.id,
      title    : r.title,
      amount   : parseFloat(r.amount_usd) || 0,
      currency : r.currency || 'USDT',
      type     : TYPE_MAP[r.status] || 'new',
      time     : r.created_at,
    }));

    res.json({
      stats: {
        completed : parseInt(stats.completed) || 0,
        volume    : parseFloat(stats.volume_usdt) || 0,
        active    : parseInt(stats.active) || 0,
        disputes  : parseInt(stats.disputes) || 0,
      },
      events,
    });
  } catch (err) {
    console.error('[API] GET /livefeed error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

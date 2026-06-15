const express  = require('express');
const router   = express.Router();
const path     = require('path');
const axios    = require('axios');
const { query } = require('../../database/db');
const escrowService      = require('../services/escrowService');
const tierService        = require('../services/tierService');
const { sendBroadcast, sendToTargets, processPendingBroadcasts } = require('../services/broadcastService');

// ============================================================
// Admin Panel — /admark
// ============================================================

// In-memory session store (resets on server restart — acceptable for admin panel)
const adminSessions = new Map();

const adminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const expiry = adminSessions.get(token);
  if (!expiry || Date.now() > expiry) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
  next();
};

// Initialize tables for new features
async function initAdminTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key        VARCHAR(100) PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS banned_users (
      telegram_id BIGINT PRIMARY KEY,
      reason      TEXT,
      banned_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS commission_history (
      id         SERIAL PRIMARY KEY,
      value      NUMERIC(5,2) NOT NULL,
      changed_at TIMESTAMPTZ  DEFAULT NOW()
    )
  `);
  // Default settings
  await query(`
    INSERT INTO platform_settings (key, value) VALUES
      ('platform_fee_percent', '2'),
      ('max_deal_amount_usd', '500'),
      ('simulate_payments', 'false'),
      ('maintenance_mode', 'false'),
      ('maintenance_message', '')
    ON CONFLICT (key) DO NOTHING
  `);

  // Broadcast queue — scheduled and immediate broadcasts
  await query(`
    CREATE TABLE IF NOT EXISTS broadcast_queue (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      message      TEXT        NOT NULL,
      photo_url    TEXT,
      segment      VARCHAR(20) NOT NULL DEFAULT 'all',
      push_app     BOOLEAN     NOT NULL DEFAULT true,
      scheduled_at TIMESTAMPTZ NOT NULL,
      status       VARCHAR(20) NOT NULL DEFAULT 'pending',
      sent_at      TIMESTAMPTZ,
      sent_count   INT         DEFAULT 0,
      failed_count INT         DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // photo_url column is added via migration 018_notifications_photo_url.sql
}
initAdminTables().catch(e => console.error('[Admin] init tables error:', e.message));

// ---- HTML ----
router.get('/', (req, res) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; img-src 'self' data:;"
  );
  res.sendFile(path.join(__dirname, '../admin.html'));
});

// ---- Login ----
// Simple brute-force protection: track failed attempts per IP
const loginAttempts = new Map();
router.post('/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };

  // Reset counter after 15 minutes
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + 15 * 60 * 1000; }

  if (record.count >= 10) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }

  const { password } = req.body;
  const secret = process.env.ADMIN_SECRET || '';

  // Constant-time comparison to prevent timing attacks
  const crypto = require('crypto');
  const pwdBuf = Buffer.from(password || '');
  const secBuf = Buffer.from(secret);
  const valid = secret.length > 0 &&
    pwdBuf.length === secBuf.length &&
    crypto.timingSafeEqual(pwdBuf, secBuf);

  if (!valid) {
    record.count++;
    loginAttempts.set(ip, record);
    return res.status(401).json({ error: 'Invalid password' });
  }

  loginAttempts.delete(ip);
  // Return a session token, not the secret itself
  const sessionToken = crypto.randomBytes(32).toString('hex');
  // Store token with 8-hour expiry
  adminSessions.set(sessionToken, Date.now() + 8 * 60 * 60 * 1000);
  res.json({ token: sessionToken });
});

router.use('/api', adminAuth);

// ================================================================
// DASHBOARD
// ================================================================
router.get('/api/stats', async (req, res) => {
  try {
    const [usersR, contractsR, escrowR, disputesR, revenueR, chartR, topR] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h')::int AS today
             FROM users`),
      query(`SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'in_progress')::int AS active,
               COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
               COUNT(*) FILTER (WHERE status = 'disputed')::int AS disputed,
               COALESCE(SUM(amount_usd),0)::numeric AS total_volume
             FROM contracts`),
      query(`SELECT COALESCE(SUM(amount_usd),0)::numeric AS frozen_usd FROM escrow WHERE status='frozen'`),
      query(`SELECT COUNT(*)::int AS open FROM disputes WHERE status='open'`),
      query(`SELECT COALESCE(SUM(platform_fee),0)::numeric AS total_fee FROM escrow WHERE status='released'`),
      query(`SELECT DATE(created_at)::text AS day, COUNT(*)::int AS count
             FROM contracts WHERE created_at > NOW() - INTERVAL '14 days'
             GROUP BY DATE(created_at) ORDER BY day ASC`),
      query(`SELECT u.username, u.first_name, u.telegram_id,
               COUNT(DISTINCT r.id)::int AS deals
             FROM users u
             LEFT JOIN rooms r ON (r.client_id=u.id OR r.freelancer_id=u.id)
             GROUP BY u.id ORDER BY deals DESC LIMIT 5`),
    ]);
    res.json({
      users: usersR.rows[0], contracts: contractsR.rows[0],
      escrow: escrowR.rows[0], disputes: disputesR.rows[0],
      revenue: revenueR.rows[0], chart: chartR.rows, top_users: topR.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// ANALYTICS
// ================================================================
router.get('/api/analytics', async (req, res) => {
  try {
    const [funnelR, avgR, retentionR, catR, dailyRevR] = await Promise.all([
      // Conversion funnel
      query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE signed_by_client AND signed_by_freelancer)::int AS signed,
        COUNT(*) FILTER (WHERE status IN ('in_progress','under_review','completed','disputed'))::int AS paid,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
        FROM contracts`),

      // Average deal size by currency
      query(`SELECT currency,
               ROUND(AVG(amount_usd)::numeric, 2) AS avg_usd,
               COUNT(*)::int AS count
             FROM contracts WHERE status='completed'
             GROUP BY currency`),

      // Retention: users with 2+ deals
      query(`SELECT
        COUNT(DISTINCT u.id)::int AS total_users,
        COUNT(DISTINCT r2.client_id)::int AS returning_clients
        FROM users u
        LEFT JOIN (
          SELECT client_id FROM rooms GROUP BY client_id HAVING COUNT(*)>=2
        ) r2 ON r2.client_id = u.id`),

      // Top job board categories
      query(`SELECT category, COUNT(*)::int AS count
             FROM job_posts GROUP BY category
             ORDER BY count DESC LIMIT 6`),

      // Revenue by day (30 days)
      query(`SELECT DATE(released_at)::text AS day,
               COALESCE(SUM(platform_fee),0)::numeric AS fee
             FROM escrow WHERE status='released'
               AND released_at > NOW() - INTERVAL '30 days'
             GROUP BY DATE(released_at) ORDER BY day ASC`),
    ]);

    res.json({
      funnel    : funnelR.rows[0],
      avg_check : avgR.rows,
      retention : retentionR.rows[0],
      categories: catR.rows,
      daily_rev : dailyRevR.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// MONITORING
// ================================================================
router.get('/api/monitoring', async (req, res) => {
  try {
    const [stuckR, expiredR, escrowR, noFreelR] = await Promise.all([
      // Stuck in in_progress for 7+ days
      query(`SELECT c.id, c.title, c.amount_usd, c.currency, c.updated_at,
               uc.username AS client, uf.username AS freelancer
             FROM contracts c
             JOIN rooms r ON r.id=c.room_id
             JOIN users uc ON uc.id=r.client_id
             LEFT JOIN users uf ON uf.id=r.freelancer_id
             WHERE c.status='in_progress'
               AND c.updated_at < NOW() - INTERVAL '7 days'
             ORDER BY c.updated_at ASC`),

      // Deadline passed, deal not completed
      query(`SELECT c.id, c.title, c.amount_usd, c.currency, c.deadline, c.status,
               uc.username AS client
             FROM contracts c
             JOIN rooms r ON r.id=c.room_id
             JOIN users uc ON uc.id=r.client_id
             WHERE c.deadline < NOW()
               AND c.status NOT IN ('completed','refunded','disputed','draft')
             ORDER BY c.deadline ASC`),

      // Escrow frozen but no activity for 48h
      query(`SELECT c.id, c.title, e.frozen_at, e.amount_usd AS escrow_usd, e.currency,
               uc.username AS client
             FROM escrow e
             JOIN contracts c ON c.id=e.contract_id
             JOIN rooms r ON r.id=c.room_id
             JOIN users uc ON uc.id=r.client_id
             WHERE e.status='frozen'
               AND e.frozen_at < NOW() - INTERVAL '48h'
             ORDER BY e.frozen_at ASC`),

      // Deals waiting for freelancer for 3+ days
      query(`SELECT c.id, c.title, c.created_at, c.amount_usd,
               uc.username AS client
             FROM contracts c
             JOIN rooms r ON r.id=c.room_id
             JOIN users uc ON uc.id=r.client_id
             WHERE c.status='pending_signature'
               AND c.created_at < NOW() - INTERVAL '3 days'
             ORDER BY c.created_at ASC`),
    ]);

    res.json({
      stuck   : stuckR.rows,
      expired : expiredR.rows,
      escrow  : escrowR.rows,
      no_freelancer: noFreelR.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// USERS
// ================================================================
router.get('/api/users', async (req, res) => {
  try {
    const { search = '', limit = 50, offset = 0 } = req.query;
    const { rows } = await query(`
      SELECT u.*,
        COUNT(DISTINCT r.id)::int AS deals_total,
        EXISTS(SELECT 1 FROM banned_users b WHERE b.telegram_id=u.telegram_id) AS is_banned
      FROM users u
      LEFT JOIN rooms r ON (r.client_id=u.id OR r.freelancer_id=u.id)
      WHERE u.username ILIKE $1 OR u.first_name ILIKE $1 OR u.telegram_id::text ILIKE $1
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $2 OFFSET $3
    `, [`%${search}%`, Number(limit), Number(offset)]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// User deal history
router.get('/api/users/:tgId/history', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.id, c.title, c.amount_usd, c.currency, c.status, c.created_at,
        CASE WHEN r.client_id=(SELECT id FROM users WHERE telegram_id=$1)
             THEN 'client' ELSE 'freelancer' END AS role
      FROM contracts c
      JOIN rooms r ON r.id=c.room_id
      WHERE r.client_id=(SELECT id FROM users WHERE telegram_id=$1)
         OR r.freelancer_id=(SELECT id FROM users WHERE telegram_id=$1)
      ORDER BY c.created_at DESC
    `, [req.params.tgId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ban / unban
router.post('/api/users/:tgId/ban', async (req, res) => {
  try {
    const { reason = 'Terms of service violation' } = req.body;
    await query(
      `INSERT INTO banned_users (telegram_id, reason) VALUES ($1, $2)
       ON CONFLICT (telegram_id) DO UPDATE SET reason=$2, banned_at=NOW()`,
      [req.params.tgId, reason]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/users/:tgId/ban', async (req, res) => {
  try {
    await query('DELETE FROM banned_users WHERE telegram_id=$1', [req.params.tgId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Award XP / SafeCoins
router.post('/api/users/:tgId/reward', async (req, res) => {
  try {
    const { xp = 0, coins = 0 } = req.body;
    const { rows } = await query(`
      UPDATE users SET xp = xp + $1, safe_crystals = safe_crystals + $2
      WHERE telegram_id = $3
      RETURNING telegram_id, xp, safe_crystals
    `, [Number(xp), Number(coins), req.params.tgId]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// CONTRACTS
// ================================================================
router.get('/api/contracts', async (req, res) => {
  try {
    const { status = '', limit = 50, offset = 0 } = req.query;
    const params = [Number(limit), Number(offset)];
    // Parameterized status filter — prevents SQL injection
    let statusWhere = '';
    if (status) { params.push(status); statusWhere = `AND c.status = $${params.length}`; }
    const { rows } = await query(`
      SELECT c.id, c.title, c.amount_usd, c.currency, c.status,
             c.created_at, c.deadline,
             uc.username AS client_username, uc.telegram_id AS client_tg_id,
             uf.username AS freelancer_username, uf.telegram_id AS freelancer_tg_id,
             e.status AS escrow_status
      FROM contracts c
      JOIN rooms r ON r.id=c.room_id
      JOIN users uc ON uc.id=r.client_id
      LEFT JOIN users uf ON uf.id=r.freelancer_id
      LEFT JOIN escrow e ON e.contract_id=c.id
      WHERE 1=1 ${statusWhere}
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/api/contracts/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const ALLOWED = ['draft','pending_signature','signed','awaiting_payment',
                     'in_progress','under_review','completed','disputed','refunded'];
    if (!ALLOWED.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const { rows } = await query(
      `UPDATE contracts SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, status`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Contract not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// DISPUTES
// ================================================================
router.get('/api/disputes', async (req, res) => {
  try {
    const { status = 'open' } = req.query;
    const { rows } = await query(`
      SELECT d.id, d.reason, d.status, d.decision, d.split_percent, d.priority,
             d.created_at, d.resolved_at,
             c.id AS contract_id, c.title AS contract_title, c.amount_usd, c.currency,
             uc.username AS client_username, uc.telegram_id AS client_tg_id,
             uf.username AS freelancer_username, uf.telegram_id AS freelancer_tg_id,
             d.client_evidence, d.freelancer_evidence
      FROM disputes d
      JOIN contracts c ON c.id=d.contract_id
      JOIN rooms r ON r.id=c.room_id
      JOIN users uc ON uc.id=r.client_id
      LEFT JOIN users uf ON uf.id=r.freelancer_id
      WHERE d.status=$1
      ORDER BY d.priority DESC, d.created_at ASC
    `, [status]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/disputes/:id/resolve', async (req, res) => {
  try {
    const { decision, split_percent } = req.body;
    if (!['client_wins','freelancer_wins','split'].includes(decision))
      return res.status(400).json({ error: 'Invalid decision' });
    if (decision==='split' && (split_percent==null||split_percent<0||split_percent>100))
      return res.status(400).json({ error: 'split_percent 0–100 is required' });

    const { rows } = await query(`
      SELECT d.contract_id, c.title, uc.telegram_id AS client_tg_id, uf.telegram_id AS freelancer_tg_id
      FROM disputes d
      JOIN contracts c ON c.id=d.contract_id
      JOIN rooms r ON r.id=c.room_id
      JOIN users uc ON uc.id=r.client_id
      LEFT JOIN users uf ON uf.id=r.freelancer_id
      WHERE d.id=$1 AND d.status='open'
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Dispute not found or already resolved' });
    const d = rows[0];

    if (process.env.SIMULATE_PAYMENTS === 'true') {
      const finalStatus = decision==='client_wins' ? 'refunded' : 'completed';
      await query(`UPDATE contracts SET status=$1, updated_at=NOW() WHERE id=$2`, [finalStatus, d.contract_id]);
      await query(`UPDATE escrow SET status=$1 WHERE contract_id=$2`,
        [decision==='client_wins' ? 'refunded' : 'released', d.contract_id]);
    } else {
      if (decision==='client_wins') await escrowService.refundEscrow(d.contract_id, 'admin');
      else await escrowService.splitEscrow(d.contract_id, decision==='freelancer_wins' ? 100 : split_percent, 'admin');
    }
    await query(`UPDATE disputes SET status='resolved', decision=$1, split_percent=$2, resolved_at=NOW() WHERE id=$3`,
      [decision, split_percent||null, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// FINANCES + EXPORT
// ================================================================
router.get('/api/finance', async (req, res) => {
  try {
    const [monthlyR, currencyR, totalR] = await Promise.all([
      query(`SELECT TO_CHAR(DATE_TRUNC('month', released_at), 'YYYY-MM') AS month,
               currency,
               COUNT(*)::int AS deals,
               ROUND(SUM(amount_usd)::numeric,2) AS volume,
               ROUND(SUM(platform_fee)::numeric,2) AS fee
             FROM escrow WHERE status='released' AND released_at IS NOT NULL
             GROUP BY DATE_TRUNC('month', released_at), currency
             ORDER BY month DESC LIMIT 12`),
      query(`SELECT currency,
               COUNT(*)::int AS count,
               ROUND(SUM(amount_usd)::numeric,2) AS volume,
               ROUND(SUM(platform_fee)::numeric,2) AS fee
             FROM escrow WHERE status='released'
             GROUP BY currency`),
      query(`SELECT ROUND(SUM(platform_fee)::numeric,2) AS total_earned,
               ROUND(SUM(amount_usd)::numeric,2) AS total_processed
             FROM escrow WHERE status='released'`),
    ]);
    res.json({ monthly: monthlyR.rows, by_currency: currencyR.rows, total: totalR.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CSV экспорт контрактов
router.get('/api/export/contracts', async (req, res) => {
  try {
    const { from, to } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (from) { params.push(from); where += ` AND c.created_at >= $${params.length}`; }
    if (to)   { params.push(to);   where += ` AND c.created_at <= $${params.length}`; }

    const { rows } = await query(`
      SELECT c.id, c.title, c.amount_usd, c.currency, c.status,
             c.created_at, c.deadline, c.crypto_amount,
             uc.username AS client, uc.telegram_id AS client_tg,
             uf.username AS freelancer, uf.telegram_id AS freelancer_tg,
             e.status AS escrow_status, e.platform_fee
      FROM contracts c
      JOIN rooms r ON r.id=c.room_id
      JOIN users uc ON uc.id=r.client_id
      LEFT JOIN users uf ON uf.id=r.freelancer_id
      LEFT JOIN escrow e ON e.contract_id=c.id
      ${where}
      ORDER BY c.created_at DESC
    `, params);

    const headers = ['ID','Title','Amount USD','Currency','Status','Created','Deadline',
                     'Client','Client TG','Freelancer','Freelancer TG','Escrow','Fee'];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        r.id, `"${(r.title||'').replace(/"/g,'""')}"`,
        r.amount_usd, r.currency, r.status,
        r.created_at ? new Date(r.created_at).toISOString().slice(0,10) : '',
        r.deadline   ? new Date(r.deadline).toISOString().slice(0,10) : '',
        r.client||'', r.client_tg||'',
        r.freelancer||'', r.freelancer_tg||'',
        r.escrow_status||'', r.platform_fee||0,
      ].join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="safedeal_contracts_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv); // BOM for correct opening in Excel
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// PLATFORM SETTINGS
// ================================================================
router.get('/api/settings', async (req, res) => {
  try {
    const { rows } = await query('SELECT key, value FROM platform_settings ORDER BY key');
    const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/settings', async (req, res) => {
  try {
    const allowed = ['platform_fee_percent','max_deal_amount_usd',
                     'simulate_payments','maintenance_mode','maintenance_message'];
    const updates = [];
    for (const [key, value] of Object.entries(req.body)) {
      if (!allowed.includes(key)) continue;
      await query(
        `INSERT INTO platform_settings (key, value, updated_at) VALUES ($1,$2,NOW())
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [key, String(value)]
      );
      updates.push(key);
    }
    res.json({ success: true, updated: updates });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// JOB BOARD
// ================================================================
router.get('/api/jobs', async (req, res) => {
  try {
    const { limit=50, offset=0 } = req.query;
    const { rows } = await query(`
      SELECT jp.*, u.username AS client_username, COUNT(ja.id)::int AS applications_count
      FROM job_posts jp
      JOIN users u ON u.id=jp.client_id
      LEFT JOIN job_applications ja ON ja.job_post_id=jp.id
      GROUP BY jp.id, u.username
      ORDER BY jp.created_at DESC
      LIMIT $1 OFFSET $2
    `, [Number(limit), Number(offset)]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/jobs/:id', async (req, res) => {
  try {
    await query('DELETE FROM job_posts WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// BROADCAST — send or schedule
// ================================================================

// Search users for targeted broadcast
router.get('/api/broadcast/search-users', adminAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 1) return res.json([]);

    const { rows } = await query(
      `SELECT telegram_id, username, first_name, last_name, deals_count, rating
       FROM users
       WHERE (username ILIKE $1 OR CAST(telegram_id AS TEXT) LIKE $2)
         AND NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.telegram_id = users.telegram_id)
       ORDER BY deals_count DESC
       LIMIT 15`,
      [`%${q}%`, `${q}%`]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/broadcast', adminAuth, async (req, res) => {
  try {
    const { message, photoUrl, segment = 'all', pushApp = true, scheduledAt, targetUsers } = req.body;
    if (!message || message.trim().length < 3)
      return res.status(400).json({ error: 'Message is too short' });

    // ── Targeted send to specific users ────────────────────────
    if (Array.isArray(targetUsers) && targetUsers.length > 0) {
      const ids = targetUsers.map(Number).filter(Boolean);
      if (!ids.length) return res.status(400).json({ error: 'No valid telegram IDs provided' });
      const result = await sendToTargets({
        message : message.trim(),
        photoUrl: photoUrl || null,
        telegramIds: ids,
        pushApp : pushApp !== false,
      });
      return res.json({ success: true, ...result });
    }

    // ── Segment broadcast ───────────────────────────────────────
    const validSegments = ['all', 'clients', 'freelancers'];
    if (!validSegments.includes(segment))
      return res.status(400).json({ error: 'Invalid segment' });

    // Scheduled broadcast — save to queue
    if (scheduledAt) {
      const dt = new Date(scheduledAt);
      if (isNaN(dt.getTime()) || dt <= new Date())
        return res.status(400).json({ error: 'scheduledAt must be a future date' });

      const { rows } = await query(
        `INSERT INTO broadcast_queue (message, photo_url, segment, push_app, scheduled_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [message.trim(), photoUrl || null, segment, pushApp !== false, dt]
      );
      return res.json({ scheduled: true, id: rows[0].id, scheduledAt: dt });
    }

    // Immediate broadcast
    const result = await sendBroadcast({
      message : message.trim(),
      photoUrl: photoUrl || null,
      segment,
      pushApp : pushApp !== false,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Admin] broadcast error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET scheduled broadcast queue
router.get('/api/broadcast/queue', adminAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, message, photo_url, segment, push_app, scheduled_at,
              status, sent_at, sent_count, failed_count, created_at
       FROM broadcast_queue
       ORDER BY scheduled_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE (cancel) a scheduled broadcast
router.delete('/api/broadcast/queue/:id', adminAuth, async (req, res) => {
  try {
    const { rowCount } = await query(
      `UPDATE broadcast_queue SET status='cancelled'
       WHERE id=$1 AND status='pending'`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found or already sent' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// ================================================================
// COMMISSION HISTORY
// ================================================================
router.get('/api/commission/history', adminAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT value, changed_at FROM commission_history ORDER BY changed_at DESC LIMIT 30`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/commission/history', adminAuth, async (req, res) => {
  try {
    const { value } = req.body;
    const v = parseFloat(value);
    if (isNaN(v) || v < 0 || v > 20) return res.status(400).json({ error: 'Value must be 0–20' });
    await query(`INSERT INTO commission_history (value) VALUES ($1)`, [v]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================================================================
// QUESTS CRUD (admin)
// ================================================================

// GET /admark/api/quests
router.get('/api/quests', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM quests ORDER BY sort_order ASC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admark/api/quests — create quest
router.post('/api/quests', async (req, res) => {
  try {
    const { key, title, description, crystals, icon = '🎯', category = 'general',
            is_repeatable = false, quest_type = 'manual', quest_config = null, sort_order = 0 } = req.body;
    if (!key || !title || !description || crystals == null) {
      return res.status(400).json({ error: 'key, title, description, crystals required' });
    }
    const { rows } = await query(
      `INSERT INTO quests (key, title, description, crystals, icon, category, is_repeatable, quest_type, quest_config, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [key, title, description, crystals, icon, category, is_repeatable, quest_type, quest_config ? JSON.stringify(quest_config) : null, sort_order]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /admark/api/quests/:id — update quest
router.put('/api/quests/:id', async (req, res) => {
  try {
    const { title, description, crystals, icon, category, is_repeatable,
            is_active, quest_type, quest_config, sort_order } = req.body;
    const { rows } = await query(
      `UPDATE quests SET
         title        = COALESCE($1, title),
         description  = COALESCE($2, description),
         crystals     = COALESCE($3, crystals),
         icon         = COALESCE($4, icon),
         category     = COALESCE($5, category),
         is_repeatable= COALESCE($6, is_repeatable),
         is_active    = COALESCE($7, is_active),
         quest_type   = COALESCE($8, quest_type),
         quest_config = COALESCE($9::jsonb, quest_config),
         sort_order   = COALESCE($10, sort_order)
       WHERE id = $11 RETURNING *`,
      [title, description, crystals, icon, category, is_repeatable,
       is_active, quest_type, quest_config ? JSON.stringify(quest_config) : null, sort_order, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Quest not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /admark/api/quests/:id
router.delete('/api/quests/:id', async (req, res) => {
  try {
    await query(`DELETE FROM quests WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================================================================
// SUBSCRIPTIONS toggle (admin)
// ================================================================

// GET /admark/api/subscriptions/plans
router.get('/api/subscriptions/plans', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM subscription_plans ORDER BY sort_order`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /admark/api/subscriptions/plans/:key/toggle — enable/disable plan
router.patch('/api/subscriptions/plans/:key/toggle', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE subscription_plans SET is_active = NOT is_active WHERE key = $1 RETURNING *`,
      [req.params.key]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Plan not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================================================================
// ECONOMY CONFIG (Фаза 0) — конфиг тарифов + кристальная экономика
// ================================================================

// helper: пустое/undefined → null (для nullable-полей; NULL в *_limit = ∞)
const _num = (v) => (v === '' || v === undefined || v === null ? null : Number(v));

// PUT /admark/api/subscriptions/plans/:key — полный конфиг тарифа
// (прямое присваивание: поддерживает NULL = ∞ для лимитов)
router.put('/api/subscriptions/plans/:key', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `UPDATE subscription_plans SET
         price_early_usd=$1, price_standard_usd=$2, price_usd=$2, commission_percent=$3,
         monthly_crystals=$4, starter_bonus_crystals=$5, crystals_reward=$5,
         earning_bonus_percent=$6, level_gate=$7, early_level_gate=$8,
         active_deals_limit=$9, deal_max_usd=$10, portfolio_limit=$11,
         applications_limit=$12, job_posts_limit=$13
       WHERE key=$14 RETURNING *`,
      [_num(b.price_early_usd), _num(b.price_standard_usd), _num(b.commission_percent),
       _num(b.monthly_crystals) || 0, _num(b.starter_bonus_crystals) || 0,
       _num(b.earning_bonus_percent) || 0, _num(b.level_gate), _num(b.early_level_gate),
       _num(b.active_deals_limit), _num(b.deal_max_usd), _num(b.portfolio_limit),
       _num(b.applications_limit), _num(b.job_posts_limit), req.params.key]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Plan not found' });
    tierService.invalidate(); // правки тарифа действуют сразу
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- crystal_packages CRUD ----------
router.get('/api/crystal-packages', async (req, res) => {
  try { res.json((await query(`SELECT * FROM crystal_packages ORDER BY sort_order`)).rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/api/crystal-packages', async (req, res) => {
  try {
    const { crystals, bonus_crystals = 0, price_usd, sort_order = 0 } = req.body;
    if (crystals == null || price_usd == null) return res.status(400).json({ error: 'crystals, price_usd required' });
    const { rows } = await query(
      `INSERT INTO crystal_packages (crystals, bonus_crystals, price_usd, sort_order)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [crystals, bonus_crystals, price_usd, sort_order]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/api/crystal-packages/:id', async (req, res) => {
  try {
    const { crystals, bonus_crystals, price_usd, sort_order, is_active } = req.body;
    const { rows } = await query(
      `UPDATE crystal_packages SET
         crystals=COALESCE($1,crystals), bonus_crystals=COALESCE($2,bonus_crystals),
         price_usd=COALESCE($3,price_usd), sort_order=COALESCE($4,sort_order),
         is_active=COALESCE($5,is_active)
       WHERE id=$6 RETURNING *`,
      [crystals, bonus_crystals, price_usd, sort_order, is_active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Package not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/api/crystal-packages/:id', async (req, res) => {
  try { await query(`DELETE FROM crystal_packages WHERE id=$1`, [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- crystal_actions CRUD (заработок) ----------
router.get('/api/crystal-actions', async (req, res) => {
  try { res.json((await query(`SELECT * FROM crystal_actions ORDER BY sort_order`)).rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/api/crystal-actions', async (req, res) => {
  try {
    const { key, label, amount, category = 'general', daily_cap = null, sort_order = 0 } = req.body;
    if (!key || !label || amount == null) return res.status(400).json({ error: 'key, label, amount required' });
    const { rows } = await query(
      `INSERT INTO crystal_actions (key, label, amount, category, daily_cap, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [key, label, amount, category, _num(daily_cap), sort_order]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/api/crystal-actions/:id', async (req, res) => {
  try {
    const { label, amount, category, daily_cap, is_active, sort_order } = req.body;
    const { rows } = await query(
      `UPDATE crystal_actions SET
         label=COALESCE($1,label), amount=COALESCE($2,amount), category=COALESCE($3,category),
         daily_cap=$4, is_active=COALESCE($5,is_active), sort_order=COALESCE($6,sort_order)
       WHERE id=$7 RETURNING *`,
      [label, amount, category, _num(daily_cap), is_active, sort_order, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Action not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/api/crystal-actions/:id', async (req, res) => {
  try { await query(`DELETE FROM crystal_actions WHERE id=$1`, [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- crystal_shop_items CRUD (трата, soft-only) ----------
router.get('/api/crystal-shop', async (req, res) => {
  try { res.json((await query(`SELECT * FROM crystal_shop_items ORDER BY sort_order`)).rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/api/crystal-shop', async (req, res) => {
  try {
    const { key, label, cost, category = 'general', sort_order = 0 } = req.body;
    if (!key || !label || cost == null) return res.status(400).json({ error: 'key, label, cost required' });
    const { rows } = await query(
      `INSERT INTO crystal_shop_items (key, label, cost, category, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [key, label, cost, category, sort_order]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/api/crystal-shop/:id', async (req, res) => {
  try {
    const { label, cost, category, is_active, sort_order } = req.body;
    const { rows } = await query(
      `UPDATE crystal_shop_items SET
         label=COALESCE($1,label), cost=COALESCE($2,cost), category=COALESCE($3,category),
         is_active=COALESCE($4,is_active), sort_order=COALESCE($5,sort_order)
       WHERE id=$6 RETURNING *`,
      [label, cost, category, is_active, sort_order, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/api/crystal-shop/:id', async (req, res) => {
  try { await query(`DELETE FROM crystal_shop_items WHERE id=$1`, [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// PUBLIC — platform status (for Mini App)
// ================================================================
router.get('/status', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT key, value FROM platform_settings WHERE key IN ('maintenance_mode','maintenance_message')`
    );
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      maintenance: s.maintenance_mode === 'true',
      message    : s.maintenance_message || '',
    });
  } catch { res.json({ maintenance: false, message: '' }); }
});

module.exports = router;

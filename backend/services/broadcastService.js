const axios  = require('axios');
const { query } = require('../../database/db');

// ============================================================
// Broadcast Service — mass Telegram + in-app notifications
// ============================================================

/**
 * Get telegram_id list filtered by segment.
 * @param {'all'|'clients'|'freelancers'} segment
 */
async function getUsersBySegment(segment) {
  let sql;
  if (segment === 'clients') {
    sql = `SELECT DISTINCT u.telegram_id FROM users u
           JOIN rooms r ON r.client_id = u.id
           WHERE NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.telegram_id = u.telegram_id)`;
  } else if (segment === 'freelancers') {
    sql = `SELECT DISTINCT u.telegram_id FROM users u
           JOIN rooms r ON r.freelancer_id = u.id
           WHERE NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.telegram_id = u.telegram_id)`;
  } else {
    sql = `SELECT u.telegram_id FROM users u
           WHERE NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.telegram_id = u.telegram_id)
           ORDER BY u.created_at DESC`;
  }
  const { rows } = await query(sql);
  return rows;
}

/**
 * Send one Telegram message (with or without photo/GIF).
 */
async function sendToUser(token, telegramId, message, photoUrl) {
  if (photoUrl && photoUrl.trim()) {
    await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, {
      chat_id   : telegramId,
      photo     : photoUrl.trim(),
      caption   : message,
      parse_mode: 'HTML',
    }, { timeout: 8000 });
  } else {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id   : telegramId,
      text      : message,
      parse_mode: 'HTML',
    }, { timeout: 8000 });
  }
}

/**
 * Save in-app notification for all matching users.
 */
async function pushInApp(message, photoUrl, segment) {
  try {
    let sql;
    if (segment === 'clients') {
      sql = `SELECT DISTINCT u.id FROM users u JOIN rooms r ON r.client_id = u.id
             WHERE NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.telegram_id = u.telegram_id)`;
    } else if (segment === 'freelancers') {
      sql = `SELECT DISTINCT u.id FROM users u JOIN rooms r ON r.freelancer_id = u.id
             WHERE NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.telegram_id = u.telegram_id)`;
    } else {
      sql = `SELECT u.id FROM users u
             WHERE NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.telegram_id = u.telegram_id)`;
    }
    const { rows } = await query(sql);
    for (const u of rows) {
      await query(
        `INSERT INTO notifications (user_id, type, message, photo_url, payload)
         VALUES ($1, 'broadcast', $2, $3, '{}')`,
        [u.id, message, photoUrl || null]
      );
    }
  } catch (err) {
    console.error('[Broadcast] pushInApp error:', err.message);
  }
}

/**
 * Send broadcast immediately.
 * @param {{ message: string, photoUrl?: string, segment?: string, pushApp?: boolean }} opts
 * @returns {{ sent: number, failed: number, total: number }}
 */
async function sendBroadcast({ message, photoUrl, segment = 'all', pushApp = true }) {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN not configured');

  const users = await getUsersBySegment(segment);
  let sent = 0, failed = 0;

  for (const u of users) {
    try {
      await sendToUser(token, u.telegram_id, message, photoUrl);
      sent++;
    } catch { failed++; }
    // Telegram rate limit ~30 msg/s — 40ms delay is safe
    await new Promise(r => setTimeout(r, 40));
  }

  if (pushApp) {
    await pushInApp(message, photoUrl, segment);
  }

  return { sent, failed, total: users.length };
}

/**
 * Check broadcast_queue and send any due broadcasts.
 * Called every minute by server.js.
 */
async function processPendingBroadcasts() {
  try {
    const { rows } = await query(
      `SELECT * FROM broadcast_queue
       WHERE status = 'pending' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC
       LIMIT 3`
    );

    for (const bc of rows) {
      // Mark as sending to prevent double-processing
      await query(`UPDATE broadcast_queue SET status='sending' WHERE id=$1`, [bc.id]);

      try {
        const result = await sendBroadcast({
          message : bc.message,
          photoUrl: bc.photo_url,
          segment : bc.segment,
          pushApp : bc.push_app,
        });

        await query(
          `UPDATE broadcast_queue
           SET status='sent', sent_at=NOW(), sent_count=$2, failed_count=$3
           WHERE id=$1`,
          [bc.id, result.sent, result.failed]
        );
        console.log(`[Broadcast] Scheduled broadcast ${bc.id} sent: ${result.sent}/${result.total}`);
      } catch (err) {
        await query(`UPDATE broadcast_queue SET status='failed' WHERE id=$1`, [bc.id]);
        console.error(`[Broadcast] Scheduled broadcast ${bc.id} failed:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Broadcast] processPendingBroadcasts error:', err.message);
  }
}

/**
 * Send broadcast to a specific list of telegram_ids.
 * @param {{ message: string, photoUrl?: string, telegramIds: number[], pushApp?: boolean }} opts
 */
async function sendToTargets({ message, photoUrl, telegramIds, pushApp = true }) {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN not configured');

  let sent = 0, failed = 0;
  const notified = [];

  for (const telegramId of telegramIds) {
    try {
      await sendToUser(token, telegramId, message, photoUrl);
      sent++;
      notified.push(telegramId);
    } catch { failed++; }
    await new Promise(r => setTimeout(r, 40));
  }

  if (pushApp && notified.length > 0) {
    try {
      const placeholders = notified.map((_, i) => `$${i + 1}`).join(',');
      const { rows } = await query(
        `SELECT id FROM users WHERE telegram_id IN (${placeholders})`,
        notified
      );
      for (const u of rows) {
        await query(
          `INSERT INTO notifications (user_id, type, message, photo_url, payload)
           VALUES ($1, 'broadcast', $2, $3, '{}')`,
          [u.id, message, photoUrl || null]
        );
      }
    } catch (err) {
      console.error('[Broadcast] pushInApp (targets) error:', err.message);
    }
  }

  return { sent, failed, total: telegramIds.length };
}

module.exports = { sendBroadcast, sendToTargets, processPendingBroadcasts };

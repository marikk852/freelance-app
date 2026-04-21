const crypto = require('crypto');

// ============================================================
// Auth Middleware — Telegram Web App data verification
// Validates initData from Telegram Mini App using HMAC-SHA256
// ============================================================

/**
 * Verify Telegram Web App initData.
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @param {string} initData - string from Telegram.WebApp.initData
 * @param {string} botToken - bot token
 * @returns {{ valid: boolean, user?: Object }}
 */
function verifyTelegramInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) { console.warn('[Auth] No hash in initData'); return { valid: false }; }

    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const computedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) {
      console.warn('[Auth] HMAC mismatch. Expected:', computedHash, 'Got:', hash);
      return { valid: false };
    }

    const authDate = Number(params.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;
    if (age > 86400 * 7) {
      console.warn('[Auth] initData too old:', age, 'seconds');
      return { valid: false };
    }

    const user = JSON.parse(params.get('user') || '{}');
    return { valid: true, user };
  } catch (e) {
    console.warn('[Auth] Exception:', e.message);
    return { valid: false };
  }
}

/**
 * Express middleware for authorizing Mini App requests.
 * Sets req.user = { telegramId, username, firstName }
 */
function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];

  // Dev bypass: skip verification outside production
  if (process.env.NODE_ENV !== 'production') {
    if (!initData) {
      req.user = { telegramId: 1, username: 'dev', firstName: 'Dev', lastName: '' };
      return next();
    }
  }

  if (!initData) {
    return res.status(401).json({ error: 'Missing X-Telegram-Init-Data header' });
  }

  const botToken = process.env.BOT_TOKEN;
  const { valid, user } = verifyTelegramInitData(initData, botToken);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid Telegram data' });
  }

  req.user = {
    telegramId: user.id,
    username  : user.username,
    firstName : user.first_name,
    lastName  : user.last_name,
  };

  next();
}

module.exports = { authMiddleware, verifyTelegramInitData };

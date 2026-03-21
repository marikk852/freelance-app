const crypto = require('crypto');

// ============================================================
// Auth Middleware — верификация Telegram Web App данных
// Проверяем initData из Telegram Mini App по алгоритму HMAC-SHA256
// ============================================================

/**
 * Верифицировать Telegram Web App initData.
 * Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @param {string} initData - строка из Telegram.WebApp.initData
 * @param {string} botToken - токен бота
 * @returns {{ valid: boolean, user?: Object }}
 */
function verifyTelegramInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return { valid: false };

    params.delete('hash');

    // Строим data-check-string (отсортированные пары key=value)
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // Вычисляем HMAC
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const computedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) return { valid: false };

    // Проверяем что данные не старше 24 часов
    const authDate = Number(params.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return { valid: false };

    const user = JSON.parse(params.get('user') || '{}');
    return { valid: true, user };
  } catch {
    return { valid: false };
  }
}

/**
 * Express middleware для авторизации запросов из Mini App.
 * Кладёт req.user = { telegramId, username, firstName }
 */
function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];

  if (!initData) {
    return res.status(401).json({ error: 'Отсутствует заголовок X-Telegram-Init-Data' });
  }

  const botToken = process.env.BOT_TOKEN;
  const { valid, user } = verifyTelegramInitData(initData, botToken);

  if (!valid) {
    return res.status(401).json({ error: 'Недействительные данные Telegram' });
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

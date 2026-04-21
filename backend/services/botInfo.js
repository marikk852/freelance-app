const https = require('https');

// ============================================================
// Получение username бота из Telegram API (кэшируется)
// ============================================================

let cachedUsername = null;

async function getBotUsername() {
  if (cachedUsername) return cachedUsername;
  if (process.env.BOT_USERNAME) {
    cachedUsername = process.env.BOT_USERNAME;
    return cachedUsername;
  }
  const token = process.env.BOT_TOKEN;
  if (!token) return null;

  return new Promise((resolve) => {
    https.get(`https://api.telegram.org/bot${token}/getMe`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          cachedUsername = info.result?.username || null;
          resolve(cachedUsername);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

module.exports = { getBotUsername };

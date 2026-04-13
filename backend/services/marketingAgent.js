'use strict';
/**
 * SafeDeal Marketing AI Agent
 * Использует Claude API для генерации маркетинговых стратегий,
 * анализа аудитории и создания контента для привлечения клиентов.
 *
 * Акцент: КЛИЕНТЫ размещающие заказы (не фрилансеры).
 */

const Anthropic = require('@anthropic-ai/sdk');

let _client = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('[Marketing] ANTHROPIC_API_KEY не задан в .env');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const PLATFORM_CONTEXT = `
SafeDeal — децентрализованная Telegram Mini App платформа для безопасных сделок между клиентами и фрилансерами.

КЛЮЧЕВЫЕ ПРЕИМУЩЕСТВА ДЛЯ КЛИЕНТОВ:
- Деньги замораживаются в смарт-контракте TON (не у посредника) — нельзя украсть
- Клиент ВСЕГДА защищён: если работа не выполнена — автоматический возврат
- Работа проверяется по чек-листу критериев ДО выплаты фрилансеру
- Спор решает нейтральный арбитр — не фрилансер и не биржа
- Лимит сделки $500 — идеально для небольших проектов
- Работает прямо в Telegram — не нужно регистрироваться на отдельном сайте
- Комиссия всего 2% (против 20% на Upwork/Fiverr)
- Поддержка TON и USDT

ЦЕЛЕВАЯ АУДИТОРИЯ (КЛИЕНТЫ):
- Малый бизнес нанимающий фрилансеров (разработка, дизайн, маркетинг, тексты)
- Стартапы в Telegram/TON экосистеме
- Русскоязычное сообщество в Telegram
- Криптоэнтузиасты доверяющие блокчейну
- Люди которых обманывали фрилансеры раньше
- DAO и крипто-сообщества размещающие задачи

БОЛИ КЛИЕНТОВ КОТОРЫЕ МЫ РЕШАЕМ:
- "Заплатил фрилансеру, он пропал"
- "Получил не то что заказывал"
- "Биржа берёт огромную комиссию"
- "Не хочу регистрироваться на очередной платформе"
- "Хочу платить криптой но боюсь"
`.trim();

/**
 * Генерирует маркетинговую стратегию для SafeDeal.
 * @param {object} params
 * @param {string} params.goal - Цель (например: 'привлечь первых 100 клиентов')
 * @param {string} params.channel - Канал (telegram|twitter|reddit|product_hunt|referral|content)
 * @param {string} [params.audience] - Дополнительный контекст об аудитории
 * @returns {Promise<string>} Готовая стратегия
 */
async function generateStrategy({ goal, channel, audience = '' }) {
  const client = getClient();

  const prompt = `
Ты — опытный маркетолог специализирующийся на B2B SaaS и Web3 продуктах.

ПЛАТФОРМА:
${PLATFORM_CONTEXT}

ЗАДАЧА: ${goal}
КАНАЛ: ${channel}
${audience ? `ДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ: ${audience}` : ''}

Составь конкретный, actionable маркетинговый план:
1. Точечные тактики для этого канала
2. Конкретные сообщения/посты с текстом (готовые к использованию)
3. Метрики для отслеживания успеха
4. Первые 3 действия которые надо сделать СЕГОДНЯ

Фокус: привлечение КЛИЕНТОВ (тех кто размещает заказы), не фрилансеров.
Акцент на безопасность денег и простоту — это главные болевые точки.
`.trim();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

/**
 * Создаёт контент для конкретного канала (пост, объявление, pitch).
 * @param {object} params
 * @param {string} params.type - Тип контента: 'telegram_post'|'cold_dm'|'reddit_post'|'landing_tagline'|'ad_copy'
 * @param {string} [params.context] - Дополнительный контекст
 * @param {string} [params.language] - 'ru'|'en' (default: 'ru')
 * @returns {Promise<string[]>} Массив из 3 вариантов контента
 */
async function generateContent({ type, context = '', language = 'ru' }) {
  const client = getClient();

  const typeDescriptions = {
    telegram_post  : 'пост для Telegram канала/группы',
    cold_dm        : 'холодное DM сообщение потенциальному клиенту',
    reddit_post    : 'пост на Reddit (r/forhire, r/entrepreneur)',
    landing_tagline: 'tagline и подзаголовок для лендинга',
    ad_copy        : 'текст рекламного объявления (Google/Telegram Ads)',
  };

  const langInstruction = language === 'en'
    ? 'Write in English.'
    : 'Пиши на русском языке.';

  const prompt = `
Ты — копирайтер специализирующийся на конвертирующем контенте для tech/Web3 продуктов.

ПЛАТФОРМА:
${PLATFORM_CONTEXT}

ЗАДАЧА: Напиши 3 разных варианта "${typeDescriptions[type] || type}".
${context ? `КОНТЕКСТ: ${context}` : ''}
${langInstruction}

Требования:
- Акцент на БЕЗОПАСНОСТЬ денег клиента — это главный messaging
- Конкретные цифры: 2% комиссия, $500 лимит, TON блокчейн
- Обращение к боли: "больше не нужно бояться что фрилансер исчезнет"
- CTA: переход в бот @SafeDealBot или ссылка на платформу
- Каждый вариант — отдельный подход (страх потери / выгода / социальное доказательство)

Формат ответа — JSON массив из 3 строк:
["вариант 1", "вариант 2", "вариант 3"]
`.trim();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const text = message.content[0].text;
    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [text];
  } catch {
    return [message.content[0].text];
  }
}

/**
 * Анализирует метрики платформы и предлагает точки роста.
 * @param {object} metrics
 * @param {number} metrics.totalUsers
 * @param {number} metrics.totalDeals
 * @param {number} metrics.completedDeals
 * @param {number} metrics.disputeRate - Процент сделок со спором
 * @param {number} metrics.avgDealAmount
 * @returns {Promise<object>} Анализ с рекомендациями
 */
async function analyzeGrowth(metrics) {
  const client = getClient();

  const prompt = `
Ты — growth-hacker для SaaS/marketplace платформ.

ПЛАТФОРМА: SafeDeal (Telegram Mini App для безопасных сделок)

ТЕКУЩИЕ МЕТРИКИ:
- Всего пользователей: ${metrics.totalUsers}
- Всего сделок: ${metrics.totalDeals}
- Завершено сделок: ${metrics.completedDeals}
- Конверсия завершения: ${metrics.totalDeals ? ((metrics.completedDeals / metrics.totalDeals) * 100).toFixed(1) : 0}%
- Сделки со спором: ${metrics.disputeRate}%
- Средняя сумма сделки: $${metrics.avgDealAmount}

Проанализируй узкие места и дай:
1. Топ-3 метрики которые надо улучшить прямо сейчас
2. Конкретные гипотезы для роста (с оценкой impact/effort)
3. Retention механики для удержания клиентов
4. Viral/referral стратегия специфичная для Telegram экосистемы

Отвечай на русском языке. Будь конкретным с цифрами и примерами.
`.trim();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  return {
    analysis: message.content[0].text,
    metrics,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Генерирует персонализированный onboarding message для нового клиента.
 * @param {object} user
 * @param {string} user.username
 * @param {string} [user.context] - Откуда пришёл (реферал, группа, etc.)
 * @returns {Promise<string>}
 */
async function generateWelcomeMessage({ username, context = '' }) {
  const client = getClient();

  const prompt = `
Напиши приветственное сообщение для Telegram бота SafeDeal.

Пользователь: ${username || 'новый пользователь'}
${context ? `Откуда пришёл: ${context}` : ''}

Сообщение должно:
- Быть коротким (3-5 предложений)
- Объяснить главную ценность: деньги в блокчейне = полная безопасность
- Содержать конкретный CTA: "Создать первую сделку"
- Быть в Telegram-стиле (можно эмодзи, но без перебора)
- Говорить на языке клиента (человек который хочет нанять фрилансера)

Пиши на русском языке.
`.trim();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

module.exports = {
  generateStrategy,
  generateContent,
  analyzeGrowth,
  generateWelcomeMessage,
};

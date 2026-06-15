'use strict';
/**
 * SafeDeal — AI помощник по заказу (PRO).
 * Клиент описывает проект свободным текстом → Claude помогает структурировать
 * в готовую сделку (заголовок, описание, ≥3 критерия, бюджет, этапы если >$10k).
 * Возвращает {reply, ready, draft}: reply — что сказать юзеру, draft — заполняется,
 * когда данных достаточно (иначе null), и предзаполняет форму NewDeal.
 */

const Anthropic = require('@anthropic-ai/sdk');
// zod 3.25 содержит и v3, и v4 API; хелпер SDK (zodOutputFormat) ждёт v4-схемы.
const { z } = require('zod/v4');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

let _client = null;
function getClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('[AI] ANTHROPIC_API_KEY не задан в .env');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// Структурированный ответ: разговорная реплика + (опционально) готовый черновик
const DealDraftSchema = z.object({
  reply: z.string().describe('Короткая дружелюбная реплика клиенту на его языке'),
  ready: z.boolean().describe('true, когда черновик достаточно полон для создания сделки'),
  draft: z.object({
    title      : z.string().describe('Короткий заголовок заказа'),
    description: z.string().describe('Ясное описание задачи'),
    criteria   : z.array(z.string()).describe('Минимум 3 измеримых критерия приёмки'),
    budget_usd : z.number().describe('Бюджет в долларах США'),
    milestones : z.array(z.object({
      title     : z.string(),
      amount_usd: z.number(),
    })).describe('Этапы для бюджета >$10000 (каждый ≤ $10000, сумма = бюджету); иначе пустой массив'),
  }).nullable().describe('Заполняется когда ready=true, иначе null'),
});

const SYSTEM_PROMPT = `
Ты — AI-помощник платформы SafeDeal. Помогаешь КЛИЕНТУ превратить идею проекта в
готовую сделку для найма фрилансера. SafeDeal — безопасные сделки через TON-эскроу.

Твоя задача: вести короткий диалог, уточняя недостающее, и собрать структурированный черновик.

ПРАВИЛА ЧЕРНОВИКА:
- title: ёмкий заголовок (до ~60 символов).
- description: что нужно сделать, понятно и конкретно.
- criteria: МИНИМУМ 3 измеримых критерия приёмки ("адаптивная вёрстка до 360px",
  "доставка в течение 7 дней", "исходники в фигме") — то, по чему клиент примет работу.
- budget_usd: разумный бюджет в USD. Если клиент не назвал — предложи диапазон и спроси.
- milestones: если бюджет > $10000 — раздели на этапы, каждый ≤ $10000, сумма = бюджету
  (на SafeDeal один смарт-контракт держит до $10000). Иначе пустой массив [].

ПОВЕДЕНИЕ:
- Реплики короткие и дружелюбные, на языке клиента.
- Пока данных мало (нет ясной задачи / <3 критериев / нет бюджета) — ready=false, draft=null,
  и задавай 1-2 уточняющих вопроса в reply.
- Когда всё есть — ready=true, заполни draft, а в reply кратко подтверди и предложи создать сделку.
- Не выдумывай критерии за клиента без его ввода — предлагай и уточняй.
`.trim();

/**
 * @param {Array<{role:'user'|'assistant', content:string}>} messages
 * @returns {Promise<{reply:string, ready:boolean, draft:object|null}|null>}
 */
async function draftDeal(messages) {
  const client = getClient();
  const response = await client.messages.parse({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages,
    output_config: { format: zodOutputFormat(DealDraftSchema) },
  });
  return response.parsed_output || null;
}

module.exports = { draftDeal };

const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { query } = require('../../database/db');

// ============================================================
// Routes: /api/jobs — биржа заказов
// ============================================================

const createJobSchema = Joi.object({
  title          : Joi.string().min(5).max(256).required(),
  description    : Joi.string().min(20).required(),
  budget_min     : Joi.number().min(0).optional(),
  budget_max     : Joi.number().max(500).optional(),
  currency       : Joi.string().valid('TON', 'USDT').default('USDT'),
  deadline       : Joi.number().integer().min(1).optional(), // дней
  category       : Joi.string().max(64).optional(),
  skills_required: Joi.array().items(Joi.string()).default([]),
});

/**
 * GET /api/jobs
 * Список открытых заказов с фильтрами.
 */
router.get('/', async (req, res) => {
  try {
    const { category, currency, search, limit = 20, offset = 0 } = req.query;

    let whereClause = `WHERE jp.status = 'open' AND jp.expires_at > NOW()`;
    const params = [];
    let paramIdx = 1;

    if (category) {
      whereClause += ` AND jp.category = $${paramIdx++}`;
      params.push(category);
    }
    if (currency) {
      whereClause += ` AND jp.currency = $${paramIdx++}`;
      params.push(currency);
    }
    if (search) {
      whereClause += ` AND to_tsvector('russian', jp.title || ' ' || jp.description) @@ plainto_tsquery('russian', $${paramIdx++})`;
      params.push(search);
    }

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT jp.*,
              u.username AS client_username, u.rating AS client_rating,
              COUNT(ja.id) AS applications_count
       FROM job_posts jp
       JOIN users u ON u.id = jp.client_id
       LEFT JOIN job_applications ja ON ja.job_post_id = jp.id
       ${whereClause}
       GROUP BY jp.id, u.username, u.rating
       ORDER BY jp.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error('[API] GET /jobs error:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * POST /api/jobs
 * Опубликовать заказ.
 */
router.post('/', async (req, res) => {
  try {
    const { error, value } = createJobSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { rows: users } = await query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.user.telegramId]
    );
    if (!users[0]) return res.status(404).json({ error: 'Пользователь не найден' });

    const { rows } = await query(
      `INSERT INTO job_posts
         (client_id, title, description, budget_min, budget_max, currency, deadline, category, skills_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        users[0].id, value.title, value.description,
        value.budget_min, value.budget_max, value.currency,
        value.deadline, value.category,
        JSON.stringify(value.skills_required),
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[API] POST /jobs error:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * POST /api/jobs/:id/apply
 * Фрилансер откликается на заказ.
 */
router.post('/:id/apply', async (req, res) => {
  try {
    const { cover_letter, proposed_amount } = req.body;

    const { rows: users } = await query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.user.telegramId]
    );
    if (!users[0]) return res.status(404).json({ error: 'Пользователь не найден' });

    const { rows } = await query(
      `INSERT INTO job_applications (job_post_id, freelancer_id, cover_letter, proposed_amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (job_post_id, freelancer_id) DO NOTHING
       RETURNING *`,
      [req.params.id, users[0].id, cover_letter, proposed_amount]
    );

    if (!rows[0]) {
      return res.status(409).json({ error: 'Вы уже откликались на этот заказ' });
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[API] POST /jobs/:id/apply error:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { query, transaction } = require('../../database/db');
const { Room, Contract, AuditLog } = require('../../database/models');
const escrowService = require('../services/escrowService');
const notificationService = require('../services/notificationService');

// ============================================================
// Routes: /api/contracts — управление сделками
// ============================================================

// Схема валидации нового контракта
const createContractSchema = Joi.object({
  title      : Joi.string().min(3).max(256).required(),
  description: Joi.string().min(10).required(),
  amount_usd : Joi.number().positive().max(500).required(),
  currency   : Joi.string().valid('TON', 'USDT').required(),
  deadline   : Joi.date().greater('now').required(),
  criteria   : Joi.array().items(
    Joi.object({ text: Joi.string().required(), required: Joi.boolean() })
  ).min(3).required(),
});

/**
 * POST /api/contracts
 * Создать новый контракт (только клиент).
 */
router.post('/', async (req, res) => {
  try {
    const { error, value } = createContractSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { telegramId } = req.user; // из auth middleware

    // Получить user.id по telegram_id
    const { rows: users } = await query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    if (!users[0]) return res.status(404).json({ error: 'Пользователь не найден' });

    const room = await Room.create(users[0].id);

    const contract = await Contract.create({
      room_id    : room.id,
      title      : value.title,
      description: value.description,
      amount_usd : value.amount_usd,
      currency   : value.currency,
      deadline   : value.deadline,
      criteria   : value.criteria,
    });

    // +50 XP за создание сделки
    await query('SELECT add_xp($1, 50)', [users[0].id]);

    // Логируем
    await AuditLog.log({
      contract_id : contract.id,
      action      : 'contract_created',
      performed_by: users[0].id,
      details     : { amount_usd: value.amount_usd, currency: value.currency },
    });

    res.status(201).json({
      contractId : contract.id,
      roomId     : room.id,
      inviteLink : room.invite_link,
      inviteUrl  : `${process.env.WEBAPP_URL}?room=${room.invite_link}`,
    });
  } catch (err) {
    console.error('[API] POST /contracts error:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/contracts/:id
 * Получить контракт с деталями.
 */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              e.status AS escrow_status,
              e.tx_hash_in, e.frozen_at,
              r.invite_link, r.status AS room_status
       FROM contracts c
       LEFT JOIN escrow e ON e.contract_id = c.id
       JOIN rooms r ON r.id = c.room_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Контракт не найден' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[API] GET /contracts/:id error:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * POST /api/contracts/:id/sign
 * Подписать контракт.
 */
router.post('/:id/sign', async (req, res) => {
  try {
    const { role } = req.body; // 'client' | 'freelancer'
    if (!['client', 'freelancer'].includes(role)) {
      return res.status(400).json({ error: 'role должен быть client или freelancer' });
    }

    const contract = await Contract.sign(req.params.id, role);
    if (!contract) return res.status(404).json({ error: 'Контракт не найден' });

    res.json({ status: contract.status, contract });
  } catch (err) {
    console.error('[API] POST /contracts/:id/sign error:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * POST /api/contracts/:id/deploy
 * Задеплоить смарт-контракт после подписания.
 * Требует: clientWallet и freelancerWallet в теле запроса.
 */
router.post('/:id/deploy', async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Контракт не найден' });

    if (contract.status !== 'signed') {
      return res.status(400).json({ error: 'Контракт должен быть подписан обоими' });
    }

    const { clientWallet, freelancerWallet } = req.body;
    if (!clientWallet || !freelancerWallet) {
      return res.status(400).json({ error: 'Необходимы адреса TON кошельков' });
    }

    const result = await escrowService.deployContract({
      contractId       : contract.id,
      clientAddress    : clientWallet,
      freelancerAddress: freelancerWallet,
      amountUsd        : Number(contract.amount_usd),
      currency         : contract.currency,
      deadlineDate     : new Date(contract.deadline),
    });

    res.json(result);
  } catch (err) {
    console.error('[API] POST /contracts/:id/deploy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/contracts/:id/approve
 * Клиент принимает работу → триггерит release().
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { telegramId } = req.user;

    const txHash = await escrowService.releaseEscrow(req.params.id, telegramId);

    // Получить данные для уведомлений
    const { rows } = await query(
      `SELECT c.title, c.currency, c.crypto_amount,
              uf.telegram_id AS freelancer_tg_id
       FROM contracts c
       JOIN rooms r ON r.id = c.room_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (rows[0]) {
      await notificationService.notifyWorkApproved({
        freelancerTgId: rows[0].freelancer_tg_id,
        contractTitle : rows[0].title,
        amount        : rows[0].crypto_amount,
        currency      : rows[0].currency,
      });
    }

    res.json({ success: true, txHash });
  } catch (err) {
    console.error('[API] POST /contracts/:id/approve error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

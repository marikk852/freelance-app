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

// TON address validation (UQ.../EQ... format)
const TON_ADDRESS_RE = /^(UQ|EQ)[A-Za-z0-9_-]{46}$/;

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

    const { telegramId } = req.user;

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
    await query('SELECT add_xp($1, 50)', [users[0].id]).catch(() => {});

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
 * Только участники сделки могут просматривать.
 */
router.get('/:id', async (req, res) => {
  try {
    const { telegramId } = req.user;
    const { rows } = await query(
      `SELECT c.*,
              e.status AS escrow_status,
              e.tx_hash_in, e.frozen_at,
              r.invite_link, r.status AS room_status,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id
       FROM contracts c
       LEFT JOIN escrow e ON e.contract_id = c.id
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       LEFT JOIN users uf ON uf.id = r.freelancer_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Контракт не найден' });

    const row = rows[0];
    const isParticipant = [row.client_tg_id, row.freelancer_tg_id]
      .map(Number).includes(Number(telegramId));
    if (!isParticipant) return res.status(403).json({ error: 'Доступ запрещён' });

    res.json(row);
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

    // Validate TON address format
    if (!TON_ADDRESS_RE.test(clientWallet) || !TON_ADDRESS_RE.test(freelancerWallet)) {
      return res.status(400).json({ error: 'Неверный формат TON адреса' });
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
 * SECURITY: только клиент контракта может вызвать approve.
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { telegramId } = req.user;
    const contractId = req.params.id;

    // Verify caller is the contract's client
    const { rows: contractRows } = await query(
      `SELECT c.id, c.title, c.currency, c.crypto_amount,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id
       FROM contracts c
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       LEFT JOIN users uf ON uf.id = r.freelancer_id
       WHERE c.id = $1`,
      [contractId]
    );

    if (!contractRows[0]) {
      return res.status(404).json({ error: 'Контракт не найден' });
    }

    if (Number(contractRows[0].client_tg_id) !== Number(telegramId)) {
      return res.status(403).json({ error: 'Только клиент может принять работу' });
    }

    const txHash = await escrowService.releaseEscrow(contractId, telegramId);

    if (contractRows[0].freelancer_tg_id) {
      await notificationService.notifyWorkApproved({
        freelancerTgId: contractRows[0].freelancer_tg_id,
        contractTitle : contractRows[0].title,
        amount        : contractRows[0].crypto_amount,
        currency      : contractRows[0].currency,
      });
    }

    res.json({ success: true, txHash });
  } catch (err) {
    console.error('[API] POST /contracts/:id/approve error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

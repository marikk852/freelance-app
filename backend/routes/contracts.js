const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { query, transaction } = require('../../database/db');
const { Room, Contract, AuditLog } = require('../../database/models');
const escrowService = require('../services/escrowService');
const notificationService = require('../services/notificationService');
const tierService = require('../services/tierService');
const crystalService = require('../services/crystalService');
const { getBotUsername } = require('../services/botInfo');

// ============================================================
// Routes: /api/contracts — deal management
// ============================================================

// TON address validation (UQ.../EQ... format)
const TON_ADDRESS_RE = /^(UQ|EQ|kQ|0Q)[A-Za-z0-9_-]{46}$/;

// New contract validation schema
const createContractSchema = Joi.object({
  title      : Joi.string().min(3).max(256).required(),
  description: Joi.string().min(10).required(),
  amount_usd : Joi.number().positive().max(10000).required(), // потолок платформы; тарифный лимит ниже
  currency   : Joi.string().valid('TON', 'USDT').required(),
  deadline   : Joi.date().greater('now').required(),
  criteria   : Joi.array().items(
    Joi.object({ text: Joi.string().required(), required: Joi.boolean() })
  ).min(3).required(),
  // Опц.: telegram_id фрилансера, которому сразу отправить инвайт (сделка из принятого отклика)
  invite_freelancer_tg: Joi.number().integer().optional(),
});

/**
 * POST /api/contracts
 * Create a new contract (client only).
 */
router.post('/', async (req, res) => {
  try {
    const { error, value } = createContractSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { telegramId } = req.user;

    const { rows: users } = await query(
      'SELECT id, subscription_plan, subscription_expires FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    if (!users[0]) return res.status(404).json({ error: 'User not found' });

    // Тарифные ограничения клиента (Фаза 1)
    const tier = await tierService.getTierLimits(users[0]);

    // Лимит суммы сделки по тарифу
    if (tier.deal_max_usd != null && value.amount_usd > tier.deal_max_usd) {
      return res.status(403).json({
        error: `Deal amount $${value.amount_usd} exceeds your ${tier.name} limit of $${tier.deal_max_usd}. Upgrade your plan to create larger deals.`,
      });
    }

    // Лимит одновременно активных сделок (NULL = ∞)
    if (tier.active_deals_limit != null) {
      const { rows: cnt } = await query(
        `SELECT COUNT(*)::int AS n
         FROM contracts c JOIN rooms r ON r.id = c.room_id
         WHERE r.client_id = $1 AND c.status NOT IN ('completed','cancelled','refunded')`,
        [users[0].id]
      );
      if (cnt[0].n >= tier.active_deals_limit) {
        return res.status(403).json({
          error: `You already have ${cnt[0].n} active deal(s) — your ${tier.name} plan allows ${tier.active_deals_limit}. Close a deal or upgrade your plan.`,
        });
      }
    }

    const room = await Room.create(users[0].id);

    const contract = await Contract.create({
      room_id    : room.id,
      title      : value.title,
      description: value.description,
      amount_usd : value.amount_usd,
      currency   : value.currency,
      deadline   : value.deadline,
      criteria   : value.criteria,
      // Фиксируем ставку комиссии тарифа на сделке (смена тарифа не затронет её)
      commission_percent: tier.commission_percent,
    });

    // Client automatically signs upon creation (they are the initiator)
    await Contract.sign(contract.id, 'client');

    // +50 XP + кристаллы за создание сделки
    await query('SELECT add_xp($1, 50)', [users[0].id]).catch(() => {});
    crystalService.award(users[0].id, 'deal_create').catch(() => {});

    await AuditLog.log({
      contract_id : contract.id,
      action      : 'contract_created',
      performed_by: users[0].id,
      details     : { amount_usd: value.amount_usd, currency: value.currency },
    });

    // Invite URL: Telegram deep link → bot shows deal + Mini App button
    const botUsername = await getBotUsername();
    const inviteUrl = botUsername
      ? `https://t.me/${botUsername}?start=room_${room.invite_link}`
      : `${process.env.WEBAPP_URL}?room=${room.invite_link}`;

    // Бесшовно: сделка создана из принятого отклика на бирже — сразу шлём
    // фрилансеру уведомление с прямой ссылкой на присоединение (вручную инвайт
    // отправлять не нужно). Не критично к ошибке — сделка уже создана.
    if (value.invite_freelancer_tg && Number(value.invite_freelancer_tg) !== Number(telegramId)) {
      notificationService.notify(
        value.invite_freelancer_tg,
        'deal_invite',
        `🤝 You've been invited to a deal: *${value.title}*\nTap below to review and join.`,
        { inlineKeyboard: [[{ text: '⚔ Open deal', url: inviteUrl }]], contractId: contract.id }
      ).catch(() => {});
    }

    res.status(201).json({
      contractId : contract.id,
      roomId     : room.id,
      inviteLink : room.invite_link,
      inviteUrl,
    });
  } catch (err) {
    console.error('[API] POST /contracts error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/contracts/:id
 * Get contract with details.
 * Only deal participants can view.
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
    if (!rows[0]) return res.status(404).json({ error: 'Contract not found' });

    const row = rows[0];
    const isParticipant = [row.client_tg_id, row.freelancer_tg_id]
      .map(Number).includes(Number(telegramId));
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    res.json(row);
  } catch (err) {
    console.error('[API] GET /contracts/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/contracts/milestone-deal
 * Создать сделку с этапами (PRO, заказ >$10k). Каждый этап ≤$10k — обычный контракт.
 * Body: { title, description, currency, milestones: [{ title, amount_usd, criteria[], deadline }] }
 */
router.post('/milestone-deal', async (req, res) => {
  try {
    const { telegramId } = req.user;
    const { title, description = '', currency, milestones } = req.body;

    if (!['TON', 'USDT'].includes(currency)) return res.status(400).json({ error: 'currency must be TON or USDT' });
    if (!title || title.length < 3) return res.status(400).json({ error: 'title too short' });
    if (!Array.isArray(milestones) || milestones.length < 2 || milestones.length > 10) {
      return res.status(400).json({ error: 'milestones: 2–10 stages required' });
    }

    // Валидация каждого этапа
    let total = 0;
    for (const [i, m] of milestones.entries()) {
      const amt = Number(m.amount_usd);
      if (!(amt > 0) || amt > 10000) return res.status(400).json({ error: `Stage ${i + 1}: amount must be 1–10000` });
      if (!m.title || String(m.title).length < 3) return res.status(400).json({ error: `Stage ${i + 1}: title too short` });
      const crit = (m.criteria || []).filter(c => c && String(c.text || c).trim());
      if (crit.length < 3) return res.status(400).json({ error: `Stage ${i + 1}: at least 3 criteria` });
      if (!m.deadline || new Date(m.deadline) <= new Date()) return res.status(400).json({ error: `Stage ${i + 1}: deadline must be in the future` });
      total += amt;
    }
    if (total <= 10000) return res.status(400).json({ error: 'Milestone deals are for totals over $10,000 — use a normal deal otherwise' });

    const { rows: users } = await query(
      'SELECT id, subscription_plan, subscription_expires FROM users WHERE telegram_id = $1', [telegramId]
    );
    if (!users[0]) return res.status(404).json({ error: 'User not found' });

    const tier = await tierService.getTierLimits(users[0]);
    if (tier.key !== 'pro') return res.status(403).json({ error: 'Milestone deals are a PRO feature' });

    // room + deal_group + N контрактов-этапов
    const room = await Room.create(users[0].id);
    const { rows: grp } = await query(
      `INSERT INTO deal_groups (room_id, title, description, total_usd, currency)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [room.id, title, description, total, currency]
    );
    const group = grp[0];

    for (const [i, m] of milestones.entries()) {
      const crit = (m.criteria || [])
        .map(c => (typeof c === 'string' ? { text: c, required: true } : { text: c.text, required: c.required !== false }))
        .filter(c => c.text && c.text.trim());
      const contract = await Contract.create({
        room_id           : room.id,
        title             : m.title,
        description        : m.description || description,
        amount_usd        : Number(m.amount_usd),
        currency,
        deadline          : m.deadline,
        criteria          : crit,
        commission_percent: tier.commission_percent,
      });
      // Клиент подписывает все этапы сразу; этап 0 ждёт фрилансера, остальные заблокированы (draft)
      await query(
        `UPDATE contracts SET deal_group_id = $1, milestone_idx = $2,
                signed_by_client = TRUE,
                status = $3
         WHERE id = $4`,
        [group.id, i, i === 0 ? 'pending_signature' : 'draft', contract.id]
      );
    }

    await AuditLog.log({
      action: 'milestone_deal_created', performed_by: users[0].id,
      details: { group_id: group.id, total, stages: milestones.length },
    }).catch(() => {});

    const botUsername = await getBotUsername();
    const inviteUrl = botUsername
      ? `https://t.me/${botUsername}?start=room_${room.invite_link}`
      : `${process.env.WEBAPP_URL}?room=${room.invite_link}`;

    res.status(201).json({ groupId: group.id, roomId: room.id, inviteLink: room.invite_link, inviteUrl, total, stages: milestones.length });
  } catch (err) {
    console.error('[API] POST /contracts/milestone-deal error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/contracts/group/:groupId
 * Группа этапов + список этапов со статусами (для milestone-обзора).
 */
router.get('/group/:groupId', async (req, res) => {
  try {
    const { telegramId } = req.user;
    const { rows: g } = await query(
      `SELECT dg.*, uc.telegram_id AS client_tg, uf.telegram_id AS freelancer_tg
       FROM deal_groups dg
       JOIN rooms r ON r.id = dg.room_id
       JOIN users uc ON uc.id = r.client_id
       LEFT JOIN users uf ON uf.id = r.freelancer_id
       WHERE dg.id = $1`, [req.params.groupId]
    );
    if (!g[0]) return res.status(404).json({ error: 'Deal group not found' });
    const isParticipant = [g[0].client_tg, g[0].freelancer_tg].map(Number).includes(Number(telegramId));
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const { rows: stages } = await query(
      `SELECT c.id, c.title, c.amount_usd, c.status, c.milestone_idx,
              c.ton_contract_address, e.status AS escrow_status
       FROM contracts c LEFT JOIN escrow e ON e.contract_id = c.id
       WHERE c.deal_group_id = $1 ORDER BY c.milestone_idx`, [req.params.groupId]
    );
    res.json({ group: g[0], stages });
  } catch (err) {
    console.error('[API] GET /contracts/group/:groupId error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/contracts/:id/estimate
 * Оценка депозита в TON по текущему курсу — показывается клиенту
 * ДО деплоя контракта (deploy фиксирует точную сумму сам).
 */
router.get('/:id/estimate', async (req, res) => {
  try {
    const { telegramId } = req.user;
    const { rows } = await query(
      `SELECT c.amount_usd, c.currency,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id
       FROM contracts c
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       LEFT JOIN users uf ON uf.id = r.freelancer_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Contract not found' });

    const row = rows[0];
    const isParticipant = [row.client_tg_id, row.freelancer_tg_id]
      .map(Number).includes(Number(telegramId));
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const tonService = require('../services/tonService');
    const tonPrice   = await tonService.getTonUsdPrice();
    res.json({
      amount_usd    : row.amount_usd,
      ton_amount    : (Number(row.amount_usd) / tonPrice).toFixed(4),
      ton_price_usd : tonPrice,
      gas_buffer    : 0.15,
    });
  } catch (err) {
    console.error('[API] GET /contracts/:id/estimate error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/contracts/:id/sign
 * Sign the contract.
 */
router.post('/:id/sign', async (req, res) => {
  try {
    const { role } = req.body; // 'client' | 'freelancer'
    if (!['client', 'freelancer'].includes(role)) {
      return res.status(400).json({ error: 'role must be client or freelancer' });
    }

    const { telegramId } = req.user;

    // Fetch room and participants to verify role
    const { rows: contractRows } = await query(
      `SELECT c.room_id, c.deal_group_id,
              uc.telegram_id AS client_tg_id,
              r.freelancer_id
       FROM contracts c
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!contractRows[0]) return res.status(404).json({ error: 'Contract not found' });

    const cr = contractRows[0];

    if (role === 'client') {
      // SECURITY: only the actual client can sign as client
      if (Number(cr.client_tg_id) !== Number(telegramId)) {
        return res.status(403).json({ error: 'Only the contract client can sign as client' });
      }
    }

    if (role === 'freelancer') {
      const { rows: userRows } = await query(
        'SELECT id FROM users WHERE telegram_id = $1', [telegramId]
      );
      if (!userRows[0]) return res.status(404).json({ error: 'User not found' });

      // SECURITY: client cannot sign as freelancer on their own contract
      if (Number(cr.client_tg_id) === Number(telegramId)) {
        return res.status(403).json({ error: 'The client cannot sign as freelancer' });
      }

      await query(
        `UPDATE rooms SET freelancer_id = $1, status = 'active'
         WHERE id = $2 AND freelancer_id IS NULL`,
        [userRows[0].id, cr.room_id]
      );
    }

    const contract = await Contract.sign(req.params.id, role);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    // Milestone-сделка: подпись фрилансера на этапе = принятие всей сделки →
    // авто-подписываем фрилансера на всех остальных этапах группы (они остаются
    // заблокированными 'draft', пока не дойдёт очередь по последовательности).
    if (role === 'freelancer' && cr.deal_group_id) {
      await query(
        `UPDATE contracts SET signed_by_freelancer = TRUE, updated_at = NOW()
         WHERE deal_group_id = $1 AND id != $2`,
        [cr.deal_group_id, req.params.id]
      );
    }

    res.json({ status: contract.status, contract });
  } catch (err) {
    console.error('[API] POST /contracts/:id/sign error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/contracts/:id/deploy
 * Deploy the smart contract after signing.
 * Requires: clientWallet and freelancerWallet in the request body.
 */
router.post('/:id/deploy', async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    // Milestone-gate: этап i можно деплоить только после completed этапа i-1
    if (contract.deal_group_id && contract.milestone_idx > 0) {
      const { rows: prev } = await query(
        `SELECT status FROM contracts WHERE deal_group_id = $1 AND milestone_idx = $2`,
        [contract.deal_group_id, contract.milestone_idx - 1]
      );
      if (!prev[0] || prev[0].status !== 'completed') {
        return res.status(409).json({ error: 'Previous milestone must be completed first' });
      }
    }

    if (contract.status !== 'signed') {
      return res.status(400).json({ error: 'Contract must be signed by both parties' });
    }

    // Получаем кошельки из профилей участников (через rooms)
    const { rows: roomRows } = await query(
      `SELECT r.client_id, r.freelancer_id,
              uc.ton_wallet_address AS client_wallet,
              uf.ton_wallet_address AS freelancer_wallet
       FROM rooms r
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE r.id = $1`,
      [contract.room_id]
    );
    if (!roomRows[0]) return res.status(404).json({ error: 'Room not found' });

    const clientWallet     = roomRows[0].client_wallet;
    const freelancerWallet = roomRows[0].freelancer_wallet;

    if (!clientWallet)     return res.status(400).json({ error: 'Клиент не привязал TON кошелёк. Добавьте кошелёк в профиле.' });
    if (!freelancerWallet) return res.status(400).json({ error: 'Фрилансер не привязал TON кошелёк. Попросите его добавить кошелёк в профиле.' });

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
    const detail = err.response?.data ?? err.stack ?? err.message;
    console.error('[API] POST /contracts/:id/deploy error:', JSON.stringify(detail));
    res.status(500).json({ error: err.message, detail });
  }
});

/**
 * POST /api/contracts/:id/approve
 * Client approves work → triggers release().
 * SECURITY: only the contract client can call approve.
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
      return res.status(404).json({ error: 'Contract not found' });
    }

    if (Number(contractRows[0].client_tg_id) !== Number(telegramId)) {
      return res.status(403).json({ error: 'Only the client can approve work' });
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

/**
 * POST /api/contracts/:id/simulate-payment
 * ONLY for SIMULATE_PAYMENTS=true.
 * Creates a fake frozen escrow and moves the contract to in_progress.
 * Allows testing the full flow without real TON.
 */
router.post('/:id/simulate-payment', async (req, res) => {
  if (process.env.SIMULATE_PAYMENTS !== 'true') {
    return res.status(403).json({ error: 'Simulation mode is disabled' });
  }

  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    if (!['signed', 'awaiting_payment'].includes(contract.status)) {
      return res.status(400).json({ error: `Invalid contract status: ${contract.status}` });
    }

    const fakeAddress = `EQ${'A'.repeat(46)}`;
    const cryptoAmount = contract.currency === 'USDT'
      ? Number(contract.amount_usd)
      : Number(contract.amount_usd) / 3; // ~3 USD/TON approx

    await query(
      `UPDATE contracts
       SET ton_contract_address = $2, crypto_amount = $3,
           status = 'in_progress', updated_at = NOW()
       WHERE id = $1`,
      [contract.id, fakeAddress, cryptoAmount]
    );

    const { rows: existing } = await query(
      'SELECT id FROM escrow WHERE contract_id = $1', [contract.id]
    );

    if (!existing[0]) {
      // Зафиксированная на сделке ставка тарифа (fallback на env/free)
      const feePercent  = contract.commission_percent != null
        ? Number(contract.commission_percent)
        : (Number(process.env.PLATFORM_FEE_PERCENT) || 5);
      const platformFee = cryptoAmount * feePercent / 100;
      await query(
        `INSERT INTO escrow
           (contract_id, currency, amount, amount_usd, platform_fee, ton_contract_address, status, frozen_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'frozen', NOW())`,
        [contract.id, contract.currency, cryptoAmount, contract.amount_usd, platformFee, fakeAddress]
      );
    } else {
      await query(
        `UPDATE escrow SET status = 'frozen', frozen_at = NOW() WHERE contract_id = $1`,
        [contract.id]
      );
    }

    await query(
      `INSERT INTO audit_log (contract_id, action, details)
       VALUES ($1, 'simulate_payment', $2)`,
      [contract.id, JSON.stringify({ simulated: true, cryptoAmount, currency: contract.currency })]
    );

    console.log(`[Simulate] 🧪 Payment simulated for contract: ${contract.id}`);
    res.json({ success: true, status: 'in_progress', cryptoAmount, currency: contract.currency });
  } catch (err) {
    console.error('[API] POST /contracts/:id/simulate-payment error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/contracts/:id/review
 * Оставить отзыв о контрагенте после завершённой сделки.
 * Рейтинг 1–5; users.rating пересчитывается триггером БД. Один отзыв на сделку.
 */
router.post('/:id/review', async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    const comment = req.body.comment;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be an integer 1–5' });
    }
    if (comment != null && String(comment).length > 1000) {
      return res.status(400).json({ error: 'comment too long (max 1000)' });
    }
    const { telegramId } = req.user;

    const { rows } = await query(
      `SELECT c.status,
              uc.id AS client_id, uc.telegram_id AS client_tg,
              uf.id AS freelancer_id, uf.telegram_id AS freelancer_tg
       FROM contracts c
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       LEFT JOIN users uf ON uf.id = r.freelancer_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Contract not found' });
    const c = rows[0];

    if (c.status !== 'completed') {
      return res.status(400).json({ error: 'You can only review a completed deal' });
    }

    // Кто оставляет отзыв и о ком
    let reviewerId, revieweeId;
    if (Number(c.client_tg) === Number(telegramId)) {
      reviewerId = c.client_id; revieweeId = c.freelancer_id;
    } else if (Number(c.freelancer_tg) === Number(telegramId)) {
      reviewerId = c.freelancer_id; revieweeId = c.client_id;
    } else {
      return res.status(403).json({ error: 'Only deal participants can leave a review' });
    }
    if (!revieweeId) return res.status(400).json({ error: 'No counterparty to review' });

    let review;
    try {
      const { rows: ins } = await query(
        `INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.params.id, reviewerId, revieweeId, rating, comment ?? null]
      );
      review = ins[0];
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'You already reviewed this deal' });
      throw e;
    }

    // +25 XP ревьюеру; кристаллы: review_left — ревьюеру, review_5star — ревьюи
    await query('SELECT add_xp($1, 25)', [reviewerId]).catch(() => {});
    crystalService.award(reviewerId, 'review_left').catch(() => {});
    if (rating === 5) crystalService.award(revieweeId, 'review_5star').catch(() => {});

    await AuditLog.log({
      contract_id : req.params.id,
      action      : 'review_left',
      performed_by: reviewerId,
      details     : { rating },
    }).catch(() => {});

    res.status(201).json(review);
  } catch (err) {
    console.error('[API] POST /contracts/:id/review error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

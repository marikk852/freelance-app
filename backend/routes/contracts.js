const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { query, transaction } = require('../../database/db');
const { Room, Contract, AuditLog } = require('../../database/models');
const escrowService = require('../services/escrowService');
const notificationService = require('../services/notificationService');
const { getBotUsername } = require('../services/botInfo');

// ============================================================
// Routes: /api/contracts — deal management
// ============================================================

// TON address validation (UQ.../EQ... format)
const TON_ADDRESS_RE = /^(UQ|EQ)[A-Za-z0-9_-]{46}$/;

// New contract validation schema
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
 * Create a new contract (client only).
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
    if (!users[0]) return res.status(404).json({ error: 'User not found' });

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

    // Client automatically signs upon creation (they are the initiator)
    await Contract.sign(contract.id, 'client');

    // +50 XP за создание сделки
    await query('SELECT add_xp($1, 50)', [users[0].id]).catch(() => {});

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

    // If freelancer — attach them to the room
    if (role === 'freelancer') {
      const { rows: userRows } = await query(
        'SELECT id FROM users WHERE telegram_id = $1', [telegramId]
      );
      if (!userRows[0]) return res.status(404).json({ error: 'User not found' });

      const { rows: contractRows } = await query(
        'SELECT room_id FROM contracts WHERE id = $1', [req.params.id]
      );
      if (!contractRows[0]) return res.status(404).json({ error: 'Contract not found' });

      await query(
        `UPDATE rooms SET freelancer_id = $1, status = 'active'
         WHERE id = $2 AND freelancer_id IS NULL`,
        [userRows[0].id, contractRows[0].room_id]
      );
    }

    const contract = await Contract.sign(req.params.id, role);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

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

    if (contract.status !== 'signed') {
      return res.status(400).json({ error: 'Contract must be signed by both parties' });
    }

    const { clientWallet, freelancerWallet } = req.body;
    if (!clientWallet || !freelancerWallet) {
      return res.status(400).json({ error: 'TON wallet addresses are required' });
    }

    // Validate TON address format
    if (!TON_ADDRESS_RE.test(clientWallet) || !TON_ADDRESS_RE.test(freelancerWallet)) {
      return res.status(400).json({ error: 'Invalid TON address format' });
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
      const platformFee = cryptoAmount * (Number(process.env.PLATFORM_FEE_PERCENT) || 2) / 100;
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

module.exports = router;

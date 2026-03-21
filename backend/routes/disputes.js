const express = require('express');
const router  = express.Router();
const { query } = require('../../database/db');
const escrowService = require('../services/escrowService');
const notificationService = require('../services/notificationService');

// ============================================================
// Routes: /api/disputes — управление спорами
// ============================================================

/**
 * POST /api/disputes
 * Открыть спор по контракту.
 */
router.post('/', async (req, res) => {
  try {
    const { contractId, reason } = req.body;
    const { telegramId } = req.user;

    if (!contractId || !reason) {
      return res.status(400).json({ error: 'contractId и reason обязательны' });
    }

    // Получить user.id
    const { rows: users } = await query(
      'SELECT id FROM users WHERE telegram_id = $1', [telegramId]
    );
    if (!users[0]) return res.status(404).json({ error: 'Пользователь не найден' });

    // Создать спор
    const { rows } = await query(
      `INSERT INTO disputes (contract_id, opened_by, reason)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [contractId, users[0].id, reason]
    );

    // Перевести контракт в disputed
    await query(
      `UPDATE contracts SET status = 'disputed', updated_at = NOW()
       WHERE id = $1`,
      [contractId]
    );

    // Уведомить обоих участников
    const { rows: parties } = await query(
      `SELECT uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id,
              c.title
       FROM contracts c
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE c.id = $1`,
      [contractId]
    );
    if (parties[0]) {
      await notificationService.notifyDisputeOpened({
        clientTgId    : parties[0].client_tg_id,
        freelancerTgId: parties[0].freelancer_tg_id,
        contractTitle : parties[0].title,
        reason,
      });
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[API] POST /disputes error:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * POST /api/disputes/:id/resolve
 * Арбитр разрешает спор.
 * Body: { decision: 'client_wins'|'freelancer_wins'|'split', splitPercent?: number }
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const { decision, splitPercent } = req.body;
    const { telegramId } = req.user;

    const { rows: disputes } = await query(
      `SELECT d.*, c.id AS contract_id, c.title,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id
       FROM disputes d
       JOIN contracts c ON c.id = d.contract_id
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!disputes[0]) return res.status(404).json({ error: 'Спор не найден' });

    const dispute = disputes[0];
    let txHash;

    // Выполняем действие на блокчейне
    if (decision === 'client_wins') {
      txHash = await escrowService.refundEscrow(dispute.contract_id, telegramId);
    } else if (decision === 'freelancer_wins') {
      txHash = await escrowService.splitEscrow(dispute.contract_id, 100, telegramId);
    } else if (decision === 'split') {
      if (splitPercent === undefined) {
        return res.status(400).json({ error: 'splitPercent обязателен для decision=split' });
      }
      txHash = await escrowService.splitEscrow(dispute.contract_id, splitPercent, telegramId);
    } else {
      return res.status(400).json({ error: 'Неверное decision' });
    }

    // Обновляем спор
    await query(
      `UPDATE disputes
       SET status = 'resolved', decision = $2, split_percent = $3, resolved_at = NOW()
       WHERE id = $1`,
      [req.params.id, decision, splitPercent || null]
    );

    await notificationService.notifyDisputeResolved({
      clientTgId    : dispute.client_tg_id,
      freelancerTgId: dispute.freelancer_tg_id,
      contractTitle : dispute.title,
      decision,
      splitPercent,
    });

    res.json({ success: true, txHash });
  } catch (err) {
    console.error('[API] POST /disputes/:id/resolve error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

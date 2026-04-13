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
 * SECURITY: только участник сделки (клиент или фрилансер) может открыть спор.
 */
router.post('/', async (req, res) => {
  try {
    const { contractId, reason, evidence } = req.body;
    const { telegramId } = req.user;

    if (!contractId || !reason) {
      return res.status(400).json({ error: 'contractId и reason обязательны' });
    }

    // Проверяем что пользователь является участником сделки
    const { rows: participants } = await query(
      `SELECT u.id AS user_id,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id,
              c.title, c.status
       FROM contracts c
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       JOIN users u ON u.telegram_id = $2
       WHERE c.id = $1`,
      [contractId, telegramId]
    );

    if (!participants[0]) {
      return res.status(404).json({ error: 'Контракт не найден' });
    }

    const p = participants[0];
    const isParticipant = [p.client_tg_id, p.freelancer_tg_id]
      .map(Number).includes(Number(telegramId));

    if (!isParticipant) {
      return res.status(403).json({ error: 'Только участники сделки могут открывать споры' });
    }

    if (!['in_progress', 'under_review'].includes(p.status)) {
      return res.status(400).json({ error: 'Спор можно открыть только для активной сделки' });
    }

    // Определяем кто открыл спор
    const openedBy = p.user_id;
    const evidenceJson = evidence ? JSON.stringify(evidence) : null;

    const isClient = Number(p.client_tg_id) === Number(telegramId);

    const { rows } = await query(
      `INSERT INTO disputes (contract_id, opened_by, reason, client_evidence, freelancer_evidence)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        contractId,
        openedBy,
        reason,
        isClient ? evidenceJson : null,
        !isClient ? evidenceJson : null,
      ]
    );

    await query(
      `UPDATE contracts SET status = 'disputed', updated_at = NOW() WHERE id = $1`,
      [contractId]
    );

    await notificationService.notifyDisputeOpened({
      clientTgId    : p.client_tg_id,
      freelancerTgId: p.freelancer_tg_id,
      contractTitle : p.title,
      reason,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[API] POST /disputes error:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * POST /api/disputes/:id/resolve
 * Арбитр разрешает спор.
 * SECURITY: только арбитр платформы (ARBITRATOR_TELEGRAM_ID) может разрешить спор.
 * Body: { decision: 'client_wins'|'freelancer_wins'|'split', splitPercent?: number }
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const { decision, splitPercent } = req.body;
    const { telegramId } = req.user;

    // SECURITY: только арбитр платформы может разрешать споры
    const arbitratorTgId = process.env.ARBITRATOR_TELEGRAM_ID;
    if (!arbitratorTgId || Number(telegramId) !== Number(arbitratorTgId)) {
      return res.status(403).json({ error: 'Только арбитр платформы может разрешить спор' });
    }

    if (!['client_wins', 'freelancer_wins', 'split'].includes(decision)) {
      return res.status(400).json({ error: 'Неверное decision' });
    }

    if (decision === 'split') {
      if (splitPercent === undefined || splitPercent < 0 || splitPercent > 100) {
        return res.status(400).json({ error: 'splitPercent (0-100) обязателен для decision=split' });
      }
    }

    const { rows: disputes } = await query(
      `SELECT d.*, c.id AS contract_id, c.title,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id
       FROM disputes d
       JOIN contracts c ON c.id = d.contract_id
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE d.id = $1 AND d.status = 'open'`,
      [req.params.id]
    );
    if (!disputes[0]) {
      return res.status(404).json({ error: 'Спор не найден или уже разрешён' });
    }

    const dispute = disputes[0];
    let txHash;

    if (decision === 'client_wins') {
      txHash = await escrowService.refundEscrow(dispute.contract_id, telegramId);
    } else if (decision === 'freelancer_wins') {
      txHash = await escrowService.splitEscrow(dispute.contract_id, 100, telegramId);
    } else if (decision === 'split') {
      txHash = await escrowService.splitEscrow(dispute.contract_id, splitPercent, telegramId);
    }

    // Обновляем спор
    await query(
      `UPDATE disputes
       SET status = 'resolved', decision = $2, split_percent = $3, resolved_at = NOW()
       WHERE id = $1`,
      [req.params.id, decision, splitPercent || null]
    );

    // Обновляем статус контракта
    await query(
      `UPDATE contracts SET status = 'disputed_resolved', updated_at = NOW() WHERE id = $1`,
      [dispute.contract_id]
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

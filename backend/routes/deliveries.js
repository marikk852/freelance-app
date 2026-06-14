const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const os      = require('os');
const { query, transaction } = require('../../database/db');
const fileProtection = require('../services/fileProtection');
const escrowService  = require('../services/escrowService');
const notificationService = require('../services/notificationService');
const tierService = require('../services/tierService');
const crystalService = require('../services/crystalService');
const { User } = require('../../database/models');

// Кристальные вехи при закрытии сделки (level_up + достижения).
// level = GREATEST(1, deals_completed/2) → растёт на чётных deals_completed ≥ 4.
function awardDealMilestones(userId, deals) {
  if (!userId || !deals) return;
  if (deals >= 4 && deals % 2 === 0) crystalService.award(userId, 'level_up').catch(() => {});
  const ach = { 10: 'deals_10', 50: 'deals_50', 100: 'deals_100' }[deals];
  if (ach) crystalService.award(userId, ach).catch(() => {});
}

// ============================================================
// Routes: /api/deliveries — freelancer work submission
// ============================================================

// UUID v4 validation regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Multer: temporary storage before encryption
const upload = multer({
  dest   : os.tmpdir(),
  limits : {
    fileSize : (Number(process.env.MAX_FILE_SIZE_MB) || 100) * 1024 * 1024,
    files    : 10,
  },
  fileFilter(req, file, cb) {
    cb(null, true);
  },
});

/**
 * POST /api/deliveries
 * Freelancer submits work — uploads files + description.
 * SECURITY: only the contract freelancer can submit work.
 */
router.post('/', upload.array('files', 10), async (req, res) => {
  const { contractId, description, links } = req.body;
  const uploadedFiles = req.files || [];

  if (!contractId) {
    return res.status(400).json({ error: 'contractId is required' });
  }

  try {
    const { rows: contracts } = await query(
      `SELECT c.id, c.title, c.status,
              r.client_id, r.freelancer_id,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id
       FROM contracts c
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE c.id = $1`,
      [contractId]
    );
    if (!contracts[0]) return res.status(404).json({ error: 'Contract not found' });

    const contract = contracts[0];

    // SECURITY: only the assigned freelancer can submit work
    const { telegramId } = req.user;
    if (Number(contract.freelancer_tg_id) !== Number(telegramId)) {
      return res.status(403).json({ error: 'Only the assigned freelancer can submit work' });
    }

    if (contract.status !== 'in_progress') {
      return res.status(400).json({
        error: `Cannot submit work with status: ${contract.status}`,
      });
    }

    if (uploadedFiles.length === 0 && !description) {
      return res.status(400).json({ error: 'Files or a description must be provided' });
    }

    // Process each file: encrypt + create preview
    const processedFiles = [];
    for (const file of uploadedFiles) {
      try {
        const result = await fileProtection.processFile(file.path, file.originalname);
        processedFiles.push(result);
      } catch (err) {
        console.error(`[Delivery] Error processing file ${file.originalname}:`, err.message);
      }
    }

    // If files were uploaded but none processed — error
    if (uploadedFiles.length > 0 && processedFiles.length === 0) {
      return res.status(500).json({ error: 'Failed to process any files' });
    }

    // Get attempt number
    const { rows: prevDeliveries } = await query(
      `SELECT COUNT(*) AS cnt FROM deliveries WHERE contract_id = $1`,
      [contractId]
    );
    const attemptNumber = Number(prevDeliveries[0].cnt) + 1;

    // Create delivery in DB
    const { rows: deliveries } = await query(
      `INSERT INTO deliveries
         (contract_id, description, files, links, status, attempt_number)
       VALUES ($1, $2, $3, $4, 'submitted', $5)
       RETURNING *`,
      [
        contractId,
        description || '',
        JSON.stringify(processedFiles.map(f => ({
          fileId      : f.fileId,
          originalName: f.originalName,
          previewPath : f.previewPath,
          encryptedPath: f.encryptedPath,
          mimeType    : f.mimeType,
          size        : f.size,
          fileType    : f.fileType,
        }))),
        (() => { try { return links ? JSON.stringify(JSON.parse(links)) : '[]'; } catch { return '[]'; } })(),
        attemptNumber,
      ]
    );

    // Update contract status
    await query(
      `UPDATE contracts SET status = 'under_review', updated_at = NOW() WHERE id = $1`,
      [contractId]
    );

    // Create checklist from contract criteria
    const { rows: contractDetails } = await query(
      'SELECT criteria FROM contracts WHERE id = $1', [contractId]
    );
    if (contractDetails[0]?.criteria) {
      const criteria = contractDetails[0].criteria;
      for (let i = 0; i < criteria.length; i++) {
        await query(
          `INSERT INTO checklist_items
             (contract_id, delivery_id, criterion, criterion_index)
           VALUES ($1, $2, $3, $4)`,
          [contractId, deliveries[0].id, criteria[i].text, i]
        );
      }
    }

    await notificationService.notifyWorkSubmitted({
      clientTgId   : contract.client_tg_id,
      contractTitle: contract.title,
      contractId,
    });

    res.status(201).json({
      deliveryId     : deliveries[0].id,
      filesProcessed : processedFiles.length,
      previewUrls    : processedFiles.map(f => ({
        fileId  : f.fileId,
        name    : f.originalName,
        type    : f.fileType,
        preview : `/api/deliveries/preview/${f.fileId}`,
      })),
    });
  } catch (err) {
    console.error('[Delivery] Error POST /deliveries:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/deliveries/preview/:fileId
 * Send file preview — only to contract participants.
 */
router.get('/preview/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { telegramId } = req.user;

    // Validate fileId to prevent path traversal
    if (!UUID_RE.test(fileId)) {
      return res.status(400).json({ error: 'Invalid fileId format' });
    }

    // SECURITY: verify that the requesting user is a participant in the contract
    const { rows } = await query(
      `SELECT uc.telegram_id AS client_tg_id, uf.telegram_id AS freelancer_tg_id
       FROM deliveries d
       JOIN contracts c ON c.id = d.contract_id
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE d.files::jsonb @> $1::jsonb`,
      [JSON.stringify([{ fileId }])]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Preview not found' });

    const isParticipant = [rows[0].client_tg_id, rows[0].freelancer_tg_id]
      .map(Number).includes(Number(telegramId));
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const fs   = require('fs');
    const path = require('path');
    const previewDir  = fileProtection.DIRS.previews;
    const files       = fs.readdirSync(previewDir);
    const previewFile = files.find(f => f.startsWith(`${fileId}_preview`));

    if (!previewFile) {
      return res.status(404).json({ error: 'Preview not found' });
    }

    const previewPath = path.join(previewDir, previewFile);
    res.sendFile(previewPath);
  } catch (err) {
    console.error('[Delivery] Error GET /preview:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/deliveries/download/:fileId
 * Download the original file — ONLY after release.
 */
router.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { telegramId } = req.user;

    // SECURITY: validate fileId format (prevent path traversal)
    if (!UUID_RE.test(fileId)) {
      return res.status(400).json({ error: 'Invalid fileId format' });
    }

    // Find delivery by searching in JSONB array properly
    const { rows } = await query(
      `SELECT d.files, e.status AS escrow_status,
              r.client_id, r.freelancer_id,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id
       FROM deliveries d
       JOIN contracts c ON c.id = d.contract_id
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       LEFT JOIN escrow e ON e.contract_id = c.id
       WHERE d.files::jsonb @> $1::jsonb AND d.status = 'approved'`,
      [JSON.stringify([{ fileId }])]
    );

    if (!rows[0]) {
      return res.status(403).json({ error: 'File unavailable. An approved delivery is required.' });
    }

    const record = rows[0];
    const isParticipant = [record.client_tg_id, record.freelancer_tg_id]
      .map(Number).includes(Number(telegramId));

    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const decryptedPath = await fileProtection.decryptFile(fileId);
    const fs = require('fs');

    if (!fs.existsSync(decryptedPath)) {
      return res.status(404).json({ error: 'File not found or link has expired' });
    }

    res.download(decryptedPath);
  } catch (err) {
    console.error('[Delivery] Error GET /download:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/deliveries/by-contract/:contractId
 * Get the latest delivery for a contract (for Review screen).
 * SECURITY: only participants of the contract can view.
 */
router.get('/by-contract/:contractId', async (req, res) => {
  try {
    const { contractId } = req.params;
    const { telegramId } = req.user;

    if (!UUID_RE.test(contractId)) {
      return res.status(400).json({ error: 'Invalid contractId format' });
    }

    const { rows } = await query(
      `SELECT d.*,
              c.criteria,
              r.client_id, r.freelancer_id,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id
       FROM deliveries d
       JOIN contracts c ON c.id = d.contract_id
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE d.contract_id = $1
       ORDER BY d.attempt_number DESC
       LIMIT 1`,
      [contractId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'No delivery found for this contract' });
    }

    const record = rows[0];
    const isParticipant = [record.client_tg_id, record.freelancer_tg_id]
      .map(Number).includes(Number(telegramId));

    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const files = typeof record.files === 'string'
      ? JSON.parse(record.files) : (record.files || []);
    const criteria = typeof record.criteria === 'string'
      ? JSON.parse(record.criteria) : (record.criteria || []);

    res.json({
      id          : record.id,
      contractId  : record.contract_id,
      description : record.description,
      status      : record.status,
      attemptNumber: record.attempt_number,
      submittedAt : record.submitted_at,
      reviewComment: record.review_comment,
      files       : files.map((f) => ({
        fileId      : f.fileId,
        originalName: f.originalName,
        fileType    : f.fileType,
        mimeType    : f.mimeType,
      })),
      criteria    : criteria.map ? criteria.map((c) => c.text || c) : [],
    });
  } catch (err) {
    console.error('[Delivery] Error GET /by-contract:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/deliveries/:id
 * Get a specific delivery by id.
 * SECURITY: only participants of the contract can view.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id: deliveryId } = req.params;
    const { telegramId } = req.user;

    if (!UUID_RE.test(deliveryId)) {
      return res.status(400).json({ error: 'Invalid delivery id format' });
    }

    const { rows } = await query(
      `SELECT d.*,
              c.criteria,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id
       FROM deliveries d
       JOIN contracts c ON c.id = d.contract_id
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE d.id = $1`,
      [deliveryId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Delivery not found' });

    const record = rows[0];
    const isParticipant = [record.client_tg_id, record.freelancer_tg_id]
      .map(Number).includes(Number(telegramId));

    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const files = typeof record.files === 'string'
      ? JSON.parse(record.files) : (record.files || []);
    const criteria = typeof record.criteria === 'string'
      ? JSON.parse(record.criteria) : (record.criteria || []);

    res.json({
      id           : record.id,
      contractId   : record.contract_id,
      description  : record.description,
      status       : record.status,
      attemptNumber: record.attempt_number,
      submittedAt  : record.submitted_at,
      reviewComment: record.review_comment,
      files        : files.map((f) => ({
        fileId      : f.fileId,
        originalName: f.originalName,
        fileType    : f.fileType,
        mimeType    : f.mimeType,
      })),
      criteria     : criteria.map ? criteria.map((c) => c.text || c) : [],
    });
  } catch (err) {
    console.error('[Delivery] Error GET /:id:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/deliveries/:id/approve
 * Client approves work → triggers releaseEscrow().
 * SECURITY: only the contract client can approve.
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { id: deliveryId } = req.params;
    const { telegramId } = req.user;

    const { rows } = await query(
      `SELECT d.id, d.contract_id, d.files,
              c.title, c.description AS contract_description,
              r.client_id, r.freelancer_id,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id,
              uf.id AS freelancer_db_id,
              c.crypto_amount, c.currency, c.deadline
       FROM deliveries d
       JOIN contracts c ON c.id = d.contract_id
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE d.id = $1 AND d.status = 'submitted'`,
      [deliveryId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Delivery not found or already processed' });
    }

    const delivery = rows[0];

    // SECURITY: only the contract client can approve work
    if (Number(delivery.client_tg_id) !== Number(telegramId)) {
      return res.status(403).json({ error: 'Only the client can approve work' });
    }

    await transaction(async (client) => {
      await client.query(
        `UPDATE deliveries SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
        [deliveryId]
      );
      await client.query(
        `UPDATE checklist_items SET is_checked = TRUE, checked_at = NOW()
         WHERE delivery_id = $1`,
        [deliveryId]
      );
      // Update contract status
      await client.query(
        `UPDATE contracts SET status = 'completed', updated_at = NOW()
         WHERE id = $1`,
        [delivery.contract_id]
      );
      // Update room
      await client.query(
        `UPDATE rooms SET status = 'completed', closed_at = NOW()
         WHERE id = (SELECT room_id FROM contracts WHERE id = $1)`,
        [delivery.contract_id]
      );
    });

    // Trigger escrow release
    const txHash = await escrowService.releaseEscrow(delivery.contract_id, telegramId);

    // Unlock files
    try {
      const files = typeof delivery.files === 'string'
        ? JSON.parse(delivery.files) : delivery.files;
      await fileProtection.releaseFiles(files);
    } catch (err) {
      console.error('[Delivery] Error releasing files:', err.message);
    }

    // Create portfolio entry for the freelancer.
    // Тарифный лимит видимых работ (FREE 3 / BASIC 10 / PRO ∞): сверх лимита —
    // создаём скрытой (is_visible=FALSE), апгрейд тарифа откроет её.
    try {
      const { rows: fr } = await query(
        `SELECT subscription_plan, subscription_expires FROM users WHERE id = $1`,
        [delivery.freelancer_db_id]
      );
      const ptier = await tierService.getTierLimits(fr[0] || {});
      let visible = true;
      if (ptier.portfolio_limit != null) {
        const { rows: pc } = await query(
          `SELECT COUNT(*)::int AS n FROM portfolio_items
           WHERE freelancer_id = $1 AND is_visible = TRUE`,
          [delivery.freelancer_db_id]
        );
        visible = pc[0].n < ptier.portfolio_limit;
      }
      const { rows: pins } = await query(
        `INSERT INTO portfolio_items
           (freelancer_id, contract_id, title, description, is_visible)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          delivery.freelancer_db_id,
          delivery.contract_id,
          delivery.title,
          delivery.contract_description || '',
          visible,
        ]
      );
      // Кристаллы за добавление видимой работы в портфолио
      if (pins[0] && visible) {
        crystalService.award(delivery.freelancer_db_id, 'portfolio_add').catch(() => {});
      }
    } catch (err) { console.error('[Portfolio] Error creating entry:', err.message); }

    // +200 XP фрилансеру (add_xp САМ инкрементирует deals_completed и уровень)
    const { rows: frXp } = await query(
      `SELECT add_xp(id, 200) AS deals FROM users WHERE telegram_id = $1`,
      [delivery.freelancer_tg_id]
    ).catch(() => ({ rows: [] }));
    awardDealMilestones(delivery.freelancer_db_id, frXp[0] && frXp[0].deals);

    // Кристаллы фрилансеру за закрытие сделки (+ бонусы)
    crystalService.award(delivery.freelancer_db_id, 'deal_close').catch(() => {});
    // Быстрое закрытие — до дедлайна
    if (delivery.deadline && new Date(delivery.deadline) > new Date()) {
      crystalService.award(delivery.freelancer_db_id, 'deal_fast_close').catch(() => {});
    }
    // Без споров — если по контракту нет ни одного спора
    query(`SELECT 1 FROM disputes WHERE contract_id = $1 LIMIT 1`, [delivery.contract_id])
      .then(d => { if (!d.rows[0]) crystalService.award(delivery.freelancer_db_id, 'deal_no_dispute').catch(() => {}); })
      .catch(() => {});

    // Проверяем заработанную верификацию (FREE: ≥3 закрытых сделки + кошелёк ≥14д)
    User.checkEarnedVerification(delivery.freelancer_db_id)
      .then(granted => { if (granted) crystalService.award(delivery.freelancer_db_id, 'account_verified').catch(() => {}); })
      .catch(() => {});

    // +200 XP клиенту (add_xp САМ инкрементирует deals_completed/уровень).
    // NB: убран отдельный UPDATE deals_completed +1 — он давал ДВОЙНОЙ инкремент
    // (add_xp уже считает), из-за чего уровни/гейтинг/верификация были 2× завышены.
    const { rows: clXp } = await query(
      `SELECT add_xp(id, 200) AS deals FROM users WHERE telegram_id = $1`,
      [delivery.client_tg_id]
    ).catch(() => ({ rows: [] }));
    awardDealMilestones(delivery.client_id, clXp[0] && clXp[0].deals);

    await notificationService.notifyWorkApproved({
      freelancerTgId: delivery.freelancer_tg_id,
      contractTitle : delivery.title,
      amount        : delivery.crypto_amount,
      currency      : delivery.currency,
    });

    res.json({ success: true, txHash });
  } catch (err) {
    console.error('[Delivery] Error POST /approve:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/deliveries/:id/reject
 * Client rejects work — revisions needed.
 * SECURITY: only the contract client can reject.
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { id: deliveryId } = req.params;
    const { comment } = req.body;
    const { telegramId } = req.user;

    const { rows } = await query(
      `SELECT d.contract_id,
              uc.telegram_id AS client_tg_id,
              uf.telegram_id AS freelancer_tg_id,
              c.title
       FROM deliveries d
       JOIN contracts c ON c.id = d.contract_id
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE d.id = $1`,
      [deliveryId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Delivery not found' });

    // SECURITY: only the client can reject
    if (Number(rows[0].client_tg_id) !== Number(telegramId)) {
      return res.status(403).json({ error: 'Only the client can reject work' });
    }

    await query(
      `UPDATE deliveries
       SET status = 'rejected', review_comment = $2, reviewed_at = NOW()
       WHERE id = $1`,
      [deliveryId, comment]
    );

    await query(
      `UPDATE contracts SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
      [rows[0].contract_id]
    );

    await notificationService.notifyWorkRejected({
      freelancerTgId: rows[0].freelancer_tg_id,
      contractTitle : rows[0].title,
      comment       : comment || 'No comment provided',
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Delivery] Error POST /reject:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

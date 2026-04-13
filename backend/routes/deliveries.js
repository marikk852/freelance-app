const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const os      = require('os');
const { query, transaction } = require('../../database/db');
const fileProtection = require('../services/fileProtection');
const escrowService  = require('../services/escrowService');
const notificationService = require('../services/notificationService');

// ============================================================
// Routes: /api/deliveries — сдача работы фрилансером
// ============================================================

// UUID v4 validation regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Multer: временное хранение перед шифрованием
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
 * Фрилансер сдаёт работу — загружает файлы + описание.
 * SECURITY: только фрилансер контракта может сдать работу.
 */
router.post('/', upload.array('files', 10), async (req, res) => {
  const { contractId, description, links } = req.body;
  const uploadedFiles = req.files || [];

  if (!contractId) {
    return res.status(400).json({ error: 'contractId обязателен' });
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
    if (!contracts[0]) return res.status(404).json({ error: 'Контракт не найден' });

    const contract = contracts[0];

    // SECURITY: только назначенный фрилансер может сдать работу
    const { telegramId } = req.user;
    if (Number(contract.freelancer_tg_id) !== Number(telegramId)) {
      return res.status(403).json({ error: 'Только назначенный фрилансер может сдать работу' });
    }

    if (contract.status !== 'in_progress') {
      return res.status(400).json({
        error: `Нельзя сдать работу при статусе: ${contract.status}`,
      });
    }

    if (uploadedFiles.length === 0 && !description) {
      return res.status(400).json({ error: 'Нужно загрузить файлы или добавить описание' });
    }

    // Обрабатываем каждый файл: шифрование + превью
    const processedFiles = [];
    for (const file of uploadedFiles) {
      try {
        const result = await fileProtection.processFile(file.path, file.originalname);
        processedFiles.push(result);
      } catch (err) {
        console.error(`[Delivery] Ошибка обработки файла ${file.originalname}:`, err.message);
      }
    }

    // Если были файлы но ни один не обработался — ошибка
    if (uploadedFiles.length > 0 && processedFiles.length === 0) {
      return res.status(500).json({ error: 'Не удалось обработать ни один файл' });
    }

    // Получить номер попытки
    const { rows: prevDeliveries } = await query(
      `SELECT COUNT(*) AS cnt FROM deliveries WHERE contract_id = $1`,
      [contractId]
    );
    const attemptNumber = Number(prevDeliveries[0].cnt) + 1;

    // Создаём delivery в БД
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
        links ? JSON.stringify(JSON.parse(links)) : '[]',
        attemptNumber,
      ]
    );

    // Обновляем статус контракта
    await query(
      `UPDATE contracts SET status = 'under_review', updated_at = NOW() WHERE id = $1`,
      [contractId]
    );

    // Создаём чек-лист из criteria контракта
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
    console.error('[Delivery] Ошибка POST /deliveries:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/deliveries/preview/:fileId
 * Отдать превью файла клиенту для проверки.
 */
router.get('/preview/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    // Validate fileId to prevent path traversal
    if (!UUID_RE.test(fileId)) {
      return res.status(400).json({ error: 'Неверный формат fileId' });
    }

    const fs   = require('fs');
    const path = require('path');
    const previewDir  = fileProtection.DIRS.previews;
    const files       = fs.readdirSync(previewDir);
    const previewFile = files.find(f => f.startsWith(`${fileId}_preview`));

    if (!previewFile) {
      return res.status(404).json({ error: 'Превью не найдено' });
    }

    const previewPath = path.join(previewDir, previewFile);
    res.sendFile(previewPath);
  } catch (err) {
    console.error('[Delivery] Ошибка GET /preview:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/deliveries/download/:fileId
 * Скачать оригинальный файл — ТОЛЬКО после release.
 */
router.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { telegramId } = req.user;

    // SECURITY: validate fileId format (prevent path traversal)
    if (!UUID_RE.test(fileId)) {
      return res.status(400).json({ error: 'Неверный формат fileId' });
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
      return res.status(403).json({ error: 'Файл недоступен. Требуется approved delivery.' });
    }

    const record = rows[0];
    const isParticipant = [record.client_tg_id, record.freelancer_tg_id]
      .map(Number).includes(Number(telegramId));

    if (!isParticipant) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const decryptedPath = await fileProtection.decryptFile(fileId);
    const fs = require('fs');

    if (!fs.existsSync(decryptedPath)) {
      return res.status(404).json({ error: 'Файл не найден или срок действия истёк' });
    }

    res.download(decryptedPath);
  } catch (err) {
    console.error('[Delivery] Ошибка GET /download:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/deliveries/:id/approve
 * Клиент принимает работу → тригерит releaseEscrow().
 * SECURITY: только клиент контракта может одобрить.
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
              c.crypto_amount, c.currency
       FROM deliveries d
       JOIN contracts c ON c.id = d.contract_id
       JOIN rooms r ON r.id = c.room_id
       JOIN users uc ON uc.id = r.client_id
       JOIN users uf ON uf.id = r.freelancer_id
       WHERE d.id = $1 AND d.status = 'submitted'`,
      [deliveryId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Delivery не найден или уже обработан' });
    }

    const delivery = rows[0];

    // SECURITY: только клиент контракта может одобрить работу
    if (Number(delivery.client_tg_id) !== Number(telegramId)) {
      return res.status(403).json({ error: 'Только клиент может принять работу' });
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
      // Обновляем статус контракта
      await client.query(
        `UPDATE contracts SET status = 'completed', updated_at = NOW()
         WHERE id = $1`,
        [delivery.contract_id]
      );
      // Обновляем комнату
      await client.query(
        `UPDATE rooms SET status = 'completed', closed_at = NOW()
         WHERE id = (SELECT room_id FROM contracts WHERE id = $1)`,
        [delivery.contract_id]
      );
    });

    // Триггерим release эскроу
    const txHash = await escrowService.releaseEscrow(delivery.contract_id, telegramId);

    // Разблокируем файлы
    try {
      const files = typeof delivery.files === 'string'
        ? JSON.parse(delivery.files) : delivery.files;
      await fileProtection.releaseFiles(files);
    } catch (err) {
      console.error('[Delivery] Ошибка освобождения файлов:', err.message);
    }

    // Создаём запись портфолио для фрилансера
    await query(
      `INSERT INTO portfolio_items
         (freelancer_id, contract_id, title, description, is_visible)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT DO NOTHING`,
      [
        delivery.freelancer_db_id,
        delivery.contract_id,
        delivery.title,
        delivery.contract_description || '',
      ]
    ).catch(err => console.error('[Portfolio] Ошибка создания:', err.message));

    // +200 XP за завершение сделки (фрилансер)
    await query(
      `SELECT add_xp(id, 200) FROM users WHERE telegram_id = $1`,
      [delivery.freelancer_tg_id]
    ).catch(() => {});

    // +200 XP клиенту
    await query(
      `SELECT add_xp(id, 200) FROM users WHERE telegram_id = $1`,
      [delivery.client_tg_id]
    ).catch(() => {});

    // Увеличиваем deals_completed
    await query(
      `UPDATE users SET deals_completed = deals_completed + 1
       WHERE telegram_id = ANY($1)`,
      [[String(delivery.client_tg_id), String(delivery.freelancer_tg_id)]]
    ).catch(() => {});

    await notificationService.notifyWorkApproved({
      freelancerTgId: delivery.freelancer_tg_id,
      contractTitle : delivery.title,
      amount        : delivery.crypto_amount,
      currency      : delivery.currency,
    });

    res.json({ success: true, txHash });
  } catch (err) {
    console.error('[Delivery] Ошибка POST /approve:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/deliveries/:id/reject
 * Клиент отклоняет работу — нужны правки.
 * SECURITY: только клиент контракта может отклонить.
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
    if (!rows[0]) return res.status(404).json({ error: 'Delivery не найден' });

    // SECURITY: только клиент может отклонить
    if (Number(rows[0].client_tg_id) !== Number(telegramId)) {
      return res.status(403).json({ error: 'Только клиент может отклонить работу' });
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
      comment       : comment || 'Комментарий не указан',
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Delivery] Ошибка POST /reject:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

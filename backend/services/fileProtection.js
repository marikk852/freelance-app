const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// File Protection Service — Агент 5
// Шифрование оригиналов + создание защищённых превью
//
// Форматы:
//   Фото  : watermark + resize 400px (sharp)
//   Видео : 360p + watermark (ffmpeg)
//   PDF   : только страница 1 (pdf-lib)
//   Excel : заголовки видны, данные = *** (xlsx)
//   Код   : первые 35% строк
//   Аудио : первые 30 секунд (ffmpeg)
//   Архив : только список файлов
//
// Хранилище:
//   storage/encrypted/ — AES-256-CBC оригинал
//   storage/previews/  — защищённое превью
//   storage/released/  — оригинал после release (24ч)
// ============================================================

const STORAGE_BASE = process.env.STORAGE_PATH || path.join(__dirname, '../../storage');
const DIRS = {
  encrypted: path.join(STORAGE_BASE, 'encrypted'),
  previews : path.join(STORAGE_BASE, 'previews'),
  released : path.join(STORAGE_BASE, 'released'),
};

// Создаём папки если не существуют
Object.values(DIRS).forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Карта расширений → тип обработки
const FILE_TYPE_MAP = {
  // Фото
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image',
  // Видео
  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video',
  // PDF
  pdf: 'pdf',
  // Таблицы
  xlsx: 'spreadsheet', xls: 'spreadsheet', csv: 'spreadsheet',
  // Код
  js: 'code', ts: 'code', py: 'code', java: 'code', cpp: 'code',
  c: 'code', cs: 'code', php: 'code', rb: 'code', go: 'code',
  rs: 'code', swift: 'code', kt: 'code', html: 'code', css: 'code',
  sql: 'code', sh: 'code', md: 'code', json: 'code', yaml: 'code', yml: 'code',
  // Аудио
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio',
  // Архивы
  zip: 'archive', rar: 'archive', tar: 'archive', gz: 'archive', '7z': 'archive',
};

// ============================================================
// Главная функция: обработать загруженный файл
// ============================================================

/**
 * Принять файл от фрилансера:
 * 1. Зашифровать оригинал (AES-256-CBC) → storage/encrypted/
 * 2. Создать защищённое превью → storage/previews/
 *
 * @param {string} tempFilePath - путь к загруженному файлу
 * @param {string} originalName - оригинальное имя файла
 * @returns {{
 *   fileId        : string,
 *   originalName  : string,
 *   encryptedPath : string,
 *   previewPath   : string,
 *   mimeType      : string,
 *   size          : number,
 *   fileType      : string,
 * }}
 */
async function processFile(tempFilePath, originalName) {
  const ext      = path.extname(originalName).toLowerCase().slice(1);
  const fileType = FILE_TYPE_MAP[ext] || 'unknown';
  const fileId   = uuidv4();
  const size     = fs.statSync(tempFilePath).size;

  // Шаг 1: Зашифровать оригинал
  const encryptedPath = await encryptFile(tempFilePath, fileId, ext);

  // Шаг 2: Создать превью
  const previewPath = await createPreview(tempFilePath, fileId, ext, fileType);

  // Удаляем временный файл
  fs.unlinkSync(tempFilePath);

  return {
    fileId,
    originalName,
    encryptedPath,
    previewPath,
    mimeType : getMimeType(ext),
    size,
    fileType,
  };
}

// ============================================================
// Шифрование оригинала (AES-256-CBC)
// ============================================================

/**
 * Зашифровать файл и сохранить в storage/encrypted/.
 * Приватные ключи ТОЛЬКО из .env — никогда в коде.
 *
 * @param {string} inputPath  - путь к исходному файлу
 * @param {string} fileId     - уникальный ID файла
 * @param {string} ext        - расширение
 * @returns {string} путь к зашифрованному файлу
 */
async function encryptFile(inputPath, fileId, ext) {
  const encKey = process.env.ENCRYPTION_KEY;
  if (!encKey || encKey.length !== 64) {
    throw new Error('[FileProtection] ENCRYPTION_KEY должен быть 64 hex символа (256 бит)');
  }

  const key      = Buffer.from(encKey, 'hex');
  const iv       = crypto.randomBytes(16);
  const cipher   = crypto.createCipheriv('aes-256-cbc', key, iv);
  const outPath  = path.join(DIRS.encrypted, `${fileId}.enc`);

  await new Promise((resolve, reject) => {
    const input  = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outPath);

    // Первые 16 байт файла — IV для расшифровки
    output.write(iv);

    input.pipe(cipher).pipe(output);
    output.on('finish', resolve);
    output.on('error', reject);
    input.on('error', reject);
  });

  // Сохраняем метаданные (расширение нужно для расшифровки)
  const metaPath = path.join(DIRS.encrypted, `${fileId}.meta`);
  fs.writeFileSync(metaPath, JSON.stringify({ ext, originalName: path.basename(inputPath) }));

  return outPath;
}

/**
 * Расшифровать файл для release (24-часовая ссылка).
 *
 * @param {string} fileId - ID файла
 * @returns {string} путь к расшифрованному файлу в storage/released/
 */
async function decryptFile(fileId) {
  const encKey    = process.env.ENCRYPTION_KEY;
  const key       = Buffer.from(encKey, 'hex');
  const encPath   = path.join(DIRS.encrypted, `${fileId}.enc`);
  const metaPath  = path.join(DIRS.encrypted, `${fileId}.meta`);

  if (!fs.existsSync(encPath)) {
    throw new Error(`[FileProtection] Зашифрованный файл не найден: ${fileId}`);
  }

  const meta    = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const outPath = path.join(DIRS.released, `${fileId}.${meta.ext}`);

  // Уже расшифрован
  if (fs.existsSync(outPath)) return outPath;

  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(encPath);
    let ivBuffer = Buffer.alloc(0);
    let ivRead   = false;
    let decipher;
    const output = fs.createWriteStream(outPath);

    input.on('data', (chunk) => {
      if (!ivRead) {
        ivBuffer = Buffer.concat([ivBuffer, chunk]);
        if (ivBuffer.length >= 16) {
          const iv   = ivBuffer.slice(0, 16);
          decipher   = crypto.createDecipheriv('aes-256-cbc', key, iv);
          ivRead     = true;
          const rest = ivBuffer.slice(16);
          if (rest.length > 0) output.write(decipher.update(rest));
        }
      } else {
        output.write(decipher.update(chunk));
      }
    });

    input.on('end', () => {
      if (decipher) output.write(decipher.final());
      output.end();
    });

    output.on('finish', resolve);
    output.on('error', reject);
    input.on('error', reject);
  });

  return outPath;
}

// ============================================================
// Создание превью по типу файла
// ============================================================

/**
 * Создать защищённое превью в зависимости от типа файла.
 */
async function createPreview(inputPath, fileId, ext, fileType) {
  const handlers = {
    image      : createImagePreview,
    video      : createVideoPreview,
    pdf        : createPdfPreview,
    spreadsheet: createSpreadsheetPreview,
    code       : createCodePreview,
    audio      : createAudioPreview,
    archive    : createArchivePreview,
    unknown    : createUnknownPreview,
  };

  const handler = handlers[fileType] || handlers.unknown;
  return handler(inputPath, fileId, ext);
}

// ---- Фото: watermark + resize 400px ----

async function createImagePreview(inputPath, fileId) {
  const sharp    = require('sharp');
  const outPath  = path.join(DIRS.previews, `${fileId}_preview.webp`);
  const watermarkSvg = buildWatermarkSvg(400, 400);

  await sharp(inputPath)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .composite([{
      input: Buffer.from(watermarkSvg),
      gravity: 'center',
    }])
    .webp({ quality: 75 })
    .toFile(outPath);

  return outPath;
}

// ---- Видео: 360p + watermark ----

async function createVideoPreview(inputPath, fileId) {
  const ffmpeg  = require('fluent-ffmpeg');
  const outPath = path.join(DIRS.previews, `${fileId}_preview.mp4`);

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters([
        'scale=640:360:force_original_aspect_ratio=decrease',
        'pad=640:360:(ow-iw)/2:(oh-ih)/2',
        // Текстовый watermark через drawtext
        "drawtext=text='SafeDeal Preview':fontsize=24:fontcolor=white@0.6:" +
        "x=(w-text_w)/2:y=(h-text_h)/2:shadowcolor=black:shadowx=2:shadowy=2",
      ])
      .outputOptions(['-t 30']) // первые 30 секунд
      .output(outPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  return outPath;
}

// ---- PDF: только страница 1 ----

async function createPdfPreview(inputPath, fileId) {
  const { PDFDocument } = require('pdf-lib');
  const outPath = path.join(DIRS.previews, `${fileId}_preview.pdf`);

  const originalBytes  = fs.readFileSync(inputPath);
  const originalPdf    = await PDFDocument.load(originalBytes);
  const previewPdf     = await PDFDocument.create();

  // Копируем только первую страницу
  const [firstPage] = await previewPdf.copyPages(originalPdf, [0]);
  previewPdf.addPage(firstPage);

  // Добавляем watermark текст
  const { rgb, degrees } = require('pdf-lib');
  const page = previewPdf.getPages()[0];
  const { width, height } = page.getSize();

  page.drawText('SAFEDEAL PREVIEW', {
    x       : width / 2 - 120,
    y       : height / 2,
    size    : 36,
    color   : rgb(0, 1, 0.53),
    opacity : 0.3,
    rotate  : degrees(45),
  });

  fs.writeFileSync(outPath, await previewPdf.save());
  return outPath;
}

// ---- Excel/CSV: заголовки видны, данные = *** ----

async function createSpreadsheetPreview(inputPath, fileId, ext) {
  const XLSX    = require('xlsx');
  const outPath = path.join(DIRS.previews, `${fileId}_preview.${ext === 'csv' ? 'csv' : 'xlsx'}`);

  const workbook = XLSX.readFile(inputPath);

  workbook.SheetNames.forEach(sheetName => {
    const sheet  = workbook.Sheets[sheetName];
    const data   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (data.length <= 1) return; // Только заголовки — не трогаем

    // Строки 1+ (данные) заменяем на ***
    const masked = data.map((row, rowIdx) =>
      rowIdx === 0
        ? row  // заголовок оставляем
        : row.map(() => '***')
    );

    workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(masked);
  });

  XLSX.writeFile(workbook, outPath);
  return outPath;
}

// ---- Код: первые 35% строк ----

async function createCodePreview(inputPath, fileId, ext) {
  const outPath = path.join(DIRS.previews, `${fileId}_preview.${ext}`);
  const content = fs.readFileSync(inputPath, 'utf8');
  const lines   = content.split('\n');
  const cutLine = Math.max(1, Math.ceil(lines.length * 0.35));
  const preview = lines.slice(0, cutLine);

  preview.push('');
  preview.push('// ... [SafeDeal Preview — остальной код доступен после оплаты] ...');

  fs.writeFileSync(outPath, preview.join('\n'), 'utf8');
  return outPath;
}

// ---- Аудио: первые 30 секунд ----

async function createAudioPreview(inputPath, fileId, ext) {
  const ffmpeg  = require('fluent-ffmpeg');
  const outExt  = ['mp3', 'wav'].includes(ext) ? ext : 'mp3';
  const outPath = path.join(DIRS.previews, `${fileId}_preview.${outExt}`);

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(['-t 30'])  // первые 30 секунд
      .output(outPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  return outPath;
}

// ---- Архив: только список файлов ----

async function createArchivePreview(inputPath, fileId) {
  const outPath = path.join(DIRS.previews, `${fileId}_preview.txt`);
  let listing   = 'SafeDeal — Список файлов в архиве:\n\n';

  try {
    // Для zip используем встроенные инструменты
    const { execSync } = require('child_process');
    const output = execSync(`unzip -l "${inputPath}" 2>/dev/null || echo "Архив недоступен"`, {
      encoding: 'utf8',
      timeout : 5000,
    });
    listing += output.slice(0, 3000); // ограничиваем размер
  } catch {
    listing += 'Не удалось прочитать содержимое архива.\n';
  }

  listing += '\n\n[Полный архив доступен после подтверждения оплаты]';
  fs.writeFileSync(outPath, listing, 'utf8');
  return outPath;
}

// ---- Неизвестный тип: заглушка ----

async function createUnknownPreview(inputPath, fileId, ext) {
  const outPath = path.join(DIRS.previews, `${fileId}_preview.txt`);
  const size    = fs.statSync(inputPath).size;
  fs.writeFileSync(
    outPath,
    `SafeDeal Preview\n\nФайл: ${path.basename(inputPath)}\nРазмер: ${formatSize(size)}\nТип: .${ext}\n\n[Файл доступен после подтверждения оплаты]`,
    'utf8'
  );
  return outPath;
}

// ============================================================
// Release — разблокировать файлы после approve
// ============================================================

/**
 * Разблокировать все файлы по delivery.
 * Вызывается ТОЛЬКО из escrowService.releaseEscrow().
 *
 * @param {Array<{fileId: string}>} files - массив файлов из delivery.files
 * @returns {Array<{fileId, downloadPath, expiresAt}>}
 */
async function releaseFiles(files) {
  const released = [];

  for (const file of files) {
    try {
      const decryptedPath = await decryptFile(file.fileId);
      const expiresAt     = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24 часа

      released.push({
        fileId      : file.fileId,
        originalName: file.originalName,
        downloadPath: decryptedPath,
        expiresAt,
      });

      // Запланировать удаление через 24 часа
      setTimeout(() => {
        if (fs.existsSync(decryptedPath)) {
          fs.unlinkSync(decryptedPath);
          console.log(`[FileProtection] Удалён released файл: ${file.fileId}`);
        }
      }, 24 * 60 * 60 * 1000);

    } catch (err) {
      console.error(`[FileProtection] Ошибка release файла ${file.fileId}:`, err.message);
    }
  }

  return released;
}

// ============================================================
// Вспомогательные функции
// ============================================================

/**
 * SVG watermark для изображений.
 */
function buildWatermarkSvg(width, height) {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text
      x="50%" y="50%"
      text-anchor="middle" dominant-baseline="middle"
      font-family="monospace" font-size="28"
      fill="rgba(0,255,136,0.55)"
      transform="rotate(-35, ${width / 2}, ${height / 2})"
    >SafeDeal Preview</text>
  </svg>`;
}

/**
 * Получить MIME-тип по расширению.
 */
function getMimeType(ext) {
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', mov: 'video/quicktime',
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel', csv: 'text/csv',
    mp3: 'audio/mpeg', wav: 'audio/wav',
    zip: 'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Форматировать размер файла.
 */
function formatSize(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/**
 * Удалить все файлы сделки (при отмене).
 * @param {string[]} fileIds
 */
async function cleanupFiles(fileIds) {
  for (const fileId of fileIds) {
    const encPath  = path.join(DIRS.encrypted, `${fileId}.enc`);
    const metaPath = path.join(DIRS.encrypted, `${fileId}.meta`);

    [encPath, metaPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    // Превью удаляем по glob
    const previewPattern = `${fileId}_preview`;
    fs.readdirSync(DIRS.previews)
      .filter(f => f.startsWith(previewPattern))
      .forEach(f => fs.unlinkSync(path.join(DIRS.previews, f)));
  }
}

module.exports = {
  processFile,
  encryptFile,
  decryptFile,
  releaseFiles,
  cleanupFiles,
  DIRS,
};

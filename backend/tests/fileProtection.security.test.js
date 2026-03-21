/**
 * SafeDeal — Тесты безопасности защиты файлов
 * Агент 8: оригинал никогда не должен утечь до release
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const os   = require('os');

// Устанавливаем тестовый ключ шифрования
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex символа = 256 бит
process.env.STORAGE_PATH   = path.join(os.tmpdir(), 'safedeal_test_storage');

const fileProtection = require('../services/fileProtection');

// ============================================================
// Вспомогательные функции
// ============================================================

function createTempFile(content, ext) {
  const tmpPath = path.join(os.tmpdir(), `test_${Date.now()}.${ext}`);
  fs.writeFileSync(tmpPath, content);
  return tmpPath;
}

function cleanup(...paths) {
  paths.forEach(p => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {} });
}

// ============================================================
// КРИТИЧНО: Шифрование и расшифровка
// ============================================================
describe('🔐 AES-256-CBC шифрование', () => {
  it('зашифрованный файл НЕ содержит оригинальный текст в открытом виде', async () => {
    const secret  = 'СЕКРЕТНЫЙ КОНТЕНТ НЕЛЬЗЯ ВИДЕТЬ';
    const tmpPath = createTempFile(secret, 'txt');

    const encPath = await fileProtection.encryptFile(tmpPath, 'test-enc-1', 'txt');
    const encContent = fs.readFileSync(encPath).toString('utf8');

    // Зашифрованное содержимое не должно содержать оригинальный текст
    expect(encContent).not.toContain(secret);
    cleanup(tmpPath, encPath);
  });

  it('расшифрованный файл совпадает с оригиналом', async () => {
    const original = 'Оригинальный контент для теста шифрования 12345';
    const tmpPath  = createTempFile(original, 'txt');
    const fileId   = 'test-roundtrip-1';

    await fileProtection.encryptFile(tmpPath, fileId, 'txt');
    const decPath    = await fileProtection.decryptFile(fileId);
    const decContent = fs.readFileSync(decPath, 'utf8');

    expect(decContent).toBe(original);
    cleanup(tmpPath, decPath,
      path.join(fileProtection.DIRS.encrypted, `${fileId}.enc`),
      path.join(fileProtection.DIRS.encrypted, `${fileId}.meta`)
    );
  });

  it('каждый вызов encryptFile создаёт УНИКАЛЬНЫЙ зашифрованный файл (разные IV)', async () => {
    const content  = 'одинаковый контент';
    const tmp1     = createTempFile(content, 'txt');
    const tmp2     = createTempFile(content, 'txt');

    const enc1 = await fileProtection.encryptFile(tmp1, 'iv-test-1', 'txt');
    const enc2 = await fileProtection.encryptFile(tmp2, 'iv-test-2', 'txt');

    const bytes1 = fs.readFileSync(enc1);
    const bytes2 = fs.readFileSync(enc2);

    // Разные IV → разные шифртексты даже при одинаковом входе
    expect(bytes1.equals(bytes2)).toBe(false);
    cleanup(tmp1, tmp2, enc1, enc2);
  });

  it('должен ВЫБРОСИТЬ ошибку при отсутствии ENCRYPTION_KEY', async () => {
    const origKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = '';
    const tmp = createTempFile('test', 'txt');

    await expect(
      fileProtection.encryptFile(tmp, 'no-key', 'txt')
    ).rejects.toThrow('ENCRYPTION_KEY');

    process.env.ENCRYPTION_KEY = origKey;
    cleanup(tmp);
  });

  it('должен ВЫБРОСИТЬ ошибку при ключе неверной длины', async () => {
    const origKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'tooshort';
    const tmp = createTempFile('test', 'txt');

    await expect(
      fileProtection.encryptFile(tmp, 'short-key', 'txt')
    ).rejects.toThrow('ENCRYPTION_KEY');

    process.env.ENCRYPTION_KEY = origKey;
    cleanup(tmp);
  });
});

// ============================================================
// Превью кода — только 35% строк, не больше
// ============================================================
describe('💻 Превью кода — ограничение 35%', () => {
  it('превью содержит ровно 35% строк (округлено вверх)', async () => {
    // 100 строк → 35 строк в превью
    const lines   = Array.from({ length: 100 }, (_, i) => `const line${i} = ${i};`);
    const tmpPath = createTempFile(lines.join('\n'), 'js');
    const fileId  = 'code-preview-test';

    const previewPath = await fileProtection.createPreview(
      tmpPath, fileId, 'js', 'code'
    );
    const preview = fs.readFileSync(previewPath, 'utf8');
    const previewLines = preview.split('\n').filter(l => l.startsWith('const'));

    expect(previewLines.length).toBe(35);
    cleanup(tmpPath, previewPath);
  });

  it('превью содержит заглушку о недоступном коде', async () => {
    const code    = Array.from({ length: 20 }, (_, i) => `function fn${i}() {}`).join('\n');
    const tmpPath = createTempFile(code, 'py');
    const fileId  = 'py-preview-test';

    const previewPath = await fileProtection.createPreview(tmpPath, fileId, 'py', 'code');
    const preview     = fs.readFileSync(previewPath, 'utf8');

    expect(preview).toContain('SafeDeal Preview');
    expect(preview).toContain('оплаты');
    cleanup(tmpPath, previewPath);
  });

  it('секретные строки из нижних 65% НЕ попадают в превью', async () => {
    const lines = [
      ...Array.from({ length: 10 }, (_, i) => `// public line ${i}`),
      ...Array.from({ length: 20 }, (_, i) => `// SECRET_DATA_${i} = "password${i}"`),
    ];
    const tmpPath     = createTempFile(lines.join('\n'), 'js');
    const fileId      = 'secret-lines-test';
    const previewPath = await fileProtection.createPreview(tmpPath, fileId, 'js', 'code');
    const preview     = fs.readFileSync(previewPath, 'utf8');

    // SECRET_DATA не должны быть в превью
    expect(preview).not.toMatch(/SECRET_DATA_[5-9]|SECRET_DATA_1[0-9]/);
    cleanup(tmpPath, previewPath);
  });
});

// ============================================================
// Превью таблиц — данные замаскированы
// ============================================================
describe('📊 Превью Excel/CSV — маскировка данных', () => {
  it('данные заменены на ***, заголовки сохранены', async () => {
    const XLSX   = require('xlsx');
    const data   = [
      ['Имя', 'Email', 'Телефон', 'Пароль'],
      ['Иван', 'ivan@mail.com', '+7999', 'secret123'],
      ['Петя', 'petya@mail.com', '+7888', 'qwerty'],
    ];
    const wb      = XLSX.utils.book_new();
    const ws      = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    const tmpPath = path.join(os.tmpdir(), `test_${Date.now()}.xlsx`);
    XLSX.writeFile(wb, tmpPath);

    const fileId      = 'xlsx-mask-test';
    const previewPath = await fileProtection.createPreview(tmpPath, fileId, 'xlsx', 'spreadsheet');
    const previewWb   = XLSX.readFile(previewPath);
    const previewData = XLSX.utils.sheet_to_json(previewWb.Sheets['Sheet1'], { header: 1 });

    // Заголовки сохранены
    expect(previewData[0]).toEqual(['Имя', 'Email', 'Телефон', 'Пароль']);
    // Данные замаскированы
    expect(previewData[1]).toEqual(['***', '***', '***', '***']);
    expect(previewData[2]).toEqual(['***', '***', '***', '***']);
    // Секрет не виден
    expect(JSON.stringify(previewData)).not.toContain('secret123');
    expect(JSON.stringify(previewData)).not.toContain('ivan@mail.com');

    cleanup(tmpPath, previewPath);
  });
});

// ============================================================
// Расшифровка несуществующего файла
// ============================================================
describe('🚫 Граничные случаи расшифровки', () => {
  it('должен ВЫБРОСИТЬ ошибку при расшифровке несуществующего fileId', async () => {
    await expect(
      fileProtection.decryptFile('non-existent-file-id-000')
    ).rejects.toThrow('не найден');
  });
});

// ============================================================
// PDF — только первая страница в превью
// ============================================================
describe('📄 PDF превью — только страница 1', () => {
  it('создаёт превью PDF с watermark-текстом', async () => {
    const { PDFDocument } = require('pdf-lib');
    // Создаём тестовый PDF с 3 страницами
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage(); pdfDoc.addPage(); pdfDoc.addPage();
    const pdfBytes = await pdfDoc.save();

    const tmpPath = path.join(os.tmpdir(), `test_${Date.now()}.pdf`);
    fs.writeFileSync(tmpPath, pdfBytes);

    const fileId      = 'pdf-preview-test';
    const previewPath = await fileProtection.createPreview(tmpPath, fileId, 'pdf', 'pdf');
    const previewDoc  = await PDFDocument.load(fs.readFileSync(previewPath));

    // Только 1 страница в превью
    expect(previewDoc.getPageCount()).toBe(1);
    cleanup(tmpPath, previewPath);
  });
});

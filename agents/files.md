# Агент 5 — Файловый Инженер

## Зона ответственности
- backend/services/fileProtection.js
- Защита всех типов файлов при сдаче работы

## Форматы
- Фото: watermark + resize 400px (sharp)
- Видео: 360p + watermark (ffmpeg)
- PDF: только страница 1 (pdf-lib)
- Excel/CSV: заголовки видны, данные = *** (xlsx)
- Код: первые 35% строк
- Аудио: первые 30 секунд (ffmpeg)
- Архивы: только список файлов

## Хранение
- storage/encrypted/ — AES-256-CBC оригинал
- storage/previews/ — превью для клиента
- storage/released/ — оригинал после release (24ч ссылка)

## Реализованные функции

### processFile(tempFilePath, originalName)
Главная функция. Вызывается при POST /api/deliveries.
1. Определяет тип файла по расширению (FILE_TYPE_MAP)
2. Генерирует UUID (fileId)
3. Шифрует оригинал → storage/encrypted/{fileId}.enc
4. Создаёт превью → storage/previews/{fileId}_preview.*
5. Удаляет временный файл

### Типы превью
- image: sharp resize 400px + SVG watermark "SafeDeal Preview"
- video: ffmpeg 360p + 30 сек + drawtext watermark
- pdf: pdf-lib — только страница 1 + watermark text
- spreadsheet: xlsx — заголовки + *** вместо данных
- code: первые 35% строк + комментарий-заглушка
- audio: ffmpeg первые 30 секунд
- archive: execSync('unzip -l') — только список файлов
- unknown: текстовая заглушка с именем и размером

### encryptFile(inputPath, fileId, ext)
AES-256-CBC. Ключ из .env ENCRYPTION_KEY (64 hex символа = 256 бит).
Формат зашифрованного файла: первые 16 байт = IV, затем зашифрованные данные.
Сохраняет metadata в {fileId}.meta (расширение для расшифровки).

### decryptFile(fileId)
Читает IV из первых 16 байт, расшифровывает в storage/released/{fileId}.{ext}.
Вызывается при GET /api/deliveries/download/:fileId (только после release).

### releaseFiles(files)
Расшифровывает все файлы доставки. Планирует удаление через 24 часа (setTimeout).
Вызывается ТОЛЬКО из deliveries.js → POST /:id/approve.

### cleanupFiles(fileIds)
Удаляет .enc и .meta файлы + все превью (при отмене сделки).

## DIRS
- STORAGE_BASE = process.env.STORAGE_PATH || ../../storage
- encrypted: {STORAGE_BASE}/encrypted/
- previews:  {STORAGE_BASE}/previews/
- released:  {STORAGE_BASE}/released/

## Статус: ЗАВЕРШЁН ✅

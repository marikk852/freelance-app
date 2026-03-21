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

## Статус: ОЖИДАЕТ 🕐

# Агент 2 — Блокчейн Инженер

## Зона ответственности
- TON смарт-контракт на FunC (contracts/escrow.fc)
- TypeScript обёртки (contracts/wrappers/)
- Тесты контракта (contracts/escrow.spec.ts)
- Скрипт деплоя (contracts/scripts/deploy.ts)

## Инструменты
@ton/blueprint, @ton/sandbox, @ton/ton, @ton/core, @ton/crypto

## Функции контракта
- init: инициализация с параметрами сделки
- deposit: приём TON/jUSDT от клиента
- release: выплата фрилансеру (ТОЛЬКО арбитр)
- refund: возврат клиенту (ТОЛЬКО арбитр)
- split: разделение при споре (ТОЛЬКО арбитр)
- get_state: чтение статуса

## Статус: В РАБОТЕ 🔄

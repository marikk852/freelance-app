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

## Реализованные файлы
- contracts/escrow.fc — 234 строки FunC
- contracts/escrow.spec.ts — 325 строк тестов (@ton/sandbox)
- contracts/wrappers/ — TypeScript обёртки
- contracts/scripts/deploy.ts — скрипт деплоя
- contracts/build/escrow.compiled.json — СКОМПИЛИРОВАН

## Op-коды (должны совпадать с escrowService.js)
- OP.DEPOSIT = 1
- OP.RELEASE = 2
- OP.REFUND  = 3
- OP.SPLIT   = 4

## Состояния контракта
- 0 = WAITING (депозит не получен)
- 1 = FROZEN (деньги заморожены)
- 2 = RELEASED (выплачено фрилансеру)
- 3 = REFUNDED (возврат клиенту)

## Компиляция
```
cd contracts && npm run build
```
Результат: contracts/build/escrow.compiled.json

## Статус: ЗАВЕРШЁН ✅

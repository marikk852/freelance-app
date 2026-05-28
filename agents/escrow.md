# Агент 4 — Эскроу Сервис

## Зона ответственности
- backend/services/escrowService.js
- backend/services/tonService.js
- Взаимодействие с TON контрактом из backend

## Функции
- deployContract(dealData) → contractAddress
- monitorContract(contractAddress) → статус
- releaseEscrow(contractAddress) → txHash
- refundEscrow(contractAddress) → txHash
- splitEscrow(contractAddress, freelancerPercent) → txHash

## Реализованные функции

### deployContract({ contractId, clientAddress, freelancerAddress, amountUsd, currency, deadlineDate })
- Проверяет лимит $500 (MAX_DEAL_AMOUNT_USD)
- Конвертирует USD → крипта (TON по курсу, USDT 1:1)
- Строит initData ячейку через buildInitData()
- Деплоит StateInit транзакцию через tonService.sendArbitratorMessage()
- Обновляет contracts + создаёт запись в escrow
- SIMULATE_PAYMENTS=true — пропускает реальный блокчейн

### monitorContract(contractId)
- Читает get_status из смарт-контракта
- При статусе 1 (FROZEN): обновляет escrow.status='frozen', contracts.status='in_progress'
- Получает tx_hash последней транзакции
- Вызывается каждые 30 секунд через monitorService.js

### releaseEscrow(contractId, approvedBy)
- СНАЧАЛА проверяет deliveries.status='approved' — иначе ОТКАЗ
- Отправляет OP.RELEASE (op-код 2) арбитром
- Обновляет escrow.status='released', contracts.status='completed'
- Логирует в audit_log

### refundEscrow(contractId, requestedBy)
- Отправляет OP.REFUND (op-код 3) арбитром
- Обновляет escrow.status='refunded', contracts.status='refunded'

### splitEscrow(contractId, freelancerPercent, resolvedBy)
- freelancerPercent: 0–100
- Отправляет OP.SPLIT с процентом в теле
- Используется при разрешении спора

## Правило
Деньги освобождаются ТОЛЬКО при delivery_approved (двойная проверка в releaseEscrow)

## Газ для транзакций арбитра
ARBITRATOR_GAS = 0.05 TON

## Статус: ЗАВЕРШЁН ✅

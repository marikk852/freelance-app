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

## Правило
Деньги освобождаются ТОЛЬКО при delivery_approved

## Статус: ОЖИДАЕТ 🕐

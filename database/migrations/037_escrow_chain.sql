-- 037: сеть эскроу (TON | ETH | TRON) для мультичейн-USDT.
-- Аддитивно и обратно совместимо: существующие сделки остаются на TON.
-- ETH/TRON обслуживает evmEscrowService (Solidity SafeDealEscrow), TON — escrowService.

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS chain VARCHAR(8) NOT NULL DEFAULT 'TON';
ALTER TABLE escrow    ADD COLUMN IF NOT EXISTS chain VARCHAR(8) NOT NULL DEFAULT 'TON';

-- Быстрый выбор активных эскроу по сети для мониторинга
CREATE INDEX IF NOT EXISTS idx_escrow_chain_status ON escrow (chain, status);

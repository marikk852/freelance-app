-- 038: адреса кошельков пользователя в EVM-сетях (Ethereum) и Tron.
-- Нужны для мультичейн-USDT эскроу: деплой SafeDealEscrow.sol требует адреса
-- клиента и фрилансера В ТОЙ ЖЕ сети, где стоит контракт. TON-адрес
-- (ton_wallet_address) остаётся основным и не трогается.
--
-- Форматы: ETH — 0x + 40 hex (42 симв.), Tron — base58 'T...' (34 симв.).

ALTER TABLE users ADD COLUMN IF NOT EXISTS eth_wallet_address  VARCHAR(42);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tron_wallet_address VARCHAR(64);

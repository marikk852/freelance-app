# Testnet-прогон USD₮-эскроу — runbook

Цель: проверить весь путь нативного USD₮-эскроу на **живой TON testnet** перед mainnet.
Контракт уже протестирован в sandbox (33/33, вкл. e2e с реальным TEP-74 jetton) — здесь подтверждаем то же на реальной сети: газ, тайминги, форматы сообщений.

На testnet нет настоящего Tether USD₮, поэтому разворачиваем **эталонный TEP-74 jetton** как стенд-ин (`wrappers/ReferenceJetton.ts` — тот же канонический jetton, что в e2e).

> ⚠️ Это testnet. Реальных денег нет. Но это финальная репетиция перед mainnet — относимся серьёзно.

---

## 0. Предусловия

1. **Testnet-кошелёк с тестовым TON.** Нужно ~3–5 testnet TON.
   Faucet: Telegram-бот `@testgiver_ton_bot` (даёт ~2 TON на адрес).
2. **Testnet toncenter API-ключ.** Бот `@tonapibot` → ключ для `testnet.toncenter.com`.
3. **Адрес фрилансера** — любой второй testnet-адрес (можно второй кошелёк / адрес друга).

Env (можно в `contracts/.env` или экспортом в шелле):
```bash
export TON_API_KEY=<testnet toncenter key>
export TON_ENDPOINT=https://testnet.toncenter.com/api/v2/
```
`blueprint.config.ts` уже настроен на testnet (`type: 'testnet'`).

### Подключение кошелька
`npx blueprint run … --testnet` спросит, как подписывать транзакции:
- **TON Connect** — покажет QR/ссылку, подтверждаешь в мобильном кошельке (Tonkeeper testnet), **или**
- **Mnemonic** — задай в env `WALLET_MNEMONIC="word1 word2 …"` (и при необходимости `WALLET_VERSION=v4`).

Подключённый кошелёк играет роли **client + arbitrator + админ jetton** (контролируем mint и release).

---

## 1. Шаг 1 — развернуть тестовый USD₮ и намайнить себе

```bash
cd contracts
npm run testnet:usdt-setup       # = blueprint run testnetUsdtSetup --testnet
```
Скрипт: задеплоит minter, намайнит указанную сумму тестовых USD₮ на твой адрес,
дождётся появления баланса и **выведет адрес мастера**.

✅ Запиши `TESTNET_USDT_MASTER=<адрес>` — он нужен на шаге 2 и для backend.

Проверка: открой адрес своего jetton-wallet в explorer (testnet.tonviewer.com) — баланс USD₮ виден.

---

## 2. Шаг 2 — полный цикл эскроу

```bash
cd contracts
TESTNET_USDT_MASTER=<адрес из шага 1> npm run testnet:usdt-cycle
```
Скрипт пройдёт ровно то, что делает backend (теми же сообщениями):

| Этап | Что происходит | Что проверяем |
|------|----------------|---------------|
| Deploy+Set | эскроу деплоится + `OP_SET_JETTON_WALLET` одним сообщением | статус `WAITING`, `jetton_wallet` == вычисленному |
| Депозит | jetton transfer от клиента на эскроу (`forward 0.15 TON`) | эскроу ловит `transfer_notification` → `FROZEN`, сумма зафиксирована |
| Развязка | `release` / `refund` / `split` (вводишь интерактивно) | терминальный статус + балансы jetton |

Скрипт в конце печатает разницу балансов:
- **release** → фрилансер +98%, арбитр (ты) +2%, эскроу ~0
- **refund** → клиент (ты) +100%, эскроу ~0
- **split N%** → фрилансер N% от 98%, клиент остаток, арбитр 2%

Прогони цикл **трижды** — по разу на release, refund, split (минтить можно повторно шагом 1).

---

## 3. (Опционально, но рекомендую) Прогон реального backend на testnet

Скрипты выше используют те же форматы сообщений, что backend, но это всё-таки отдельный код.
Чтобы проверить именно production-путь `escrowService` → контракт:

1. В корневом `.env`:
   ```bash
   USDT_MASTER_ADDRESS=<TESTNET_USDT_MASTER из шага 1>
   ARBITRATOR_WALLET_SEED="<mnemonic фондированного testnet-кошелька арбитра>"
   TON_ENDPOINT=https://testnet.toncenter.com/api/v2/jsonRPC
   TON_API_KEY=<testnet key>
   SIMULATE_PAYMENTS=false
   ```
2. Подними backend + БД, создай USD₮-сделку, подпиши, задеплой через UI/API.
3. Клиент платит через Payment-страницу (jetton transfer), фронт берёт payload из
   `GET /api/contracts/:id/usdt-payment`.
4. Проверь: монитор переводит сделку в `in_progress` (FROZEN), `approve` → release →
   jetton приходят фрилансеру.

> Арбитр-кошелёк должен иметь запас testnet TON: деплой+set ~0.1, release ~0.3, refund ~0.2, split ~0.4 TON за сделку.

---

## 4. Чек-лист готовности к mainnet

- [ ] Шаг 2 прошёл для release, refund и split — балансы сходятся до цента
- [ ] `transfer_notification` от чужого адреса НЕ замораживает (можно проверить вручную переводом левого jetton)
- [ ] Газа арбитра хватает на все операции (нет `ERR_LOW_GAS`)
- [ ] Backend-путь (раздел 3) отработал end-to-end
- [ ] Адрес mainnet-мастера USD₮ в `.env`: `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`
- [ ] Финальный security re-review всей цепочки

## Explorer
- testnet.tonviewer.com / testnet.tonscan.org — статусы контрактов и jetton-балансы

# Агент 7 — Mini App

## Зона ответственности
- miniapp/src/ — полный React фронтенд
- Все 9 экранов согласно дизайн-системе
- Пиксельные сцены через Canvas API

## Реализованные экраны (15 страниц)
/              → Home.tsx        — активные сделки, статистика, кнопки действий
/new-deal      → NewDeal.tsx     — создание контракта (5 шагов)
/join/:link    → JoinDeal.tsx    — принятие invite-ссылки фрилансером
/deal/:id      → DealRoom.tsx    — комната сделки, квест лог, кнопки
/payment/:id   → Payment.tsx     — выбор валюты, адрес контракта, разбивка суммы
/review/:id    → Review.tsx      — чек-лист критериев, превью файлов
/dispute/:id   → Dispute.tsx     — причина, доказательства
/live          → LiveDeals.tsx   — лента сделок в реальном времени
/profile       → Profile.tsx     — профиль, кошелёк, портфолио, статистика
/profile/:id   → PublicProfile.tsx — публичный профиль другого пользователя
/jobs          → JobBoard.tsx    — биржа заказов
/my-deals      → MyDeals.tsx     — все мои сделки (клиент + фрилансер)
/freelancers   → FreelancerList.tsx — список фрилансеров
/notifications → Notifications.tsx — уведомления
/quests        → Quests.tsx      — квесты и SafeCoins

## Компоненты (miniapp/src/components/)
BottomNav.tsx       — нижняя навигация
GlassCard.tsx       — стеклянная карточка (Liquid Glass стиль)
PixelScene.tsx      — Canvas API пиксельные сцены
FloatingParticles.tsx — фоновые частицы
NotificationPopup.tsx — всплывающие уведомления
CoinBurst.tsx       — анимация SafeCoins
FlameIcon.tsx       — иконка стрика
HomeNavIcons.tsx    — иконки главного меню
PixelNavIcons.tsx   — пиксельные иконки навигации

## Hooks (miniapp/src/hooks/)
useTelegram.ts   — Telegram.WebApp SDK
useTonWallet.ts  — TonConnect (@tonconnect/ui-react)
useCountUp.ts    — анимация счётчиков

## Invite-link обработка
InviteHandler компонент в App.tsx:
- Читает ?room=UUID из URL
- Читает start_param из Telegram.WebApp.initDataUnsafe
- navigate('/join/{link}')

## Maintenance mode
App.tsx при старте проверяет /admark/status.
Если maintenance=true — показывает MaintenanceScreen.

## Дизайн
- Pixel Art + Liquid Glass, фон #000000
- Шрифт: Press Start 2P
- Цвета: #00FF88 #FFAA00 #0088FF #CC44FF #FF4466 #FF8800
- Glass карточки: rgba(255,255,255,0.045) / border rgba(255,255,255,0.13)

## Статус: ЗАВЕРШЁН ✅

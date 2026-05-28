# SafeDeal Mini App — Карта страниц

React 18 + TonConnect + react-router-dom. Стиль: Pixel Art + Liquid Glass.

## Роутинг (miniapp/src/App.tsx)

| Путь | Компонент | Описание |
|------|-----------|----------|
| / | Home | Главная страница |
| /new-deal | NewDeal | Создание контракта |
| /join/:link | JoinDeal | Принятие invite-ссылки |
| /deal/:id | DealRoom | Комната сделки |
| /payment/:id | Payment | Страница оплаты |
| /review/:id | Review | Проверка работы клиентом |
| /dispute/:id | Dispute | Открытие спора |
| /live | LiveDeals | Лента сделок |
| /profile | Profile | Мой профиль |
| /profile/:telegramId | PublicProfile | Публичный профиль |
| /jobs | JobBoard | Биржа заказов |
| /my-deals | MyDeals | Мои сделки |
| /freelancers | FreelancerList | Список фрилансеров |
| /notifications | Notifications | Уведомления |
| /quests | Quests | Квесты и SafeCoins |

---

## Страницы — детали

### Home (`/`)
API: GET /api/users/me, GET /api/users/me/deals
- Активные сделки текущего пользователя
- Статистика: level, XP, SafeCoins, streak
- Кнопки: Новая сделка, Мои сделки, Биржа заказов
- PixelScene: дом + свиток квестов

### NewDeal (`/new-deal`)
API: POST /api/contracts
- 5 шагов с прогресс-баром
- Шаг 1: Название и описание
- Шаг 2: Сумма (max $500) и валюта (TON/USDT)
- Шаг 3: Дедлайн
- Шаг 4: Критерии приёмки (min 3)
- Шаг 5: Подтверждение
- После создания: invite-ссылка для фрилансера
- PixelScene: перо пишет контракт

### JoinDeal (`/join/:link`)
API: GET /api/rooms/join/:link, POST /api/contracts/:id/sign
- Публичная страница (без авторизации можно просмотреть)
- Показывает детали контракта (клиент, сумма, дедлайн, критерии)
- Кнопка "Принять сделку" → POST /sign с role=freelancer
- После принятия: redirect на /deal/:id

### DealRoom (`/deal/:id`)
API: GET /api/contracts/:id, POST /api/contracts/:id/deploy
- Основная комната сделки
- Квест лог: история событий
- Адрес TON контракта (после деплоя)
- Кнопки в зависимости от роли и статуса:
  - Клиент: Деплой контракта (с вводом кошельков)
  - Фрилансер: Сдать работу → /review/:id
  - Клиент: Проверить работу → /review/:id
  - Открыть спор → /dispute/:id
- PixelScene: два персонажа + сейф между ними

### Payment (`/payment/:id`)
API: POST /api/contracts/:id/simulate-payment (dev), GET /api/contracts/:id
- Выбор валюты TON/USDT
- Адрес смарт-контракта для отправки
- Разбивка суммы (сумма + 2% комиссия)
- Инструкция: открыть Tonkeeper / @wallet
- QR-код адреса контракта
- PixelScene: монеты летят в сейф

### Review (`/review/:id`)
API: GET /api/deliveries/by-contract/:id, GET /api/deliveries/preview/:fileId,
     POST /api/deliveries/:id/approve, POST /api/deliveries/:id/reject,
     POST /api/deliveries (если фрилансер)
- Если фрилансер: форма загрузки файлов + ссылок + описание
- Если клиент:
  - Превью файлов (защищённые)
  - Чек-лист критериев из контракта
  - 3 кнопки: Принять / Запросить правки / Открыть спор
- PixelScene: лупа над чеклистом + большая галочка

### Dispute (`/dispute/:id`)
API: POST /api/disputes
- Поле: причина спора
- Поле: доказательства (JSON)
- После отправки: уведомление обоим участникам и арбитру
- PixelScene: весы правосудия + молоток

### LiveDeals (`/live`)
API: GET /api/livefeed
- Реальные события платформы (последние 20 контрактов)
- Статистика: completed, volume, active, disputes
- Карточки событий с типами: new / frozen / completed / disputed
- Автообновление каждые 30 секунд
- PixelScene: антенна с волнами + карточки летят вверх

### Profile (`/profile`)
API: GET /api/users/me, PATCH /api/users/me/profile, PATCH /api/users/me/wallet,
     POST /api/users/me/banner, POST /api/users/me/avatar, POST /api/users/me/slides,
     GET /api/users/:telegramId/portfolio, GET /api/users/:telegramId/reviews
- Аватар, баннер, слайды (max 5)
- Редактирование bio, skills, role, category, experience
- Привязка TON кошелька (TonConnect)
- Статистика: level, XP, SafeCoins, streak, rating
- Портфолио фрилансера
- Отзывы
- PixelScene: пиксельный персонаж + трофеи + звёзды

### PublicProfile (`/profile/:telegramId`)
API: GET /api/users/:telegramId, GET /api/users/:telegramId/portfolio, GET /api/users/:telegramId/reviews
- Публичный профиль другого пользователя
- Кнопка "Создать сделку с ним"

### JobBoard (`/jobs`)
API: GET /api/jobs, POST /api/jobs, POST /api/jobs/:id/apply, GET /api/jobs/my,
     GET /api/jobs/:id/applications
- Лента вакансий с фильтрами (category, currency, search)
- Карточки вакансий с бюджетом и количеством откликов
- Кнопка "Откликнуться"
- Форма создания вакансии (для клиентов)
- Вкладка "Мои вакансии" с откликами
- PixelScene: доска объявлений + лупа + карточки

### MyDeals (`/my-deals`)
API: GET /api/users/me/deals
- Вкладки: Клиент / Фрилансер
- Список всех сделок с статусом и суммой
- Переход в /deal/:id при клике

### FreelancerList (`/freelancers`)
API: GET /api/users/freelancers
- Список фрилансеров с заполненным профилем
- Фильтр по категории
- Карточка: аватар, имя, категория, рейтинг, skills
- Переход в /profile/:telegramId

### Notifications (`/notifications`)
API: GET /api/notifications, PATCH /api/notifications/read-all,
     PATCH /api/notifications/:id/read, GET /api/notifications/unread-count
- Список уведомлений с временными метками
- Отметить все как прочитанные
- Иконка колокола с бейджем (unread-count)

### Quests (`/quests`)
API: GET /api/quests, POST /api/quests/:key/claim
- Карточки квестов с прогрессом
- Кнопка "Получить" для выполненных квестов
- Анимация монет (CoinBurst) при получении награды
- Квесты:
  - link_wallet — привязать кошелёк
  - complete_profile — заполнить профиль
  - first_deal — создать первую сделку
  - first_completed — завершить первую сделку
  - five_deals — завершить 5 сделок
  - first_review — получить первый отзыв
  - streak_7 — 7 дней подряд
  - streak_30 — 30 дней подряд
  - first_referral — первый реферал
  - five_referrals — 5 рефералов
  - post_job — создать вакансию
  - first_portfolio — добавить в портфолио

---

## Глобальные компоненты

### BottomNav
Нижняя навигация (всегда видна):
- Дом → /
- Лента → /live
- + Новая сделка → /new-deal
- Биржа → /jobs
- Профиль → /profile

### NotificationPopup
Всплывающие push-уведомления (опрашивает /api/notifications/unread-count).

### FloatingParticles
Фоновые анимированные частицы на всех экранах.

### GlassCard
Стеклянная карточка (Liquid Glass стиль):
- background: rgba(255,255,255,0.045)
- border: 1px solid rgba(255,255,255,0.13)
- border-radius: 20px / 14px / 100px

### PixelScene (Canvas API)
Уникальная пиксельная сцена для каждого экрана.

---

## Hooks

### useTelegram
- Инициализация Telegram.WebApp
- Получение пользователя (firstName, username, id)
- Управление BackButton / MainButton

### useTonWallet
- TonConnect (@tonconnect/ui-react)
- Подключение/отключение кошелька
- Получение адреса

### useCountUp
- Анимация числовых счётчиков (XP, SafeCoins, рейтинг)

---

## Invite-link флоу

1. Клиент создаёт контракт → получает inviteUrl вида `https://t.me/bot?start=room_UUID`
2. Отправляет ссылку фрилансеру в Telegram
3. Фрилансер нажимает → открывается Mini App с параметром start_param=UUID
4. InviteHandler в App.tsx перехватывает start_param → navigate('/join/UUID')
5. JoinDeal показывает детали контракта → фрилансер нажимает "Принять"
6. POST /api/contracts/:id/sign с role=freelancer
7. Redirect на /deal/:id

---

## Стек
- React 18
- TypeScript
- react-router-dom v6
- @tonconnect/ui-react
- react-hot-toast
- Vite (сборщик)
- Canvas API (пиксельные сцены)
- Press Start 2P (Google Fonts)

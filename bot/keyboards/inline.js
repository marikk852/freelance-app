// ============================================================
// Inline клавиатуры для Telegram бота SafeDeal
// ============================================================

/**
 * Главное меню после /start
 */
const mainMenu = () => ({
  inline_keyboard: [
    [{ text: '⚔️ Новая сделка',    callback_data: 'new_deal' },
     { text: '📋 Мои сделки',      callback_data: 'my_deals' }],
    [{ text: '📌 Биржа заказов',   callback_data: 'job_board' },
     { text: '👤 Профиль',         callback_data: 'profile' }],
    [{ text: '🌐 Открыть Mini App', web_app: { url: process.env.WEBAPP_URL } }],
  ],
});

/**
 * Меню комнаты сделки (клиент)
 */
const dealRoomClient = (contractId) => ({
  inline_keyboard: [
    [{ text: '🔍 Проверить работу', callback_data: `review_${contractId}` }],
    [{ text: '⚖️ Открыть спор',    callback_data: `dispute_${contractId}` },
     { text: '❌ Отмена',          callback_data: `cancel_${contractId}` }],
    [{ text: '📊 Детали сделки',   callback_data: `details_${contractId}` }],
  ],
});

/**
 * Меню комнаты сделки (фрилансер)
 */
const dealRoomFreelancer = (contractId) => ({
  inline_keyboard: [
    [{ text: '📤 Сдать работу',     callback_data: `submit_${contractId}` }],
    [{ text: '⚖️ Открыть спор',    callback_data: `dispute_${contractId}` }],
    [{ text: '📊 Детали сделки',   callback_data: `details_${contractId}` }],
  ],
});

/**
 * Меню проверки работы клиентом
 */
const reviewMenu = (deliveryId) => ({
  inline_keyboard: [
    [{ text: '✅ Принять работу',   callback_data: `approve_${deliveryId}` }],
    [{ text: '🔄 Нужны правки',    callback_data: `reject_${deliveryId}` }],
    [{ text: '⚖️ Открыть спор',   callback_data: `dispute_del_${deliveryId}` }],
  ],
});

/**
 * Выбор валюты при оплате
 */
const currencyMenu = (contractId) => ({
  inline_keyboard: [
    [{ text: '💎 TON',   callback_data: `pay_ton_${contractId}` },
     { text: '💵 USDT',  callback_data: `pay_usdt_${contractId}` }],
    [{ text: '◀️ Назад', callback_data: `back_${contractId}` }],
  ],
});

/**
 * Подтверждение действия
 */
const confirmMenu = (action, id) => ({
  inline_keyboard: [
    [{ text: '✅ Да, подтверждаю', callback_data: `confirm_${action}_${id}` },
     { text: '❌ Отмена',          callback_data: 'cancel_action' }],
  ],
});

/**
 * Кнопка "Открыть Mini App" для конкретного экрана
 */
const openMiniApp = (screen, contractId) => ({
  inline_keyboard: [[{
    text   : '🚀 Открыть в приложении',
    web_app: { url: `${process.env.WEBAPP_URL}?screen=${screen}&id=${contractId}` },
  }]],
});

/**
 * Кнопка принятия контракта фрилансером
 */
const acceptContractMenu = (roomId) => ({
  inline_keyboard: [
    [{ text: '✍️ Принять контракт', callback_data: `accept_contract_${roomId}` }],
    [{ text: '❌ Отклонить',        callback_data: `decline_contract_${roomId}` }],
  ],
});

module.exports = {
  mainMenu,
  dealRoomClient,
  dealRoomFreelancer,
  reviewMenu,
  currencyMenu,
  confirmMenu,
  openMiniApp,
  acceptContractMenu,
};

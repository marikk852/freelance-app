// ============================================================
// Inline keyboards for SafeDeal Telegram bot
// ============================================================

/**
 * Main menu after /start
 */
const mainMenu = () => ({
  inline_keyboard: [
    [{ text: '⚔️ New deal',     callback_data: 'new_deal' },
     { text: '📋 My deals',     callback_data: 'my_deals' }],
    [{ text: '📌 Job board',    callback_data: 'job_board' },
     { text: '👤 Profile',      callback_data: 'profile' }],
    [{ text: '🌐 Open Mini App', web_app: { url: process.env.WEBAPP_URL } }],
  ],
});

/**
 * Deal room menu (client)
 */
const dealRoomClient = (contractId) => ({
  inline_keyboard: [
    [{ text: '🔍 Review work',    callback_data: `review_${contractId}` }],
    [{ text: '⚖️ Open dispute',   callback_data: `dispute_${contractId}` },
     { text: '❌ Cancel',         callback_data: `cancel_${contractId}` }],
    [{ text: '📊 Deal details',   callback_data: `details_${contractId}` }],
  ],
});

/**
 * Deal room menu (freelancer)
 */
const dealRoomFreelancer = (contractId) => ({
  inline_keyboard: [
    [{ text: '📤 Submit work',    callback_data: `submit_${contractId}` }],
    [{ text: '⚖️ Open dispute',   callback_data: `dispute_${contractId}` }],
    [{ text: '📊 Deal details',   callback_data: `details_${contractId}` }],
  ],
});

/**
 * Client work review menu
 */
const reviewMenu = (deliveryId) => ({
  inline_keyboard: [
    [{ text: '✅ Accept work',      callback_data: `approve_${deliveryId}` }],
    [{ text: '🔄 Needs revision',  callback_data: `reject_${deliveryId}` }],
    [{ text: '⚖️ Open dispute',    callback_data: `dispute_del_${deliveryId}` }],
  ],
});

/**
 * Currency selection for payment
 */
const currencyMenu = (contractId) => ({
  inline_keyboard: [
    [{ text: '💎 TON',   callback_data: `pay_ton_${contractId}` },
     { text: '💵 USDT',  callback_data: `pay_usdt_${contractId}` }],
    [{ text: '◀️ Back',  callback_data: `back_${contractId}` }],
  ],
});

/**
 * Action confirmation
 */
const confirmMenu = (action, id) => ({
  inline_keyboard: [
    [{ text: '✅ Yes, confirm', callback_data: `confirm_${action}_${id}` },
     { text: '❌ Cancel',       callback_data: 'cancel_action' }],
  ],
});

/**
 * "Open Mini App" button for a specific screen
 */
const openMiniApp = (screen, contractId) => ({
  inline_keyboard: [[{
    text   : '🚀 Open in app',
    web_app: { url: `${process.env.WEBAPP_URL}?screen=${screen}&id=${contractId}` },
  }]],
});

/**
 * Freelancer contract acceptance button
 */
const acceptContractMenu = (roomId) => ({
  inline_keyboard: [
    [{ text: '✍️ Accept contract', callback_data: `accept_contract_${roomId}` }],
    [{ text: '❌ Decline',         callback_data: `decline_contract_${roomId}` }],
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

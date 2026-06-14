const express = require('express');
const router  = express.Router();
const { query } = require('../../database/db');
const { authMiddleware } = require('../middleware/auth');
const crystalService = require('../services/crystalService');
const tonService = require('../services/tonService');

router.use(authMiddleware);

async function _userId(telegramId) {
  const { rows } = await query(`SELECT id FROM users WHERE telegram_id = $1`, [telegramId]);
  return rows[0] ? rows[0].id : null;
}

// GET /api/crystals — баланс + последние операции
router.get('/', async (req, res) => {
  try {
    const userId = await _userId(req.user.telegramId);
    if (!userId) return res.status(404).json({ error: 'User not found' });
    res.json(await crystalService.getBalanceAndHistory(userId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/crystals/shop — активные товары магазина (soft-only)
router.get('/shop', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT key, label, cost, category FROM crystal_shop_items
       WHERE is_active = TRUE ORDER BY sort_order`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/crystals/spend/:key — потратить кристаллы на товар
router.post('/spend/:key', async (req, res) => {
  try {
    const userId = await _userId(req.user.telegramId);
    if (!userId) return res.status(404).json({ error: 'User not found' });
    const result = await crystalService.spend(userId, req.params.key);
    res.json({ success: true, ...result });
  } catch (e) {
    const code = e.message === 'Insufficient crystals' ? 402
               : e.message === 'Item not available'    ? 404 : 500;
    res.status(code).json({ error: e.message });
  }
});

// ---------- Прямая покупка пакетов кристаллов за TON ----------

// GET /api/crystals/packages — активные пакеты
router.get('/packages', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, crystals, bonus_crystals, price_usd FROM crystal_packages
       WHERE is_active = TRUE ORDER BY sort_order`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/crystals/packages/:id/purchase — реквизиты платежа (ничего не создаёт)
router.post('/packages/:id/purchase', async (req, res) => {
  try {
    const userId = await _userId(req.user.telegramId);
    if (!userId) return res.status(404).json({ error: 'User not found' });
    const { rows } = await query(
      `SELECT * FROM crystal_packages WHERE id = $1 AND is_active = TRUE`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Package not available' });
    const pkg = rows[0];
    const tonPrice = await tonService.getTonUsdPrice();
    res.json({
      package: { id: pkg.id, crystals: pkg.crystals, bonus_crystals: pkg.bonus_crystals, price_usd: pkg.price_usd },
      payment: {
        to: tonService.getArbitratorAddress(),
        amount: (pkg.price_usd / tonPrice).toFixed(9),
        currency: 'TON',
        memo: `crystals_${pkg.id}_${userId}`,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/crystals/packages/confirm — верификация on-chain + начисление
router.post('/packages/confirm', async (req, res) => {
  try {
    const { package_id, tx_hash } = req.body;
    if (!tx_hash) return res.status(400).json({ error: 'tx_hash required' });
    const userId = await _userId(req.user.telegramId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const { rows } = await query(`SELECT * FROM crystal_packages WHERE id = $1`, [package_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Package not found' });
    const pkg = rows[0];

    // Дубликат tx
    const { rows: dup } = await query(
      `SELECT 1 FROM crystal_ledger WHERE kind = 'purchase' AND meta->>'tx_hash' = $1 LIMIT 1`,
      [tx_hash]
    );
    if (dup[0]) return res.status(409).json({ error: 'Transaction already used' });

    // Верификация платежа в сети
    const tonPrice     = await tonService.getTonUsdPrice();
    const expectedTon  = pkg.price_usd / tonPrice;
    const verification = await tonService.verifyTonPayment(tx_hash, expectedTon);
    if (!verification.valid) {
      return res.status(402).json({ error: 'Payment not found on blockchain. Try again in a few seconds.' });
    }

    const total = pkg.crystals + pkg.bonus_crystals;
    await crystalService.grant(userId, total, {
      kind: 'purchase', action_key: 'package',
      meta: { tx_hash, package_id: pkg.id },
    });
    res.json({ success: true, crystals_awarded: total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

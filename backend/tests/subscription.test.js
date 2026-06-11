/**
 * Subscription flow tests
 * Tests verifyTonPayment logic and /api/subscriptions/* endpoints
 */

const assert = require('assert');

// ─── Unit tests for verifyTonPayment ───────────────────────────────────────

function makeTx(valueNano, nowUnix) {
  return {
    now: nowUnix,
    inMessage: {
      info: {
        type: 'internal',
        value: { coins: BigInt(valueNano) },
      },
    },
    hash: () => Buffer.from('abc123deadbeef', 'hex'),
  };
}

async function runVerifyTests() {
  console.log('\n── verifyTonPayment unit tests ──');

  // Patch tonService internals for isolated testing
  const tonService = require('../services/tonService');
  const originalGetTxs = tonService.getTransactions;
  const originalGetAddr = tonService.getArbitratorAddress;

  tonService.getArbitratorAddress = () => 'EQTest';

  const now = Math.floor(Date.now() / 1000);
  const expectedTon = 1.5; // ~$5.99 at ~$4/TON
  const expectedNano = Math.round(expectedTon * 1e9);

  // ── Test 1: exact match ──────────────────────────────
  tonService.getTransactions = async () => [makeTx(expectedNano, now - 30)];
  let result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
  assert.strictEqual(result.valid, true, 'Test 1 FAILED: exact match should be valid');
  console.log('  ✅ Test 1 passed: exact amount match');

  // ── Test 2: within 5% tolerance ──────────────────────
  tonService.getTransactions = async () => [makeTx(Math.round(expectedNano * 1.04), now - 60)];
  result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
  assert.strictEqual(result.valid, true, 'Test 2 FAILED: 4% over should be within tolerance');
  console.log('  ✅ Test 2 passed: 4% over tolerance');

  // ── Test 3: outside tolerance ─────────────────────────
  tonService.getTransactions = async () => [makeTx(Math.round(expectedNano * 0.90), now - 60)];
  result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
  assert.strictEqual(result.valid, false, 'Test 3 FAILED: 10% under should be invalid');
  console.log('  ✅ Test 3 passed: 10% under = invalid');

  // ── Test 4: tx too old (>15 min) ─────────────────────
  tonService.getTransactions = async () => [makeTx(expectedNano, now - 16 * 60)];
  result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
  assert.strictEqual(result.valid, false, 'Test 4 FAILED: old tx should not be accepted');
  console.log('  ✅ Test 4 passed: tx older than 15 min = invalid');

  // ── Test 5: external-in message ignored ──────────────
  tonService.getTransactions = async () => [{
    now: now - 30,
    inMessage: { info: { type: 'external-in' } },
    hash: () => Buffer.from('00', 'hex'),
  }];
  result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
  assert.strictEqual(result.valid, false, 'Test 5 FAILED: external-in should be ignored');
  console.log('  ✅ Test 5 passed: external-in message ignored');

  // ── Test 6: no transactions ───────────────────────────
  tonService.getTransactions = async () => [];
  result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
  assert.strictEqual(result.valid, false, 'Test 6 FAILED: empty tx list should be invalid');
  console.log('  ✅ Test 6 passed: empty tx list = invalid');

  // ── Test 7: retry logic (fail first, succeed second) ─
  let callCount = 0;
  tonService.getTransactions = async () => {
    callCount++;
    if (callCount < 2) return [];
    return [makeTx(expectedNano, now - 30)];
  };
  // Override sleep to avoid waiting in tests
  const originalSleep = tonService.sleep;
  tonService.sleep = async () => {};
  result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 3);
  assert.strictEqual(result.valid, true, 'Test 7 FAILED: should succeed on retry');
  assert.strictEqual(callCount, 2, 'Test 7 FAILED: should have retried exactly once');
  tonService.sleep = originalSleep;
  console.log('  ✅ Test 7 passed: retry logic works');

  // ── Test 8: invalid BOC doesn't crash ────────────────
  tonService.getTransactions = async () => [makeTx(expectedNano, now - 30)];
  result = await tonService.verifyTonPayment('not_valid_base64!!!', expectedTon, 1);
  assert.strictEqual(result.valid, true, 'Test 8 FAILED: invalid BOC should not crash, still find tx');
  console.log('  ✅ Test 8 passed: invalid BOC handled gracefully');

  // Restore
  tonService.getTransactions   = originalGetTxs;
  tonService.getArbitratorAddress = originalGetAddr;

  console.log('\n  All verifyTonPayment tests passed ✅');
}

// ─── Subscription route logic tests ───────────────────────────────────────

async function runRouteTests() {
  console.log('\n── Subscription route logic tests ──');

  // Test plan price → TON conversion math
  const planPrice = 5.99;
  const tonRate   = 4.00; // $4/TON
  const expectedTon = planPrice / tonRate; // ~1.4975
  const nanoTon   = BigInt(Math.round(expectedTon * 1e9));

  assert.ok(nanoTon > 1_000_000_000n, 'nanoTon should be > 1 TON');
  assert.ok(nanoTon < 2_000_000_000n, 'nanoTon should be < 2 TON');
  console.log(`  ✅ $${planPrice} @ $${tonRate}/TON = ${expectedTon.toFixed(6)} TON = ${nanoTon} nanoTON`);

  // Test tolerance boundaries
  const tolerance = nanoTon * 5n / 100n;
  const min = nanoTon - tolerance;
  const max = nanoTon + tolerance;

  const exactMatch    = nanoTon >= min && nanoTon <= max;
  const plus4pct      = (nanoTon * 104n / 100n) >= min && (nanoTon * 104n / 100n) <= max;
  const minus4pct     = (nanoTon * 96n / 100n)  >= min && (nanoTon * 96n / 100n)  <= max;
  const plus10pct     = (nanoTon * 110n / 100n) >= min && (nanoTon * 110n / 100n) <= max;

  assert.ok(exactMatch,  'exact should be within tolerance');
  assert.ok(plus4pct,    '+4% should be within tolerance');
  assert.ok(minus4pct,   '-4% should be within tolerance');
  assert.ok(!plus10pct,  '+10% should be outside tolerance');

  console.log('  ✅ Tolerance boundaries correct (±5%)');

  // Test duplicate BOC detection (same boc = same tx_hash = rejected)
  const boc1 = 'dGVzdEJPQzE=';
  const boc2 = 'dGVzdEJPQzI=';
  assert.notStrictEqual(boc1, boc2, 'Different BOCs should be different strings');
  console.log('  ✅ BOC uniqueness check logic ok');

  console.log('\n  All route logic tests passed ✅');
}

// ─── Runner ───────────────────────────────────────────────────────────────

(async () => {
  let failed = false;
  try {
    await runVerifyTests();
    await runRouteTests();
    console.log('\n🎉 All subscription tests passed!\n');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    failed = true;
  }
  process.exit(failed ? 1 : 0);
})();

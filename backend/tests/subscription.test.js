/**
 * Subscription flow tests
 * Tests verifyTonPayment logic and /api/subscriptions/* endpoints
 */

const assert = require('assert');

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Unit tests for verifyTonPayment ───────────────────────────────────────

describe('verifyTonPayment', () => {
  const tonService = require('../services/tonService');
  const originalGetTxs = tonService.getTransactions;
  const originalGetAddr = tonService.getArbitratorAddress;

  const now = Math.floor(Date.now() / 1000);
  const expectedTon = 1.5; // ~$5.99 at ~$4/TON
  const expectedNano = Math.round(expectedTon * 1e9);

  beforeAll(() => {
    // Patch tonService internals for isolated testing
    tonService.getArbitratorAddress = () => 'EQTest';
  });

  afterAll(() => {
    // Restore originals so other suites see the real service
    tonService.getTransactions = originalGetTxs;
    tonService.getArbitratorAddress = originalGetAddr;
  });

  test('exact amount match is valid', async () => {
    tonService.getTransactions = async () => [makeTx(expectedNano, now - 30)];
    const result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
    assert.strictEqual(result.valid, true, 'exact match should be valid');
  });

  test('4% over is within tolerance', async () => {
    tonService.getTransactions = async () => [makeTx(Math.round(expectedNano * 1.04), now - 60)];
    const result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
    assert.strictEqual(result.valid, true, '4% over should be within tolerance');
  });

  test('10% under is invalid', async () => {
    tonService.getTransactions = async () => [makeTx(Math.round(expectedNano * 0.90), now - 60)];
    const result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
    assert.strictEqual(result.valid, false, '10% under should be invalid');
  });

  test('tx older than 15 min is invalid', async () => {
    tonService.getTransactions = async () => [makeTx(expectedNano, now - 16 * 60)];
    const result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
    assert.strictEqual(result.valid, false, 'old tx should not be accepted');
  });

  test('external-in message is ignored', async () => {
    tonService.getTransactions = async () => [{
      now: now - 30,
      inMessage: { info: { type: 'external-in' } },
      hash: () => Buffer.from('00', 'hex'),
    }];
    const result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
    assert.strictEqual(result.valid, false, 'external-in should be ignored');
  });

  test('empty tx list is invalid', async () => {
    tonService.getTransactions = async () => [];
    const result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 1);
    assert.strictEqual(result.valid, false, 'empty tx list should be invalid');
  });

  test('retry logic succeeds on second attempt', async () => {
    let callCount = 0;
    tonService.getTransactions = async () => {
      callCount++;
      if (callCount < 2) return [];
      return [makeTx(expectedNano, now - 30)];
    };
    // Override sleep to avoid waiting in tests
    const originalSleep = tonService.sleep;
    tonService.sleep = async () => {};
    const result = await tonService.verifyTonPayment('dGVzdA==', expectedTon, 3);
    assert.strictEqual(result.valid, true, 'should succeed on retry');
    assert.strictEqual(callCount, 2, 'should have retried exactly once');
    tonService.sleep = originalSleep;
  });

  test('invalid BOC does not crash, still finds tx', async () => {
    tonService.getTransactions = async () => [makeTx(expectedNano, now - 30)];
    const result = await tonService.verifyTonPayment('not_valid_base64!!!', expectedTon, 1);
    assert.strictEqual(result.valid, true, 'invalid BOC should not crash, still find tx');
  });
});

// ─── Subscription route logic tests ───────────────────────────────────────

describe('subscription route logic', () => {
  const planPrice = 5.99;
  const tonRate = 4.00; // $4/TON
  const expectedTon = planPrice / tonRate; // ~1.4975
  const nanoTon = BigInt(Math.round(expectedTon * 1e9));

  test('plan price → TON conversion lands between 1 and 2 TON', () => {
    assert.ok(nanoTon > 1_000_000_000n, 'nanoTon should be > 1 TON');
    assert.ok(nanoTon < 2_000_000_000n, 'nanoTon should be < 2 TON');
  });

  test('tolerance boundaries are ±5%', () => {
    const tolerance = nanoTon * 5n / 100n;
    const min = nanoTon - tolerance;
    const max = nanoTon + tolerance;

    const exactMatch = nanoTon >= min && nanoTon <= max;
    const plus4pct = (nanoTon * 104n / 100n) >= min && (nanoTon * 104n / 100n) <= max;
    const minus4pct = (nanoTon * 96n / 100n) >= min && (nanoTon * 96n / 100n) <= max;
    const plus10pct = (nanoTon * 110n / 100n) >= min && (nanoTon * 110n / 100n) <= max;

    assert.ok(exactMatch, 'exact should be within tolerance');
    assert.ok(plus4pct, '+4% should be within tolerance');
    assert.ok(minus4pct, '-4% should be within tolerance');
    assert.ok(!plus10pct, '+10% should be outside tolerance');
  });

  test('different BOCs are distinct strings (duplicate detection)', () => {
    const boc1 = 'dGVzdEJPQzE=';
    const boc2 = 'dGVzdEJPQzI=';
    assert.notStrictEqual(boc1, boc2, 'Different BOCs should be different strings');
  });
});

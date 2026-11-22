import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRONTIER_TIER_MODELS,
  TieredRateAwareRouter,
  TierModelConfig,
} from './rateRouter';

const TEST_TIERS: readonly TierModelConfig[] = [
  {
    id: 'tier-1',
    apiModel: 'gemini-3.8-live',
    tierOrder: 1,
    rpmLimit: 5,
    tpmLimit: 1000,
    rpdLimit: 10,
    supportsThinkingConfig: false,
  },
  {
    id: 'tier-2',
    apiModel: 'gemini-3-flash-live',
    tierOrder: 2,
    rpmLimit: 5,
    tpmLimit: 2000,
    rpdLimit: 20,
    supportsThinkingConfig: false,
  },
  {
    id: 'tier-3',
    apiModel: 'gemini-2.5-flash-native-audio',
    tierOrder: 3,
    rpmLimit: null,
    tpmLimit: 100_000,
    rpdLimit: null,
    supportsThinkingConfig: false,
  },
];

test('default frontier selection chooses Gemini 3.8 Live first', () => {
  const router = new TieredRateAwareRouter(FRONTIER_TIER_MODELS);
  const selected = router.selectModel({ now: 10_000 });
  assert.equal(selected.id, 'gemini-3.8-live');
  assert.equal(selected.tierOrder, 1);
});

test('does not switch before RPM limit is reached, and switches before exceeding 5 RPM', () => {
  const router = new TieredRateAwareRouter(TEST_TIERS);
  const t0 = 100_000;

  // Requests 1 through 5 stay on tier-1 (never switch prematurely)
  for (let i = 0; i < 5; i++) {
    const picked = router.selectModel({ estimatedTokens: 50, now: t0 + i * 100 });
    assert.equal(picked.id, 'tier-1', `Request ${i + 1} must stay on tier-1`);
    router.recordRequest(picked.id, 50, t0 + i * 100);
  }

  // 6th request within the same minute must NOT hit tier-1 (5 RPM limit); switches to tier-2
  const sixth = router.selectModel({ estimatedTokens: 50, now: t0 + 1000 });
  assert.equal(sixth.id, 'tier-2');

  // Once the 60s window expires, frontier tier-1 is restored automatically
  const afterWindow = router.selectModel({ estimatedTokens: 50, now: t0 + 61_000 });
  assert.equal(afterWindow.id, 'tier-1');
});

test('proactively switches tier when TPM would exceed limit', () => {
  const router = new TieredRateAwareRouter(TEST_TIERS);
  const t0 = 200_000;

  const first = router.selectModel({ estimatedTokens: 800, now: t0 });
  assert.equal(first.id, 'tier-1');
  router.recordRequest(first.id, 800, t0);

  // Next 300 tokens would push tier-1 to 1100 > 1000 TPM -> switches to tier-2
  const second = router.selectModel({ estimatedTokens: 300, now: t0 + 500 });
  assert.equal(second.id, 'tier-2');
});

test('proactively switches tier when RPD limit is reached', () => {
  const smallRpdTiers: readonly TierModelConfig[] = [
    {
      id: 'tier-1',
      apiModel: 'm1',
      tierOrder: 1,
      rpmLimit: 100,
      tpmLimit: 100_000,
      rpdLimit: 2,
      supportsThinkingConfig: false,
    },
    {
      id: 'tier-2',
      apiModel: 'm2',
      tierOrder: 2,
      rpmLimit: 100,
      tpmLimit: 100_000,
      rpdLimit: 10,
      supportsThinkingConfig: false,
    },
  ];
  const router = new TieredRateAwareRouter(smallRpdTiers);
  const t0 = 500_000;

  // 2 requests across different minutes exhaust RPD=2 on tier-1
  router.recordRequest('tier-1', 10, t0);
  router.recordRequest('tier-1', 10, t0 + 120_000);

  const third = router.selectModel({ estimatedTokens: 10, now: t0 + 240_000 });
  assert.equal(third.id, 'tier-2');
});

test('unexpected rate limit or error marks cooldown and retries on next tier', () => {
  const router = new TieredRateAwareRouter(TEST_TIERS);
  const t0 = 300_000;

  const first = router.selectModel({ now: t0 });
  assert.equal(first.id, 'tier-1');

  // Simulate unexpected 429 or connection error on tier-1
  router.markErrorCooldown('tier-1', 30_000, t0);

  const retry = router.selectModel({ now: t0 + 100 });
  assert.equal(retry.id, 'tier-2');

  // Simulate error on tier-2 as well -> steps down to tier-3
  router.markErrorCooldown('tier-2', 30_000, t0 + 200);
  const secondRetry = router.selectModel({ now: t0 + 300 });
  assert.equal(secondRetry.id, 'tier-3');
});

test('selectNextTier rotates under the hood and skips cooled-down tiers', () => {
  const router = new TieredRateAwareRouter(TEST_TIERS);
  const t0 = 400_000;

  const next1 = router.selectNextTier('tier-1', { now: t0 });
  assert.equal(next1.id, 'tier-2');

  const next2 = router.selectNextTier('tier-2', { now: t0 });
  assert.equal(next2.id, 'tier-3');

  const wrapped = router.selectNextTier('tier-3', { now: t0 });
  assert.equal(wrapped.id, 'tier-1');

  // If tier-2 is in cooldown, rotating from tier-1 skips straight to tier-3
  router.markErrorCooldown('tier-2', 30_000, t0);
  const skipped = router.selectNextTier('tier-1', { now: t0 + 50 });
  assert.equal(skipped.id, 'tier-3');
});

test('getTierByStep starts at default frontier for step 0 and rotates on positive steps', () => {
  const router = new TieredRateAwareRouter(FRONTIER_TIER_MODELS);
  const t0 = 600_000;

  assert.equal(router.getTierByStep(0, { now: t0 }).id, 'gemini-3.8-live');
  assert.equal(
    router.getTierByStep(1, { now: t0 }).id,
    'gemini-3.8-live-extended-thinking',
  );
  assert.equal(router.getTierByStep(2, { now: t0 }).id, 'gemini-3-flash-live');
  assert.equal(
    router.getTierByStep(3, { now: t0 }).id,
    'gemini-2.5-flash-native-audio-dialog',
  );
  assert.equal(router.getTierByStep(4, { now: t0 }).id, 'gemini-3.8-live');
});


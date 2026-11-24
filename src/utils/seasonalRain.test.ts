import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSeasonalRainParticles } from './seasonalRain';

test('generateSeasonalRainParticles returns empty array for count <= 0 or empty icons', () => {
  assert.deepEqual(
    generateSeasonalRainParticles({ icons: [], count: 24, speedMultiplier: 1, style: 'navidad' }),
    []
  );
  assert.deepEqual(
    generateSeasonalRainParticles({ icons: ['❄️'], count: 0, speedMultiplier: 1, style: 'navidad' }),
    []
  );
});

test('particles have varied falling speeds across fast, medium, and gentle tiers', () => {
  const drops = generateSeasonalRainParticles({
    icons: ['🎁', '❄️', '🎄', '⭐'],
    count: 24,
    speedMultiplier: 1,
    style: 'navidad',
  });

  assert.equal(drops.length, 24);

  const uniqueDurations = new Set(drops.map((d) => d.durationSec));
  assert.ok(uniqueDurations.size >= 16, `expected varied durations, got ${uniqueDurations.size}`);

  const tiers = new Set(drops.map((d) => d.speedTier));
  assert.ok(tiers.has('fast') && tiers.has('medium') && tiers.has('gentle'));

  const minDur = Math.min(...drops.map((d) => d.durationSec));
  const maxDur = Math.max(...drops.map((d) => d.durationSec));
  assert.ok(maxDur - minDur >= 4.5, `expected wide speed spread, got ${minDur}s..${maxDur}s`);
});

test('particles use negative delays to cover the entire viewport height from frame 0 without vertical blank bands', () => {
  const drops = generateSeasonalRainParticles({
    icons: ['🎁', '❄️', '🎄', '⭐'],
    count: 24,
    speedMultiplier: 1,
    style: 'navidad',
  });

  for (const drop of drops) {
    assert.ok(drop.delaySec <= 0, `expected delaySec <= 0, got ${drop.delaySec}`);
    assert.ok(drop.delaySec > -drop.durationSec, `delaySec ${drop.delaySec} exceeds cycle ${drop.durationSec}`);
    assert.ok(drop.leftPct >= 1.5 && drop.leftPct <= 97.5);
  }

  // Check vertical coverage across top, upper-mid, lower-mid, and bottom quarters at t=0
  const quarters = [0, 0, 0, 0];
  for (const drop of drops) {
    const q = Math.min(3, Math.floor(drop.initialProgress * 4));
    quarters[q]++;
  }
  for (let i = 0; i < 4; i++) {
    assert.ok(quarters[i] >= 4, `quarter ${i} underpopulated (${quarters[i]}) — would leave blank band`);
  }

  // Check horizontal coverage across 4 screen quadrants
  const xQuadrants = [0, 0, 0, 0];
  for (const drop of drops) {
    const q = Math.min(3, Math.floor((drop.leftPct / 100) * 4));
    xQuadrants[q]++;
  }
  for (let i = 0; i < 4; i++) {
    assert.ok(xQuadrants[i] >= 4, `horizontal band ${i} underpopulated (${xQuadrants[i]})`);
  }
});

test('speedMultiplier scales durations proportionally and keeps rain dispersed', () => {
  const normal = generateSeasonalRainParticles({
    icons: ['💧', '🌧️'],
    count: 20,
    speedMultiplier: 1,
    style: 'lluvia_relajante',
  });
  const fast = generateSeasonalRainParticles({
    icons: ['💧', '🌧️'],
    count: 20,
    speedMultiplier: 2,
    style: 'lluvia_relajante',
  });

  for (let i = 0; i < normal.length; i++) {
    assert.ok(fast[i].durationSec < normal[i].durationSec);
  }
});

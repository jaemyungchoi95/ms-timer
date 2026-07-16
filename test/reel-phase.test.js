import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reelPhase } from '../src/lib/reel-phase.js';

test('백의자리 — 시작', () => {
  assert.equal(reelPhase(0, 100), 0);
});

test('백의자리 — 중간', () => {
  assert.equal(reelPhase(450, 100), 4.5);
});

test('백의자리 — 최대', () => {
  assert.equal(reelPhase(999, 100), 9.99);
});

test('십의자리 — 백의자리를 무시하고 wrap', () => {
  assert.equal(reelPhase(450, 10), 5);
});

test('십의자리 — 최대', () => {
  assert.equal(reelPhase(999, 10), 9.9);
});

test('일의자리 — 최대', () => {
  assert.equal(reelPhase(999, 1), 9);
});

test('일의자리 — 450ms는 일의자리가 0', () => {
  assert.equal(reelPhase(450, 1), 0);
});

test('0..999 전 구간에서 위상은 항상 [0, 10)', () => {
  for (let ms = 0; ms < 1000; ms++) {
    for (const place of [100, 10, 1]) {
      const phase = reelPhase(ms, place);
      assert.ok(phase >= 0 && phase < 10,
        `reelPhase(${ms}, ${place}) = ${phase} — [0,10) 범위 이탈`);
    }
  }
});

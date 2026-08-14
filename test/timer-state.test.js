import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timerStateOf, IMMINENT_MS } from '../src/lib/timer-state.js';

const rem = (h, m, s, ms) => ({ expired: false, h, m, s, ms });

test('만료 플래그는 남은 시간과 무관하게 expired', () => {
  assert.equal(timerStateOf({ expired: true, h: 0, m: 0, s: 0, ms: 0 }), 'expired');
});

test('정확히 10분(600000ms) 남음은 임박에 포함된다', () => {
  assert.equal(timerStateOf(rem(0, 10, 0, 0)), 'imminent');
});

test('10분 + 1ms 는 진행 중', () => {
  assert.equal(timerStateOf(rem(0, 10, 0, 1)), 'running');
});

test('10분 미만은 임박 — 1ms 남음 포함', () => {
  assert.equal(timerStateOf(rem(0, 9, 59, 999)), 'imminent');
  assert.equal(timerStateOf(rem(0, 0, 0, 1)), 'imminent');
});

test('시간 단위가 있으면 진행 중 — 1시간 10분', () => {
  assert.equal(timerStateOf(rem(1, 10, 0, 0)), 'running');
});

test('IMMINENT_MS 상수는 10분이다', () => {
  assert.equal(IMMINENT_MS, 600000);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRemaining } from '../src/lib/countdown.js';

const at = (h, m, s, ms) => new Date(2026, 6, 15, h, m, s, ms);

test('정상 카운트다운 — 09:00이면 9시간 남음', () => {
  assert.deepEqual(computeRemaining(at(9, 0, 0, 0)),
    { expired: false, h: 9, m: 0, s: 0, ms: 0 });
});

test('18시 1ms 전', () => {
  assert.deepEqual(computeRemaining(at(17, 59, 59, 999)),
    { expired: false, h: 0, m: 0, s: 0, ms: 1 });
});

test('18시 정각 — expired', () => {
  assert.deepEqual(computeRemaining(at(18, 0, 0, 0)),
    { expired: true, h: 0, m: 0, s: 0, ms: 0 });
});

test('18시 1ms 후 — expired', () => {
  assert.deepEqual(computeRemaining(at(18, 0, 0, 1)),
    { expired: true, h: 0, m: 0, s: 0, ms: 0 });
});

test('18시 이후 실행 — 즉시 expired', () => {
  assert.deepEqual(computeRemaining(at(19, 30, 0, 0)),
    { expired: true, h: 0, m: 0, s: 0, ms: 0 });
});

test('자정 직후 — 같은 날 18시까지 18시간 (자정 롤오버)', () => {
  assert.deepEqual(computeRemaining(at(0, 0, 0, 0)),
    { expired: false, h: 18, m: 0, s: 0, ms: 0 });
});

test('자릿수 혼합 — 08:07:06.005', () => {
  assert.deepEqual(computeRemaining(at(8, 7, 6, 5)),
    { expired: false, h: 9, m: 52, s: 53, ms: 995 });
});

test('targetHour 인자로 목표 시각 변경', () => {
  assert.deepEqual(computeRemaining(at(17, 0, 0, 0), 19),
    { expired: false, h: 2, m: 0, s: 0, ms: 0 });
});

test('입력 Date를 변경하지 않는다 (순수 함수)', () => {
  const now = at(9, 0, 0, 0);
  const before = now.getTime();
  computeRemaining(now);
  assert.equal(now.getTime(), before);
});

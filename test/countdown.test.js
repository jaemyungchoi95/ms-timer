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

test('target 인자로 목표 시각 변경', () => {
  assert.deepEqual(computeRemaining(at(17, 0, 0, 0), { h: 19, m: 0 }),
    { expired: false, h: 2, m: 0, s: 0, ms: 0 });
});

test('입력 Date를 변경하지 않는다 (순수 함수)', () => {
  const now = at(9, 0, 0, 0);
  const before = now.getTime();
  computeRemaining(now);
  assert.equal(now.getTime(), before);
});

test('분 단위 target — 09:00에서 16:30까지 7시간 30분', () => {
  assert.deepEqual(computeRemaining(at(9, 0, 0, 0), { h: 16, m: 30 }),
    { expired: false, h: 7, m: 30, s: 0, ms: 0 });
});

test('분 단위 target — 정각 1ms 전', () => {
  assert.deepEqual(computeRemaining(at(16, 29, 59, 999), { h: 16, m: 30 }),
    { expired: false, h: 0, m: 0, s: 0, ms: 1 });
});

test('분 단위 target — 정각은 expired', () => {
  assert.deepEqual(computeRemaining(at(16, 30, 0, 0), { h: 16, m: 30 }),
    { expired: true, h: 0, m: 0, s: 0, ms: 0 });
});

test('분 단위 target — 정각 1ms 후는 expired', () => {
  assert.deepEqual(computeRemaining(at(16, 30, 0, 1), { h: 16, m: 30 }),
    { expired: true, h: 0, m: 0, s: 0, ms: 0 });
});

test('target 인자 없으면 18:00 기본값', () => {
  assert.deepEqual(computeRemaining(at(9, 0, 0, 0)),
    computeRemaining(at(9, 0, 0, 0), { h: 18, m: 0 }));
});

test('자정 롤오버는 분 단위 target에서도 동작 — 00:00에서 16:30까지', () => {
  assert.deepEqual(computeRemaining(at(0, 0, 0, 0), { h: 16, m: 30 }),
    { expired: false, h: 16, m: 30, s: 0, ms: 0 });
});

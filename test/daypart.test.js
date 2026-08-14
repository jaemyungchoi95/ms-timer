import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daypartOf } from '../src/lib/daypart.js';

const at = (h, m = 0, s = 0, ms = 0) => new Date(2026, 7, 14, h, m, s, ms);

test('구간 시작 시각은 그 구간에 속한다 — [포함, 미포함)', () => {
  assert.equal(daypartOf(at(0)), 'dawn');
  assert.equal(daypartOf(at(6)), 'morning');
  assert.equal(daypartOf(at(11)), 'day');
  assert.equal(daypartOf(at(17)), 'evening');
  assert.equal(daypartOf(at(21)), 'night');
});

test('구간 끝 직전 시각은 이전 구간에 남는다', () => {
  assert.equal(daypartOf(at(5, 59, 59, 999)), 'dawn');
  assert.equal(daypartOf(at(10, 59, 59, 999)), 'morning');
  assert.equal(daypartOf(at(16, 59, 59, 999)), 'day');
  assert.equal(daypartOf(at(20, 59, 59, 999)), 'evening');
  assert.equal(daypartOf(at(23, 59, 59, 999)), 'night');
});

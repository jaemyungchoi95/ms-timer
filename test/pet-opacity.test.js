import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjustOpacity, normalizeOpacity, OPACITY_MIN, OPACITY_MAX } from '../src/lib/pet-opacity.js';

test('상한 1.0 에서 멈춘다', () => {
  assert.equal(adjustOpacity(1.0, 1), 1.0);
  assert.equal(adjustOpacity(0.9, 1), 1.0);
});

test('하한 0.3 에서 멈춘다', () => {
  assert.equal(adjustOpacity(0.3, -1), 0.3);
  assert.equal(adjustOpacity(0.4, -1), 0.3);
});

test('0.3 에서 +0.1 을 7번 하면 정확히 1.0 — 부동소수 드리프트 없음', () => {
  let v = OPACITY_MIN;
  for (let i = 0; i < 7; i++) v = adjustOpacity(v, 1);
  assert.equal(v, OPACITY_MAX);
});

test('1.0 에서 -0.1 을 7번 하면 정확히 0.3', () => {
  let v = OPACITY_MAX;
  for (let i = 0; i < 7; i++) v = adjustOpacity(v, -1);
  assert.equal(v, OPACITY_MIN);
});

test('normalizeOpacity — 저장값 로드: 문자열 숫자 허용, 불량·범위 밖은 1.0 폴백', () => {
  assert.equal(normalizeOpacity(0.5), 0.5);
  assert.equal(normalizeOpacity('0.5'), 0.5);
  assert.equal(normalizeOpacity(0.35), 0.4);
  assert.equal(normalizeOpacity(null), 1.0);
  assert.equal(normalizeOpacity('abc'), 1.0);
  assert.equal(normalizeOpacity(0.05), 1.0);
  assert.equal(normalizeOpacity(2), 1.0);
});

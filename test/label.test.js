import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLabel } from '../src/lib/label.js';

test('경계 — 1자 유효', () => {
  assert.equal(normalizeLabel('가'), '가');
});

test('경계 — 12자 유효', () => {
  assert.equal(normalizeLabel('일이삼사오육칠팔구십일이'), '일이삼사오육칠팔구십일이');
});

test('경계 — 13자는 null', () => {
  assert.equal(normalizeLabel('일이삼사오육칠팔구십일이삼'), null);
});

test('앞뒤 공백은 trim 되어 유효', () => {
  assert.equal(normalizeLabel('  회의까지  '), '회의까지');
});

test('trim 후 12자면 유효 — 공백이 상한을 잡아먹지 않는다', () => {
  assert.equal(normalizeLabel(' 일이삼사오육칠팔구십일이 '), '일이삼사오육칠팔구십일이');
});

test('공백만이면 null', () => {
  assert.equal(normalizeLabel('   '), null);
});

test('빈 문자열은 null', () => {
  assert.equal(normalizeLabel(''), null);
});

test('문자열이 아니면 null', () => {
  assert.equal(normalizeLabel(null), null);
  assert.equal(normalizeLabel(undefined), null);
  assert.equal(normalizeLabel(42), null);
});

test('라틴/혼합 문자열 유효', () => {
  assert.equal(normalizeLabel('TIME TO GO'), 'TIME TO GO');
  assert.equal(normalizeLabel('마감 D-day'), '마감 D-day');
});

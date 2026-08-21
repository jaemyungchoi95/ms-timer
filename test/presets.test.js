import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePresets,
  formatPresets,
  upsertPreset,
  MAX_PRESETS,
} from '../src/lib/presets.js';

// ── parsePresets ────────────────────────────────────────────────

test('parsePresets — 왕복 + 시각 오름차순 정렬', () => {
  const raw = '[{"h":15,"m":0,"name":"휴식"},{"h":11,"m":30,"name":"점심"}]';
  assert.deepEqual(parsePresets(raw), [
    { h: 11, m: 30, name: '점심' },
    { h: 15, m: 0, name: '휴식' },
  ]);
});

test('parsePresets — 문구는 필수다 (빈/공백 이름은 null)', () => {
  assert.equal(parsePresets('[{"h":11,"m":30,"name":""}]'), null);
  assert.equal(parsePresets('[{"h":11,"m":30,"name":"   "}]'), null);
});

test('parsePresets — name 은 trim 되고 12자 상한이다', () => {
  assert.deepEqual(parsePresets('[{"h":11,"m":30,"name":" 점심 "}]'), [
    { h: 11, m: 30, name: '점심' },
  ]);
  assert.equal(parsePresets(JSON.stringify([{ h: 11, m: 30, name: 'a'.repeat(13) }])), null);
});

test('parsePresets — 문구 중복은 시각이 달라도 null', () => {
  const raw = '[{"h":11,"m":30,"name":"점심"},{"h":12,"m":0,"name":"점심"}]';
  assert.equal(parsePresets(raw), null);
});

test('parsePresets — 같은 시각 다른 문구는 허용', () => {
  const raw = '[{"h":11,"m":30,"name":"점심"},{"h":11,"m":30,"name":"산책"}]';
  assert.equal(parsePresets(raw).length, 2);
});

test('parsePresets — 시각 범위·개수 캡·손상 입력은 null', () => {
  assert.equal(parsePresets('[{"h":24,"m":0,"name":"a"}]'), null);
  const many = Array.from({ length: MAX_PRESETS + 1 }, (_, i) => ({ h: i, m: 0, name: `p${i}` }));
  assert.equal(parsePresets(JSON.stringify(many)), null);
  assert.equal(parsePresets('not json'), null);
  assert.equal(parsePresets('{}'), null);
  assert.equal(parsePresets(null), null);
});

test('formatPresets — parse 와 왕복 대칭', () => {
  const list = [
    { h: 11, m: 30, name: '점심' },
    { h: 15, m: 0, name: '휴식' },
  ];
  assert.deepEqual(parsePresets(formatPresets(list)), list);
});

// ── upsertPreset ────────────────────────────────────────────────

const BASE = [
  { h: 11, m: 30, name: '점심' },
  { h: 15, m: 0, name: '휴식' },
];

test('upsertPreset — 새 문구는 정렬 위치에 추가된다', () => {
  assert.deepEqual(upsertPreset(BASE, { h: 14, m: 0, name: '미팅' }), [
    { h: 11, m: 30, name: '점심' },
    { h: 14, m: 0, name: '미팅' },
    { h: 15, m: 0, name: '휴식' },
  ]);
});

test('upsertPreset — 기존 문구는 시각만 갱신된다', () => {
  const next = upsertPreset(BASE, { h: 12, m: 0, name: '점심' });
  assert.deepEqual(next, [
    { h: 12, m: 0, name: '점심' },
    { h: 15, m: 0, name: '휴식' },
  ]);
});

test('upsertPreset — name 은 trim 후 비교·저장된다', () => {
  const next = upsertPreset(BASE, { h: 12, m: 0, name: ' 점심 ' });
  assert.equal(next.length, 2);
  assert.deepEqual(next[0], { h: 12, m: 0, name: '점심' });
});

test('upsertPreset — 캡에서 새 문구는 null, 기존 문구 갱신은 허용', () => {
  const full = Array.from({ length: MAX_PRESETS }, (_, i) => ({ h: i, m: 0, name: `p${i}` }));
  assert.equal(upsertPreset(full, { h: 10, m: 0, name: '새것' }), null);
  const updated = upsertPreset(full, { h: 10, m: 0, name: 'p0' });
  assert.equal(updated.length, MAX_PRESETS);
  assert.ok(updated.some((p) => p.name === 'p0' && p.h === 10));
});

test('upsertPreset — 무효 preset 은 null', () => {
  assert.equal(upsertPreset(BASE, { h: 11, m: 30, name: '' }), null);
  assert.equal(upsertPreset(BASE, { h: 24, m: 0, name: 'a' }), null);
  assert.equal(upsertPreset(BASE, { h: 11, m: 30, name: 'a'.repeat(13) }), null);
});

test('upsertPreset — 순수 함수: 입력 배열을 변경하지 않는다', () => {
  const snapshot = structuredClone(BASE);
  upsertPreset(BASE, { h: 14, m: 0, name: '미팅' });
  upsertPreset(BASE, { h: 12, m: 0, name: '점심' });
  assert.deepEqual(BASE, snapshot);
});

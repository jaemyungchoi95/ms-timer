import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAT_MANIFEST } from '../src/renderer/cat-manifest.js';
import { PET_ROW_NAMES } from '../src/lib/pet-state.js';

test('manifest 행 세트는 pet-state 반환 가능 이름 전체와 정확히 일치한다', () => {
  assert.deepEqual(new Set(Object.keys(CAT_MANIFEST.rows)), new Set(PET_ROW_NAMES));
});

test('row 인덱스는 0..7 연속 무중복 — 시트 기하와 어긋나면 엉뚱한 행이 재생된다', () => {
  const rows = Object.values(CAT_MANIFEST.rows).map((r) => r.row).sort((a, b) => a - b);
  assert.deepEqual(rows, [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('모든 행은 columns 개수의 프레임과 양수 fps 를 가진다', () => {
  for (const [name, def] of Object.entries(CAT_MANIFEST.rows)) {
    assert.equal(def.frames, CAT_MANIFEST.columns, `${name} frames`);
    assert.ok(def.fps > 0, `${name} fps`);
  }
});

test('PNG IHDR 치수가 manifest 기하와 일치한다', () => {
  const png = readFileSync(new URL('../src/renderer/assets/cat-sheet.png', import.meta.url));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), CAT_MANIFEST.sheetWidth);
  assert.equal(png.readUInt32BE(20), CAT_MANIFEST.sheetHeight);
  assert.equal(CAT_MANIFEST.sheetWidth, CAT_MANIFEST.frameSize * CAT_MANIFEST.columns);
  assert.equal(CAT_MANIFEST.sheetHeight, CAT_MANIFEST.frameSize * Object.keys(CAT_MANIFEST.rows).length);
});

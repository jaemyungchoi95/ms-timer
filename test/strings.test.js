import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, LANGS } from '../src/lib/strings.js';

test('LANGS 는 STRINGS 의 키와 일치한다', () => {
  assert.deepEqual(LANGS, Object.keys(STRINGS));
});

test('fill — "{}" 1회 치환 템플릿', async () => {
  const mod = await import('../src/lib/strings.js');
  assert.equal(typeof mod.fill, 'function', 'strings.js 가 fill 을 export 해야 한다');
  assert.equal(mod.fill('{}까지', '점심'), '점심까지');
  assert.equal(mod.fill('UNTIL {}', 'LUNCH'), 'UNTIL LUNCH');
});

test('waypointUntil 템플릿은 모든 로케일에서 "{}" 를 포함한다', () => {
  for (const lang of LANGS) {
    assert.ok(
      STRINGS[lang].waypointUntil?.includes('{}'),
      `${lang}.waypointUntil 에 "{}" 자리표시자가 없다`,
    );
  }
});

test('모든 로케일의 키 집합이 동일하다 — 한쪽에만 문자열을 추가하면 여기서 깨진다', () => {
  const [first, ...rest] = LANGS;
  const reference = Object.keys(STRINGS[first]).sort();
  for (const lang of rest) {
    assert.deepEqual(Object.keys(STRINGS[lang]).sort(), reference);
  }
});

test('빈 문자열이 없다', () => {
  for (const lang of LANGS) {
    for (const [key, value] of Object.entries(STRINGS[lang])) {
      assert.equal(typeof value, 'string', `${lang}.${key}`);
      assert.ok(value.length > 0, `${lang}.${key} 가 비어 있다`);
    }
  }
});

test('제목 기본 문구가 normalizeLabel 상한(12자) 안에 있다 — 기본값이 커스텀 규칙을 위반하면 안 된다', async () => {
  const { normalizeLabel } = await import('../src/lib/label.js');
  for (const lang of LANGS) {
    assert.equal(normalizeLabel(STRINGS[lang].countdown), STRINGS[lang].countdown);
    assert.equal(normalizeLabel(STRINGS[lang].expired), STRINGS[lang].expired);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTarget, formatTarget } from '../src/lib/target-time.js';

test('parseTarget — 하한 경계 00:00', () => {
  assert.deepEqual(parseTarget('00:00'), { h: 0, m: 0 });
});

test('parseTarget — 상한 경계 23:59', () => {
  assert.deepEqual(parseTarget('23:59'), { h: 23, m: 59 });
});

test('parseTarget — 실사용 값 16:30', () => {
  assert.deepEqual(parseTarget('16:30'), { h: 16, m: 30 });
});

test('parseTarget — 시 상한 초과는 null', () => {
  assert.equal(parseTarget('24:00'), null);
});

test('parseTarget — 분 상한 초과는 null', () => {
  assert.equal(parseTarget('23:60'), null);
});

// 빈 칸 함정: 느슨하게 파싱했다면 parseInt("8")이 8을 반환해
// "08:30"으로 조용히 유효 판정된다. 화면은 [ ][8]:[3][0] 으로 미완성인데
// ✓ 가 활성화되는 버그. 엄격 매칭이 이를 막는다.
test('parseTarget — 빈 칸 함정: "8:30"은 8로 해석되지 않는다', () => {
  assert.equal(parseTarget('8:30'), null);
});

test('parseTarget — 부분 입력은 null', () => {
  assert.equal(parseTarget('16:3'), null);
  assert.equal(parseTarget(':'), null);
  assert.equal(parseTarget(''), null);
});

test('parseTarget — 콜론 없으면 null', () => {
  assert.equal(parseTarget('1630'), null);
});

test('parseTarget — 숫자가 아니면 null', () => {
  assert.equal(parseTarget('ab:cd'), null);
});

test('parseTarget — 부호는 null (정규식이 - 를 거부한다)', () => {
  assert.equal(parseTarget('-1:00'), null);
});

test('parseTarget — 앞뒤 공백은 null (^$ 앵커가 있다)', () => {
  assert.equal(parseTarget(' 16:30'), null);
  assert.equal(parseTarget('16:30 '), null);
});

test('parseTarget — 문자열이 아닌 입력은 null', () => {
  assert.equal(parseTarget(null), null);
  assert.equal(parseTarget(undefined), null);
  assert.equal(parseTarget(1630), null);
});

test('formatTarget — zero-pad', () => {
  assert.equal(formatTarget({ h: 9, m: 5 }), '09:05');
});

test('formatTarget — 00:00', () => {
  assert.equal(formatTarget({ h: 0, m: 0 }), '00:00');
});

test('formatTarget — 23:59', () => {
  assert.equal(formatTarget({ h: 23, m: 59 }), '23:59');
});

test('왕복 대칭 — formatTarget(parseTarget(s)) === s', () => {
  for (const s of ['00:00', '09:05', '16:30', '18:00', '23:59']) {
    assert.equal(formatTarget(parseTarget(s)), s);
  }
});

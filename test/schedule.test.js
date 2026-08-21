import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWaypoints,
  formatWaypoints,
  validWaypoints,
  selectLeg,
  createScheduleAlarms,
  MAX_WAYPOINTS,
  WAYPOINT_ICONS,
  DEFAULT_ICON,
} from '../src/lib/schedule.js';

/** 테스트 고정 날짜의 시각 생성기 — computeRemaining 은 now 의 날짜를 쓴다. */
const at = (h, m, s = 0, ms = 0) => new Date(2026, 7, 21, h, m, s, ms);
const FINAL = { h: 18, m: 0 };

/** v2 스키마 항목 생성기 — 기본은 빈 문구 + 기본 뱃지. */
const wp = (h, m, over = {}) => ({ h, m, run: '', done: '', icon: DEFAULT_ICON, ...over });

// ── 아이콘 키 계약 ──────────────────────────────────────────────

test('WAYPOINT_ICONS — 6종이고 DEFAULT_ICON 을 포함한다', () => {
  assert.equal(WAYPOINT_ICONS.length, 6);
  assert.ok(WAYPOINT_ICONS.includes(DEFAULT_ICON));
  assert.ok(WAYPOINT_ICONS.includes('finish'));
});

// ── parseWaypoints (스키마 v2: h/m/run/done/icon) ───────────────

test('parseWaypoints — 왕복 + 시각 오름차순 정렬', () => {
  const raw = JSON.stringify([
    wp(14, 0, { icon: 'meeting' }),
    wp(11, 30, { run: '점심까지', done: '즐거운 점심시간!', icon: 'lunch' }),
  ]);
  assert.deepEqual(parseWaypoints(raw), [
    wp(11, 30, { run: '점심까지', done: '즐거운 점심시간!', icon: 'lunch' }),
    wp(14, 0, { icon: 'meeting' }),
  ]);
});

test('parseWaypoints — run/done 은 trim 되고 빈 문자열이 허용된다', () => {
  const raw = JSON.stringify([wp(11, 30, { run: ' 점심까지 ', done: '  ' })]);
  assert.deepEqual(parseWaypoints(raw), [wp(11, 30, { run: '점심까지', done: '' })]);
});

test('parseWaypoints — run/done 13자 초과는 null', () => {
  assert.equal(parseWaypoints(JSON.stringify([wp(11, 30, { run: 'a'.repeat(13) })])), null);
  assert.equal(parseWaypoints(JSON.stringify([wp(11, 30, { done: 'a'.repeat(13) })])), null);
});

test('parseWaypoints — icon 은 6종 키만 허용, 누락/미지 키는 null', () => {
  for (const icon of WAYPOINT_ICONS) {
    assert.equal(parseWaypoints(JSON.stringify([wp(11, 30, { icon })])).length, 1);
  }
  assert.equal(parseWaypoints(JSON.stringify([wp(11, 30, { icon: 'pizza' })])), null);
  const { icon, ...noIcon } = wp(11, 30);
  assert.equal(parseWaypoints(JSON.stringify([noIcon])), null);
});

test('parseWaypoints — v1 스키마({name})는 null (전체 폴백으로 초기화)', () => {
  assert.equal(parseWaypoints('[{"h":11,"m":30,"name":"점심"}]'), null);
});

test('parseWaypoints — 빈 배열 허용', () => {
  assert.deepEqual(parseWaypoints('[]'), []);
});

test('parseWaypoints — 시각 범위 밖/비정수는 null', () => {
  assert.equal(parseWaypoints(JSON.stringify([wp(24, 0)])), null);
  assert.equal(parseWaypoints(JSON.stringify([wp(23, 60)])), null);
  assert.equal(parseWaypoints(JSON.stringify([wp(11.5, 0)])), null);
});

test('parseWaypoints — (h,m) 중복은 null', () => {
  assert.equal(
    parseWaypoints(JSON.stringify([wp(11, 30, { run: 'a' }), wp(11, 30, { run: 'b' })])),
    null,
  );
});

test('parseWaypoints — 개수 캡 초과는 null', () => {
  const many = Array.from({ length: MAX_WAYPOINTS + 1 }, (_, i) => wp(i, 0));
  assert.equal(parseWaypoints(JSON.stringify(many)), null);
  const max = Array.from({ length: MAX_WAYPOINTS }, (_, i) => wp(i, 0));
  assert.deepEqual(parseWaypoints(JSON.stringify(max)), max);
});

test('parseWaypoints — 손상 입력·오형은 null', () => {
  assert.equal(parseWaypoints(null), null);
  assert.equal(parseWaypoints('not json'), null);
  assert.equal(parseWaypoints('{}'), null);
  assert.equal(parseWaypoints('[1]'), null);
  assert.equal(parseWaypoints(JSON.stringify([wp(11, 30, { run: 5 })])), null);
});

test('formatWaypoints — parse 와 왕복 대칭', () => {
  const list = [wp(11, 30, { run: '점심까지', icon: 'tea' }), wp(14, 0, { icon: 'meeting' })];
  assert.deepEqual(parseWaypoints(formatWaypoints(list)), list);
});

// ── validWaypoints / selectLeg ──────────────────────────────────

test('validWaypoints — final 보다 엄격히 이른 것만 남는다', () => {
  const wps = [wp(11, 30), wp(18, 0), wp(19, 0)];
  assert.deepEqual(validWaypoints(wps, FINAL), [wp(11, 30)]);
});

const WPS = [
  wp(11, 30, { run: '점심까지', done: '즐거운 점심시간!', icon: 'lunch' }),
  wp(14, 0, { icon: 'meeting' }),
];

test('selectLeg — 전부 미래면 가장 이른 경유지 (run/done/icon 포함)', () => {
  assert.deepEqual(selectLeg(at(9, 0), WPS, FINAL), {
    kind: 'waypoint', ...WPS[0],
  });
});

test('selectLeg — 정확히 경유지 시각이면 다음 구간', () => {
  assert.deepEqual(selectLeg(at(11, 30), WPS, FINAL), { kind: 'waypoint', ...WPS[1] });
});

test('selectLeg — 경유지 전부 지나면/없으면/final 이후에도 final', () => {
  assert.deepEqual(selectLeg(at(17, 0), WPS, FINAL), { kind: 'final', h: 18, m: 0 });
  assert.deepEqual(selectLeg(at(9, 0), [], FINAL), { kind: 'final', h: 18, m: 0 });
  assert.deepEqual(selectLeg(at(23, 0), WPS, FINAL), { kind: 'final', h: 18, m: 0 });
});

test('selectLeg — 미정렬 입력도 가장 이른 미래를 고른다', () => {
  assert.deepEqual(selectLeg(at(9, 0), [WPS[1], WPS[0]], FINAL), { kind: 'waypoint', ...WPS[0] });
});

test('selectLeg — final 이후의 경유지는 무시된다', () => {
  assert.deepEqual(selectLeg(at(9, 0), [wp(19, 0)], FINAL), { kind: 'final', h: 18, m: 0 });
});

// ── createScheduleAlarms ────────────────────────────────────────

test('alarms — 기동 침묵: 이미 지난 checkpoint 는 첫 관측에서 울리지 않는다', () => {
  const alarms = createScheduleAlarms(WPS, FINAL);
  assert.deepEqual(alarms.observe(at(12, 0)), []);
});

test('alarms — 통과 순간 해당 경유지가 run/done/icon 과 함께 발화한다', () => {
  const alarms = createScheduleAlarms(WPS, FINAL);
  assert.deepEqual(alarms.observe(at(11, 29)), []);
  assert.deepEqual(alarms.observe(at(11, 30)), [{ kind: 'waypoint', ...WPS[0] }]);
});

test('alarms — 같은 checkpoint 는 재발화하지 않는다', () => {
  const alarms = createScheduleAlarms(WPS, FINAL);
  alarms.observe(at(11, 29));
  alarms.observe(at(11, 30));
  assert.deepEqual(alarms.observe(at(11, 31)), []);
});

test('alarms — 절전 다중 통과: 발화 목록은 정렬 순서, final 이 마지막', () => {
  const alarms = createScheduleAlarms(WPS, FINAL);
  alarms.observe(at(9, 0));
  assert.deepEqual(alarms.observe(at(18, 30)), [
    { kind: 'waypoint', ...WPS[0] },
    { kind: 'waypoint', ...WPS[1] },
    { kind: 'final', h: 18, m: 0 },
  ]);
});

test('alarms — 자정 재무장: 다음 날 같은 시각에 다시 발화한다', () => {
  const alarms = createScheduleAlarms([], FINAL);
  alarms.observe(at(17, 59));
  assert.deepEqual(alarms.observe(at(18, 0)), [{ kind: 'final', h: 18, m: 0 }]);
  const nextDay = (h, m) => new Date(2026, 7, 22, h, m);
  assert.deepEqual(alarms.observe(nextDay(9, 0)), []);
  assert.deepEqual(alarms.observe(nextDay(18, 0)), [{ kind: 'final', h: 18, m: 0 }]);
});

test('alarms — rebaseline: 지난 checkpoint 를 심으면 침묵, 미래는 이후 정상 발화', () => {
  const alarms = createScheduleAlarms(WPS, FINAL);
  alarms.rebaseline(at(12, 0));
  assert.deepEqual(alarms.observe(at(12, 0, 0, 1)), []);
  assert.deepEqual(alarms.observe(at(14, 0)), [{ kind: 'waypoint', ...WPS[1] }]);
});

test('alarms — 경유지 없음(기존 단일 동작): final 만 발화한다', () => {
  const alarms = createScheduleAlarms([], FINAL);
  assert.deepEqual(alarms.observe(at(17, 59, 59, 999)), []);
  assert.deepEqual(alarms.observe(at(18, 0)), [{ kind: 'final', h: 18, m: 0 }]);
});

test('alarms — final 이후의 경유지는 tracker 가 만들어지지 않는다', () => {
  const alarms = createScheduleAlarms([wp(19, 0)], FINAL);
  alarms.observe(at(17, 0));
  assert.deepEqual(alarms.observe(at(18, 30)), [{ kind: 'final', h: 18, m: 0 }]);
  assert.deepEqual(alarms.observe(at(19, 30)), []);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWaypoints,
  formatWaypoints,
  validWaypoints,
  selectLeg,
  createScheduleAlarms,
  MAX_WAYPOINTS,
} from '../src/lib/schedule.js';

/** 테스트 고정 날짜의 시각 생성기 — computeRemaining 은 now 의 날짜를 쓴다. */
const at = (h, m, s = 0, ms = 0) => new Date(2026, 7, 21, h, m, s, ms);
const FINAL = { h: 18, m: 0 };

// ── parseWaypoints ──────────────────────────────────────────────

test('parseWaypoints — 왕복 + 시각 오름차순 정렬', () => {
  const raw = '[{"h":14,"m":0,"name":""},{"h":11,"m":30,"name":"점심"}]';
  assert.deepEqual(parseWaypoints(raw), [
    { h: 11, m: 30, name: '점심' },
    { h: 14, m: 0, name: '' },
  ]);
});

test('parseWaypoints — name 은 trim 된다', () => {
  assert.deepEqual(parseWaypoints('[{"h":11,"m":30,"name":"  점심  "}]'), [
    { h: 11, m: 30, name: '점심' },
  ]);
});

test('parseWaypoints — 빈 배열 허용', () => {
  assert.deepEqual(parseWaypoints('[]'), []);
});

test('parseWaypoints — name 13자 초과는 null', () => {
  const raw = JSON.stringify([{ h: 11, m: 30, name: 'a'.repeat(13) }]);
  assert.equal(parseWaypoints(raw), null);
});

test('parseWaypoints — 시각 범위 밖은 null', () => {
  assert.equal(parseWaypoints('[{"h":24,"m":0,"name":""}]'), null);
  assert.equal(parseWaypoints('[{"h":23,"m":60,"name":""}]'), null);
});

test('parseWaypoints — 비정수 시각은 null', () => {
  assert.equal(parseWaypoints('[{"h":11.5,"m":0,"name":""}]'), null);
});

test('parseWaypoints — (h,m) 중복은 null', () => {
  const raw = '[{"h":11,"m":30,"name":"a"},{"h":11,"m":30,"name":"b"}]';
  assert.equal(parseWaypoints(raw), null);
});

test('parseWaypoints — 개수 캡 초과는 null', () => {
  const many = Array.from({ length: MAX_WAYPOINTS + 1 }, (_, i) => ({ h: i, m: 0, name: '' }));
  assert.equal(parseWaypoints(JSON.stringify(many)), null);
  const max = Array.from({ length: MAX_WAYPOINTS }, (_, i) => ({ h: i, m: 0, name: '' }));
  assert.deepEqual(parseWaypoints(JSON.stringify(max)), max);
});

test('parseWaypoints — 문자열 아닌 입력은 null', () => {
  assert.equal(parseWaypoints(null), null);
  assert.equal(parseWaypoints(undefined), null);
  assert.equal(parseWaypoints(123), null);
});

test('parseWaypoints — 손상 JSON/비배열/비객체 항목/필드 누락·오형은 null', () => {
  assert.equal(parseWaypoints('not json'), null);
  assert.equal(parseWaypoints('{}'), null);
  assert.equal(parseWaypoints('[1]'), null);
  assert.equal(parseWaypoints('[null]'), null);
  assert.equal(parseWaypoints('[{"h":11,"m":30}]'), null); // name 누락
  assert.equal(parseWaypoints('[{"h":11,"m":30,"name":5}]'), null);
});

test('formatWaypoints — parse 와 왕복 대칭', () => {
  const list = [
    { h: 11, m: 30, name: '점심' },
    { h: 14, m: 0, name: '' },
  ];
  assert.deepEqual(parseWaypoints(formatWaypoints(list)), list);
});

// ── validWaypoints ──────────────────────────────────────────────

test('validWaypoints — final 보다 엄격히 이른 것만 남는다', () => {
  const wps = [
    { h: 11, m: 30, name: '' },
    { h: 18, m: 0, name: '' }, // final 과 같음 — 제거
    { h: 19, m: 0, name: '' }, // final 이후 — 제거
  ];
  assert.deepEqual(validWaypoints(wps, FINAL), [{ h: 11, m: 30, name: '' }]);
});

test('validWaypoints — 빈 입력은 빈 배열', () => {
  assert.deepEqual(validWaypoints([], FINAL), []);
});

// ── selectLeg ───────────────────────────────────────────────────

const WPS = [
  { h: 11, m: 30, name: '점심' },
  { h: 14, m: 0, name: '' },
];

test('selectLeg — 전부 미래면 가장 이른 경유지', () => {
  assert.deepEqual(selectLeg(at(9, 0), WPS, FINAL), {
    kind: 'waypoint', h: 11, m: 30, name: '점심',
  });
});

test('selectLeg — 정확히 경유지 시각이면 그 경유지는 지난 것 (다음 선택)', () => {
  assert.deepEqual(selectLeg(at(11, 30), WPS, FINAL), {
    kind: 'waypoint', h: 14, m: 0, name: '',
  });
});

test('selectLeg — 경유지 전부 지나면 final', () => {
  assert.deepEqual(selectLeg(at(17, 0), WPS, FINAL), { kind: 'final', h: 18, m: 0 });
});

test('selectLeg — final 도달 이후에도 final (내일로 넘기지 않는다)', () => {
  assert.deepEqual(selectLeg(at(23, 0), WPS, FINAL), { kind: 'final', h: 18, m: 0 });
});

test('selectLeg — 경유지 없으면 final', () => {
  assert.deepEqual(selectLeg(at(9, 0), [], FINAL), { kind: 'final', h: 18, m: 0 });
});

test('selectLeg — 미정렬 입력도 가장 이른 미래를 고른다', () => {
  const unsorted = [WPS[1], WPS[0]];
  assert.deepEqual(selectLeg(at(9, 0), unsorted, FINAL), {
    kind: 'waypoint', h: 11, m: 30, name: '점심',
  });
});

test('selectLeg — final 이후의 경유지는 무시된다', () => {
  assert.deepEqual(selectLeg(at(9, 0), [{ h: 19, m: 0, name: '회식' }], FINAL), {
    kind: 'final', h: 18, m: 0,
  });
});

// ── createScheduleAlarms ────────────────────────────────────────

test('alarms — 기동 침묵: 이미 지난 checkpoint 는 첫 관측에서 울리지 않는다', () => {
  const alarms = createScheduleAlarms(WPS, FINAL);
  assert.deepEqual(alarms.observe(at(12, 0)), []);
});

test('alarms — 통과 순간 해당 경유지 1개가 name 과 함께 발화한다', () => {
  const alarms = createScheduleAlarms(WPS, FINAL);
  assert.deepEqual(alarms.observe(at(11, 29)), []);
  assert.deepEqual(alarms.observe(at(11, 30)), [
    { kind: 'waypoint', h: 11, m: 30, name: '점심' },
  ]);
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
    { kind: 'waypoint', h: 11, m: 30, name: '점심' },
    { kind: 'waypoint', h: 14, m: 0, name: '' },
    { kind: 'final', h: 18, m: 0 },
  ]);
});

test('alarms — 자정 재무장: 다음 날 같은 시각에 다시 발화한다', () => {
  const alarms = createScheduleAlarms([], FINAL);
  alarms.observe(at(17, 59));
  assert.deepEqual(alarms.observe(at(18, 0)), [{ kind: 'final', h: 18, m: 0 }]);
  const nextDay = (h, m) => new Date(2026, 7, 22, h, m);
  assert.deepEqual(alarms.observe(nextDay(9, 0)), []); // 재무장 관측 — 발화 없음
  assert.deepEqual(alarms.observe(nextDay(18, 0)), [{ kind: 'final', h: 18, m: 0 }]);
});

test('alarms — rebaseline: 지난 checkpoint 를 심으면 침묵, 미래는 이후 정상 발화', () => {
  const alarms = createScheduleAlarms(WPS, FINAL);
  alarms.rebaseline(at(12, 0)); // 11:30 은 이미 지남으로 심긴다
  assert.deepEqual(alarms.observe(at(12, 0, 0, 1)), []);
  assert.deepEqual(alarms.observe(at(14, 0)), [{ kind: 'waypoint', h: 14, m: 0, name: '' }]);
});

test('alarms — 경유지 없음(기존 단일 동작): final 만 발화한다', () => {
  const alarms = createScheduleAlarms([], FINAL);
  assert.deepEqual(alarms.observe(at(17, 59, 59, 999)), []);
  assert.deepEqual(alarms.observe(at(18, 0)), [{ kind: 'final', h: 18, m: 0 }]);
});

test('alarms — final 이후의 경유지는 tracker 가 만들어지지 않는다', () => {
  const alarms = createScheduleAlarms([{ h: 19, m: 0, name: '회식' }], FINAL);
  alarms.observe(at(17, 0));
  assert.deepEqual(alarms.observe(at(18, 30)), [{ kind: 'final', h: 18, m: 0 }]);
  assert.deepEqual(alarms.observe(at(19, 30)), []);
});

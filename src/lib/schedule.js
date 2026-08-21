import { computeRemaining } from './countdown.js';
import { createExpiryTracker } from './expiry-tracker.js';
import { isValidTime } from './target-time.js';
import { normalizeLabel } from './label.js';

/** 경유지 개수 상한 — 오버레이 패널이 스크롤 없이 감당하는 수준 (spec §5). */
export const MAX_WAYPOINTS = 6;

/** 뱃지 아이콘 키 — assets/icons/<키>.png 와 1:1 (spec §5c-4). */
export const WAYPOINT_ICONS = ['lunch', 'meeting', 'tea', 'work-a', 'work-b', 'finish'];
/** 신규 행 기본 뱃지. */
export const DEFAULT_ICON = 'lunch';

const minutesOf = (t) => t.h * 60 + t.m;
const byTime = (a, b) => minutesOf(a) - minutesOf(b);

/** 문구 1개 정규화 — 빈 문자열 허용, 비어 있지 않으면 normalizeLabel 12자 상한. */
function normalizePhrase(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed !== '' && normalizeLabel(trimmed) === null) return null;
  return trimmed;
}

/**
 * JSON 문자열 → 정규화된 waypoint 배열(시각 오름차순) or null. 스키마 v2:
 * {h, m, run, done, icon} — run(표시 문구)/done(도달 문구)은 빈 문자열 허용,
 * icon 은 WAYPOINT_ICONS 6종 키 필수.
 *
 * 저장 복원값이 이 함수를 탄다 — 검증 규칙은 여기에만 있다 (parseTarget 관용).
 * 항목 하나라도 위반이면 전체 null — 호출부가 빈 배열로 폴백한다
 * (v1 {name} 데이터도 이 경로로 초기화된다, spec §5c-7).
 */
export function parseWaypoints(str) {
  if (typeof str !== 'string') return null;

  let raw;
  try {
    raw = JSON.parse(str);
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw.length > MAX_WAYPOINTS) return null;

  const out = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') return null;
    const { h, m, icon } = item;
    if (!isValidTime(h, m) || !WAYPOINT_ICONS.includes(icon)) return null;
    const run = normalizePhrase(item.run);
    const done = normalizePhrase(item.done);
    if (run === null || done === null) return null;
    out.push({ h, m, run, done, icon });
  }

  if (new Set(out.map(minutesOf)).size !== out.length) return null;
  return out.sort(byTime);
}

/** waypoint 배열 → JSON 문자열 (parseWaypoints 와 왕복 대칭). */
export function formatWaypoints(list) {
  return JSON.stringify(list.map(({ h, m, run, done, icon }) => ({ h, m, run, done, icon })));
}

/**
 * final 보다 엄격히 이른 경유지만 남긴다.
 * 편집기가 위반 커밋을 막지만, 저장 드리프트 방어의 단일 지점이다 —
 * 표시 선택(selectLeg)과 발화(createScheduleAlarms)가 모두 여기를 거친다.
 */
export function validWaypoints(waypoints, target) {
  return waypoints.filter((wp) => minutesOf(wp) < minutesOf(target));
}

/**
 * 표시용 현재 구간: 아직 지나지 않은 가장 이른 경유지, 없으면 final.
 * "지났다"의 기준은 computeRemaining 하나로 통일한다(diff ≤ 0 = expired) —
 * 정확히 경유지 시각인 프레임은 이미 다음 구간이다.
 */
export function selectLeg(now, waypoints, target) {
  const valid = validWaypoints(waypoints, target).sort(byTime);
  for (const wp of valid) {
    if (!computeRemaining(now, wp).expired) {
      return { kind: 'waypoint', h: wp.h, m: wp.m, run: wp.run, done: wp.done, icon: wp.icon };
    }
  }
  return { kind: 'final', h: target.h, m: target.m };
}

/**
 * checkpoint 별 독립 expiry-tracker 묶음 (valid 경유지 각 1 + final 1).
 *
 * 발화를 표시 선택과 분리하는 이유: selectLeg 는 경유지가 지나는 순간 다음
 * 구간으로 먼저 점프하므로, 표시용 remaining 에서는 만료 에지가 구조적으로
 * 관측되지 않는다. 각 checkpoint 를 독립 관찰해야 팝업이 뜬다.
 *
 * tracker 의 null 센티널 덕에 기동 시 이미 지난 checkpoint 는 침묵하고,
 * 자정에는 computeRemaining 이 다시 미래를 보며 자동 재무장된다.
 */
export function createScheduleAlarms(waypoints, target) {
  const cps = [
    ...validWaypoints(waypoints, target)
      .sort(byTime)
      .map((wp) => ({
        kind: 'waypoint', h: wp.h, m: wp.m, run: wp.run, done: wp.done, icon: wp.icon,
      })),
    { kind: 'final', h: target.h, m: target.m },
  ];
  const trackers = cps.map(() => createExpiryTracker());

  return {
    /**
     * 매 프레임 호출. 이번 관측에서 발화한 checkpoint 목록을 반환한다 —
     * 경유지 오름차순, final 이 마지막. 다중 통과(절전 복귀) 시 호출자가
     * 순서대로 알리면 replace-not-stack 팝업에 가장 늦은 것만 남는다.
     */
    observe(now) {
      const fired = [];
      cps.forEach((cp, i) => {
        if (trackers[i].observe(computeRemaining(now, cp).expired)) fired.push({ ...cp });
      });
      return fired;
    },

    /** 일정 편집 커밋 순간 호출 — 전체 tracker 에 현재 레벨을 심는다. */
    rebaseline(now) {
      cps.forEach((cp, i) => trackers[i].rebaseline(computeRemaining(now, cp).expired));
    },
  };
}

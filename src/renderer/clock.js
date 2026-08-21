import { computeRemaining } from '../lib/countdown.js';
import { STRINGS, fill } from '../lib/strings.js';
import { formatTarget } from '../lib/target-time.js';
import { createScheduleAlarms, selectLeg } from '../lib/schedule.js';
import { timerStateOf } from '../lib/timer-state.js';
import { FlipDigit } from './flip-digit.js';
import { Reel } from './reel.js';
import { initTheme } from './theme.js';
import { initScheduleEditor } from './schedule-editor.js';
import { initLang } from './lang.js';
import { initPetToggle } from './pet-toggle.js';
import { ICON_SRC } from './icons.js';

const clockEl = document.getElementById('clock');
const titleEl = document.getElementById('title');
const titleBadgeEl = document.querySelector('[data-title-badge]');
const schedPanelEl = document.querySelector('[data-sched-edit]');
const digits = [...document.querySelectorAll('[data-flip]')].map((el) => new FlipDigit(el));

const reels = [
  new Reel(document.querySelector('[data-reel="100"]'), 100, 0),
  new Reel(document.querySelector('[data-reel="10"]'), 10, 1),
  new Reel(document.querySelector('[data-reel="1"]'), 1, 3),
];

const pad2 = (n) => String(n).padStart(2, '0');

let lastExpired = null;
let lastSentState = null;
let currentLeg = null; // 표시 중인 구간 — 제목·헤더 뱃지의 근거
let legKey = null;

// getLang/onChange 콜백들은 사용자 입력에서만 불리므로(동기 초기화 중엔 안 불림)
// TDZ 안전 — 기존 관용 그대로.
let lang = initLang((next) => { lang = next; applyTitle(); });
let schedule = initScheduleEditor({
  trigger: titleEl, // 제목 클릭 → 일정 모달 (spec §5c-1, 라벨 편집기 계승)
  panel: schedPanelEl,
  getLang: () => lang,
  onChange: (next) => {
    schedule = next;
    alarms = createScheduleAlarms(schedule.waypoints, schedule.target);
    // 커밋 순간 동기 재기준 — 다음 틱을 기다리면 17:59:59.995 에 커밋된
    // 일정 변경이 18:00 의 전환을 삼키거나 오발화한다.
    alarms.rebaseline(new Date());
    applyTitle(); // Finish 문구가 바뀌었을 수 있다 — 구간 전환 없이도 갱신
  },
});
let alarms = createScheduleAlarms(schedule.waypoints, schedule.target);

/**
 * 제목 문구를 쓰는 유일한 함수.
 * waypoint 구간: 표시 문구 as-is, '' 이면 "HH:MM까지" 템플릿 폴백.
 * final 구간: Finish 표시/도달 문구 ?? 언어별 기본 (기존 run/done 시맨틱 계승).
 * document.title 도 함께 — 작업표시줄이 상태를 따라간다.
 */
function applyTitle() {
  let text;
  if (currentLeg !== null && currentLeg.kind === 'waypoint') {
    text = currentLeg.run || fill(STRINGS[lang].waypointUntil, formatTarget(currentLeg));
  } else if (lastExpired === true) {
    text = schedule.finish.done || STRINGS[lang].expired;
  } else {
    text = schedule.finish.run || STRINGS[lang].countdown;
  }
  titleEl.textContent = text;
  document.title = text;
}

/** 팝업 문구 — 도달 문구 ?? 폴백 (경유 waypointFallback / final expired 기본). */
function alertText(cp) {
  if (cp.kind === 'waypoint') return cp.done || STRINGS[lang].waypointFallback;
  return schedule.finish.done || STRINGS[lang].expired;
}

function tick() {
  const now = new Date();
  const leg = selectLeg(now, schedule.waypoints, schedule.target);
  const remaining = computeRemaining(now, leg);
  const { expired, h, m, s, ms } = remaining;

  const chars = pad2(h) + pad2(m) + pad2(s);
  for (let i = 0; i < digits.length; i++) {
    digits[i].set(chars[i]);
  }

  for (const reel of reels) {
    reel.update(ms);
  }

  // 발화는 표시 선택과 분리된 checkpoint 별 tracker(alarms)가 담당한다 —
  // 표시용 remaining 은 경유지가 지나는 프레임에 이미 다음 구간이라 에지가 없다.
  // ?. 는 preload 로드 실패 시의 유일한 쿠션 — 알림은 조용히 죽지만 rAF 루프는 산다.
  for (const cp of alarms.observe(now)) {
    window.msTimer?.alertExpired(alertText(cp), cp.kind === 'waypoint' ? cp.icon : 'finish');
  }

  // 레벨 채널 — 에지(팝업)와 달리 부팅 첫 틱의 전송이 정답이다 (spec §4).
  // 구간 기준이므로 경유지 10분 전에도 imminent 가 된다 (pet 기대 모드).
  const state = timerStateOf(remaining);
  if (state !== lastSentState) {
    lastSentState = state;
    window.msTimer?.sendTimerState(state);
  }

  // 구간 전환(경유지 통과·일정 커밋·자정 롤오버) — 제목과 헤더 뱃지가 함께 따라간다.
  const key = `${leg.kind}:${leg.h}:${leg.m}:${leg.run ?? ''}:${leg.icon ?? ''}`;
  if (key !== legKey) {
    legKey = key;
    currentLeg = leg;
    titleBadgeEl.src = ICON_SRC[leg.kind === 'waypoint' ? leg.icon : 'finish'];
    titleBadgeEl.hidden = false; // 첫 틱 전 깨진 이미지 방지 — src 확정 후 노출
    applyTitle();
  }

  // alarms 는 lastExpired 를 절대 건드리지 않는다 — lastExpired 는 DOM
  // (.expired 클래스/제목)의 소유자다. 구간 모델에서 expired 는 final 에서만 발생한다.
  if (expired !== lastExpired) {
    clockEl.classList.toggle('expired', expired);
    lastExpired = expired;
    applyTitle();
  }

  requestAnimationFrame(tick);
}

initTheme();
initPetToggle();
applyTitle();
requestAnimationFrame(tick);

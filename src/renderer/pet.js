import { daypartOf } from '../lib/daypart.js';
import { selectPetAnimation } from '../lib/pet-state.js';
import { adjustOpacity, normalizeOpacity } from '../lib/pet-opacity.js';
import { initSprite, applyRow } from './pet-sprite.js';

const POS_KEY = 'ms-timer:pet-pos';
const OPACITY_KEY = 'ms-timer:pet-opacity';
const DAYPART_CHECK_MS = 30_000;

const cat = document.getElementById('cat');

let timerState = 'running'; // main 캐시 push(did-finish-load)가 곧 갱신한다
let interacting = false;
let daypart = daypartOf(new Date());
/** main 의 pet:position echo 로만 초기화 — 드래그 기준점. echo 전 드래그는 무시된다. */
let currentPos = null;
let dragging = false;

/** theme.js 관용 — localStorage 차단 환경에서는 세션 전용으로 동작한다. */
function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}
function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 영속화 불가 — 세션 전용
  }
}

function render() {
  applyRow(selectPetAnimation({ interacting, timerState, daypart }));
}

// --- opacity: 호버 중 휠로만 조절 (통과 해제 상태라 휠이 도달한다) ---
let opacity = normalizeOpacity(readStored(OPACITY_KEY));
cat.style.opacity = String(opacity);
cat.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault(); // 하부 창 스크롤로 새지 않게 — 의도된 소비 (spec §7)
    opacity = adjustOpacity(opacity, e.deltaY < 0 ? 1 : -1);
    cat.style.opacity = String(opacity);
    writeStored(OPACITY_KEY, opacity);
  },
  { passive: false },
);

// --- 클릭 통과: 고양이 위에서만 실체화 ---
cat.addEventListener('mouseenter', () => {
  interacting = true;
  window.petBridge?.setClickThrough(false);
  render();
});
cat.addEventListener('mouseleave', () => {
  interacting = false;
  // 드래그 중 이탈은 통과를 켜면 안 된다 — pointerup 재판정이 처리 (spec §3)
  if (!dragging) window.petBridge?.setClickThrough(true);
  render();
});

// --- 드래그: screen 좌표 델타 → 절대 위치 전송 ---
let startScreen = null;
let startPos = null;

function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  cat.releasePointerCapture(e.pointerId);
  writeStored(POS_KEY, currentPos);
  // 포인터가 고양이 밖에서 떨어졌으면 유령 모드 복귀
  const over = document.elementFromPoint(e.clientX, e.clientY);
  const stillOnCat = over === cat || cat.contains(over);
  interacting = stillOnCat;
  window.petBridge?.setClickThrough(!stillOnCat);
  render();
}

cat.addEventListener('pointerdown', (e) => {
  if (currentPos === null) return; // echo 전 — 기준점이 없다
  dragging = true;
  startScreen = { x: e.screenX, y: e.screenY };
  startPos = { ...currentPos };
  cat.setPointerCapture(e.pointerId);
});
cat.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  currentPos = {
    x: Math.round(startPos.x + (e.screenX - startScreen.x)),
    y: Math.round(startPos.y + (e.screenY - startScreen.y)),
  };
  window.petBridge?.setPosition(currentPos);
});
cat.addEventListener('pointerup', endDrag);
cat.addEventListener('pointercancel', endDrag);

// --- 브리지 구독 ---
window.petBridge?.onTimerState((state) => {
  timerState = state;
  render();
});
window.petBridge?.onPosition((pos) => {
  currentPos = pos;
});

// --- daypart: 30초 폴링 — 자정 경계 포함 전환 감지 ---
setInterval(() => {
  const next = daypartOf(new Date());
  if (next !== daypart) {
    daypart = next;
    render();
  }
}, DAYPART_CHECK_MS);

// --- boot: sprite → 첫 렌더 → 위치 복원(표시 게이트) 순서 고정 ---
initSprite(cat);
render();
window.petBridge?.restorePosition(readStored(POS_KEY));

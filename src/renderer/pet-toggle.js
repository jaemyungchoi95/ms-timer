const STORAGE_KEY = 'ms-timer:pet';

/** 기본 ON — 저장값이 정확히 'off' 일 때만 꺼진 상태로 시작한다. */
function readEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeEnabled(on) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // 영속화 불가 — 세션 전용으로 동작한다 (theme.js 관용)
  }
}

/**
 * P 키로 pet 창을 토글한다. rAF 루프 시작 전에 1회 호출.
 * 편집기가 열려 있으면 keydown 이 여기까지 오지 않는다 — theme.js 의 T 키와
 * 같은 이유(편집기 컨테이너의 전파 차단)로 별도 가드가 필요 없다.
 */
export function initPetToggle() {
  let enabled = readEnabled();
  window.msTimer?.setPetVisible(enabled);

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'p' && e.key !== 'P') return;
    enabled = !enabled;
    writeEnabled(enabled);
    window.msTimer?.setPetVisible(enabled);
  });
}

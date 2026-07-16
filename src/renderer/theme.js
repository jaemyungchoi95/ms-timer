const THEMES = ['dark', 'retro'];
const STORAGE_KEY = 'ms-timer:theme';

/**
 * Electron 43은 file:// origin에서 localStorage를 허용함이 실측으로 확인됨(2026-07-15).
 * try/catch는 차단되는 환경을 위한 fallback으로 유지 — 그 경우 세션 전용 토글로 동작한다.
 */
function readTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(saved) ? saved : THEMES[0];
  } catch {
    return THEMES[0];
  }
}

function writeTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 영속화 불가 — 세션 전용으로 동작한다
  }
}

/** T 키로 테마를 순환시킨다. rAF 루프 시작 전에 1회 호출한다. */
export function initTheme() {
  let current = readTheme();
  document.documentElement.dataset.theme = current;

  window.addEventListener('keydown', (e) => {
    if (e.key !== 't' && e.key !== 'T') return;
    // 목표 시각 입력 중에는 테마를 바꾸지 않는다 — 입력칸에서 T 를 치면
    // 글자는 안 들어가는데(숫자만 허용) 테마만 바뀌는 것을 막는다.
    if (e.target instanceof HTMLInputElement) return;
    current = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    document.documentElement.dataset.theme = current;
    writeTheme(current);
  });
}

const THEMES = ['dark', 'retro'];
const STORAGE_KEY = 'ms-timer:theme';

/**
 * localStorage는 Electron의 file:// origin에서 막힐 수 있다.
 * 막히면 세션 전용 토글로 동작한다 — 기능은 유지된다.
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
    current = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    document.documentElement.dataset.theme = current;
    writeTheme(current);
  });
}

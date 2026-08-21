import { LANGS, STRINGS } from '../lib/strings.js';

// 본창과 같은 file:// origin — localStorage 를 공유한다.
// 아래 읽기 2개는 각 소유 모듈(theme.js/lang.js)의 규칙 복제다.
// 팝업 문구는 더 이상 여기서 결정하지 않는다 — renderer(clock.js)가 결정해
// main 경유 URL query 로 전달한다 (경유지/최종 문구의 단일 소스).

function readTheme() {
  try {
    const saved = localStorage.getItem('ms-timer:theme');
    return ['dark', 'retro'].includes(saved) ? saved : 'dark';
  } catch {
    return 'dark';
  }
}

function readLang() {
  try {
    const saved = localStorage.getItem('ms-timer:lang');
    if (LANGS.includes(saved)) return saved;
  } catch {
    // 세션 전용
  }
  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

/** main.js 의 검증 상한과 같은 값 — query 훼손 시 기본 문구 폴백. */
const TEXT_MAX = 40;

document.documentElement.dataset.theme = readTheme();
const lang = readLang();
document.documentElement.lang = lang;

const text = new URLSearchParams(location.search).get('text');
// textContent 삽입만 — 마크업 해석 없음.
document.getElementById('message').textContent =
  text !== null && text.length > 0 && text.length <= TEXT_MAX ? text : STRINGS[lang].expired;

const okBtn = document.getElementById('ok');
okBtn.textContent = lang === 'ko' ? '확인' : 'OK';
okBtn.addEventListener('click', () => window.close());

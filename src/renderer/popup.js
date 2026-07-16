import { normalizeLabel } from '../lib/label.js';
import { LANGS, STRINGS } from '../lib/strings.js';

// 본창과 같은 file:// origin — localStorage 를 공유한다.
// 아래 읽기 3개는 각 소유 모듈(theme.js/lang.js/label-editor.js)의 규칙 복제다.
// 게이트가 localStorage 를 읽는 이상 lib 로 옮길 수 없어 복제가 의도된 설계다 —
// 특히 라벨의 both-valid 게이트를 절대 단순화하지 말 것: label-done 만 읽으면
// 본창은 기본 문구로 폴백한 반쪽-손상 상태에서 팝업만 커스텀을 보여주게 된다.

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

function readDoneLabel(lang) {
  try {
    const run = normalizeLabel(localStorage.getItem('ms-timer:label-run'));
    const done = normalizeLabel(localStorage.getItem('ms-timer:label-done'));
    if (run !== null && done !== null) return done; // both-valid 게이트
  } catch {
    // 폴백으로
  }
  return STRINGS[lang].expired;
}

document.documentElement.dataset.theme = readTheme();
const lang = readLang();
document.documentElement.lang = lang;
document.getElementById('message').textContent = readDoneLabel(lang);

const okBtn = document.getElementById('ok');
okBtn.textContent = lang === 'ko' ? '확인' : 'OK';
okBtn.addEventListener('click', () => window.close());

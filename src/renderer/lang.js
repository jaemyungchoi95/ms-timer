import { LANGS, STRINGS } from '../lib/strings.js';

const STORAGE_KEY = 'ms-timer:lang';

/** 저장값 우선, 없거나 손상이면 OS 언어 추정 (ko* → ko, 그 외 → en). */
function readLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    // 세션 전용으로 동작한다
  }
  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

function writeLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 영속화 불가 — 세션 전용으로 동작한다
  }
}

/**
 * data-l10n 속성이 붙은 요소들의 aria-label(+ placeholder 가 있으면 그것도)과
 * html[lang] 을 일괄 갱신한다.
 */
function applyStatic(lang) {
  document.documentElement.lang = lang;
  const s = STRINGS[lang];
  for (const el of document.querySelectorAll('[data-l10n]')) {
    const text = s[el.dataset.l10n];
    el.setAttribute('aria-label', text);
    if (el.hasAttribute('placeholder')) el.setAttribute('placeholder', text);
  }
}

/**
 * L 키로 언어를 순환시킨다. 초기 언어를 반환하고 전환 시 onChange(lang)를 호출한다.
 * 제목 문구는 clock.js 의 applyTitle 소관 — 여기서는 건드리지 않는다.
 * 편집기(target/label)가 열려 있으면 stopPropagation 때문에 L 이 여기까지 오지 않는다.
 */
export function initLang(onChange) {
  let current = readLang();
  applyStatic(current);

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'l' && e.key !== 'L') return;
    current = LANGS[(LANGS.indexOf(current) + 1) % LANGS.length];
    writeLang(current);
    applyStatic(current);
    onChange(current);
  });

  return current;
}

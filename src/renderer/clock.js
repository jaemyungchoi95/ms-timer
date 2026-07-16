import { computeRemaining } from '../lib/countdown.js';
import { STRINGS } from '../lib/strings.js';
import { FlipDigit } from './flip-digit.js';
import { Reel } from './reel.js';
import { initTheme } from './theme.js';
import { initTargetEditor } from './target-editor.js';
import { initLabelEditor } from './label-editor.js';
import { initLang } from './lang.js';

const clockEl = document.getElementById('clock');
const titleEl = document.getElementById('title');
const titleboxEl = document.getElementById('titlebox');
const targetEl = document.getElementById('target');
const digits = [...document.querySelectorAll('[data-flip]')].map((el) => new FlipDigit(el));

const reels = [
  new Reel(document.querySelector('[data-reel="100"]'), 100, 0),
  new Reel(document.querySelector('[data-reel="10"]'), 10, 1),
  new Reel(document.querySelector('[data-reel="1"]'), 1, 3),
];

const pad2 = (n) => String(n).padStart(2, '0');

let lastExpired = null;
let target = initTargetEditor(targetEl, (next) => { target = next; });
// onChange 콜백들은 사용자 입력에서만 불리므로(동기 초기화 중엔 안 불림) TDZ 안전 —
// initTargetEditor 의 기존 패턴과 동일하다.
let labels = initLabelEditor(titleboxEl, (next) => { labels = next; applyTitle(); });
let lang = initLang((next) => { lang = next; applyTitle(); });

/**
 * 제목 문구를 쓰는 유일한 함수. 우선순위: 커스텀 라벨 ?? 언어별 기본 문구.
 * document.title 도 함께 — 작업표시줄이 상태를 따라간다 (기존 버그 수정).
 */
function applyTitle() {
  const s = labels ?? { run: STRINGS[lang].countdown, done: STRINGS[lang].expired };
  const text = lastExpired === true ? s.done : s.run;
  titleEl.textContent = text;
  document.title = text;
}

function tick() {
  const { expired, h, m, s, ms } = computeRemaining(new Date(), target);

  const chars = pad2(h) + pad2(m) + pad2(s);
  for (let i = 0; i < digits.length; i++) {
    digits[i].set(chars[i]);
  }

  for (const reel of reels) {
    reel.update(ms);
  }

  if (expired !== lastExpired) {
    clockEl.classList.toggle('expired', expired);
    lastExpired = expired;
    applyTitle();
  }

  requestAnimationFrame(tick);
}

initTheme();
applyTitle();
requestAnimationFrame(tick);

# 용도별 이름 편집 (커스텀 라벨) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제목 한 쌍(진행/완료)을 사용자가 편집·영속하게 하고, `L` 키 한/영 토글(축소 범위: aria + `html[lang]` + 미편집 시 기본 문구)을 함께 넣는다.

**Architecture:** 표시 우선순위는 `커스텀 라벨 ?? STRINGS[lang] 기본 문구`. 검증은 `src/lib/label.js`의 `normalizeLabel` 하나 — 사용자 입력과 localStorage 복원이 같은 함수를 탄다 (parseTarget 패턴의 반복). 문구를 쓰는 곳은 `clock.js`의 `applyTitle()` 하나뿐이라 4개 트리거(부팅/전이/라벨 변경/언어 변경)가 어긋날 수 없다.

**Tech Stack:** Electron 43, 순수 ESM, `node:test`, 런타임 의존성 0

**설계 스펙:** `docs/superpowers/specs/2026-07-16-custom-labels-design.md` (+ 개정된 `2026-07-16-i18n-toggle-design.md`)

## Global Constraints

- **프로젝트 경로 `/mnt/c/Users/cloocus/ms-timer`**, 브랜치 `feat/custom-labels`.
- **테스트는 WSL node**: `node --test`. npm/electron 은 `cmd.exe /c "..."`.
- **런타임 의존성 0 유지. 순수 ESM. 새 npm 패키지 금지.**
- **`src/lib/`는 DOM/브라우저 API 금지, 모든 로직 + 모든 테스트. `src/renderer/`는 로직 없음, 테스트 없음.**
- **시각 검증(스크린샷/CDP) 없음** — 이번 브랜치는 사용자가 재빌드 후 직접 확인한다. 구현자는 `node --test`와 grep 기반 정적 확인까지만 한다. **Electron 을 띄우지 않는다.**
- 커밋은 conventional commits, 본문 한국어, 트레일러:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
  ```

---

### Task 1: 순수 함수 — strings.js + label.js

**Files:**
- Create: `src/lib/strings.js`
- Create: `src/lib/label.js`
- Test: `test/strings.test.js`, `test/label.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `STRINGS.{ko,en}.{countdown, expired, ariaH10, ariaH1, ariaM10, ariaM1, ariaOk, ariaCancel, ariaLabelRun, ariaLabelDone}` — Task 2가 쓴다
  - `LANGS` — `['ko', 'en']`
  - `normalizeLabel(str) -> string | null` — trim 후 1~12자면 그 문자열, 아니면 null

- [ ] **Step 1: 실패하는 테스트 작성**

`test/label.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLabel } from '../src/lib/label.js';

test('경계 — 1자 유효', () => {
  assert.equal(normalizeLabel('가'), '가');
});

test('경계 — 12자 유효', () => {
  assert.equal(normalizeLabel('일이삼사오육칠팔구십일이'), '일이삼사오육칠팔구십일이');
});

test('경계 — 13자는 null', () => {
  assert.equal(normalizeLabel('일이삼사오육칠팔구십일이삼'), null);
});

test('앞뒤 공백은 trim 되어 유효', () => {
  assert.equal(normalizeLabel('  회의까지  '), '회의까지');
});

test('trim 후 12자면 유효 — 공백이 상한을 잡아먹지 않는다', () => {
  assert.equal(normalizeLabel(' 일이삼사오육칠팔구십일이 '), '일이삼사오육칠팔구십일이');
});

test('공백만이면 null', () => {
  assert.equal(normalizeLabel('   '), null);
});

test('빈 문자열은 null', () => {
  assert.equal(normalizeLabel(''), null);
});

test('문자열이 아니면 null', () => {
  assert.equal(normalizeLabel(null), null);
  assert.equal(normalizeLabel(undefined), null);
  assert.equal(normalizeLabel(42), null);
});

test('라틴/혼합 문자열 유효', () => {
  assert.equal(normalizeLabel('TIME TO GO'), 'TIME TO GO');
  assert.equal(normalizeLabel('마감 D-day'), '마감 D-day');
});
```

`test/strings.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, LANGS } from '../src/lib/strings.js';

test('LANGS 는 STRINGS 의 키와 일치한다', () => {
  assert.deepEqual(LANGS, Object.keys(STRINGS));
});

test('모든 로케일의 키 집합이 동일하다 — 한쪽에만 문자열을 추가하면 여기서 깨진다', () => {
  const [first, ...rest] = LANGS;
  const reference = Object.keys(STRINGS[first]).sort();
  for (const lang of rest) {
    assert.deepEqual(Object.keys(STRINGS[lang]).sort(), reference);
  }
});

test('빈 문자열이 없다', () => {
  for (const lang of LANGS) {
    for (const [key, value] of Object.entries(STRINGS[lang])) {
      assert.equal(typeof value, 'string', `${lang}.${key}`);
      assert.ok(value.length > 0, `${lang}.${key} 가 비어 있다`);
    }
  }
});

test('제목 기본 문구가 normalizeLabel 상한(12자) 안에 있다 — 기본값이 커스텀 규칙을 위반하면 안 된다', async () => {
  const { normalizeLabel } = await import('../src/lib/label.js');
  for (const lang of LANGS) {
    assert.equal(normalizeLabel(STRINGS[lang].countdown), STRINGS[lang].countdown);
    assert.equal(normalizeLabel(STRINGS[lang].expired), STRINGS[lang].expired);
  }
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test test/label.test.js test/strings.test.js`

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: 구현**

`src/lib/label.js`:

```js
/**
 * 라벨 정규화. trim 후 1~12자면 그 문자열, 아니면 null.
 *
 * 사용자 입력과 localStorage 복원값이 모두 이 함수를 탄다 —
 * 검증 규칙은 여기에만 존재한다 (parseTarget 과 같은 단일 경로 원칙).
 * 12자는 "말줄임 없이 항상 안전"이 아니라 입력 폭주 상한이다.
 * 픽셀 기반 방어는 CSS 의 max-width + ellipsis 가 맡는다.
 */
export function normalizeLabel(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim();
  return s.length >= 1 && s.length <= 12 ? s : null;
}
```

`src/lib/strings.js`:

```js
/** 언어별 UI 문자열. 키 집합은 모든 로케일에서 동일해야 한다 — 테스트가 고정한다. */
export const STRINGS = {
  ko: {
    countdown: '퇴근까지',
    expired: '퇴근',
    ariaH10: '시 십의 자리',
    ariaH1: '시 일의 자리',
    ariaM10: '분 십의 자리',
    ariaM1: '분 일의 자리',
    ariaOk: '확정',
    ariaCancel: '취소',
    ariaLabelRun: '진행 문구',
    ariaLabelDone: '완료 문구',
  },
  en: {
    countdown: 'TIME TO GO',
    expired: 'GO HOME',
    ariaH10: 'hours, tens digit',
    ariaH1: 'hours, ones digit',
    ariaM10: 'minutes, tens digit',
    ariaM1: 'minutes, ones digit',
    ariaOk: 'confirm',
    ariaCancel: 'cancel',
    ariaLabelRun: 'countdown label',
    ariaLabelDone: 'finished label',
  },
};

export const LANGS = Object.keys(STRINGS);
```

- [ ] **Step 4: 통과 확인**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test`

Expected: `# pass 52`, `# fail 0` (기존 39 + label 9 + strings 4)

- [ ] **Step 5: 커밋**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git add src/lib/strings.js src/lib/label.js test/strings.test.js test/label.test.js && git commit -m "$(cat <<'EOF'
feat: 라벨 정규화 + 언어별 문자열 순수 모듈

normalizeLabel 하나가 단일 검증 경로 — 사용자 입력과 localStorage
복원이 같은 함수를 탄다. strings 테스트가 ko/en 키 대칭을 고정해
한쪽에만 문자열을 추가하면 테스트가 깨진다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
EOF
)"
```

---

### Task 2: 이름 편집기 + L 토글 + clock 배선 + README

**Files:**
- Create: `src/renderer/label-editor.js`, `src/renderer/lang.js`
- Modify: `src/renderer/index.html`, `src/renderer/clock.js`, `src/renderer/style.css`, `README.md`

**Interfaces:**
- Consumes: Task 1의 `STRINGS`/`LANGS`/`normalizeLabel`; 기존 `--input-*`/`--title-fg` 테마 토큰; target-editor가 확립한 stopPropagation 계약
- Produces: 없음 (최종 태스크. 단, 알림 팝업 브랜치가 `ms-timer:label-done` 키와 `normalizeLabel` 복원 규칙을 쓸 예정)

- [ ] **Step 1: index.html — 제목을 편집 가능 구조로**

`<header class="header">` 안의 `<h1 id="title" class="title">퇴근까지</h1>` 을 아래로 교체:

```html
          <div class="titlebox" id="titlebox">
            <h1 class="title-wrap" data-label-display>
              <button id="title" class="title" type="button" data-label-trigger>퇴근까지</button>
            </h1>
            <div class="label-edit" data-label-edit hidden>
              <input class="label-input" type="text" maxlength="12" aria-label="진행 문구" placeholder="진행 문구" data-l10n="ariaLabelRun" data-label-run />
              <input class="label-input" type="text" maxlength="12" aria-label="완료 문구" placeholder="완료 문구" data-l10n="ariaLabelDone" data-label-done />
              <button class="target-btn" type="button" aria-label="확정" data-l10n="ariaOk" data-label-ok>✓</button>
              <button class="target-btn" type="button" aria-label="취소" data-l10n="ariaCancel" data-label-cancel>↻</button>
            </div>
```

placeholder 가 있는 이유: 커스텀이 없을 때 편집을 열면 두 칸이 모두 비는데, aria-label 은 눈에 보이지 않아 어느 칸이 진행/완료인지 알 수 없다. placeholder 는 `applyStatic` 이 aria-label 과 함께 언어 전환한다 (Step 3 참조).

```html
          </div>
```

구조 근거: `button` 은 phrasing content 라 `h1` 안에 들어갈 수 있지만 역방향(`button > h1`)은 invalid HTML 이다. `#title` 이 이제 버튼이므로 `clock.js` 의 `titleEl.textContent` 는 그대로 동작한다.

그리고 기존 target-editor 의 입력/버튼 6개에 `data-l10n` 속성을 추가한다 (aria-label 은 폴백으로 유지):

```html
              <input class="cell" type="text" inputmode="numeric" maxlength="1" aria-label="시 십의 자리" data-l10n="ariaH10" data-cell />
              <input class="cell" type="text" inputmode="numeric" maxlength="1" aria-label="시 일의 자리" data-l10n="ariaH1" data-cell />
              <span class="cell-sep">:</span>
              <input class="cell" type="text" inputmode="numeric" maxlength="1" aria-label="분 십의 자리" data-l10n="ariaM10" data-cell />
              <input class="cell" type="text" inputmode="numeric" maxlength="1" aria-label="분 일의 자리" data-l10n="ariaM1" data-cell />
              <button class="target-btn" type="button" aria-label="확정" data-l10n="ariaOk" data-target-ok>✓</button>
              <button class="target-btn" type="button" aria-label="취소" data-l10n="ariaCancel" data-target-cancel>↻</button>
```

- [ ] **Step 2: label-editor.js**

`src/renderer/label-editor.js` 생성:

```js
import { normalizeLabel } from '../lib/label.js';

const KEY_RUN = 'ms-timer:label-run';
const KEY_DONE = 'ms-timer:label-done';

/**
 * 복원은 둘 다 유효할 때만 커스텀으로 인정한다 — 반쪽 커스텀은 존재하지 않는다.
 * 한쪽만 손상되면 둘 다 무시하고 기본 문구로 폴백.
 */
function readLabels() {
  try {
    const run = normalizeLabel(localStorage.getItem(KEY_RUN));
    const done = normalizeLabel(localStorage.getItem(KEY_DONE));
    return run !== null && done !== null ? { run, done } : null;
  } catch {
    return null;
  }
}

function writeLabels(labels) {
  try {
    if (labels === null) {
      localStorage.removeItem(KEY_RUN);
      localStorage.removeItem(KEY_DONE);
    } else {
      localStorage.setItem(KEY_RUN, labels.run);
      localStorage.setItem(KEY_DONE, labels.done);
    }
  } catch {
    // 영속화 불가 — 세션 전용으로 동작한다
  }
}

/**
 * 제목(진행/완료 문구 쌍) 표시/편집.
 * 초기 라벨({run, done} | null)을 반환하고, 확정 시 onChange(labels | null)를 호출한다.
 * null 은 "커스텀 없음 — 언어별 기본 문구 사용"이다.
 */
export function initLabelEditor(root, onChange) {
  const display = root.querySelector('[data-label-display]');
  const trigger = root.querySelector('[data-label-trigger]');
  const edit = root.querySelector('[data-label-edit]');
  const runInput = root.querySelector('[data-label-run]');
  const doneInput = root.querySelector('[data-label-done]');
  const okBtn = root.querySelector('[data-label-ok]');
  const cancelBtn = root.querySelector('[data-label-cancel]');

  let current = readLabels();

  /**
   * 유효 상태 3가지: 커스텀({run,done}) / 리셋(null — 두 칸 모두 공백) / 무효(undefined).
   * 두 칸 모두 공백 + ✓ 는 "기본 문구로 되돌리기" 경로다 — 빈 제목이라는 상태는 없다.
   */
  function validate() {
    const run = normalizeLabel(runInput.value);
    const done = normalizeLabel(doneInput.value);
    const bothBlank = runInput.value.trim() === '' && doneInput.value.trim() === '';
    const valid = (run !== null && done !== null) || bothBlank;
    okBtn.disabled = !valid;
    edit.classList.toggle('invalid', !valid);
    if (!valid) return undefined;
    return bothBlank ? null : { run, done };
  }

  function showDisplay() {
    display.hidden = false;
    edit.hidden = true;
  }

  function showEdit() {
    runInput.value = current?.run ?? '';
    doneInput.value = current?.done ?? '';
    display.hidden = true;
    edit.hidden = false;
    validate();
    runInput.focus();
    runInput.select();
  }

  function commit() {
    const result = validate();
    if (result === undefined) return;
    current = result;
    writeLabels(current);
    onChange(current);
    showDisplay();
  }

  // Enter/Escape 는 편집기 전역, 그리고 keydown 전파를 여기서 끊는다 —
  // target-editor 와 같은 계약: 편집 중 T/L 이 테마/언어를 바꾸지 못한다.
  edit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') showDisplay();
    e.stopPropagation();
  });

  for (const input of [runInput, doneInput]) {
    input.addEventListener('input', validate);
  }

  trigger.addEventListener('click', showEdit);
  okBtn.addEventListener('click', commit);
  cancelBtn.addEventListener('click', showDisplay);

  showDisplay();
  return current;
}
```

- [ ] **Step 3: lang.js**

`src/renderer/lang.js` 생성:

```js
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
```

- [ ] **Step 4: clock.js — applyTitle 단일 함수로 배선**

`src/renderer/clock.js` 전체를 아래로 교체:

```js
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
```

주의: 전이 블록에서 `lastExpired = expired` 가 `applyTitle()` **앞**이다 — applyTitle 이 `lastExpired` 를 읽는다. 부팅 시 `applyTitle()` 은 `lastExpired === null` 이라 진행 문구를 쓰지만, 첫 tick 이 가드(`expired !== null`)를 반드시 통과해 첫 페인트 전에 정정한다.

- [ ] **Step 5: style.css — 제목 버튼 리셋 + 편집 폼**

`.title` 규칙을 아래로 교체 (버튼이 되었으므로 리셋 추가):

```css
.title {
  font: inherit;
  font-size: calc(var(--card-h) * 0.42);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--title-fg);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  /* 긴 커스텀 이름 + target 편집기 열림의 코너 케이스 방어 — 실측 임계는 스펙 참조 */
  max-width: calc(var(--card-h) * 5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

`.title` 규칙 다음에 추가:

```css
.title-wrap {
  display: flex;
  justify-content: center;
}

/* target 편집기가 열린 동안만 제목을 더 조인다 — 실측 임계: 표시 모드 ≈244px(=card-h×5.08),
   편집기 열림 ≈155px(=card-h×3.23). 기본 max-width(×5)는 표시 모드만 방어하므로,
   편집기 열림이라는 짧은 순간에는 :has() 로 임계 아래까지 말줄임한다. 닫으면 온전히 복귀. */
.header:has(.target-edit:not([hidden])) .title {
  max-width: calc(var(--card-h) * 3.1);
}

.label-edit {
  display: flex;
  align-items: center;
  gap: calc(var(--card-h) * 0.06);
}

.label-edit[hidden] {
  display: none;
}

.label-input {
  width: calc(var(--card-h) * 1.6);
  height: calc(var(--card-h) * 0.34);
  padding: 0 calc(var(--card-h) * 0.06);
  font-family: inherit;
  font-size: calc(var(--card-h) * 0.17);
  font-weight: 600;
  color: var(--input-fg);
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: calc(var(--card-h) * 0.03);
  outline: none;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.label-input:focus {
  border-color: var(--title-fg);
}

.label-edit.invalid .label-input {
  border-color: var(--input-border-invalid);
}
```

테마 토큰(`--input-*`)은 target-editor 가 이미 양 테마에 정의했다 — 새 색을 만들지 않는다. `[hidden]` 명시 오버라이드는 `.target-edit` 과 같은 이유 (UA 의 `display:none` 이 `display:flex` 에 진다).

- [ ] **Step 6: README — 조작부 갱신**

`README.md` 의 "## 조작" 섹션 목록에 추가 (목표 시각 항목 다음):

```markdown
- **제목 클릭** — 타이머 이름 한 쌍(진행 중 / 완료)을 용도에 맞게 바꾼다.
  예: "회의까지 / 회의 시작", "마감까지 / 마감!". Enter/`✓` 확정, Esc/`↻` 취소.
  두 칸을 모두 비우고 확정하면 기본 문구로 돌아간다.
- **`L`** — 언어 전환 (한국어 ↔ English). 기본 문구와 접근성 라벨에만 적용되고,
  직접 지은 이름은 건드리지 않는다. 첫 실행 언어는 OS 언어를 따른다.
```

그리고 "목표 시각과 테마는 다음 실행에도 기억된다" 문장을 "목표 시각·테마·이름·언어는 다음 실행에도 기억된다"로 교체.

- [ ] **Step 7: 정적 확인 (Electron 실행 없이)**

```bash
cd /mnt/c/Users/cloocus/ms-timer && grep -c "data-l10n" src/renderer/index.html
```
Expected: `10` (target-editor 6 + label-editor 4)

```bash
cd /mnt/c/Users/cloocus/ms-timer && grep -n "textContent\|document.title" src/renderer/clock.js
```
Expected: `applyTitle` 안의 2줄만 — 문구를 쓰는 곳이 단일 함수임을 확인

```bash
cd /mnt/c/Users/cloocus/ms-timer && grep -rn "퇴근" src/renderer/*.js
```
Expected: **0건** — 렌더러 JS 에 하드코딩 문구가 남아 있으면 안 된다 (문구는 strings.js 와 index.html 폴백에만)

- [ ] **Step 8: 테스트**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test`

Expected: `# pass 52`, `# fail 0`

- [ ] **Step 9: 커밋**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git add src/renderer/ README.md && git commit -m "$(cat <<'EOF'
feat: 용도별 이름 편집 + L 키 언어 토글

제목 클릭 → 진행/완료 문구 한 쌍 편집, localStorage 영속. 표시 우선순위는
커스텀 ?? 언어별 기본 문구. 두 칸을 모두 비우고 확정하면 기본 복귀.

문구를 쓰는 곳은 applyTitle 하나 — 부팅/전이/라벨 변경/언어 변경 4개
트리거가 흩어져도 어긋날 수 없다. document.title 도 함께 갱신해
퇴근 후 작업표시줄이 영원히 "퇴근까지"이던 기존 버그를 고쳤다.

편집 중 T/L 무시는 편집기 컨테이너의 stopPropagation 이 처리 —
target-editor 가 확립한 계약의 재사용이라 추가 코드가 없다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
EOF
)"
```

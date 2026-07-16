# 퇴근 알림 팝업 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카운트다운이 목표 시각에 도달하는 **전환 순간에만** 별도 팝업이 뜨고 본 창이 앞으로(raise) 온다.

**Architecture:** 렌더러의 순수 `expiry-tracker`(prev===false 엄격 비교)가 전환을 감지 → preload(`contextBridge`, 단방향 채널 1개) → main 이 raise(`setAlwaysOnTop` — 실측상 유일하게 동작) + 팝업 싱글턴(자동 닫기 타이머는 main 소유). 팝업 문구는 `커스텀 완료 라벨 ?? STRINGS[lang].expired` (both-valid 게이트 복제).

**Tech Stack:** Electron 43, 순수 ESM (**예외: `src/preload.cjs` 1개** — sandboxed preload 는 ESM 불가), `node:test`, 런타임 의존성 0

**설계 스펙:** `docs/superpowers/specs/2026-07-16-clockout-alert-design.md` (개정판 — 실측 결과와 실패 모드 표 포함. 구현 전 필독)

## Global Constraints

- **프로젝트 경로 `/mnt/c/Users/cloocus/ms-timer`**, 브랜치 `feat/clockout-alert`.
- **테스트는 WSL node**: `node --test`. npm/electron 은 `cmd.exe /c "..."`.
- **런타임 의존성 0. 새 npm 패키지 금지.**
- **`src/lib/`는 DOM/브라우저/Electron API 금지, 모든 로직 + 모든 테스트.**
- **ms-timer 앱 자체를 띄우지 않는다.** 사용자 localStorage 오염 전례가 있다. 최종 확인은 사용자가 재빌드 후 직접 한다. Task 1 의 OS 프로브는 **별도 디렉터리의 throwaway 앱**으로만 한다 (같은 디렉터리 Electron 인스턴스는 userData 를 공유해 false negative 를 낸 전례 — 반드시 다른 디렉터리).
- **PowerShell `.ps1` 파일 금지** (`Restricted` 정책). 인라인 `powershell.exe -Command` 만. `-ExecutionPolicy Bypass`/`iex` 시도 금지 — 차단된다.
- **전체 화면 캡처 금지** — 사용자 데스크톱이 찍힌 사고 전례. z-order 검증은 외부 P/Invoke 워크로.
- **`win.isFocused()` 를 검증에 쓰지 않는다** — 외부적으로 BEHIND 인데 true 를 반환하는 것이 실측됐다.
- 커밋 트레일러:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
  ```

---

### Task 1: OS 프로브 4종 (구현 전 필수 — 결과가 Task 3 의 분기를 정한다)

**Files:** 저장소 변경 없음. throwaway 하네스는 `C:\Users\cloocus\AppData\Local\Temp\alertprobe\` 에.

**Interfaces:**
- Consumes: 기존 하네스 `C:\Users\cloocus\AppData\Local\Temp\foctest\` (`Win.cs` P/Invoke z-order 프로브, `micro4.js`), `focblock\` (블로커 앱). 재사용하되 없으면 재작성.
- Produces: 4개 프로브의 PASS/FAIL — Task 3 구현자가 브리프로 받는다.

- [ ] **Step 1: 프로브 1 — 포커스 없는 frameless alwaysOnTop 팝업에서 클릭이 동작하는가**

throwaway 앱: 백그라운드 타이머(예: 8초)로 `{frame:false, alwaysOnTop:true, skipTaskbar:true, show:false}` 팝업 생성 → `ready-to-show` 에서 `showInactive()`. 팝업 HTML 은 버튼 하나 + `window.close()`. 생성 전에 다른 앱(블로커)이 포그라운드를 점유한 상태여야 한다.

검증: 팝업을 `--remote-debugging-port` 로 띄우고 CDP `Input.dispatchMouseEvent`(trusted click)로 버튼을 누른다 → 팝업 프로세스/창이 실제로 닫히는지 외부에서 확인 (`tasklist` 또는 z-order 워크에서 소멸). CDP 클라이언트는 **Windows node** 로 실행 (WSL2 는 Windows 루프백에 ECONNREFUSED).

Expected: 닫힘. **FAIL 이면 Task 3 의 contingency(닫기 IPC 채널 추가)가 활성화된다 — 결과를 명확히 기록할 것.**

- [ ] **Step 2: 프로브 2 — 백그라운드 타이머에서 `restore()` 가 최소화를 푸는가**

throwaway 메인 창을 `minimize()` → 블로커가 포그라운드 → 타이머에서 `restore()+setAlwaysOnTop(true)` → 외부 z-order 워크로 확인. **이번엔 `IsIconic` 필터를 빼고 본다** (이전 프로브는 최소화 창을 제외했다).

Expected: 복원 + rank 0. FAIL 이면 "최소화 시 팝업만 뜨는 저하 모드"를 기록 — 설계상 수용 가능, Task 3 코드는 그대로 두고 README 에만 반영.

- [ ] **Step 3: 프로브 3 — 본창·팝업 둘 다 topmost 일 때 나중 설정이 위인가**

메인 `setAlwaysOnTop(true)` → 팝업 `{alwaysOnTop:true}` 생성 (나중). z-order 워크에서 팝업 rank < 메인 rank (팝업이 위) 확인.

Expected: 팝업이 위. FAIL 이면 Task 3 에서 팝업 표시 후 `popup.moveTop()` 추가.

- [ ] **Step 4: 프로브 4 — raise → 해제가 깨끗한가**

메인 `setAlwaysOnTop(true)` 유지 → 새 앱 실행해도 위에 있는지 → `setAlwaysOnTop(false)` → 새 앱이 덮는지. (이전 실측의 재확인 — A/B 페어.)

Expected: 유지 중 ONTOP, 해제 후 BEHIND.

- [ ] **Step 5: 정리 + 보고**

모든 프로세스 kill (`taskkill` 은 자기가 띄운 PID 만), temp 하네스는 남겨둠(재현용). 4개 결과를 리포트 파일에 PASS/FAIL + 관찰 상세로 기록.

---

### Task 2: 순수 함수 — expiry-tracker

**Files:**
- Create: `src/lib/expiry-tracker.js`
- Test: `test/expiry-tracker.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createExpiryTracker() -> { observe(expired) -> boolean, rebaseline(expired) -> void }` — Task 4 의 clock.js 가 쓴다

- [ ] **Step 1: 실패하는 테스트 작성**

`test/expiry-tracker.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExpiryTracker } from '../src/lib/expiry-tracker.js';

test('진행 → 만료 전환에서 정확히 1회 fire', () => {
  const t = createExpiryTracker();
  assert.equal(t.observe(false), false);
  assert.equal(t.observe(false), false);
  assert.equal(t.observe(true), true);   // 전환
  assert.equal(t.observe(true), false);  // 지속 — 재발화 없음
});

test('첫 관측이 만료면 침묵 — 18:30 에 켠 앱', () => {
  const t = createExpiryTracker();
  assert.equal(t.observe(true), false);
  assert.equal(t.observe(true), false);
});

test('rebaseline(true) 후 만료 관측은 침묵 — 과거 시각을 설정한 경우', () => {
  const t = createExpiryTracker();
  t.observe(false);                       // 09:00, target 18:00 — 진행 중
  t.rebaseline(true);                     // 사용자가 target 을 08:00 으로 변경
  assert.equal(t.observe(true), false);   // 오발화 금지
});

test('rebaseline(false) 후 도달하면 fire — 미래로 재설정 후 재무장', () => {
  const t = createExpiryTracker();
  t.observe(true);                        // 만료 상태
  t.rebaseline(false);                    // target 을 미래로 변경
  assert.equal(t.observe(false), false);
  assert.equal(t.observe(true), true);    // 새 target 도달 — 발화
});

test('자정 롤오버 — 만료 → 진행 → 만료에서 다시 fire (재무장 무제한)', () => {
  const t = createExpiryTracker();
  t.observe(false);
  assert.equal(t.observe(true), true);    // 오늘 18:00
  assert.equal(t.observe(false), false);  // 자정 롤오버로 다시 진행
  assert.equal(t.observe(true), true);    // 내일 18:00 — 다시 발화
});

test('rebaseline 직후 같은 레벨 관측은 전환이 아니다', () => {
  const t = createExpiryTracker();
  t.rebaseline(false);
  assert.equal(t.observe(false), false);
  t.rebaseline(true);
  assert.equal(t.observe(true), false);
});

test('트래커 2개는 독립', () => {
  const a = createExpiryTracker();
  const b = createExpiryTracker();
  a.observe(false);
  assert.equal(a.observe(true), true);
  assert.equal(b.observe(true), false);   // b 는 첫 관측 — 침묵
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test test/expiry-tracker.test.js`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: 구현**

`src/lib/expiry-tracker.js`:

```js
/**
 * 만료 에지 추적 — 카운트다운이 "돌던 중" 목표에 도달한 순간에만 fire.
 *
 * prev 는 3-값: null(관측 없음/재기준 직후) | false(진행 중 관측) | true(만료 관측).
 * `prev === false` 엄격 비교가 load-bearing 이다 — `!prev` 로 쓰면 `!null === true` 라
 * 18:30 에 켠 앱의 첫 프레임에서 오발화한다 (clock.js 의 lastExpired=null 과 같은 함정).
 * null 센티널은 그 조건을 영원히 만족시킬 수 없으므로 launch-into-expired 가
 * 구조적으로 침묵한다.
 */
export function createExpiryTracker() {
  let prev = null;

  return {
    /** 매 프레임 호출. false→true 전환에서만 true 를 반환한다. */
    observe(expired) {
      const fire = prev === false && expired === true;
      prev = expired;
      return fire;
    },

    /**
     * 목표 변경 시 호출자가 새 목표 기준의 현재 레벨을 심는다.
     * 목표가 움직여서 생긴 false→true 는 시간이 흘러서 생긴 것과 레벨만으로
     * 구분할 수 없다 — 그래서 호출자가 심는다.
     */
    rebaseline(expired) {
      prev = expired;
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test`
Expected: `# pass 59`, `# fail 0` (기존 52 + 7)

- [ ] **Step 5: 커밋**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git add src/lib/expiry-tracker.js test/expiry-tracker.test.js && git commit -m "$(cat <<'EOF'
feat: 만료 에지 추적 순수 함수

prev===false 엄격 비교가 핵심 — !prev 로 쓰면 !null===true 라 만료
상태로 켠 앱의 첫 프레임에서 오발화한다. rebaseline 을 트래커 안에
둔 이유는 "목표 변경 시 언제 다시 무장되는가"가 이 기능의 가장
까다로운 로직이라 렌더러가 아니라 테스트 가능한 lib 에 있어야 해서다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
EOF
)"
```

---

### Task 3: preload + main 오케스트레이션 + 팝업

**Files:**
- Create: `src/preload.cjs`, `src/renderer/popup.html`, `src/renderer/popup.js`, `src/renderer/popup.css`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: Task 1 프로브 결과 (브리프에 포함될 것). `STRINGS`/`LANGS`(lib), `normalizeLabel`(lib), localStorage 키 `ms-timer:theme`/`ms-timer:lang`/`ms-timer:label-run`/`ms-timer:label-done`
- Produces: `window.msTimer.alertExpired()` — Task 4 의 clock.js 가 부른다. IPC 채널 `'ms-timer:expired'`.

- [ ] **Step 1: preload**

`src/preload.cjs` 생성:

```js
// 이 파일만 CJS 다. Electron 43 에서 preload 는 sandbox 기본 활성이고
// sandboxed preload 는 ESM 을 로드할 수 없다. sandbox:false 로 돌리면
// ESM 은 되지만 Chromium OS sandbox 를 스타일 때문에 버리는 셈이다.
const { contextBridge, ipcRenderer } = require('electron');

// 단방향 채널 1개, 페이로드 0. 메시지의 존재가 신호의 전부다.
// 역방향(main→renderer)은 없다 — 보낼 것이 없고, contextBridge 의
// 주요 footgun 은 전부 역방향 리스너에 산다.
contextBridge.exposeInMainWorld('msTimer', {
  alertExpired: () => ipcRenderer.send('ms-timer:expired'),
});
```

- [ ] **Step 2: main.js — 전체 교체**

`src/main.js`:

```js
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';

/** 팝업 자동 닫기(ms). 사용자가 클릭하지 않아도 이 시간 뒤 main 이 정리한다. */
const POPUP_TIMEOUT_MS = 60000;

let mainWin = null;
let popup = null;
let popupTimer = null;

function createWindow() {
  mainWin = new BrowserWindow({
    width: 720,
    height: 320,
    minWidth: 420,
    minHeight: 200,
    title: '퇴근까지',
    // themes.css 다크 테마의 --bg와 동일한 값 — 렌더러가 그리기 전 흰 화면 방지용.
    // 메인 프로세스는 렌더러 CSS를 읽을 수 없어 하드코딩 — --bg 변경 시 함께 수정할 것.
    backgroundColor: '#0b0d10',
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs'),
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWin.removeMenu();
  mainWin.loadFile(path.join(import.meta.dirname, 'renderer/index.html'));

  // 본 창이 닫히면 팝업도 동반 파기 — 팝업이 마지막 창으로 남아
  // window-all-closed 를 막는 좀비를 차단한다. 기존 quit 핸들러는 그대로다.
  mainWin.on('closed', () => {
    mainWin = null;
    destroyPopup();
  });
}

/**
 * raise 는 픽셀이지 포커스가 아니다 (2026-07-16 실측: setAlwaysOnTop 계열만
 * 백그라운드 타이머에서 rank 0 에 도달하고 show/focus/moveTop/flashFrame 은
 * 전부 BEHIND). 포커스는 요청 자체를 하지 않는다.
 * flashFrame 은 raise 용이 아니라 자리 비운 사용자용 — 작업표시줄 강조가
 * 사용자가 창을 활성화할 때까지 남는 유일한 신호다.
 */
function raiseMain() {
  if (mainWin === null) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.setAlwaysOnTop(true);
  mainWin.flashFrame(true);
}

/** raise 해제 — 팝업 닫힘(클릭/타임아웃)에서만 호출된다. 영구 고정은 존재하지 않는다. */
function releaseMain() {
  if (mainWin === null) return;
  mainWin.setAlwaysOnTop(false);
}

function destroyPopup() {
  if (popupTimer !== null) {
    clearTimeout(popupTimer);
    popupTimer = null;
  }
  if (popup !== null && !popup.isDestroyed()) popup.destroy();
  popup = null;
}

function openPopup() {
  // replace-not-stack: 재발화(시계 역행 등) 시 겹겹이 쌓지 않는다
  destroyPopup();

  const w = new BrowserWindow({
    width: 320,
    height: 160,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#0b0d10',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // preload 없음 — 팝업은 window.close() 로 닫히므로 채널이 필요 없다
    },
  });
  popup = w;

  // 자동 닫기는 생성 시점에 무장한다. ready-to-show 에 걸면 첫 페인트 전에
  // 행이 걸린 렌더러가 영원히 산다 — render-process-gone 은 crash 만 잡는다.
  // identity guard 가 콜백 전체를 감싼다 — 옛 팝업의 늦은 이벤트가
  // 새 팝업이 떠 있는 동안 releaseMain 을 불러 raise 를 풀면 안 된다.
  popupTimer = setTimeout(() => {
    if (popup !== w) return;
    destroyPopup();
    releaseMain();
  }, POPUP_TIMEOUT_MS);

  // identity guard: 옛 팝업의 늦은 closed 가 새 팝업의 참조/타이머를 지우면 안 된다
  w.on('closed', () => {
    if (popup !== w) return;
    if (popupTimer !== null) {
      clearTimeout(popupTimer);
      popupTimer = null;
    }
    popup = null;
    releaseMain();
  });

  const dismiss = () => {
    if (popup !== w) return;
    destroyPopup();
    releaseMain();
  };
  w.webContents.on('render-process-gone', dismiss);
  w.webContents.on('did-fail-load', dismiss);

  w.removeMenu(); // per-window — 본 창의 호출은 상속되지 않는다

  w.once('ready-to-show', () => {
    if (w.isDestroyed()) return;
    // 커서가 있는 디스플레이의 workArea 중앙 — 백그라운드 트리거에서
    // "사용자가 보는 모니터"의 최선 근사. center:true 는 포커스된 창의
    // 모니터로 가서 틀린다. workArea 라 작업표시줄을 피한다.
    const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    w.setPosition(
      Math.round(workArea.x + (workArea.width - 320) / 2),
      Math.round(workArea.y + (workArea.height - 160) / 2),
    );
    w.showInactive(); // 활성화를 요청하지 않는다 — Windows 의 거부에 기대지 않고 아예 안 묻는다
  });

  w.loadFile(path.join(import.meta.dirname, 'renderer/popup.html'));
}

ipcMain.on('ms-timer:expired', () => {
  raiseMain();
  openPopup();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
```

**프로브 결과 반영 지점:** 프로브 3 이 FAIL 이면 `showInactive()` 다음 줄에 `w.moveTop();` 추가. 프로브 1 이 FAIL 이면 팝업에도 preload 를 주고 닫기 IPC(`'ms-timer:dismiss'`)를 추가 — 브리프의 프로브 결과를 확인하고 해당 분기만 반영할 것.

- [ ] **Step 3: 팝업 HTML/CSS/JS**

`src/renderer/popup.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>알림</title>
    <link rel="stylesheet" href="themes.css" />
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <main class="popup">
      <div id="message" class="popup-message">퇴근</div>
      <button id="ok" class="popup-ok" type="button">확인</button>
    </main>
    <script type="module" src="popup.js"></script>
  </body>
</html>
```

`src/renderer/popup.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
  font-family: "Segoe UI", system-ui, sans-serif;
  user-select: none;
  -webkit-user-select: none;
  cursor: default;
}

.popup {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  /* frameless 라 드래그 이동 불가가 기본 — 이 창은 60초짜리라 이동이 필요 없다 */
}

.popup-message {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  /* 카드 토큰이 아니라 accent — 본창의 만료 상태와 같은 색 언어 */
  color: var(--accent);
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popup-ok {
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  padding: 0.4rem 1.6rem;
  color: var(--card-fg);
  background: var(--card-bg);
  border: 1px solid var(--input-border);
  border-radius: 0.4rem;
  cursor: pointer;
}
```

`src/renderer/popup.js`:

```js
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
```

**주의:** `확인`/`OK` 를 STRINGS 에 추가하지 않는 이유 — STRINGS 는 본창 aria/제목용이고, 키를 추가하면 strings.test.js 의 키 대칭 테스트가 양쪽에 요구한다. 팝업 전용 문자열 1개를 위해 전역 사전을 키우지 않는다. (리뷰에서 이견 있으면 논의.)

- [ ] **Step 4: 문법 확인 (Electron 실행 없이)**

```bash
cd /mnt/c/Users/cloocus/ms-timer && node --check src/main.js && node --check src/renderer/popup.js && node --check src/preload.cjs && echo OK
```
Expected: `OK`

```bash
cd /mnt/c/Users/cloocus/ms-timer && node --test
```
Expected: `# pass 59`, `# fail 0`

`package.json` 의 `"files": ["src/**/*", "package.json"]` 글롭이 preload.cjs 와 popup.* 을 이미 포함하는지 확인:

```bash
cd /mnt/c/Users/cloocus/ms-timer && grep -n '"files"' package.json
```
Expected: `"files": ["src/**/*", "package.json"]` — src/ 아래 신규 파일 전부 커버, 수정 불필요.

- [ ] **Step 5: 커밋**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git add src/preload.cjs src/main.js src/renderer/popup.html src/renderer/popup.css src/renderer/popup.js && git commit -m "$(cat <<'EOF'
feat: 만료 알림 — preload 채널 + main 오케스트레이션 + 팝업 창

raise 는 픽셀이지 포커스가 아니다 — 실측상 setAlwaysOnTop 계열만
백그라운드 타이머에서 rank 0 에 도달한다. 포커스는 요청하지 않는다
(showInactive). 팝업은 키보드를 영원히 못 받으므로 닫기는 클릭과
main 소유 60초 타이머뿐이다.

싱글턴 identity guard(옛 팝업의 늦은 closed 가 새 참조를 지우는 race),
생성 시점 타이머 무장(pre-paint 행 방어), 본창 closed 시 팝업 동반
파기(좀비 차단)를 전부 넣었다.

preload.cjs 는 저장소 유일의 CJS — sandboxed preload 는 ESM 불가이고
sandbox 를 끄는 것은 스타일을 위해 OS sandbox 를 버리는 짓이다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
EOF
)"
```

---

### Task 4: clock.js 배선 + README

**Files:**
- Modify: `src/renderer/clock.js`, `README.md`

**Interfaces:**
- Consumes: Task 2 의 `createExpiryTracker`, Task 3 의 `window.msTimer.alertExpired()`

- [ ] **Step 1: clock.js 배선**

import 블록에 추가:

```js
import { createExpiryTracker } from '../lib/expiry-tracker.js';
```

`let lastExpired = null;` 아래(기존 `let target = ...` 줄을 아래로 교체):

```js
const tracker = createExpiryTracker();
let target = initTargetEditor(targetEl, (next) => {
  target = next;
  // 커밋 순간 동기 재기준 — 다음 틱을 기다리면 17:59:59.995 에 커밋된
  // 목표 변경이 18:00 의 전환을 삼키거나 오발화한다.
  tracker.rebaseline(computeRemaining(new Date(), next).expired);
});
```

`tick()` 의 expired 전이 블록 **바깥**, reel 루프 다음에 추가:

```js
  // tracker 는 lastExpired 를 절대 건드리지 않는다 — lastExpired 는 DOM
  // (.expired 클래스/제목)의 소유자다. 섞으면 클래스 갱신이 멈춘다.
  // ?. 는 preload 로드 실패 시의 유일한 쿠션 — 알림은 조용히 죽지만
  // rAF 루프(제품)는 산다.
  if (tracker.observe(expired)) window.msTimer?.alertExpired();
```

- [ ] **Step 2: README**

"## 조작" 아래 영속 문장 다음에 추가:

```markdown
목표 시각에 도달하는 순간 알림 팝업이 뜨고 본 창이 화면 앞으로 올라온다.
팝업은 `확인` 클릭 또는 60초 뒤에 닫힌다. 이미 지난 시각으로 켜거나 과거
시각을 설정했을 때는 울리지 않는다 — 알림은 "방금 도달했다"는 사건이다.
Windows 정책상 키보드 포커스는 가져오지 않으므로 Esc 로는 닫히지 않는다.
```

"## 구조" 블록의 `src/main.js` 줄을 교체:

```
src/preload.cjs   contextBridge — 렌더러→main 단방향 채널 1개 (저장소 유일의 CJS)
src/main.js       BrowserWindow 생성 + 만료 알림 오케스트레이션 (raise + 팝업 싱글턴)
```

`src/lib/` 블록에 추가:

```
  expiry-tracker.js 만료 에지 추적 — 전환/재무장 규칙은 여기에만 있다
```

`src/renderer/` 블록에 추가:

```
  popup.html/js/css 알림 팝업 — 문구는 커스텀 완료 라벨 ?? 기본 문구
```

- [ ] **Step 3: 정적 확인 + 테스트**

```bash
cd /mnt/c/Users/cloocus/ms-timer && grep -n "tracker" src/renderer/clock.js
```
Expected: import / 생성 / rebaseline / observe — 4개 지점. `lastExpired` 대입부에는 tracker 가 없어야 한다.

```bash
cd /mnt/c/Users/cloocus/ms-timer && node --test
```
Expected: `# pass 59`, `# fail 0`

- [ ] **Step 4: 커밋**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git add src/renderer/clock.js README.md && git commit -m "$(cat <<'EOF'
feat: 만료 전환에서 알림 발화 — clock 배선

tracker 와 lastExpired 는 분리된 두 셀이다. lastExpired 는 DOM 의
소유자, tracker 는 알림의 소유자 — 섞으면 클래스 갱신이 멈춘다.
target 커밋 순간 동기 rebaseline 으로 경계 근처 커밋의 오발화를 막는다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
EOF
)"
```

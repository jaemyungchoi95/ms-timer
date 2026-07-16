# 퇴근시간 사용자 설정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 퇴근 시각을 사용자가 설정하고 영속화하게 만들고, 레트로 테마에서 ms 릴이 안 보이는 버그를 고친다.

**Architecture:** 검증은 `src/lib/target-time.js`의 순수 함수 `parseTarget` 하나로 통합한다 — 저장값과 사용자 입력이 같은 함수를 타므로 두 경로가 어긋날 수 없다. `computeRemaining`은 `targetHour` 정수 대신 `{h, m}` 객체를 받는다. 편집 UI와 localStorage는 렌더러(`target-editor.js`)에 두고 `theme.js`가 확립한 try/catch 패턴을 따른다.

**Tech Stack:** Electron 43, 순수 ESM, `node:test` (내장), 런타임 의존성 0

**설계 스펙:** `docs/superpowers/specs/2026-07-16-target-time-design.md`

## Global Constraints

- **프로젝트 경로는 `/mnt/c/Users/cloocus/ms-timer`.** WSL 파일시스템(`/home/...`)에 두면 Windows node가 `\\wsl$` UNC 경로로 접근해 electron-builder가 실패한다.
- **`npm`/`electron`/`electron-builder`는 반드시 `cmd.exe /c "..."`로 실행한다.** WSL node로 `npm install` 하면 linux용 electron 바이너리가 받아져 실행되지 않는다.
- **테스트는 WSL node로 실행한다:** `node --test`
- **런타임 의존성 0을 유지한다.** 새 npm 패키지를 추가하지 않는다. `devDependencies`는 electron / electron-builder 둘뿐이다.
- **순수 ESM.** `package.json`에 `"type": "module"`. `require` 금지.
- **`src/lib/`는 DOM·브라우저 API를 만지지 않고, 모든 로직과 모든 테스트를 갖는다. `src/renderer/`는 로직이 없고 설계상 테스트도 없다.** localStorage는 브라우저 API이므로 렌더러에만 둔다.
- **PowerShell `.ps1` 스크립트 파일은 이 환경의 `Restricted` 실행 정책에 막혀 있다.** 스크린샷은 원자적 인라인 `powershell.exe -Command '...'` 호출로만 찍는다. **`-ExecutionPolicy Bypass`나 `Get-Content | iex`는 시도하지 말 것** — 제어 우회로 분류되어 차단된다.
- **커밋은 conventional commits**(`feat:`, `fix:`, `docs:`, `chore:`), 본문은 한국어.
- 커밋 메시지 끝에 붙일 것:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
  ```

### 스크린샷 찍는 법 (Task 3·4·5·6에서 사용)

앱을 백그라운드로 띄우고, 전체 화면을 캡처하고, 죽인다. 세 명령 모두 원자적이다.

```bash
# 1) 실행 (background 로)
cd /mnt/c/Users/cloocus/ms-timer && cmd.exe /c "npx electron ."

# 2) 캡처 — bash 작은따옴표로 감싸 $ 확장을 막고, PowerShell 문자열은 큰따옴표를 쓴다
powershell.exe -Command 'Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $b=New-Object System.Drawing.Bitmap -ArgumentList $s.Width,$s.Height; $g=[System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($s.Location,[System.Drawing.Point]::Empty,$s.Size); $b.Save("C:\Users\cloocus\AppData\Local\Temp\ms-timer-shot.png"); $g.Dispose(); $b.Dispose()'

# 3) 확인 — Read 툴로 이 경로를 연다
/mnt/c/Users/cloocus/AppData/Local/Temp/ms-timer-shot.png

# 4) 종료
cmd.exe /c "taskkill /IM electron.exe /F"
```

스크린샷을 리포지토리 밖(`AppData\Local\Temp`)에 쓰는 이유는 커밋 오염을 막기 위해서다.

---

### Task 1: 순수 함수 — parseTarget / formatTarget

**Files:**
- Create: `src/lib/target-time.js`
- Test: `test/target-time.test.js`

**Interfaces:**
- Consumes: 없음 (의존성 없는 첫 태스크)
- Produces:
  - `parseTarget(str) -> {h: number, m: number} | null` — `"HH:MM"` 형식이 아니거나 00:00–23:59 범위 밖이면 `null`
  - `formatTarget(target) -> string` — `{h, m}` → `"HH:MM"` (2자리 zero-pad)
  - Task 5의 `target-editor.js`가 둘 다 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/target-time.test.js` 생성:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTarget, formatTarget } from '../src/lib/target-time.js';

test('parseTarget — 하한 경계 00:00', () => {
  assert.deepEqual(parseTarget('00:00'), { h: 0, m: 0 });
});

test('parseTarget — 상한 경계 23:59', () => {
  assert.deepEqual(parseTarget('23:59'), { h: 23, m: 59 });
});

test('parseTarget — 실사용 값 16:30', () => {
  assert.deepEqual(parseTarget('16:30'), { h: 16, m: 30 });
});

test('parseTarget — 시 상한 초과는 null', () => {
  assert.equal(parseTarget('24:00'), null);
});

test('parseTarget — 분 상한 초과는 null', () => {
  assert.equal(parseTarget('23:60'), null);
});

// 빈 칸 함정: 느슨하게 파싱했다면 parseInt("8")이 8을 반환해
// "08:30"으로 조용히 유효 판정된다. 화면은 [ ][8]:[3][0] 으로 미완성인데
// ✓ 가 활성화되는 버그. 엄격 매칭이 이를 막는다.
test('parseTarget — 빈 칸 함정: "8:30"은 8로 해석되지 않는다', () => {
  assert.equal(parseTarget('8:30'), null);
});

test('parseTarget — 부분 입력은 null', () => {
  assert.equal(parseTarget('16:3'), null);
  assert.equal(parseTarget(':'), null);
  assert.equal(parseTarget(''), null);
});

test('parseTarget — 콜론 없으면 null', () => {
  assert.equal(parseTarget('1630'), null);
});

test('parseTarget — 숫자가 아니면 null', () => {
  assert.equal(parseTarget('ab:cd'), null);
});

test('parseTarget — 부호는 null (정규식이 - 를 거부한다)', () => {
  assert.equal(parseTarget('-1:00'), null);
});

test('parseTarget — 앞뒤 공백은 null (^$ 앵커가 있다)', () => {
  assert.equal(parseTarget(' 16:30'), null);
  assert.equal(parseTarget('16:30 '), null);
});

test('parseTarget — 문자열이 아닌 입력은 null', () => {
  assert.equal(parseTarget(null), null);
  assert.equal(parseTarget(undefined), null);
  assert.equal(parseTarget(1630), null);
});

test('formatTarget — zero-pad', () => {
  assert.equal(formatTarget({ h: 9, m: 5 }), '09:05');
});

test('formatTarget — 00:00', () => {
  assert.equal(formatTarget({ h: 0, m: 0 }), '00:00');
});

test('formatTarget — 23:59', () => {
  assert.equal(formatTarget({ h: 23, m: 59 }), '23:59');
});

test('왕복 대칭 — formatTarget(parseTarget(s)) === s', () => {
  for (const s of ['00:00', '09:05', '16:30', '18:00', '23:59']) {
    assert.equal(formatTarget(parseTarget(s)), s);
  }
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test test/target-time.test.js`

Expected: FAIL — `Cannot find module '.../src/lib/target-time.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/lib/target-time.js` 생성:

```js
/** "HH:MM" 엄격 매칭. 자리수가 모자라거나(빈 칸) 넘치면 실패한다. */
const PATTERN = /^(\d{2}):(\d{2})$/;

/**
 * "HH:MM" → {h, m}. 형식이 다르거나 00:00–23:59 범위를 벗어나면 null.
 *
 * 저장값과 사용자 입력이 모두 이 함수를 탄다 — 검증 규칙은 여기에만 존재한다.
 * \d{2} 가 두 자리를 강제하므로 Number()가 NaN이나 음수를 만들 수 없고,
 * 따라서 하한 검사(h >= 0, m >= 0)가 필요 없다.
 */
export function parseTarget(str) {
  if (typeof str !== 'string') return null;

  const match = PATTERN.exec(str);
  if (match === null) return null;

  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;

  return { h, m };
}

/** {h, m} → "HH:MM" (2자리 zero-pad) */
export function formatTarget(target) {
  const h = String(target.h).padStart(2, '0');
  const m = String(target.m).padStart(2, '0');
  return `${h}:${m}`;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test test/target-time.test.js`

Expected: PASS — `# pass 16`, `# fail 0`

- [ ] **Step 5: 전체 테스트 실행 (회귀 없음 확인)**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test`

Expected: `# pass 33`, `# fail 0` (기존 17 + 신규 16)

- [ ] **Step 6: 커밋**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git add src/lib/target-time.js test/target-time.test.js && git commit -m "$(cat <<'EOF'
feat: 목표 시각 파싱/포맷 순수 함수

parseTarget 하나로 검증 경로를 통합한다. 저장값과 사용자 입력이 같은
함수를 타므로 두 경로가 어긋날 수 없고 같은 테스트가 양쪽을 덮는다.

정규식 엄격 매칭이 빈 칸 함정을 막는다. 느슨한 파싱이면 "8:30"이
parseInt로 8이 되어 "08:30"으로 조용히 유효 판정된다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
EOF
)"
```

---

### Task 2: countdown 시그니처를 목표 시각 객체로 확장

**Files:**
- Modify: `src/lib/countdown.js` (전체 함수)
- Modify: `test/countdown.test.js:42-45` (기존 `targetHour` 테스트) + 케이스 추가

**Interfaces:**
- Consumes: 없음 (Task 1의 코드에 의존하지 않는다. 다만 **태스크는 1→6 순서로 실행한다** — 각 스텝의 기대 테스트 개수가 누적값이다)
- Produces:
  - `computeRemaining(now, target = {h: 18, m: 0}) -> {expired, h, m, s, ms}` — Task 5의 `clock.js`가 쓴다.

**주의 — 이 태스크의 핵심 함정:** 현재 `countdown.js`는 목표 시각 `Date`를 담는 지역 변수를 이미 `target`이라 부른다. 파라미터도 `target`으로 두면 **재선언 SyntaxError**가 난다. 지역 변수를 `deadline`으로 개명해야 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/countdown.test.js:42-45`의 기존 테스트를 아래로 **교체**한다:

```js
test('target 인자로 목표 시각 변경', () => {
  assert.deepEqual(computeRemaining(at(17, 0, 0, 0), { h: 19, m: 0 }),
    { expired: false, h: 2, m: 0, s: 0, ms: 0 });
});
```

그리고 파일 끝(순수 함수 테스트 앞)에 아래 테스트들을 **추가**한다:

```js
test('분 단위 target — 09:00에서 16:30까지 7시간 30분', () => {
  assert.deepEqual(computeRemaining(at(9, 0, 0, 0), { h: 16, m: 30 }),
    { expired: false, h: 7, m: 30, s: 0, ms: 0 });
});

test('분 단위 target — 정각 1ms 전', () => {
  assert.deepEqual(computeRemaining(at(16, 29, 59, 999), { h: 16, m: 30 }),
    { expired: false, h: 0, m: 0, s: 0, ms: 1 });
});

test('분 단위 target — 정각은 expired', () => {
  assert.deepEqual(computeRemaining(at(16, 30, 0, 0), { h: 16, m: 30 }),
    { expired: true, h: 0, m: 0, s: 0, ms: 0 });
});

test('분 단위 target — 정각 1ms 후는 expired', () => {
  assert.deepEqual(computeRemaining(at(16, 30, 0, 1), { h: 16, m: 30 }),
    { expired: true, h: 0, m: 0, s: 0, ms: 0 });
});

test('target 인자 없으면 18:00 기본값', () => {
  assert.deepEqual(computeRemaining(at(9, 0, 0, 0)),
    computeRemaining(at(9, 0, 0, 0), { h: 18, m: 0 }));
});

test('자정 롤오버는 분 단위 target에서도 동작 — 00:00에서 16:30까지', () => {
  assert.deepEqual(computeRemaining(at(0, 0, 0, 0), { h: 16, m: 30 }),
    { expired: false, h: 16, m: 30, s: 0, ms: 0 });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test test/countdown.test.js`

Expected: FAIL — 현재 구현은 2번째 인자를 정수로 받아 `setHours({h:19,m:0}, 0, 0, 0)`이 되므로 결과가 어긋난다.

- [ ] **Step 3: 구현 작성**

`src/lib/countdown.js` 전체를 아래로 교체:

```js
/**
 * now 로부터 오늘 target 시각까지 남은 시간.
 *
 * 절대 시각 차분이다 — 누적 감산이 아니므로 드리프트가 없고
 * 절전 복귀·NTP 보정·타임존 변경이 자동으로 반영된다.
 * 매 호출마다 now 의 날짜에서 deadline 을 다시 계산하므로 자정 롤오버도 공짜다.
 *
 * target 이 이미 지났으면 expired 를 반환한다 — 내일로 넘기지 않는다.
 * 넘기면 18:01에 켠 사람이 "퇴근" 대신 23시간 59분 카운트다운을 보게 된다.
 */
export function computeRemaining(now, target = { h: 18, m: 0 }) {
  // new Date(now) 는 복사 생성자. now.setHours() 를 직접 부르면
  // 입력 Date 를 변경하여 순수 함수 테스트가 깨진다.
  const deadline = new Date(now);
  deadline.setHours(target.h, target.m, 0, 0);

  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) {
    return { expired: true, h: 0, m: 0, s: 0, ms: 0 };
  }

  return {
    expired: false,
    h: Math.floor(diff / 3600000),
    m: Math.floor(diff / 60000) % 60,
    s: Math.floor(diff / 1000) % 60,
    ms: diff % 1000,
  };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test`

Expected: `# pass 39`, `# fail 0`

내역: target-time 16 (Task 1 신규) + countdown 15 (기존 9, 그중 1개 교체 + 6개 추가) + reel-phase 8 (변경 없음) = 39.

숫자가 다르면 멈추고 원인을 확인할 것. 특히 `# fail 0` 이 아니면 다음 단계로 넘어가지 않는다.

- [ ] **Step 5: 커밋**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git add src/lib/countdown.js test/countdown.test.js && git commit -m "$(cat <<'EOF'
feat: computeRemaining 이 목표 시각 객체를 받는다

targetHour 정수 → target {h, m}. 유연근무제 퇴근 시각은 16:30 처럼
분 단위라 시간만으로 표현할 수 없다.

지역 변수 target(Date) 은 deadline 으로 개명했다 — 파라미터와 이름이
겹치면 재선언 SyntaxError 다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
EOF
)"
```

---

### Task 3: 레트로 테마 ms 릴 비가시 버그 수정

**Files:**
- Modify: `src/renderer/themes.css:23`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (CSS 값 변경. 다른 태스크가 의존하지 않는다)

**근본 원인:** 릴은 정상 동작한다. `--reel-fg: #6d8a7d`와 `--frame-bg: #4f8f7c`의 상대 휘도가 사실상 동일해(G 138 vs 143, B 125 vs 124) 대비가 **1.005:1**이다. 그려지는데 안 보이는 것이다. dark 테마는 같은 자리가 3.68:1이다. `.reel`은 자체 배경이 없고 `.frame` 안에 있으므로 릴 숫자는 `--frame-bg` 위에 직접 그려진다.

테스트는 없다 — CSS 색상 값이라 `src/lib/` 밖이고, 검증은 눈으로 한다.

- [ ] **Step 1: 색상 값 수정**

`src/renderer/themes.css`의 `:root[data-theme="retro"]` 블록에서:

```css
  --reel-fg: #6d8a7d;
```

를 아래로 교체:

```css
  --reel-fg: #2c4a3e;
```

- [ ] **Step 2: 레트로 테마로 뜨도록 임시 편집**

`initTheme()`은 저장값이 없으면 `THEMES[0]`인 `dark`로 뜬다. 레트로를 보려면 순서를 임시로 뒤집는다.

`src/renderer/theme.js:1`:

```js
const THEMES = ['dark', 'retro'];
```

을 임시로:

```js
const THEMES = ['retro', 'dark'];
```

**이 편집은 Step 5에서 되돌린다. 잊으면 기본 테마가 바뀐 채로 배포된다.**

- [ ] **Step 3: 앱 실행 + 스크린샷**

```bash
cd /mnt/c/Users/cloocus/ms-timer && cmd.exe /c "npx electron ."
```
(background 로 실행할 것)

```bash
powershell.exe -Command 'Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $b=New-Object System.Drawing.Bitmap -ArgumentList $s.Width,$s.Height; $g=[System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($s.Location,[System.Drawing.Point]::Empty,$s.Size); $b.Save("C:\Users\cloocus\AppData\Local\Temp\ms-timer-shot.png"); $g.Dispose(); $b.Dispose()'
```

Read 툴로 `/mnt/c/Users/cloocus/AppData/Local/Temp/ms-timer-shot.png` 를 연다.

**확인할 것:** 민트색 프레임 위 `.` 오른쪽의 ms 3자리가 **어두운 초록으로 읽을 수 있게** 보인다. 흐릿한 것은 정상이다 — 릴은 카드보다 흐릿해야 한다. "흐릿함"과 "비가시"를 구분할 것: 숫자의 형태가 식별되면 통과다.

```bash
cmd.exe /c "taskkill /IM electron.exe /F"
```

- [ ] **Step 4: 결과 판단**

숫자가 여전히 안 보이거나 반대로 카드만큼 진해서 튀면 값을 조정하고 Step 3을 반복한다. 조정 방향은 **더 어둡게**다 (`#24403a` 쪽). 밝은 쪽으로 가면 안 된다 — 레트로에서 초록 프레임 위 글자는 전부 어두운 잉크이므로 릴만 밝으면 따로 논다.

- [ ] **Step 5: 임시 편집 되돌리기**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git checkout -- src/renderer/theme.js
```

**되돌아갔는지 증명한다:**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git diff --stat src/renderer/theme.js && grep -n "const THEMES" src/renderer/theme.js
```

Expected: `git diff --stat` 출력이 **비어 있고**, grep 결과가 `const THEMES = ['dark', 'retro'];` 여야 한다. 아니면 멈춘다.

- [ ] **Step 6: 커밋**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git add src/renderer/themes.css && git commit -m "$(cat <<'EOF'
fix: 레트로 테마 ms 릴이 보이지 않던 문제

--reel-fg(#6d8a7d) 와 --frame-bg(#4f8f7c) 의 상대 휘도가 사실상 동일해
대비 1.005:1 이었다. 릴은 정상 동작 중이었고 그려지는데 안 보였다.

테마 토글은 원인이 아니다 — 릴 JS 는 색을 만지지 않고 테마는 CSS 변수라
처음부터 레트로로 켰어도 동일했다.

테마의 기존 잉크색으로 맞춰 2.58:1. 카드보다 흐릿한 것은 의도다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
EOF
)"
```

---

### Task 4: 헤더 레이아웃 — 제목을 위로, 하단 라벨 제거

**Files:**
- Modify: `src/renderer/index.html:10-11` (헤더 삽입, `.frame`을 `.stack`으로 감쌈), `src/renderer/index.html:73` (하단 라벨 제거)
- Modify: `src/renderer/style.css:25-32` (`.clock`), `:179-191` (`.label` → `.title`)
- Modify: `src/renderer/themes.css` (`--label-fg` → `--title-fg`, 값 변경)
- Modify: `src/renderer/clock.js:7` (`labelEl` → `titleEl`), `:34`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `index.html`에 `<div class="target" id="target">` — Task 5가 이 안을 채운다. 이 태스크에서는 비어 있다.
  - `--title-fg` CSS 변수 — Task 5의 편집기가 재사용한다.

**주의:** "제목은 흰색"은 dark 테마에서만 성립한다. 레트로의 `--bg`는 민트색(`#8fc4b2`)이라 흰 글자는 대비 약 1.9:1로 **Task 3에서 고친 것과 같은 종류의 비가시 상태**가 된다. 테마별로 값을 나눈다.

- [ ] **Step 1: HTML — 헤더 삽입**

`src/renderer/index.html`에서 `<main id="clock" class="clock">` 바로 다음 줄부터 `<div class="frame">`까지를 아래로 교체한다 (`.frame` 내부는 그대로 둔다):

```html
    <main id="clock" class="clock">
      <div class="stack">
        <header class="header">
          <h1 id="title" class="title">퇴근까지</h1>
          <div class="target" id="target"></div>
        </header>
        <div class="frame">
```

- [ ] **Step 2: HTML — 프레임 닫는 태그 뒤 정리**

`</div>` (frame 닫기) 다음의 아래 줄을 **삭제**한다:

```html
      <div id="label" class="label">퇴근까지</div>
```

그리고 `.stack`을 닫는 `</div>`를 프레임 닫는 `</div>` 다음에 추가한다. 결과는 이 구조여야 한다:

```html
        </div>      <!-- .frame -->
      </div>        <!-- .stack -->
    </main>
```

- [ ] **Step 3: CSS — 레이아웃**

`src/renderer/style.css`의 `.clock` 규칙(25-32행)을 아래로 교체:

```css
.clock {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 헤더와 프레임을 같은 폭으로 묶는다.
   width: fit-content 는 .frame 의 max-content 폭으로 해소된다 —
   .header 는 width: 100% 라 intrinsic 크기 계산에 기여하지 않는다. */
.stack {
  display: flex;
  flex-direction: column;
  width: fit-content;
  gap: calc(var(--card-h) * 0.18);
}

/* 제목은 중앙, 목표 시각은 우측 절대 배치 —
   목표 시각의 폭이 변해도 제목이 흔들리지 않는다. */
.header {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: baseline;
  width: 100%;
}

.title {
  font-size: calc(var(--card-h) * 0.42);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--title-fg);
}

.target {
  position: absolute;
  right: calc(var(--card-h) * 0.16);
  bottom: 0;
  font-size: calc(var(--card-h) * 0.2);
  font-weight: 600;
  color: var(--title-fg);
}
```

- [ ] **Step 4: CSS — 하단 라벨 규칙 제거**

`src/renderer/style.css`에서 아래 두 규칙을 **삭제**한다 (179-183행, 189-191행):

```css
.label {
  font-size: calc(var(--card-h) * 0.15);
  letter-spacing: 0.35em;
  color: var(--label-fg);
}
```

```css
.clock.expired .label {
  color: var(--accent);
}
```

그리고 `.clock.expired .flip > div > span` 규칙 아래에 아래를 **추가**한다:

```css
.clock.expired .title {
  color: var(--accent);
}
```

- [ ] **Step 5: 테마 변수**

`src/renderer/themes.css`에서 dark 블록의 `--label-fg: #6b7280;`를 삭제하고 `--title-fg: #f7f8f8;`를 추가한다. retro 블록의 `--label-fg: #2c4a3e;`를 삭제하고 `--title-fg: #2c4a3e;`를 추가한다.

결과:

```css
:root,
:root[data-theme="dark"] {
  --bg: #0b0d10;
  --frame-bg: #15181d;
  --card-bg: #1c1f24;
  --card-fg: #f7f8f8;
  --card-divider: #0b0d10;
  --card-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  --sep-fg: #3a3f46;
  --reel-fg: #6b7280;
  --title-fg: #f7f8f8;
  --accent: #4ade80;
}

:root[data-theme="retro"] {
  --bg: #8fc4b2;
  --frame-bg: #4f8f7c;
  --card-bg: #f4f0e4;
  --card-fg: #2c4a3e;
  --card-divider: #cbc5b4;
  --card-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  --sep-fg: #2c4a3e;
  --reel-fg: #2c4a3e;
  /* 흰색이면 민트 배경(#8fc4b2) 위에서 대비 1.9:1 로 안 보인다 */
  --title-fg: #2c4a3e;
  --accent: #1f6b4a;
}
```

- [ ] **Step 6: clock.js — 라벨 참조를 제목으로**

`src/renderer/clock.js:7`:

```js
const labelEl = document.getElementById('label');
```

을 아래로 교체:

```js
const titleEl = document.getElementById('title');
```

`src/renderer/clock.js:34`:

```js
    labelEl.textContent = expired ? '퇴근' : '퇴근까지';
```

을 아래로 교체:

```js
    titleEl.textContent = expired ? '퇴근' : '퇴근까지';
```

- [ ] **Step 7: 죽은 참조가 없는지 확인**

```bash
cd /mnt/c/Users/cloocus/ms-timer && grep -rn "label" src/renderer/ || echo "OK — label 참조 없음"
```

Expected: `OK — label 참조 없음`. `aria-label`은 이 태스크에 없으므로 어떤 매치도 나오면 안 된다.

- [ ] **Step 8: 스크린샷으로 두 테마 확인**

Global Constraints의 스크린샷 절차대로 dark 테마를 찍는다.

**확인할 것:** 제목 "퇴근까지"가 플립 시계 **위**에 크게 흰색으로 있고, 하단 라벨이 **없고**, 시계가 아래로 내려왔다.

그다음 Task 3 Step 2의 임시 편집(`THEMES = ['retro', 'dark']`)을 다시 적용해 레트로도 찍는다. **확인할 것:** 제목이 민트 배경 위에서 어두운 초록으로 **읽힌다.**

찍은 뒤 반드시 되돌린다:

```bash
cd /mnt/c/Users/cloocus/ms-timer && git checkout -- src/renderer/theme.js && git diff --stat src/renderer/theme.js && grep -n "const THEMES" src/renderer/theme.js
```

Expected: diff 비어 있음, grep 결과 `const THEMES = ['dark', 'retro'];`

- [ ] **Step 9: 테스트 (회귀 없음)**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test`

Expected: `# pass 39`, `# fail 0` — 렌더러 변경은 lib 테스트에 영향이 없어야 한다.

- [ ] **Step 10: 커밋**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git add src/renderer/index.html src/renderer/style.css src/renderer/themes.css src/renderer/clock.js && git commit -m "$(cat <<'EOF'
feat: 제목을 시계 위 헤더로, 하단 라벨 제거

헤더는 제목 중앙 + 목표 시각 우측 절대 배치. 목표 시각의 폭이 변해도
제목이 흔들리지 않는다. 목표 시각 자리는 다음 커밋에서 채운다.

expired 시 "퇴근" 표시 역할이 하단 라벨에서 제목으로 이동했다.

--label-fg → --title-fg 개명. 레트로는 흰색이 아니라 잉크색이다 —
민트 배경 위 흰 글자는 대비 1.9:1 로 방금 고친 릴 버그와 같은 상태가 된다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
EOF
)"
```

---

### Task 5: 목표 시각 편집기

**Files:**
- Create: `src/renderer/target-editor.js`
- Modify: `src/renderer/index.html` (`<div class="target" id="target">` 내부를 채움)
- Modify: `src/renderer/style.css` (편집기 스타일 추가)
- Modify: `src/renderer/themes.css` (편집기 색 변수 추가)
- Modify: `src/renderer/clock.js` (편집기 배선, target 을 tick 에 주입)
- Modify: `src/renderer/theme.js` (T 키 가드)

**Interfaces:**
- Consumes:
  - Task 1의 `parseTarget(str)`, `formatTarget(target)` — `../lib/target-time.js`
  - Task 2의 `computeRemaining(now, target)` — `../lib/countdown.js`
  - Task 4의 `<div class="target" id="target">`, `--title-fg`
- Produces:
  - `initTargetEditor(root, onChange) -> {h, m}` — 초기 target 을 반환하고, 사용자가 확정할 때마다 `onChange(target)` 를 호출한다. `clock.js`에서만 쓴다.

이 계획에서 가장 큰 태스크다. 파일 6개를 건드리지만 하나의 기능이라 쪼개면 사용자가 쓸 수 없는 중간 상태(표시만 되고 편집이 안 되는 상태)가 남는다.

- [ ] **Step 1: HTML — 편집기 마크업**

`src/renderer/index.html`의 아래 줄을:

```html
          <div class="target" id="target"></div>
```

아래로 교체:

```html
          <div class="target" id="target">
            <button class="target-display" type="button" data-target-display></button>
            <div class="target-edit" data-target-edit hidden>
              <input class="cell" type="text" inputmode="numeric" maxlength="1" aria-label="시 십의 자리" data-cell />
              <input class="cell" type="text" inputmode="numeric" maxlength="1" aria-label="시 일의 자리" data-cell />
              <span class="cell-sep">:</span>
              <input class="cell" type="text" inputmode="numeric" maxlength="1" aria-label="분 십의 자리" data-cell />
              <input class="cell" type="text" inputmode="numeric" maxlength="1" aria-label="분 일의 자리" data-cell />
              <button class="target-btn" type="button" aria-label="확정" data-target-ok>✓</button>
              <button class="target-btn" type="button" aria-label="취소" data-target-cancel>↻</button>
            </div>
          </div>
```

`data-*` 속성으로 조회하는 것은 기존 `data-flip` / `data-reel` 패턴과 같다.

- [ ] **Step 2: 편집기 모듈 작성**

`src/renderer/target-editor.js` 생성:

```js
import { formatTarget, parseTarget } from '../lib/target-time.js';

const STORAGE_KEY = 'ms-timer:target';
const DEFAULT_TARGET = { h: 18, m: 0 };

/**
 * Electron 43은 file:// origin에서 localStorage를 허용함이 실측으로 확인됨(2026-07-15).
 * try/catch는 차단되는 환경을 위한 fallback으로 유지 — 그 경우 세션 전용으로 동작한다.
 */
function readTarget() {
  try {
    return parseTarget(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_TARGET;
  } catch {
    return DEFAULT_TARGET;
  }
}

function writeTarget(target) {
  try {
    localStorage.setItem(STORAGE_KEY, formatTarget(target));
  } catch {
    // 영속화 불가 — 세션 전용으로 동작한다
  }
}

/**
 * 목표 시각 표시 + 편집기.
 * 초기 target 을 반환하고, 사용자가 확정할 때마다 onChange(target) 를 호출한다.
 * rAF 루프 시작 전에 1회 호출한다.
 */
export function initTargetEditor(root, onChange) {
  const display = root.querySelector('[data-target-display]');
  const edit = root.querySelector('[data-target-edit]');
  const cells = [...root.querySelectorAll('[data-cell]')];
  const okBtn = root.querySelector('[data-target-ok]');
  const cancelBtn = root.querySelector('[data-target-cancel]');

  let current = readTarget();

  /**
   * 네 칸을 "HH:MM" 으로 합친다. 빈 칸이 있으면 문자열이 짧아져
   * parseTarget 의 엄격 정규식이 자동으로 걸러낸다 —
   * ['1','','3','0'] → "130" → "13:0" → null.
   */
  function typedValue() {
    const d = cells.map((c) => c.value).join('');
    return `${d.slice(0, 2)}:${d.slice(2)}`;
  }

  function validate() {
    const target = parseTarget(typedValue());
    okBtn.disabled = target === null;
    edit.classList.toggle('invalid', target === null);
    return target;
  }

  function showDisplay() {
    display.textContent = formatTarget(current);
    display.hidden = false;
    edit.hidden = true;
  }

  function showEdit() {
    const digits = formatTarget(current).replace(':', '');
    cells.forEach((cell, i) => { cell.value = digits[i]; });
    display.hidden = true;
    edit.hidden = false;
    validate();
    cells[0].focus();
  }

  function commit() {
    const target = validate();
    if (target === null) return;
    current = target;
    writeTarget(current);
    onChange(current);
    showDisplay();
  }

  function cancel() {
    showDisplay();
  }

  cells.forEach((cell, i) => {
    // 포커스 시 전체 선택 — 타이핑이 곧 덮어쓰기가 된다
    cell.addEventListener('focus', () => cell.select());

    // 숫자 한 글자만 허용. 삭제는 e.data 가 null 이라 통과한다.
    cell.addEventListener('beforeinput', (e) => {
      if (e.data !== null && !/^\d$/.test(e.data)) e.preventDefault();
    });

    cell.addEventListener('input', () => {
      validate();
      if (cell.value !== '' && i < cells.length - 1) cells[i + 1].focus();
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { commit(); return; }
      if (e.key === 'Escape') { cancel(); return; }
      if (e.key === 'ArrowLeft' && i > 0) { cells[i - 1].focus(); e.preventDefault(); return; }
      if (e.key === 'ArrowRight' && i < cells.length - 1) { cells[i + 1].focus(); e.preventDefault(); return; }
      // 빈 칸에서 Backspace 면 이전 칸으로
      if (e.key === 'Backspace' && cell.value === '' && i > 0) {
        cells[i - 1].focus();
        e.preventDefault();
      }
    });
  });

  display.addEventListener('click', showEdit);
  okBtn.addEventListener('click', commit);
  cancelBtn.addEventListener('click', cancel);

  showDisplay();
  return current;
}
```

- [ ] **Step 3: clock.js 배선**

`src/renderer/clock.js`의 import 블록에 추가:

```js
import { initTargetEditor } from './target-editor.js';
```

`const titleEl = ...` 아래에 추가:

```js
const targetEl = document.getElementById('target');
```

`let lastExpired = null;` 아래에 추가:

```js
let target = initTargetEditor(targetEl, (next) => { target = next; });
```

`tick()`의 첫 줄을 아래로 교체:

```js
  const { expired, h, m, s, ms } = computeRemaining(new Date(), target);
```

**`initTheme()` 과 `initTargetEditor()` 는 모두 `requestAnimationFrame(tick)` 앞에서 1회 호출되어야 한다.** 최종 파일 하단은 이 순서다:

```js
initTheme();
requestAnimationFrame(tick);
```

- [ ] **Step 4: theme.js — T 키 가드**

`src/renderer/theme.js`의 keydown 리스너를 아래로 교체:

```js
  window.addEventListener('keydown', (e) => {
    if (e.key !== 't' && e.key !== 'T') return;
    // 목표 시각 입력 중에는 테마를 바꾸지 않는다 — 입력칸에서 T 를 치면
    // 글자는 안 들어가는데(숫자만 허용) 테마만 바뀌는 것을 막는다.
    if (e.target instanceof HTMLInputElement) return;
    current = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    document.documentElement.dataset.theme = current;
    writeTheme(current);
  });
```

- [ ] **Step 5: CSS — 편집기 스타일**

`src/renderer/style.css`의 `.target` 규칙 **다음에** 추가:

```css
.target-display {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.target-edit {
  display: flex;
  align-items: center;
  gap: calc(var(--card-h) * 0.03);
}

/* [hidden] 의 UA display:none 은 위 display:flex 에 진다 — 명시적으로 이긴다 */
.target-edit[hidden] {
  display: none;
}

.cell {
  width: calc(var(--card-h) * 0.19);
  height: calc(var(--card-h) * 0.28);
  text-align: center;
  font-family: inherit;
  font-size: calc(var(--card-h) * 0.17);
  font-weight: 600;
  color: var(--input-fg);
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: calc(var(--card-h) * 0.03);
  outline: none;
  /* body 가 전역으로 user-select:none / cursor:default 라 입력칸만 되돌린다 */
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.cell:focus {
  border-color: var(--title-fg);
}

.target-edit.invalid .cell {
  border-color: var(--input-border-invalid);
}

.cell-sep {
  padding: 0 calc(var(--card-h) * 0.01);
}

.target-btn {
  font: inherit;
  font-size: calc(var(--card-h) * 0.17);
  line-height: 1;
  color: var(--btn-fg);
  background: none;
  border: none;
  padding: 0 calc(var(--card-h) * 0.03);
  cursor: pointer;
}

.target-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
```

- [ ] **Step 6: 테마 변수 — 편집기 색**

`src/renderer/themes.css` dark 블록의 `--accent` 앞에 추가:

```css
  --input-bg: #1c1f24;
  --input-fg: #f7f8f8;
  --input-border: #3a3f46;
  --input-border-invalid: #ef4444;
  --btn-fg: #6b7280;
```

retro 블록의 `--accent` 앞에 추가:

```css
  --input-bg: #f4f0e4;
  --input-fg: #2c4a3e;
  --input-border: #4f8f7c;
  --input-border-invalid: #c0392b;
  --btn-fg: #2c4a3e;
```

입력 칸은 각 테마의 카드 색을 재사용한다 — 편집 UI 가 플립 카드와 같은 재질로 읽히고 새 색을 발명하지 않는다. 무효 테두리만 팔레트 밖의 빨강을 쓴다 (오류는 테마 조화보다 눈에 띄는 것이 우선).

- [ ] **Step 7: 앱 실행 + 표시 확인**

Global Constraints의 절차대로 실행하고 스크린샷을 찍는다.

**확인할 것:** 헤더 우측에 `18:00` 이 보인다. 카운트다운이 18:00 기준으로 맞다 (예: 지금이 09:40이면 `08:19:xx`).

앱은 켜둔 채로 다음 스텝으로 간다.

- [ ] **Step 8: 편집 동작 확인 (수동)**

`18:00` 을 클릭하면 `[1][8]:[0][0] ✓ ↻` 로 바뀌는지, 첫 칸이 포커스+선택되는지 본다. 스크린샷으로 확인한다.

이 스텝은 사람의 상호작용이 필요하다. 에이전트로 실행 중이라면 **여기서 멈추고 사용자에게 아래를 확인해달라고 요청한다:**

1. `18:00` 클릭 → 편집 칸 4개 + ✓ ↻ 등장, 첫 칸 포커스
2. `1630` 타이핑 → 칸이 자동으로 넘어감
3. `2570` 입력 → 칸 테두리가 빨갛게, ✓ 가 회색으로 비활성
4. 한 칸 지우기 → 여전히 무효 (빈 칸 함정 방어 확인)
5. `1630` + Enter → 표시가 `16:30` 으로, 카운트다운이 16:30 기준으로 점프
6. 다시 클릭 → `1800` 입력 → ↻ 또는 Esc → `16:30` 그대로 (취소 확인)
7. 편집 중 `T` 입력 → 테마가 **안 바뀜**
8. 표시 상태에서 `T` → 테마 바뀜

- [ ] **Step 9: 영속화 확인**

앱을 완전히 종료하고 다시 띄운다.

```bash
cmd.exe /c "taskkill /IM electron.exe /F"
cd /mnt/c/Users/cloocus/ms-timer && cmd.exe /c "npx electron ."
```

**확인할 것:** 헤더에 `16:30` (직전에 설정한 값)이 그대로 있고 카운트다운이 그 기준이다. `18:00` 으로 돌아갔으면 localStorage 경로가 깨진 것이다.

- [ ] **Step 10: expired 재개 확인**

이제 과거 시각을 설정할 수 있으므로 임시 편집 없이 expired 를 볼 수 있다.

현재 시각보다 **이른** 시각(예: 지금이 09:40이면 `09:00`)을 설정한다.

**확인할 것:** 즉시 `00:00:00.000` 고정 + 제목이 "퇴근" + accent 색. 그 상태에서 다시 목표 시각을 클릭해 **미래** 시각으로 바꾸면 카운트다운이 재개된다.

끝나면 `18:00` 으로 되돌려놓고 종료한다.

```bash
cmd.exe /c "taskkill /IM electron.exe /F"
```

- [ ] **Step 11: 테스트 (회귀 없음)**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test`

Expected: `# pass 39`, `# fail 0`

- [ ] **Step 12: 커밋**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git add src/renderer/ && git commit -m "$(cat <<'EOF'
feat: 목표 시각 편집기 + localStorage 영속화

헤더의 목표 시각을 클릭하면 네 칸 입력으로 바뀐다. Enter/✓ 확정,
Esc/↻ 취소. 설정은 다음 실행에도 유지된다.

유연근무제라 퇴근 시각이 매일 바뀌므로 영속화의 의미는 "한 번 설정하면
끝"이 아니라 "마지막 값을 다음 실행의 기본값으로 기억"이다.

검증은 parseTarget 하나로 통일했다 — 저장값과 사용자 입력이 같은 경로를
탄다. 네 칸을 "HH:MM" 으로 합쳐 넘기므로 빈 칸이 있으면 문자열이 짧아져
엄격 정규식이 자동으로 걸러낸다.

함께 고친 것:
- 입력창에서 T 를 치면 테마가 바뀌던 문제 (theme.js 가 window 에 keydown)
- body 전역 user-select:none / cursor:default 로 입력칸에서 드래그 선택이
  안 되던 문제

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
EOF
)"
```

---

### Task 6: README + 최종 통합 검증

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1–5 전부
- Produces: 없음 (최종 태스크)

- [ ] **Step 1: README 갱신**

`README.md`의 3행과 7-16행("## 실행" 섹션)을 아래로 교체:

```markdown
퇴근 시각까지 남은 시간을 1ms 단위로 표시하는 플립 시계.

시:분:초는 플립 카드가 착착 넘어가고, ms 3자리는 읽을 수 없는 속도로 흐른다.

## 실행

`dist/ms-timer.exe` — 설치 불필요.

## 조작

- **목표 시각 클릭** — 헤더 우측의 `18:00` 을 누르면 편집 칸이 열린다.
  네 자리를 입력하고 **`✓`** 또는 **Enter** 로 확정, **`↻`** 또는 **Esc** 로 취소.
  범위(00:00–23:59)를 벗어나면 테두리가 빨갛게 되고 `✓` 가 비활성된다.
- **`T`** — 테마 전환 (다크 모던 ↔ 레트로 민트). 편집 중에는 동작하지 않는다.

목표 시각과 테마는 다음 실행에도 기억된다. 기본값은 18:00 이다.

목표 시각에 도달하면 `00:00:00.000` 에서 멈추고 "퇴근"을 표시한다.
이미 지난 시각을 설정해도 마찬가지다 — 내일로 넘기지 않는다.
자정을 넘기면 자동으로 다음 날 같은 시각 카운트다운이 시작되므로 켜둔 채로 둬도 된다.
```

- [ ] **Step 2: README 구조 섹션 갱신**

`README.md`의 구조 블록에 새 파일 두 개를 반영한다:

```
src/lib/          순수 함수 — 로직 전부, 테스트 전부, DOM 모름
  countdown.js      시간 계산
  target-time.js    목표 시각 파싱/포맷 — 검증 규칙은 여기에만 있다
  reel-phase.js     릴 위상 계산
src/renderer/     표현 계층 — 로직 없음, 테스트 없음
  flip-digit.js     카드 1장
  reel.js           릴 1개
  theme.js          테마 토글
  target-editor.js  목표 시각 표시/편집 + localStorage
  clock.js          조립 + rAF 루프
src/main.js       BrowserWindow 생성
```

그리고 마지막 문단 앞에 추가:

```markdown
목표 시각 검증은 `parseTarget` 한 함수가 전담한다. 저장값과 사용자 입력이
같은 경로를 타므로 두 경로가 어긋날 수 없다.
```

- [ ] **Step 3: 전체 테스트**

Run: `cd /mnt/c/Users/cloocus/ms-timer && node --test`

Expected: `# pass 39`, `# fail 0`

- [ ] **Step 4: 작업 트리가 깨끗한지 확인**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git status --short
```

Expected: README.md 만 수정됨(`M README.md`). **임시 편집이 남아 있으면 안 된다** — 특히 `src/renderer/theme.js` 의 `THEMES` 순서.

```bash
cd /mnt/c/Users/cloocus/ms-timer && grep -n "const THEMES" src/renderer/theme.js
```

Expected: `const THEMES = ['dark', 'retro'];`

- [ ] **Step 5: 커밋**

```bash
cd /mnt/c/Users/cloocus/ms-timer && git add README.md && git commit -m "$(cat <<'EOF'
docs: README — 목표 시각 조작부

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W2Fr56g8YhYRbC3heRi6j4
EOF
)"
```

- [ ] **Step 6: 패키징된 exe 로 최종 검증**

**개발 모드가 아니라 실제 배포물로 확인한다.** 사용자가 쓰는 것은 exe 다.

```bash
cd /mnt/c/Users/cloocus/ms-timer && cmd.exe /c "npx electron-builder --win portable"
```

Expected: `building        target=portable file=dist\ms-timer.exe`

```bash
cd /mnt/c/Users/cloocus/ms-timer && cmd.exe /c "dist\ms-timer.exe"
```
(background 로 실행)

스크린샷을 찍어 확인한다:
1. 헤더 제목이 위, 하단 라벨 없음
2. 목표 시각 표시가 우측에
3. ms 릴이 dark 에서 보임
4. `T` 로 레트로 전환 후 ms 릴이 **보임** (이 버그의 원래 증상)
5. 목표 시각 클릭 → 편집 → 확정 → 영속화

```bash
cmd.exe /c "taskkill /IM ms-timer.exe /F"
```

exe 는 `.gitignore` 의 `dist/` 에 있어 커밋되지 않는다 — 배포는 GitHub Releases 로 한다.

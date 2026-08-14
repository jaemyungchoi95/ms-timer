# 고양이 데스크톱 pet — 설계 spec

- 날짜: 2026-08-14
- 브랜치: `feat/cat-pet`
- 상태: 설계 승인됨 (브레인스토밍 완료), 구현 전
- 참조: Orca Pet (github.com/stablyai/orca `src/renderer/src/components/pet/`) — sprite sheet + CSS `steps()` + 상태 매핑 순수 함수 구조를 차용

## 1. 목적

ms-timer에 시간대별로 행동이 바뀌고 타이머 상태(임박/만료)에 반응하는 고양이 데스크톱 pet을 추가한다. pet은 독립 투명 always-on-top 창에 살며, 기존 타이머 UI/알림 동작은 변경하지 않는다.

## 2. 확정 요구사항 (사용자 결정)

| 항목 | 결정 |
|------|------|
| 위치 | 독립 투명 frameless always-on-top 창 (타이머 창과 별개) |
| 시간대 컨셉 | 고양이 행동만 변화 — dawn(00-06 자기) / morning(06-11 기지개) / day(11-17 놀기) / evening(17-21 창밖 구경) / night(21-24 졸음) |
| 타이머 연동 | 임박(만료 10분 전) 들뜸 + 만료 축하. 우선순위 만료 > 임박 > 시간대 |
| 에셋 | 코드 생성 픽셀아트 sprite sheet PNG 1장 (행=행동, 열=프레임, Orca 질감) |
| 인터랙션 | 드래그 이동(위치 영속) + 호버 반응. 고양이 영역 외 클릭 통과 |
| 토글 | 타이머 창 P키, localStorage 영속화, 기본 ON |
| 상태 배선 | 타이머 renderer → IPC 레벨 전송 → main relay → pet 창. daypart는 pet 자체 계산 |

비목표(out of scope): 사운드, 다중 pet, 커스텀 에셋 업로드, 트레이 아이콘, 타이머 창 테마 연동, Tauri 이식(별도 트랙).

## 3. 창 아키텍처

### pet BrowserWindow (main.js)

```js
{
  width: 160, height: 160,            // 고정. 스프라이트 128px 렌더 + 사방 16px 여백
  transparent: true, frame: false,
  alwaysOnTop: true, skipTaskbar: true,
  resizable: false, focusable: false, // 클릭해도 포커스 탈취 없음
  hasShadow: false,
  show: false,                        // restore-position 수신 후 showInactive()
  webPreferences: {
    preload: pet-preload.cjs,
    nodeIntegration: false, contextIsolation: true,
    // backgroundThrottling 은 기본값(true) 유지 — CSS 애니메이션은 창 숨김 시
    // 어차피 우리가 정지시키고, IPC 전달은 스로틀과 무관하다.
  },
}
```

- `backgroundColor` 미지정 — transparent 창은 지정하면 안 된다 (기존 main 창의 흰 화면 방지 패턴과 의도적으로 다름).
- 기본 위치: 커서가 있는 디스플레이 workArea 우하단에서 사방 16px 마진 (`x = workArea.x + workArea.width - 160 - 16`, y 동형). 팝업의 "커서 디스플레이" 근사를 재사용.
- 표시 게이트: 창 생성 → 로드 → renderer가 `pet:restore-position` 전송(항상, 저장값 없으면 null) → main이 위치 확정 → `showInactive()`. ready-to-show 만으로 show하지 않는다 — 기본 위치로 번쩍였다가 점프하는 것을 막는다.
- 수명: `ms-timer:set-pet(false)` 또는 타이머 창 closed에서 destroy (popup 동반 파기 패턴과 동일). `render-process-gone`/`did-fail-load` → destroy만 하고 자동 재생성 없음 (P 토글 2회로 소생).

### 클릭 통과

- 생성 직후 `setIgnoreMouseEvents(true, { forward: true })` — 창 전체가 클릭 통과하되 mousemove는 renderer에 전달된다 (Windows/macOS 지원).
- renderer가 고양이 요소 `mouseenter` → `pet:set-click-through(false)`, `mouseleave` → `(true)`. 드래그(pointer capture) 중에는 mouseleave가 와도 통과를 켜지 않는다 — pointerup에서 `document.elementFromPoint`로 재판정한다.

## 4. IPC contract

기존 `'ms-timer:expired'`(에지 시맨틱, 팝업 트리거)는 **불변**. 신규:

| 채널 | 방향 | payload | 시맨틱 |
|------|------|---------|--------|
| `ms-timer:state` | timer renderer → main | `'running' \| 'imminent' \| 'expired'` | **레벨**. 변경 시에만 전송 (부팅 첫 틱 포함) |
| `ms-timer:set-pet` | timer renderer → main | boolean | pet 창 생성/파기 (부팅 시 + P키) |
| `pet:restore-position` | pet renderer → main | `{x, y} \| null` | 부팅 시 1회. main이 clamp 후 위치 확정 + show |
| `pet:set-position` | pet renderer → main | `{x, y}` | 드래그 중 이동. clamp 없음 |
| `pet:set-click-through` | pet renderer → main | boolean | 통과 토글 |
| `pet:timer-state` | main → pet renderer | state 문자열 | relay. pet `did-finish-load` 시 캐시 push 포함 |
| `pet:position` | main → pet renderer | `{x, y}` | restore 처리 직후 1회 — 적용된 실위치 echo (renderer의 드래그 기준점) |

- main 검증: state는 whitelist 밖이면 무시, 좌표는 `Number.isFinite` + 반올림, boolean은 `Boolean()` 강제.
- **레벨 vs 에지**: 팝업은 에지라서 `expiry-tracker`의 null-센티널이 필요했지만 `ms-timer:state`는 레벨이므로 부팅 직후 현재 상태를 즉시 보내는 것이 정답이다. `lastSentState` 초기값 null → 첫 틱에서 반드시 1회 전송. 목표 변경 시 별도 rebaseline 불필요 — 다음 틱의 diff가 처리한다.
- **main 상태 캐시**: `lastTimerState`(초기 `'running'`)를 갱신·보관, pet `did-finish-load`에 push. 만료 후 P로 켜도 즉시 축하 모드가 되는 근거.
- main→renderer 리스너는 pet preload에만 존재한다. footgun 방어: 콜백에 event 객체를 절대 넘기지 않고 payload를 `String()`/`Number()` 강제 후 전달.

## 5. 상태 모델 (순수 함수, `src/lib/`)

```
selectPetAnimation: interacting > expired > imminent > daypart
```

- `daypart.js` — `daypartOf(date)` → `'dawn'|'morning'|'day'|'evening'|'night'`. 로컬 시간 `getHours()` 기준, 경계는 [포함, 미포함): [0,6) [6,11) [11,17) [17,21) [21,24).
- `timer-state.js` — `timerStateOf(remaining)` → `'expired'|'imminent'|'running'`. 입력은 `computeRemaining` 반환값 그대로. `totalMs = ((h*60+m)*60+s)*1000 + ms`, `IMMINENT_MS = 600_000` (수출 상수), `totalMs <= IMMINENT_MS` → imminent (정확히 10:00.000 포함).
- `pet-state.js` — `selectPetAnimation({interacting, timerState, daypart})` → row 이름. `interacting`(호버·드래그 통합) → `'hover'`, `timerState==='expired'` → `'expired'`, `'imminent'` → `'imminent'`, 그 외 → daypart 그대로. 드래그와 호버는 현재 같은 row를 재생하므로 하나의 boolean으로 통합한다 (에셋 확장 시 분리 여지).
- 만료 축하는 레벨 시맨틱 — 만료가 유지되는 동안 계속 재생, 목표 변경으로 running 복귀 시 해제.

## 6. Sprite 규격

### 시트 기하

- 프레임 32×32px, **4열 × 8행 = 128×256 PNG** 1장: `src/renderer/assets/cat-sheet.png`
- 행 순서(불변 계약): `dawn(0) morning(1) day(2) evening(3) night(4) imminent(5) expired(6) hover(7)`
- 렌더 스케일 4배 → 128×128, `image-rendering: pixelated`, 창 내 중앙 배치.
- 긴 홀드는 열 중복으로 표현 (가변 프레임 지속시간 없음 — 시트를 우리가 생성하므로 Orca의 step-end 가변 페이싱은 불필요, YAGNI).

### manifest — `src/renderer/cat-manifest.js` (생성 파일)

```js
export const CAT_MANIFEST = {
  frameSize: 32, columns: 4, sheetWidth: 128, sheetHeight: 256, scale: 4,
  rows: {
    dawn:     { row: 0, frames: 4, fps: 2 },
    morning:  { row: 1, frames: 4, fps: 4 },
    day:      { row: 2, frames: 4, fps: 6 },
    evening:  { row: 3, frames: 4, fps: 3 },
    night:    { row: 4, frames: 4, fps: 2 },
    imminent: { row: 5, frames: 4, fps: 6 },
    expired:  { row: 6, frames: 4, fps: 8 },
    hover:    { row: 7, frames: 4, fps: 8 },
  },
};
```

### 생성 도구 — `tools/generate-cat-sheet.mjs`

- 의존성 제로 node 스크립트. 프레임 = 문자 그리드(`'.'`=투명, 문자=팔레트 색) — 코드 리뷰·수정 가능한 픽셀 정의.
- node:zlib deflate로 최소 PNG 인코더 직접 구현 (IHDR/IDAT/IEND, RGBA, filter 0).
- `cat-sheet.png` + `cat-manifest.js` **동시 생성** — 기하 규격의 single source of truth. 산출물은 커밋한다 (빌드 파이프라인 불변).
- `package.json` scripts: `"gen:sprites": "node tools/generate-cat-sheet.mjs"`.

### 렌더링 — `sprite-css.js` (순수) + `pet-sprite.js` (DOM)

- `src/lib/sprite-css.js` — `buildSpriteAnimationCss({name, row, frames, fps, frameSize, scale})` → `{keyframesCss, animationCss}`. Orca 단순화 이식: `from { background-position: 0 -(row·frameSize·scale)px }` → `to { -(frames·frameSize·scale)px 동일Y }`, `steps(frames) infinite`. 가드: `frames = max(1, frames)`, `fps = max(0.1, fps)` — 불량 manifest가 `steps(0)`(invalid CSS)으로 애니메이션을 얼리는 것 방지.
- `src/renderer/pet-sprite.js` — manifest+row 이름을 받아 `<style>` 주입, cat 요소에 `background-image/size/position` + animation 적용. row 변경 시에만 keyframes 교체 (같은 row 재적용은 no-op — 불필요한 재시작 방지). `document.visibilitychange` 및 `prefers-reduced-motion`에서 `animation-play-state: paused`.

## 7. pet renderer 동작 상세

### 부팅 시퀀스 (`pet.js`)

1. localStorage `'ms-timer:pet-pos'` (JSON `{x,y}` 또는 없음) 읽기 → `restorePosition(posOrNull)` 전송
2. `onPosition(cb)`로 적용 실위치 수신 → `currentPos` 초기화 (드래그 기준점)
3. `onTimerState(cb)` 구독 → 상태 변경 시 재선택
4. daypart: 즉시 1회 계산 + 30초 interval 재확인 → 변경 시 재선택
5. pointer 배선 (아래)

렌더 재선택은 언제나 `selectPetAnimation` 1회 호출 → `pet-sprite.applyRow()` — 단일 경로.

### 드래그

- cat 요소 `pointerdown` → `setPointerCapture`, `startScreen = {e.screenX, e.screenY}`, `startPos = currentPos`
- `pointermove` (캡처 중) → `next = round(startPos + (screen - startScreen))` → `currentPos = next` → `pet:set-position` 전송. **드래그 중 clamp 없음** — 가장자리에 반쯤 걸치는 배치 허용
- `pointerup` → 캡처 해제, `currentPos`를 localStorage 저장, `elementFromPoint`로 cat 위 여부 재판정 → 클릭 통과 복구 여부 결정
- 좌표는 Electron DIP 기준 (renderer `screenX/Y` ↔ `win.setPosition` 동일 좌표계). 혼합 DPI 멀티모니터에서 드래그 중 미세 오차 가능 — 허용 (다음 드래그에서 자연 보정 없음이지만 실사용 무해)

### restore clamp (main, 부팅 시에만)

- 저장 위치가 어느 디스플레이 workArea와도 24px 이상 겹치지 않으면 기본 위치(우하단)로 폴백 — 모니터 구성 변경 대비. 겹치면 그대로 적용.

## 8. 타이머 창 변경 (최소 침습)

- `clock.js` — tick 내 추가: `const state = timerStateOf(remaining)` → `lastSentState` diff → 변경 시 `window.msTimer?.sendTimerState(state)`. `?.`쿠션은 기존 alertExpired 관용 그대로. `initPetToggle()` 1줄 호출 추가.
- `src/renderer/pet-toggle.js` 신규 — `theme.js` 패턴 복제: localStorage `'ms-timer:pet'`(`'on'|'off'`, 기본 `'on'`), 부팅 시 `setPetVisible` 전송, P키 토글+영속+전송. 편집기 열림 중 keydown 전파 차단은 기존 target-editor 동작이 P키에도 동일 적용됨.
- `preload.cjs` — `sendTimerState(state)`, `setPetVisible(visible)` 2개 추가 (단방향 send만, 역방향 없음 유지).

## 9. Edge cases (Boil the Lake)

| 케이스 | 동작 |
|--------|------|
| 만료된 채 앱 시작 | 첫 틱에 `'expired'` 레벨 전송 → pet 축하. 팝업은 기존 에지 로직대로 침묵 (불변) |
| 만료 중 P로 pet 켬 | main 캐시 push → 즉시 축하 |
| 목표 변경으로 만료↔진행 왕복 | 다음 틱 diff가 레벨 재전송. 팝업 오발화 방지는 기존 rebaseline 소관 (불변) |
| 시계 역행/절전 복귀 | `computeRemaining`이 절대 차분이므로 레벨 자동 보정 |
| pet renderer 행/크래시 | show 게이트 미통과 시 창 미표시, gone 시 destroy. P 토글로 소생 |
| 모니터 분리 후 시작 | restore clamp가 우하단 폴백 |
| 드래그 중 pointer가 cat 밖으로 | 캡처 유지, 통과 재활성화 금지, pointerup에서 재판정 |
| 자정 경계 (night→dawn) | 30초 interval이 daypart 변경 감지 |
| localStorage 차단 환경 | theme.js 관용 그대로 try/catch — 세션 전용으로 동작 |
| P키를 문구 편집 중 누름 | 편집기 stopPropagation이 차단 (T키와 동일) |

## 10. 테스트 전략

### 단위 (`node --test`, `test/` flat, 한국어 시나리오명 — 기존 관용)

- `daypart.test.js` — 6개 경계값 (00:00, 06:00, 11:00, 17:00, 21:00, 23:59:59.999) 포함/미포함
- `timer-state.test.js` — 임박 경계 정확히 600000ms, 599999→imminent/600001→running, expired 우선
- `pet-state.test.js` — 우선순위 매트릭스 전수 (interacting × 3레벨 × 5daypart)
- `sprite-css.test.js` — keyframes 문자열의 row offset/end 좌표 수식, steps 수, frames=0/fps=0 가드
- `cat-sheet.test.js` — 생성물 검증: PNG IHDR 치수 == manifest 계산값(128×256), manifest 행 세트 == pet-state가 반환 가능한 row 이름 전체와 일치

### 수동 체크리스트 (spec §9와 함께 PR 본문에 첨부)

1. 투명·프레임리스 렌더, 고양이만 보임
2. 고양이 밖 클릭이 하부 앱에 전달
3. 고양이 드래그 이동 + 포커스 미탈취
4. 재시작 시 위치·토글 상태 복원
5. 시스템 시계 조작으로 5개 daypart 행동 전환 확인
6. 목표 10분 전 임박, 도달 시 축하 + 기존 팝업 공존
7. 만료 중 pet 켜기 → 즉시 축하
8. 창 숨김/최소화 시 애니메이션 정지 (작업 관리자 GPU 사용량)

### 구현 후 리뷰

fresh-context 리뷰어 1개에 **diff + 이 spec만** 전달 (빌더 대화 배제) — high-solo + review 1 구성.

## 11. 파일 인벤토리

**신규 (18)**

| 파일 | 책임 |
|------|------|
| `src/lib/daypart.js` | 시각→daypart 순수 함수 |
| `src/lib/timer-state.js` | remaining→레벨 순수 함수, IMMINENT_MS |
| `src/lib/pet-state.js` | 상태→row 이름 선택 순수 함수 |
| `src/lib/sprite-css.js` | manifest→CSS 문자열 순수 함수 |
| `src/pet-preload.cjs` | pet 창 contextBridge (역방향 리스너 방어 포함) |
| `src/renderer/pet.html` / `pet.css` / `pet.js` | pet 창 문서/스타일/composition root |
| `src/renderer/pet-sprite.js` | DOM측 sprite 적용·정지 정책 |
| `src/renderer/pet-toggle.js` | 타이머 창 P키 토글 |
| `src/renderer/cat-manifest.js` | 생성된 시트 manifest |
| `src/renderer/assets/cat-sheet.png` | 생성된 sprite sheet |
| `tools/generate-cat-sheet.mjs` | 시트+manifest 생성기 (의존성 제로) |
| `test/daypart.test.js` 외 4 | §10 단위 테스트 |

**수정 (4)**

| 파일 | 변경 |
|------|------|
| `src/main.js` | pet 창 생성/파기·relay·캐시·restore clamp·click-through·position 채널 |
| `src/preload.cjs` | sendTimerState, setPetVisible 추가 |
| `src/renderer/clock.js` | 레벨 diff 전송 3줄 + initPetToggle 1줄 |
| `package.json` | `gen:sprites` 스크립트 |

`package.json build.files`는 `src/**/*`라 PNG/신규 파일 자동 포함 — 빌드 설정 불변.

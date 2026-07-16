# 퇴근 알림 팝업 — 설계

날짜: 2026-07-16 (개정: 커스텀 라벨 컨셉 반영)
대상: `ms-timer`
선행 스펙: `2026-07-16-target-time-design.md`, `2026-07-16-custom-labels-design.md` (본 기능은 custom-labels 머지 후 그 위에서 구현한다)

> **[개정]** 팝업 문구는 이제 `커스텀 완료 라벨 ?? STRINGS[lang].expired` 다. **팝업은 both-valid 게이트를 복제해야 한다** — 두 라벨 키가 모두 `normalizeLabel`을 통과할 때만 커스텀으로 인정. `normalizeLabel(label-done만)` 으로 읽으면 앱 본체는 기본 문구로 폴백한 반쪽-손상 상태에서 팝업만 커스텀 문구를 보여주는 조용한 불일치가 생긴다. 게이트 로직은 localStorage 를 읽어 lib 에 못 들어가므로(3줄) 의도된 복제다.

## 사용자 결정 (고정)

1. **별도 팝업 창** + **본 창을 가장 앞으로**
2. **전환(false→true)일 때만 발화** — 만료 상태로 켜지거나 과거 시각을 설정하면 침묵
3. 끄기 스위치 없음 (최대 절제 — 주말 알림은 감수)
4. 팝업 내용 미니멀: 만료 문구 + 닫기 버튼
5. 무음

## 설계를 지배하는 실측 결과 (2026-07-16, 이 머신, Electron 43.1.1, Win11 26200)

외부 P/Invoke z-order 워크로 검증 — 앱 자신의 보고는 쓰지 않았다.

| 백그라운드 타이머에서 발화 | 결과 |
|---|---|
| `show()` / `focus()` / `moveTop()` / `flashFrame()` | **전부 BEHIND** |
| `setAlwaysOnTop(true)` 계열 | **유일하게 rank 0 도달** |
| 새 창 `{alwaysOnTop: true}` | **rank 0** (포그라운드 아닌 프로세스에서도) |

**따라서 "앞으로"는 raise(픽셀)이지 focus(키보드)가 아니다.** Windows는 화면은 주지만 키보드는 절대 주지 않는다. 파생 결론:

- **팝업에 Esc 닫기는 존재할 수 없다** — 키 입력은 사용자가 실제로 쓰던 앱으로 간다. 닫기는 **마우스 클릭 + 자동 타임아웃**뿐
- **자동 타임아웃은 main이 소유한다** — 팝업 렌더러는 죽거나 멈출 수 있다
- **`win.isFocused()`는 거짓말한다** (외부적으로 BEHIND인데 true 반환 — 실측). 어떤 검증에도 쓰지 않는다
- 다른 topmost 앱(카카오톡 등)과는 **동급 경쟁**이다. `'screen-saver'` 레벨은 Windows에서 plain `HWND_TOPMOST`로 매핑 — 절대 우위는 불가능하며, 이는 수정이 아니라 수용한다

## 아키텍처

```
clock.js (rAF 루프)
  │ computeRemaining(...).expired            ← 레벨 (매 프레임 재계산)
  ▼
createExpiryTracker().observe(expired)       ← src/lib/expiry-tracker.js [순수·테스트]
  │ false→true 전이에서 정확히 1회 true
  ▼
window.msTimer?.alertExpired()               ← src/preload.cjs (contextBridge, 채널 1개, 페이로드 0)
  │ ipcRenderer.send('ms-timer:expired')
  ▼
ipcMain.on('ms-timer:expired')               ← src/main.js
  ├─ raiseMain()   최소화면 restore + setAlwaysOnTop(true) + flashFrame(true)
  └─ openPopup()   별도 alwaysOnTop 창, main 소유 자동 닫기
```

- **단방향 채널 1개, 페이로드 없음.** 메시지의 존재 자체가 신호다. main→renderer 역방향은 없다 — 보낼 것이 없고, contextBridge의 주요 footgun이 전부 역방향에 산다.
- **팝업은 preload 없음** — `window.close()`로 닫히므로 채널이 필요 없다.

### preload가 `.cjs`인 이유 (순수 ESM 원칙의 문서화된 예외)

Electron 43에서 preload가 있으면 sandbox가 기본 활성이고, **sandboxed preload는 ESM을 로드할 수 없다.** `sandbox: false`로 돌리면 ESM은 되지만 Chromium OS sandbox를 스타일 때문에 버리는 셈이다. `.cjs` 한 파일이 올바른 비용이다. 이 예외는 선행 스펙(`2026-07-15`)의 순수 ESM 결정을 **1개 파일에 한해 수정**한다.

## 테스트되는 핵심 — `src/lib/expiry-tracker.js`

이 기능의 두 함정(launch-into-expired 오발화, 목표 변경 시 오발화)이 전부 여기 산다. 그래서 상태 전이를 렌더러가 아니라 **lib에 테스트와 함께** 둔다.

```js
/**
 * 만료 에지 추적 — 카운트다운이 "돌던 중" 목표에 도달한 순간에만 fire.
 * prev 는 3-값: null(관측 없음/재기준 직후) | false(진행 중 관측) | true(만료 관측).
 * `prev === false` 엄격 비교가 load-bearing — `!prev`로 쓰면 `!null === true`라
 * 18:30에 켠 첫 프레임에서 오발화한다 (clock.js의 lastExpired=null과 같은 함정).
 */
export function createExpiryTracker() {
  let prev = null;
  return {
    observe(expired) {
      const fire = prev === false && expired === true;
      prev = expired;
      return fire;
    },
    /** 목표 변경 시 호출자가 새 목표 기준의 현재 레벨을 심는다 */
    rebaseline(expired) { prev = expired; },
  };
}
```

**`rebaseline`이 tracker 안에 있는 이유:** 목표가 움직여 생긴 false→true는 시간이 흘러 생긴 것과 레벨만으로 구분 불가라 호출자가 심어야 하는데, 그 로직이 clock.js에 있으면 테스트 불가다. tracker에 두면 시나리오 전체가 테스트된다.

**테스트 시나리오 (`test/expiry-tracker.test.js`):** 진행→만료 1회 발화 / 만료 지속 재발화 없음 / 첫 관측이 true(18:30 기동)면 침묵 / rebaseline(true)→observe(true) 침묵 (과거 시각 설정) / rebaseline(false)→도달 시 발화 (미래로 재설정 후 재무장) / 자정 롤오버 후 재발화 / 트래커 2개 독립.

### clock.js 배선 (핵심 불변식 2개)

```js
const tracker = createExpiryTracker();
let target = initTargetEditor(targetEl, (next) => {
  target = next;
  // 커밋 순간 동기 재기준 — 틱을 기다리면 17:59:59.995의 커밋이 18:00 알림을 삼킨다
  tracker.rebaseline(computeRemaining(new Date(), next).expired);
});
// tick() 안:
if (tracker.observe(expired)) window.msTimer?.alertExpired();
```

1. **`tracker`는 `lastExpired`를 절대 건드리지 않는다.** `lastExpired`는 DOM(.expired 클래스/제목)의 소유자다. 섞으면 클래스 갱신이 영원히 멈춘다.
2. **`?.`가 유일한 쿠션이다.** preload 로드 실패 시 알림은 조용히 죽지만 rAF 루프(제품)는 산다.

### main.js 오케스트레이션

```
raiseMain():
  if isMinimized(): restore()
  setAlwaysOnTop(true); flashFrame(true)
  // 해제는 팝업 닫힘(클릭/타임아웃)에서 — 절대 영구 고정하지 않는다

openPopup():  // 싱글턴, replace-not-stack
  기존 팝업 있으면 destroy 후 새로 생성
  BrowserWindow { frame:false, resizable:false, skipTaskbar:true, alwaysOnTop:true,
                  show:false, contextIsolation:true, nodeIntegration:false }  // preload 없음
  자동 닫기 타이머는 생성 시점에 무장 (60s)   ← ready-to-show에 걸면 pre-paint 행에 뚫린다
  const w = popup
  w.on('closed', () => { if (popup === w) { popup=null; releaseMain(); clearTimeout(...) } })
     ← identity guard: 옛 팝업의 늦은 closed가 새 팝업 참조를 지우는 race 차단
  w.once('ready-to-show', () => { 배치; w.showInactive() })   ← 활성화를 아예 요청하지 않는다
  w.webContents.on('render-process-gone', dismiss)
  w.webContents.on('did-fail-load', dismiss)
  w.removeMenu()                               ← per-window, 본 창의 호출은 상속 안 됨
mainWin.on('closed', destroyPopup)             ← 좀비 차단: 팝업이 마지막 창이 되어 quit 정상 동작
```

**배치:** `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())`의 `workArea` 중앙 — 백그라운드 트리거에서 "사용자가 보는 모니터"의 최선 근사. `center:true`는 포커스된 창의 모니터로 가서 틀린다.

**팝업 내용:** `커스텀 완료 라벨 ?? STRINGS[lang].expired` (both-valid 게이트 복제 — 상단 개정 주석 참조) + 확인 버튼(`window.close()`). 팝업 창은 같은 `file://` origin 이라 localStorage 를 직접 읽는다. 테마 추종(`ms-timer:theme`), 레트로 대비는 카드 토큰(`--card-bg`/`--card-fg`) 사용으로 확보 — 릴 버그의 재발 방지를 위해 구현 시 대비 재계산.

## 실패 모드 (전부 "시계는 계속 돈다"로 수렴)

| 실패 | 동작 |
|---|---|
| Windows가 포그라운드 거부 | 요청 자체를 안 함 — raise만 사용 |
| 다른 topmost 앱이 위에 | rank 1 수용, 재시도 전쟁 안 함 |
| 팝업/본창 영구 고정 | 불가능 — main 소유 타이머 + 닫힘 시 해제 |
| 팝업 열린 채 재발화 | destroy 후 재생성, identity guard |
| 본 창 닫힘 (팝업 생존) | 팝업 destroy → window-all-closed → quit (기존 핸들러 무변경) |
| preload 실패 | `?.` → 시계 생존, 알림만 침묵 |
| 팝업 렌더러 crash/행/로드실패 | 3개 이벤트 모두 dismiss 경로 |
| 절전 17:30→19:00 기상 (같은 날) | 1회 발화 (1시간 늦게) — 자리에 있다는 뜻이라 정확 |
| 절전으로 자정 넘김 | 영구 침묵 — 일일 롤오버의 쌍대. 어제 알림을 오늘 울리는 것보다 낫다 |
| 시계 역행 (NTP) | 재무장 후 재발화 — 싱글턴이 흡수 |

## 구현 전 필수 프로브 (계획의 첫 태스크)

측정 안 된 OS 동작 4개 — 외부 z-order 워크로만 검증 (`isFocused()` 금지, 하네스는 ms-timer와 **다른 디렉터리** — 같은 디렉터리 Electron 인스턴스는 userData를 공유해 false negative를 냈던 전례):

1. 포커스 없는 frameless 팝업에서 `window.close()` 클릭이 동작하는가 (유일한 수동 닫기 경로)
2. 백그라운드 타이머에서 `restore()`가 최소화를 실제로 푸는가
3. 본창·팝업 둘 다 topmost일 때 나중에 설정한 팝업이 위인가
4. 본창 raise → 팝업 닫힘 → `setAlwaysOnTop(false)` 해제가 깨끗한가

## 범위 밖

- 끄기 스위치 / 사운드 / 스누즈 / 초과근무 카운트업 / 트레이 / 자동 시작
- `requestSingleInstanceLock` (실존하는 기존 갭이지만 별건)
- 스크린리더 알림 채널 — 포커스를 못 받는 창은 AT가 읽지 않는다 (구조적). 본창 document.title 갱신(i18n 브랜치에서 수정)이 실질 AT 채널
- macOS/Linux — 프로브가 Win11 전용이고 빌드도 `--win portable`뿐

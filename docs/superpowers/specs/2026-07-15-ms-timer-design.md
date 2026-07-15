# ms-timer — 18시 정각까지 1ms 카운트다운 데스크톱 앱

**Date:** 2026-07-15
**Status:** Approved

## 목적

근무 종료(18:00:00.000)까지 남은 시간을 1ms 단위로 실시간 표시한다. 시간의 흐름을 시각적으로 체감시키는 것이 유일한 목적이며, 다른 기능은 없다.

## 설계 전제: 60Hz 현실

모니터 refresh rate는 60Hz(16.7ms) 또는 144Hz(6.9ms)다. **ms 단위 3자리는 물리적으로 개별 프레임을 볼 수 없다** — 백의 자리는 읽히고, 십·일의 자리는 blur 잔상이 된다.

이는 버그가 아니라 제품의 본질이다. 초 단위 시계보다 시간의 흐름을 훨씬 강렬하게 체감시킨다. 설계는 이 blur를 숨기지 않고 의도적으로 활용한다(ms 자리 dim 처리).

## 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 스택 | Electron | Windows에 node v24 기설치, 추가 툴체인 0. Tauri는 MSVC Build Tools ~3GB 설치가 앱 자체보다 비쌈 |
| 18시 도달 시 | `00:00:00.000` 정지 + "퇴근" 표시 | 목적에 정확히 부합 |
| 창 | 일반 창 (타이틀바 有) | 구현 단순 |
| 자정 롤오버 | 매 프레임 `todayAt18()` 재계산 | 밤새 켜둬도 다음날 자동 재시작 |
| 주말·공휴일 | 처리 안 함 (YAGNI) | 주말엔 켜지 않음 |
| exe 형식 | electron-builder `--win portable` | 단일 exe, 설치 불필요 |

## 아키텍처

```
/mnt/c/Users/cloocus/ms-timer/
├── package.json
├── src/
│   ├── main.js              # Electron main: BrowserWindow 생성만
│   ├── lib/countdown.js     # 순수 함수 — 유일한 테스트 대상
│   └── renderer/
│       ├── index.html
│       ├── style.css
│       └── clock.js         # rAF 루프 + DOM 갱신
└── test/countdown.test.js   # node:test (내장, 의존성 0)
```

**경로 제약:** 프로젝트는 반드시 `/mnt/c` 아래에 위치한다. WSL 파일시스템(`/home/...`)에 두면 Windows node가 `\\wsl$` UNC 경로로 접근하며 electron-builder가 실패한다. 코드 편집은 WSL에서, `npm install`과 빌드는 `cmd.exe /c`로 Windows node에 위임한다(Windows node로 install해야 electron 바이너리가 win32로 받아짐).

## 핵심 로직: 절대 시각 기준 계산

```js
remaining = todayAt18(now).getTime() - now.getTime()
```

누적 방식(`remaining -= 16`)이 아닌 **절대 시각 차분**이다. 이 선택 하나로 다음이 전부 공짜로 처리된다:

- 드리프트 원천 차단 (누적 오차 없음)
- 절전 → 복귀 (누적 방식이면 슬립 3시간이 통째로 어긋남)
- NTP 시계 보정 / 시스템 시계 변경
- 타임존 변경

### 인터페이스

```js
computeRemaining(now: Date, targetHour = 18)
  → { expired: boolean, h: number, m: number, s: number, ms: number }
```

- `Date`를 주입받는 순수 함수 → 시간 의존 없이 모든 경계 테스트 가능
- `todayAt18(now)` = `now`와 같은 **날짜**의 로컬 18:00:00.000
- `remaining <= 0` → `expired: true`, 나머지 필드 전부 `0`
- 자정을 넘기면 `now`의 날짜가 바뀌므로 `todayAt18()`이 자동으로 새 날짜의 18시를 반환 → 카운트다운 재시작

## 렌더링

`requestAnimationFrame` 루프. 프레임마다 `Date.now()` → `computeRemaining()` → DOM `textContent` 갱신.

`setInterval(1ms)`는 쓰지 않는다 — 브라우저가 clamp하며, rAF보다 자주 그려도 모니터가 표시하지 못한다.

### 필수 요건

- **`font-variant-numeric: tabular-nums`** — 없으면 ms 자리 변경 시 글자 폭이 달라져 전체 레이아웃이 초당 60번 진동한다
- **`backgroundThrottling: false`** — 창이 가려지면 Chromium이 rAF를 멈춘다. 절대 시각 기준이라 복귀 시 정확한 값이 나오지만, 꺼두는 편이 자연스럽다

### 시각 설계

- 시/분/초는 또렷하게, **ms 3자리는 dim 처리**하여 별도 span으로 분리 — blur를 "흐르는 잔상"으로 읽히게 함
- 폰트 크기는 `clamp()`로 창 크기에 따라 스케일
- `expired` 시 `00:00:00.000` + "퇴근" 표시

## 보안

Electron 기본값 유지: `nodeIntegration: false`, `contextIsolation: true`.
렌더러는 `Date.now()`만 사용하므로 preload / IPC가 불필요하다.

## 테스트 전략

`countdown.js` 순수 함수만 테스트한다. rAF와 DOM에는 로직이 없다.

| 케이스 | 입력 | 기대 |
|---|---|---|
| 정상 카운트다운 | 09:00:00.000 | `{expired:false, h:9, m:0, s:0, ms:0}` |
| 18시 1ms 전 | 17:59:59.999 | `{expired:false, h:0, m:0, s:0, ms:1}` |
| 18시 정각 | 18:00:00.000 | `{expired:true, ...0}` |
| 18시 1ms 후 | 18:00:00.001 | `{expired:true, ...0}` |
| 18시 이후 실행 | 19:30:00.000 | `{expired:true, ...0}` |
| 자정 직후 | 00:00:00.000 | `{expired:false, h:18, m:0, s:0, ms:0}` |
| 자릿수 혼합 | 08:07:06.005 | `{h:9, m:52, s:53, ms:995}` |

## 빌드

```bash
cd /mnt/c/Users/cloocus/ms-timer
cmd.exe /c "npm install"
cmd.exe /c "npx electron-builder --win portable"
```

산출물: `dist/` 아래 단일 portable exe (~120-160MB).

## 범위 밖 (명시적 제외)

- 근무 종료 시각 설정 UI (18시 하드코딩, 필요 시 `targetHour` 인자로 확장 가능)
- 주말·공휴일 인식
- always-on-top / 프레임리스 / 창 위치 기억
- 알림·사운드
- 초과근무 카운트업

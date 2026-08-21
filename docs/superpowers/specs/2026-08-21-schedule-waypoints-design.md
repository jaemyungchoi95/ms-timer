# 일정 경유지(schedule waypoints) 설계 — 2차 MVP

- 날짜: 2026-08-21 / 브랜치: `feat/schedule-waypoints` (base origin/master)
- 상태: 채팅 설계 승인 완료, spec 리뷰 대기
- 목표 버전: 1.3.0 (minor)

## §0 요약과 확정 결정

단일 목표 시각(1알림)을 하루 일정으로 확장한다: **경유지 0..N개 + 최종 시각**.
시계는 항상 "다음 경유지"까지를 세고, 경유지가 지나면 알림 팝업이 뜬 뒤
자동으로 다음 구간 카운트다운으로 넘어간다.

브레인스토밍 확정 결정 (2026-08-21, 사용자 선택):

1. **표시 기준 — 구간(leg) 모델.** 메인 플립 시계는 다음 경유지까지 카운트다운.
   최종 병기안 기각 — 평소 화면에서 최종 시각은 패널을 열어야 보인다.
2. **확인 시맨틱 — 자동 진행.** "확인"은 팝업을 닫는 행위일 뿐이다.
   시간 흐름은 벽시계에서만 파생되고 게이트가 없다. 경유지 알림(점심·미팅)은
   본질적으로 사용자를 자리에서 떠나게 하는 사건과 동시에 울리므로,
   확인 게이트는 매일 멈춘 화면을 만든다 — 기각.
3. **경유지 이름 — 선택 입력.** 있으면 문구에 사용, 없으면 기본 문구.
4. **편집 UI — 창 내 오버레이 패널.** 기존 목표 시각 클릭 진입점 유지.
5. **이름 없는 경유지의 팝업 기본 문구 = "무언가 하실 시간입니다!"**
   (en: "TIME TO DO SOMETHING!"). 제목 폴백은 시각을 쓴다("11:30까지") —
   종결형 문구는 "~까지" 템플릿과 결합할 수 없다. (spec 승인 시 사용자 수정 반영)
6. **경유 프리셋 1차 포함** (2026-08-21 사용자 선택, §5b). 프로토를 만들어
   실사용 평가 후 세부를 재논의한다 — UI 세부는 프로토 피드백으로 변경될 수 있다.

## §1 데이터 모델과 저장

- `waypoints: [{h, m, name}]` — 0..최대 6개. `name`은 빈 문자열 허용(≤12자, trim).
- 기존 `target {h, m}`(최종)과 기존 저장 키 `ms-timer:target`은 **불변** —
  기존 사용자 마이그레이션이 존재하지 않는다.
- 신규 저장 키 `ms-timer:waypoints`: JSON 배열 직렬화.
  예: `[{"h":11,"m":30,"name":"점심"},{"h":14,"m":0,"name":""}]`

## §2 코어 로직 — `src/lib/schedule.js` (신규, 순수 함수)

검증 규칙은 이 모듈에만 존재한다 (target-time.js 관용).

- `parseWaypoints(str)` → 정규화 배열 or `null`.
  엄격 규칙: JSON 배열 / 항목은 h·m 정수 범위(parseTarget과 동일 0:00–23:59) /
  name은 문자열 trim ≤12자(빈 값 허용) / (h,m) 중복 없음 / 개수 ≤6.
  하나라도 위반이면 전체 `null` (parseTarget의 엄격성 관용). 반환은 시각 오름차순 정렬.
  읽기 실패·`null`은 호출부에서 빈 배열 폴백.
- `formatWaypoints(list)` → JSON 문자열.
- `validWaypoints(waypoints, target)` → **final보다 엄격히 이른** 경유지만 남긴다.
  편집기가 위반 커밋을 막지만, 저장 드리프트(수동 편집·부분 손상) 방어의
  단일 지점이다. 표시 선택과 tracker 생성이 모두 이 결과를 쓴다.
- `selectLeg(now, waypoints, target)` → 표시용 현재 구간.
  valid 경유지 중 `computeRemaining(now, wp).expired === false`인 가장 이른 것
  → `{kind:'waypoint', wp}`, 없으면 `{kind:'final', target}`.
  "지났다"의 기준은 computeRemaining 하나로 통일한다(diff ≤ 0).

### 발화 로직 — 표시와 분리가 핵심

- `createScheduleAlarms(waypoints, target)` (schedule.js, 순수 팩토리) —
  checkpoint별 **독립 expiry-tracker**(valid 경유지 각 1개 + 최종 1개)를 내부에
  품고 두 메서드를 노출한다:
  - `observe(now)` → 이번 틱에 발화한 checkpoint 목록(정렬 순서, 최종이 마지막).
  - `rebaseline(now)` → 전체 tracker에 현재 레벨 심기.
  clock.js는 이 팩토리를 배선만 한다 — 다중 tracker 조합이 lib에 있어야
  §8의 시나리오 테스트가 가능하다 (로직 전부 lib 원칙).
- 매 틱, 각 checkpoint의 `computeRemaining(now, cp).expired`를 해당 tracker가
  관찰하고 false→true 에지에서만 발화한다.
- 분리 이유: 파생 선택(selectLeg)은 경유지가 지나는 순간 다음 구간으로 먼저
  점프하므로, 표시용 remaining에서는 만료 에지가 구조적으로 관측되지 않는다.
  발화를 표시에서 분리하지 않으면 경유지 팝업이 영원히 안 뜬다.
- 일정 편집 커밋 시: tracker 전체 재생성 + 각각 현재 레벨로 **동기 rebaseline**
  (기존 17:59:59.995 커밋 함정 관용). 이미 지난 시각의 신규 경유지는 true로
  시작하므로 울리지 않는다.
- 자정 재무장: computeRemaining이 다음 날 기준으로 다시 미래를 보며
  expired=false를 관찰 → 3-값 tracker가 자동 재무장. 추가 코드 없음.
- `observe(now)`의 반환 순서(경유지 오름차순 → 최종 마지막)가 규약이다 —
  clock.js는 발화 목록을 순서대로 alertExpired 하고, §6-4의 replace 순서
  보장이 여기에 걸린다.

## §3 문구 규칙

strings.js에 신규 키(ko/en 대칭 — 기존 테스트가 강제):

| 키 | ko | en |
|---|---|---|
| `waypointUntil` (치환 템플릿) | `{}까지` | `UNTIL {}` |
| `waypointFallback` (팝업 폴백) | `무언가 하실 시간입니다!` | `TIME TO DO SOMETHING!` |
| `ariaWaypointName` | `일정 이름` | `stop name` |
| `ariaAddWaypoint` | `일정 추가` | `add stop` |
| `ariaRemoveWaypoint` | `일정 삭제` | `remove stop` |

템플릿은 `'{}'` 1회 치환(String.replace)로 적용한다.

- **제목** (구간별):
  - waypoint 구간: `waypointUntil` 템플릿에 `name || formatTarget(wp)` —
    "점심까지" / 이름 없으면 "11:30까지".
  - final 구간: 기존 그대로 — 커스텀 run/done 라벨 ?? 언어별 기본 문구.
    waypoint 구간 동안만 waypoint 문구가 커스텀 run 라벨보다 우선한다.
- **팝업**:
  - waypoint: `name || STRINGS[lang].waypointFallback`.
  - final: 기존 시맨틱 그대로 — 커스텀 done 라벨 ?? `STRINGS[lang].expired`.
  - 제목 폴백(시각)과 팝업 폴백(문구)이 비대칭인 것은 의도다: 제목은 카운트다운
    대상 정보가 필요하고, 팝업은 도착 선언이다.

## §4 알림 경로 — 페이로드 전달과 팝업 단일화

현재 `ms-timer:expired`는 무페이로드이고 popup.js가 localStorage 검증
로직(both-valid 게이트)을 복제해 문구를 읽는다. waypoint는 "어느 알림인지"가
필요하므로:

- renderer(clock.js)가 §3 규칙으로 **문구를 결정**해
  `alertExpired(text)` 페이로드로 보낸다 (preload.cjs 시그니처 확장, 채널명 유지).
- main.js는 검증(문자열 타입, 길이 ≤40) 후 `popup.loadFile(..., {query:{text}})`로
  전달한다. 검증 실패 시 무페이로드로 취급한다.
- popup.js는 query `text` 우선, 없으면 `STRINGS[lang].expired` 폴백.
  문구는 textContent로만 삽입한다(마크업 해석 없음).
  → 기존 readDoneLabel의 both-valid 게이트 복제가 **소멸**한다 (문구 결정권이
  renderer 단일 소스로 이동). theme/lang의 localStorage 읽기는 유지.
- 팝업 수명주기(60s 자동 닫힘·singleton replace-not-stack·raise/release)는 불변.

## §5 UI — 오버레이 패널

- 진입점: 헤더 목표 시각 클릭(기존과 동일) → 창 내 오버레이 패널.
  기존 4-cell 단독 편집기는 패널에 흡수된다 (target-editor.js →
  schedule-editor.js로 확장, localStorage 읽기/쓰기 소유).
- 행 구성: `[4-cell HH:MM] [이름 input maxlength=12] [✕ 삭제]` × N
  + `[+] 행 추가`(6행에서 비활성) + **최종 행**(4-cell만 — 이름 칸 없음,
  run/done 라벨 소관 — 삭제 불가) + `✓ 일괄 확정` / `↻ 취소`.
- 검증(live, 기존 invalid 관용 — 빨간 테두리 + ✓ 비활성):
  시각 형식(parseTarget 경로) / **waypoint < final 엄격 강제** / 시각 중복 거부.
- 커밋은 원자적이다: waypoints + final을 한 번에 저장·적용하고 동기
  rebaseline한다. 취소(↻/Esc)는 전체 폐기.
- 키 처리: Enter 확정 / Esc 취소 / 패널 내 keydown stopPropagation
  (T·L·P 토글 격리) — 기존 편집기 관용 그대로. 4-cell 셀 이동·덮어쓰기 동작과
  aria 키(data-l10n)도 기존 패턴 재사용.
- **헤더 시각 표시 = 현재 구간의 목표 시각** (점심 전엔 `11:30`).
  구간 전환 시 갱신된다. 편집 패널이 열려 있는 동안 표시 갱신은 display
  요소에만 적용되고 편집 중 스냅샷은 건드리지 않는다.

## §5b 경유 프리셋

프리셋 = 저장된 `{h, m, name}` — waypoint와 같은 모양의 **복사 원본**이다
(copy-on-insert). 유형(type) 필드·분류 체계는 두지 않는다: 프리셋의 정체는
문구 그 자체이고, 삽입 후 값은 일반 행과 동일하게 자유 편집한다.
프리셋 수정·삭제는 기존 일정에 영향을 주지 않는다.

- **코어 `src/lib/presets.js`** (신규, 순수 모듈):
  - `parsePresets(str)` / `formatPresets(list)` — 엄격 관용. 규칙: **문구 필수**
    (trim 1..12자), 시각 범위(parseTarget과 동일), **문구 키 중복 없음**,
    개수 ≤6. 위반 시 전체 null → 호출부 빈 배열 폴백. 시각 오름차순 정렬 반환.
  - `upsertPreset(list, preset)` — 같은 문구 = 시각 갱신, 새 문구 = 추가.
    잘못된 preset이거나 신규인데 캡(6) 초과면 null 반환(호출부는 무시).
  - 저장 키 `ms-timer:waypoint-presets` 신규.
- **UI (패널 확장)**:
  - 행 목록 아래 **프리셋 칩 스트립**: 칩 = `문구 HH:MM` + 삭제 ✕.
    칩 클릭 → 행 추가 + 값 복사(행 캡 6이면 칩 비활성), ✕ → 프리셋 삭제.
  - 각 waypoint 행에 **☆(프리셋으로 저장)**: 시각 유효 + **문구 있는 행에만
    활성** — 이름 없는 프리셋은 무의미(시각만 복사할 거면 직접 입력이 빠름).
    캡 상태에서는 기존 문구 갱신만 허용, 신규는 비활성.
  - **☆는 즉시 저장** — 프리셋은 일정이 아니라 라이브러리다. 패널 ↻ 취소와
    무관하게 남으며, 일정 커밋(✓)의 원자성은 그대로다.
  - 칩 삽입으로 생긴 행도 일반 행과 동일한 live 검증·커밋 시 정렬을 탄다.
  - 패널이 최소 창(420×200)을 넘으면 내부 스크롤(overflow-y).
- **엣지**: 프리셋 저장 손상 → 빈 배열 폴백(§6-7과 동일 관용).

## §5c UI v2 — 프로토 1차 피드백 재설계 (2026-08-21, 사용자 지시. §5·§5b UI를 대체)

프로토 평가 결과 로직 합격, 편집 UI 전면 재설계. Figma mock 기준.

1. **헤더**: 우측 시각 표시 제거. `[현재 구간 뱃지] 제목` 만 남고 **제목 클릭 → 일정 모달**.
   별도 라벨 편집기(label-editor.js)는 폐지 — Finish 행의 두 문구 칸이 계승한다.
2. **모달** (창 중앙 오버레이): 우상단 저장(save)·닫기(x) 아이콘 —
   저장 = 신규/수정/삭제 일괄 커밋 + 닫힘, X = 전부 폐기 + 닫힘.
   행 = `[뱃지][HH:MM 4칸][표시 문구][도달 시 문구][✕]`.
   **Finish 행** = 항상 1개·✕ 없음·FINISH 뱃지 고정, 두 문구 칸 = 기존 진행/완료
   라벨 계승 (저장 키 `ms-timer:label-run/done` 유지, both-valid 게이트 폐지 —
   칸별 독립 `커스텀 ?? 기본` 폴백). 우하단 clock-plus = 행 추가(**맨 위** 삽입).
   **정렬·정규화는 저장 시점** — 편집 중 입력 순서 유지. live 검증(형식/경유<최종/
   시각 중복)은 유지: 위반 행 빨간 테두리 + 저장 비활성.
3. **문구 시맨틱** (§3 대체): 표시 문구 = 그 구간 제목 as-is ('' → "HH:MM까지" 템플릿
   폴백). 도달 문구 = 팝업 문구 (경유 '' → waypointFallback, Finish '' → expired 기본).
   Finish 도달 문구는 만료 후 제목 겸용(기존 done). placeholder: "표시 문구 입력" /
   "도달 시 문구 입력" (신규 strings 키, ko/en 대칭).
4. **뱃지**: waypoint 스키마에 `icon` 필드 — 6종 키(lunch·meeting·tea·work-a·work-b·
   finish), 신규 행 기본 lunch. 뱃지 클릭 → 6종 가로 picker → 교체. **노출 3곳**:
   모달 행 / 알림 팝업(아이콘+문구) / 메인 헤더(현재 구간 아이콘, final 구간 = finish).
5. **프리셋 UI 제거** (☆/칩). lib presets.js + 테스트는 휴면 보존.
6. **에셋** `src/renderer/assets/icons/` 9종: 뱃지 6(컬러 플랫) + 크롬 3(clock-plus·
   save·x — Lucide 흑색 스트로크, 다크 테마에서 CSS invert).
7. **저장 스키마 v2**: `ms-timer:waypoints` = `[{h,m,run,done,icon}]` 엄격 parse.
   v1 `{name}` 데이터는 전체 폴백으로 초기화 — 프로토 단계라 허용(사용자 인지).

## §6 엣지 케이스 (전부 구현 범위)

1. **낮에 기동**: 지난 경유지 tracker는 null 센티널로 침묵(기존
   launch-into-expired 철학), 표시는 다음 미래 구간부터.
2. **자정 롤오버**: 전체 checkpoint 재무장, 표시는 첫 구간부터. 코드 0줄.
3. **커밋 순간**: 동기 rebaseline. 이미 지난 시각의 신규 경유지는 안 울림.
4. **절전 복귀로 여러 checkpoint 통과**: 각 tracker가 같은 틱에 발화하지만
   팝업 replace-not-stack + 정렬 순회로 **가장 늦은 checkpoint 하나만** 남는다
   (알림 폭탄 방지). 최종까지 지났으면 최종 팝업이 남는다.
5. **편집 중 checkpoint 도달**: rAF 루프는 계속 돌므로 정상 발화. 커밋 시
   rebaseline이 이후를 정리.
6. **경유지 0개**: 기존 단일 target 동작과 100% 동일 — 하위 호환의 회귀 기준.
7. **저장 손상**: parseWaypoints null / 읽기 예외 → 빈 배열 폴백.
   final과의 모순(wp ≥ final)은 validWaypoints가 걸러낸다.
8. **final 동작 불변**: 도달 시 00:00:00.000 멈춤·완료 문구·expired 지속·
   내일로 안 넘김·`.expired` 클래스 — 전부 기존 그대로. waypoint 구간에서는
   expired 레벨이 발생하지 않는다(선택이 즉시 넘어감).

## §7 Pet 연동

- `timerStateOf(computeRemaining(now, 현재구간))` — imminent(10분 전)가
  **구간 기준**이 된다: 고양이가 점심 10분 전에도 기대 모드. 의도된 제품 동작.
- 축하(expired)는 최종에만 전달된다 — waypoint 통과는 §6-8에 따라 expired
  레벨을 만들지 않는다. 구조의 자연 귀결이며 원하는 동작과 일치.
- pet 창·스프라이트·main relay·상태 whitelist 변경 없음.

## §8 테스트 (lib 전수 — 기존 원칙: 로직 전부 lib, 테스트 전부 lib)

- `test/schedule.test.js` (신규):
  parse/format 왕복 / 정렬·중복·범위·개수 캡·name 규칙 / 손상 입력 null /
  validWaypoints의 final 경계(같음·이후 제거) /
  selectLeg 경계(정확히 경유지 시각, 전부 지남, 빈 배열, 최종만 남음).
- `createScheduleAlarms` 시나리오(schedule.test.js):
  기동 침묵 / 자정 재무장 / rebaseline / 절전 다중 통과의 발화 목록·순서.
- `test/presets.test.js` (신규): parse/format 왕복 / 문구 필수·중복·캡 /
  upsert 갱신·추가·거부 / 손상 입력 null.
- `test/strings.test.js`: ko/en 키 대칭이 신규 키를 자동 강제(기존 테스트).
- 기존 테스트 전부 green 유지 — 경유지 0개 경로가 기존 동작과 동일함을 보장.
- renderer(패널 DOM·popup query)는 기존 원칙대로 테스트 비대상.

## §9 파일 변경 지도

| 파일 | 변경 |
|---|---|
| `src/lib/schedule.js` | 신규 — §2 전부 |
| `src/lib/presets.js` | 신규 — §5b 코어 |
| `src/lib/strings.js` | §3 신규 키 + 프리셋 aria 키 |
| `src/renderer/clock.js` | createScheduleAlarms 배선·leg 선택·제목/발화 문구·페이로드 전송 |
| `src/renderer/schedule-editor.js` | target-editor.js 확장/대체 — §5 패널 |
| `src/renderer/index.html` | 패널 마크업 |
| `src/renderer/style.css` | 패널 스타일 |
| `src/preload.cjs` | alertExpired(text) 페이로드 |
| `src/main.js` | 페이로드 검증 → popup query 전달 |
| `src/renderer/popup.js` | query 우선 문구, readDoneLabel 복제 제거 |
| `README.md` | 조작법 갱신 |
| `test/schedule.test.js` | 신규 |
| `test/presets.test.js` | 신규 |

**불변 영역**: flip/reel 렌더링, 테마(T), 언어 토글(L) 메커니즘, pet 창·스프라이트·
opacity, 팝업 수명주기, countdown.js·expiry-tracker.js·timer-state.js 모듈 자체.

## §10 수동 체크리스트 (Windows 실기동)

- [ ] 경유지 2개 + 최종 등록 → 각 시각에 팝업, 문구 확인(이름/폴백)
- [ ] 경유지 통과 직후 제목·헤더 시각·플립이 다음 구간으로 전환
- [ ] 팝업 확인 클릭·60초 방치 모두 raise 해제
- [ ] 경유지 0개로 만들면 기존 v1.2 동작과 동일
- [ ] 재시작 후 일정 복원, 자정 넘김 후 다음 날 재발화
- [ ] 절전(또는 시계 변경)으로 2개 통과 → 팝업 1개만
- [ ] 고양이: 경유지 10분 전 imminent, 최종에만 축하
- [ ] 프리셋: ☆ 저장(이름 없는 행은 비활성) → 칩 삽입 → ✕ 삭제 → 재시작 후 유지

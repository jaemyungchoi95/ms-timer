# 용도별 이름 편집 (커스텀 라벨) — 설계

날짜: 2026-07-16
대상: `ms-timer`
선행 스펙: `2026-07-16-i18n-toggle-design.md` (본 스펙이 그 범위를 축소·흡수한다 — 아래 "i18n 스펙과의 관계")

## 배경 — 컨셉 확장

원래 이 앱은 퇴근 카운트다운이었다. 그러나 타이머의 용도는 시간적으로 유동적이다 — 회의까지, 마감까지, 점심까지. 하드코딩된 "퇴근까지/퇴근"은 target 시각을 바꿔 쓰는 순간 거짓말이 된다.

**제목 한 쌍(진행/완료)을 사용자가 편집하고 영속한다.** 직전에 쓰던 이름이 다음 실행의 기본값이 되고, 용도가 바뀌면 그때 이름을 바꾼다 — target 시각과 정확히 같은 사용 모델이므로 같은 UI 문법(클릭 → 편집 → ✓/↻)을 쓴다.

## 결정 사항 (사용자 확정)

| 항목 | 선택 |
|---|---|
| 편집 대상 | **한 쌍** — 진행 문구("회의까지") + 완료 문구("회의 시작") |
| 편집 UI | 제목 클릭 → 입력창 2개 + ✓/↻. Enter 확정, Esc 취소 (target-editor 문법) |
| `L` 토글 | **유지, 범위 축소** — aria-label ×6 + `html[lang]` + **미편집 시 기본 문구**만 전환. 커스텀 이름은 건드리지 않음 |
| 알림 팝업(B) | 그대로 진행, 본 브랜치 머지 후. 팝업 문구 = 완료 문구 |
| 검증 | **캡처/CDP 시각 검증 없음** — 코드 + lib 테스트까지만. 실행 확인은 사용자가 재빌드 후 직접 |

## 우선순위 규칙 (이 스펙의 핵심 한 줄)

```
표시 문구 = 커스텀 라벨 (localStorage)  ??  STRINGS[lang] 기본 문구
```

- 커스텀이 없으면: 기본 문구가 언어를 따른다 — ko면 "퇴근까지/퇴근", en이면 "TIME TO GO/GO HOME". `L`이 이를 전환한다.
- 커스텀이 있으면: 그대로 표시. `L`은 aria/`html[lang]`만 바꾼다 (사용자 결정 "눈에 보이는 변화 없음").
- **되돌리기 경로:** 편집창에서 두 칸을 비우고 ✓ → 커스텀 삭제 → 기본 문구 복귀. (빈 문자열 저장이 아니라 키 삭제다 — 빈 제목이라는 상태는 존재하지 않는다.)

## 아키텍처

```
src/lib/                순수 · 테스트 있음
  strings.js            NEW — ko/en 기본 문구 + aria 문자열 (i18n 스펙에서 승계)
  label.js              NEW — normalizeLabel(str) : 단일 검증 경로
src/renderer/           표현 · 테스트 없음
  lang.js               NEW — L 키 토글 (축소 범위)
  label-editor.js       NEW — 제목 표시/편집 + localStorage
  clock.js              라벨 상태 보유, applyTitle 단일 함수
  index.html            제목을 버튼화 + 편집 폼
  style.css / themes.css  편집 폼 스타일 (target-editor 토큰 재사용)
```

### `src/lib/label.js` — 단일 검증 경로 (parseTarget 패턴의 반복)

```js
/**
 * 라벨 정규화. trim 후 1~12자면 그 문자열, 아니면 null.
 * 사용자 입력과 localStorage 복원값이 모두 이 함수를 탄다 —
 * 검증 규칙은 여기에만 존재한다.
 */
export function normalizeLabel(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim();
  return s.length >= 1 && s.length <= 12 ? s : null;
}
```

**12자 상한과 CSS 방어의 역할 분담 (실측 기반):** i18n 스펙의 측정을 커스텀 라벨에 적용하면 — 최소 창(420px, header 304px)에서 제목 충돌 임계는 **표시 모드 target 기준 ≈244px, target 편집기 열림 기준 ≈155px**이고 이 비율은 scale-invariant다. 한글 1자 ≈ 1em(최소 창에서 ≈20px)이므로:

- 한글 12자 ≈ 242px — 표시 모드에선 아슬하게 통과하지만 **target 편집기가 열리면 실제로 겹친다.** 도달 가능한 상태다.
- 따라서 CSS `max-width` + `text-overflow: ellipsis`는 이론상 방어가 아니라 **이 코너 케이스의 실질 방어선**이다: 긴 이름 + target 편집 중이라는 짧은 순간에 제목이 말줄임되고, 편집기를 닫으면 온전히 돌아온다.

12자는 "말줄임 없이 항상 안전"의 상한이 아니라 입력 폭주를 막는 상한이다. 항상-안전 상한(한글 7자)은 "TIME TO GO"(10자) 같은 정상적인 라틴 이름을 막아버리므로 채택하지 않는다 — 글자 수는 폭의 나쁜 대리 지표이고, 진짜 방어는 픽셀 기반인 CSS가 맡는다.

**빈 문자열이 null인 것이 load-bearing:** 복원 시 null → 기본 문구 폴백, 편집 시 null → 해당 칸 무효. 단 **두 칸 모두 비어 있으면** "커스텀 삭제" 의도로 해석하여 ✓를 허용한다 (위 되돌리기 경로). 한 칸만 비면 무효 — 반쪽 커스텀은 존재하지 않는다.

### 저장 형식

`localStorage`, 키 `ms-timer:label-run` / `ms-timer:label-done`, 값은 평문 (theme/target과 동일하게 DevTools에서 사람이 읽고 고칠 수 있다). 두 키는 **원자적으로 함께** 쓰고 함께 지운다. 복원 시 **둘 다** `normalizeLabel`을 통과해야 커스텀으로 인정 — 한쪽만 유효하면 둘 다 무시하고 기본 문구 (반쪽 상태 차단).

### `src/renderer/label-editor.js`

target-editor와 같은 골격: `initLabelEditor(root, onChange) → {run, done} | null` (null = 커스텀 없음, 기본 문구 사용).

- 표시 모드: 제목 자체가 클릭 타겟 (`<button>` 래핑 또는 role)
- 편집 모드: `[진행 문구][완료 문구] ✓ ↻` — 텍스트 입력 2개, `maxlength="12"`
- 검증: 매 입력마다 `normalizeLabel` × 2 → 두 칸 유효 **또는** 두 칸 모두 공백이면 ✓ 활성
- ✓: 두 칸 유효 → 저장 + `onChange({run, done})` / 두 칸 공백 → 키 삭제 + `onChange(null)`
- Esc/↻: 파기
- **편집기 컨테이너에서 `stopPropagation`** — target-editor가 확립한 패턴. `T`/`L` 키가 편집 중 무시되는 것을 공짜로 상속
- 자유 텍스트 입력이므로 target-editor의 숫자 필터·자동 이동은 **복사하지 않는다** — 그건 고정폭 숫자 칸의 문법이다

### `clock.js` — applyTitle 단일 함수

```js
function applyTitle() {
  const s = labels ?? { run: STRINGS[lang].countdown, done: STRINGS[lang].expired };
  const text = (lastExpired === true) ? s.done : s.run;
  titleEl.textContent = text;
  document.title = text;          // 기존 버그 수정: 작업표시줄도 상태를 따라간다
}
```

호출: ① 부팅 ② expired 전이 가드 안 ③ 라벨 onChange ④ 언어 onChange. 문구를 쓰는 곳이 이 함수 하나뿐이므로 4개 트리거가 흩어져도 어긋날 수 없다.

### `src/renderer/lang.js` (i18n 스펙에서 축소 승계)

- `L` 키 순환, `ms-timer:lang` 영속, 첫 실행은 `navigator.language` 추정 (기존 결정 유지)
- 적용 범위: aria-label ×6 + `html[lang]` + `applyTitle()` 재호출 (커스텀 없을 때만 눈에 보이는 효과)

## 엣지 케이스

| 케이스 | 처리 |
|---|---|
| 저장값 한쪽만 유효/존재 | 둘 다 무시 → 기본 문구 (반쪽 커스텀 차단) |
| 12자 초과 저장 시도 | 불가능 — maxlength + normalizeLabel 단일 경로 |
| 공백만 입력 | trim → null → 그 칸 무효 |
| 두 칸 모두 공백 + ✓ | 커스텀 삭제, 기본 문구 복귀 (의도된 리셋 경로) |
| 편집 중 T/L | stopPropagation이 차단 (기존 메커니즘) |
| expired 상태에서 라벨 확정 | onChange → applyTitle이 `lastExpired === true`를 읽어 완료 문구를 즉시 표시 |
| 편집 중 expired 전이 | tick 가드 → applyTitle. 편집 폼은 열려 있어도 배경 제목만 바뀜 — 충돌 없음 |
| localStorage 차단 | try/catch → 세션 전용 (기존 패턴) |
| target-editor와 동시 편집 | 두 편집기는 독립 DOM·독립 상태. 동시에 열려도 서로 간섭 없음 |

## 테스트

- `test/label.test.js` (신규): 경계 1자/12자/13자, 공백 trim, 공백만, 비문자열, null/undefined
- `test/strings.test.js` (i18n 스펙 승계): ko/en 키 집합 동일성, 빈 문자열 없음
- 기존 39개 무손상

## i18n 스펙과의 관계

`2026-07-16-i18n-toggle-design.md`의 다음 항목은 본 스펙으로 **대체**된다: 제목 문구의 언어 전환(→ 우선순위 규칙), applyLang의 제목 담당(→ applyTitle). 나머지(문자열 전수조사, 실측 사실, aria/html[lang] 전환, strings.js, 스토리지 패턴)는 그대로 유효하며 본 브랜치에서 함께 구현한다.

## 알림 팝업(B)과의 접점

팝업 문구 = `완료 문구` (커스텀 ?? `STRINGS[lang].expired`). 팝업 창은 같은 origin이라 localStorage를 직접 읽을 수 있고, 복원 규칙(둘 다 유효해야 커스텀)은 lib의 `normalizeLabel`을 import해 동일 경로로 검증한다.

## 범위 밖

- 이름 프리셋/히스토리 (직전 값 하나만 기억 — "마지막 값이 기본값" 모델 유지)
- 이름별 target 시각 기억 (용도 전환 시 시각도 따라 바뀌는 것 — 별개 기능)
- exe 파일 속성 영문화 (빌드 시점 고정)

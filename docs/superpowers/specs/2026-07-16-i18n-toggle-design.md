# 한/영 언어 토글 — 설계

날짜: 2026-07-16
대상: `ms-timer`
선행 스펙: `2026-07-16-target-time-design.md`

> **[2026-07-16 개정]** 컨셉 확장으로 본 스펙의 **제목 문구 전환 부분은 `2026-07-16-custom-labels-design.md`로 대체**되었다 (우선순위: 커스텀 라벨 ?? 언어별 기본 문구). `L` 토글의 범위는 aria-label ×6 + `html[lang]` + 미편집 시 기본 문구로 축소된다. 실측 사실·문자열 전수조사·strings.js·스토리지 패턴은 그대로 유효하며 custom-labels 브랜치에서 함께 구현한다. `applyLang(lang, expired)`는 custom-labels 스펙의 `applyTitle()`로 흡수된다.

## 배경

앱을 동료에게 공유할 예정이고, 영문 Windows를 쓰는 동료가 있다. UI 문자열은 두 개의 짧은 단어("퇴근까지" / "퇴근")가 전부라 번역 비용은 낮지만, 문자열이 **HTML·JS·aria-label·OS 타이틀바에 흩어져 있어** 하나라도 놓치면 반쪽짜리 번역이 된다. 이 스펙의 절반은 번역이 아니라 **전수조사 결과의 고정**이다.

## 실측으로 확정된 사실 (2026-07-16, 이 저장소에서 측정)

1. **`document.title`은 OS 타이틀바·작업표시줄을 실제로 바꾼다. IPC 불필요.** Electron의 기본 `page-title-updated` 핸들러가 창 제목을 따라 바꾼다. CDP로 실측 확인.
2. **`main.js:10`의 `title` 옵션은 `<title>` 태그에 진다.** index.html 파싱 전 찰나에만 유효한 사실상 dead string. 실측 확인.
3. **기존 버그: `document.title`을 아무도 갱신하지 않는다.** `clock.js`는 `titleEl.textContent`만 쓰므로 퇴근 후에도 작업표시줄은 영원히 "퇴근까지"다. 본 스펙이 함께 고친다.
4. **`lastExpired` 메모 가드 함정.** 제목은 `expired`가 **변할 때만** 다시 그려진다. 언어를 토글해도 expired가 그대로면 제목이 다음 전이까지 stale — 실측 확인. 순진한 토글은 깨진다.
5. **레이아웃 안전.** "TIME TO GO" 최악 케이스(최소 창 420px + 편집기 열림)에서 gap 14.02px, 겹침 없음. title과 frame 폭이 모두 `--card-h`에 선형 비례라 **어떤 창 크기에서도 비율 동일** (scale-invariant).
6. **CSS `content:` 속성 0건.** style.css/themes.css는 i18n 무관.

## 결정 사항

| 항목 | 선택 | 근거 |
|---|---|---|
| 문구 | "퇴근까지"→"TIME TO GO", "퇴근"→"GO HOME" | 사용자 결정 |
| 토글 키 | `L` (`T`는 테마가 점유) | |
| 첫 실행 기본값 | `navigator.language`가 `ko`로 시작하면 ko, 아니면 en | 사용자 결정. 이후엔 저장값 우선 |
| 영속화 | `localStorage`, 키 `ms-timer:lang`, 값 `"ko"` \| `"en"` | theme/target과 동일 패턴 |
| 문자열 위치 | `src/lib/strings.js` (순수 데이터) | lib 경계상 순수 데이터는 lib. 테스트로 ko/en 키 대칭을 고정할 수 있다 |
| exe 파일 속성 | 건드리지 않음 | `description` 등은 빌드 시점에 박혀 런타임 토글 불가. 범위 밖 |
| ✓ / ↻ 글리프 | 그대로 | locale-invariant |

## 아키텍처

### `src/lib/strings.js` (신규 — 순수 데이터)

```js
export const STRINGS = {
  ko: {
    countdown: '퇴근까지', expired: '퇴근',
    ariaH10: '시 십의 자리', ariaH1: '시 일의 자리',
    ariaM10: '분 십의 자리', ariaM1: '분 일의 자리',
    ariaOk: '확정', ariaCancel: '취소',
  },
  en: {
    countdown: 'TIME TO GO', expired: 'GO HOME',
    ariaH10: 'hours, tens digit', ariaH1: 'hours, ones digit',
    ariaM10: 'minutes, tens digit', ariaM1: 'minutes, ones digit',
    ariaOk: 'confirm', ariaCancel: 'cancel',
  },
};
export const LANGS = Object.keys(STRINGS); // ['ko', 'en']
```

**테스트 (`test/strings.test.js`):** 두 로케일의 키 집합이 완전히 동일함을 고정 — 새 문자열을 한쪽에만 추가하면 테스트가 깨진다. 이것이 이 파일을 lib에 두는 실질적 이유다.

### `src/renderer/lang.js` (신규 — 렌더러)

**`initTheme`이 아니라 `initTargetEditor` 패턴을 미러링한다** — 초기값 반환 + 변경 시 콜백. 이유: 테마는 CSS 변수라 CSS만 알면 되지만, 언어는 `clock.js`가 expired 전이마다 현재 언어를 **읽어야** 한다.

```js
export function initLang(onChange) → 'ko' | 'en'
```

- 읽기: 저장값이 `LANGS`에 있으면 사용, 없으면 `navigator.language` 추정 (validate-on-read, theme.js와 동일 방어)
- `L`/`l` keydown → 순환 → 저장 → `onChange(lang)`
- 편집기의 `stopPropagation` 덕에 **편집 중 L 키는 공짜로 무시된다** (target-editor가 컨테이너에서 전파를 끊음 — 검증된 기존 동작)

### 언어 적용은 단일 함수로

theme.js의 "적용 로직 2곳 중복"을 복사하지 않는다. 적용 대상이 9곳(h1, document.title, aria ×6, html[lang])이라 흩어지면 반드시 어긋난다.

```js
// clock.js
function applyLang(lang, expired) {
  const s = STRINGS[lang];
  titleEl.textContent = expired ? s.expired : s.countdown;
  document.title = expired ? s.expired : s.countdown;   // 기존 버그 수정 포함
  document.documentElement.lang = lang;
  /* aria-label ×6 — data-l10n 속성으로 조회하여 일괄 적용 */
}
```

호출 지점: ① 부팅 시 1회 ② `L` 토글의 onChange (`applyLang(lang, lastExpired === true)`) ③ tick()의 expired 전이 가드 안 (기존 `titleEl.textContent =` 줄을 대체). **`lastExpired` 가드는 그대로 둔다** — 토글 핸들러가 applyLang을 직접 부르므로 가드를 넓힐 필요가 없다.

부팅 호출(①)의 expired 인자는 `false`로 고정해도 안전하다: 첫 tick은 `lastExpired = null`이라 가드를 **반드시** 통과하고, rAF 콜백은 첫 페인트 전에 실행되므로 사용자는 잘못된 제목을 볼 수 없다. 부팅 호출의 실질 역할은 aria-label ×6과 `html[lang]`이다.

### index.html

- aria-label 있는 입력/버튼에 `data-l10n="ariaH10"` 등 키 부여 (초기 한국어 aria-label은 유지 — JS 로드 실패 시 폴백)
- `<title>퇴근까지</title>` 유지 (첫 페인트 전 폴백; applyLang이 즉시 덮음)

## 엣지 케이스

| 케이스 | 처리 |
|---|---|
| 저장값 손상 (`"jp"` 등) | `LANGS.includes` 실패 → navigator.language 추정으로 폴백 |
| 편집 중 `L` | 편집기 stopPropagation이 차단 (기존 메커니즘, 추가 코드 0) |
| expired 상태에서 토글 | applyLang(lang, **현재** expired)이므로 "GO HOME"이 즉시 나온다 — `lastExpired`를 읽어 전달 |
| 언어 토글 직후 expired 전이 | tick() 가드가 applyLang을 다시 부르므로 정합 |
| localStorage 차단 | try/catch → 세션 전용 (기존 패턴) |

## 테스트

- `test/strings.test.js` (신규): ko/en 키 집합 동일성, 빈 문자열 없음
- 기존 39개 무손상 — `src/lib/countdown.js` 등은 건드리지 않는다

## 범위 밖

- exe 파일 속성(description/productName)의 영문화 — 빌드 시점 고정, 런타임 토글 불가
- 세 번째 언어
- README 영문판 (한국어 유지, 조작부에 `L` 키 한 줄 추가만)

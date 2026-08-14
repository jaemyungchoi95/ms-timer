# 고양이 pet 에셋 제작 스펙 (B안 — Orca급 업그레이드용)

외부에서 제작(AI 생성·커미션·직접 제작)한 고품질 에셋을 앱에 넣기 위한 규격.
이 규격만 지키면 **앱 코드는 한 줄도 바뀌지 않는다** — 어셈블러가 크로마키·정렬·패킹을 처리해
`cat-sheet.png` + `cat-manifest.js` 를 재생성한다.

## 1. 필요한 것 — 상태 8종의 애니메이션

| 상태 | 연출 | 권장 프레임 | 루프 성격 |
|------|------|------------|-----------|
| `dawn` | 웅크려 잠 (zzz) | 4~8 | 느린 호흡, 2~3fps |
| `morning` | 기지개 → 그루밍 | 6~12 | 중간, 4~6fps |
| `day` | 꼬리 살랑, 장난 | 6~12 | 활발, 6~8fps |
| `evening` | 옆(창밖) 보기, 가끔 깜빡 | 4~8 | 잔잔, 3~5fps |
| `night` | 꾸벅꾸벅 조는 눈 | 4~8 | 느림, 2~3fps |
| `imminent` | 들뜸 — 눈 반짝, 제자리 들썩 | 6~12 | 빠름, 8fps± |
| `expired` | 폴짝폴짝 축하 (과장 OK) | 6~12 | 가장 빠름, 8~12fps |
| `hover` | 쓰다듬 반응 — 놀람/애교 | 4~8 | 빠름, 8fps± |

- 상태마다 프레임 수가 달라도 된다 (어셈블러가 상태별로 열 수를 맞춘다).
- **끊김 없는 루프**여야 한다 — 마지막 프레임에서 첫 프레임으로 자연스럽게 이어질 것.

## 2. 납품 형태 (택 1)

### Form 1 (권장): 상태별 개별 프레임 PNG

```
assets-src/
  dawn_0.png dawn_1.png ... dawn_5.png
  morning_0.png ...
  ...
  hover_0.png ...
```

- 파일명: `<상태>_<번호>.png`, 번호는 0부터 연속.
- 상태 이름은 위 표의 8개 영문 그대로 (다르면 어셈블러가 거부).

### Form 2: 완성 sprite sheet 1장

- 행 = 상태 (위 표 순서 고정: dawn→hover), 열 = 프레임, **균일 격자**.
- 격자 크기(프레임 폭×높이)를 함께 알려줄 것.
- AI 생성 시트는 격자가 미세하게 어긋나는 경우가 많아 Form 1이 더 안전하다.

### Form 3 (차선): 상태별 animated WebP/GIF 8개

- `dawn.webp` ... `hover.webp`. 어셈블러가 프레임을 분해해 패킹한다.
- 프레임 타이밍이 불균일하면 균일 fps로 근사된다.

## 3. 프레임 규격

| 항목 | 요구 | 비고 |
|------|------|------|
| 크기 | **모든 프레임 동일**, 정사각 권장, 96~256px | Orca Claudino가 ~180px급. 클수록 좋지만 256 초과 금지 |
| 배경 | **투명(알파)** 또는 **마젠타 단색 #FF00FF** | 마젠타는 어셈블러가 크로마키로 제거 (Orca와 동일 방식) |
| 포맷 | PNG (권장) / WebP | JPG 금지 — 알파 없음 + 압축 노이즈가 크로마키를 망침 |
| 발 기준선 | **프레임 간 고정** | 점프 연출은 캐릭터가 프레임 안에서 위로 이동 (캔버스는 고정) |
| 캐릭터 여백 | 프레임 가장자리에 2~4% 여백 | 잘림 방지 |

## 4. 스타일 가이드 (Orca 질감 재현 조건)

- **하드 엣지 픽셀아트** — 안티앨리어싱 없는 계단형 경계. AI 생성 시 프롬프트에
  "pixel art, hard edges, no anti-aliasing" 명시. 부드러운 일러스트는 확대 시 뭉개진다.
- **셰이딩 3~4톤** — 재질(주황 털/흰 털)마다 명부·기준·암부 램프. 이게 "3D스러운" 볼륨의 실체.
- **조명 방향 통일** — 좌상단 광원 고정. 프레임마다 광원이 바뀌면 깜빡임으로 보인다.
- **외곽선** — 짙은 갈색·흑색 계열 아웃라인 (Orca 스타일).
- 팔레트 참고 (1차 코드 생성판과 이어지는 톤): 주황 `#EF9E5E` / 진한 주황 `#C9713A` /
  줄무늬 `#A8542A` / 크림 `#F7EFE2` / 핑크 `#E4808C` / 외곽 `#2B1E16`. 강제는 아님 —
  전체 프레임에서 **일관되기만** 하면 된다.

## 5. 캐릭터 일관성 — AI 생성 실전 순서 (가장 중요한 절)

포즈·프레임 간 "같은 고양이"로 보이는 것이 최대 난제다. 검증된 순서:

1. **정면 기준 컷 1장을 먼저 확정**한다 (마음에 들 때까지 이 1장만 반복 생성).
2. 이후 **모든 생성에 그 기준 컷을 참조 이미지로 첨부**하고 "same character, same palette" 지시.
3. 상태 하나당 "sprite sheet of N animation frames, side by side, same character" 로
   **한 번에 한 상태의 전 프레임을 뽑는다** — 프레임 간 일관성이 장당 생성보다 훨씬 좋다.
4. 나온 시트에서 격자가 어긋나면 개별 프레임으로 크롭해 Form 1 로 납품.
5. 8개 상태를 같은 세션/같은 참조로 이어서 생성 (세션 바뀌면 화풍이 튄다).

체크리스트: 귀 모양·무늬 위치·목걸이 유무가 프레임 간 동일한가 / 발 기준선이 흔들리지 않는가 /
배경에 그림자·바닥이 섞여 있지 않은가 (투명 또는 마젠타 순색만).

## 6. 통합 절차

1. 파일을 worktree 의 `assets-src/` 디렉토리에 넣는다 (git 추적 — 원본 보존).
2. 나(Claude)에게 알린다 → 어셈블러가 검증(이름·크기·알파/마젠타) → 크로마키 → 발 기준선
   정렬 → `cat-sheet.png` + `cat-manifest.js` 재생성 → 테스트 → 앱에서 확인.
3. 실패 시(격자 어긋남·일관성 붕괴 등) 문제 프레임 목록을 리포트한다 — 해당 프레임만 재생성하면 된다.

## 7. Nano Banana (Gemini 이미지 생성) 프롬프트 키트

### 7.1 기준 컷 — 만족할 때까지 이것만 반복

```
A cute orange tabby kitten mascot, chibi proportions with a big round head,
huge glossy dark eyes with white sparkle highlights, small pink nose, white
muzzle and chest, pink inner ears, soft pink blush on cheeks, red collar with
a tiny gold charm, sitting front view, full body, feet at the bottom, centered.
Retro video game pixel art style: clean visible pixel grid, hard edges, no
anti-aliasing, 3-tone cel shading with light from the top-left, dark brown
outline (#2B1E16). Palette: warm orange #EF9E5E, dark orange #C9713A, stripe
brown #A8542A, cream #F7EFE2, pink #E4808C.
Exactly ONE single kitten, no duplicates, no repetition. Square image, the
character centered with generous empty magenta margin.
Flat solid magenta background (#FF00FF), no floor, no shadow, no text.
```

주의: "ONE single" 강제 문구는 **기준 컷에만** — 상태별 시트(7.2)에 넣으면 6프레임 생성과 충돌한다.

### 7.2 상태별 시트 — 기준 컷 첨부 + [ACTION] 교체

```
Using the attached reference image: the EXACT same orange tabby kitten
character — same ear shape, same stripe positions, same collar, same palette,
same pixel art style. Create a sprite sheet of 6 animation frames in a single
horizontal row, evenly spaced, all frames the same size, feet baseline at the
same height in every frame. Animation: [ACTION]. Seamless loop — the last
frame leads back into the first. Flat solid magenta background (#FF00FF),
no floor, no shadows, no text, no frame borders.
```

| 상태 | [ACTION] |
|------|----------|
| dawn | sleeping curled in a loaf position, eyes closed, body gently rising and falling with slow breathing, small blue "zzz" floating above |
| morning | waking up and stretching — front legs extended, butt raised, then grooming a front paw |
| day | playful idle — tail swishing side to side with an occasional small bounce |
| evening | sitting and gazing to the right as if looking out a window, blinking slowly once |
| night | drowsy — eyes drooping half-closed, head nodding, then blinking back awake |
| imminent | excited anticipation — wide sparkling eyes, bouncing lightly in place, small yellow sparkles around |
| expired | joyful celebration — jumping up with paws spread, confetti sparkles, big happy smile |
| hover | surprised delight — perked ears, starry eyes, a little hop |

### 7.3 실패 모드별 대응

- 캐릭터가 여러 마리 겹쳐 나옴 (가로 캔버스를 반복으로 채우는 습성) → 잘 나온 개체가 있으면
  재생성 대신 편집 지시: `Edit this image: keep ONLY the middle kitten and remove the
  other two cats completely. Exactly one single character, centered, surrounded by flat
  solid magenta (#FF00FF) on all sides. Do not change the kitten itself in any way.`
- 시트에서 프레임이 겹침 → `frames separated by clear magenta gaps, not overlapping` 추가.
- 프레임 개수가 6이 아니어도 그대로 납품 (§2 — 상태별 가변 허용, 크롭은 어셈블러 몫).
- 뭉개진 픽셀 → `make it true pixel art with a clean uniform pixel grid, no smoothing, no blur` 추가.
- 배경 오류 → 후속 편집 지시: `replace the background with flat solid magenta #FF00FF, nothing else`.
- 캐릭터 변형 → 재생성 대신 `keep the character IDENTICAL to the reference — only change the pose`.
- 잘 나온 상태부터 부분 납품 (`assets-src/dawn_sheet.png` 등) — 행 단위 혼합 지원.

## 8. Figma 직접 제작 워크플로 (기준 컷 확보 후 — 주 생산 경로)

대부분의 상태는 새 그림이 아니라 **기준 컷의 부분 수정**이다. 프레임 복제 후:

| 상태 | 수정 내용 | 프레임 |
|------|-----------|--------|
| dawn | 감은 눈(⌒) + 파란 zzz (프레임 간 zzz 위치만 이동) | 2 |
| night | 눈 위 절반에 눈꺼풀(주황 사각형) ↔ 감은 눈 | 2~3 |
| evening | 눈동자+하이라이트 3~4px 우측 이동, 가끔 감은 눈 | 2~3 |
| imminent | 별 눈 + 노란 반짝이 + 몸 전체 2px 위 프레임 교대 | 2 |
| hover | imminent 변형 + 귀 기울임 | 2 |
| expired | 몸 전체 10~20px 위(공중) ↔ 원위치 + 반짝이 | 2~4 |
| day | 몸 1px 좌우 + 귀 씰룩 | 2~3 |
| morning | 진짜 새 포즈(기지개) — AI 생성 후 보정 or 단순화 | 2~4 |

- **상태당 2프레임이면 루프가 성립한다** — 어셈블러가 반복 배치로 열을 채운다.
- Export: **PNG 1x**, 모든 프레임 동일 캔버스, 발 기준선 고정, 배경 투명(권장) 또는 마젠타.
- SVG export 금지 아님이나 비권장 — 피그마 SVG는 래스터를 base64로 감싸 벡터 이점이 없고 용량만 크다 (실측 7.2MB vs PNG 1.2MB).

## 9. 하지 않아도 되는 것

- 리사이즈/최적화 — 어셈블러가 처리.
- 시트 패킹(Form 1 선택 시) — 어셈블러가 처리.
- fps 결정 — 기본값은 위 표, 넣어보고 앱에서 튜닝.
- 8상태 전부를 한 번에 — **일부 상태만 먼저 납품해도 된다.** 나머지는 1차 코드 생성 에셋이
  그 행을 채운다 (행 단위 혼합 지원).

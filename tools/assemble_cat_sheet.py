# cat-sheet 어셈블러 — assets-src/ 의 외부 에셋(AI/Figma 제작)을 행 단위로 병합한다.
#
# 동작: `npm run gen:sprites` 가 만든 32px 코드 생성 시트를 베이스로 3배 업스케일한 뒤,
# assets-src/<state>_sheet.png 가 존재하는 상태(행)만 외부 에셋으로 교체해
# 96px 프레임 시트 + manifest 를 출력한다 (spec §6 행 단위 혼합 계약).
#
# 프레임 감지: 마젠타(#FF00FF 근방) 크로마키 기준 연결 컴포넌트 — 격자가 불균일해도
# 본체(대형)와 부속(zzz 등 소형)을 분리 감지해 부속을 가장 가까운 본체에 귀속시킨다.
# 정렬: 프레임을 행(밴드)→열 순으로 배열하고, 발 기준선(하단)을 맞춰 96px 셀에 담는다.
#
# 실행: uv run --with pillow python tools/assemble_cat_sheet.py  (= npm run assemble:sprites)
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS_SRC = ROOT / "assets-src"
OUT_DIR = ROOT / "src" / "renderer"
BASE_SHEET = OUT_DIR / "assets" / "cat-sheet.png"

FRAME = 96          # 최종 프레임 한 변(px)
BASE_FRAME = 32     # 코드 생성 시트의 프레임 한 변
UPSCALE = FRAME // BASE_FRAME
COLUMNS = 6         # 시트 열 수 (행별 실제 프레임 수는 manifest 가 따로 든다)
MARGIN = 4          # 프레임 셀 안 여백 — 캐릭터가 셀 경계에 닿지 않게

# 행 순서 불변 계약 (spec §6) + fps. 코드 생성판과 동일해야 한다.
ROWS = [
    ("dawn", 3),
    ("morning", 5),
    ("day", 7),
    ("evening", 4),
    ("night", 3),
    ("imminent", 8),
    ("expired", 10),
    ("hover", 10),
]

MIN_BODY_AREA_RATIO = 0.01   # 시트 면적 대비 본체 최소 크기
MIN_COMPONENT = 200          # 노이즈 컷


def is_magenta(px) -> bool:
    r, g, b = px[0], px[1], px[2]
    return r > 180 and b > 180 and g < 140


def detect_frames(im: Image.Image) -> list[Image.Image]:
    """마젠타 배경 시트에서 프레임들을 감지해 (행→열 순) 크롭 목록으로 반환."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    seen = [[False] * w for _ in range(h)]
    comps: list[list[tuple[int, int]]] = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0][x0] or is_magenta(px[x0, y0]):
                continue
            cells = []
            q = deque([(x0, y0)])
            seen[y0][x0] = True
            while q:
                x, y = q.popleft()
                cells.append((x, y))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and not is_magenta(px[nx, ny]):
                            seen[ny][nx] = True
                            q.append((nx, ny))
            if len(cells) >= MIN_COMPONENT:
                comps.append(cells)

    def bbox(cells):
        xs = [c[0] for c in cells]
        ys = [c[1] for c in cells]
        return [min(xs), min(ys), max(xs), max(ys)]

    body_min = w * h * MIN_BODY_AREA_RATIO
    bodies = [bbox(c) for c in comps if len(c) > body_min]
    sats = [bbox(c) for c in comps if len(c) <= body_min]
    if not bodies:
        raise SystemExit(f"프레임 감지 실패 — 본체 컴포넌트 없음 (마젠타 배경 확인)")

    # 부속(zzz·반짝이)을 중심 거리 기준 가장 가까운 본체에 귀속
    for s in sats:
        scx, scy = (s[0] + s[2]) / 2, (s[1] + s[3]) / 2
        best = min(
            bodies,
            key=lambda f: (scx - (f[0] + f[2]) / 2) ** 2 + (scy - (f[1] + f[3]) / 2) ** 2,
        )
        best[0] = min(best[0], s[0])
        best[1] = min(best[1], s[1])
        best[2] = max(best[2], s[2])
        best[3] = max(best[3], s[3])

    # 행 밴드(세로 중심을 본체 평균 높이로 양자화) → 열 순 정렬
    avg_h = sum(f[3] - f[1] for f in bodies) / len(bodies)
    bodies.sort(key=lambda f: (round(((f[1] + f[3]) / 2) / (avg_h * 1.2)), (f[0] + f[2]) / 2))

    frames = []
    for f in bodies:
        crop = rgb.crop((f[0], f[1], f[2] + 1, f[3] + 1))
        frames.append(crop)
    return frames


def normalize_frame(crop: Image.Image) -> Image.Image:
    """크롭 → 96px 셀. 발 기준선(하단) 정렬 + 가로 중앙, NEAREST 축소로 픽셀 엣지 유지."""
    inner = FRAME - MARGIN * 2
    s = min(inner / crop.width, inner / crop.height)
    rs = crop.resize((max(1, round(crop.width * s)), max(1, round(crop.height * s))), Image.NEAREST)
    cell = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    # 마젠타 → 알파 변환하며 부착
    src = rs.load()
    out = cell.load()
    ox = (FRAME - rs.width) // 2
    oy = FRAME - MARGIN - rs.height
    for y in range(rs.height):
        for x in range(rs.width):
            p = src[x, y]
            if not is_magenta(p):
                out[ox + x, oy + y] = (p[0], p[1], p[2], 255)
    return cell


def base_row(base: Image.Image, row_index: int) -> list[Image.Image]:
    """코드 생성 32px 시트의 행 하나를 96px 프레임 목록으로 업스케일."""
    frames = []
    for col in range(COLUMNS):
        crop = base.crop((col * BASE_FRAME, row_index * BASE_FRAME, (col + 1) * BASE_FRAME, (row_index + 1) * BASE_FRAME))
        frames.append(crop.resize((FRAME, FRAME), Image.NEAREST))
    return frames


def main() -> None:
    if not BASE_SHEET.exists():
        raise SystemExit("베이스 시트 없음 — 먼저 `npm run gen:sprites` 실행")
    base = Image.open(BASE_SHEET).convert("RGBA")
    if base.size != (BASE_FRAME * COLUMNS, BASE_FRAME * len(ROWS)):
        raise SystemExit(f"베이스 시트 기하 불일치: {base.size}")

    sheet = Image.new("RGBA", (FRAME * COLUMNS, FRAME * len(ROWS)), (0, 0, 0, 0))
    manifest_rows = []
    replaced = []

    for row_index, (state, fps) in enumerate(ROWS):
        src_file = ASSETS_SRC / f"{state}_sheet.png"
        if src_file.exists():
            frames = [normalize_frame(c) for c in detect_frames(Image.open(src_file))]
            if len(frames) > COLUMNS:
                frames = frames[:COLUMNS]
            replaced.append(f"{state}({len(frames)})")
        else:
            frames = base_row(base, row_index)
        for col, frame in enumerate(frames):
            sheet.alpha_composite(frame, (col * FRAME, row_index * FRAME))
        manifest_rows.append((state, row_index, len(frames), fps))

    out_png = OUT_DIR / "assets" / "cat-sheet.png"
    sheet.save(out_png)

    rows_js = "\n".join(
        f"    {state}: {{ row: {row}, frames: {frames}, fps: {fps} }}," for state, row, frames, fps in manifest_rows
    )
    (OUT_DIR / "cat-manifest.js").write_text(
        "// tools/assemble_cat_sheet.py 가 생성한 파일 — 직접 수정 금지.\n"
        "// 코드 생성 베이스(gen:sprites) 위에 assets-src 외부 에셋을 행 단위로 병합한 결과.\n"
        "export const CAT_MANIFEST = {\n"
        f"  frameSize: {FRAME},\n"
        f"  columns: {COLUMNS},\n"
        f"  sheetWidth: {FRAME * COLUMNS},\n"
        f"  sheetHeight: {FRAME * len(ROWS)},\n"
        "  scale: 1,\n"
        "  rows: {\n"
        f"{rows_js}\n"
        "  },\n"
        "};\n",
        encoding="utf-8",
    )
    print(f"cat-sheet.png {FRAME * COLUMNS}×{FRAME * len(ROWS)} 어셈블 완료 — 외부 에셋 행: {', '.join(replaced) or '없음'}")


if __name__ == "__main__":
    sys.exit(main())

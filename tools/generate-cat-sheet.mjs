#!/usr/bin/env node
/**
 * cat-sheet.png + cat-manifest.js 생성기 v2 — 시트 기하 규격의 single source of truth.
 * 의존성 제로: PNG 는 node:zlib deflate + 수제 청크(IHDR/IDAT/IEND)로 충분하다.
 *
 * v2: 32px 네이티브 해상도. 손그림 그리드 대신 절차적 조립 —
 * 타원 채움 + 좌상단 광원 3톤 셰이딩 + 자동 외곽선 추출로 몸체를 만들고,
 * 눈·코·볼·목걸이·줄무늬 같은 디테일만 좌표 스탬프로 얹는다.
 * 실루엣이 바뀌는 변형(꼬리·점프)은 조립 옵션으로, 표정 변형은 외곽선 이후 패치로.
 *
 * 컨셉 튜닝 계약(spec §6): 연출·팔레트·fps 조정은 이 파일 수정 + `npm run gen:sprites`
 * 재실행으로 완결된다. ROWS 의 8행 순서를 바꾸면 앱의 행 계약이 깨진다.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const GRID = 32; // 프레임 = 그리드 (v2 는 확대 없이 네이티브)
const FRAME = 32;
const COLUMNS = 6;
const RENDER_SCALE = 3; // 96px 렌더 — Claudino 와 비슷한 체구

const PALETTE = {
  K: [0x2b, 0x1e, 0x16, 255], // 외곽선
  O: [0xef, 0x9e, 0x5e, 255], // 주황 기준
  R: [0xc9, 0x71, 0x3a, 255], // 주황 암부
  L: [0xf7, 0xb9, 0x7e, 255], // 주황 명부
  D: [0xa8, 0x54, 0x2a, 255], // 줄무늬
  W: [0xf7, 0xef, 0xe2, 255], // 크림 기준
  w: [0xdd, 0xcd, 0xb4, 255], // 크림 암부
  P: [0xe4, 0x80, 0x8c, 255], // 핑크 (귀속·코·볼)
  E: [0xff, 0xff, 0xff, 255], // 눈 하이라이트
  C: [0xc9, 0x40, 0x40, 255], // 목걸이
  Y: [0xf2, 0xcf, 0x66, 255], // 보석·반짝이
  Z: [0x9b, 0xb7, 0xd4, 255], // 수면 zZ
};

const ORANGES = ['O', 'R', 'L'];
const FURS = [...ORANGES, 'D', 'W', 'w'];

// ---- 그리드 도구 ------------------------------------------------------------

const blank = () => Array.from({ length: GRID }, () => '.'.repeat(GRID));

function setCell(rows, x, y, ch) {
  if (x < 0 || x >= GRID || y < 0 || y >= GRID) return;
  rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
}

/** 타원 채움. onlyIf 를 주면 현재 셀이 그 목록일 때만 칠한다 (K/투명 보호). */
function fillEllipse(g, cx, cy, rx, ry, ch, onlyIf = null) {
  const out = [...g];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      if (onlyIf !== null && !onlyIf.includes(out[y][x])) continue;
      setCell(out, x, y, ch);
    }
  }
  return out;
}

/** 좌상단 광원 3톤 타원 — 대각 밝기축(t=(nx+ny)/2)으로 명부/기준/암부 분할. */
function shadeEllipse(g, cx, cy, rx, ry, [light, base, dark]) {
  const out = [...g];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const t = (nx + ny) / 2;
      setCell(out, x, y, t <= -0.4 ? light : t >= 0.42 ? dark : base);
    }
  }
  return out;
}

/** 부분 덮어쓰기 — lines 의 '.' 은 투명으로 "지운다" (실루엣 편집용). */
function paint(g, top, left, lines) {
  const out = [...g];
  lines.forEach((line, dy) => {
    for (let dx = 0; dx < line.length; dx++) setCell(out, left + dx, top + dy, line[dx]);
  });
  return out;
}

/** 오버레이 — lines 의 '.' 은 건너뛴다. onlyIf 로 대상 셀 제한 가능(외곽선 보호). */
function stamp(g, top, left, lines, onlyIf = null) {
  const out = [...g];
  lines.forEach((line, dy) => {
    for (let dx = 0; dx < line.length; dx++) {
      const ch = line[dx];
      if (ch === '.') continue;
      const x = left + dx;
      const y = top + dy;
      if (x < 0 || x >= GRID || y < 0 || y >= GRID) continue;
      if (onlyIf !== null && !onlyIf.includes(out[y][x])) continue;
      setCell(out, x, y, ch);
    }
  });
  return out;
}

/** 채워진 셀 중 상하좌우로 투명(또는 캔버스 밖)에 닿는 셀 → K. 실루엣 자동 추출. */
function outlined(g) {
  const out = [];
  for (let y = 0; y < GRID; y++) {
    let row = '';
    for (let x = 0; x < GRID; x++) {
      const ch = g[y][x];
      if (ch === '.') {
        row += '.';
        continue;
      }
      const edge = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dy, dx]) => {
        const yy = y + dy;
        const xx = x + dx;
        return yy < 0 || yy >= GRID || xx < 0 || xx >= GRID || g[yy][xx] === '.';
      });
      row += edge ? 'K' : ch;
    }
    out.push(row);
  }
  return out;
}

/** 전체를 n 줄 위로 (점프/바운스). 아래는 투명으로 채운다. */
function shiftUp(g, n) {
  return [...g.slice(n), ...Array.from({ length: n }, () => '.'.repeat(GRID))];
}

const mirror = (lines) => lines.map((l) => [...l].reverse().join(''));

// ---- 부품: 귀·꼬리·눈 -------------------------------------------------------

// 왼귀 (outline 전 stamp 용 — 오른귀는 mirror). 베이스 2줄이 머리 실루엣에 잠겨야
// 외곽선이 하나로 이어진다 — 떨어뜨리면 더듬이처럼 분리된 귀가 된다.
const EAR = [
  '.L......',
  '.LO.....',
  '.LPO....',
  'LOPPO...',
  'LOPPPO..',
  'LOPPPOO.',
  'OOPPPOOO',
];

// 눈 5×6 (outline 후 paint 용). 배경은 얼굴 기준색 O 로 채워 셰이딩 이음새를 가린다.
const EYES = {
  open: ['.KKK.', 'KEEKK', 'KEEKK', 'KKKKK', 'KKKEK', '.KKK.'],
  closed: ['OOOOO', 'OOOOO', 'KKKKK', 'OOOOO', 'OOOOO', 'OOOOO'],
  droop: ['OOOOO', 'KKKKK', 'KKEKK', 'KKKKK', 'OOOOO', 'OOOOO'],
  look: ['.KKK.', 'KKEEK', 'KKEEK', 'KKKKK', 'KKKKE', '.KKK.'], // 시선 오른쪽
  starry: ['.KKK.', 'KKEKK', 'KEEEK', 'KKEKK', 'KKKKK', '.KKK.'], // 들뜸
};

const EYE_L = { top: 8, left: 6 };
const EYE_R = { top: 8, left: 17 };

function withEyes(g, kind) {
  // stamp — 패턴의 '.' 은 "얼굴 그대로 두기"다. paint 를 쓰면 모서리 '.' 가
  // 투명 구멍을 뚫어 데스크톱이 비쳐 보인다.
  let out = stamp(g, EYE_L.top, EYE_L.left, EYES[kind]);
  out = stamp(out, EYE_R.top, EYE_R.left, EYES[kind]);
  return out;
}

// ---- 포즈 조립 --------------------------------------------------------------

/**
 * 앉은 정면 고양이. opts.tail: 'rest'(기본, 오른쪽에 세움) | 'up'(바짝) | 'side'(바닥).
 * 실루엣에 들어가는 요소는 전부 outline 전에 깔아야 한다.
 */
function buildSit({ tail = 'rest' } = {}) {
  let g = blank();

  // 몸통 → 꼬리 → 머리 순서 — 머리가 목 이음새를 덮는다
  g = shadeEllipse(g, 13.5, 23.5, 9, 7.5, ['L', 'O', 'R']);

  // 꼬리는 몸통 타원(x4.5~22.5)과 반드시 겹치게 — 안 겹치면 별도 실루엣으로 떨어진다
  if (tail === 'rest') {
    g = shadeEllipse(g, 24, 26, 3, 5.5, ['L', 'O', 'R']);
  } else if (tail === 'up') {
    g = shadeEllipse(g, 24.5, 17.5, 2.6, 8, ['L', 'O', 'R']);
  } else if (tail === 'side') {
    g = shadeEllipse(g, 24, 29.3, 5.5, 2.2, ['L', 'O', 'R']);
  }

  g = shadeEllipse(g, 13.5, 11.5, 10.5, 8.8, ['L', 'O', 'R']);

  // 귀 — 베이스가 머리 상단(y3~)에 잠기도록 얹는다 (outline 이 함께 감싼다)
  g = stamp(g, 0, 4, EAR);
  g = stamp(g, 0, 20, mirror(EAR));

  g = outlined(g);

  // 이하 디테일 — K 를 침범하지 않도록 onlyIf 로 보호
  // 흰 가슴·배
  g = fillEllipse(g, 13.5, 25.5, 4.8, 5.2, 'W', ORANGES);
  g = fillEllipse(g, 15.5, 27.5, 3.4, 3, 'w', ['W']);
  // 흰 주둥이
  g = fillEllipse(g, 13.5, 15, 4.4, 2.8, 'W', ORANGES);
  // 앞발
  g = fillEllipse(g, 9.5, 29.3, 2.7, 1.9, 'W', [...ORANGES, 'w']);
  g = fillEllipse(g, 17.5, 29.3, 2.7, 1.9, 'W', [...ORANGES, 'w']);

  // 이마 줄무늬 (태비 M)
  g = stamp(g, 3, 10, ['D', 'D'], FURS);
  g = stamp(g, 2, 13, ['D', 'D', 'D'], FURS);
  g = stamp(g, 3, 16, ['D', 'D'], FURS);
  // 뺨 옆 줄무늬
  g = stamp(g, 9, 3, ['DD', '.DD'], FURS);
  g = stamp(g, 9, 22, mirror(['DD', '.DD']), FURS);
  // 꼬리 줄무늬
  if (tail === 'rest') {
    g = stamp(g, 23, 23, ['DDD'], FURS);
    g = stamp(g, 27, 23, ['DDD'], FURS);
  } else if (tail === 'up') {
    g = stamp(g, 12, 23, ['DDD'], FURS);
    g = stamp(g, 16, 23, ['DDD'], FURS);
  } else if (tail === 'side') {
    g = stamp(g, 29, 26, ['DD'], FURS);
  }

  // 눈 (기본 open) → 코 → 입 → 볼터치 (볼은 주둥이 W 바깥 뺨의 주황 위)
  g = withEyes(g, 'open');
  g = stamp(g, 15, 13, ['PP'], ['W', 'w', ...ORANGES]);
  g = stamp(g, 16, 12, ['K.K'], ['W', 'w']);
  g = stamp(g, 14, 5, ['PP'], ORANGES);
  g = stamp(g, 14, 25, ['PP'], ORANGES);

  // 목걸이 + 보석 — 턱(머리 하단 ~y20) 아래 가슴 상단에 둘러야 보인다
  g = stamp(g, 20, 8, ['CCCCCCCCCCCC'], [...FURS]);
  g = stamp(g, 20, 13, ['YY', 'YY'], [...FURS, 'C']);

  return g;
}

/** 웅크려 자는 식빵 자세. 발 기준선(31)을 앉은 자세와 맞춘다. */
function buildLoaf() {
  let g = blank();
  g = shadeEllipse(g, 15.5, 25.5, 12.5, 6, ['L', 'O', 'R']); // 몸통 로프
  g = shadeEllipse(g, 8, 23, 6, 5.4, ['L', 'O', 'R']); // 머리 볼록 (좌)
  // 작은 귀 — 베이스가 머리 볼록(y17.6~)에 잠기게
  g = stamp(g, 14, 3, EAR.slice(2).map((l) => l.slice(0, 6)));
  g = stamp(g, 14, 9, mirror(EAR.slice(2).map((l) => l.slice(0, 6))));
  g = outlined(g);
  // 감은 눈·코
  g = stamp(g, 23, 4, ['KK'], ORANGES);
  g = stamp(g, 23, 9, ['KK'], ORANGES);
  g = stamp(g, 25, 6, ['PP'], ORANGES);
  // 몸 줄무늬 + 두른 꼬리
  g = stamp(g, 21, 18, ['DD', '.DD'], FURS);
  g = stamp(g, 24, 21, ['DD'], FURS);
  g = fillEllipse(g, 17, 30, 8, 1.6, 'R', [...ORANGES, 'D']);
  g = stamp(g, 29, 12, ['DD'], ['R']);
  g = stamp(g, 29, 18, ['DD'], ['R']);
  return g;
}

/** 기지개 — 앞은 낮게, 엉덩이는 위로, 꼬리 바짝. */
function buildStretch() {
  let g = blank();
  g = shadeEllipse(g, 21.5, 19, 7.5, 6.5, ['L', 'O', 'R']); // 엉덩이 (위)
  g = shadeEllipse(g, 26.5, 9.5, 2.4, 6, ['L', 'O', 'R']); // 꼬리 위로
  g = shadeEllipse(g, 10, 23.5, 8, 6, ['L', 'O', 'R']); // 앞몸+머리 낮게
  // 앞다리 쭉 — 몸통 하단(y29.5)과 겹치게
  g = paint(g, 27, 2, ['OOOOOOOOO', 'OOOOOOOOO']);
  // 귀 (낮은 머리 위) — 베이스가 앞몸(y17.5~)에 잠기게
  g = stamp(g, 14, 4, EAR.slice(2).map((l) => l.slice(0, 6)));
  g = stamp(g, 14, 10, mirror(EAR.slice(2).map((l) => l.slice(0, 6))));
  g = outlined(g);
  // 행복하게 감은 눈 + 코
  g = stamp(g, 22, 4, ['KK'], ORANGES);
  g = stamp(g, 22, 10, ['KK'], ORANGES);
  g = stamp(g, 24, 7, ['PP'], ORANGES);
  // 흰 앞발
  g = fillEllipse(g, 4.5, 28.5, 2.4, 1.6, 'W', ORANGES);
  g = fillEllipse(g, 9.5, 28.5, 2.4, 1.6, 'W', ORANGES);
  // 등 줄무늬 + 꼬리 줄무늬
  g = stamp(g, 15, 20, ['DD', '.DD'], FURS);
  g = stamp(g, 19, 23, ['DD'], FURS);
  g = stamp(g, 6, 25, ['DDD'], FURS);
  g = stamp(g, 10, 25, ['DDD'], FURS);
  return g;
}

// 오버레이 — 반짝이·콘페티·zzz
const SPARK = ['.Y.', 'YYY', '.Y.'];

function withSparkles(g, positions) {
  let out = g;
  for (const [top, left] of positions) out = stamp(out, top, left, SPARK);
  return out;
}

function withZzz(g, phase) {
  const spots = [
    [[10, 17]],
    [[8, 19], [12, 16]],
    [[5, 21], [9, 18], [13, 16]],
  ][phase];
  let out = g;
  for (const [top, left] of spots) {
    out = stamp(out, top, left, ['ZZ', '.Z', 'ZZ']); // 픽셀 z
  }
  return out;
}

// ---- 프레임 정의 ------------------------------------------------------------

const sit = buildSit();
const sitTailUp = buildSit({ tail: 'up' });
const sitTailSide = buildSit({ tail: 'side' });
const loaf = buildLoaf();
const stretch = buildStretch();

const blink = withEyes(sit, 'closed');
const droop = withEyes(sit, 'droop');
const look = withEyes(sit, 'look');
const lookBlink = withEyes(sit, 'closed');
const starry = withEyes(sit, 'starry');
const starryUp = shiftUp(starry, 1);

// 그루밍 — 오른발을 얼굴로 (blink 기반 + 발 스탬프)
const lick = stamp(withEyes(sit, 'closed'), 13, 17, ['WWW', 'WWWW', '.WWW'], [...FURS, 'K', 'P']);

// 점프 — 꼬리 바짝 + 몸 전체 위로, 발 아래 잔상 없음
const jump1 = shiftUp(withEyes(sitTailUp, 'open'), 3);
const jump2 = shiftUp(withEyes(sitTailUp, 'starry'), 6);

const CONFETTI_A = [[2, 4], [6, 27], [24, 2]];
const CONFETTI_B = [[3, 25], [12, 2], [20, 28]];

const GRIDS = {
  sleep_1: withZzz(loaf, 0),
  sleep_2: withZzz(loaf, 1),
  sleep_3: withZzz(shiftUp(loaf, 1), 2),
  sit,
  sit_blink: blink,
  sit_droop: droop,
  sit_look: look,
  sit_look_blink: lookBlink,
  sit_lick: lick,
  sit_tail_up: sitTailUp,
  sit_tail_side: sitTailSide,
  sit_bounce: shiftUp(sit, 1),
  stretch,
  sparkle_a: withSparkles(starry, [[2, 3], [6, 26], [20, 1]]),
  sparkle_b: withSparkles(starryUp, [[4, 26], [10, 1], [24, 27]]),
  jump_low: withSparkles(jump1, CONFETTI_A),
  jump_high: withSparkles(jump2, CONFETTI_B),
};

// ---- 행 조립: [행이름, fps, 프레임 6개] — 순서가 곧 row 인덱스 (불변 계약) ----

const ROWS = [
  ['dawn', 2, ['sleep_1', 'sleep_1', 'sleep_2', 'sleep_3', 'sleep_3', 'sleep_2']],
  ['morning', 3, ['sit', 'sit_blink', 'stretch', 'stretch', 'sit', 'sit_lick']],
  ['day', 4, ['sit', 'sit_tail_up', 'sit_bounce', 'sit_tail_side', 'sit', 'sit_tail_up']],
  ['evening', 3, ['sit_look', 'sit_look', 'sit_look', 'sit_look_blink', 'sit_look', 'sit_look']],
  ['night', 2, ['sit', 'sit_droop', 'sit_droop', 'sit_blink', 'sit_droop', 'sit_droop']],
  ['imminent', 4, ['sparkle_a', 'sparkle_b', 'sparkle_a', 'sparkle_b', 'sparkle_a', 'sparkle_b']],
  ['expired', 8, ['sit', 'jump_low', 'jump_high', 'jump_high', 'jump_low', 'sit']],
  ['hover', 5, ['sparkle_a', 'jump_low', 'sparkle_b', 'sit', 'sparkle_a', 'jump_low']],
];

// ---- 그리드 검증 + 래스터화 ------------------------------------------------

function validateGrid(name, grid) {
  if (grid.length !== GRID) throw new Error(`${name}: ${grid.length}줄 (${GRID}줄이어야 함)`);
  grid.forEach((line, i) => {
    if (line.length !== GRID) throw new Error(`${name} ${i}행: 폭 ${line.length} (${GRID}자여야 함)`);
    for (const ch of line) {
      if (ch !== '.' && !(ch in PALETTE)) throw new Error(`${name} ${i}행: 미정의 문자 '${ch}'`);
    }
  });
}

/** 시트 RGBA 버퍼에 그리드 하나를 (col,row) 프레임 위치에 찍는다. */
function blitGrid(sheet, sheetW, grid, col, row) {
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const ch = grid[gy][gx];
      if (ch === '.') continue;
      const rgba = PALETTE[ch];
      const px = col * FRAME + gx;
      const py = row * FRAME + gy;
      sheet.set(rgba, (py * sheetW + px) * 4);
    }
  }
}

// ---- 최소 PNG 인코더 (RGBA, filter 0) --------------------------------------

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const head = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(head.length + 8);
  out.writeUInt32BE(data.length, 0);
  head.copy(out, 4);
  out.writeUInt32BE(crc32(head), head.length + 4);
  return out;
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height); // 각 스캔라인 앞에 filter 0 바이트
  for (let y = 0; y < height; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- main ------------------------------------------------------------------

const sheetW = COLUMNS * FRAME;
const sheetH = ROWS.length * FRAME;
const sheet = Buffer.alloc(sheetW * sheetH * 4); // 초기값 0 = 투명

for (const [name, grid] of Object.entries(GRIDS)) validateGrid(name, grid);
ROWS.forEach(([rowName, , frames], rowIndex) => {
  if (frames.length !== COLUMNS) throw new Error(`${rowName}: 프레임 ${frames.length}개 (${COLUMNS}개여야 함)`);
  frames.forEach((gridName, col) => {
    const grid = GRIDS[gridName];
    if (!grid) throw new Error(`${rowName}: 미정의 그리드 '${gridName}'`);
    blitGrid(sheet, sheetW, grid, col, rowIndex);
  });
});

const outDir = path.join(import.meta.dirname, '..', 'src', 'renderer');
mkdirSync(path.join(outDir, 'assets'), { recursive: true });
writeFileSync(path.join(outDir, 'assets', 'cat-sheet.png'), encodePng(sheetW, sheetH, sheet));

const rowsJs = ROWS.map(
  ([name, fps], i) => `    ${name}: { row: ${i}, frames: ${COLUMNS}, fps: ${fps} },`
).join('\n');
writeFileSync(
  path.join(outDir, 'cat-manifest.js'),
  `// tools/generate-cat-sheet.mjs 가 생성한 파일 — 직접 수정 금지, 생성기를 고칠 것.
export const CAT_MANIFEST = {
  frameSize: ${FRAME},
  columns: ${COLUMNS},
  sheetWidth: ${sheetW},
  sheetHeight: ${sheetH},
  scale: ${RENDER_SCALE},
  rows: {
${rowsJs}
  },
};
`,
);

console.log(`cat-sheet.png ${sheetW}×${sheetH} + cat-manifest.js 생성 완료`);

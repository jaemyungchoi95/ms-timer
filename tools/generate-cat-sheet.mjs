#!/usr/bin/env node
/**
 * cat-sheet.png + cat-manifest.js 생성기 — 시트 기하 규격의 single source of truth.
 * 의존성 제로: PNG 는 node:zlib deflate + 수제 청크(IHDR/IDAT/IEND)로 충분하다.
 *
 * 컨셉 튜닝 계약(spec §6): 연출·팔레트·fps 조정은 이 파일 수정 + `npm run gen:sprites`
 * 재실행으로 완결된다. ROWS 의 8행 순서를 바꾸면 앱의 행 계약이 깨진다.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const GRID = 16;              // 그리드 한 변 (문자)
const SCALE2X = 2;            // 그리드→프레임 확대
const FRAME = GRID * SCALE2X; // 32
const COLUMNS = 4;
const RENDER_SCALE = 4;       // 프레임→화면 확대 (manifest 로만 전달)

const PALETTE = {
  K: [0x2b, 0x1e, 0x16, 255], // 외곽선
  O: [0xe8, 0x97, 0x5a, 255], // 주황 몸통
  D: [0xc9, 0x7b, 0x3c, 255], // 진한 주황 (귀 안쪽·줄무늬)
  W: [0xf7, 0xef, 0xe2, 255], // 크림 (볼·앞발)
  P: [0xe4, 0x80, 0x8c, 255], // 핑크 (코·귀속)
  Z: [0x9b, 0xb7, 0xd4, 255], // 수면 zZ
  Y: [0xf2, 0xcf, 0x66, 255], // 반짝이
};

// ---- 픽셀 그리드 (16줄 × 16자, '.'=투명) — v1 시안, 반복 조정 전제 ----------

const GRIDS = {
  sit_open: [
    '................',
    '..KK......KK....',
    '.KDDK....KDDK...',
    '.KDPDK..KDPDK...',
    '.KODDKKKKDDOK...',
    '.KOOOOOOOOOOK...',
    '.KOOOOOOOOOOK...',
    '.KOKKOOOOKKOK...',
    '.KOOOOKPKOOOK...',
    '.KWOOOOOOOOWK...',
    '..KOOOOOOOOK....',
    '..KOOOOOOOOK.KK.',
    '.KOODOODOODKKOK.',
    '.KOOOOOOOOOOKOK.',
    '.KWWKOOOOKWWKK..',
    '..KK..KK...KK...',
  ],
  sit_blink: [
    '................',
    '..KK......KK....',
    '.KDDK....KDDK...',
    '.KDPDK..KDPDK...',
    '.KODDKKKKDDOK...',
    '.KOOOOOOOOOOK...',
    '.KOOOOOOOOOOK...',
    '.KOOOOOOOOOOK...',
    '.KOKKOKPKOKKOK..',
    '.KWOOOOOOOOWK...',
    '..KOOOOOOOOK....',
    '..KOOOOOOOOK.KK.',
    '.KOODOODOODKKOK.',
    '.KOOOOOOOOOOKOK.',
    '.KWWKOOOOKWWKK..',
    '..KK..KK...KK...',
  ],
  sit_droop: [
    '................',
    '..KK......KK....',
    '.KDDK....KDDK...',
    '.KDPDK..KDPDK...',
    '.KODDKKKKDDOK...',
    '.KOOOOOOOOOOK...',
    '.KOOOOOOOOOOK...',
    '.KOKOOOOOOKOK...',
    '.KOOOOKPKOOOK...',
    '.KWOOOOOOOOWK...',
    '..KOOOOOOOOK....',
    '..KOOOOOOOOK.KK.',
    '.KOODOODOODKKOK.',
    '.KOOOOOOOOOOKOK.',
    '.KWWKOOOOKWWKK..',
    '..KK..KK...KK...',
  ],
  sit_tail_up: [
    '................',
    '..KK......KK....',
    '.KDDK....KDDK.K.',
    '.KDPDK..KDPDKKOK',
    '.KODDKKKKDDOKKOK',
    '.KOOOOOOOOOOKKOK',
    '.KOOOOOOOOOOKKK.',
    '.KOKKOOOOKKOK...',
    '.KOOOOKPKOOOK...',
    '.KWOOOOOOOOWK...',
    '..KOOOOOOOOK....',
    '..KOOOOOOOOK....',
    '.KOODOODOODK....',
    '.KOOOOOOOOOOK...',
    '.KWWKOOOOKWWK...',
    '..KK..KK...KK...',
  ],
  sit_tail_side: [
    '................',
    '..KK......KK....',
    '.KDDK....KDDK...',
    '.KDPDK..KDPDK...',
    '.KODDKKKKDDOK...',
    '.KOOOOOOOOOOK...',
    '.KOOOOOOOOOOK...',
    '.KOKKOOOOKKOK...',
    '.KOOOOKPKOOOK...',
    '.KWOOOOOOOOWK...',
    '..KOOOOOOOOK....',
    '..KOOOOOOOOK....',
    '.KOODOODOODK....',
    'KKOOOOOOOOOOK...',
    'KOKWKOOOOKWWK...',
    '.KK.KK.KK..KK...',
  ],
  sit_look: [
    '................',
    '..KK......KK....',
    '.KDDK....KDDK...',
    '.KDPDK..KDPDK...',
    '.KODDKKKKDDOK...',
    '.KOOOOOOOOOOK...',
    '.KOOOOOOOOOOK...',
    '.KOOKKOOOKKOK...',
    '.KOOOOOKPOOOK...',
    '.KWOOOOOOOOWK...',
    '..KOOOOOOOOK....',
    '..KOOOOOOOOK.KK.',
    '.KOODOODOODKKOK.',
    '.KOOOOOOOOOOKOK.',
    '.KWWKOOOOKWWKK..',
    '..KK..KK...KK...',
  ],
  sit_look_blink: [
    '................',
    '..KK......KK....',
    '.KDDK....KDDK...',
    '.KDPDK..KDPDK...',
    '.KODDKKKKDDOK...',
    '.KOOOOOOOOOOK...',
    '.KOOOOOOOOOOK...',
    '.KOOOOOOOOOOK...',
    '.KOOKKOKPKKOK...',
    '.KWOOOOOOOOWK...',
    '..KOOOOOOOOK....',
    '..KOOOOOOOOK.KK.',
    '.KOODOODOODKKOK.',
    '.KOOOOOOOOOOKOK.',
    '.KWWKOOOOKWWKK..',
    '..KK..KK...KK...',
  ],
  sit_lick: [
    '................',
    '..KK......KK....',
    '.KDDK....KDDK...',
    '.KDPDK..KDPDK...',
    '.KODDKKKKDDOK...',
    '.KOOOOOOOOOOK...',
    '.KOOOOOOOOOOK...',
    '.KOKKOOOOKKOK...',
    '.KOOOOKPKOOOK...',
    '.KWOOOKWWKOWK...',
    '..KOOOKWWKOK....',
    '..KOOOOKKOOK.KK.',
    '.KOODOODOODKKOK.',
    '.KOOOOOOOOOOKOK.',
    '.KWWKOOOOKWWKK..',
    '..KK..KK...KK...',
  ],
  sit_sparkle: [
    '.Y..........Y...',
    '..KK......KK.Y..',
    '.KDDK....KDDK...',
    '.KDPDK..KDPDK...',
    '.KODDKKKKDDOK...',
    '.KOOOOOOOOOOK...',
    'YKOOOOOOOOOOK...',
    '.KOKKOOOOKKOK.Y.',
    '.KOOOOKPKOOOK...',
    '.KWOOOOOOOOWK...',
    '..KOOOOOOOOK..Y.',
    '..KOOOOOOOOK.KK.',
    '.KOODOODOODKKOK.',
    '.KOOOOOOOOOOKOK.',
    '.KWWKOOOOKWWKK..',
    '..KK..KK...KK...',
  ],
  jump: [
    '....Y......Y....',
    '..KK......KK....',
    '.KDDK....KDDK...',
    '.KDPDK..KDPDK...',
    '.KODDKKKKDDOK...',
    '.KOOOOOOOOOOK...',
    '.KOKKOOOOKKOK...',
    '.KOOOOKPKOOOK...',
    '.KWOOOOOOOOWK...',
    'KKOOOOOOOOOOKK..',
    'KWKOOOOOOOOKWK..',
    '.KKOODOODOOKK...',
    '..KOOOOOOOOK.KK.',
    '..KOOOOOOOOKKOK.',
    '...KWWKKWWKKK...',
    '................',
  ],
  stretch: [
    '................',
    '................',
    '............KK..',
    '...........KOOK.',
    '..........KOOOK.',
    '..KK......KOOK..',
    '.KDDK....KDDOK..',
    '.KDPDK..KDPDOK..',
    '.KODDKKKKDDOOK..',
    '.KOKKOOOOKKOOK..',
    '.KOOOOKPKOOOOK..',
    '.KWOOOOOOODOOK..',
    '.KOODOODOODOOK..',
    'KKOOOOOOOOOOKK..',
    'KWWKOOOOOOKWWK..',
    '.KK..KKKK...KK..',
  ],
  // 잠자는 자세도 발 기준선(맨 아랫줄)을 앉은 자세와 맞춘다 — 행 전환 시
  // 고양이가 위로 순간이동한 것처럼 보이면 안 된다. a/b 는 1px 바운스(호흡).
  sleep_a: [
    '................',
    '..........ZZ....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...KK....KK.....',
    '..KDDKKKKDDK....',
    '.KODOOOOOODOK...',
    '.KOKOOOOOOKOKK..',
    'KOOOOKPKOOOOOOK.',
    'KOOOOOOOOOOOOOK.',
    'KODOODOODOODOOK.',
    'KOOOOOOOOOOOOOK.',
    '.KKKKKKKKKKKKK..',
  ],
  sleep_b: [
    '.........Z......',
    '...........ZZ...',
    '................',
    '................',
    '................',
    '................',
    '...KK....KK.....',
    '..KDDKKKKDDK....',
    '.KODOOOOOODOK...',
    '.KOKOOOOOOKOKK..',
    'KOOOOKPKOOOOOOK.',
    'KOOOOOOOOOOOOOK.',
    'KODOODOODOODOOK.',
    'KOOOOOOOOOOOOOK.',
    '.KKKKKKKKKKKKK..',
    '................',
  ],
};

// ---- 행 조립: [행이름, fps, 프레임 4개] — 순서가 곧 row 인덱스 (불변 계약) ----

const ROWS = [
  ['dawn', 2, ['sleep_a', 'sleep_a', 'sleep_b', 'sleep_b']],
  ['morning', 4, ['sit_open', 'stretch', 'stretch', 'sit_lick']],
  ['day', 6, ['sit_open', 'sit_tail_up', 'sit_open', 'sit_tail_side']],
  ['evening', 3, ['sit_look', 'sit_look', 'sit_look_blink', 'sit_look']],
  ['night', 2, ['sit_open', 'sit_droop', 'sit_blink', 'sit_droop']],
  ['imminent', 6, ['sit_sparkle', 'sit_tail_up', 'sit_sparkle', 'sit_tail_up']],
  ['expired', 8, ['sit_open', 'jump', 'sit_open', 'jump']],
  ['hover', 8, ['sit_sparkle', 'jump', 'sit_sparkle', 'sit_open']],
];

// ---- 그리드 검증 + 래스터화 ------------------------------------------------

function validateGrid(name, grid) {
  if (grid.length !== GRID) throw new Error(`${name}: ${grid.length}줄 (16줄이어야 함)`);
  grid.forEach((line, i) => {
    if (line.length !== GRID) throw new Error(`${name} ${i}행: 폭 ${line.length} (16자여야 함)`);
    for (const ch of line) {
      if (ch !== '.' && !(ch in PALETTE)) throw new Error(`${name} ${i}행: 미정의 문자 '${ch}'`);
    }
  });
}

/** 시트 RGBA 버퍼에 그리드 하나를 (col,row) 프레임 위치에 2배 확대로 찍는다. */
function blitGrid(sheet, sheetW, grid, col, row) {
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const ch = grid[gy][gx];
      if (ch === '.') continue;
      const rgba = PALETTE[ch];
      for (let dy = 0; dy < SCALE2X; dy++) {
        for (let dx = 0; dx < SCALE2X; dx++) {
          const px = col * FRAME + gx * SCALE2X + dx;
          const py = row * FRAME + gy * SCALE2X + dy;
          sheet.set(rgba, (py * sheetW + px) * 4);
        }
      }
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
  if (frames.length !== COLUMNS) throw new Error(`${rowName}: 프레임 ${frames.length}개 (4개여야 함)`);
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

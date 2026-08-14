// tools/generate-cat-sheet.mjs 가 생성한 파일 — 직접 수정 금지, 생성기를 고칠 것.
export const CAT_MANIFEST = {
  frameSize: 32,
  columns: 6,
  sheetWidth: 192,
  sheetHeight: 256,
  scale: 3,
  rows: {
    dawn: { row: 0, frames: 6, fps: 3 },
    morning: { row: 1, frames: 6, fps: 5 },
    day: { row: 2, frames: 6, fps: 7 },
    evening: { row: 3, frames: 6, fps: 4 },
    night: { row: 4, frames: 6, fps: 3 },
    imminent: { row: 5, frames: 6, fps: 8 },
    expired: { row: 6, frames: 6, fps: 10 },
    hover: { row: 7, frames: 6, fps: 10 },
  },
};

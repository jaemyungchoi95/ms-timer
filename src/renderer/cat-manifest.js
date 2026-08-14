// tools/generate-cat-sheet.mjs 가 생성한 파일 — 직접 수정 금지, 생성기를 고칠 것.
export const CAT_MANIFEST = {
  frameSize: 32,
  columns: 4,
  sheetWidth: 128,
  sheetHeight: 256,
  scale: 4,
  rows: {
    dawn: { row: 0, frames: 4, fps: 2 },
    morning: { row: 1, frames: 4, fps: 4 },
    day: { row: 2, frames: 4, fps: 6 },
    evening: { row: 3, frames: 4, fps: 3 },
    night: { row: 4, frames: 4, fps: 2 },
    imminent: { row: 5, frames: 4, fps: 6 },
    expired: { row: 6, frames: 4, fps: 8 },
    hover: { row: 7, frames: 4, fps: 8 },
  },
};

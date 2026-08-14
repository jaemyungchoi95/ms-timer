import { buildSpriteAnimationCss } from '../lib/sprite-css.js';
import { CAT_MANIFEST } from './cat-manifest.js';

const styleEl = document.createElement('style');
document.head.appendChild(styleEl);

let el = null;
let currentRow = null;

export function initSprite(catEl) {
  el = catEl;
  const { sheetWidth, sheetHeight, scale } = CAT_MANIFEST;
  el.style.backgroundImage = "url('assets/cat-sheet.png')";
  el.style.backgroundSize = `${sheetWidth * scale}px ${sheetHeight * scale}px`;
  // 창이 안 보이면 정지 — 상시 위젯이 배터리를 상시 소모하면 안 된다 (spec §6)
  document.addEventListener('visibilitychange', applyPlayState);
}

/** 같은 행 재적용은 no-op — 진행 중 루프를 불필요하게 재시작하지 않는다. */
export function applyRow(rowName) {
  if (rowName === currentRow) return;
  const rowDef = CAT_MANIFEST.rows[rowName] ?? CAT_MANIFEST.rows.day; // 미정의 이름 방어
  const { frameSize, scale } = CAT_MANIFEST;
  const css = buildSpriteAnimationCss({
    name: `cat-${rowName}`,
    row: rowDef.row,
    frames: rowDef.frames,
    fps: rowDef.fps,
    frameSize,
    scale,
  });
  styleEl.textContent = css.keyframesCss;
  el.style.animation = css.animationCss;
  currentRow = rowName;
  applyPlayState();
}

function applyPlayState() {
  if (el === null) return;
  el.style.animationPlayState = document.hidden ? 'paused' : 'running';
}

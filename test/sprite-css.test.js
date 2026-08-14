import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSpriteAnimationCss } from '../src/lib/sprite-css.js';

test('row 오프셋(Y)과 종료 좌표(X) 수식 — row2, 4프레임, 32px, 4배', () => {
  const { keyframesCss, animationCss } = buildSpriteAnimationCss({
    name: 'cat-day', row: 2, frames: 4, fps: 8, frameSize: 32, scale: 4,
  });
  assert.ok(keyframesCss.includes('@keyframes cat-day'));
  assert.ok(keyframesCss.includes('background-position: 0px -256px'));
  assert.ok(keyframesCss.includes('background-position: -512px -256px'));
  assert.ok(animationCss.includes('steps(4)'));
  assert.ok(animationCss.startsWith('cat-day 0.5s'));
  assert.ok(animationCss.endsWith('infinite'));
});

test('row0 은 Y 오프셋 0px', () => {
  const { keyframesCss } = buildSpriteAnimationCss({
    name: 'cat-dawn', row: 0, frames: 4, fps: 2, frameSize: 32, scale: 4,
  });
  assert.ok(keyframesCss.includes('background-position: 0px 0px'));
});

test('frames=0 은 steps(1) 로 방어 — steps(0) 은 invalid CSS 라 애니메이션이 얼어붙는다', () => {
  const { animationCss } = buildSpriteAnimationCss({
    name: 'x', row: 0, frames: 0, fps: 8, frameSize: 32, scale: 4,
  });
  assert.ok(animationCss.includes('steps(1)'));
});

test('fps=0 은 0.1 로 클램프 — duration 이 유한하다', () => {
  const { animationCss } = buildSpriteAnimationCss({
    name: 'x', row: 0, frames: 1, fps: 0, frameSize: 32, scale: 4,
  });
  assert.ok(animationCss.includes(' 10s '));
});

/**
 * sprite sheet 의 행 하나를 재생하는 CSS 문자열 생성.
 * Orca sprite-animation-css 의 단순화 이식 — 균일 fps 만 지원한다.
 * 긴 홀드는 시트가 열 중복으로 표현하므로 가변 페이싱이 필요 없다 (spec §6).
 * 순수 문자열 반환 — DOM 없이 테스트된다.
 */
export function buildSpriteAnimationCss({ name, row, frames, fps, frameSize, scale }) {
  // steps(0) 은 invalid CSS — 선언 전체가 버려져 애니메이션이 얼어붙는다.
  const f = Math.max(1, Math.floor(frames));
  const rate = Math.max(0.1, fps);
  const y = -(row * frameSize * scale);
  const endX = -(f * frameSize * scale);
  const duration = f / rate;
  return {
    keyframesCss: `@keyframes ${name} { from { background-position: 0px ${y}px; } to { background-position: ${endX}px ${y}px; } }`,
    animationCss: `${name} ${duration}s steps(${f}) infinite`,
  };
}

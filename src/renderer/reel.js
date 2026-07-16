import { reelPhase } from '../lib/reel-phase.js';

/**
 * 연속 회전하는 숫자 릴 하나.
 *
 * 플립 애니메이션은 최소 250ms가 필요해 ms 자리(1~100ms 주기)에 쓸 수 없다.
 * 릴은 이산 전환이 아니라 연속 이동이므로 속도 제한이 없다.
 */
export class Reel {
  /**
   * @param {HTMLElement} root `[data-reel]` 요소
   * @param {number} place 100 | 10 | 1
   * @param {number} blurPx 회전 속도에 대응하는 모션 블러 강도
   */
  constructor(root, place, blurPx) {
    this.strip = root.querySelector('.reel-strip');
    this.place = place;
    this.stripDigits = this.strip.children.length; // 0..9 + wrap용 0 — 마크업의 span 개수에서 파생
    if (blurPx > 0) {
      this.strip.style.filter = `blur(${blurPx}px)`;
    }
  }

  /** @param {number} ms 0..999 */
  update(ms) {
    const phase = reelPhase(ms, this.place);
    this.strip.style.transform = `translateY(${(-phase * 100) / this.stripDigits}%)`;
  }
}

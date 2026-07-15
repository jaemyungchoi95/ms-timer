/**
 * 플립 시계의 카드 한 장. 자기 값이 바뀔 때만 DOM을 건드린다.
 */
export class FlipDigit {
  /** @param {HTMLElement} root `[data-flip]` 요소 */
  constructor(root) {
    this.root = root;
    this.topSpan = root.querySelector('.flip-top > span');
    this.bottomSpan = root.querySelector('.flip-bottom > span');
    this.value = null;
  }

  /** @param {string} next 한 자리 숫자 문자 */
  set(next) {
    if (next === this.value) return;
    this.value = next;
    this.topSpan.textContent = next;
    this.bottomSpan.textContent = next;
  }
}

/**
 * 플립 시계의 카드 한 장. 자기 값이 바뀔 때만 플립한다.
 *
 * 레이어:
 *   .flip-top         새 값 상단 — 접히는 카드 뒤에서 드러남
 *   .flip-bottom      이전 값 하단 — 펼쳐지는 카드가 덮을 때까지 유지
 *   .flip-fold-top    이전 값 상단 — 아래로 접힘 (0~150ms)
 *   .flip-fold-bottom 새 값 하단 — 위에서 펼쳐짐 (150~300ms)
 */
export class FlipDigit {
  /** @param {HTMLElement} root `[data-flip]` 요소 */
  constructor(root) {
    this.root = root;
    this.topSpan = root.querySelector('.flip-top > span');
    this.bottomSpan = root.querySelector('.flip-bottom > span');
    this.foldTopSpan = root.querySelector('.flip-fold-top > span');
    this.foldBottomSpan = root.querySelector('.flip-fold-bottom > span');
    this.value = null;

    root.querySelector('.flip-fold-bottom').addEventListener('animationend', () => {
      this.bottomSpan.textContent = this.value;
      this.root.classList.remove('flipping');
    });
  }

  /** @param {string} next 한 자리 숫자 문자 */
  set(next) {
    if (next === this.value) return;

    const prev = this.value;
    this.value = next;

    if (prev === null) {
      this.topSpan.textContent = next;
      this.bottomSpan.textContent = next;
      return;
    }

    this.topSpan.textContent = next;
    this.bottomSpan.textContent = prev;
    this.foldTopSpan.textContent = prev;
    this.foldBottomSpan.textContent = next;

    // 애니메이션 재시작을 위한 강제 reflow. 제거하면 카드가 한 번만 넘어간다.
    this.root.classList.remove('flipping');
    void this.root.offsetWidth;
    this.root.classList.add('flipping');
  }
}

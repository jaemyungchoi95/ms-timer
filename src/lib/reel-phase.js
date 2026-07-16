/**
 * ms 값에서 해당 자릿수 릴의 연속 위상을 구한다.
 *
 * 이산적인 자릿값(floor)이 아니라 연속값을 반환하는 것이 요점이다.
 * 릴이 프레임 사이에도 계속 흐르므로 60Hz 샘플링에서 잔상이 생긴다.
 *
 * place=100 → 초당 1바퀴, place=10 → 10바퀴, place=1 → 100바퀴.
 *
 * @param {number} ms 0..999
 * @param {number} place 100 | 10 | 1
 * @returns {number} 0 이상 10 미만
 */
export function reelPhase(ms, place) {
  return (ms % (place * 10)) / place;
}

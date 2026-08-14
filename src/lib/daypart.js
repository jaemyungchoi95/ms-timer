/**
 * 로컬 시각 → 시간대 이름. 경계는 [포함, 미포함).
 * [0,6) dawn / [6,11) morning / [11,17) day / [17,21) evening / [21,24) night.
 * 반환값은 sprite 행 이름과 1:1 이다 — 이름을 바꾸면 cat-manifest 행 계약이 깨진다.
 */
export function daypartOf(date) {
  const h = date.getHours();
  if (h < 6) return 'dawn';
  if (h < 11) return 'morning';
  if (h < 17) return 'day';
  if (h < 21) return 'evening';
  return 'night';
}

/**
 * 라벨 정규화. trim 후 1~12자면 그 문자열, 아니면 null.
 *
 * 사용자 입력과 localStorage 복원값이 모두 이 함수를 탄다 —
 * 검증 규칙은 여기에만 존재한다 (parseTarget 과 같은 단일 경로 원칙).
 * 12자는 "말줄임 없이 항상 안전"이 아니라 입력 폭주 상한이다.
 * 픽셀 기반 방어는 CSS 의 max-width + ellipsis 가 맡는다.
 */
export function normalizeLabel(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim();
  return s.length >= 1 && s.length <= 12 ? s : null;
}

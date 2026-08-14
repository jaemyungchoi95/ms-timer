/** 하한 0.3 — "찾을 수 없는 유령 고양이" 방지. 완전 숨김은 P 토글 소관이다. */
export const OPACITY_MIN = 0.3;
export const OPACITY_MAX = 1.0;
export const OPACITY_STEP = 0.1;

/**
 * 휠 1노치당 조절. direction: +1(선명하게) | -1(투명하게).
 * 소수 1자리 반올림이 load-bearing — 0.1 은 2진수로 무한소수라
 * 반올림 없이 더하면 0.3+0.1×7 이 1.0 에 도달하지 못한다.
 */
export function adjustOpacity(current, direction) {
  const next = Math.round((normalizeOpacity(current) + direction * OPACITY_STEP) * 10) / 10;
  return Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, next));
}

/** 저장값 로드용 — 숫자 아님/범위 밖이면 기본 1.0 폴백, 범위 안이면 1자리 반올림. */
export function normalizeOpacity(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < OPACITY_MIN || n > OPACITY_MAX) return OPACITY_MAX;
  return Math.round(n * 10) / 10;
}

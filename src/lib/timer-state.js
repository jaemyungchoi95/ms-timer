/** 만료 임박 임계 — 남은 시간이 이 값 이하(포함)면 imminent. */
export const IMMINENT_MS = 600_000;

/**
 * computeRemaining 반환값 → 타이머 레벨.
 * 레벨 시맨틱이다(에지 아님) — 부팅 첫 틱에 즉시 전송해도 안전하고,
 * 목표 변경 시 rebaseline 이 필요 없다. 에지(팝업)는 expiry-tracker 소관.
 */
export function timerStateOf(remaining) {
  if (remaining.expired) return 'expired';
  const totalMs = ((remaining.h * 60 + remaining.m) * 60 + remaining.s) * 1000 + remaining.ms;
  return totalMs <= IMMINENT_MS ? 'imminent' : 'running';
}

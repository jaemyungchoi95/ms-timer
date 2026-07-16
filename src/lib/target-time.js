/** "HH:MM" 엄격 매칭. 자리수가 모자라거나(빈 칸) 넘치면 실패한다. */
const PATTERN = /^(\d{2}):(\d{2})$/;

/**
 * "HH:MM" → {h, m}. 형식이 다르거나 00:00–23:59 범위를 벗어나면 null.
 *
 * 저장값과 사용자 입력이 모두 이 함수를 탄다 — 검증 규칙은 여기에만 존재한다.
 * \d{2} 가 두 자리를 강제하므로 Number()가 NaN이나 음수를 만들 수 없고,
 * 따라서 하한 검사(h >= 0, m >= 0)가 필요 없다.
 */
export function parseTarget(str) {
  if (typeof str !== 'string') return null;

  const match = PATTERN.exec(str);
  if (match === null) return null;

  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;

  return { h, m };
}

/** {h, m} → "HH:MM" (2자리 zero-pad) */
export function formatTarget(target) {
  const h = String(target.h).padStart(2, '0');
  const m = String(target.m).padStart(2, '0');
  return `${h}:${m}`;
}

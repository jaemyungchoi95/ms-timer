/**
 * 같은 날짜의 목표 시각까지 남은 시간을 계산한다.
 *
 * 절대 시각 차분 방식이므로 드리프트가 누적되지 않고,
 * 절전 복귀 / NTP 보정 / 타임존 변경이 자동으로 반영된다.
 * 매 호출마다 now의 날짜로 목표를 재계산하므로 자정 롤오버가 공짜다.
 *
 * @param {Date} now 현재 시각 (변경되지 않음)
 * @param {number} targetHour 목표 시(로컬), 기본 18
 * @returns {{expired: boolean, h: number, m: number, s: number, ms: number}}
 */
export function computeRemaining(now, targetHour = 18) {
  const target = new Date(now);
  target.setHours(targetHour, 0, 0, 0);

  const diff = target.getTime() - now.getTime();

  if (diff <= 0) {
    return { expired: true, h: 0, m: 0, s: 0, ms: 0 };
  }

  return {
    expired: false,
    h: Math.floor(diff / 3600000),
    m: Math.floor(diff / 60000) % 60,
    s: Math.floor(diff / 1000) % 60,
    ms: diff % 1000,
  };
}

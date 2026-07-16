/**
 * now 로부터 오늘 target 시각까지 남은 시간.
 *
 * 절대 시각 차분이다 — 누적 감산이 아니므로 드리프트가 없고
 * 절전 복귀·NTP 보정·타임존 변경이 자동으로 반영된다.
 * 매 호출마다 now 의 날짜에서 deadline 을 다시 계산하므로 자정 롤오버도 공짜다.
 *
 * target 이 이미 지났으면 expired 를 반환한다 — 내일로 넘기지 않는다.
 * 넘기면 18:01에 켠 사람이 "퇴근" 대신 23시간 59분 카운트다운을 보게 된다.
 */
export function computeRemaining(now, target = { h: 18, m: 0 }) {
  // new Date(now) 는 복사 생성자. now.setHours() 를 직접 부르면
  // 입력 Date 를 변경하여 순수 함수 테스트가 깨진다.
  const deadline = new Date(now);
  deadline.setHours(target.h, target.m, 0, 0);

  const diff = deadline.getTime() - now.getTime();
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

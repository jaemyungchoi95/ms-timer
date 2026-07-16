/**
 * 만료 에지 추적 — 카운트다운이 "돌던 중" 목표에 도달한 순간에만 fire.
 *
 * prev 는 3-값: null(관측 없음/재기준 직후) | false(진행 중 관측) | true(만료 관측).
 * `prev === false` 엄격 비교가 load-bearing 이다 — `!prev` 로 쓰면 `!null === true` 라
 * 18:30 에 켠 앱의 첫 프레임에서 오발화한다 (clock.js 의 lastExpired=null 과 같은 함정).
 * null 센티널은 그 조건을 영원히 만족시킬 수 없으므로 launch-into-expired 가
 * 구조적으로 침묵한다.
 */
export function createExpiryTracker() {
  let prev = null;

  return {
    /** 매 프레임 호출. false→true 전환에서만 true 를 반환한다. */
    observe(expired) {
      const fire = prev === false && expired === true;
      prev = expired;
      return fire;
    },

    /**
     * 목표 변경 시 호출자가 새 목표 기준의 현재 레벨을 심는다.
     * 목표가 움직여서 생긴 false→true 는 시간이 흘러서 생긴 것과 레벨만으로
     * 구분할 수 없다 — 그래서 호출자가 심는다.
     */
    rebaseline(expired) {
      prev = expired;
    },
  };
}

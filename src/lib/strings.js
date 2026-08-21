/** 언어별 UI 문자열. 키 집합은 모든 로케일에서 동일해야 한다 — 테스트가 고정한다. */
export const STRINGS = {
  ko: {
    countdown: '퇴근까지',
    expired: '퇴근',
    waypointUntil: '{}까지',
    waypointFallback: '무언가 하실 시간입니다!',
    finalMark: '최종',
    phRun: '표시 문구 입력',
    phDone: '도달 시 문구 입력',
    ariaAddWaypoint: '일정 추가',
    ariaRemoveWaypoint: '일정 삭제',
    ariaPickIcon: '뱃지 선택',
    ariaSave: '저장',
    ariaClose: '닫기',
    ariaH10: '시 십의 자리',
    ariaH1: '시 일의 자리',
    ariaM10: '분 십의 자리',
    ariaM1: '분 일의 자리',
  },
  en: {
    countdown: 'TIME TO GO',
    expired: 'GO HOME',
    waypointUntil: 'UNTIL {}',
    waypointFallback: 'TIME TO DO SOMETHING!',
    finalMark: 'FINAL',
    phRun: 'display phrase',
    phDone: 'arrival phrase',
    ariaAddWaypoint: 'add stop',
    ariaRemoveWaypoint: 'remove stop',
    ariaPickIcon: 'pick badge',
    ariaSave: 'save',
    ariaClose: 'close',
    ariaH10: 'hours, tens digit',
    ariaH1: 'hours, ones digit',
    ariaM10: 'minutes, tens digit',
    ariaM1: 'minutes, ones digit',
  },
};

export const LANGS = Object.keys(STRINGS);

/** "{}" 1회 치환 템플릿 적용 — waypointUntil 류 문구 조립 전용. */
export function fill(template, value) {
  return template.replace('{}', value);
}

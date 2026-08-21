/** 언어별 UI 문자열. 키 집합은 모든 로케일에서 동일해야 한다 — 테스트가 고정한다. */
export const STRINGS = {
  ko: {
    countdown: '퇴근까지',
    expired: '퇴근',
    waypointUntil: '{}까지',
    waypointFallback: '무언가 하실 시간입니다!',
    finalMark: '최종',
    ariaWaypointName: '일정 이름',
    ariaAddWaypoint: '일정 추가',
    ariaRemoveWaypoint: '일정 삭제',
    ariaSavePreset: '프리셋으로 저장',
    ariaDeletePreset: '프리셋 삭제',
    ariaH10: '시 십의 자리',
    ariaH1: '시 일의 자리',
    ariaM10: '분 십의 자리',
    ariaM1: '분 일의 자리',
    ariaOk: '확정',
    ariaCancel: '취소',
    ariaLabelRun: '진행 문구',
    ariaLabelDone: '완료 문구',
  },
  en: {
    countdown: 'TIME TO GO',
    expired: 'GO HOME',
    waypointUntil: 'UNTIL {}',
    waypointFallback: 'TIME TO DO SOMETHING!',
    finalMark: 'FINAL',
    ariaWaypointName: 'stop name',
    ariaAddWaypoint: 'add stop',
    ariaRemoveWaypoint: 'remove stop',
    ariaSavePreset: 'save as preset',
    ariaDeletePreset: 'delete preset',
    ariaH10: 'hours, tens digit',
    ariaH1: 'hours, ones digit',
    ariaM10: 'minutes, tens digit',
    ariaM1: 'minutes, ones digit',
    ariaOk: 'confirm',
    ariaCancel: 'cancel',
    ariaLabelRun: 'countdown label',
    ariaLabelDone: 'finished label',
  },
};

export const LANGS = Object.keys(STRINGS);

/** "{}" 1회 치환 템플릿 적용 — waypointUntil 류 문구 조립 전용. */
export function fill(template, value) {
  return template.replace('{}', value);
}

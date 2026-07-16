/** 언어별 UI 문자열. 키 집합은 모든 로케일에서 동일해야 한다 — 테스트가 고정한다. */
export const STRINGS = {
  ko: {
    countdown: '퇴근까지',
    expired: '퇴근',
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

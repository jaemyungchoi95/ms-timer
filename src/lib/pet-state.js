/**
 * 시트 행 이름 전체 — cat-manifest rows 키와 1:1 계약.
 * cat-sheet.test.js 가 이 배열로 생성물 완전성을 검증한다.
 */
export const PET_ROW_NAMES = ['dawn', 'morning', 'day', 'evening', 'night', 'imminent', 'expired', 'hover'];

/**
 * 상태 → 재생할 행 이름. 우선순위: interacting > expired > imminent > daypart.
 * 드래그와 호버는 같은 행을 재생하므로 interacting 하나로 통합한다 (spec §5).
 */
export function selectPetAnimation({ interacting, timerState, daypart }) {
  if (interacting) return 'hover';
  if (timerState === 'expired') return 'expired';
  if (timerState === 'imminent') return 'imminent';
  return daypart;
}

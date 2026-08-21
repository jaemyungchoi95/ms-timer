import { WAYPOINT_ICONS } from '../lib/schedule.js';

/**
 * 뱃지 키 → 번들 에셋 경로. 키 화이트리스트(WAYPOINT_ICONS) 밖의 값은
 * 여기 사전에 없으므로 조회가 undefined 가 된다 — 경로 조립에 원시 문자열을
 * 쓰지 않는 것이 팝업 query 값 방어의 핵심이다.
 * index.html 과 popup.html 이 같은 renderer/ 에 있어 상대경로를 공유한다.
 */
export const ICON_SRC = Object.fromEntries(
  WAYPOINT_ICONS.map((key) => [key, `assets/icons/${key}.png`]),
);

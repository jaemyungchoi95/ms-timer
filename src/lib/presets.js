import { normalizeLabel } from './label.js';
import { isValidTime } from './target-time.js';

/** 프리셋 개수 상한 — 칩 스트립이 패널 안에서 감당하는 수준 (spec §5b). */
export const MAX_PRESETS = 6;

const minutesOf = (p) => p.h * 60 + p.m;
const byTime = (a, b) => minutesOf(a) - minutesOf(b);

/**
 * 프리셋 1개 정규화. 프리셋은 문구가 정체성이므로 name 이 필수다(1..12자,
 * normalizeLabel 단일 소스) — waypoint 와 달리 빈 이름을 허용하지 않는다.
 */
function normalizePreset(item) {
  if (item === null || typeof item !== 'object') return null;
  const { h, m, name } = item;
  if (!isValidTime(h, m) || typeof name !== 'string') return null;
  const label = normalizeLabel(name);
  if (label === null) return null;
  return { h, m, name: label };
}

/**
 * JSON 문자열 → 정규화된 프리셋 배열(시각 오름차순) or null.
 * 문구 중복 금지 — 문구가 upsert 의 키다. 위반 시 전체 null → 호출부 빈 배열 폴백.
 */
export function parsePresets(str) {
  if (typeof str !== 'string') return null;

  let raw;
  try {
    raw = JSON.parse(str);
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw.length > MAX_PRESETS) return null;

  const out = [];
  for (const item of raw) {
    const p = normalizePreset(item);
    if (p === null) return null;
    out.push(p);
  }

  if (new Set(out.map((p) => p.name)).size !== out.length) return null;
  return out.sort(byTime);
}

/** 프리셋 배열 → JSON 문자열 (parsePresets 와 왕복 대칭). */
export function formatPresets(list) {
  return JSON.stringify(list.map(({ h, m, name }) => ({ h, m, name })));
}

/**
 * 같은 문구 = 시각 갱신, 새 문구 = 추가. 순수 함수 — 새 배열을 반환한다.
 * 무효 프리셋이거나, 신규인데 캡 초과면 null (호출부는 무시 — ☆ 비활성이 1차 방어).
 */
export function upsertPreset(list, preset) {
  const p = normalizePreset(preset);
  if (p === null) return null;

  const exists = list.some((x) => x.name === p.name);
  if (!exists && list.length >= MAX_PRESETS) return null;

  const next = list.filter((x) => x.name !== p.name);
  next.push(p);
  return next.sort(byTime);
}

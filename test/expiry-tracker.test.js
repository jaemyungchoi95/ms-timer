import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExpiryTracker } from '../src/lib/expiry-tracker.js';

test('진행 → 만료 전환에서 정확히 1회 fire', () => {
  const t = createExpiryTracker();
  assert.equal(t.observe(false), false);
  assert.equal(t.observe(false), false);
  assert.equal(t.observe(true), true);   // 전환
  assert.equal(t.observe(true), false);  // 지속 — 재발화 없음
});

test('첫 관측이 만료면 침묵 — 18:30 에 켠 앱', () => {
  const t = createExpiryTracker();
  assert.equal(t.observe(true), false);
  assert.equal(t.observe(true), false);
});

test('rebaseline(true) 후 만료 관측은 침묵 — 과거 시각을 설정한 경우', () => {
  const t = createExpiryTracker();
  t.observe(false);                       // 09:00, target 18:00 — 진행 중
  t.rebaseline(true);                     // 사용자가 target 을 08:00 으로 변경
  assert.equal(t.observe(true), false);   // 오발화 금지
});

test('rebaseline(false) 후 도달하면 fire — 미래로 재설정 후 재무장', () => {
  const t = createExpiryTracker();
  t.observe(true);                        // 만료 상태
  t.rebaseline(false);                    // target 을 미래로 변경
  assert.equal(t.observe(false), false);
  assert.equal(t.observe(true), true);    // 새 target 도달 — 발화
});

test('자정 롤오버 — 만료 → 진행 → 만료에서 다시 fire (재무장 무제한)', () => {
  const t = createExpiryTracker();
  t.observe(false);
  assert.equal(t.observe(true), true);    // 오늘 18:00
  assert.equal(t.observe(false), false);  // 자정 롤오버로 다시 진행
  assert.equal(t.observe(true), true);    // 내일 18:00 — 다시 발화
});

test('rebaseline 직후 같은 레벨 관측은 전환이 아니다', () => {
  const t = createExpiryTracker();
  t.rebaseline(false);
  assert.equal(t.observe(false), false);
  t.rebaseline(true);
  assert.equal(t.observe(true), false);
});

test('트래커 2개는 독립', () => {
  const a = createExpiryTracker();
  const b = createExpiryTracker();
  a.observe(false);
  assert.equal(a.observe(true), true);
  assert.equal(b.observe(true), false);   // b 는 첫 관측 — 침묵
});

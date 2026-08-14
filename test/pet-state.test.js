import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectPetAnimation, PET_ROW_NAMES } from '../src/lib/pet-state.js';

const DAYPARTS = ['dawn', 'morning', 'day', 'evening', 'night'];

test('인터랙션은 모든 타이머 상태·시간대를 이긴다', () => {
  for (const timerState of ['running', 'imminent', 'expired']) {
    for (const daypart of DAYPARTS) {
      assert.equal(selectPetAnimation({ interacting: true, timerState, daypart }), 'hover');
    }
  }
});

test('우선순위 만료 > 임박 > 시간대 — 전수', () => {
  for (const daypart of DAYPARTS) {
    assert.equal(selectPetAnimation({ interacting: false, timerState: 'expired', daypart }), 'expired');
    assert.equal(selectPetAnimation({ interacting: false, timerState: 'imminent', daypart }), 'imminent');
    assert.equal(selectPetAnimation({ interacting: false, timerState: 'running', daypart }), daypart);
  }
});

test('PET_ROW_NAMES 는 함수가 반환 가능한 이름 전체와 일치한다', () => {
  assert.deepEqual(new Set(PET_ROW_NAMES), new Set(['hover', 'expired', 'imminent', ...DAYPARTS]));
  assert.equal(PET_ROW_NAMES.length, 8);
});

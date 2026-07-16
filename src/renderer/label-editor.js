import { normalizeLabel } from '../lib/label.js';

const KEY_RUN = 'ms-timer:label-run';
const KEY_DONE = 'ms-timer:label-done';

/**
 * 복원은 둘 다 유효할 때만 커스텀으로 인정한다 — 반쪽 커스텀은 존재하지 않는다.
 * 한쪽만 손상되면 둘 다 무시하고 기본 문구로 폴백.
 */
function readLabels() {
  try {
    const run = normalizeLabel(localStorage.getItem(KEY_RUN));
    const done = normalizeLabel(localStorage.getItem(KEY_DONE));
    return run !== null && done !== null ? { run, done } : null;
  } catch {
    return null;
  }
}

function writeLabels(labels) {
  try {
    if (labels === null) {
      localStorage.removeItem(KEY_RUN);
      localStorage.removeItem(KEY_DONE);
    } else {
      localStorage.setItem(KEY_RUN, labels.run);
      localStorage.setItem(KEY_DONE, labels.done);
    }
  } catch {
    // 영속화 불가 — 세션 전용으로 동작한다
  }
}

/**
 * 제목(진행/완료 문구 쌍) 표시/편집.
 * 초기 라벨({run, done} | null)을 반환하고, 확정 시 onChange(labels | null)를 호출한다.
 * null 은 "커스텀 없음 — 언어별 기본 문구 사용"이다.
 */
export function initLabelEditor(root, onChange) {
  const display = root.querySelector('[data-label-display]');
  const trigger = root.querySelector('[data-label-trigger]');
  const edit = root.querySelector('[data-label-edit]');
  const runInput = root.querySelector('[data-label-run]');
  const doneInput = root.querySelector('[data-label-done]');
  const okBtn = root.querySelector('[data-label-ok]');
  const cancelBtn = root.querySelector('[data-label-cancel]');

  let current = readLabels();

  /**
   * 유효 상태 3가지: 커스텀({run,done}) / 리셋(null — 두 칸 모두 공백) / 무효(undefined).
   * 두 칸 모두 공백 + ✓ 는 "기본 문구로 되돌리기" 경로다 — 빈 제목이라는 상태는 없다.
   */
  function validate() {
    const run = normalizeLabel(runInput.value);
    const done = normalizeLabel(doneInput.value);
    const bothBlank = runInput.value.trim() === '' && doneInput.value.trim() === '';
    const valid = (run !== null && done !== null) || bothBlank;
    okBtn.disabled = !valid;
    edit.classList.toggle('invalid', !valid);
    if (!valid) return undefined;
    return bothBlank ? null : { run, done };
  }

  function showDisplay() {
    display.hidden = false;
    edit.hidden = true;
  }

  function showEdit() {
    runInput.value = current?.run ?? '';
    doneInput.value = current?.done ?? '';
    display.hidden = true;
    edit.hidden = false;
    validate();
    runInput.focus();
    runInput.select();
  }

  function commit() {
    const result = validate();
    if (result === undefined) return;
    current = result;
    writeLabels(current);
    onChange(current);
    showDisplay();
  }

  // Enter/Escape 는 편집기 전역, 그리고 keydown 전파를 여기서 끊는다 —
  // target-editor 와 같은 계약: 편집 중 T/L 이 테마/언어를 바꾸지 못한다.
  edit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target !== cancelBtn) commit(); // 취소 버튼 위에서 Enter 는 버튼의 기본 동작(클릭=취소)에 맡긴다 — 여기서 commit 하면 "취소가 저장"이 된다.
    else if (e.key === 'Escape') showDisplay();
    e.stopPropagation();
  });

  for (const input of [runInput, doneInput]) {
    input.addEventListener('input', validate);
  }

  trigger.addEventListener('click', showEdit);
  okBtn.addEventListener('click', commit);
  cancelBtn.addEventListener('click', showDisplay);

  showDisplay();
  return current;
}

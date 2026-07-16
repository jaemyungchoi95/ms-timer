import { formatTarget, parseTarget } from '../lib/target-time.js';

const STORAGE_KEY = 'ms-timer:target';
const DEFAULT_TARGET = { h: 18, m: 0 };

/**
 * Electron 43은 file:// origin에서 localStorage를 허용함이 실측으로 확인됨(2026-07-15).
 * try/catch는 차단되는 환경을 위한 fallback으로 유지 — 그 경우 세션 전용으로 동작한다.
 */
function readTarget() {
  try {
    return parseTarget(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_TARGET;
  } catch {
    return DEFAULT_TARGET;
  }
}

function writeTarget(target) {
  try {
    localStorage.setItem(STORAGE_KEY, formatTarget(target));
  } catch {
    // 영속화 불가 — 세션 전용으로 동작한다
  }
}

/**
 * 목표 시각 표시 + 편집기.
 * 초기 target 을 반환하고, 사용자가 확정할 때마다 onChange(target) 를 호출한다.
 * rAF 루프 시작 전에 1회 호출한다.
 */
export function initTargetEditor(root, onChange) {
  const display = root.querySelector('[data-target-display]');
  const edit = root.querySelector('[data-target-edit]');
  const cells = [...root.querySelectorAll('[data-cell]')];
  const okBtn = root.querySelector('[data-target-ok]');
  const cancelBtn = root.querySelector('[data-target-cancel]');

  let current = readTarget();

  /**
   * 네 칸을 "HH:MM" 으로 합친다. 빈 칸이 있으면 문자열이 짧아져
   * parseTarget 의 엄격 정규식이 자동으로 걸러낸다 —
   * ['1','','3','0'] → "130" → "13:0" → null.
   */
  function typedValue() {
    const d = cells.map((c) => c.value).join('');
    return `${d.slice(0, 2)}:${d.slice(2)}`;
  }

  function validate() {
    const target = parseTarget(typedValue());
    okBtn.disabled = target === null;
    edit.classList.toggle('invalid', target === null);
    return target;
  }

  function showDisplay() {
    display.textContent = formatTarget(current);
    display.hidden = false;
    edit.hidden = true;
  }

  function showEdit() {
    const digits = formatTarget(current).replace(':', '');
    cells.forEach((cell, i) => { cell.value = digits[i]; });
    display.hidden = true;
    edit.hidden = false;
    validate();
    cells[0].focus();
  }

  function commit() {
    const target = validate();
    if (target === null) return;
    current = target;
    writeTarget(current);
    onChange(current);
    showDisplay();
  }

  function cancel() {
    showDisplay();
  }

  cells.forEach((cell, i) => {
    // 포커스 시 전체 선택 — 타이핑이 곧 덮어쓰기가 된다
    cell.addEventListener('focus', () => cell.select());

    // 숫자 한 글자만 허용. 삭제는 e.data 가 null 이라 통과한다.
    cell.addEventListener('beforeinput', (e) => {
      if (e.data !== null && !/^\d$/.test(e.data)) e.preventDefault();
    });

    cell.addEventListener('input', () => {
      validate();
      if (cell.value !== '' && i < cells.length - 1) cells[i + 1].focus();
    });

    cell.addEventListener('keydown', (e) => {
      // 숫자 키는 선택 상태와 무관하게 그 칸을 덮어쓰고 다음 칸으로 이동한다.
      // beforeinput/maxlength 경로에 맡기면, 이미 포커스된 칸을 캐럿이 collapse 된 채
      // 재입력할 때(포커스 이동 없이 값이 있는 칸을 다시 타이핑) insertText 가
      // maxlength=1 에 막혀 키 입력이 아무 피드백 없이 사라진다.
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        cell.value = e.key;
        validate();
        if (i < cells.length - 1) cells[i + 1].focus();
        return;
      }
      if (e.key === 'ArrowLeft' && i > 0) { cells[i - 1].focus(); e.preventDefault(); return; }
      if (e.key === 'ArrowRight' && i < cells.length - 1) { cells[i + 1].focus(); e.preventDefault(); return; }
      // 빈 칸에서 Backspace 면 이전 칸으로
      if (e.key === 'Backspace' && cell.value === '' && i > 0) {
        cells[i - 1].focus();
        e.preventDefault();
      }
    });
  });

  // Enter/Escape는 칸이 아니라 편집기 전체의 관심사이므로 컨테이너에 바인딩한다.
  // ✓/↻ 버튼은 <input>이 아니라 셀별 keydown 핸들러가 닿지 않으므로 여기서만 잡힌다.
  // 같은 리스너에서 무조건 stopPropagation 하여, 편집기 내부의 모든 키 입력이
  // window(theme.js의 T 토글)까지 버블링되지 않도록 경계를 명확히 한다.
  edit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') cancel();
    e.stopPropagation();
  });

  display.addEventListener('click', showEdit);
  okBtn.addEventListener('click', commit);
  cancelBtn.addEventListener('click', cancel);

  showDisplay();
  return current;
}

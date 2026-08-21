import { formatTarget, parseTarget } from '../lib/target-time.js';
import { MAX_WAYPOINTS, formatWaypoints, parseWaypoints } from '../lib/schedule.js';
import { MAX_PRESETS, formatPresets, parsePresets, upsertPreset } from '../lib/presets.js';
import { STRINGS } from '../lib/strings.js';

const KEY_TARGET = 'ms-timer:target';
const KEY_WAYPOINTS = 'ms-timer:waypoints';
const KEY_PRESETS = 'ms-timer:waypoint-presets';
const DEFAULT_TARGET = { h: 18, m: 0 };

/** target-editor 시절과 동일한 저장 관용 — 실패 시 세션 전용으로 동작한다. */
function readTarget() {
  try {
    return parseTarget(localStorage.getItem(KEY_TARGET)) ?? DEFAULT_TARGET;
  } catch {
    return DEFAULT_TARGET;
  }
}

function readWaypoints() {
  try {
    return parseWaypoints(localStorage.getItem(KEY_WAYPOINTS)) ?? [];
  } catch {
    return [];
  }
}

function readPresets() {
  try {
    return parsePresets(localStorage.getItem(KEY_PRESETS)) ?? [];
  } catch {
    return [];
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 영속화 불가 — 세션 전용으로 동작한다
  }
}

const minutesOf = (t) => t.h * 60 + t.m;

/**
 * 4-cell 시각 입력 동작 — target-editor 의 셀 계약 그대로:
 * 포커스=전체선택, 숫자만, 숫자는 덮어쓰고 전진, 화살표 이동, 빈 칸 Backspace 후진.
 */
function wireCells(cells, onEdit) {
  cells.forEach((cell, i) => {
    cell.addEventListener('focus', () => cell.select());

    cell.addEventListener('beforeinput', (e) => {
      if (e.data !== null && !/^\d$/.test(e.data)) e.preventDefault();
    });

    cell.addEventListener('input', () => {
      onEdit();
      if (cell.value !== '' && i < cells.length - 1) cells[i + 1].focus();
    });

    cell.addEventListener('keydown', (e) => {
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        cell.value = e.key;
        onEdit();
        if (i < cells.length - 1) cells[i + 1].focus();
        return;
      }
      if (e.key === 'ArrowLeft' && i > 0) { cells[i - 1].focus(); e.preventDefault(); return; }
      if (e.key === 'ArrowRight' && i < cells.length - 1) { cells[i + 1].focus(); e.preventDefault(); return; }
      if (e.key === 'Backspace' && cell.value === '' && i > 0) {
        cells[i - 1].focus();
        e.preventDefault();
      }
    });
  });
}

/**
 * 일정(경유지 0..N + 최종) 표시/편집 오버레이 패널 + 프리셋 라이브러리.
 * 초기 {target, waypoints} 를 반환하고, 일괄 확정 시 onChange 를 호출한다.
 * 헤더 시각 표시([data-target-display])의 textContent 는 clock.js 소유 —
 * 여기서는 절대 쓰지 않는다 (구간 전환 갱신과 두 작성자가 되면 안 된다).
 */
export function initScheduleEditor(root, { getLang, onChange }) {
  const display = root.querySelector('[data-target-display]');
  const panel = root.querySelector('[data-sched-edit]');
  const rowsEl = root.querySelector('[data-sched-rows]');
  const presetsEl = root.querySelector('[data-sched-presets]');
  const addBtn = root.querySelector('[data-sched-add]');
  const okBtn = root.querySelector('[data-sched-ok]');
  const cancelBtn = root.querySelector('[data-sched-cancel]');

  let current = { target: readTarget(), waypoints: readWaypoints() };
  let presets = readPresets();

  const strings = () => STRINGS[getLang()];
  const waypointRows = () => [...rowsEl.querySelectorAll('.sched-row:not(.final)')];
  const finalRow = () => rowsEl.querySelector('.sched-row.final');

  function makeCell(l10nKey) {
    const cell = document.createElement('input');
    cell.className = 'cell';
    cell.type = 'text';
    cell.inputMode = 'numeric';
    cell.maxLength = 1;
    cell.setAttribute('aria-label', strings()[l10nKey]);
    return cell;
  }

  function makeBtn(className, text, l10nKey) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = text;
    btn.setAttribute('aria-label', strings()[l10nKey]);
    return btn;
  }

  /** 행 1개 생성 — isFinal 이면 이름/☆/✕ 없이 최종 표식만 붙는다. */
  function buildRow({ h, m, name }, isFinal) {
    const row = document.createElement('div');
    row.className = isFinal ? 'sched-row final' : 'sched-row';

    // h/m 이 정수가 아니면(＋ 로 만든 빈 행) 네 칸 모두 빈 채로 시작한다.
    const digits = Number.isInteger(h) ? formatTarget({ h, m }).replace(':', '') : '';
    const cells = ['ariaH10', 'ariaH1', 'ariaM10', 'ariaM1'].map((key, i) => {
      const cell = makeCell(key);
      cell.value = digits[i] ?? '';
      return cell;
    });
    wireCells(cells, validate);

    row.append(cells[0], cells[1]);
    const sep = document.createElement('span');
    sep.className = 'cell-sep';
    sep.textContent = ':';
    row.append(sep, cells[2], cells[3]);

    if (isFinal) {
      const mark = document.createElement('span');
      mark.className = 'final-mark';
      mark.textContent = strings().finalMark;
      row.append(mark);
      return row;
    }

    const nameInput = document.createElement('input');
    nameInput.className = 'label-input sched-name';
    nameInput.type = 'text';
    nameInput.maxLength = 12;
    nameInput.value = name;
    nameInput.setAttribute('aria-label', strings().ariaWaypointName);
    nameInput.setAttribute('placeholder', strings().ariaWaypointName);
    nameInput.addEventListener('input', validate);
    row.append(nameInput);

    const starBtn = makeBtn('target-btn sched-star', '☆', 'ariaSavePreset');
    starBtn.addEventListener('click', () => saveAsPreset(row));
    row.append(starBtn);

    const removeBtn = makeBtn('target-btn', '✕', 'ariaRemoveWaypoint');
    removeBtn.addEventListener('click', () => {
      row.remove();
      validate();
    });
    row.append(removeBtn);

    return row;
  }

  /** 행의 4칸을 "HH:MM" 으로 합쳐 파싱 — 빈 칸은 엄격 정규식이 걸러낸다. */
  function rowTime(row) {
    const d = [...row.querySelectorAll('.cell')].map((c) => c.value).join('');
    return parseTarget(`${d.slice(0, 2)}:${d.slice(2)}`);
  }

  function rowName(row) {
    return row.querySelector('.sched-name').value.trim();
  }

  function addRow(values) {
    rowsEl.insertBefore(buildRow(values, false), finalRow());
    validate();
  }

  /**
   * live 검증 — 형식 / 경유지 < 최종 / 시각 중복. 위반 행에 invalid 클래스,
   * 전체 유효할 때만 ✓ 활성. ☆·＋·칩의 활성 상태도 여기서 일괄 갱신한다.
   */
  function validate() {
    const rows = waypointRows();
    const fRow = finalRow();
    const fTime = rowTime(fRow);
    fRow.classList.toggle('invalid', fTime === null);

    const seen = new Map(); // minutes → 첫 행 (중복 시 둘 다 invalid)
    let allValid = fTime !== null;

    for (const row of rows) {
      const t = rowTime(row);
      let bad = t === null;
      if (t !== null) {
        if (fTime !== null && minutesOf(t) >= minutesOf(fTime)) bad = true;
        const prev = seen.get(minutesOf(t));
        if (prev !== undefined) {
          bad = true;
          prev.classList.add('invalid');
        } else {
          seen.set(minutesOf(t), row);
        }
      }
      row.classList.toggle('invalid', bad);
      if (bad) allValid = false;

      const name = rowName(row);
      const starable = t !== null && name !== ''
        && (presets.some((p) => p.name === name) || presets.length < MAX_PRESETS);
      row.querySelector('.sched-star').disabled = !starable;
    }

    okBtn.disabled = !allValid;
    const full = rows.length >= MAX_WAYPOINTS;
    addBtn.disabled = full;
    for (const chip of presetsEl.querySelectorAll('.chip-insert')) chip.disabled = full;
    return allValid ? { fTime, rows } : null;
  }

  /** ☆ — 즉시 저장. 프리셋은 일정이 아니라 라이브러리라 ↻ 취소와 무관하게 남는다. */
  function saveAsPreset(row) {
    const t = rowTime(row);
    const name = rowName(row);
    if (t === null || name === '') return;
    const next = upsertPreset(presets, { h: t.h, m: t.m, name });
    if (next === null) return;
    presets = next;
    write(KEY_PRESETS, formatPresets(presets));
    renderChips();
    validate();
  }

  function renderChips() {
    presetsEl.textContent = '';
    for (const preset of presets) {
      const chip = document.createElement('span');
      chip.className = 'chip';

      const insert = document.createElement('button');
      insert.type = 'button';
      insert.className = 'chip-insert';
      insert.textContent = `${preset.name} ${formatTarget(preset)}`;
      insert.setAttribute('aria-label', `${preset.name} ${formatTarget(preset)}`);
      insert.addEventListener('click', () => {
        if (waypointRows().length >= MAX_WAYPOINTS) return;
        addRow(preset); // 복사 — 이후 프리셋을 지워도 행은 남는다
      });
      chip.append(insert);

      const del = makeBtn('chip-x', '✕', 'ariaDeletePreset');
      del.addEventListener('click', () => {
        presets = presets.filter((p) => p.name !== preset.name);
        write(KEY_PRESETS, formatPresets(presets));
        renderChips();
        validate();
      });
      chip.append(del);

      presetsEl.append(chip);
    }
  }

  function showDisplay() {
    display.hidden = false;
    panel.hidden = true;
  }

  function showEdit() {
    rowsEl.textContent = '';
    for (const wp of current.waypoints) rowsEl.append(buildRow(wp, false));
    rowsEl.append(buildRow({ h: current.target.h, m: current.target.m, name: '' }, true));
    renderChips();
    validate();
    display.hidden = true;
    panel.hidden = false;
    rowsEl.querySelector('.cell').focus();
  }

  /** 일괄 확정 — 경유지 + 최종을 한 번에 저장·적용한다. */
  function commit() {
    const result = validate();
    if (result === null) return;
    const waypoints = result.rows
      .map((row) => {
        const t = rowTime(row);
        return { h: t.h, m: t.m, name: rowName(row) };
      })
      .sort((a, b) => minutesOf(a) - minutesOf(b));
    current = { target: result.fTime, waypoints };
    write(KEY_TARGET, formatTarget(current.target));
    write(KEY_WAYPOINTS, formatWaypoints(current.waypoints));
    onChange(current);
    showDisplay();
  }

  // Enter/Escape 는 패널 전역 관심사. 버튼 위의 Enter 는 그 버튼의 기본
  // 동작(클릭)에 맡긴다 — 여기서 commit 하면 "취소/삭제가 저장"이 된다.
  // 무조건 stopPropagation — 편집 중 키 입력이 T/L/P 토글로 새지 않는다.
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) commit();
    else if (e.key === 'Escape') showDisplay();
    e.stopPropagation();
  });

  display.addEventListener('click', showEdit);
  addBtn.addEventListener('click', () => addRow({ h: null, m: null, name: '' }));
  okBtn.addEventListener('click', commit);
  cancelBtn.addEventListener('click', showDisplay);

  showDisplay();
  return current;
}

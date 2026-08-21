import { formatTarget, parseTarget } from '../lib/target-time.js';
import {
  DEFAULT_ICON,
  MAX_WAYPOINTS,
  WAYPOINT_ICONS,
  formatWaypoints,
  parseWaypoints,
} from '../lib/schedule.js';
import { normalizeLabel } from '../lib/label.js';
import { STRINGS } from '../lib/strings.js';
import { ICON_SRC } from './icons.js';

const KEY_TARGET = 'ms-timer:target';
const KEY_WAYPOINTS = 'ms-timer:waypoints';
const KEY_RUN = 'ms-timer:label-run';
const KEY_DONE = 'ms-timer:label-done';
const DEFAULT_TARGET = { h: 18, m: 0 };

/** 저장 관용 — 실패 시 세션 전용으로 동작한다. */
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

/**
 * Finish 문구 쌍 — 기존 label-run/done 키를 계승한다 (spec §5c-2).
 * both-valid 게이트는 폐지: 칸별 독립 `커스텀('' 아님) ?? 기본` 폴백이라
 * 반쪽 커스텀이 정합한 상태다. '' = 기본 문구 사용.
 */
function readFinish() {
  const read = (key) => {
    try {
      return normalizeLabel(localStorage.getItem(key)) ?? '';
    } catch {
      return '';
    }
  };
  return { run: read(KEY_RUN), done: read(KEY_DONE) };
}

function write(key, value) {
  try {
    if (value === '') localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // 영속화 불가 — 세션 전용으로 동작한다
  }
}

const minutesOf = (t) => t.h * 60 + t.m;

/** 4-cell 시각 입력 동작 — 기존 셀 계약 그대로. */
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
 * 일정 모달 v2 (spec §5c) — 행 = [뱃지][HH:MM][표시 문구][도달 문구][✕],
 * Finish 행은 뱃지 고정·✕ 없음이며 두 문구 칸이 기존 진행/완료 라벨을 계승한다.
 * 저장 = 일괄 커밋 + 닫힘, X/Esc = 폐기 + 닫힘. 새 행은 맨 위, 정렬은 저장 시점.
 * 초기 {target, waypoints, finish} 를 반환하고 저장 시 onChange 를 호출한다.
 */
export function initScheduleEditor({ trigger, panel, getLang, onChange }) {
  const rowsEl = panel.querySelector('[data-sched-rows]');
  const saveBtn = panel.querySelector('[data-sched-ok]');
  const closeBtn = panel.querySelector('[data-sched-cancel]');
  const addBtn = panel.querySelector('[data-sched-add]');

  let current = { target: readTarget(), waypoints: readWaypoints(), finish: readFinish() };

  const strings = () => STRINGS[getLang()];
  const waypointRows = () => [...rowsEl.querySelectorAll('.sched-row:not(.final)')];
  const finalRow = () => rowsEl.querySelector('.sched-row.final');

  /** 열려 있는 뱃지 picker — 항상 1개 이하. */
  let openPicker = null;
  function closePicker() {
    if (openPicker !== null) {
      openPicker.remove();
      openPicker = null;
    }
  }

  function makeCell(l10nKey) {
    const cell = document.createElement('input');
    cell.className = 'cell';
    cell.type = 'text';
    cell.inputMode = 'numeric';
    cell.maxLength = 1;
    cell.setAttribute('aria-label', strings()[l10nKey]);
    return cell;
  }

  function makePhraseInput(value, phKey) {
    const input = document.createElement('input');
    input.className = 'label-input sched-phrase';
    input.type = 'text';
    input.maxLength = 12;
    input.value = value;
    input.setAttribute('aria-label', strings()[phKey]);
    input.setAttribute('placeholder', strings()[phKey]);
    return input;
  }

  function buildPicker(row) {
    const picker = document.createElement('div');
    picker.className = 'icon-picker';
    for (const key of WAYPOINT_ICONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon-pick';
      btn.setAttribute('aria-label', key);
      const img = document.createElement('img');
      img.src = ICON_SRC[key];
      img.alt = '';
      btn.append(img);
      btn.addEventListener('click', () => {
        row.dataset.icon = key;
        row.querySelector('.sched-badge img').src = ICON_SRC[key];
        closePicker();
      });
      picker.append(btn);
    }
    return picker;
  }

  /** 행 1개 생성 — isFinal 이면 뱃지 FINISH 고정·✕ 없음. */
  function buildRow(wp, isFinal) {
    const row = document.createElement('div');
    row.className = isFinal ? 'sched-row final' : 'sched-row';
    row.dataset.icon = isFinal ? 'finish' : wp.icon;

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'sched-badge';
    badge.setAttribute('aria-label', strings().ariaPickIcon);
    const badgeImg = document.createElement('img');
    badgeImg.src = ICON_SRC[row.dataset.icon];
    badgeImg.alt = isFinal ? strings().finalMark : '';
    badge.append(badgeImg);
    if (isFinal) {
      badge.disabled = true; // FINISH 고정 — picker 없음
    } else {
      badge.addEventListener('click', () => {
        const wasMine = openPicker !== null && openPicker.previousElementSibling === row;
        closePicker();
        if (wasMine) return; // 같은 뱃지 재클릭 = 토글 닫기
        openPicker = buildPicker(row);
        row.after(openPicker);
      });
    }
    row.append(badge);

    // h/m 이 정수가 아니면(clock-plus 로 만든 빈 행) 네 칸 모두 빈 채로 시작한다.
    const digits = Number.isInteger(wp.h) ? formatTarget(wp).replace(':', '') : '';
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

    row.append(makePhraseInput(wp.run, 'phRun'));
    row.append(makePhraseInput(wp.done, 'phDone'));

    if (!isFinal) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'target-btn';
      removeBtn.textContent = '✕';
      removeBtn.setAttribute('aria-label', strings().ariaRemoveWaypoint);
      removeBtn.addEventListener('click', () => {
        closePicker();
        row.remove();
        validate();
      });
      row.append(removeBtn);
    }

    return row;
  }

  /** 행의 4칸을 "HH:MM" 으로 합쳐 파싱 — 빈 칸은 엄격 정규식이 걸러낸다. */
  function rowTime(row) {
    const d = [...row.querySelectorAll('.cell')].map((c) => c.value).join('');
    return parseTarget(`${d.slice(0, 2)}:${d.slice(2)}`);
  }

  function rowPhrases(row) {
    const [run, done] = [...row.querySelectorAll('.sched-phrase')].map((el) => el.value.trim());
    return { run, done };
  }

  /**
   * live 검증 — 형식 / 경유지 < 최종 / 시각 중복. 위반 행 invalid 클래스 +
   * 저장 비활성. 정렬은 하지 않는다 — 재정렬·정규화는 저장 시점 (spec §5c-2).
   */
  function validate() {
    const rows = waypointRows();
    const fRow = finalRow();
    const fTime = rowTime(fRow);
    fRow.classList.toggle('invalid', fTime === null);

    const seen = new Map();
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
    }

    saveBtn.disabled = !allValid;
    addBtn.disabled = rows.length >= MAX_WAYPOINTS;
    return allValid ? { fTime, rows } : null;
  }

  function showEdit() {
    // 모달이 열린 채 제목 재클릭 시 재빌드하면 미저장 편집이 조용히 날아간다 —
    // 모달이 제목을 가리지 않는 창 크기에서 실제로 가능한 경로 (리뷰 지적).
    if (!panel.hidden) return;
    closePicker();
    rowsEl.textContent = '';
    for (const wp of current.waypoints) rowsEl.append(buildRow(wp, false));
    rowsEl.append(buildRow(
      { h: current.target.h, m: current.target.m, run: current.finish.run, done: current.finish.done },
      true,
    ));
    validate();
    panel.hidden = false;
    rowsEl.querySelector('.cell').focus();
  }

  function close() {
    closePicker();
    panel.hidden = true;
  }

  /** 저장 — 이 세션의 신규/수정/삭제 전부 일괄 커밋 + 닫힘. */
  function commit() {
    const result = validate();
    if (result === null) return;
    const waypoints = result.rows
      .map((row) => {
        const t = rowTime(row);
        const { run, done } = rowPhrases(row);
        return { h: t.h, m: t.m, run, done, icon: row.dataset.icon };
      })
      .sort((a, b) => minutesOf(a) - minutesOf(b));
    const finish = rowPhrases(finalRow());
    current = { target: result.fTime, waypoints, finish };
    try {
      localStorage.setItem(KEY_TARGET, formatTarget(current.target));
      localStorage.setItem(KEY_WAYPOINTS, formatWaypoints(current.waypoints));
    } catch {
      // 영속화 불가 — 세션 전용으로 동작한다
    }
    write(KEY_RUN, finish.run);
    write(KEY_DONE, finish.done);
    onChange(current);
    close();
  }

  // Enter/Escape 는 모달 전역 관심사. 버튼 위 Enter 는 그 버튼의 기본 동작(클릭)에
  // 맡긴다 — 여기서 commit 하면 "닫기/삭제가 저장"이 된다. 무조건 stopPropagation —
  // 편집 중 키 입력이 T/L/P 토글로 새지 않는다.
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) commit();
    else if (e.key === 'Escape') close();
    e.stopPropagation();
  });

  trigger.addEventListener('click', showEdit);
  saveBtn.addEventListener('click', commit);
  closeBtn.addEventListener('click', close);
  addBtn.addEventListener('click', () => {
    closePicker();
    // 새 행은 맨 위 (spec §5c-2) — Finish 행은 항상 마지막이라 영향 없다
    rowsEl.prepend(buildRow({ h: null, m: null, run: '', done: '', icon: DEFAULT_ICON }, false));
    validate();
  });

  return current;
}

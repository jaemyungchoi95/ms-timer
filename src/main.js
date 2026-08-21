import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';

/** 팝업 자동 닫기(ms). 사용자가 클릭하지 않아도 이 시간 뒤 main 이 정리한다. */
const POPUP_TIMEOUT_MS = 60000;

let mainWin = null;
let popup = null;
let popupTimer = null;

function createWindow() {
  mainWin = new BrowserWindow({
    width: 720,
    height: 320,
    minWidth: 420,
    minHeight: 200,
    title: '퇴근까지',
    // themes.css 다크 테마의 --bg와 동일한 값 — 렌더러가 그리기 전 흰 화면 방지용.
    // 메인 프로세스는 렌더러 CSS를 읽을 수 없어 하드코딩 — --bg 변경 시 함께 수정할 것.
    backgroundColor: '#0b0d10',
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs'),
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWin.removeMenu();
  mainWin.loadFile(path.join(import.meta.dirname, 'renderer/index.html'));

  // 본 창이 닫히면 팝업도 동반 파기 — 팝업이 마지막 창으로 남아
  // window-all-closed 를 막는 좀비를 차단한다. 기존 quit 핸들러는 그대로다.
  mainWin.on('closed', () => {
    mainWin = null;
    destroyPopup();
    destroyPet();
  });
}

/**
 * raise 는 픽셀이지 포커스가 아니다 (2026-07-16 실측: setAlwaysOnTop 계열만
 * 백그라운드 타이머에서 rank 0 에 도달하고 show/focus/moveTop/flashFrame 은
 * 전부 BEHIND). 포커스는 요청 자체를 하지 않는다.
 * flashFrame 은 raise 용이 아니라 자리 비운 사용자용 — 작업표시줄 강조가
 * 사용자가 창을 활성화할 때까지 남는 유일한 신호다.
 */
function raiseMain() {
  if (mainWin === null) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.setAlwaysOnTop(true);
  mainWin.flashFrame(true);
}

/** raise 해제 — 팝업 닫힘(클릭/타임아웃)에서만 호출된다. 영구 고정은 존재하지 않는다. */
function releaseMain() {
  if (mainWin === null) return;
  mainWin.setAlwaysOnTop(false);
}

function destroyPopup() {
  if (popupTimer !== null) {
    clearTimeout(popupTimer);
    popupTimer = null;
  }
  if (popup !== null && !popup.isDestroyed()) popup.destroy();
  popup = null;
}

/** pet 창 한 변(px)과 화면 가장자리 기본 마진. spec §3. */
const PET_SIZE = 160;
const PET_MARGIN = 16;
/** 복원 위치가 살아있다고 인정할 최소 겹침(px) — 모니터 구성 변경 대비. */
const PET_MIN_VISIBLE = 24;

let petWin = null;
/**
 * topmost 재단언 타이머 — Windows 에서 Win+D·전체화면 앱·일부 런처가
 * TOPMOST 플래그를 벗기면 pet 이 바탕화면 뒤로 가라앉는다. 생성 시 1회로는
 * 부족해서 주기적으로 재설정한다 (이미 최상단이면 사실상 no-op).
 */
let petTopmostTimer = null;
const PET_TOPMOST_REASSERT_MS = 10_000;
/** 레벨 캐시 — pet 이 나중에 켜져도(만료 후 P) 현재 상태를 즉시 받는다. */
let lastTimerState = 'running';
const TIMER_STATES = new Set(['running', 'imminent', 'expired']);

function petDefaultPosition() {
  // 팝업과 같은 근사 — 커서가 있는 디스플레이의 workArea 우하단.
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  return {
    x: Math.round(workArea.x + workArea.width - PET_SIZE - PET_MARGIN),
    y: Math.round(workArea.y + workArea.height - PET_SIZE - PET_MARGIN),
  };
}

/** 어떤 디스플레이와도 24px 이상 겹치지 않으면 null — 호출자가 기본 위치로 폴백한다. */
function clampRestoredPosition(pos) {
  for (const d of screen.getAllDisplays()) {
    const a = d.workArea;
    const overlapX = Math.min(pos.x + PET_SIZE, a.x + a.width) - Math.max(pos.x, a.x);
    const overlapY = Math.min(pos.y + PET_SIZE, a.y + a.height) - Math.max(pos.y, a.y);
    if (overlapX >= PET_MIN_VISIBLE && overlapY >= PET_MIN_VISIBLE) return pos;
  }
  return null;
}

function stopPetTopmostTimer() {
  if (petTopmostTimer !== null) {
    clearInterval(petTopmostTimer);
    petTopmostTimer = null;
  }
}

function destroyPet() {
  stopPetTopmostTimer();
  if (petWin !== null && !petWin.isDestroyed()) petWin.destroy();
  petWin = null;
}

function createPet() {
  if (petWin !== null) return; // 토글 연타 방어 — 이미 있으면 no-op

  const def = petDefaultPosition();
  const w = new BrowserWindow({
    width: PET_SIZE,
    height: PET_SIZE,
    x: def.x,
    y: def.y,
    // backgroundColor 를 주면 안 된다 — 투명이 깨진다 (main 창의 흰 화면 방지 패턴과 의도적으로 다름)
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false, // 클릭해도 사용자의 작업 창 포커스를 뺏지 않는 순수 위젯
    hasShadow: false,
    show: false, // 표시는 pet:restore-position 수신에서만 — 기본 위치로 번쩍임 방지
    webPreferences: {
      preload: path.join(import.meta.dirname, 'pet-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  petWin = w;

  // 시작은 유령 모드 — forward:true 라 mousemove 는 renderer 에 흘러들어
  // 고양이 위 hover 감지가 가능하다. 실클릭 전환은 renderer 가 요청한다.
  w.setIgnoreMouseEvents(true, { forward: true });
  w.removeMenu(); // per-window — 본 창의 호출은 상속되지 않는다

  w.webContents.on('did-finish-load', () => {
    if (petWin !== w) return; // identity guard — popup 패턴과 동일
    w.webContents.send('pet:timer-state', lastTimerState);
  });

  // 행/크래시 시 파기만 한다 — 자동 재생성 없음, P 토글 2회로 소생 (spec §3).
  const gone = () => {
    if (petWin === w) destroyPet();
  };
  w.webContents.on('render-process-gone', gone);
  w.webContents.on('did-fail-load', gone);
  w.on('closed', () => {
    if (petWin === w) {
      petWin = null;
      stopPetTopmostTimer();
    }
  });

  petTopmostTimer = setInterval(() => {
    if (petWin === w && !w.isDestroyed()) w.setAlwaysOnTop(true, 'screen-saver');
  }, PET_TOPMOST_REASSERT_MS);

  w.loadFile(path.join(import.meta.dirname, 'renderer/pet.html'));
}

function validPetPos(pos) {
  return pos !== null && typeof pos === 'object' && Number.isFinite(pos.x) && Number.isFinite(pos.y);
}

/** 팝업 문구 길이 상한 — renderer 페이로드 검증 (popup.js 의 TEXT_MAX 와 동일). */
const POPUP_TEXT_MAX = 40;

/**
 * text = renderer 가 결정한 팝업 문구, icon = 뱃지 키. null 이면 해당 query 생략 —
 * popup.js 가 기본 문구/아이콘 없음으로 폴백한다. icon 값은 popup 쪽에서
 * 화이트리스트 사전 조회로만 쓰이므로 여기선 형태 검증만 한다.
 */
function openPopup(text, icon) {
  // replace-not-stack: 재발화(시계 역행·절전 다중 통과) 시 겹겹이 쌓지 않는다 —
  // 다중 통과에서는 renderer 가 정렬 순서로 보내므로 가장 늦은 checkpoint 가 남는다
  destroyPopup();

  const w = new BrowserWindow({
    width: 320,
    height: 160,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#0b0d10',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // preload 없음 — 팝업은 window.close() 로 닫히므로 채널이 필요 없다
    },
  });
  popup = w;

  // 자동 닫기는 생성 시점에 무장한다. ready-to-show 에 걸면 첫 페인트 전에
  // 행이 걸린 렌더러가 영원히 산다 — render-process-gone 은 crash 만 잡는다.
  // identity guard 가 콜백 전체를 감싼다 — 옛 팝업의 늦은 이벤트가
  // 새 팝업이 떠 있는 동안 releaseMain 을 불러 raise 를 풀면 안 된다.
  popupTimer = setTimeout(() => {
    if (popup !== w) return;
    destroyPopup();
    releaseMain();
  }, POPUP_TIMEOUT_MS);

  // identity guard: 옛 팝업의 늦은 closed 가 새 팝업의 참조/타이머를 지우면 안 된다
  w.on('closed', () => {
    if (popup !== w) return;
    if (popupTimer !== null) {
      clearTimeout(popupTimer);
      popupTimer = null;
    }
    popup = null;
    releaseMain();
  });

  const dismiss = () => {
    if (popup !== w) return;
    destroyPopup();
    releaseMain();
  };
  w.webContents.on('render-process-gone', dismiss);
  w.webContents.on('did-fail-load', dismiss);

  w.removeMenu(); // per-window — 본 창의 호출은 상속되지 않는다

  w.once('ready-to-show', () => {
    if (w.isDestroyed()) return;
    // 커서가 있는 디스플레이의 workArea 중앙 — 백그라운드 트리거에서
    // "사용자가 보는 모니터"의 최선 근사. center:true 는 포커스된 창의
    // 모니터로 가서 틀린다. workArea 라 작업표시줄을 피한다.
    const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    w.setPosition(
      Math.round(workArea.x + (workArea.width - 320) / 2),
      Math.round(workArea.y + (workArea.height - 160) / 2),
    );
    w.showInactive(); // 활성화를 요청하지 않는다 — Windows 의 거부에 기대지 않고 아예 안 묻는다
  });

  const query = {};
  if (text !== null) query.text = text;
  if (icon !== null) query.icon = icon;
  w.loadFile(
    path.join(import.meta.dirname, 'renderer/popup.html'),
    Object.keys(query).length === 0 ? undefined : { query },
  );
}

ipcMain.on('ms-timer:expired', (_e, text, icon) => {
  raiseMain();
  // 검증 실패는 해당 query 생략 취급 — popup.js 가 폴백한다
  openPopup(
    typeof text === 'string' && text.length > 0 && text.length <= POPUP_TEXT_MAX ? text : null,
    typeof icon === 'string' && /^[a-z-]{1,16}$/.test(icon) ? icon : null,
  );
});

ipcMain.on('ms-timer:state', (_e, state) => {
  if (!TIMER_STATES.has(state)) return; // whitelist 밖은 무시
  lastTimerState = state;
  if (petWin !== null && !petWin.isDestroyed()) {
    petWin.webContents.send('pet:timer-state', state);
  }
});

ipcMain.on('ms-timer:set-pet', (_e, visible) => {
  if (visible === true) createPet();
  else if (visible === false) destroyPet();
});

ipcMain.on('pet:restore-position', (_e, pos) => {
  if (petWin === null || petWin.isDestroyed()) return;
  const rounded = validPetPos(pos) ? { x: Math.round(pos.x), y: Math.round(pos.y) } : null;
  const applied = (rounded !== null && clampRestoredPosition(rounded)) || petDefaultPosition();
  petWin.setPosition(applied.x, applied.y);
  petWin.webContents.send('pet:position', applied); // 드래그 기준점 echo — spec §4
  petWin.showInactive();
  // showInactive 직후 topmost 가 안 먹는 케이스(비활성 표시 + 무포커스 창) 방어
  petWin.setAlwaysOnTop(true, 'screen-saver');
});

ipcMain.on('pet:set-position', (_e, pos) => {
  if (petWin === null || petWin.isDestroyed()) return;
  if (!validPetPos(pos)) return;
  // 드래그 중 clamp 없음 — 가장자리 걸침은 의도된 자유 (spec §7)
  petWin.setPosition(Math.round(pos.x), Math.round(pos.y));
});

ipcMain.on('pet:set-click-through', (_e, enabled) => {
  if (petWin === null || petWin.isDestroyed()) return;
  petWin.setIgnoreMouseEvents(enabled === true, { forward: true });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

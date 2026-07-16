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

function openPopup() {
  // replace-not-stack: 재발화(시계 역행 등) 시 겹겹이 쌓지 않는다
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

  w.loadFile(path.join(import.meta.dirname, 'renderer/popup.html'));
}

ipcMain.on('ms-timer:expired', () => {
  raiseMain();
  openPopup();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

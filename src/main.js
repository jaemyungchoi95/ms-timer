import { app, BrowserWindow } from 'electron';
import path from 'node:path';

function createWindow() {
  const win = new BrowserWindow({
    width: 720,
    height: 320,
    minWidth: 420,
    minHeight: 200,
    title: '퇴근까지',
    // themes.css 다크 테마의 --bg와 동일한 값 — 렌더러가 그리기 전 흰 화면 방지용.
    // 메인 프로세스는 렌더러 CSS를 읽을 수 없어 하드코딩 — --bg 변경 시 함께 수정할 것.
    backgroundColor: '#0b0d10',
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.removeMenu();
  win.loadFile(path.join(import.meta.dirname, 'renderer/index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

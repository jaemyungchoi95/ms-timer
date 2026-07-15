import { app, BrowserWindow } from 'electron';
import path from 'node:path';

function createWindow() {
  const win = new BrowserWindow({
    width: 720,
    height: 320,
    minWidth: 420,
    minHeight: 200,
    title: '퇴근까지',
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

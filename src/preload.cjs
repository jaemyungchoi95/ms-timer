// 이 파일만 CJS 다. Electron 43 에서 preload 는 sandbox 기본 활성이고
// sandboxed preload 는 ESM 을 로드할 수 없다. sandbox:false 로 돌리면
// ESM 은 되지만 Chromium OS sandbox 를 스타일 때문에 버리는 셈이다.
const { contextBridge, ipcRenderer } = require('electron');

// 단방향 채널 1개, 페이로드 0. 메시지의 존재가 신호의 전부다.
// 역방향(main→renderer)은 없다 — 보낼 것이 없고, contextBridge 의
// 주요 footgun 은 전부 역방향 리스너에 산다.
contextBridge.exposeInMainWorld('msTimer', {
  alertExpired: () => ipcRenderer.send('ms-timer:expired'),
});

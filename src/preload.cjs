// 이 파일만 CJS 다. Electron 43 에서 preload 는 sandbox 기본 활성이고
// sandboxed preload 는 ESM 을 로드할 수 없다. sandbox:false 로 돌리면
// ESM 은 되지만 Chromium OS sandbox 를 스타일 때문에 버리는 셈이다.
const { contextBridge, ipcRenderer } = require('electron');

// 타이머 창 브리지는 단방향(renderer→main) send 만 노출한다 — 역방향 리스너는
// pet-preload.cjs 에만 있고, 거기서 event 은닉·payload 원시형 강제로 방어한다.
contextBridge.exposeInMainWorld('msTimer', {
  // text = 팝업 문구 (renderer 가 결정) — String() 강제는 pet-preload 의 원시형 방어 관용.
  alertExpired: (text) => ipcRenderer.send('ms-timer:expired', String(text)),
  // 레벨 채널 — 에지가 아니라 현재 상태. 변경 시에만 clock.js 가 호출한다.
  sendTimerState: (state) => ipcRenderer.send('ms-timer:state', String(state)),
  setPetVisible: (visible) => ipcRenderer.send('ms-timer:set-pet', Boolean(visible)),
});

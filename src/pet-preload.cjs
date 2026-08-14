// preload.cjs 와 같은 이유로 CJS (sandboxed preload 는 ESM 불가).
// 이 파일은 main→renderer 역방향 리스너를 가진 유일한 preload 다.
// footgun 방어: 콜백에 ipc event 객체를 절대 넘기지 않고 payload 를 원시형으로 강제한다.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petBridge', {
  // 부팅 시 1회 — null 이면 main 이 기본 위치(우하단) 사용. 이 메시지가 창 표시 게이트다.
  restorePosition: (pos) => ipcRenderer.send('pet:restore-position', pos),
  setPosition: (pos) => ipcRenderer.send('pet:set-position', pos),
  setClickThrough: (enabled) => ipcRenderer.send('pet:set-click-through', Boolean(enabled)),
  onTimerState: (cb) => ipcRenderer.on('pet:timer-state', (_e, state) => cb(String(state))),
  onPosition: (cb) => ipcRenderer.on('pet:position', (_e, pos) => cb({ x: Number(pos.x), y: Number(pos.y) })),
});

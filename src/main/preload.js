const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  setInteractive: (value) => ipcRenderer.send('ui:set-interactive', !!value),
  startDrag: () => ipcRenderer.send('window:drag-start'),
  endDrag: () => ipcRenderer.send('window:drag-end'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  focusWindow: (options = {}) => ipcRenderer.send('app:focus', options),
  panelClosed: () => ipcRenderer.send('app:panel-closed'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('app:set-always-on-top', !!value),
  setLaunchAtStartup: (value) => ipcRenderer.invoke('app:set-launch-at-startup', !!value),
  hide: () => ipcRenderer.send('app:hide'),
  quit: () => ipcRenderer.send('app:quit'),
  notify: (payload) => ipcRenderer.invoke('notify:show', payload),
  saveScreenshot: (payload) => ipcRenderer.invoke('screenshot:save', payload),
  aiChat: (payload) => ipcRenderer.invoke('ai:chat', payload),
  getWeather: (payload) => ipcRenderer.invoke('weather:get', payload),
  onAppAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('app:action', listener);
    return () => ipcRenderer.removeListener('app:action', listener);
  },
  onSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('app:settings-changed', listener);
    return () => ipcRenderer.removeListener('app:settings-changed', listener);
  },
  isTest: process.env.XIAOSHEN_TEST === '1',
  platform: process.platform
});

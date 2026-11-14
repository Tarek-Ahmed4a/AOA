const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('anatomyDesktop', {
  isElectron: true,
  platform: process.platform,
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
});

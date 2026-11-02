const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dawithDesktop', {
  checkForUpdates: () => ipcRenderer.invoke('dawith:update-check'),
  downloadUpdate: () => ipcRenderer.invoke('dawith:update-download'),
  installUpdate: () => ipcRenderer.invoke('dawith:update-install'),
  onUpdateStatus: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('dawith:update-status', listener);
    return () => ipcRenderer.removeListener('dawith:update-status', listener);
  },
});

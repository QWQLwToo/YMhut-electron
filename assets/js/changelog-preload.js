const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadChangelog: () => ipcRenderer.invoke('load-changelog')
});
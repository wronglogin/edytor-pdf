// Most między edytorem (strona) a komputerem: pliki, czcionki, aktualizacje.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('native', {
  platform: process.platform,
  readFile: p => ipcRenderer.invoke('read-file', p),
  writeFile: (p, bytes) => ipcRenderer.invoke('write-file', p, bytes),
  saveDialog: name => ipcRenderer.invoke('save-dialog', name),
  openDialog: () => ipcRenderer.invoke('open-dialog'),
  pathFor: file => { try { return webUtils.getPathForFile(file) || null; } catch (e) { return null; } },
  findFont: want => ipcRenderer.invoke('find-font', want),
  fontStatus: () => ipcRenderer.invoke('font-status'),
  setDoc: name => ipcRenderer.send('set-doc', name),
  relaunch: () => ipcRenderer.send('relaunch'),
  on: (ch, cb) => {
    if (!['open-path', 'menu', 'editor-updated', 'app-updated', 'app-available'].includes(ch)) return;
    ipcRenderer.on(ch, (e, ...a) => cb(...a));
  }
});

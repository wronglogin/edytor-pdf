// Most między edytorem (strona) a komputerem: pliki, czcionki, aktualizacje.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('native', {
  platform: process.platform,
  frameless: process.platform === 'win32' || process.platform === 'darwin',
  appVersion: (() => { try { return ipcRenderer.sendSync('app-version'); } catch (e) { return ''; } })(),
  appAction: what => ipcRenderer.send('app-action', what),
  readFile: p => ipcRenderer.invoke('read-file', p),
  writeFile: (p, bytes) => ipcRenderer.invoke('write-file', p, bytes),
  saveDialog: name => ipcRenderer.invoke('save-dialog', name),
  openDialog: () => ipcRenderer.invoke('open-dialog'),
  pathFor: file => { try { return webUtils.getPathForFile(file) || null; } catch (e) { return null; } },
  findFont: want => ipcRenderer.invoke('find-font', want),
  fontStatus: () => ipcRenderer.invoke('font-status'),
  setDoc: name => ipcRenderer.send('set-doc', name),
  relaunch: () => ipcRenderer.send('relaunch'),
  getPassword: p => ipcRenderer.invoke('pw-get', p),
  setPassword: (p, pw) => ipcRenderer.send('pw-set', p, pw),
  openTemp: (name, bytes) => ipcRenderer.invoke('open-temp', name, bytes),
  recent: () => ipcRenderer.invoke('recent'),
  clearRecent: () => ipcRenderer.invoke('recent-clear'),
  addRecent: p => ipcRenderer.send('recent-add', p),
  on: (ch, cb) => {
    if (!['open-path', 'menu', 'editor-updated', 'app-updated', 'app-available', 'recent-changed', 'fullscreen'].includes(ch)) return;
    ipcRenderer.on(ch, (e, ...a) => cb(...a));
  }
});

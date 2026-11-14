// Edytor PDF – aplikacja na Windows i macOS (Electron)
// Edytor to ta sama strona co na GitHub Pages, spakowana do aplikacji. Nowe wersje edytora
// pobierają się same w tle; nowe wersje samej aplikacji – na Windowsie instalują się same.
const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { scan } = require('./fontnames');

const SITE = 'https://wronglogin.github.io/edytor-pdf/';
const RELEASES = 'https://github.com/wronglogin/edytor-pdf/releases/latest';
const BUNDLE = path.join(__dirname, 'app');
const USER = () => app.getPath('userData');
const WEB = () => path.join(USER(), 'web');      // nowsza wersja edytora pobrana z sieci
const EXTRA = () => path.join(USER(), 'extra');  // pliki dociągnięte z sieci (np. nowe czcionki)
const UPDATED_FILES = ['edytor-pdf.html', 'spell-worker.js', 'lib/nspell.js'];

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

/* ---------- wersje edytora: spakowana vs pobrana ---------- */
const verOf = html => { const m = /Edytor PDF · wersja (\d+)/.exec(html || ''); return m ? +m[1] : 0; };
const readText = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } };
let useWeb = false, webVer = 0, bundleVer = 0;
function pickVersion() {
  bundleVer = verOf(readText(path.join(BUNDLE, 'edytor-pdf.html')));
  webVer = verOf(readText(path.join(WEB(), 'edytor-pdf.html')));
  useWeb = webVer > bundleVer && UPDATED_FILES.every(f => fs.existsSync(path.join(WEB(), f)));
}
const exists = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };

// biblioteki z CDN → lokalne kopie z instalatora (działa bez internetu)
function rewriteCdn(html) {
  const loc = rel => (exists(path.join(BUNDLE, rel)) ? rel : null);
  return html
    .replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/([^/]+)\/([\d.]+)\/([\w.-]+)/g, (m, n, v, f) => loc(`vendor/cdnjs/${n}/${v}/${f}`) || m)
    .replace(/https:\/\/unpkg\.com\/((?:@[\w-]+\/)?[\w.-]+@[\d.]+)\/dist\/([\w.-]+)/g, (m, p, f) => loc(`vendor/unpkg/${p}/${f}`) || m);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.css': 'text/css', '.aff': 'text/plain', '.dic': 'text/plain', '.txt': 'text/plain', '.wasm': 'application/wasm' };
function serveFile(file, rel) {
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  if (rel === 'edytor-pdf.html') return new Response(rewriteCdn(fs.readFileSync(file, 'utf8')), { headers: { 'content-type': type } });
  return new Response(fs.readFileSync(file), { headers: { 'content-type': type } });
}
async function handleApp(req) {
  const u = new URL(req.url);
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'edytor-pdf.html';
  if (rel === 'index.html') rel = 'edytor-pdf.html';
  if (rel.split('/').includes('..')) return new Response('', { status: 403 });
  const cands = [];
  if (useWeb) cands.push(path.join(WEB(), rel));
  cands.push(path.join(BUNDLE, rel), path.join(EXTRA(), rel));
  for (const c of cands) if (exists(c)) return serveFile(c, rel);
  // brak w instalatorze (np. czcionka dodana później) → z GitHub Pages, z zapamiętaniem
  try {
    const r = await net.fetch(SITE + rel);
    if (!r.ok) return new Response('', { status: 404 });
    const buf = Buffer.from(await r.arrayBuffer()), dst = path.join(EXTRA(), rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, buf);
    return serveFile(dst, rel);
  } catch (e) { return new Response('', { status: 404 }); }
}

/* ---------- aktualizacja edytora w tle ---------- */
async function updateEditor() {
  try {
    const get = async f => { const r = await net.fetch(SITE + f + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error(f + ' ' + r.status); return Buffer.from(await r.arrayBuffer()); };
    const html = await get('edytor-pdf.html'), v = verOf(html.toString('utf8'));
    if (!v || v <= Math.max(bundleVer, webVer)) return;
    const files = { 'edytor-pdf.html': html };
    for (const f of UPDATED_FILES.slice(1)) files[f] = await get(f);
    const tmp = WEB() + '.tmp';
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const [f, b] of Object.entries(files)) { const p = path.join(tmp, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, b); }
    fs.rmSync(WEB(), { recursive: true, force: true }); fs.renameSync(tmp, WEB());
    webVer = v;
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('editor-updated', v);
  } catch (e) { console.warn('Aktualizacja edytora:', e.message); }
}

/* ---------- aktualizacja samej aplikacji ---------- */
function updateApp() {
  if (!app.isPackaged) return;
  if (process.platform === 'win32') {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on('update-downloaded', i => { for (const w of BrowserWindow.getAllWindows()) w.webContents.send('app-updated', i.version); });
      autoUpdater.checkForUpdates().catch(() => {});
    } catch (e) {}
    return;
  }
  // macOS bez podpisu Apple nie może się sam podmienić – informujemy o nowej wersji
  net.fetch('https://api.github.com/repos/wronglogin/edytor-pdf/releases/latest', { headers: { 'User-Agent': 'edytor-pdf' } })
    .then(r => r.json()).then(j => {
      const v = (j.tag_name || '').replace(/^v/, ''), cur = app.getVersion();
      const n = s => s.split('.').map(Number), a = n(v), b = n(cur);
      const newer = a.length === 3 && (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) > 0;
      if (newer) for (const w of BrowserWindow.getAllWindows()) w.webContents.send('app-available', v);
    }).catch(() => {});
}

/* ---------- czcionki z komputera: system, Word/Office, Acrobat ---------- */
function fontDirs() {
  const H = os.homedir(), L = [];
  if (process.platform === 'darwin') {
    L.push('/System/Library/Fonts', '/Library/Fonts', path.join(H, 'Library/Fonts'),
      path.join(H, 'Library/Group Containers/UBF8T346G9.Office/FontCache'));
    for (const a of ['Microsoft Word', 'Microsoft Excel', 'Microsoft PowerPoint', 'Microsoft Outlook'])
      L.push(`/Applications/${a}.app/Contents/Resources/DFonts`);
    L.push('/Applications/Adobe Acrobat DC/Adobe Acrobat.app/Contents/Resources/Resource/Font',
      '/Applications/Adobe Acrobat Reader.app/Contents/Resources/Resource/Font',
      '/Applications/Adobe Acrobat Reader DC.app/Contents/Resources/Resource/Font');
  } else if (process.platform === 'win32') {
    const W = process.env.WINDIR || 'C:\\Windows', LA = process.env.LOCALAPPDATA || path.join(H, 'AppData\\Local');
    const PF = [process.env.ProgramFiles || 'C:\\Program Files', process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'];
    L.push(path.join(W, 'Fonts'), path.join(LA, 'Microsoft\\Windows\\Fonts'), path.join(LA, 'Microsoft\\FontCache\\4\\CloudFonts'));
    for (const pf of PF) L.push(path.join(pf, 'Adobe\\Acrobat DC\\Resource\\Font'), path.join(pf, 'Adobe\\Acrobat Reader DC\\Reader\\Resource\\Font'),
      path.join(pf, 'Adobe\\Acrobat Reader\\Reader\\Resource\\Font'), path.join(pf, 'Microsoft Office\\root\\vfs\\Fonts\\private'));
  } else L.push('/usr/share/fonts', '/usr/local/share/fonts', path.join(H, '.fonts'), path.join(H, '.local/share/fonts'));
  return L.filter(d => fs.existsSync(d)).map(d => ({ dir: d, anyExt: /CloudFonts|FontCache/i.test(d) }));
}
let fontIndex = null, fontScan = null;
function loadFontIndex() {
  if (fontScan) return fontScan;
  const cache = path.join(USER(), 'font-index.json');
  try { const c = JSON.parse(fs.readFileSync(cache, 'utf8')); if (Array.isArray(c.index)) fontIndex = c.index; } catch (e) {}
  fontScan = scan(fontDirs()).then(idx => {
    fontIndex = idx;
    try { fs.writeFileSync(cache, JSON.stringify({ when: Date.now(), index: idx })); } catch (e) {}
    return idx;
  });
  return fontIndex ? Promise.resolve(fontIndex) : fontScan;
}
const normFont = n => (n || '').replace(/^[A-Z]{6}\+/, '').toLowerCase().replace(/[\s_\-,]/g, '').replace(/mt$/, '');
ipcMain.handle('find-font', async (e, want) => {
  const W = new Set(want || []);
  let idx = await loadFontIndex();
  let f = idx.find(x => W.has(normFont(x.ps))) || idx.find(x => W.has(normFont(x.full)));
  if (!f && idx !== (await fontScan)) { idx = await fontScan; f = idx.find(x => W.has(normFont(x.ps))) || idx.find(x => W.has(normFont(x.full))); }
  if (!f) return null;
  try { return { data: fs.readFileSync(f.file), label: f.full, file: f.file }; } catch (err) { return null; }
});
ipcMain.handle('font-status', async () => { const idx = await loadFontIndex(); return { count: idx.length, dirs: fontDirs().map(d => d.dir) }; });

/* ---------- ostatnio otwierane ---------- */
const RECENT = () => path.join(USER(), 'recent.json');
function recentList() { try { return JSON.parse(fs.readFileSync(RECENT(), 'utf8')).filter(r => exists(r.path)); } catch (e) { return []; } }
function addRecent(p) {
  const L = [{ path: p, name: path.basename(p), when: Date.now() }, ...recentList().filter(r => r.path !== p)].slice(0, 15);
  try { fs.writeFileSync(RECENT(), JSON.stringify(L)); } catch (e) {}
  try { app.addRecentDocument(p); } catch (e) {}
  buildMenu();
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('recent-changed');
}
ipcMain.handle('recent', () => recentList());
ipcMain.handle('recent-clear', () => { try { fs.writeFileSync(RECENT(), '[]'); } catch (e) {} try { app.clearRecentDocuments(); } catch (e) {} buildMenu(); return true; });
ipcMain.on('recent-add', (e, p) => { if (p && exists(p)) addRecent(p); });

/* ---------- pliki: otwieranie i zapis do tego samego pliku ---------- */
ipcMain.handle('read-file', async (e, p) => { const data = fs.readFileSync(p); addRecent(p); return { path: p, name: path.basename(p), data }; });
ipcMain.handle('write-file', async (e, p, bytes) => { fs.writeFileSync(p, Buffer.from(bytes)); addRecent(p); return true; });
ipcMain.handle('save-dialog', async (e, name) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(w, { defaultPath: name, filters: [{ name: 'Dokument PDF', extensions: ['pdf'] }] });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('open-dialog', async e => {
  const w = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(w, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Dokument PDF', extensions: ['pdf'] }] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.on('set-doc', (e, name) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.hasDoc = !!name; });
let quitting = false;
app.on('before-quit', () => { quitting = true; });
ipcMain.on('relaunch', () => { app.relaunch(); app.quit(); });

const pdfArgs = argv => argv.slice(1).filter(a => /\.pdf$/i.test(a) && exists(a));
let pending = pdfArgs(process.argv);
app.on('open-file', (e, p) => { e.preventDefault(); if (app.isReady()) openPaths([p]); else pending.push(p); }); // macOS
app.on('second-instance', (e, argv) => {
  const ps = pdfArgs(argv);
  if (ps.length) openPaths(ps);
  else { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } }
});
function openPaths(ps) {
  for (const p of ps) {
    const free = BrowserWindow.getAllWindows().find(w => !w.hasDoc);
    const w = free || createWindow();
    w.hasDoc = true;
    const send = () => w.webContents.send('open-path', p);
    if (w.webContents.isLoading() || !w.ready) w.once('app-ready', send); else send();
    w.show(); w.focus();
  }
}

/* ---------- okno ---------- */
function createWindow() {
  const w = new BrowserWindow({
    width: 1400, height: 950, minWidth: 900, minHeight: 600, show: false, title: 'Edytor PDF',
    icon: path.join(BUNDLE, 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  w.webContents.on('did-finish-load', () => { w.ready = true; w.emit('app-ready'); });
  w.once('ready-to-show', () => w.show());
  w.loadURL('app://edytor/edytor-pdf.html');
  // linki (pobieranie czcionek, GitHub) – w zwykłej przeglądarce
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url); } });
  // niezapisane zmiany przy zamykaniu: Zapisz / Nie zapisuj / Anuluj
  w.on('close', async e => {
    if (w.forceClose) return;
    e.preventDefault();
    if (w.asking) return;
    let st = { dirty: false, name: '' };
    try { st = await w.webContents.executeJavaScript('({ dirty: !!(typeof isDirty === "function" && isDirty()), name: typeof S !== "undefined" ? S.name : "" })'); } catch (err) {}
    if (st.dirty) {
      w.asking = true; w.show(); w.focus();
      const r = await dialog.showMessageBox(w, { type: 'warning', buttons: ['Zapisz', 'Zapisz jako…', 'Nie zapisuj', 'Anuluj'], defaultId: 0, cancelId: 3, noLink: true,
        title: 'Edytor PDF', message: 'Zapisać zmiany w pliku „' + (st.name || 'dokument') + '”?', detail: 'Jeśli nie zapiszesz, wprowadzone zmiany zostaną utracone.' });
      w.asking = false;
      if (r.response === 3) { quitting = false; return; }
      if (r.response === 0 || r.response === 1) {
        let ok = false;
        try { ok = await w.webContents.executeJavaScript('exportPdf(' + (r.response === 1 ? '"saveas"' : '') + ').then(() => !isDirty())'); } catch (err) {}
        if (!ok) { quitting = false; return; } // anulowano zapis albo błąd – okno zostaje
      }
    }
    w.forceClose = true; w.destroy();
    if (quitting) setImmediate(() => app.quit());
  });
  w.webContents.on('will-prevent-unload', e => {
    const c = dialog.showMessageBoxSync(w, { type: 'question', buttons: ['Zamknij bez zapisywania', 'Anuluj'], defaultId: 1, cancelId: 1,
      title: 'Edytor PDF', message: 'Masz niezapisane zmiany.', detail: 'Zamknąć dokument bez zapisywania?' });
    if (c === 0) e.preventDefault();
  });
  return w;
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const send = ch => () => { const w = BrowserWindow.getFocusedWindow(); if (w) w.webContents.send('menu', ch); };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: 'Plik', submenu: [
      { label: 'Nowe okno', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
      { label: 'Otwórz…', accelerator: 'CmdOrCtrl+O', click: send('open') },
      { label: 'Otwórz ostatnie', submenu: (() => {
        const L = recentList();
        if (!L.length) return [{ label: 'Brak ostatnio otwieranych plików', enabled: false }];
        return [...L.slice(0, 12).map(r => ({ label: r.name, sublabel: r.path, click: () => openPaths([r.path]) })), { type: 'separator' },
          { label: 'Wyczyść listę', click: () => { try { fs.writeFileSync(RECENT(), '[]'); } catch (e) {} try { app.clearRecentDocuments(); } catch (e) {} buildMenu(); for (const w of BrowserWindow.getAllWindows()) w.webContents.send('recent-changed'); } }];
      })() },
      { type: 'separator' },
      { label: 'Zapisz', accelerator: 'CmdOrCtrl+S', click: send('save') },
      { label: 'Zapisz jako…', accelerator: 'CmdOrCtrl+Shift+S', click: send('saveas') },
      { label: 'Drukuj…', accelerator: 'CmdOrCtrl+P', click: send('print') },
      { type: 'separator' },
      mac ? { role: 'close', label: 'Zamknij okno' } : { role: 'quit', label: 'Zakończ' }
    ] },
    { label: 'Edycja', submenu: [{ role: 'undo', label: 'Cofnij' }, { role: 'redo', label: 'Ponów' }, { type: 'separator' }, { role: 'cut', label: 'Wytnij' }, { role: 'copy', label: 'Kopiuj' }, { role: 'paste', label: 'Wklej' }, { role: 'selectAll', label: 'Zaznacz wszystko' }] },
    { label: 'Widok', submenu: [{ role: 'reload', label: 'Odśwież' }, { role: 'togglefullscreen', label: 'Pełny ekran' }, { role: 'toggleDevTools', label: 'Narzędzia dewelopera' }] },
    { label: 'Pomoc', submenu: [
      { label: 'Pomoc edytora', accelerator: 'F1', click: send('help') },
      { label: 'Pobierz najnowszą wersję aplikacji', click: () => shell.openExternal(RELEASES) },
      { label: 'Wersja aplikacji ' + app.getVersion(), enabled: false }
    ] }
  ]));
}

app.whenReady().then(() => {
  pickVersion();
  protocol.handle('app', handleApp);
  buildMenu();
  const first = createWindow();
  if (pending.length) { openPaths(pending); pending = []; } else first.hasDoc = false;
  loadFontIndex();
  setTimeout(updateEditor, 3000);
  setTimeout(updateApp, 8000);
  setInterval(updateEditor, 6 * 3600 * 1000);
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

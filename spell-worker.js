// Sprawdzanie pisowni w tle (nspell + słownik polski z projektu OpenOffice/LibreOffice, sjp.pl)
importScripts('lib/nspell.js');
let sp = null;
const ready = Promise.all(['dict/pl.aff', 'dict/pl.dic'].map(u => fetch(u).then(r => { if (!r.ok) throw new Error('brak ' + u); return r.text(); })))
  .then(([aff, dic]) => { sp = NSpell(aff, dic); });
self.onmessage = async e => {
  const { id, type, words, word, list } = e.data;
  try { await ready; } catch (err) { self.postMessage({ id, error: String(err) }); return; }
  if (type === 'personal') { for (const w of list) sp.add(w); self.postMessage({ id, ok: true }); }
  else if (type === 'check') self.postMessage({ id, bad: words.filter(w => !sp.correct(w)) });
  else if (type === 'suggest') self.postMessage({ id, sug: sp.suggest(word).slice(0, 6) });
};

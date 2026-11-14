// Nazwy czcionek (tabela „name”) czytane z dysku – bez wczytywania całych plików.
const fs = require('fs');
const path = require('path');

function readAt(fd, pos, len) {
  const b = Buffer.alloc(len);
  const n = fs.readSync(fd, b, 0, len, pos);
  return n === len ? b : b.subarray(0, n);
}
function namesOf(file) {
  const out = [];
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const h = readAt(fd, 0, 12);
    if (h.length < 12) return out;
    const tag = h.readUInt32BE(0);
    let offs = [0];
    if (tag === 0x74746366) { // ttcf
      const n = Math.min(h.readUInt32BE(8), 64), d = readAt(fd, 12, 4 * n);
      offs = [...Array(n)].map((_, i) => d.readUInt32BE(i * 4));
    } else if (![0x00010000, 0x4f54544f, 0x74727565].includes(tag)) return out; // nie czcionka
    for (let fi = 0; fi < offs.length; fi++) {
      const o = offs[fi], nt = readAt(fd, o, 12).readUInt16BE(4), dir = readAt(fd, o + 12, 16 * nt);
      let no = -1, nl = 0;
      for (let t = 0; t < nt; t++) if (dir.readUInt32BE(t * 16) === 0x6e616d65) { no = dir.readUInt32BE(t * 16 + 8); nl = dir.readUInt32BE(t * 16 + 12); }
      if (no < 0 || nl > 2e6) continue;
      const nb = readAt(fd, no, nl), cnt = nb.readUInt16BE(2), so = nb.readUInt16BE(4), names = {}, prio = {};
      for (let r = 0; r < cnt; r++) {
        const b = 6 + r * 12; if (b + 12 > nb.length) break;
        const pid = nb.readUInt16BE(b), lid = nb.readUInt16BE(b + 4), id = nb.readUInt16BE(b + 6), len = nb.readUInt16BE(b + 8), off = nb.readUInt16BE(b + 10);
        if (id !== 4 && id !== 6) continue;
        const st = so + off; if (st + len > nb.length) continue;
        let s = '', p;
        if (pid === 3 || pid === 0) { for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(nb.readUInt16BE(st + k)); p = pid === 3 && lid === 0x409 ? 3 : 2; }
        else if (pid === 1) { for (let k = 0; k < len; k++) s += String.fromCharCode(nb[st + k]); p = 1; }
        else continue;
        if (!(prio[id] >= p)) { names[id] = s; prio[id] = p; }
      }
      if (names[6] || names[4]) out.push({ ps: names[6] || names[4], full: names[4] || names[6] });
    }
  } catch (e) { /* uszkodzony plik – pomijamy */ }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch (e) {} }
  return out;
}

const FONT_EXT = /\.(ttf|otf|ttc)$/i;
async function scan(dirs) {
  const index = [];
  const walk = async (dir, depth, anyExt) => {
    let ents;
    try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth < 6) await walk(p, depth + 1, anyExt); }
      else if (FONT_EXT.test(e.name) || (anyExt && !/\.[a-z0-9]{2,4}$/i.test(e.name))) {
        for (const n of namesOf(p)) index.push({ ...n, file: p });
      }
    }
  };
  for (const d of dirs) await walk(d.dir, 0, !!d.anyExt);
  return index;
}
module.exports = { namesOf, scan };

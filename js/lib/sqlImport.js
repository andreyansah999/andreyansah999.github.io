/**
 * sqlImport.js
 * Parser ringan untuk file dump SQL (mis. hasil export phpMyAdmin/mysqldump) — dijalankan
 * di browser (client-side), tidak ada data yang dikirim ke pihak lain selain nanti ke
 * Apps Script kita sendiri saat proses impor sungguhan.
 *
 * Mendukung: banyak statement `INSERT INTO tabel (kol1, kol2, ...) VALUES (...), (...);`
 * per file, string berkutip ' atau ", escape backslash & petik ganda ('' -> '), NULL,
 * angka, dan komentar SQL (--, #, /* * /).
 *
 * TIDAK mendukung (di luar cakupan dump data biasa): ekspresi/fungsi SQL di dalam VALUES
 * (mis. NOW()), sub-select, atau nilai biner mentah (x'...').
 */

function stripSqlComments(text) {
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  text = text.replace(/^[ \t]*--.*$/gm, '');
  text = text.replace(/^[ \t]*#.*$/gm, '');
  return text;
}

function parseValue(text, i) {
  const n = text.length;
  const ch = text[i];
  if (ch === "'" || ch === '"') {
    const quote = ch;
    let j = i + 1;
    let out = '';
    while (j < n) {
      const c = text[j];
      if (c === '\\' && j + 1 < n) {
        const map = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', "'": "'", '"': '"' };
        const next = text[j + 1];
        out += (map[next] !== undefined ? map[next] : next);
        j += 2;
        continue;
      }
      if (c === quote) {
        if (text[j + 1] === quote) { out += quote; j += 2; continue; }
        j++;
        break;
      }
      out += c;
      j++;
    }
    return { value: out, nextIndex: j };
  }
  let j = i;
  while (j < n && !/[,)]/.test(text[j])) j++;
  const token = text.slice(i, j).trim();
  if (/^null$/i.test(token)) return { value: null, nextIndex: j };
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(token)) return { value: parseFloat(token), nextIndex: j };
  return { value: token, nextIndex: j };
}

function parseValueTuples(text, startIdx) {
  const rows = [];
  const n = text.length;
  let i = startIdx;
  const skipWs = () => { while (i < n && /\s/.test(text[i])) i++; };

  skipWs();
  while (i < n) {
    skipWs();
    if (text[i] === ';') { i++; break; }
    if (text[i] !== '(') break;
    i++;
    const row = [];
    let guard = 0;
    while (i < n && guard++ < 5000) {
      skipWs();
      const { value, nextIndex } = parseValue(text, i);
      row.push(value);
      i = nextIndex;
      skipWs();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === ')') { i++; break; }
      break;
    }
    rows.push(row);
    skipWs();
    if (text[i] === ',') { i++; continue; }
    if (text[i] === ';') { i++; break; }
    break;
  }
  return { rows, endIndex: i };
}

function splitTopLevel(str, sep) {
  return str.split(sep).map(s => s.trim()).filter(s => s.length);
}

/** @returns {Array<{table:string, columns:string[]|null, rows:Array[]}>} satu entri per tabel (baris digabung bila ada beberapa statement INSERT untuk tabel yang sama) */
export function parseSqlInserts(sqlText) {
  const text = stripSqlComments(sqlText || '');
  const found = [];
  const re = /INSERT\s+(?:IGNORE\s+)?INTO\s+`?([A-Za-z0-9_.]+)`?\s*(\(([^)]*)\))?\s*VALUES\s*/gi;
  let match;
  let iterations = 0;
  while ((match = re.exec(text)) !== null && iterations++ < 20000) {
    const table = match[1];
    const columns = match[3] ? splitTopLevel(match[3], ',').map(c => c.replace(/`/g, '')) : null;
    const { rows, endIndex } = parseValueTuples(text, re.lastIndex);
    found.push({ table, columns, rows });
    re.lastIndex = Math.max(endIndex, re.lastIndex);
  }

  const byTable = new Map();
  for (const item of found) {
    if (!byTable.has(item.table)) byTable.set(item.table, { table: item.table, columns: item.columns, rows: [] });
    const entry = byTable.get(item.table);
    if (!entry.columns && item.columns) entry.columns = item.columns;
    entry.rows.push(...item.rows);
  }
  return Array.from(byTable.values()).filter(t => t.rows.length > 0);
}

/** Susun nama kolom: pakai nama asli kalau ada, else col1..colN berdasar baris terpanjang. */
export function resolveColumns(tableEntry) {
  if (tableEntry.columns && tableEntry.columns.length) return tableEntry.columns;
  const maxLen = tableEntry.rows.reduce((m, r) => Math.max(m, r.length), 0);
  return Array.from({ length: maxLen }, (_, i) => 'col' + (i + 1));
}

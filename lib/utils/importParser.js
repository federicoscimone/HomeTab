import * as XLSX from 'xlsx';

/**
 * Converte lettera colonna (A, B, AA…) o stringa numerica in indice 0-based.
 */
export function colToIndex(col) {
  if (col === undefined || col === null || col === '') return -1;
  const s = col.toString().trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  let n = 0;
  for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Parsa una data in stringa YYYY-MM-DD dal formato indicato nel template.
 */
export function parseDate(value, format = 'DD/MM/YYYY') {
  if (!value && value !== 0) return null;

  // Numero seriale Excel
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${date.y}-${m}-${d}`;
    }
  }

  const s = value.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const dateOnly = s.replace(/\s+\d{2}:\d{2}.*/, '').trim();
  let day, month, year;
  const sep = /[-/.]/.exec(dateOnly)?.[0] || '/';
  const parts = dateOnly.split(sep);
  if (parts.length < 3) return null;

  switch (format) {
    case 'DD/MM/YYYY':
    case 'DD-MM-YYYY':  [day, month, year] = parts; break;
    case 'MM/DD/YYYY':  [month, day, year] = parts; break;
    case 'YYYY-MM-DD':  [year, month, day] = parts; break;
    case 'D/M/YYYY':    [day, month, year] = parts; break;
    default:            [day, month, year] = parts;
  }

  if (!year || !month || !day) return null;
  return `${year.padStart(4,'0')}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
}

/**
 * Parsa un importo gestendo formato italiano (1.234,56) e americano (1,234.56).
 * Restituisce { amount: number (assoluto), negative: boolean }.
 */
export function parseAmountRaw(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return { amount: Math.abs(value), negative: value < 0 };

  let s = value.toString().trim().replace(/\s/g, '');
  if (!s) return null;

  const negative = s.startsWith('-');
  s = s.replace(/^-/, '');

  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }

  const n = parseFloat(s);
  return isNaN(n) ? null : { amount: n, negative };
}

/** Versione semplificata (solo valore assoluto) — usata dove il tipo è già noto. */
export function parseAmount(value) {
  return parseAmountRaw(value)?.amount ?? null;
}

/**
 * Parsa file Excel/CSV (Buffer) usando il template di mappatura.
 */
export function parseExcelBuffer(buffer, template) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  return applyTemplate(rows, template);
}

/**
 * Parsa testo incollato (tab-separated o CSV).
 */
export function parsePasteText(text, template) {
  const delimiter = template.delimiter === '\t' ? '\t' : (template.delimiter || '\t');
  const rows = text
    .split(/\r?\n/)
    .filter(l => l.trim())
    .map(l => l.split(delimiter));
  return applyTemplate(rows, template);
}

/**
 * Applica il template a un array di righe grezzo.
 * Restituisce array di oggetti con campo `type: 'expense' | 'income'`.
 */
function applyTemplate(rows, template) {
  const skip   = parseInt(template.skipRows) || 0;
  const data   = rows.slice(skip);
  const cm     = template.columnMapping || {};
  const fmt    = template.dateFormat || 'DD/MM/YYYY';
  const sign   = template.amountSign || 'absolute';

  const results = [];

  for (const row of data) {
    if (row.every(c => c === '' || c === null || c === undefined)) continue;

    const parsedDate = parseDate(getCell(row, cm.date), fmt);
    if (!parsedDate) continue;

    const base = {
      date:        parsedDate,
      description: getCell(row, cm.description)?.toString().trim() || '',
      payee:       getCell(row, cm.payee)?.toString().trim() || '',
      place:       getCell(row, cm.place)?.toString().trim() || '',
      notes:       getCell(row, cm.notes)?.toString().trim() || '',
    };

    // Caso A: colonne separate dare/avere
    if (template.amountDebit || template.amountCredit) {
      const debit  = parseAmount(getCell(row, template.amountDebit));
      const credit = parseAmount(getCell(row, template.amountCredit));

      if (debit && debit > 0)  results.push({ ...base, amount: debit,  type: 'expense' });
      if (credit && credit > 0) results.push({ ...base, amount: credit, type: 'income' });
      continue;
    }

    // Caso B: colonna singola con gestione segno
    if (cm.amount) {
      const raw = parseAmountRaw(getCell(row, cm.amount));
      if (!raw || raw.amount === 0) continue;

      let type = 'expense';
      if (sign === 'negative_is_income')  type = raw.negative ? 'income' : 'expense';
      if (sign === 'negative_is_expense') type = raw.negative ? 'expense' : 'income';

      results.push({ ...base, amount: raw.amount, type });
    }
  }

  return results;
}

function getCell(row, col) {
  const idx = colToIndex(col);
  if (idx < 0) return '';
  return row[idx] ?? '';
}

// Minimal RFC4180-ish CSV parser/stringifier (handles quotes, commas, CRLF).
// Intended for small admin imports in the browser. Not designed for streaming huge files.

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, ''); // strip UTF-8 BOM if present
  const rows: string[][] = [];

  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = input[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++; // CRLF
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  // Push last field/row (even if file doesn't end with newline).
  row.push(field);
  rows.push(row);

  // Drop trailing completely-empty row (common when file ends with newline).
  const last = rows[rows.length - 1];
  if (last && last.every((c) => c.trim() === '')) rows.pop();

  return rows;
}

export function toCsv(rows: string[][]): string {
  const escapeCell = (cell: string) => {
    const s = cell ?? '';
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}


import path from 'node:path';
import fs from 'node:fs/promises';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { CONVERTED_EXTENSIONS, extOf } from '../shared/types.js';

/**
 * Converts office documents to plain text next to the original so the AI can read them.
 * Returns the relative paths of files it wrote.
 */
export async function convertUpload(absPath: string, relPath: string): Promise<string[]> {
  const ext = extOf(relPath);
  if (!CONVERTED_EXTENSIONS.has(ext)) return [];
  const base = absPath.slice(0, -ext.length);
  const relBase = relPath.slice(0, -ext.length);

  if (ext === '.docx') {
    const { value } = await mammoth.convertToMarkdown({ path: absPath });
    await fs.writeFile(`${base}.md`, value, 'utf8');
    return [`${relBase}.md`];
  }

  // Spreadsheets: one CSV per sheet (CSV is compact and easy for the AI to read).
  const wb = XLSX.read(await fs.readFile(absPath), { type: 'buffer' });
  const written: string[] = [];
  const multi = wb.SheetNames.length > 1;
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    if (!csv.trim()) continue;
    const suffix = multi ? `.${name.replace(/[^\w-]+/g, '_')}` : '';
    await fs.writeFile(`${base}${suffix}.csv`, csv, 'utf8');
    written.push(`${relBase}${suffix}.csv`);
  }
  return written;
}

export function isConvertible(name: string): boolean {
  return CONVERTED_EXTENSIONS.has(extOf(path.basename(name)));
}

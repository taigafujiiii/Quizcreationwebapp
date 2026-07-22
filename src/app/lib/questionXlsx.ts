// questionXlsx.ts — 4択問題 xlsx インポート/エクスポート機能(要件①)の「フォーマットの単一の真実」。
//
// このファイルは DESIGN.md「要件① 1. 実装順序とフォーマットの正」に定めた
// single source of truth であり、X02(エクスポートUI)/X03(インポートRPC)/X04(インポートUI)が
// すべてこの列定義・変換・バリデーションを参照する。UI・DBには一切触れない(純ロジック + 依存追加のみ)。
//
// SheetJS(xlsx)は **動的 import のみ**(メインバンドルに載せない)。純関数は SheetJS 非依存で、
// Playwright ランナーの Node 実行(ブラウザ不要)でそのまま検証できる。
//
// 裁定(docs/REVIEW_NOTES.md)対応:
//   A1: 名前解決は本ファイル内(questionsToAoa)。解決不能時は '不明' フォールバック(下記備考)。
//   A2: 合成関数 parseQuestionsXlsx(data: ArrayBuffer) を公開。エラー型は RowError{row,column,reason}。
//   A4: ParsedQuestionRow.id は string(空文字=新規)。
//   A5: 正解の昇順正規化はエクスポート・インポート両方で normalizeCorrectAnswer を通す(本ファイルに集約)。
//   A9: 回答方式の空欄は行エラー(checkbox 既定化はしない)。
//
// 備考(A1 の '不明' リスク): FK 制約により通常 categoryId は必ず解決できるため '不明' は発生しない。
// 万一 '不明' 名のまま xlsx を再インポートすると、その名前のカテゴリ/単元が X03 で自動作成される
// リスクがある(名前解決不能=データ不整合の兆候)。エクスポートは防御的に '不明' を出すのみで、
// 取り込み時の扱いは X03/X04 の責務。

import type { AnswerMethod, Category, Question, Unit } from '../types';

// ---------------------------------------------------------------------------
// 2. 列定義(単一の真実)— DESIGN「要件① 2. xlsx 列フォーマット」の 12 列
//    この順序・見出しがエクスポート出力の正。
// ---------------------------------------------------------------------------

export type QuestionColumnKey =
  | 'id' | 'unit' | 'category' | 'text'
  | 'optionA' | 'optionB' | 'optionC' | 'optionD'
  | 'correctAnswer' | 'answerMethod' | 'explanation' | 'isActive';

export interface QuestionColumnDef {
  key: QuestionColumnKey;
  header: string;    // xlsx 上の日本語見出し(エクスポートで出力)
  required: boolean; // インポート時の必須(空セルを行エラーにするか)
}

export const QUESTION_COLUMNS: readonly QuestionColumnDef[] = [
  { key: 'id',            header: 'ID',       required: false },
  { key: 'unit',          header: '単元',      required: true  },
  { key: 'category',      header: 'カテゴリ',  required: true  },
  { key: 'text',          header: '問題文',    required: true  },
  { key: 'optionA',       header: '選択肢A',   required: true  },
  { key: 'optionB',       header: '選択肢B',   required: true  },
  { key: 'optionC',       header: '選択肢C',   required: true  },
  { key: 'optionD',       header: '選択肢D',   required: true  },
  { key: 'correctAnswer', header: '正解',      required: true  },
  { key: 'answerMethod',  header: '回答方式',  required: true  },
  { key: 'explanation',   header: '解説',      required: false },
  { key: 'isActive',      header: '公開',      required: false },
] as const;

export const QUESTION_HEADERS: string[] = QUESTION_COLUMNS.map((c) => c.header);

// ---------------------------------------------------------------------------
// 3. 値正規化(純関数・行番号非依存)
//    既存 CSV パーサ(AssignmentsManagement)のロジックを copy-adapt。
//    エラーは理由文字列のみ返し、行番号・列名の付与はパーサ(parseAoaToRows)側で行う。
// ---------------------------------------------------------------------------

export type Norm<T> = { ok: true; value: T } | { ok: false; reason: string };

const VALID_CHOICES = new Set(['A', 'B', 'C', 'D']);

// 回答方式: 'radio'/'checkbox'(英語) + 'ラジオ'/'チェックボックス'(日本語)を受理。
// 空欄・不正値はエラー(裁定A9: 既存CSVの「空欄=checkbox既定」は踏襲しない)。
export function parseAnswerMethod(raw: string | undefined): Norm<AnswerMethod> {
  const v = (raw ?? '').trim();
  if (!v) return { ok: false, reason: '回答方式は必須です' };

  const normalized = v.toLowerCase().replace(/\s+/g, '').replace(/[_-]/g, '');
  const radio = new Set(['radio', 'radiobutton', 'ラジオ']);
  const checkbox = new Set(['checkbox', 'check', 'チェックボックス']);

  if (radio.has(normalized) || radio.has(v)) return { ok: true, value: 'radio' };
  if (checkbox.has(normalized) || checkbox.has(v)) return { ok: true, value: 'checkbox' };

  return {
    ok: false,
    reason: `回答方式は radio/checkbox または ラジオ/チェックボックス のいずれかにしてください (${v})`,
  };
}

// 正解: radio → A/B/C/D の単一 / checkbox → カンマ区切り(A-D 範囲・重複除去・昇順正規化 "A,C")。
// radio に ',' が含まれる等の「正解と回答方式の不整合」もここで検出。
export function normalizeCorrectAnswer(raw: string, method: AnswerMethod): Norm<string> {
  const v = (raw ?? '').trim().toUpperCase();
  if (!v) return { ok: false, reason: '正解が空です' };

  if (method === 'radio') {
    if (!VALID_CHOICES.has(v) || v.includes(',')) {
      return { ok: false, reason: '正解はA/B/C/Dのいずれか1つにしてください' };
    }
    return { ok: true, value: v };
  }

  // checkbox: "A,B,C"(カンマ区切り)を許容し、昇順・重複除去・空白除去で正規化。
  const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: false, reason: '正解が空です' };

  const uniq: string[] = [];
  for (const p of parts) {
    if (!VALID_CHOICES.has(p)) {
      return { ok: false, reason: `正解にはA/B/C/Dのみ使用できます (${p})` };
    }
    if (!uniq.includes(p)) uniq.push(p);
  }
  uniq.sort();
  return { ok: true, value: uniq.join(',') };
}

// 公開: 空 = 公開(true)。'公開'/'非公開' ほか真偽表現(既存 truthy/falsy セット踏襲)。
export function parseActiveValue(raw: string | undefined): Norm<boolean> {
  const v = (raw ?? '').trim();
  if (!v) return { ok: true, value: true };

  const lower = v.toLowerCase();
  const truthy = new Set(['1', 'true', 't', 'yes', 'y', 'on', '公開', '公開中', 'はい', '○']);
  const falsy = new Set(['0', 'false', 'f', 'no', 'n', 'off', '非公開', 'いいえ', '×']);

  if (truthy.has(lower) || truthy.has(v)) return { ok: true, value: true };
  if (falsy.has(lower) || falsy.has(v)) return { ok: true, value: false };

  return { ok: false, reason: `公開の値が不正です (${v})` };
}

// 公開の逆変換(エクスポート用): true → '公開' / false → '非公開'
export function isActiveToLabel(isActive: boolean): '公開' | '非公開' {
  return isActive ? '公開' : '非公開';
}

// ---------------------------------------------------------------------------
// 4. エクスポート(Question[] → xlsx)
// ---------------------------------------------------------------------------

// 純関数: Question[] → 2次元配列(先頭=ヘッダー行)。SheetJS 非依存でテスト容易。
//   - categoryId → category.name(カテゴリ列)、category.unitId → unit.name(単元列)を名前解決
//   - 正解/回答方式/公開は正規化済み表現で出力(= ラウンドトリップ保証。DESIGN 3.5)
export function questionsToAoa(
  questions: Question[],
  opts: { categories: Category[]; units: Unit[] },
): string[][] {
  const categoryById = new Map(opts.categories.map((c) => [c.id, c]));
  const unitById = new Map(opts.units.map((u) => [u.id, u]));

  const rows: string[][] = questions.map((q) => {
    const category = categoryById.get(q.categoryId);
    const categoryName = category?.name ?? '不明';
    const unit = category ? unitById.get(category.unitId) : undefined;
    const unitName = unit?.name ?? '不明';

    // 正解は正規形で出力(裁定A5)。不正値は防御的に生値のまま出す(取込時に行エラーとして検出される)。
    const normalizedCorrect = normalizeCorrectAnswer(q.correctAnswer, q.answerMethod);
    const correctOut = normalizedCorrect.ok ? normalizedCorrect.value : (q.correctAnswer ?? '');

    return [
      q.id ?? '',
      unitName,
      categoryName,
      q.text ?? '',
      q.optionA ?? '',
      q.optionB ?? '',
      q.optionC ?? '',
      q.optionD ?? '',
      correctOut,
      q.answerMethod,
      q.explanation ?? '',
      isActiveToLabel(q.isActive),
    ];
  });

  return [[...QUESTION_HEADERS], ...rows];
}

// SheetJS は動的 import のみ。Vite が自動でチャンク分割(メインバンドルに載せない)。
async function loadXlsx(): Promise<typeof import('xlsx')> {
  const mod = await import('xlsx');
  // ESM(xlsx.mjs)は名前付き export を直接持つ。CJS 相互運用時のみ default に載る場合の保険。
  return (mod as { default?: typeof import('xlsx') }).default ?? mod;
}

// 薄いラッパ(SheetJS 動的 import): AoA → xlsx バイト列。X02 から使用。
export async function aoaToXlsxBytes(aoa: string[][], sheetName = 'questions'): Promise<Uint8Array> {
  const XLSX = await loadXlsx();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}

// 合成: Question[] → xlsx バイト列
export async function buildQuestionsWorkbook(
  questions: Question[],
  opts: { categories: Category[]; units: Unit[] },
): Promise<Uint8Array> {
  return aoaToXlsxBytes(questionsToAoa(questions, opts));
}

// ---------------------------------------------------------------------------
// 5. インポート(xlsx → 行 → バリデーション)
// ---------------------------------------------------------------------------

// 薄いラッパ(SheetJS 動的 import): xlsx バイト列 → AoA(全セル文字列化)。X04 から使用。
export async function xlsxBytesToAoa(data: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const XLSX = await loadXlsx();
  const wb = XLSX.read(data, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });
  return aoa.map((row) => (row ?? []).map((cell) => (cell == null ? '' : String(cell))));
}

// 行エラー(DESIGN 3.4 のレポート形式・裁定A2)。message フィールドは持たない。
export interface RowError {
  row: number;
  column: string;
  reason: string;
}

// パース済み1行(DB 解決前の中間表現)
export interface ParsedQuestionRow {
  rowNumber: number;      // xlsx 行番号(ヘッダー=1、最初のデータ行=2)
  id: string;             // 空=新規 / 非空=上書き候補(存在検証は X03/X04)
  unitName: string;
  categoryName: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;  // 正規化済み("A" or "A,C")
  answerMethod: AnswerMethod;
  explanation: string;
  isActive: boolean;
}

// ヘッダー正規化: trim + 小文字化 + 空白/アンダースコア/ハイフン除去(既存 CSV パーサ準拠)。
const normalizeHeader = (s: string): string =>
  (s ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/[_-]/g, '');

// 見出し別名(順不同・英語名・全角許容)。値は normalizeHeader 済みの受理形。
const HEADER_ALIASES: Record<QuestionColumnKey, readonly string[]> = {
  id: ['id'],
  unit: ['単元', 'unit', 'unitid'],
  category: ['カテゴリ', 'category', 'categoryname'],
  text: ['問題文', '問題', 'text', 'question'],
  optionA: ['選択肢a', 'optiona', 'a'],
  optionB: ['選択肢b', 'optionb', 'b'],
  optionC: ['選択肢c', 'optionc', 'c'],
  optionD: ['選択肢d', 'optiond', 'd'],
  correctAnswer: ['正解', 'answer', 'correctanswer'],
  answerMethod: ['回答方式', '方式', 'answermethod'],
  explanation: ['解説', 'explanation'],
  isActive: ['公開', '出題対象', 'isactive', 'active'],
};

const COLUMN_KEYS = QUESTION_COLUMNS.map((c) => c.key);

// ヘッダー行 → { columnKey: 列インデックス }(最初の一致が優先)。
function resolveColumns(header: string[]): Partial<Record<QuestionColumnKey, number>> {
  const colIndex: Partial<Record<QuestionColumnKey, number>> = {};
  header.forEach((cell, idx) => {
    const normalized = normalizeHeader(cell);
    for (const key of COLUMN_KEYS) {
      if (colIndex[key] !== undefined) continue;
      if (HEADER_ALIASES[key].includes(normalized) || HEADER_ALIASES[key].includes(cell)) {
        colIndex[key] = idx;
        break;
      }
    }
  });
  return colIndex;
}

// 純関数: AoA → {正常行, エラー配列}。全行走査(1件でもエラーなら呼び出し側で取込中断)。
//   - ヘッダー行照合: QUESTION_COLUMNS の見出しを正とし、別名(英語名/全角/順不同)も許容。
//     必須列(required:true)の欠落はヘッダーエラーとして errors に追加(データ行は処理しない)。
//   - 各行: 必須空チェック → parseAnswerMethod → normalizeCorrectAnswer(raw, method)
//           → parseActiveValue の順に検証。NG は該当列の見出しを column にして RowError を push(1行1件)。
//   - 単元名/カテゴリ名は「非空」のみ検証(未存在名はエラーにしない=X03 で自動作成)。
export function parseAoaToRows(aoa: string[][]): { rows: ParsedQuestionRow[]; errors: RowError[] } {
  const rows: ParsedQuestionRow[] = [];
  const errors: RowError[] = [];

  const header = aoa[0] ?? [];
  const colIndex = resolveColumns(header);

  // ヘッダー検証: 必須列の見出しが見つからなければヘッダーエラー(データ行は処理しない)。
  const headerErrors: RowError[] = [];
  for (const col of QUESTION_COLUMNS) {
    if (col.required && colIndex[col.key] === undefined) {
      headerErrors.push({ row: 1, column: col.header, reason: `見出し「${col.header}」が見つかりません` });
    }
  }
  if (headerErrors.length > 0) return { rows, errors: headerErrors };

  const getCell = (row: string[], key: QuestionColumnKey): string => {
    const idx = colIndex[key];
    if (idx === undefined) return '';
    return row[idx] ?? '';
  };

  for (let i = 1; i < aoa.length; i++) {
    const rowNumber = i + 1; // ヘッダー=1行目、最初のデータ行=2行目
    const row = aoa[i] ?? [];

    // 完全空行はスキップ(末尾/中間の空行対策。エラーにも正常にもしない)。
    if (row.every((c) => (c ?? '').trim() === '')) continue;

    // 必須空チェック(列定義順)。最初に見つかった空セルを 1 件だけ報告して次行へ。
    let hadError = false;
    for (const col of QUESTION_COLUMNS) {
      if (!col.required) continue;
      if (getCell(row, col.key).trim() === '') {
        errors.push({ row: rowNumber, column: col.header, reason: `${col.header}は必須です` });
        hadError = true;
        break;
      }
    }
    if (hadError) continue;

    const method = parseAnswerMethod(getCell(row, 'answerMethod'));
    if (!method.ok) {
      errors.push({ row: rowNumber, column: '回答方式', reason: method.reason });
      continue;
    }

    const correct = normalizeCorrectAnswer(getCell(row, 'correctAnswer'), method.value);
    if (!correct.ok) {
      errors.push({ row: rowNumber, column: '正解', reason: correct.reason });
      continue;
    }

    const active = parseActiveValue(getCell(row, 'isActive'));
    if (!active.ok) {
      errors.push({ row: rowNumber, column: '公開', reason: active.reason });
      continue;
    }

    rows.push({
      rowNumber,
      id: getCell(row, 'id').trim(),
      unitName: getCell(row, 'unit').trim(),
      categoryName: getCell(row, 'category').trim(),
      text: getCell(row, 'text').trim(),
      optionA: getCell(row, 'optionA').trim(),
      optionB: getCell(row, 'optionB').trim(),
      optionC: getCell(row, 'optionC').trim(),
      optionD: getCell(row, 'optionD').trim(),
      correctAnswer: correct.value,
      answerMethod: method.value,
      explanation: getCell(row, 'explanation'),
      isActive: active.value,
    });
  }

  return { rows, errors };
}

// 合成(裁定A2): ArrayBuffer 入力の単一入口。X04 はこれを呼ぶ(= xlsxBytesToAoa + parseAoaToRows)。
export async function parseQuestionsXlsx(
  data: ArrayBuffer | Uint8Array,
): Promise<{ rows: ParsedQuestionRow[]; errors: RowError[] }> {
  const aoa = await xlsxBytesToAoa(data);
  return parseAoaToRows(aoa);
}

// ---------------------------------------------------------------------------
// 6. 行分類(ID 一致=上書き / ID 空=新規 / ID 有り+DB 不存在=エラー)を純関数で中央化
//    DB 非依存。X04 は読み込み済み問題の ID 集合を渡す(原子的 upsert は X03 の RPC が担保)。
// ---------------------------------------------------------------------------

export type RowResolution =
  | { kind: 'insert'; row: ParsedQuestionRow }
  | { kind: 'update'; row: ParsedQuestionRow }
  | { kind: 'error';  error: RowError };

export function classifyRows(rows: ParsedQuestionRow[], existingIds: Set<string>): RowResolution[] {
  return rows.map((row): RowResolution => {
    if (row.id === '') return { kind: 'insert', row };
    if (existingIds.has(row.id)) return { kind: 'update', row };
    return {
      kind: 'error',
      error: { row: row.rowNumber, column: 'ID', reason: '指定IDの問題が存在しません' },
    };
  });
}

// X01: questionXlsx.ts 純関数テスト + ラウンドトリップ保証(DESIGN.md 要件① 3-5 / docs/REVIEW_NOTES.md 裁定A1-A12)
// Playwright ランナーの Node 実行(page 非使用・ブラウザ/認証情報/baseURL 不要)。
// X01 実装前は import 解決に失敗して red になる(テストファースト)。feature/X01 で実装と同時に green にすること。
import { test, expect } from '@playwright/test';
import {
  QUESTION_COLUMNS,
  QUESTION_HEADERS,
  parseAnswerMethod,
  normalizeCorrectAnswer,
  parseActiveValue,
  isActiveToLabel,
  questionsToAoa,
  aoaToXlsxBytes,
  buildQuestionsWorkbook,
  xlsxBytesToAoa,
  parseAoaToRows,
  parseQuestionsXlsx,
  classifyRows,
} from '../../src/app/lib/questionXlsx';
import type { Question, Category, Unit } from '../../src/app/types';

const units: Unit[] = [
  { id: 'unit-1', name: 'ネットワーク基礎', description: '' },
  { id: 'unit-2', name: 'CCNA', description: '' },
];

const categories: Category[] = [
  { id: 'cat-1', name: 'OSI参照モデル', description: '', unitId: 'unit-1' },
  { id: 'cat-2', name: 'CCNA-13', description: '', unitId: 'unit-2' },
];

const questions: Question[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    text: 'OSI参照モデルの第3層は?',
    optionA: '物理層',
    optionB: 'ネットワーク層',
    optionC: 'セッション層',
    optionD: 'アプリケーション層',
    correctAnswer: 'B',
    answerMethod: 'radio',
    explanation: '第3層はネットワーク層。',
    categoryId: 'cat-1',
    isActive: true,
  },
  {
    // correctAnswer が DB 上で未ソート("C,A")でも、エクスポート出力は昇順正規化される(裁定A5)
    id: '22222222-2222-4222-8222-222222222222',
    text: 'ルーティングプロトコルを2つ選べ。値に,や"を含む選択肢/改行\nもラウンドトリップで保持される',
    optionA: 'OSPF, v2("マルチエリア")',
    optionB: 'HTTP',
    optionC: 'EIGRP',
    optionD: 'SMTP',
    correctAnswer: 'C,A',
    answerMethod: 'checkbox',
    explanation: '',
    categoryId: 'cat-2',
    isActive: false,
  },
];

const opts = { categories, units };

// ---------------------------------------------------------------------------
// 1. 列定義(単一の真実)の不変条件
// ---------------------------------------------------------------------------

test('列定義: 12列・ヘッダー文言と順序が DESIGN §2 と一致する', () => {
  expect(QUESTION_COLUMNS.length).toBe(12);
  expect([...QUESTION_HEADERS]).toEqual([
    'ID', '単元', 'カテゴリ', '問題文',
    '選択肢A', '選択肢B', '選択肢C', '選択肢D',
    '正解', '回答方式', '解説', '公開',
  ]);
});

// ---------------------------------------------------------------------------
// 2. 値正規化の純関数
// ---------------------------------------------------------------------------

test('parseAnswerMethod: 英語/日本語表記を受理し、空欄・不正値はエラー(裁定A9)', () => {
  expect(parseAnswerMethod('radio')).toEqual({ ok: true, value: 'radio' });
  expect(parseAnswerMethod('checkbox')).toEqual({ ok: true, value: 'checkbox' });
  expect(parseAnswerMethod('ラジオ')).toEqual({ ok: true, value: 'radio' });
  expect(parseAnswerMethod('チェックボックス')).toEqual({ ok: true, value: 'checkbox' });
  expect(parseAnswerMethod('').ok).toBe(false); // 空欄=エラー(既存CSVのcheckbox既定化は踏襲しない)
  expect(parseAnswerMethod(undefined).ok).toBe(false);
  expect(parseAnswerMethod('dropdown').ok).toBe(false);
});

test('normalizeCorrectAnswer: radio=単一のみ / checkbox=昇順・重複除去 / 範囲外はエラー', () => {
  expect(normalizeCorrectAnswer('A', 'radio')).toEqual({ ok: true, value: 'A' });
  expect(normalizeCorrectAnswer('A,B', 'radio').ok).toBe(false); // radioに複数=不整合
  expect(normalizeCorrectAnswer('E', 'radio').ok).toBe(false);
  expect(normalizeCorrectAnswer('C,A', 'checkbox')).toEqual({ ok: true, value: 'A,C' });
  expect(normalizeCorrectAnswer('B,A,B', 'checkbox')).toEqual({ ok: true, value: 'A,B' });
  expect(normalizeCorrectAnswer('', 'checkbox').ok).toBe(false);
  expect(normalizeCorrectAnswer('A,E', 'checkbox').ok).toBe(false);
});

test('parseActiveValue/isActiveToLabel: 真偽表現の受理と逆変換', () => {
  expect(parseActiveValue('')).toEqual({ ok: true, value: true }); // 空=公開
  expect(parseActiveValue(undefined)).toEqual({ ok: true, value: true });
  expect(parseActiveValue('公開')).toEqual({ ok: true, value: true });
  expect(parseActiveValue('非公開')).toEqual({ ok: true, value: false });
  expect(parseActiveValue('1')).toEqual({ ok: true, value: true });
  expect(parseActiveValue('0')).toEqual({ ok: true, value: false });
  expect(parseActiveValue('○')).toEqual({ ok: true, value: true });
  expect(parseActiveValue('×')).toEqual({ ok: true, value: false });
  expect(parseActiveValue('そのうち').ok).toBe(false);
  expect(isActiveToLabel(true)).toBe('公開');
  expect(isActiveToLabel(false)).toBe('非公開');
});

// ---------------------------------------------------------------------------
// 3. エクスポート(questionsToAoa)
// ---------------------------------------------------------------------------

test('questionsToAoa: 先頭ヘッダー行+名前解決+正規化表現で出力する', () => {
  const aoa = questionsToAoa(questions, opts);
  expect(aoa.length).toBe(1 + questions.length);
  expect(aoa[0]).toEqual([...QUESTION_HEADERS]);

  const row1 = aoa[1];
  expect(row1[0]).toBe(questions[0].id); // ID列=UUID
  expect(row1[1]).toBe('ネットワーク基礎'); // categoryId→unit名解決
  expect(row1[2]).toBe('OSI参照モデル');
  expect(row1[8]).toBe('B');
  expect(row1[9]).toBe('radio');
  expect(row1[11]).toBe('公開');

  const row2 = aoa[2];
  expect(row2[1]).toBe('CCNA');
  expect(row2[2]).toBe('CCNA-13');
  expect(row2[8]).toBe('A,C'); // DB値 "C,A" → 昇順正規化(裁定A5)
  expect(row2[9]).toBe('checkbox');
  expect(row2[10]).toBe(''); // 解説空は空のまま
  expect(row2[11]).toBe('非公開');
});

// ---------------------------------------------------------------------------
// 4. インポート(parseAoaToRows)のバリデーション
// ---------------------------------------------------------------------------

const validDataRow = (over: Partial<Record<number, string>> = {}): string[] => {
  const base = [
    '', '単元X', 'カテゴリY', '問題文Z',
    '選択肢1', '選択肢2', '選択肢3', '選択肢4',
    'A', 'radio', '解説', '公開',
  ];
  for (const [idx, v] of Object.entries(over)) base[Number(idx)] = v;
  return base;
};

test('parseAoaToRows: 正常行はエラーなしで ParsedQuestionRow になる(行番号=シート行)', () => {
  const { rows, errors } = parseAoaToRows([[...QUESTION_HEADERS], validDataRow()]);
  expect(errors).toEqual([]);
  expect(rows.length).toBe(1);
  expect(rows[0].rowNumber).toBe(2); // ヘッダー=1行目、最初のデータ行=2行目
  expect(rows[0].id).toBe(''); // ID空=新規
  expect(rows[0].unitName).toBe('単元X');
  expect(rows[0].categoryName).toBe('カテゴリY');
  expect(rows[0].correctAnswer).toBe('A');
  expect(rows[0].answerMethod).toBe('radio');
  expect(rows[0].isActive).toBe(true);
});

test('parseAoaToRows: 必須欠落・形式不正は {row, column, reason} で全件報告される', () => {
  const aoa = [
    [...QUESTION_HEADERS],
    validDataRow({ 3: '' }),            // 行2: 問題文空
    validDataRow({ 6: '' }),            // 行3: 選択肢C空
    validDataRow({ 8: 'A,B' }),         // 行4: radioに複数正解
    validDataRow({ 8: 'E' }),           // 行5: 正解が範囲外
    validDataRow({ 9: '' }),            // 行6: 回答方式空(裁定A9)
    validDataRow({ 9: 'dropdown' }),    // 行7: 回答方式不正
    validDataRow({ 11: '未定' }),        // 行8: 公開値不正
    validDataRow({ 1: '' }),            // 行9: 単元名空
  ];
  const { rows, errors } = parseAoaToRows(aoa);
  expect(rows.length).toBe(0); // 全行NG(正常行なし)
  const byRow = new Map(errors.map((e) => [e.row, e]));
  expect(byRow.get(2)?.column).toBe('問題文');
  expect(byRow.get(3)?.column).toBe('選択肢C');
  expect(byRow.get(4)?.column).toBe('正解');
  expect(byRow.get(5)?.column).toBe('正解');
  expect(byRow.get(6)?.column).toBe('回答方式');
  expect(byRow.get(7)?.column).toBe('回答方式');
  expect(byRow.get(8)?.column).toBe('公開');
  expect(byRow.get(9)?.column).toBe('単元');
  for (const e of errors) expect(e.reason.length).toBeGreaterThan(0);
});

test('parseAoaToRows: 必須列がヘッダーに無い場合はヘッダーエラーになる', () => {
  const headersMissingSeikai = QUESTION_HEADERS.filter((h) => h !== '正解');
  const { rows, errors } = parseAoaToRows([headersMissingSeikai, validDataRow().slice(0, 11)]);
  expect(rows.length).toBe(0);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors.some((e) => e.column === '正解')).toBe(true);
});

test('parseAoaToRows: 未存在の単元/カテゴリ名は行エラーにしない(自動作成はRPC側の責務)', () => {
  const { rows, errors } = parseAoaToRows([
    [...QUESTION_HEADERS],
    validDataRow({ 1: '新設単元', 2: 'CCNA-99' }),
  ]);
  expect(errors).toEqual([]);
  expect(rows.length).toBe(1);
});

// ---------------------------------------------------------------------------
// 5. 行分類(classifyRows)= ID一致→上書き / 空→新規 / 不存在→エラー
// ---------------------------------------------------------------------------

test('classifyRows: insert / update / error の3分類(裁定A3/A4)', () => {
  const { rows } = parseAoaToRows([
    [...QUESTION_HEADERS],
    validDataRow(),                                              // id空 → insert
    validDataRow({ 0: '11111111-1111-4111-8111-111111111111' }), // 既存 → update
    validDataRow({ 0: '99999999-9999-4999-8999-999999999999' }), // 不存在 → error
  ]);
  const existing = new Set([questions[0].id, questions[1].id]);
  const res = classifyRows(rows, existing);
  expect(res.map((r) => r.kind)).toEqual(['insert', 'update', 'error']);
  const err = res[2];
  if (err.kind === 'error') {
    expect(err.error.row).toBe(4);
    expect(err.error.column).toBe('ID');
    expect(err.error.reason).toContain('存在しません');
  }
});

// ---------------------------------------------------------------------------
// 6. ラウンドトリップ保証(DESIGN 要件① 必須要件)
//    エクスポート→無編集で再インポート→全フィールド一致・全行 update(実質no-op)
// ---------------------------------------------------------------------------

test('ラウンドトリップ: buildQuestionsWorkbook → xlsxBytesToAoa → parseAoaToRows で完全一致する', async () => {
  const bytes = await buildQuestionsWorkbook(questions, opts);
  expect(bytes.byteLength).toBeGreaterThan(0);

  const aoa = await xlsxBytesToAoa(bytes);
  expect(aoa[0]).toEqual([...QUESTION_HEADERS]);

  const { rows, errors } = parseAoaToRows(aoa);
  expect(errors).toEqual([]);
  expect(rows.length).toBe(questions.length);

  const unitById = new Map(units.map((u) => [u.id, u]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  for (const q of questions) {
    const row = rows.find((r) => r.id === q.id);
    expect(row, `id=${q.id} の行がラウンドトリップで失われた`).toBeTruthy();
    if (!row) continue;
    const cat = catById.get(q.categoryId)!;
    expect(row.unitName).toBe(unitById.get(cat.unitId)!.name);
    expect(row.categoryName).toBe(cat.name);
    expect(row.text).toBe(q.text);
    expect(row.optionA).toBe(q.optionA);
    expect(row.optionB).toBe(q.optionB);
    expect(row.optionC).toBe(q.optionC);
    expect(row.optionD).toBe(q.optionD);
    // 正解は「正規形」で一致(DB値が未ソートでも正規形へ収束し、以後は不動点)
    expect(row.correctAnswer).toBe(
      normalizeCorrectAnswer(q.correctAnswer, q.answerMethod).ok
        ? (normalizeCorrectAnswer(q.correctAnswer, q.answerMethod) as { ok: true; value: string }).value
        : q.correctAnswer,
    );
    expect(row.answerMethod).toBe(q.answerMethod);
    expect(row.explanation).toBe(q.explanation);
    expect(row.isActive).toBe(q.isActive);
  }

  // 全行が「ID一致→上書き」= 実質 no-op になる(部分insert/errorが混ざらない)
  const res = classifyRows(rows, new Set(questions.map((q) => q.id)));
  expect(res.every((r) => r.kind === 'update')).toBe(true);
});

test('ラウンドトリップ(2周目): 正規化出力は不動点である(再エクスポート=同一AoA)', async () => {
  // 1周目のパース結果から Question[] を再構成し、再エクスポートした AoA が1周目と完全一致すること
  const bytes = await buildQuestionsWorkbook(questions, opts);
  const aoa1 = await xlsxBytesToAoa(bytes);
  const { rows } = parseAoaToRows(aoa1);

  const catByKey = new Map(categories.map((c) => [c.name, c]));
  const rebuilt: Question[] = rows.map((r) => ({
    id: r.id,
    text: r.text,
    optionA: r.optionA,
    optionB: r.optionB,
    optionC: r.optionC,
    optionD: r.optionD,
    correctAnswer: r.correctAnswer,
    answerMethod: r.answerMethod,
    explanation: r.explanation,
    categoryId: catByKey.get(r.categoryName)!.id,
    isActive: r.isActive,
  }));
  const aoa2 = questionsToAoa(rebuilt, opts);
  expect(aoa2).toEqual(questionsToAoa(questions, opts));
});

// ---------------------------------------------------------------------------
// 7. 合成関数(裁定A2: X04 が使う唯一の入口)
// ---------------------------------------------------------------------------

test('parseQuestionsXlsx: ArrayBuffer 入力の合成APIが xlsxBytesToAoa+parseAoaToRows と等価', async () => {
  const bytes = await aoaToXlsxBytes(questionsToAoa(questions, opts));
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const { rows, errors } = await parseQuestionsXlsx(buf);
  expect(errors).toEqual([]);
  expect(rows.length).toBe(questions.length);
  expect(rows.map((r) => r.id).sort()).toEqual(questions.map((q) => q.id).sort());
});

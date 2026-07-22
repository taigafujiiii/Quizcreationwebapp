import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Header } from '../layout/Header';
import { AnswerMethod, Choice, Question, Category, Unit } from '../../types';
import { ArrowLeft, Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { buildQuestionsWorkbook, parseQuestionsXlsx, classifyRows } from '../../lib/questionXlsx';
import type { ParsedQuestionRow, RowError } from '../../lib/questionXlsx';
import { toast } from 'sonner';

export const QuestionsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formData, setFormData] = useState({
    text: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A',
    answerMethod: 'checkbox' as AnswerMethod,
    explanation: '',
    categoryId: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(true);

  // xlsx インポート(X04)state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [importErrors, setImportErrors] = useState<RowError[]>([]);
  const [importRows, setImportRows] = useState<ParsedQuestionRow[]>([]);
  const [importing, setImporting] = useState(false);

  const parseCorrectAnswerList = (raw: string): Choice[] => {
    const v = (raw ?? '').trim().toUpperCase();
    if (!v) return [];
    const validChoices = new Set<Choice>(['A', 'B', 'C', 'D']);
    const parts = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const uniq: Choice[] = [];
    for (const p of parts) {
      if (!validChoices.has(p as Choice)) continue;
      const c = p as Choice;
      if (!uniq.includes(c)) uniq.push(c);
    }
    uniq.sort();
    return uniq;
  };

  const toggleCorrectChoice = (choice: Choice) => {
    const list = parseCorrectAnswerList(formData.correctAnswer);
    const next = list.includes(choice) ? list.filter((c) => c !== choice) : [...list, choice];
    next.sort();
    setFormData({ ...formData, correctAnswer: next.join(',') });
  };

  const loadData = async () => {
    setLoading(true);
    // P2-4: 3クエリを直列awaitから Promise.all で並列化(select列エイリアス・order は現状のまま)。
    const [
      { data: unitData, error: unitError },
      { data: questionData, error: questionError },
      { data: categoryData, error: categoryError },
    ] = await Promise.all([
      supabase
        .from('units')
        .select('id, name, description')
        .order('created_at', { ascending: true }),
      supabase
        .from('questions')
        .select(
          'id, text, optionA:option_a, optionB:option_b, optionC:option_c, optionD:option_d, correctAnswer:correct_answer, answerMethod:answer_method, explanation, categoryId:category_id, isActive:is_active, isAssignment:is_assignment, updatedAt:updated_at'
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('id, name, description, unitId:unit_id')
        .order('created_at', { ascending: true }),
    ]);

    if (unitError || questionError || categoryError) {
      toast.error('データの取得に失敗しました');
      setLoading(false);
      return;
    }

    setQuestions((questionData as Question[]) || []);
    setUnits((unitData as Unit[]) || []);
    setCategories((categoryData as Category[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  // 絞り込み条件が変わったら選択状態をリセット
  useEffect(() => {
    setSelectedIds([]);
  }, [selectedUnitId, selectedCategoryId]);

  const handleSubmit = async () => {
    if (!formData.categoryId || !formData.text.trim()) {
      toast.error('カテゴリと問題文を入力してください');
      return;
    }
    if (formData.answerMethod === 'checkbox' && parseCorrectAnswerList(formData.correctAnswer).length === 0) {
      toast.error('チェックボックス回答の場合、正解を1つ以上選択してください');
      return;
    }

    if (editingQuestion) {
      if (!editingQuestion.updatedAt) {
        toast.error('データが古い可能性があります。再読み込みしてください');
        await loadData();
        return;
      }

      const { data, error } = await supabase
        .from('questions')
        .update({
          text: formData.text,
          option_a: formData.optionA,
          option_b: formData.optionB,
          option_c: formData.optionC,
          option_d: formData.optionD,
          correct_answer: formData.correctAnswer,
          answer_method: formData.answerMethod,
          explanation: formData.explanation,
          category_id: formData.categoryId,
          is_active: formData.isActive,
        })
        .eq('id', editingQuestion.id)
        .eq('updated_at', editingQuestion.updatedAt)
        .select('updatedAt:updated_at')
        .maybeSingle();

      if (error) {
        toast.error('問題の更新に失敗しました');
        return;
      }
      if (!data) {
        toast.error('他のユーザーが先に更新しました。最新の状態を読み込みます');
        await loadData();
        return;
      }
      // 楽観的ローカル更新: 全件再取得せず該当行のみ差し替え。
      // isAssignment 等の update select 非返却列は editingQuestion から引き継ぎ、
      // 新 updatedAt を反映して連続編集でも競合検知が働くようにする(裁定B5)。
      const updatedQuestion: Question = {
        ...editingQuestion,
        text: formData.text,
        optionA: formData.optionA,
        optionB: formData.optionB,
        optionC: formData.optionC,
        optionD: formData.optionD,
        correctAnswer: formData.correctAnswer,
        answerMethod: formData.answerMethod,
        explanation: formData.explanation,
        categoryId: formData.categoryId,
        isActive: formData.isActive,
        updatedAt: (data as { updatedAt?: string }).updatedAt ?? editingQuestion.updatedAt,
      };
      setQuestions(questions.map((q) => (q.id === editingQuestion.id ? updatedQuestion : q)));
      toast.success('問題を更新しました');
    } else {
      // insert に loadData と同一エイリアスの .select().single() を付与し(裁定B5)、
      // 返却行を先頭に楽観追加する(一覧は created_at 降順=新規は先頭)。updatedAt 取得必須。
      const { data, error } = await supabase
        .from('questions')
        .insert({
          text: formData.text,
          option_a: formData.optionA,
          option_b: formData.optionB,
          option_c: formData.optionC,
          option_d: formData.optionD,
          correct_answer: formData.correctAnswer,
          answer_method: formData.answerMethod,
          explanation: formData.explanation,
          category_id: formData.categoryId,
          is_active: formData.isActive,
          is_assignment: false,
        })
        .select(
          'id, text, optionA:option_a, optionB:option_b, optionC:option_c, optionD:option_d, correctAnswer:correct_answer, answerMethod:answer_method, explanation, categoryId:category_id, isActive:is_active, isAssignment:is_assignment, updatedAt:updated_at'
        )
        .single();

      if (error) {
        toast.error('問題の作成に失敗しました');
        return;
      }
      setQuestions([data as Question, ...questions]);
      toast.success('問題を作成しました');
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      text: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      answerMethod: 'checkbox',
      explanation: '',
      categoryId: '',
      isActive: true,
    });
    setEditingQuestion(null);
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setFormData({
      text: question.text,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
      answerMethod: question.answerMethod,
      explanation: question.explanation,
      categoryId: question.categoryId,
      isActive: question.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この問題を削除してもよろしいですか？')) {
      return;
    }

    // 楽観的ローカル削除: 全件再取得せず該当行のみ除去。失敗時は退避値へロールバック。
    const prev = questions;
    setQuestions(prev.filter((q) => q.id !== id));

    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
      setQuestions(prev);
      toast.error('問題の削除に失敗しました');
      return;
    }
    toast.success('問題を削除しました');
  };

  const handleNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const toggleActive = async (id: string, next: boolean) => {
    const target = questions.find((q) => q.id === id);
    if (!target?.updatedAt) {
      toast.error('データが古い可能性があります。再読み込みしてください');
      await loadData();
      return;
    }

    const { data, error } = await supabase
      .from('questions')
      .update({ is_active: next })
      .eq('id', id)
      .eq('updated_at', target.updatedAt)
      .select('updatedAt:updated_at')
      .maybeSingle();

    if (error) {
      toast.error('状態の更新に失敗しました');
      return;
    }
    if (!data) {
      toast.error('他のユーザーが先に更新しました。最新の状態を読み込みます');
      await loadData();
      return;
    }

    setQuestions(
      questions.map((q) =>
        q.id === id ? { ...q, isActive: next, updatedAt: (data as any).updatedAt ?? q.updatedAt } : q
      )
    );
  };

  // P2-2: テーブル行ごとの O(n) 線形探索を Map(useMemo)で O(1) 参照化。
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const getCategoryName = (categoryId: string) => {
    return categoryById.get(categoryId)?.name || '不明';
  };

  const getUnitNameByCategoryId = (categoryId: string) => {
    const category = categoryById.get(categoryId);
    if (!category) return '不明';
    return unitById.get(category.unitId)?.name || '不明';
  };

  const filteredQuestions = useMemo(() => {
    let filtered = questions;

    if (selectedUnitId !== 'all') {
      const categoryIdsInUnit = categories
        .filter((c) => c.unitId === selectedUnitId)
        .map((c) => c.id);
      filtered = filtered.filter((q) => categoryIdsInUnit.includes(q.categoryId));
    }

    if (selectedCategoryId !== 'all') {
      filtered = filtered.filter((q) => q.categoryId === selectedCategoryId);
    }

    return filtered;
  }, [questions, categories, selectedUnitId, selectedCategoryId]);

  const categoryOptionsForFilter = useMemo(() => {
    if (selectedUnitId === 'all') return categories;
    return categories.filter((c) => c.unitId === selectedUnitId);
  }, [categories, selectedUnitId]);

  const isAllSelected =
    filteredQuestions.length > 0 && selectedIds.length === filteredQuestions.length;
  const isSomeSelected =
    selectedIds.length > 0 && selectedIds.length < filteredQuestions.length;

  const toggleSelectAll = (next: boolean) => {
    if (!next) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredQuestions.map((q) => q.id));
  };

  const toggleSelectedId = (id: string, next: boolean) => {
    setSelectedIds((prev) => {
      if (next) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((x) => x !== id);
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`選択した${selectedIds.length}件の問題を削除してもよろしいですか？`)) {
      return;
    }

    // 楽観的ローカル一括削除: 全件再取得せず対象行のみ除去 + 選択解除。失敗時はロールバック。
    const prev = questions;
    const prevSelected = selectedIds;
    const count = selectedIds.length;
    setQuestions(prev.filter((q) => !prevSelected.includes(q.id)));
    setSelectedIds([]);

    const { error } = await supabase.from('questions').delete().in('id', prevSelected);
    if (error) {
      setQuestions(prev);
      setSelectedIds(prevSelected);
      toast.error('問題の削除に失敗しました');
      return;
    }
    toast.success(`問題を${count}件削除しました`);
  };

  // ファイル名: DESIGN 指定の questions_YYYYMMDD_HHmm.xlsx(ローカル時刻・ゼロ埋め)
  const buildExportFileName = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
    return `questions_${stamp}.xlsx`;
  };

  // エクスポート実行(A1: 名前解決は X01 内部。buildQuestionsWorkbook に categories/units を渡す)。
  // 全件=questions / 絞り込み結果=filteredQuestions。既存の Blob + createObjectURL パターンでDL。
  const handleExport = async (scope: 'all' | 'filtered') => {
    const target = scope === 'all' ? questions : filteredQuestions;
    if (target.length === 0) {
      toast.error('エクスポート対象の問題がありません');
      return;
    }
    try {
      const bytes = await buildQuestionsWorkbook(target, { categories, units });
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildExportFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${target.length}件をエクスポートしました`);
    } catch {
      toast.error('エクスポートに失敗しました');
    }
  };

  // ---------------------------------------------------------------------------
  // xlsx インポート(X04)
  //   フロー: ファイル選択 → parseQuestionsXlsx(X01) → classifyRows(X01) で
  //   ID不存在の事前検出 + 新規/上書き件数の導出 → プレビュー → import_questions RPC(X03)
  // ---------------------------------------------------------------------------

  const resetImportState = () => {
    setImportErrors([]);
    setImportRows([]);
    setImporting(false);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  // RowError(X01 は message を持たない)の表示整形。行全体エラー(row=0)は理由のみ。
  const formatImportError = (e: RowError): string =>
    e.row === 0 ? e.reason : `行${e.row}: [${e.column}] ${e.reason}`;

  const handleImportFile = async (file: File | null) => {
    resetImportState();
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const { rows, errors } = await parseQuestionsXlsx(buf);
      // A3: ID不存在エラーの検出は X01 の classifyRows から導出(独自実装しない)。
      const knownIds = new Set(questions.map((q) => q.id));
      const idErrors: RowError[] = classifyRows(rows, knownIds).flatMap((r) =>
        r.kind === 'error' ? [r.error] : []
      );
      const allErrors = [...errors, ...idErrors];
      if (allErrors.length > 0) {
        setImportErrors(allErrors);
        setImportRows([]);
        return;
      }
      if (rows.length === 0) {
        setImportErrors([{ row: 0, column: '', reason: '取り込み可能なデータ行がありません' }]);
        return;
      }
      setImportErrors([]);
      setImportRows(rows);
    } catch {
      setImportErrors([
        { row: 0, column: '', reason: 'ファイルの読み込みに失敗しました（.xlsx を選択してください）' },
      ]);
    }
  };

  // プレビュー算出(エラーゼロ時)。新規/上書き件数は A3 の classifyRows から導出。
  // 単元は名前一致、カテゴリは「単元名::カテゴリ名」キーで既存判定(X03 RPC と同粒度)。
  const importPreview = useMemo(() => {
    const knownIds = new Set(questions.map((q) => q.id));
    const resolutions = classifyRows(importRows, knownIds);
    const newCount = resolutions.filter((r) => r.kind === 'insert').length;
    const updateCount = resolutions.filter((r) => r.kind === 'update').length;

    const existingUnitNames = new Set(units.map((u) => u.name.trim()));
    const existingCatKeys = new Set(
      categories.map((c) => {
        const unitName = units.find((u) => u.id === c.unitId)?.name?.trim() ?? '';
        return `${unitName}::${c.name.trim()}`;
      })
    );
    const newUnits = new Set<string>();
    const newCategories = new Set<string>();
    for (const r of importRows) {
      const un = r.unitName.trim();
      if (un && !existingUnitNames.has(un)) newUnits.add(un);
      const key = `${un}::${r.categoryName.trim()}`;
      if (r.categoryName.trim() && !existingCatKeys.has(key)) {
        newCategories.add(`${un} / ${r.categoryName.trim()}`);
      }
    }
    return {
      newCount,
      updateCount,
      newUnits: Array.from(newUnits),
      newCategories: Array.from(newCategories),
    };
  }, [importRows, questions, units, categories]);

  const handleImportSubmit = async () => {
    if (importRows.length === 0 || importErrors.length > 0) return;
    setImporting(true);
    try {
      // A4: id 空文字 → null / A7: row_number を各行に含める / A8: p_rows で RPC 呼び出し。
      const p_rows = importRows.map((r) => ({
        row_number: r.rowNumber,
        id: r.id === '' ? null : r.id,
        unit_name: r.unitName,
        category_name: r.categoryName,
        text: r.text,
        option_a: r.optionA,
        option_b: r.optionB,
        option_c: r.optionC,
        option_d: r.optionD,
        correct_answer: r.correctAnswer,
        answer_method: r.answerMethod,
        explanation: r.explanation,
        is_active: r.isActive,
      }));

      const { data, error } = await supabase.rpc('import_questions', { p_rows });
      if (error) {
        // RPC が全件ロールバック(例: 行N の ID 不存在)を返した場合。ダイアログは閉じない。
        toast.error(`インポートに失敗しました: ${error.message}`);
        return;
      }
      const s = data as {
        inserted: number;
        updated: number;
        created_units: number;
        created_categories: number;
      };
      toast.success(
        `インポート完了: 新規${s.inserted}件 / 上書き${s.updated}件` +
          (s.created_units ? ` / 単元${s.created_units}件作成` : '') +
          (s.created_categories ? ` / カテゴリ${s.created_categories}件作成` : '')
      );
      setIsImportDialogOpen(false);
      resetImportState();
      await loadData();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <h1 className="text-3xl">問題管理</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center gap-4">
              <CardTitle>問題一覧</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={loading || questions.length === 0}
                  onClick={() => void handleExport('all')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  全件エクスポート
                </Button>
                <Button
                  variant="outline"
                  disabled={loading || filteredQuestions.length === 0}
                  onClick={() => void handleExport('filtered')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  絞り込み結果をエクスポート
                </Button>
                <Dialog
                  open={isImportDialogOpen}
                  onOpenChange={(open) => {
                    setIsImportDialogOpen(open);
                    if (!open) resetImportState();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" onClick={() => resetImportState()}>
                      <Upload className="h-4 w-4 mr-2" />
                      xlsxインポート
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[92vw] sm:w-[90vw] lg:w-[80vw] max-w-none max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>xlsxインポートで問題を一括登録</DialogTitle>
                      <DialogDescription>
                        エクスポートした xlsx を編集して取り込みます。ID列が空の行は新規作成、既存問題のIDと一致する行は上書きされます。未存在の単元・カテゴリは名前で自動作成されます。
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>xlsxファイル</Label>
                        <Input
                          ref={importFileRef}
                          type="file"
                          accept=".xlsx"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            void handleImportFile(f);
                          }}
                        />
                        <p className="text-xs text-gray-500">
                          列: ID / 単元 / カテゴリ / 問題文 / 選択肢A-D / 正解 / 回答方式 / 解説 / 公開。エクスポートした xlsx をそのまま取り込めます。
                        </p>
                      </div>

                      {importErrors.length > 0 && (
                        <div className="border rounded-md p-3 bg-red-50">
                          <div className="font-semibold text-red-700 mb-2">エラー</div>
                          <ul className="text-sm text-red-700 list-disc pl-5 space-y-1">
                            {importErrors.slice(0, 20).map((e, idx) => (
                              <li key={idx}>{formatImportError(e)}</li>
                            ))}
                          </ul>
                          {importErrors.length > 20 && (
                            <div className="text-xs text-red-700 mt-2">
                              ほか {importErrors.length - 20} 件
                            </div>
                          )}
                        </div>
                      )}

                      {importErrors.length === 0 && importRows.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm text-gray-700">
                            新規 {importPreview.newCount} 件 / 上書き {importPreview.updateCount} 件
                          </div>
                          {importPreview.newUnits.length > 0 && (
                            <div className="text-sm text-gray-700">
                              自動作成される単元: {importPreview.newUnits.slice(0, 10).join(', ')}
                              {importPreview.newUnits.length > 10 &&
                                ` ほか ${importPreview.newUnits.length - 10} 件`}
                            </div>
                          )}
                          {importPreview.newCategories.length > 0 && (
                            <div className="text-sm text-gray-700">
                              自動作成されるカテゴリ: {importPreview.newCategories.slice(0, 10).join(', ')}
                              {importPreview.newCategories.length > 10 &&
                                ` ほか ${importPreview.newCategories.length - 10} 件`}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsImportDialogOpen(false);
                            resetImportState();
                          }}
                        >
                          キャンセル
                        </Button>
                        <Button
                          disabled={
                            importRows.length === 0 || importErrors.length > 0 || importing
                          }
                          onClick={() => void handleImportSubmit()}
                        >
                          {importing ? 'インポート中...' : 'インポート'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  disabled={selectedIds.length === 0}
                  onClick={() => void handleBulkDelete()}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  選択削除
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={handleNew}>
                      <Plus className="h-4 w-4 mr-2" />
                      新規作成
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingQuestion ? '問題を編集' : '新しい問題を作成'}
                      </DialogTitle>
                      <DialogDescription>
                        問題文、選択肢、正解、解説を入力してください
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">カテゴリ</Label>
                        <Select
                          value={formData.categoryId}
                          onValueChange={(value) =>
                            setFormData({ ...formData, categoryId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="カテゴリを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="text">問題文</Label>
                        <Textarea
                          id="text"
                          value={formData.text}
                          onChange={(e) =>
                            setFormData({ ...formData, text: e.target.value })
                          }
                          placeholder="問題文を入力"
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="optionA">選択肢 A</Label>
                          <Input
                            id="optionA"
                            value={formData.optionA}
                            onChange={(e) =>
                              setFormData({ ...formData, optionA: e.target.value })
                            }
                            placeholder="選択肢 A"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="optionB">選択肢 B</Label>
                          <Input
                            id="optionB"
                            value={formData.optionB}
                            onChange={(e) =>
                              setFormData({ ...formData, optionB: e.target.value })
                            }
                            placeholder="選択肢 B"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="optionC">選択肢 C</Label>
                          <Input
                            id="optionC"
                            value={formData.optionC}
                            onChange={(e) =>
                              setFormData({ ...formData, optionC: e.target.value })
                            }
                            placeholder="選択肢 C"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="optionD">選択肢 D</Label>
                          <Input
                            id="optionD"
                            value={formData.optionD}
                            onChange={(e) =>
                              setFormData({ ...formData, optionD: e.target.value })
                            }
                            placeholder="選択肢 D"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="correct">正解</Label>
                        {formData.answerMethod === 'checkbox' ? (
                          <div className="flex flex-wrap gap-4">
                            {(['A', 'B', 'C', 'D'] as const).map((c) => {
                              const id = `correct-${c.toLowerCase()}`;
                              const checked = parseCorrectAnswerList(formData.correctAnswer).includes(c);
                              return (
                                <Label key={c} htmlFor={id} className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    id={id}
                                    checked={checked}
                                    onCheckedChange={() => toggleCorrectChoice(c)}
                                  />
                                  {c}
                                </Label>
                              );
                            })}
                          </div>
                        ) : (
                          <Select
                            value={formData.correctAnswer}
                            onValueChange={(value) =>
                              setFormData({ ...formData, correctAnswer: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A">A</SelectItem>
                              <SelectItem value="B">B</SelectItem>
                              <SelectItem value="C">C</SelectItem>
                              <SelectItem value="D">D</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="answerMethod">回答方式</Label>
                        <Select
                          value={formData.answerMethod}
                          onValueChange={(value: AnswerMethod) =>
                            setFormData({
                              ...formData,
                              answerMethod: value,
                              correctAnswer:
                              value === 'radio'
                                ? (parseCorrectAnswerList(formData.correctAnswer)[0] ?? 'A')
                                : (parseCorrectAnswerList(formData.correctAnswer).join(',') || 'A'),
                          })
                        }
                      >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="checkbox">チェックボックス</SelectItem>
                            <SelectItem value="radio">ラジオ</SelectItem>
                          </SelectContent>
                      </Select>
                    </div>

                      <div className="space-y-2">
                        <Label htmlFor="explanation">解説</Label>
                        <Textarea
                          id="explanation"
                          value={formData.explanation}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              explanation: e.target.value,
                            })
                          }
                          placeholder="解説を入力"
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <Label htmlFor="active">出題対象にする</Label>
                          <p className="text-sm text-gray-500">
                            OFFの場合、この問題は出題されません
                          </p>
                        </div>
                        <Switch
                          id="active"
                          checked={formData.isActive}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, isActive: checked })
                          }
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                        >
                          キャンセル
                        </Button>
                        <Button onClick={handleSubmit}>
                          {editingQuestion ? '更新' : '作成'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
              <div className="space-y-2 w-full sm:w-64">
                <Label>単元で絞り込み</Label>
                <Select
                  value={selectedUnitId}
                  onValueChange={(value) => {
                    setSelectedUnitId(value);
                    setSelectedCategoryId('all');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全単元</SelectItem>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 w-full sm:w-72">
                <Label>カテゴリで絞り込み</Label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={(value) => setSelectedCategoryId(value)}
                  disabled={categoryOptionsForFilter.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全カテゴリ</SelectItem>
                    {categoryOptionsForFilter.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-gray-600 sm:ml-auto">
                表示: <span className="font-semibold">{filteredQuestions.length}</span> 件
                {selectedIds.length > 0 && (
                  <>
                    {' '}
                    / 選択: <span className="font-semibold">{selectedIds.length}</span> 件
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-gray-500">読み込み中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[48px]">
                      <Checkbox
                        checked={isSomeSelected ? 'indeterminate' : isAllSelected}
                        onCheckedChange={(v) => toggleSelectAll(v === true)}
                      />
                    </TableHead>
                    <TableHead>問題文</TableHead>
                    <TableHead>単元</TableHead>
                    <TableHead>カテゴリ</TableHead>
                    <TableHead>正解</TableHead>
                    <TableHead>回答方式</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuestions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(question.id)}
                          onCheckedChange={(v) => toggleSelectedId(question.id, Boolean(v))}
                        />
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal break-words">
                        <div className="space-y-1">
                          <div>{question.text}</div>
                          {question.isAssignment && (
                            <div>
                              <Badge
                                variant="outline"
                                className="bg-orange-50 text-orange-700 border-orange-200"
                              >
                                課題
                              </Badge>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getUnitNameByCategoryId(question.categoryId)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCategoryName(question.categoryId)}
                        </Badge>
                      </TableCell>
                      <TableCell>{question.correctAnswer}</TableCell>
                      <TableCell>
                        {question.answerMethod === 'radio' ? 'ラジオ' : 'チェックボックス'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={question.isActive}
                            onCheckedChange={(checked) => void toggleActive(question.id, checked)}
                          />
                          <span className="text-sm">
                            {question.isActive ? '公開中' : '非公開'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(question)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(question.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

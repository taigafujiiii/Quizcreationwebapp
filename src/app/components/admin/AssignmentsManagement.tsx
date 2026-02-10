import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Header } from '../layout/Header';
import { supabase } from '../../lib/supabase';
import { parseCsv, toCsv } from '../../lib/csv';
import { AnswerMethod, Question, Category, Unit } from '../../types';
import { ArrowLeft, Plus, Trash2, CheckCircle, Edit, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

// 単元カードコンポーネント
interface UnitCardProps {
  unitId: string;
  unitName: string;
  assignmentCount: number;
  isActive: boolean;
  onClick: () => void;
}

const UnitCard: React.FC<UnitCardProps> = ({ unitId, unitName, assignmentCount, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-2 p-4 rounded-lg border-2 transition-all min-w-[160px] hover:shadow-md',
        isActive
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300'
      )}
    >
      <div className="flex items-center justify-between w-full">
        <h3 className={cn('font-semibold text-sm', isActive ? 'text-primary' : 'text-gray-700')}>
          {unitName}
        </h3>
        {isActive && <Check className="h-4 w-4 text-primary" />}
      </div>
      <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
        {assignmentCount}問
      </Badge>
    </button>
  );
};

// カテゴリチップコンポーネント
interface CategoryChipProps {
  categoryId: string;
  categoryName: string;
  assignmentCount: number;
  isActive: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

const CategoryChip: React.FC<CategoryChipProps> = ({
  categoryId,
  categoryName,
  assignmentCount,
  isActive,
  isDisabled,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all whitespace-nowrap text-sm font-medium',
        isActive
          ? 'border-primary bg-primary text-white'
          : isDisabled
          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:shadow-sm'
      )}
    >
      <span>{categoryName}</span>
      <Badge
        variant={isActive ? 'secondary' : 'outline'}
        className={cn(
          'text-xs',
          isActive ? 'bg-white text-primary' : '',
          isDisabled ? 'opacity-50' : ''
        )}
      >
        {assignmentCount}
      </Badge>
    </button>
  );
};

export const AssignmentsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<
    Array<{
      rowNumber: number;
      unitName?: string;
      categoryName?: string;
      text: string;
      correctAnswer: 'A' | 'B' | 'C' | 'D';
      answerMethod: AnswerMethod;
      isActive: boolean;
    }>
  >([]);
  const [importPayload, setImportPayload] = useState<
    Array<{
      text: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_answer: 'A' | 'B' | 'C' | 'D';
      answer_method: AnswerMethod;
      explanation: string;
      category_id: string;
      is_active: boolean;
      is_assignment: true;
    }>
  >([]);
  const [importing, setImporting] = useState(false);
  
  // 単元フィルタ状態（'all' または 単元ID）
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  
  // カテゴリフィルタ状態（'all' または カテゴリID）
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  
  const [filterCategory, setFilterCategory] = useState('all');
  const [formData, setFormData] = useState({
    text: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A' as 'A' | 'B' | 'C' | 'D',
    answerMethod: 'checkbox' as AnswerMethod,
    explanation: '',
    unitId: '',
    categoryId: '',
    isActive: true,
  });

  const normalizeHeader = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[_-]/g, '');

  const parseActiveValue = (raw: string | undefined, rowNumber: number) => {
    const v = (raw ?? '').trim();
    if (!v) return { ok: true as const, value: true };

    const lower = v.toLowerCase();
    const truthy = new Set(['1', 'true', 't', 'yes', 'y', 'on', '公開', '公開中', 'はい', '○']);
    const falsy = new Set(['0', 'false', 'f', 'no', 'n', 'off', '非公開', 'いいえ', '×']);

    if (truthy.has(lower) || truthy.has(v)) return { ok: true as const, value: true };
    if (falsy.has(lower) || falsy.has(v)) return { ok: true as const, value: false };

    return { ok: false as const, error: `行${rowNumber}: 公開(出題対象)の値が不正です (${v})` };
  };

  const parseAnswerMethodValue = (raw: string | undefined, rowNumber: number) => {
    const v = (raw ?? '').trim();
    if (!v) return { ok: true as const, value: 'checkbox' as AnswerMethod };

    const normalized = v.toLowerCase().replace(/\s+/g, '').replace(/[_-]/g, '');
    const dropdown = new Set(['dropdown', 'select', 'pulldown', 'プルダウン']);
    const checkbox = new Set(['checkbox', 'check', 'チェックボックス']);

    if (dropdown.has(normalized) || dropdown.has(v)) return { ok: true as const, value: 'dropdown' as AnswerMethod };
    if (checkbox.has(normalized) || checkbox.has(v)) return { ok: true as const, value: 'checkbox' as AnswerMethod };

    return { ok: false as const, error: `行${rowNumber}: 回答方式は dropdown/checkbox または プルダウン/チェックボックス のいずれかにしてください (${v})` };
  };

  const resolveUnitId = (unitRaw: string | undefined) => {
    const v = (unitRaw ?? '').trim();
    if (!v) {
      return {
        ok: true as const,
        unitId: undefined as string | undefined,
        unitName: undefined as string | undefined,
      };
    }

    // Allow both UUID id and display name.
    const byId = units.find((u) => u.id === v);
    if (byId) return { ok: true as const, unitId: byId.id, unitName: byId.name };

    const byName = units.find((u) => u.name === v);
    if (byName) return { ok: true as const, unitId: byName.id, unitName: byName.name };

    return { ok: false as const, error: `単元が見つかりません (${v})` };
  };

  const resolveCategoryId = (
    categoryIdRaw: string | undefined,
    categoryRaw: string | undefined,
    unitId: string | undefined
  ) => {
    const id = (categoryIdRaw ?? '').trim();
    if (id) {
      const exists = categories.some((c) => c.id === id);
      if (!exists) return { ok: false as const, error: `カテゴリIDが見つかりません (${id})` };
      const cat = categories.find((c) => c.id === id)!;
      return { ok: true as const, categoryId: id, categoryName: cat.name };
    }

    const name = (categoryRaw ?? '').trim();
    if (!name) return { ok: false as const, error: 'カテゴリが空です' };

    if (unitId) {
      const cat = categories.find((c) => c.unitId === unitId && c.name === name);
      if (!cat) return { ok: false as const, error: `指定単元内にカテゴリが見つかりません (${name})` };
      return { ok: true as const, categoryId: cat.id, categoryName: cat.name };
    }

    const matches = categories.filter((c) => c.name === name);
    if (matches.length === 1) return { ok: true as const, categoryId: matches[0].id, categoryName: matches[0].name };
    if (matches.length === 0) return { ok: false as const, error: `カテゴリが見つかりません (${name})` };
    return { ok: false as const, error: `カテゴリ名が重複しています。単元も指定してください (${name})` };
  };

  const loadData = async () => {
    setLoading(true);
    const { data: unitData, error: unitError } = await supabase
      .from('units')
      .select('id, name, description')
      .order('created_at', { ascending: true });

    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, description, unitId:unit_id')
      .order('created_at', { ascending: true });

    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .select(
        'id, text, optionA:option_a, optionB:option_b, optionC:option_c, optionD:option_d, correctAnswer:correct_answer, answerMethod:answer_method, explanation, categoryId:category_id, isActive:is_active, isAssignment:is_assignment'
      )
      .order('created_at', { ascending: false });

    if (unitError || categoryError || questionError) {
      toast.error('データの取得に失敗しました');
      setLoading(false);
      return;
    }

    setUnits(unitData || []);
    setCategories((categoryData as Category[]) || []);
    setQuestions((questionData as Question[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  // 単元切替時のハンドラー（カテゴリをリセット）
  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
    setSelectedCategoryId('all'); // カテゴリ選択をリセット
  };

  // 各単元の課題問題数を計算
  const unitAssignmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    units.forEach((unit) => {
      const categoriesInUnit = categories
        .filter((c) => c.unitId === unit.id)
        .map((c) => c.id);
      const count = questions.filter(
        (q) => q.isAssignment && categoriesInUnit.includes(q.categoryId)
      ).length;
      counts[unit.id] = count;
    });
    return counts;
  }, [questions, categories, units]);

  // 選択中の単元に属するカテゴリの課題問題数（全体）
  const totalCategoryAssignmentCount = useMemo(() => {
    if (selectedUnitId === 'all') return 0;
    const categoriesInUnit = categories
      .filter((c) => c.unitId === selectedUnitId)
      .map((c) => c.id);
    return questions.filter(
      (q) => q.isAssignment && categoriesInUnit.includes(q.categoryId)
    ).length;
  }, [questions, selectedUnitId, categories]);

  // 選択中の単元に属するカテゴリ一覧
  const categoriesInSelectedUnit = useMemo(() => {
    if (selectedUnitId === 'all') return [];
    return categories.filter((c) => c.unitId === selectedUnitId);
  }, [selectedUnitId, categories]);

  // 各カテゴリの課題問題数を計算
  const categoryAssignmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach((category) => {
      const count = questions.filter(
        (q) => q.isAssignment && q.categoryId === category.id
      ).length;
      counts[category.id] = count;
    });
    return counts;
  }, [questions, categories]);

  // 全課題問題数
  const totalAssignmentCount = questions.filter((q) => q.isAssignment).length;

  // 課題問題を単元・カテゴリフィルタで絞り込み
  const getFilteredAssignmentQuestions = () => {
    let filtered = questions.filter((q) => q.isAssignment);
    
    if (selectedUnitId !== 'all') {
      const categoriesInUnit = categories
        .filter((c) => c.unitId === selectedUnitId)
        .map((c) => c.id);
      filtered = filtered.filter((q) => categoriesInUnit.includes(q.categoryId));
    }
    
    // カテゴリでさらに絞り込み
    if (selectedCategoryId !== 'all') {
      filtered = filtered.filter((q) => q.categoryId === selectedCategoryId);
    }
    
    return filtered;
  };

  // 既存問題（課題でない問題）を単元・カテゴリフィルタで絞り込み
  const getFilteredExistingQuestions = () => {
    let filtered = questions.filter((q) => !q.isAssignment);
    
    if (selectedUnitId !== 'all') {
      const categoriesInUnit = categories
        .filter((c) => c.unitId === selectedUnitId)
        .map((c) => c.id);
      filtered = filtered.filter((q) => categoriesInUnit.includes(q.categoryId));
    }
    
    // カテゴリでさらに絞り込み
    if (selectedCategoryId !== 'all') {
      filtered = filtered.filter((q) => q.categoryId === selectedCategoryId);
    }
    
    if (filterCategory !== 'all') {
      filtered = filtered.filter((q) => q.categoryId === filterCategory);
    }
    
    return filtered;
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || '不明';
  };

  const getUnitName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return units.find((u) => u.id === category?.unitId)?.name || '不明';
  };

  const handleAddToAssignment = async (questionId: string) => {
    const { error } = await supabase
      .from('questions')
      .update({ is_assignment: true })
      .eq('id', questionId);
    if (error) {
      toast.error('課題への追加に失敗しました');
      return;
    }

    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, isAssignment: true } : q
      )
    );
    toast.success('問題を課題に追加しました');
  };

  const handleRemoveFromAssignment = async (questionId: string) => {
    if (confirm('この問題を課題から外しますか？')) {
      const { error } = await supabase
        .from('questions')
        .update({ is_assignment: false })
        .eq('id', questionId);
      if (error) {
        toast.error('課題から外せませんでした');
        return;
      }

      setQuestions(
        questions.map((q) =>
          q.id === questionId ? { ...q, isAssignment: false } : q
        )
      );
      toast.success('問題を課題から外しました');
    }
  };

  const handleCreateAssignment = async () => {
    if (!formData.categoryId) {
      toast.error('カテゴリを選択してください');
      return;
    }
    if (!formData.text.trim()) {
      toast.error('問題文を入力してください');
      return;
    }

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
        is_assignment: true,
      })
      .select(
        'id, text, optionA:option_a, optionB:option_b, optionC:option_c, optionD:option_d, correctAnswer:correct_answer, answerMethod:answer_method, explanation, categoryId:category_id, isActive:is_active, isAssignment:is_assignment'
      )
      .single();

    if (error) {
      toast.error('課題問題の作成に失敗しました');
      return;
    }

    if (data) {
      setQuestions([data as Question, ...questions]);
    }
    setIsCreateDialogOpen(false);
    resetForm();
    toast.success('課題問題を作成しました');
  };

  const handleEditQuestion = (question: Question) => {
    const category = categories.find((c) => c.id === question.categoryId);
    const unitId = category?.unitId || '';
    
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
      unitId: unitId,
      categoryId: question.categoryId,
      isActive: question.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion) return;
    
    if (!formData.categoryId) {
      toast.error('カテゴリを選択してください');
      return;
    }
    if (!formData.text.trim()) {
      toast.error('問題文を入力してください');
      return;
    }

    const { error } = await supabase
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
      .eq('id', editingQuestion.id);

    if (error) {
      toast.error('問題を更新できませんでした');
      return;
    }

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
    };

    setQuestions(
      questions.map((q) => (q.id === editingQuestion.id ? updatedQuestion : q))
    );

    // 単元が変更されてフィルタ条件外になった場合の通知
    const newCategory = categories.find((c) => c.id === formData.categoryId);
    const newUnitId = newCategory?.unitId;
    if (selectedUnitId !== 'all' && newUnitId !== selectedUnitId) {
      toast.info('問題の単元が変更されたため、一覧から非表示になりました');
    } else {
      toast.success('問題を更新しました');
    }

    setIsEditDialogOpen(false);
    setEditingQuestion(null);
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
      unitId: '',
      categoryId: '',
      isActive: true,
    });
  };

  const resetImportState = () => {
    setImportErrors([]);
    setImportPreview([]);
    setImportPayload([]);
    setImporting(false);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const downloadImportTemplate = () => {
    const rows = [
      ['単元', 'カテゴリ', '問題文', '選択肢A', '選択肢B', '選択肢C', '選択肢D', '正解', '回答方式', '解説', '公開'],
      ['（単元名）', '（カテゴリ名）', '2+2は？', '3', '4', '5', '6', 'B', 'checkbox', '2+2=4', '1'],
    ];
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assignment_questions_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File | null) => {
    resetImportState();
    if (!file) return;

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setImportErrors(['CSVにヘッダー行とデータ行が必要です']);
      return;
    }

    const header = rows[0].map((c) => c.trim());
    const keyByHeader: Record<string, string> = {
      // unit / category
      単元: 'unit',
      unit: 'unit',
      unitid: 'unit',
      unit_id: 'unit',
      カテゴリ: 'category',
      category: 'category',
      categoryid: 'categoryId',
      category_id: 'categoryId',
      // question
      問題文: 'text',
      問題: 'text',
      text: 'text',
      question: 'text',
      // options
      選択肢a: 'optionA',
      選択肢ａ: 'optionA',
      optiona: 'optionA',
      a: 'optionA',
      選択肢b: 'optionB',
      選択肢ｂ: 'optionB',
      optionb: 'optionB',
      b: 'optionB',
      選択肢c: 'optionC',
      選択肢ｃ: 'optionC',
      optionc: 'optionC',
      c: 'optionC',
      選択肢d: 'optionD',
      選択肢ｄ: 'optionD',
      optiond: 'optionD',
      d: 'optionD',
      // answer/explanation
      正解: 'correctAnswer',
      answer: 'correctAnswer',
      correctanswer: 'correctAnswer',
      回答方式: 'answerMethod',
      方式: 'answerMethod',
      answermethod: 'answerMethod',
      answer_method: 'answerMethod',
      解説: 'explanation',
      explanation: 'explanation',
      // active
      公開: 'isActive',
      出題対象: 'isActive',
      isactive: 'isActive',
      active: 'isActive',
    };

    const colIndex: Partial<Record<string, number>> = {};
    header.forEach((h, idx) => {
      const normalized = normalizeHeader(h);
      const mapped = keyByHeader[normalized] ?? keyByHeader[h] ?? undefined;
      if (mapped && colIndex[mapped] === undefined) colIndex[mapped] = idx;
    });

    const getCell = (row: string[], key: string) => {
      const idx = colIndex[key];
      if (idx === undefined) return undefined;
      return row[idx] ?? '';
    };

    const errors: string[] = [];
    const payload: typeof importPayload = [];
    const preview: typeof importPreview = [];

    for (let i = 1; i < rows.length; i++) {
      const rowNumber = i + 1; // CSV is 1-based, header is line 1
      const row = rows[i];
      if (!row || row.every((c) => (c ?? '').trim() === '')) continue;

      const unitRaw = getCell(row, 'unit');
      const categoryRaw = getCell(row, 'category');
      const categoryIdRaw = getCell(row, 'categoryId');
      const textRaw = (getCell(row, 'text') ?? '').trim();
      const optionA = (getCell(row, 'optionA') ?? '').trim();
      const optionB = (getCell(row, 'optionB') ?? '').trim();
      const optionC = (getCell(row, 'optionC') ?? '').trim();
      const optionD = (getCell(row, 'optionD') ?? '').trim();
      const correctRaw = (getCell(row, 'correctAnswer') ?? '').trim().toUpperCase();
      const answerMethodRaw = getCell(row, 'answerMethod');
      const explanation = (getCell(row, 'explanation') ?? '').trim();
      const isActiveRaw = getCell(row, 'isActive');

      const unitResolved = resolveUnitId(unitRaw);
      if (!unitResolved.ok) {
        errors.push(`行${rowNumber}: ${unitResolved.error}`);
        continue;
      }

      // Match existing UI flow: unit + category selection. Allow omitting unit only when categoryId is provided.
      if (!(categoryIdRaw ?? '').trim() && !(unitRaw ?? '').trim()) {
        errors.push(`行${rowNumber}: 単元が空です（カテゴリIDを指定する場合は省略できます）`);
        continue;
      }

      const categoryResolved = resolveCategoryId(categoryIdRaw, categoryRaw, unitResolved.unitId);
      if (!categoryResolved.ok) {
        errors.push(`行${rowNumber}: ${categoryResolved.error}`);
        continue;
      }

      if (!textRaw) {
        errors.push(`行${rowNumber}: 問題文が空です`);
        continue;
      }
      if (!optionA || !optionB || !optionC || !optionD) {
        errors.push(`行${rowNumber}: 選択肢A-Dはすべて必須です`);
        continue;
      }
      if (!['A', 'B', 'C', 'D'].includes(correctRaw)) {
        errors.push(`行${rowNumber}: 正解はA/B/C/Dのいずれかにしてください`);
        continue;
      }

      const answerMethodParsed = parseAnswerMethodValue(answerMethodRaw, rowNumber);
      if (!answerMethodParsed.ok) {
        errors.push(answerMethodParsed.error);
        continue;
      }

      const activeParsed = parseActiveValue(isActiveRaw, rowNumber);
      if (!activeParsed.ok) {
        errors.push(activeParsed.error);
        continue;
      }

      payload.push({
        text: textRaw,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_answer: correctRaw as 'A' | 'B' | 'C' | 'D',
        answer_method: answerMethodParsed.value,
        explanation,
        category_id: categoryResolved.categoryId,
        is_active: activeParsed.value,
        is_assignment: true,
      });

      if (preview.length < 5) {
        preview.push({
          rowNumber,
          unitName: unitResolved.unitName,
          categoryName: categoryResolved.categoryName,
          text: textRaw,
          correctAnswer: correctRaw as 'A' | 'B' | 'C' | 'D',
          answerMethod: answerMethodParsed.value,
          isActive: activeParsed.value,
        });
      }
    }

    if (errors.length > 0) {
      setImportErrors(errors);
      setImportPayload([]);
      setImportPreview([]);
      return;
    }

    if (payload.length === 0) {
      setImportErrors(['取り込み可能なデータ行がありません']);
      return;
    }

    setImportErrors([]);
    setImportPayload(payload);
    setImportPreview(preview);
  };

  const handleImportSubmit = async () => {
    if (importPayload.length === 0) return;

    setImporting(true);
    const batchSize = 100;
    try {
      for (let i = 0; i < importPayload.length; i += batchSize) {
        const batch = importPayload.slice(i, i + batchSize);
        const { error } = await supabase.from('questions').insert(batch);
        if (error) {
          toast.error('CSVインポートに失敗しました');
          return;
        }
      }

      toast.success(`課題問題を${importPayload.length}件インポートしました`);
      setIsImportDialogOpen(false);
      resetImportState();
      await loadData();
    } finally {
      setImporting(false);
    }
  };

  // 単元選択に応じてカテゴリ候補を絞り込み
  const availableCategories = formData.unitId
    ? categories.filter((c) => c.unitId === formData.unitId)
    : categories;

  // カテゴリフィルタ用（既存問題から追加タブ）
  const availableCategoriesForFilter = selectedUnitId !== 'all'
    ? categories.filter((c) => c.unitId === selectedUnitId)
    : categories;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ページタイトル */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <h1 className="text-3xl font-bold">課題管理</h1>
        </div>

        {/* 単元カード絞り込みエリア */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">単元で絞り込み</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop: 折り返し表示 */}
            <div className="hidden md:flex flex-wrap gap-3">
              <UnitCard
                unitId="all"
                unitName="全単元"
                assignmentCount={totalAssignmentCount}
                isActive={selectedUnitId === 'all'}
                onClick={() => handleUnitChange('all')}
              />
              {units.map((unit) => (
                <UnitCard
                  key={unit.id}
                  unitId={unit.id}
                  unitName={unit.name}
                  assignmentCount={unitAssignmentCounts[unit.id] || 0}
                  isActive={selectedUnitId === unit.id}
                  onClick={() => handleUnitChange(unit.id)}
                />
              ))}
            </div>

            {/* Mobile: 横スクロール */}
            <ScrollArea className="md:hidden w-full whitespace-nowrap">
              <div className="flex gap-3 pb-4">
                <UnitCard
                  unitId="all"
                  unitName="全単元"
                  assignmentCount={totalAssignmentCount}
                  isActive={selectedUnitId === 'all'}
                  onClick={() => handleUnitChange('all')}
                />
                {units.map((unit) => (
                  <UnitCard
                    key={unit.id}
                    unitId={unit.id}
                    unitName={unit.name}
                    assignmentCount={unitAssignmentCounts[unit.id] || 0}
                    isActive={selectedUnitId === unit.id}
                    onClick={() => handleUnitChange(unit.id)}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>

        {/* カテゴリ絞り込みエリア（単元選択時のみ表示） */}
        {selectedUnitId !== 'all' && categoriesInSelectedUnit.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">カテゴリでさらに絞り込み</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Desktop: 折り返し表示 */}
              <div className="hidden md:flex flex-wrap gap-3">
                <CategoryChip
                  categoryId="all"
                  categoryName="全カテゴリ"
                  assignmentCount={totalCategoryAssignmentCount}
                  isActive={selectedCategoryId === 'all'}
                  isDisabled={false}
                  onClick={() => setSelectedCategoryId('all')}
                />
                {categoriesInSelectedUnit.map((category) => {
                  const count = categoryAssignmentCounts[category.id] || 0;
                  return (
                    <CategoryChip
                      key={category.id}
                      categoryId={category.id}
                      categoryName={category.name}
                      assignmentCount={count}
                      isActive={selectedCategoryId === category.id}
                      isDisabled={count === 0}
                      onClick={() => {
                        if (count > 0) {
                          setSelectedCategoryId(category.id);
                        }
                      }}
                    />
                  );
                })}
              </div>

              {/* Mobile: 横スクロール */}
              <ScrollArea className="md:hidden w-full whitespace-nowrap">
                <div className="flex gap-3 pb-4">
                  <CategoryChip
                    categoryId="all"
                    categoryName="全カテゴリ"
                    assignmentCount={totalCategoryAssignmentCount}
                    isActive={selectedCategoryId === 'all'}
                    isDisabled={false}
                    onClick={() => setSelectedCategoryId('all')}
                  />
                  {categoriesInSelectedUnit.map((category) => {
                    const count = categoryAssignmentCounts[category.id] || 0;
                    return (
                      <CategoryChip
                        key={category.id}
                        categoryId={category.id}
                        categoryName={category.name}
                        assignmentCount={count}
                        isActive={selectedCategoryId === category.id}
                        isDisabled={count === 0}
                        onClick={() => {
                          if (count > 0) {
                            setSelectedCategoryId(category.id);
                          }
                        }}
                      />
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="list" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="list">課題一覧</TabsTrigger>
            <TabsTrigger value="add">既存問題から追加</TabsTrigger>
          </TabsList>

          {/* 課題一覧タブ */}
          <TabsContent value="list" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>課題問題一覧</CardTitle>
                  <div className="flex items-center gap-2">
                    <Dialog
                      open={isImportDialogOpen}
                      onOpenChange={(open) => {
                        setIsImportDialogOpen(open);
                        if (!open) resetImportState();
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={() => {
                            resetImportState();
                          }}
                        >
                          CSVインポート
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>CSVインポートで課題問題を作成</DialogTitle>
                          <DialogDescription>
                            現行フォームと同じ項目で課題問題を一括作成します。カテゴリは「単元名 + カテゴリ名」または「カテゴリID」で指定できます。
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 pt-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" onClick={downloadImportTemplate}>
                              テンプレートをダウンロード
                            </Button>
                            <div className="text-sm text-gray-600">
                              必須: 単元, カテゴリ(またはカテゴリID), 問題文, 選択肢A-D, 正解(A/B/C/D) / 任意: 回答方式(空欄はチェックボックス)
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>CSVファイル</Label>
                            <Input
                              ref={importFileRef}
                              type="file"
                              accept=".csv,text/csv"
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                void handleImportFile(f);
                              }}
                            />
                            <p className="text-xs text-gray-500">
                              公開列は `1/0`, `true/false`, `公開/非公開` が使えます。空欄は公開扱いです。
                            </p>
                          </div>

                          {importErrors.length > 0 && (
                            <div className="border rounded-md p-3 bg-red-50">
                              <div className="font-semibold text-red-700 mb-2">エラー</div>
                              <ul className="text-sm text-red-700 list-disc pl-5 space-y-1">
                                {importErrors.slice(0, 20).map((e, idx) => (
                                  <li key={idx}>{e}</li>
                                ))}
                              </ul>
                              {importErrors.length > 20 && (
                                <div className="text-xs text-red-700 mt-2">
                                  ほか {importErrors.length - 20} 件
                                </div>
                              )}
                            </div>
                          )}

                          {importErrors.length === 0 && importPayload.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-sm text-gray-700">
                                インポート対象: <span className="font-semibold">{importPayload.length}</span> 件
                              </div>
                              {importPreview.length > 0 && (
                                <div className="overflow-x-auto border rounded-md">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>行</TableHead>
                                        <TableHead>単元</TableHead>
                                        <TableHead>カテゴリ</TableHead>
                                        <TableHead className="min-w-[200px]">問題文</TableHead>
                                        <TableHead>正解</TableHead>
                                        <TableHead>回答方式</TableHead>
                                        <TableHead>公開</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {importPreview.map((p) => (
                                        <TableRow key={p.rowNumber}>
                                          <TableCell>{p.rowNumber}</TableCell>
                                          <TableCell>{p.unitName ?? '-'}</TableCell>
                                          <TableCell>{p.categoryName ?? '-'}</TableCell>
                                          <TableCell className="max-w-md truncate">{p.text}</TableCell>
                                          <TableCell>{p.correctAnswer}</TableCell>
                                          <TableCell>{p.answerMethod === 'dropdown' ? 'プルダウン' : 'チェックボックス'}</TableCell>
                                          <TableCell>{p.isActive ? '公開' : '非公開'}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
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
                              disabled={importPayload.length === 0 || importErrors.length > 0 || importing}
                              onClick={() => void handleImportSubmit()}
                            >
                              {importing ? 'インポート中...' : 'インポート'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={resetForm}>
                        <Plus className="h-4 w-4 mr-2" />
                        課題問題を新規作成
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>新しい課題問題を作成</DialogTitle>
                        <DialogDescription>
                          課題として出題する問題を作成します
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        {/* 単元選択 */}
                        <div className="space-y-2">
                          <Label>単元</Label>
                          <Select
                            value={formData.unitId}
                            onValueChange={(value) => {
                              setFormData({ ...formData, unitId: value, categoryId: '' });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="単元を選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {units.map((unit) => (
                                <SelectItem key={unit.id} value={unit.id}>
                                  {unit.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* カテゴリ選択（単元に連動） */}
                        <div className="space-y-2">
                          <Label>カテゴリ</Label>
                          <Select
                            value={formData.categoryId}
                            onValueChange={(value) =>
                              setFormData({ ...formData, categoryId: value })
                            }
                            disabled={!formData.unitId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formData.unitId ? 'カテゴリを選択' : '先に単元を選択してください'} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCategories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>問題文</Label>
                          <Textarea
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
                            <Label>選択肢 A</Label>
                            <Input
                              value={formData.optionA}
                              onChange={(e) =>
                                setFormData({ ...formData, optionA: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>選択肢 B</Label>
                            <Input
                              value={formData.optionB}
                              onChange={(e) =>
                                setFormData({ ...formData, optionB: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>選択肢 C</Label>
                            <Input
                              value={formData.optionC}
                              onChange={(e) =>
                                setFormData({ ...formData, optionC: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>選択肢 D</Label>
                            <Input
                              value={formData.optionD}
                              onChange={(e) =>
                                setFormData({ ...formData, optionD: e.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>正解</Label>
                          <RadioGroup
                            value={formData.correctAnswer}
                            onValueChange={(value: 'A' | 'B' | 'C' | 'D') =>
                              setFormData({ ...formData, correctAnswer: value })
                            }
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="A" id="create-correct-a" />
                              <Label htmlFor="create-correct-a">A</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="B" id="create-correct-b" />
                              <Label htmlFor="create-correct-b">B</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="C" id="create-correct-c" />
                              <Label htmlFor="create-correct-c">C</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="D" id="create-correct-d" />
                              <Label htmlFor="create-correct-d">D</Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <div className="space-y-2">
                          <Label>回答方式</Label>
                          <Select
                            value={formData.answerMethod}
                            onValueChange={(value: AnswerMethod) =>
                              setFormData({ ...formData, answerMethod: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="checkbox">チェックボックス</SelectItem>
                              <SelectItem value="dropdown">プルダウン</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>解説</Label>
                          <Textarea
                            value={formData.explanation}
                            onChange={(e) =>
                              setFormData({ ...formData, explanation: e.target.value })
                            }
                            placeholder="解説を入力"
                            rows={3}
                          />
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <Label>出題対象にする</Label>
                            <p className="text-sm text-gray-500">
                              OFFの場合、この問題は出題されません
                            </p>
                          </div>
                          <Switch
                            checked={formData.isActive}
                            onCheckedChange={(checked) =>
                              setFormData({ ...formData, isActive: checked })
                            }
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setIsCreateDialogOpen(false)}
                          >
                            キャンセル
                          </Button>
                          <Button onClick={handleCreateAssignment}>作成</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {getFilteredAssignmentQuestions().length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {selectedUnitId === 'all'
                      ? '課題問題がありません。「課題問題を新規作成」または「既存問題から追加」タブから追加してください。'
                      : '選択した単元に課題問題がありません。'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>単元</TableHead>
                          <TableHead>カテゴリ</TableHead>
                          <TableHead className="min-w-[200px]">問題文</TableHead>
                          <TableHead>状態</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredAssignmentQuestions().map((question) => (
                          <TableRow key={question.id}>
                            <TableCell>
                              <Badge variant="outline">
                                {getUnitName(question.categoryId)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {getCategoryName(question.categoryId)}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md truncate">
                              {question.text}
                            </TableCell>
                            <TableCell>
                              <span className={question.isActive ? 'text-green-600' : 'text-gray-400'}>
                                {question.isActive ? '公開中' : '非公開'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditQuestion(question)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  編集
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveFromAssignment(question.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  課題から外す
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 既存問題から追加タブ */}
          <TabsContent value="add" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>既存問題を課題に追加</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>カテゴリでフィルタ</Label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="すべてのカテゴリ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべてのカテゴリ</SelectItem>
                        {availableCategoriesForFilter.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {getFilteredExistingQuestions().length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    条件に合う問題がありません
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>単元</TableHead>
                          <TableHead>カテゴリ</TableHead>
                          <TableHead className="min-w-[200px]">問題文</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredExistingQuestions().map((question) => (
                          <TableRow key={question.id}>
                            <TableCell>
                              <Badge variant="outline">
                                {getUnitName(question.categoryId)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {getCategoryName(question.categoryId)}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md truncate">
                              {question.text}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => handleAddToAssignment(question.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                課題に追加
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 編集モーダル */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>課題問題を編集</DialogTitle>
            <DialogDescription>
              課題問題の内容を編集します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* 単元選択 */}
            <div className="space-y-2">
              <Label>単元</Label>
              <Select
                value={formData.unitId}
                onValueChange={(value) => {
                  setFormData({ ...formData, unitId: value, categoryId: '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="単元を選択" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* カテゴリ選択（単元に連動） */}
            <div className="space-y-2">
              <Label>カテゴリ</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) =>
                  setFormData({ ...formData, categoryId: value })
                }
                disabled={!formData.unitId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.unitId ? 'カテゴリを選択' : '先に単元を選択してください'} />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>問題文</Label>
              <Textarea
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
                <Label>選択肢 A</Label>
                <Input
                  value={formData.optionA}
                  onChange={(e) =>
                    setFormData({ ...formData, optionA: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>選択肢 B</Label>
                <Input
                  value={formData.optionB}
                  onChange={(e) =>
                    setFormData({ ...formData, optionB: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>選択肢 C</Label>
                <Input
                  value={formData.optionC}
                  onChange={(e) =>
                    setFormData({ ...formData, optionC: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>選択肢 D</Label>
                <Input
                  value={formData.optionD}
                  onChange={(e) =>
                    setFormData({ ...formData, optionD: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>正解</Label>
              <RadioGroup
                value={formData.correctAnswer}
                onValueChange={(value: 'A' | 'B' | 'C' | 'D') =>
                  setFormData({ ...formData, correctAnswer: value })
                }
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="A" id="edit-correct-a" />
                  <Label htmlFor="edit-correct-a">A</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="B" id="edit-correct-b" />
                  <Label htmlFor="edit-correct-b">B</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="C" id="edit-correct-c" />
                  <Label htmlFor="edit-correct-c">C</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="D" id="edit-correct-d" />
                  <Label htmlFor="edit-correct-d">D</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>回答方式</Label>
              <Select
                value={formData.answerMethod}
                onValueChange={(value: AnswerMethod) =>
                  setFormData({ ...formData, answerMethod: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkbox">チェックボックス</SelectItem>
                  <SelectItem value="dropdown">プルダウン</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>解説</Label>
              <Textarea
                value={formData.explanation}
                onChange={(e) =>
                  setFormData({ ...formData, explanation: e.target.value })
                }
                placeholder="解説を入力"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>出題対象にする</Label>
                <p className="text-sm text-gray-500">
                  OFFの場合、この問題は出題されません
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingQuestion(null);
                  resetForm();
                }}
              >
                キャンセル
              </Button>
              <Button onClick={handleSaveEdit}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
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
import { mockQuestions, mockCategories, mockUnits } from '../../data/mockData';
import { Question } from '../../types';
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
  const [questions, setQuestions] = useState<Question[]>(mockQuestions);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  
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
    explanation: '',
    unitId: '',
    categoryId: '',
    isActive: true,
  });

  // 単元切替時のハンドラー（カテゴリをリセット）
  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
    setSelectedCategoryId('all'); // カテゴリ選択をリセット
  };

  // 各単元の課題問題数を計算
  const unitAssignmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    mockUnits.forEach((unit) => {
      const categoriesInUnit = mockCategories
        .filter((c) => c.unitId === unit.id)
        .map((c) => c.id);
      const count = questions.filter(
        (q) => q.isAssignment && categoriesInUnit.includes(q.categoryId)
      ).length;
      counts[unit.id] = count;
    });
    return counts;
  }, [questions]);

  // 選択中の単元に属するカテゴリの課題問題数（全体）
  const totalCategoryAssignmentCount = useMemo(() => {
    if (selectedUnitId === 'all') return 0;
    const categoriesInUnit = mockCategories
      .filter((c) => c.unitId === selectedUnitId)
      .map((c) => c.id);
    return questions.filter(
      (q) => q.isAssignment && categoriesInUnit.includes(q.categoryId)
    ).length;
  }, [questions, selectedUnitId]);

  // 選択中の単元に属するカテゴリ一覧
  const categoriesInSelectedUnit = useMemo(() => {
    if (selectedUnitId === 'all') return [];
    return mockCategories.filter((c) => c.unitId === selectedUnitId);
  }, [selectedUnitId]);

  // 各カテゴリの課題問題数を計算
  const categoryAssignmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    mockCategories.forEach((category) => {
      const count = questions.filter(
        (q) => q.isAssignment && q.categoryId === category.id
      ).length;
      counts[category.id] = count;
    });
    return counts;
  }, [questions]);

  // 全課題問題数
  const totalAssignmentCount = questions.filter((q) => q.isAssignment).length;

  // 課題問題を単元・カテゴリフィルタで絞り込み
  const getFilteredAssignmentQuestions = () => {
    let filtered = questions.filter((q) => q.isAssignment);
    
    if (selectedUnitId !== 'all') {
      const categoriesInUnit = mockCategories
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
      const categoriesInUnit = mockCategories
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
    return mockCategories.find((c) => c.id === categoryId)?.name || '不明';
  };

  const getUnitName = (categoryId: string) => {
    const category = mockCategories.find((c) => c.id === categoryId);
    return mockUnits.find((u) => u.id === category?.unitId)?.name || '不明';
  };

  const handleAddToAssignment = (questionId: string) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, isAssignment: true } : q
      )
    );
    toast.success('問題を課題に追加しました');
  };

  const handleRemoveFromAssignment = (questionId: string) => {
    if (confirm('この問題を課題から外しますか？')) {
      setQuestions(
        questions.map((q) =>
          q.id === questionId ? { ...q, isAssignment: false } : q
        )
      );
      toast.success('問題を課題から外しました');
    }
  };

  const handleCreateAssignment = () => {
    if (!formData.categoryId) {
      toast.error('カテゴリを選択してください');
      return;
    }
    if (!formData.text.trim()) {
      toast.error('問題文を入力してください');
      return;
    }

    const newQuestion: Question = {
      id: `q${questions.length + 1}`,
      text: formData.text,
      optionA: formData.optionA,
      optionB: formData.optionB,
      optionC: formData.optionC,
      optionD: formData.optionD,
      correctAnswer: formData.correctAnswer,
      explanation: formData.explanation,
      categoryId: formData.categoryId,
      isActive: formData.isActive,
      isAssignment: true,
    };
    setQuestions([...questions, newQuestion]);
    setIsCreateDialogOpen(false);
    resetForm();
    toast.success('課題問題を作成しました');
  };

  const handleEditQuestion = (question: Question) => {
    const category = mockCategories.find((c) => c.id === question.categoryId);
    const unitId = category?.unitId || '';
    
    setEditingQuestion(question);
    setFormData({
      text: question.text,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      unitId: unitId,
      categoryId: question.categoryId,
      isActive: question.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingQuestion) return;
    
    if (!formData.categoryId) {
      toast.error('カテゴリを選択してください');
      return;
    }
    if (!formData.text.trim()) {
      toast.error('問題文を入力してください');
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
      explanation: formData.explanation,
      categoryId: formData.categoryId,
      isActive: formData.isActive,
    };

    setQuestions(
      questions.map((q) => (q.id === editingQuestion.id ? updatedQuestion : q))
    );

    // 単元が変更されてフィルタ条件外になった場合の通知
    const newCategory = mockCategories.find((c) => c.id === formData.categoryId);
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
      explanation: '',
      unitId: '',
      categoryId: '',
      isActive: true,
    });
  };

  // 単元選択に応じてカテゴリ候補を絞り込み
  const availableCategories = formData.unitId
    ? mockCategories.filter((c) => c.unitId === formData.unitId)
    : mockCategories;

  // カテゴリフィルタ用（既存問題から追加タブ）
  const availableCategoriesForFilter = selectedUnitId !== 'all'
    ? mockCategories.filter((c) => c.unitId === selectedUnitId)
    : mockCategories;

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
              {mockUnits.map((unit) => (
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
                {mockUnits.map((unit) => (
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
                              {mockUnits.map((unit) => (
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
                  {mockUnits.map((unit) => (
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
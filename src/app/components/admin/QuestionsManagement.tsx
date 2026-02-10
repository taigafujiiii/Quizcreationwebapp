import React, { useEffect, useState } from 'react';
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
import { AnswerMethod, Choice, Question, Category } from '../../types';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export const QuestionsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .select(
        'id, text, optionA:option_a, optionB:option_b, optionC:option_c, optionD:option_d, correctAnswer:correct_answer, answerMethod:answer_method, explanation, categoryId:category_id, isActive:is_active, isAssignment:is_assignment'
      )
      .order('created_at', { ascending: false });

    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, description, unitId:unit_id')
      .order('created_at', { ascending: true });

    if (questionError || categoryError) {
      toast.error('データの取得に失敗しました');
      setLoading(false);
      return;
    }

    setQuestions((questionData as Question[]) || []);
    setCategories((categoryData as Category[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

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
        toast.error('問題の更新に失敗しました');
        return;
      }
      toast.success('問題を更新しました');
    } else {
      const { error } = await supabase
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
        });

      if (error) {
        toast.error('問題の作成に失敗しました');
        return;
      }
      toast.success('問題を作成しました');
    }

    setIsDialogOpen(false);
    resetForm();
    await loadData();
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

    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
      toast.error('問題の削除に失敗しました');
      return;
    }
    toast.success('問題を削除しました');
    await loadData();
  };

  const handleNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('questions')
      .update({ is_active: !current })
      .eq('id', id);

    if (error) {
      toast.error('状態の更新に失敗しました');
      return;
    }
    setQuestions(
      questions.map((q) =>
        q.id === id ? { ...q, isActive: !current } : q
      )
    );
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || '不明';
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
            <div className="flex justify-between items-center">
              <CardTitle>問題一覧</CardTitle>
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
                              value === 'dropdown'
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
                          <SelectItem value="dropdown">プルダウン</SelectItem>
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
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-gray-500">読み込み中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>問題文</TableHead>
                    <TableHead>カテゴリ</TableHead>
                    <TableHead>正解</TableHead>
                    <TableHead>回答方式</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell className="max-w-md truncate">
                        <div className="flex items-center gap-2">
                          {question.text}
                          {question.isAssignment && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              課題
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCategoryName(question.categoryId)}
                        </Badge>
                      </TableCell>
                      <TableCell>{question.correctAnswer}</TableCell>
                      <TableCell>
                        {question.answerMethod === 'dropdown' ? 'プルダウン' : 'チェックボックス'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={question.isActive}
                            onCheckedChange={() => toggleActive(question.id, question.isActive)}
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

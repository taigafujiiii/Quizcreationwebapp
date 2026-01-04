import React, { useState } from 'react';
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
import { mockQuestions, mockCategories } from '../../data/mockData';
import { Question } from '../../types';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';

export const QuestionsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>(mockQuestions);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formData, setFormData] = useState({
    text: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A' as 'A' | 'B' | 'C' | 'D',
    explanation: '',
    categoryId: '',
    isActive: true,
  });

  const handleSubmit = () => {
    if (editingQuestion) {
      setQuestions(
        questions.map((q) =>
          q.id === editingQuestion.id ? { ...q, ...formData } : q
        )
      );
    } else {
      const newQuestion: Question = {
        id: `q${questions.length + 1}`,
        ...formData,
      };
      setQuestions([...questions, newQuestion]);
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
      explanation: question.explanation,
      categoryId: question.categoryId,
      isActive: question.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('この問題を削除してもよろしいですか？')) {
      setQuestions(questions.filter((q) => q.id !== id));
    }
  };

  const handleNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const toggleActive = (id: string) => {
    setQuestions(
      questions.map((q) =>
        q.id === id ? { ...q, isActive: !q.isActive } : q
      )
    );
  };

  const getCategoryName = (categoryId: string) => {
    return mockCategories.find((c) => c.id === categoryId)?.name || '不明';
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-7xl mx-auto">
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
                          {mockCategories.map((cat) => (
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
                      <Select
                        value={formData.correctAnswer}
                        onValueChange={(value: 'A' | 'B' | 'C' | 'D') =>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>問題文</TableHead>
                  <TableHead>カテゴリ</TableHead>
                  <TableHead>正解</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell className="max-w-md truncate">
                      {question.text}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getCategoryName(question.categoryId)}
                      </Badge>
                    </TableCell>
                    <TableCell>{question.correctAnswer}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={question.isActive}
                          onCheckedChange={() => toggleActive(question.id)}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

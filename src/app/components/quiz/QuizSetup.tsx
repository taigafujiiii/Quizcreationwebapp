import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import { mockUnits, mockCategories } from '../../data/mockData';
import { QuizMode } from '../../types';
import { LogOut, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const QuizSetup: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mode, setMode] = useState<QuizMode>('unit');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState('10');

  const availableCategories = mockCategories.filter(
    (cat) => cat.unitId === selectedUnit
  );

  const handleStart = () => {
    // クイズデータを渡して遷移
    navigate('/quiz', {
      state: {
        mode,
        unitId: selectedUnit,
        categoryId: selectedCategory,
        categoryIds: selectedCategories,
        questionCount: parseInt(questionCount),
      },
    });
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const isValid = () => {
    if (mode === 'unit') return selectedUnit && questionCount;
    if (mode === 'category') return selectedCategory && questionCount;
    if (mode === 'multiple')
      return selectedCategories.length > 0 && questionCount;
    return false;
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl mb-2">クイズ学習システム</h1>
            <p className="text-gray-600">ようこそ、{user?.email} さん</p>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            ログアウト
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              クイズ条件設定
            </CardTitle>
            <CardDescription>
              出題モード、範囲、問題数を選択してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 出題モード選択 */}
            <div className="space-y-3">
              <Label>出題モード</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as QuizMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="unit" id="unit" />
                  <Label htmlFor="unit" className="cursor-pointer">
                    単元指定（単元配下のカテゴリ全体から出題）
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="category" id="category" />
                  <Label htmlFor="category" className="cursor-pointer">
                    カテゴリ指定（特定のカテゴリから出題）
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="multiple" id="multiple" />
                  <Label htmlFor="multiple" className="cursor-pointer">
                    複数カテゴリ指定（同一単元内の複数カテゴリ）
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* 単元指定モード */}
            {mode === 'unit' && (
              <div className="space-y-2">
                <Label>単元を選択</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="単元を選択してください" />
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
            )}

            {/* カテゴリ指定モード */}
            {mode === 'category' && (
              <>
                <div className="space-y-2">
                  <Label>単元を選択</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder="単元を選択してください" />
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
                {selectedUnit && (
                  <div className="space-y-2">
                    <Label>カテゴリを選択</Label>
                    <Select
                      value={selectedCategory}
                      onValueChange={setSelectedCategory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="カテゴリを選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {/* 複数カテゴリ指定モード */}
            {mode === 'multiple' && (
              <>
                <div className="space-y-2">
                  <Label>単元を選択</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder="単元を選択してください" />
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
                {selectedUnit && (
                  <div className="space-y-2">
                    <Label>カテゴリを選択（複数可）</Label>
                    <div className="border rounded-md p-4 space-y-3">
                      {availableCategories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={category.id}
                            checked={selectedCategories.includes(category.id)}
                            onCheckedChange={() => toggleCategory(category.id)}
                          />
                          <Label
                            htmlFor={category.id}
                            className="cursor-pointer"
                          >
                            {category.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 出題数選択 */}
            <div className="space-y-2">
              <Label>出題数</Label>
              <Select value={questionCount} onValueChange={setQuestionCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10問</SelectItem>
                  <SelectItem value="20">20問</SelectItem>
                  <SelectItem value="30">30問</SelectItem>
                  <SelectItem value="40">40問</SelectItem>
                  <SelectItem value="50">50問</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isValid() && (
              <Alert>
                <AlertDescription>
                  すべての条件を選択してください
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleStart}
              disabled={!isValid()}
            >
              クイズを開始
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

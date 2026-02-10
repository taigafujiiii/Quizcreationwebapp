import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import { Header } from '../layout/Header';
import { useAuth } from '../../context/AuthContext';
import { QuizMode, Unit, Category } from '../../types';
import { BookOpen, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const QuizSetup: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<QuizMode>('unit');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState('10');
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .select('id, name, description')
        .order('created_at', { ascending: true });

      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, name, description, unitId:unit_id')
        .order('created_at', { ascending: true });

      if (unitError || categoryError) {
        setError('データの取得に失敗しました');
      }

      setUnits(unitData || []);
      setCategories((categoryData as Category[]) || []);
      setLoading(false);
    };

    void load();
  }, []);

  const allowedUnits = useMemo(() => {
    if (!user) return [];

    if (user.role === 'admin') {
      return units;
    }

    const allowedUnitIds = user.allowedUnitIds || [];
    return units.filter((unit) => allowedUnitIds.includes(unit.id));
  }, [user, units]);

  const availableCategories = categories.filter(
    (cat) => cat.unitId === selectedUnit
  );

  useEffect(() => {
    setSelectedCategory('');
    setSelectedCategories([]);
  }, [selectedUnit]);

  const handleStart = () => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header courseType="free" />
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-500">
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header courseType="free" />

      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {allowedUnits.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="flex flex-col items-center justify-center py-12 px-4">
              <div className="rounded-full bg-yellow-100 p-4 mb-4">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-center">
                学習できる単元がありません
              </h3>
              <p className="text-gray-600 text-center text-sm sm:text-base max-w-md mb-6">
                学習できる単元が割り当てられていません。管理者にお問い合わせください。
              </p>
              <Button variant="outline" onClick={() => navigate('/')}
              >
                ホームに戻る
              </Button>
            </CardContent>
          </Card>
        ) : (
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

              {mode === 'unit' && (
                <div className="space-y-2">
                  <Label>単元を選択</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder="単元を選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {mode === 'category' && (
                <>
                  <div className="space-y-2">
                    <Label>単元を選択</Label>
                    <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                      <SelectTrigger>
                        <SelectValue placeholder="単元を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedUnits.map((unit) => (
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

              {mode === 'multiple' && (
                <>
                  <div className="space-y-2">
                    <Label>単元を選択</Label>
                    <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                      <SelectTrigger>
                        <SelectValue placeholder="単元を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedUnits.map((unit) => (
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
        )}
      </div>
    </div>
  );
};

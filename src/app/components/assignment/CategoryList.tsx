import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Header } from '../layout/Header';
import { Unit, Category, Question } from '../../types';
import { ArrowLeft, ArrowRight, FolderOpen, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const CategoryList: React.FC = () => {
  const navigate = useNavigate();
  const { unitId } = useParams<{ unitId: string }>();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!unitId) return;
      setLoading(true);
      setError('');

      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .select('id, name, description')
        .eq('id', unitId)
        .maybeSingle();

      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, name, description, unitId:unit_id')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: true });

      const categoryIds = (categoryData || []).map((cat) => cat.id);

      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('id, categoryId:category_id, answerMethod:answer_method, isAssignment:is_assignment, isActive:is_active')
        .in('category_id', categoryIds.length ? categoryIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('is_assignment', true)
        .eq('is_active', true);

      if (unitError || categoryError || questionError) {
        setError('データの取得に失敗しました');
      }

      setUnit(unitData || null);
      setCategories((categoryData as Category[]) || []);
      setQuestions((questionData as Question[]) || []);
      setLoading(false);
    };

    void load();
  }, [unitId]);

  const getAssignmentCount = (categoryId: string) => {
    return questions.filter(
      (q) => q.categoryId === categoryId && q.isAssignment && q.isActive
    ).length;
  };

  const handleCategoryClick = (categoryId: string) => {
    const assignmentCount = getAssignmentCount(categoryId);

    if (assignmentCount === 0) {
      alert('このカテゴリには課題がありません');
      return;
    }

    navigate('/quiz', {
      state: {
        courseType: 'assignment',
        categoryId,
        unitId,
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header courseType="assignment" />
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8 text-center text-gray-500">
          読み込み中...
        </div>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl mb-2">単元が見つかりません</h2>
              <Button onClick={() => navigate('/assignment/units')}>戻る</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header courseType="assignment" />

      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate('/assignment/units')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            単元選択に戻る
          </Button>
        </div>

        <div className="mb-6">
          <h2 className="text-lg sm:text-xl mb-2">カテゴリを選択してください</h2>
          <p className="text-gray-600 text-sm sm:text-base">
            カテゴリを選択すると、そのカテゴリの課題問題がすべて出題されます
          </p>
        </div>

        {error && (
          <Alert className="mb-4" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {categories.length === 0 ? (
          <Alert>
            <AlertDescription>
              このカテゴリには課題問題がありません
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {categories.map((category) => {
              const assignmentCount = getAssignmentCount(category.id);
              const hasAssignments = assignmentCount > 0;

              return (
                <Card
                  key={category.id}
                  className={`${
                    hasAssignments
                      ? 'cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-green-500'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                  onClick={() => hasAssignments && handleCategoryClick(category.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 sm:gap-4 flex-1">
                        <div
                          className={`p-2 sm:p-3 rounded-lg ${
                            hasAssignments
                              ? 'bg-green-50 text-green-600'
                              : 'bg-gray-50 text-gray-400'
                          }`}
                        >
                          <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base sm:text-lg mb-1">
                            {category.name}
                          </CardTitle>
                          <p className="text-sm text-gray-600 mb-3">
                            {category.description}
                          </p>
                          <div className="flex items-center gap-2">
                            {hasAssignments ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                課題 {assignmentCount} 問
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 text-gray-500">
                                課題がありません
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {hasAssignments && (
                        <div className="flex items-center gap-2 flex-shrink-0 mt-1 text-sm font-medium text-green-700">
                          <span className="hidden sm:inline">回答を始める</span>
                          <span className="sm:hidden">開始</span>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Header } from '../layout/Header';
import { mockUnits, mockCategories, mockQuestions } from '../../data/mockData';
import { ArrowLeft, ArrowRight, FolderOpen, AlertCircle } from 'lucide-react';

export const CategoryList: React.FC = () => {
  const navigate = useNavigate();
  const { unitId } = useParams<{ unitId: string }>();

  const unit = mockUnits.find((u) => u.id === unitId);
  const categories = mockCategories.filter((cat) => cat.unitId === unitId);

  // カテゴリごとの課題問題数を取得
  const getAssignmentCount = (categoryId: string) => {
    return mockQuestions.filter(
      (q) => q.categoryId === categoryId && q.isAssignment && q.isActive
    ).length;
  };

  const handleCategoryClick = (categoryId: string) => {
    const assignmentCount = getAssignmentCount(categoryId);
    
    if (assignmentCount === 0) {
      alert('このカテゴリには課題がありません');
      return;
    }

    // クイズ画面へ遷移
    navigate('/quiz', {
      state: {
        courseType: 'assignment',
        categoryId,
        unitId,
      },
    });
  };

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
      {/* ヘッダー */}
      <Header courseType="assignment" />

      {/* メインコンテンツ */}
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
                        <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
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
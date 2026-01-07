import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Header } from '../layout/Header';
import { mockUnits, mockCategories } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';

export const UnitSelect: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // 許可された単元のみフィルタリング
  const allowedUnits = React.useMemo(() => {
    if (!user) return [];
    
    // ADMINは全単元
    if (user.role === 'admin') {
      return mockUnits;
    }
    
    // USERは許可された単元のみ
    const allowedUnitIds = user.allowedUnitIds || [];
    return mockUnits.filter((unit) => allowedUnitIds.includes(unit.id));
  }, [user]);

  // 各単元のカテゴリ数をカウント
  const getUnitCategoryCount = (unitId: string) => {
    return mockCategories.filter((cat) => cat.unitId === unitId).length;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <Header courseType="assignment" />

      {/* メインコンテンツ */}
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            ホームに戻る
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl mb-2">単元を選択</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            学習したい単元を選択してください。次の画面でカテゴリを選びます。
          </p>
        </div>

        {/* 単元カード */}
        {allowedUnits.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="flex flex-col items-center justify-center py-12 px-4">
              <div className="rounded-full bg-yellow-100 p-4 mb-4">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-center">
                学習できる単元がありません
              </h3>
              <p className="text-gray-600 text-center text-sm sm:text-base max-w-md">
                学習できる単元が割り当てられていません。管理者にお問い合わせください。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {allowedUnits.map((unit) => (
              <Card
                key={unit.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-green-500"
                onClick={() => navigate(`/assignment/categories/${unit.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 sm:gap-4 flex-1">
                      <div className="p-2 sm:p-3 rounded-lg bg-green-50 text-green-600">
                        <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg sm:text-xl mb-2">
                          {unit.name}
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-base">
                          {unit.description}
                        </CardDescription>
                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                          <span>{getUnitCategoryCount(unit.id)} カテゴリ</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Header } from '../layout/Header';
import { useAuth } from '../../context/AuthContext';
import { Unit, Category } from '../../types';
import { ArrowLeft, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const UnitSelect: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const allowedUnits = React.useMemo(() => {
    if (!user) return [];

    if (user.role === 'admin') {
      return units;
    }

    const allowedUnitIds = user.allowedUnitIds || [];
    return units.filter((unit) => allowedUnitIds.includes(unit.id));
  }, [user, units]);

  const getUnitCategoryCount = (unitId: string) => {
    return categories.filter((cat) => cat.unitId === unitId).length;
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header courseType="assignment" />

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

        {error && (
          <Card className="mb-6 border-red-200">
            <CardContent className="py-4 text-sm text-red-600">
              {error}
            </CardContent>
          </Card>
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

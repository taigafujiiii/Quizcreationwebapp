import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Header } from '../layout/Header';
import { Category, Unit } from '../../types';
import { ArrowLeft, Plus, Edit, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { supabase } from '../../lib/supabase';

interface UnitCardProps {
  unitId: string;
  unitName: string;
  categoryCount: number;
  isActive: boolean;
  onClick: () => void;
}

const UnitCard: React.FC<UnitCardProps> = ({ unitId, unitName, categoryCount, isActive, onClick }) => {
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
        {categoryCount}件
      </Badge>
    </button>
  );
};

export const CategoriesManagement: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    unitId: '' 
  });
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const { data: unitData, error: unitError } = await supabase
      .from('units')
      .select('id, name, description')
      .order('created_at', { ascending: true });

    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, description, unitId:unit_id, updatedAt:updated_at')
      .order('created_at', { ascending: true });

    if (unitError || categoryError) {
      toast.error('データの取得に失敗しました');
      setLoading(false);
      return;
    }

    setUnits(unitData || []);
    setCategories((categoryData as Category[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmit = async () => {
    if (!formData.name || !formData.unitId) {
      toast.error('カテゴリ名と単元を入力してください');
      return;
    }

    if (editingCategory) {
      if (!editingCategory.updatedAt) {
        toast.error('データが古い可能性があります。再読み込みしてください');
        await loadData();
        return;
      }

      const { data, error } = await supabase
        .from('categories')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim(),
          unit_id: formData.unitId,
        })
        .eq('id', editingCategory.id)
        .eq('updated_at', editingCategory.updatedAt)
        .select('updatedAt:updated_at')
        .maybeSingle();

      if (error) {
        toast.error('カテゴリを更新できませんでした');
        return;
      }
      if (!data) {
        toast.error('他のユーザーが先に更新しました。最新の状態を読み込みます');
        await loadData();
        return;
      }
      toast.success('カテゴリを更新しました');
    } else {
      const { error } = await supabase
        .from('categories')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim(),
          unit_id: formData.unitId,
        });

      if (error) {
        toast.error('カテゴリを作成できませんでした');
        return;
      }
      toast.success('カテゴリを作成しました');
    }

    setIsDialogOpen(false);
    setFormData({ name: '', description: '', unitId: '' });
    setEditingCategory(null);
    await loadData();
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({ 
      name: category.name, 
      description: category.description,
      unitId: category.unitId 
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このカテゴリを削除してもよろしいですか？')) {
      return;
    }

    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      toast.error('カテゴリを削除できませんでした');
      return;
    }
    toast.success('カテゴリを削除しました');
    await loadData();
  };

  const handleNew = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', unitId: '' });
    setIsDialogOpen(true);
  };

  const getUnitName = (unitId: string) => {
    const unit = units.find((u) => u.id === unitId);
    return unit ? unit.name : '不明';
  };

  const filteredCategories = useMemo(() => {
    if (selectedUnitId === 'all') {
      return categories;
    }
    return categories.filter((c) => c.unitId === selectedUnitId);
  }, [categories, selectedUnitId]);

  const unitCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    units.forEach((unit) => {
      counts[unit.id] = categories.filter((c) => c.unitId === unit.id).length;
    });
    return counts;
  }, [categories, units]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <h1 className="text-2xl sm:text-3xl">カテゴリ管理</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">単元で絞り込み</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="hidden md:flex flex-wrap gap-3">
              <UnitCard
                unitId="all"
                unitName="全単元"
                categoryCount={categories.length}
                isActive={selectedUnitId === 'all'}
                onClick={() => setSelectedUnitId('all')}
              />
              {units.map((unit) => (
                <UnitCard
                  key={unit.id}
                  unitId={unit.id}
                  unitName={unit.name}
                  categoryCount={unitCategoryCounts[unit.id] || 0}
                  isActive={selectedUnitId === unit.id}
                  onClick={() => setSelectedUnitId(unit.id)}
                />
              ))}
            </div>

            <ScrollArea className="md:hidden w-full whitespace-nowrap">
              <div className="flex gap-3 pb-4">
                <UnitCard
                  unitId="all"
                  unitName="全単元"
                  categoryCount={categories.length}
                  isActive={selectedUnitId === 'all'}
                  onClick={() => setSelectedUnitId('all')}
                />
                {units.map((unit) => (
                  <UnitCard
                    key={unit.id}
                    unitId={unit.id}
                    unitName={unit.name}
                    categoryCount={unitCategoryCounts[unit.id] || 0}
                    isActive={selectedUnitId === unit.id}
                    onClick={() => setSelectedUnitId(unit.id)}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>カテゴリ一覧</CardTitle>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    新規作成
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingCategory ? 'カテゴリを編集' : '新しいカテゴリを作成'}
                    </DialogTitle>
                    <DialogDescription>
                      カテゴリの情報を入力してください
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="unitId">所属単元 *</Label>
                      <Select
                        value={formData.unitId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, unitId: value })
                        }
                      >
                        <SelectTrigger id="unitId">
                          <SelectValue placeholder="単元を選択してください" />
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
                    <div className="space-y-2">
                      <Label htmlFor="name">カテゴリ名 *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="例: 変数とデータ型"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">説明</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder="カテゴリの説明を入力してください"
                        rows={4}
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
                        {editingCategory ? '更新' : '作成'}
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>所属単元</TableHead>
                      <TableHead>カテゴリ名</TableHead>
                      <TableHead>説明</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <Badge variant="secondary">
                            {getUnitName(category.unitId)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-gray-600">
                          {category.description}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(category.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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
      </div>
    </div>
  );
};

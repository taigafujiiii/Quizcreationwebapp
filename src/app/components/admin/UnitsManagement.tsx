import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Header } from '../layout/Header';
import { Unit } from '../../types';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export const UnitsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);

  const loadUnits = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('units')
      .select('id, name, description, updatedAt:updated_at')
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('単元の取得に失敗しました');
      setLoading(false);
      return;
    }

    setUnits(data || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadUnits();
  }, []);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('単元名を入力してください');
      return;
    }

    if (editingUnit) {
      if (!editingUnit.updatedAt) {
        toast.error('データが古い可能性があります。再読み込みしてください');
        await loadUnits();
        return;
      }

      const { data, error } = await supabase
        .from('units')
        .update({ name: formData.name.trim(), description: formData.description.trim() })
        .eq('id', editingUnit.id)
        .eq('updated_at', editingUnit.updatedAt)
        .select('updatedAt:updated_at')
        .maybeSingle();

      if (error) {
        toast.error('単元の更新に失敗しました');
        return;
      }
      if (!data) {
        toast.error('他のユーザーが先に更新しました。最新の状態を読み込みます');
        await loadUnits();
        return;
      }
      toast.success('単元を更新しました');
    } else {
      const { error } = await supabase
        .from('units')
        .insert({ name: formData.name.trim(), description: formData.description.trim() });

      if (error) {
        toast.error('単元の作成に失敗しました');
        return;
      }
      toast.success('単元を作成しました');
    }

    setIsDialogOpen(false);
    setFormData({ name: '', description: '' });
    setEditingUnit(null);
    await loadUnits();
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({ name: unit.name, description: unit.description });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この単元を削除してもよろしいですか？')) {
      return;
    }

    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) {
      toast.error('単元の削除に失敗しました');
      return;
    }

    toast.success('単元を削除しました');
    await loadUnits();
  };

  const handleNew = () => {
    setEditingUnit(null);
    setFormData({ name: '', description: '' });
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <h1 className="text-3xl">単元管理</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>単元一覧</CardTitle>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    新規作成
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingUnit ? '単元を編集' : '新しい単元を作成'}
                    </DialogTitle>
                    <DialogDescription>
                      単元の名前と説明を入力してください
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">単元名</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="例: プログラミング基礎"
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
                        placeholder="単元の説明を入力してください"
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
                        {editingUnit ? '更新' : '作成'}
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
                    <TableHead>単元名</TableHead>
                    <TableHead>説明</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell>{unit.name}</TableCell>
                      <TableCell className="text-gray-600">
                        {unit.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(unit)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(unit.id)}
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

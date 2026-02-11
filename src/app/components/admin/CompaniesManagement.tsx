import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../layout/Header';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { adminApi } from '../../lib/adminApi';
import type { Company } from '../../types';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Plus, Search, Trash2 } from 'lucide-react';

export const CompaniesManagement: React.FC = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listCompanies();
      setCompanies(data);
    } catch (_error) {
      toast.error('会社一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCompanies();
  }, []);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.trim().toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, searchQuery]);

  const handleCreateCompany = async () => {
    if (creating) return;
    const n = name.trim();
    if (!n) {
      toast.error('会社名を入力してください');
      return;
    }

    setCreating(true);
    try {
      const created = await adminApi.createCompany({ name: n, description: description.trim() });
      setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('会社を登録しました');
      setIsCreateDialogOpen(false);
      setName('');
      setDescription('');
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error ? String((error as any).message) : '';
      toast.error(message || '会社登録に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    if (!confirm(`「${company.name}」を削除しますか？`)) return;
    try {
      await adminApi.deleteCompany(company.id);
      setCompanies((prev) => prev.filter((c) => c.id !== company.id));
      toast.success('会社を削除しました');
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error ? String((error as any).message) : '';
      toast.error(message || '会社の削除に失敗しました');
    }
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
          <h1 className="text-2xl sm:text-3xl flex-1">会社管理</h1>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                会社を登録
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>会社登録</DialogTitle>
                <DialogDescription>受講生に紐づける会社を登録します</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-3">
                <div className="space-y-2">
                  <Label htmlFor="company-name">会社名 *</Label>
                  <Input
                    id="company-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例: 株式会社サンプル"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-description">説明</Label>
                  <Textarea
                    id="company-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="任意"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsCreateDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button className="flex-1" onClick={handleCreateCompany} disabled={creating}>
                  {creating ? '登録中...' : '登録'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>会社一覧</CardTitle>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-10"
                placeholder="会社名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">読み込み中...</div>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>会社が登録されていません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>会社名</TableHead>
                      <TableHead>説明</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell className="text-gray-600">{company.description || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDeleteCompany(company)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            削除
                          </Button>
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


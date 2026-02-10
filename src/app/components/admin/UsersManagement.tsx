import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Header } from '../layout/Header';
import { supabase } from '../../lib/supabase';
import { adminApi } from '../../lib/adminApi';
import { User, Unit } from '../../types';
import { ArrowLeft, Search, MoreVertical, Trash2, AlertTriangle, Edit2, User as UserIcon, BookOpen, X, Mail, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

type RoleFilter = 'all' | 'admin' | 'user';

export const UsersManagement: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editAllowedUnits, setEditAllowedUnits] = useState<string[]>([]);
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  // 招待フォームの状態
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'user' | 'admin'>('user');
  const [inviteAllowedUnits, setInviteAllowedUnits] = useState<string[]>([]);
  const [inviteUnitSearchQuery, setInviteUnitSearchQuery] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const getErrorMessage = (error: unknown) => {
    if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
      const msg = (error as any).message as string;
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === 'object' && typeof parsed.error === 'string') return parsed.error;
      } catch {
        // ignore
      }
      return msg;
    }
    return '招待メールの送信に失敗しました';
  };
  
  const menuRef = useRef<HTMLDivElement>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const userData = await adminApi.listUsers();
      setUsers(userData);
    } catch (error) {
      toast.error('ユーザーの取得に失敗しました');
    }

    const { data: unitData, error: unitError } = await supabase
      .from('units')
      .select('id, name, description')
      .order('created_at', { ascending: true });

    if (unitError) {
      toast.error('単元の取得に失敗しました');
    } else {
      setUnits(unitData || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  // フィルタリングされた単元一覧（編集モーダル用）
  const filteredUnits = useMemo(() => {
    if (!unitSearchQuery) return units;
    return units.filter((unit) =>
      unit.name.toLowerCase().includes(unitSearchQuery.toLowerCase())
    );
  }, [unitSearchQuery, units]);

  // フィルタリングされた単元一覧（招待モーダル用）
  const filteredInviteUnits = useMemo(() => {
    if (!inviteUnitSearchQuery) return units;
    return units.filter((unit) =>
      unit.name.toLowerCase().includes(inviteUnitSearchQuery.toLowerCase())
    );
  }, [inviteUnitSearchQuery, units]);

  // フィルタリングされたユーザー一覧
  const filteredUsers = useMemo(() => {
    let result = users;

    // 削除済み表示の切り替え
    if (!showDeleted) {
      result = result.filter((u) => u.isActive !== false);
    }

    // ロールフィルタリング
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter);
    }

    // 検索クエリでフィルタリング
    if (searchQuery) {
      result = result.filter((u) =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    return result;
  }, [users, searchQuery, showDeleted, roleFilter]);

  // ロール別件数を計算
  const getRoleCount = (role: RoleFilter) => {
    let targetUsers = users;
    if (!showDeleted) {
      targetUsers = targetUsers.filter((u) => u.isActive !== false);
    }

    if (role === 'all') return targetUsers.length;
    return targetUsers.filter((u) => u.role === role).length;
  };

  // 学習単元数を取得
  const getAllowedUnitsCount = (user: User) => {
    if (user.role === 'admin') {
      return '全単元';
    }
    const count = user.allowedUnitIds?.length || 0;
    return `${count}単元`;
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
    setOpenMenuId(null);
  };

  const handleEditClick = (user: User) => {
    setUserToEdit(user);
    setEditUsername(user.username || '');
    setEditAllowedUnits(user.allowedUnitIds || []);
    setUnitSearchQuery('');
    setEditDialogOpen(true);
    setOpenMenuId(null);
  };

  const handleInviteClick = () => {
    setInviteEmail('');
    setInviteRole('user');
    setInviteAllowedUnits([]);
    setInviteUnitSearchQuery('');
    setInviteDialogOpen(true);
  };

  const handleToggleEditUnit = (unitId: string) => {
    if (editAllowedUnits.includes(unitId)) {
      setEditAllowedUnits(editAllowedUnits.filter((id) => id !== unitId));
    } else {
      setEditAllowedUnits([...editAllowedUnits, unitId]);
    }
  };

  const handleRemoveEditUnit = (unitId: string) => {
    setEditAllowedUnits(editAllowedUnits.filter((id) => id !== unitId));
  };

  const handleToggleInviteUnit = (unitId: string) => {
    if (inviteAllowedUnits.includes(unitId)) {
      setInviteAllowedUnits(inviteAllowedUnits.filter((id) => id !== unitId));
    } else {
      setInviteAllowedUnits([...inviteAllowedUnits, unitId]);
    }
  };

  const handleRemoveInviteUnit = (unitId: string) => {
    setInviteAllowedUnits(inviteAllowedUnits.filter((id) => id !== unitId));
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    try {
      const res = await adminApi.deactivateUser(userToDelete.id);
      if (res.action === 'deactivated') {
        setUsers((prev) =>
          prev.map((u) => (u.id === userToDelete.id ? { ...u, isActive: false } : u))
        );
        toast.success(`${userToDelete.email} を削除しました`);
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
        toast.success(`${userToDelete.email} を完全に削除しました`);
      }
    } catch (_error) {
      toast.error('ユーザーの削除に失敗しました');
      return;
    }

    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const handleSaveEdit = async () => {
    if (!userToEdit) return;

    if (!editUsername.trim()) {
      toast.error('ユーザー名を入力してください');
      return;
    }

    if (editUsername.length > 50) {
      toast.error('ユーザー名は50文字以内で入力してください');
      return;
    }

    try {
      const res = await adminApi.updateUser(userToEdit.id, {
        username: editUsername.trim(),
        allowedUnitIds: userToEdit.role === 'user' ? editAllowedUnits : [],
        updatedAt: userToEdit.updatedAt,
      });

      setUsers(
        users.map((u) =>
          u.id === userToEdit.id
            ? {
                ...u,
                username: editUsername.trim(),
                allowedUnitIds: userToEdit.role === 'user' ? editAllowedUnits : undefined,
                updatedAt: res.updatedAt ?? u.updatedAt,
              }
            : u
        )
      );

      toast.success('保存しました');
    } catch (_error) {
      toast.error('保存に失敗しました（他のユーザーが先に更新した可能性があります）');
      await loadUsers();
      return;
    }

    setEditDialogOpen(false);
    setUserToEdit(null);
    setEditUsername('');
    setEditAllowedUnits([]);
  };

  const handleSendInvite = async () => {
    if (isInviting) return;
    if (!inviteEmail.trim()) {
      toast.error('メールアドレスを入力してください');
      return;
    }

    // メールアドレス形式の簡易チェック
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      toast.error('有効なメールアドレスを入力してください');
      return;
    }

    try {
      setIsInviting(true);
      await adminApi.inviteUser({
        email: inviteEmail.trim(),
        role: inviteRole,
        allowedUnitIds: inviteRole === 'user' ? inviteAllowedUnits : [],
      });

      toast.success('招待メールを送信しました');
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('user');
      setInviteAllowedUnits([]);
      setInviteUnitSearchQuery('');
      await loadUsers();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsInviting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getRoleBadge = (role: 'user' | 'admin') => {
    if (role === 'admin') {
      return (
        <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-200">
          ADMIN
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
        USER
      </Badge>
    );
  };

  const getStatusBadge = (isActive?: boolean) => {
    if (isActive === false) {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
          削除済み
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        有効
      </Badge>
    );
  };

  const getVerifiedBadge = (verified: boolean) => {
    if (verified) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
          認証済
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
        未認証
      </Badge>
    );
  };

  const getUnitName = (unitId: string) => {
    return units.find((u) => u.id === unitId)?.name || unitId;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <h1 className="text-2xl sm:text-3xl flex-1">ユーザー管理</h1>
          <Button onClick={handleInviteClick} className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="h-4 w-4 mr-2" />
            招待
          </Button>
        </div>

        {/* ロールフィルタ */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-3 md:gap-4">
            <Card
              className={cn(
                'flex-1 min-w-[140px] cursor-pointer transition-all duration-200 border-2',
                roleFilter === 'all'
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              )}
              onClick={() => setRoleFilter('all')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">すべて</p>
                    <p className="text-2xl font-bold mt-1">{getRoleCount('all')}</p>
                  </div>
                  <UserIcon className={cn(
                    'h-8 w-8',
                    roleFilter === 'all' ? 'text-blue-600' : 'text-gray-400'
                  )} />
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'flex-1 min-w-[140px] cursor-pointer transition-all duration-200 border-2',
                roleFilter === 'admin'
                  ? 'border-purple-500 bg-purple-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              )}
              onClick={() => setRoleFilter('admin')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">ADMIN</p>
                    <p className="text-2xl font-bold mt-1">{getRoleCount('admin')}</p>
                  </div>
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 px-3 py-1">
                    ADMIN
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'flex-1 min-w-[140px] cursor-pointer transition-all duration-200 border-2',
                roleFilter === 'user'
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              )}
              onClick={() => setRoleFilter('user')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">USER</p>
                    <p className="text-2xl font-bold mt-1">{getRoleCount('user')}</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-3 py-1">
                    USER
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ユーザー一覧</CardTitle>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              {/* 検索 */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="メールアドレス・ユーザー名で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* 削除済み表示切替 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showDeleted"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="showDeleted" className="cursor-pointer select-none">
                  削除済みを含む
                </Label>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>該当するユーザーがいません</p>
              </div>
            ) : (
              <>
                {/* Desktop: テーブル表示 */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ユーザー名</TableHead>
                        <TableHead>メールアドレス</TableHead>
                        <TableHead>ロール</TableHead>
                        <TableHead>学習単元</TableHead>
                        <TableHead>メール認証</TableHead>
                        {showDeleted && <TableHead>ステータス</TableHead>}
                        <TableHead>登録日時</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow
                          key={user.id}
                          className={cn(user.isActive === false && 'opacity-60')}
                        >
                          <TableCell className="font-medium">
                            {user.username || (
                              <span className="text-gray-400 italic">未設定</span>
                            )}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                user.role === 'admin'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : (user.allowedUnitIds?.length || 0) === 0
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              )}
                            >
                              {getAllowedUnitsCount(user)}
                            </Badge>
                          </TableCell>
                          <TableCell>{getVerifiedBadge(user.verified)}</TableCell>
                          {showDeleted && <TableCell>{getStatusBadge(user.isActive)}</TableCell>}
                          <TableCell className="text-gray-600">
                            {formatDate(user.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {user.isActive !== false && (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditClick(user)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <Edit2 className="h-4 w-4 mr-1" />
                                  編集
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteClick(user)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  削除
                                </Button>
                              </div>
                            )}
                            {user.isActive === false && showDeleted && (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteClick(user)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  完全削除
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile: カード表示 */}
                <div className="md:hidden space-y-3">
                  {filteredUsers.map((user) => (
                    <Card
                      key={user.id}
                      className={cn(
                        'border',
                        user.isActive === false && 'opacity-60 bg-gray-50'
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-base mb-1">
                              {user.username || (
                                <span className="text-gray-400 italic text-sm">未設定</span>
                              )}
                            </p>
                            <p className="text-sm text-gray-600 mb-2 truncate">
                              {user.email}
                            </p>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {getRoleBadge(user.role)}
                              {getVerifiedBadge(user.verified)}
                              {showDeleted && getStatusBadge(user.isActive)}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <BookOpen className="h-3 w-3 text-gray-500" />
                              <span className="text-sm text-gray-600">
                                学習単元: {getAllowedUnitsCount(user)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              登録日: {formatDate(user.createdAt)}
                            </p>
                          </div>
                          {(user.isActive !== false || showDeleted) && (
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setOpenMenuId(openMenuId === user.id ? null : user.id)
                                }
                                className="h-8 w-8 p-0"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                              {openMenuId === user.id && (
                                <div className="absolute right-0 mt-1 w-32 bg-white border rounded-lg shadow-lg z-10" ref={menuRef}>
                                  {user.isActive !== false && (
                                    <button
                                      onClick={() => handleEditClick(user)}
                                      className="w-full px-4 py-2 text-sm text-left text-blue-600 hover:bg-blue-50 flex items-center gap-2 rounded-t-lg border-b"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                      編集
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteClick(user)}
                                    className={cn(
                                      'w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2',
                                      user.isActive !== false ? 'rounded-b-lg' : 'rounded-lg'
                                    )}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {user.isActive === false ? '完全削除' : '削除'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 編集モーダル */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ユーザー情報を編集</DialogTitle>
            <DialogDescription>
              ユーザー名と学習可能な単元を設定できます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* 読み取り専用情報 */}
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">メールアドレス</Label>
              <p className="text-sm font-medium">{userToEdit?.email}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">ロール</Label>
              <div>{userToEdit && getRoleBadge(userToEdit.role)}</div>
            </div>

            {/* 編集可能フィールド */}
            <div className="space-y-2">
              <Label htmlFor="editUsername">ユーザー名 *</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="editUsername"
                  type="text"
                  placeholder="例）山田 太郎"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="pl-10"
                  maxLength={50}
                />
              </div>
              <p className="text-xs text-gray-500">
                {editUsername.length} / 50文字
              </p>
            </div>

            {/* 学習可能単元（USERのみ） */}
            {userToEdit?.role === 'user' && (
              <div className="space-y-3">
                <Label>学習可能単元</Label>
	                <p className="text-xs text-gray-500">
	                  このユーザーが学習できる単元を選択してください
	                </p>

	                {/* 単元検索 */}
	                <div className="relative">
	                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
	                  <Input
	                    placeholder="単元を検索..."
	                    value={unitSearchQuery}
	                    onChange={(e) => setUnitSearchQuery(e.target.value)}
	                    className="pl-10"
	                  />
	                </div>

	                {/* 選択済み単元一覧（検索欄の下に表示） */}
	                {editAllowedUnits.length > 0 ? (
	                  <div className="border rounded-lg overflow-hidden">
	                    <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 font-medium">
	                      選択済み
	                    </div>
	                    <div className="max-h-32 overflow-y-auto">
	                      {editAllowedUnits.map((unitId) => (
	                        <div
	                          key={unitId}
	                          className="flex items-center justify-between gap-2 px-3 py-2 border-b last:border-b-0"
	                        >
	                          <div className="text-sm text-gray-800 truncate">
	                            {getUnitName(unitId)}
	                          </div>
	                          <Button
	                            variant="outline"
	                            size="sm"
	                            onClick={() => handleRemoveEditUnit(unitId)}
	                            className="h-8 px-2"
	                          >
	                            <X className="h-4 w-4" />
	                          </Button>
	                        </div>
	                      ))}
	                    </div>
	                  </div>
	                ) : (
	                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
	                    <p className="text-sm text-yellow-800">
	                      <AlertTriangle className="inline h-4 w-4 mr-1" />
	                      学習単元が未設定です。ユーザーは問題を学習できません。
	                    </p>
	                  </div>
	                )}

	                {/* 単元リスト（チェックボックス） */}
	                <div className="border rounded-lg max-h-64 overflow-y-auto">
	                  {filteredUnits.length === 0 ? (
	                    <div className="p-3 text-sm text-gray-500">
	                      該当する単元がありません
	                    </div>
	                  ) : (
	                    filteredUnits.map((unit) => (
	                      <div
	                        key={unit.id}
	                        className="flex items-start gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer"
	                        onClick={() => handleToggleEditUnit(unit.id)}
	                      >
	                        <input
	                          type="checkbox"
	                          checked={editAllowedUnits.includes(unit.id)}
	                          onChange={() => handleToggleEditUnit(unit.id)}
	                          className="mt-1 h-4 w-4 rounded border-gray-300"
	                        />
	                        <div className="flex-1">
	                          <p className="font-medium text-sm">{unit.name}</p>
	                          <p className="text-xs text-gray-500">{unit.description}</p>
	                        </div>
	                      </div>
	                    ))
	                  )}
	                </div>

                <p className="text-xs text-gray-500">
                  選択中: {editAllowedUnits.length} / {units.length} 単元
                </p>
              </div>
            )}

            {/* ADMINの場合 */}
            {userToEdit?.role === 'admin' && (
              <div className="space-y-2">
                <Label>学習可能単元</Label>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800 flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    全単元（固定）- 管理者は常にすべての単元を学習できます
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEditDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveEdit}
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 削除確認モーダル */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle>
                {userToDelete?.isActive === false ? 'ユーザーを完全に削除しますか？' : 'ユーザーを削除しますか？'}
              </DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              <span className="font-medium text-gray-900">{userToDelete?.email}</span>{' '}
              {userToDelete?.isActive === false ? (
                <>
                  を完全に削除します。<span className="font-medium">この操作は取り消せません</span>。
                </>
              ) : (
                <>
                  を削除すると、このユーザーは<span className="font-medium">ログインできなくなります</span>。
                  <br />
                  もう一度「削除」を実行すると、ユーザー情報が完全に削除されます。
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleConfirmDelete}
            >
              {userToDelete?.isActive === false ? '完全に削除する' : '削除する'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 招待モーダル */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ユーザーを招待</DialogTitle>
            <DialogDescription>
              新しいユーザーを招待し、ロールと学習可能な単元を設定できます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* 招待メールアドレス */}
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">メールアドレス *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="例）user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* ロール選択 */}
            <div className="space-y-2">
              <Label>ロール *</Label>
              <RadioGroup
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as 'user' | 'admin')}
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="user" id="invite-user" />
                  <Label htmlFor="invite-user" className="flex-1 cursor-pointer">
                    <div>
                      <p className="font-medium">USER</p>
                      <p className="text-xs text-gray-500">学習者として登録</p>
                    </div>
                  </Label>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">USER</Badge>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="admin" id="invite-admin" />
                  <Label htmlFor="invite-admin" className="flex-1 cursor-pointer">
                    <div>
                      <p className="font-medium">ADMIN</p>
                      <p className="text-xs text-gray-500">管理者として登録</p>
                    </div>
                  </Label>
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">ADMIN</Badge>
                </div>
              </RadioGroup>
            </div>

            {/* 学習可能単元（USERのみ） */}
            {inviteRole === 'user' && (
              <div className="space-y-3">
                <Label>学習可能単元</Label>
	                <p className="text-xs text-gray-500">
	                  このユーザーが学習できる単元を選択してください
	                </p>

	                {/* 単元検索 */}
	                <div className="relative">
	                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
	                  <Input
	                    placeholder="単元を検索..."
	                    value={inviteUnitSearchQuery}
	                    onChange={(e) => setInviteUnitSearchQuery(e.target.value)}
	                    className="pl-10"
	                  />
	                </div>

	                {/* 選択済み単元一覧（検索欄の下に表示） */}
	                {inviteAllowedUnits.length > 0 ? (
	                  <div className="border rounded-lg overflow-hidden">
	                    <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 font-medium">
	                      選択済み
	                    </div>
	                    <div className="max-h-32 overflow-y-auto">
	                      {inviteAllowedUnits.map((unitId) => (
	                        <div
	                          key={unitId}
	                          className="flex items-center justify-between gap-2 px-3 py-2 border-b last:border-b-0"
	                        >
	                          <div className="text-sm text-gray-800 truncate">
	                            {getUnitName(unitId)}
	                          </div>
	                          <Button
	                            variant="outline"
	                            size="sm"
	                            onClick={() => handleRemoveInviteUnit(unitId)}
	                            className="h-8 px-2"
	                          >
	                            <X className="h-4 w-4" />
	                          </Button>
	                        </div>
	                      ))}
	                    </div>
	                  </div>
	                ) : (
	                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
	                    <p className="text-sm text-yellow-800">
	                      <AlertTriangle className="inline h-4 w-4 mr-1" />
	                      学習単元が未設定です。ユーザーは問題を学習できません。
	                    </p>
	                  </div>
	                )}

	                {/* 単元リスト（チェックボックス） */}
	                <div className="border rounded-lg max-h-64 overflow-y-auto">
	                  {filteredInviteUnits.length === 0 ? (
	                    <div className="p-3 text-sm text-gray-500">
	                      該当する単元がありません
	                    </div>
	                  ) : (
	                    filteredInviteUnits.map((unit) => (
	                      <div
	                        key={unit.id}
	                        className="flex items-start gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer"
	                        onClick={() => handleToggleInviteUnit(unit.id)}
	                      >
	                        <input
	                          type="checkbox"
	                          checked={inviteAllowedUnits.includes(unit.id)}
	                          onChange={() => handleToggleInviteUnit(unit.id)}
	                          className="mt-1 h-4 w-4 rounded border-gray-300"
	                        />
	                        <div className="flex-1">
	                          <p className="font-medium text-sm">{unit.name}</p>
	                          <p className="text-xs text-gray-500">{unit.description}</p>
	                        </div>
	                      </div>
	                    ))
	                  )}
	                </div>

                <p className="text-xs text-gray-500">
                  選択中: {inviteAllowedUnits.length} / {units.length} 単元
                </p>
              </div>
            )}

            {/* ADMINの場合 */}
            {inviteRole === 'admin' && (
              <div className="space-y-2">
                <Label>学習可能単元</Label>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800 flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    全単元（固定）- 管理者は常にすべての単元を学習できます
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setInviteDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              className="flex-1"
              onClick={handleSendInvite}
              disabled={isInviting}
            >
              {isInviting ? '送信中...' : '招待メールを送信'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Header } from '../layout/Header';
import { BookOpen, FolderOpen, FileQuestion, Mail, ClipboardList, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const menuItems = [
    {
      title: '単元管理',
      description: '単元の作成・編集・削除',
      icon: BookOpen,
      path: '/admin/units',
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'カテゴリ管理',
      description: 'カテゴリの作成・編集・削除',
      icon: FolderOpen,
      path: '/admin/categories',
      color: 'text-green-600 bg-green-50',
    },
    {
      title: '問題管理',
      description: '問題の作成・編集・削除・公開設定',
      icon: FileQuestion,
      path: '/admin/questions',
      color: 'text-purple-600 bg-purple-50',
    },
    {
      title: '課題管理',
      description: '課題問題の作成・管理',
      icon: ClipboardList,
      path: '/admin/assignments',
      color: 'text-orange-600 bg-orange-50',
    },
    {
      title: '管理者招待',
      description: '新しい管理者を招待',
      icon: Mail,
      path: null, // モーダルを開く
      color: 'text-pink-600 bg-pink-50',
    },
    {
      title: 'ユーザー管理',
      description: 'ユーザーの作成・編集・削除',
      icon: Users,
      path: '/admin/users',
      color: 'text-gray-600 bg-gray-50',
    },
    {
      title: '会社管理',
      description: '会社の登録・削除',
      icon: Building2,
      path: '/admin/companies',
      color: 'text-cyan-600 bg-cyan-50',
    },
  ];

  const handleCardClick = (item: typeof menuItems[0]) => {
    if (item.path === null) {
      // 管理者招待の場合はモーダルを開く
      setIsInviteDialogOpen(true);
    } else {
      // その他の場合は画面遷移
      navigate(item.path);
    }
  };

  const handleSendInvite = () => {
    if (!inviteEmail) {
      toast.error('メールアドレスを入力してください');
      return;
    }

    // メールアドレスの簡易バリデーション
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast.error('有効なメールアドレスを入力してください');
      return;
    }

    // TODO: 実際の招待処理をここに実装
    toast.success(`${inviteEmail}に招待メールを送信しました`);
    setIsInviteDialogOpen(false);
    setInviteEmail('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl mb-2">管理者ダッシュボード</h1>
          <p className="text-gray-600">管理機能を選択してください</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {menuItems.map((item, index) => (
            <Card
              key={item.path || `invite-${index}`}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(item)}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${item.color}`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="mb-2">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  管理画面を開く
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 管理者招待モーダル */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>管理者招待</DialogTitle>
            <DialogDescription>新しい管理者を招待します</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
          </div>
          <Button
            className="w-full"
            onClick={handleSendInvite}
          >
            招待メールを送信
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { LogOut, BookOpen, FolderOpen, FileQuestion, Mail } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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
      title: '管理者招待',
      description: '新しい管理者を招待',
      icon: Mail,
      path: '/admin/invites',
      color: 'text-orange-600 bg-orange-50',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl mb-2">管理者ダッシュボード</h1>
            <p className="text-gray-600">ようこそ、{user?.email} さん</p>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            ログアウト
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {menuItems.map((item) => (
            <Card
              key={item.path}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(item.path)}
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
    </div>
  );
};

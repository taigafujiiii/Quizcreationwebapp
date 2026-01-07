import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Header } from '../layout/Header';
import { BookOpen, ClipboardList, ArrowRight } from 'lucide-react';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const courses = [
    {
      id: 'free',
      title: '自由演習コース',
      description: '出題モード・範囲・問題数を自由に選んで学習できます',
      icon: BookOpen,
      color: 'text-blue-600 bg-blue-50',
      path: '/quiz/setup',
    },
    {
      id: 'assignment',
      title: '課題コース',
      description: '指定されたカテゴリの課題問題に取り組みます',
      icon: ClipboardList,
      color: 'text-green-600 bg-green-50',
      path: '/assignment/units',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <Header />

      {/* メインコンテンツ */}
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl mb-2">コースを選択してください</h1>
          <p className="text-gray-600">学習スタイルに合わせたコースをお選びください</p>
        </div>

        {/* コース選択カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
              onClick={() => navigate(course.path)}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`p-3 sm:p-4 rounded-lg ${course.color}`}>
                    <course.icon className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg sm:text-xl mb-2">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                      {course.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full" size="lg">
                  選択して進む
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 説明セクション */}
        <div className="mt-8 sm:mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">コースについて</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm sm:text-base">
              <div>
                <h3 className="font-semibold mb-2">自由演習コース</h3>
                <p className="text-gray-600">
                  単元指定、カテゴリ指定、複数カテゴリ指定の3つのモードから選択できます。
                  出題数も10問〜50問まで自由に設定できます。
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">課題コース</h3>
                <p className="text-gray-600">
                  単元とカテゴリを選択すると、そのカテゴリに紐づく課題問題がすべて出題されます。
                  課題として指定された問題に集中して取り組めます。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
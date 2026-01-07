import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { LogOut, User, Settings, Home, GraduationCap } from 'lucide-react';

interface HeaderProps {
  courseType?: 'free' | 'assignment';
  isQuizAttempt?: boolean;
  onHomeClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  courseType,
  isQuizAttempt = false,
  onHomeClick,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === 'admin';
  const homeRoute = isAdmin ? '/admin' : '/';

  const handleLogoClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (onHomeClick) {
      onHomeClick();
    } else {
      navigate(homeRoute);
    }
  };

  const handleHomeClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (onHomeClick) {
      onHomeClick();
    } else {
      navigate(homeRoute);
    }
  };

  const handleLogout = () => {
    if (logout && typeof logout === 'function') {
      logout();
    }
  };

  const getCourseLabel = () => {
    if (isAdmin || !courseType) return null;
    
    return courseType === 'assignment' ? (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 ml-4">
        課題コース
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 ml-4">
        自由演習コース
      </Badge>
    );
  };

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 左側：ロゴ + ホームリンク */}
          <div className="flex items-center gap-2 sm:gap-6">
            {/* ロゴ/アプリ名 */}
            <button
              type="button"
              onClick={handleLogoClick}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <div className="bg-primary text-primary-foreground rounded-lg p-2">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <span className="hidden sm:inline text-lg font-semibold">
                クイズ学習システム
              </span>
            </button>

            {/* ホームリンク */}
            <button
              type="button"
              onClick={handleHomeClick}
              className="flex items-center gap-1.5 text-gray-700 hover:text-primary transition-colors px-2 sm:px-3 py-1.5 rounded-md hover:bg-gray-50"
            >
              <Home className="h-4 w-4" />
              <span className="text-sm font-medium">ホーム</span>
            </button>

            {/* コースラベル（ユーザーのみ） */}
            <div className="hidden md:block">
              {getCourseLabel()}
            </div>
          </div>

          {/* 右側：ユーザーメニュー */}
          <div className="flex items-center gap-4">
            {/* Mobile: コースラベル */}
            <div className="md:hidden">
              {getCourseLabel()}
            </div>

            {/* ユーザーメニュー */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-[150px] truncate">
                    {user?.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm">
                  <p className="text-xs text-gray-500">ログイン中</p>
                  <p className="font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isAdmin ? '管理者' : 'ユーザー'}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-gray-400 cursor-not-allowed">
                  <Settings className="h-4 w-4 mr-2" />
                  設定
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

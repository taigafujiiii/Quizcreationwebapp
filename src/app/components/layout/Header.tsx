import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { LogOut, User, Home, GraduationCap, Building2 } from 'lucide-react';

interface HeaderProps {
  courseType?: 'free' | 'assignment';
  onHomeClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ courseType, onHomeClick }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { selectedCompany, clearCompany } = useCompany();

  const isAdmin = user?.role === 'admin';
  const homeRoute = isAdmin ? '/admin' : '/';

  const handleLogoClick = () => {
    if (onHomeClick) onHomeClick();
    else navigate(homeRoute);
  };

  const handleHomeClick = () => {
    if (onHomeClick) onHomeClick();
    else navigate(homeRoute);
  };

  const handleChangeCompany = () => {
    clearCompany();
    navigate('/select-company');
  };

  const getCourseLabel = () => {
    if (!courseType) return null;
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
          {/* 左側 */}
          <div className="flex items-center gap-2 sm:gap-6">
            <button
              type="button"
              onClick={handleLogoClick}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <div className="bg-primary text-primary-foreground rounded-lg p-2">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <span className="hidden sm:inline text-lg font-semibold">クイズ学習システム</span>
            </button>

            <button
              type="button"
              onClick={handleHomeClick}
              className="flex items-center gap-1.5 text-gray-700 hover:text-primary transition-colors px-2 sm:px-3 py-1.5 rounded-md hover:bg-gray-50"
            >
              <Home className="h-4 w-4" />
              <span className="text-sm font-medium">ホーム</span>
            </button>

            <div className="hidden md:block">{getCourseLabel()}</div>
          </div>

          {/* 右側 */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="md:hidden">{getCourseLabel()}</div>

            {isAdmin ? (
              /* 管理者メニュー */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="text-xs sm:text-sm">
                      {(user?.username || '').trim() || user?.email || ''}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm">
                    <p className="text-xs text-gray-500">管理者</p>
                    <p className="font-medium break-all">{user?.username || user?.email}</p>
                    <p className="text-xs text-gray-500 break-all mt-0.5">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => logout()} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    ログアウト
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              /* 受講生: 会社名 + 変更ボタン */
              selectedCompany && (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600">
                    <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium">{selectedCompany.name}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleChangeCompany}
                    className="text-xs"
                  >
                    <span className="hidden sm:inline">会社を変更</span>
                    <span className="sm:hidden flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {selectedCompany.name}
                    </span>
                  </Button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

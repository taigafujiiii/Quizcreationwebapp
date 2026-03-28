import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider, useCompany } from './context/CompanyContext';
import { Login } from './components/auth/Login';
import { Forgot } from './components/auth/Forgot';
import { SelectCompany } from './components/auth/SelectCompany';
import { Home } from './components/user/Home';
import { QuizSetup } from './components/quiz/QuizSetup';
import { Quiz } from './components/quiz/Quiz';
import { Result } from './components/quiz/Result';
import { UnitSelect } from './components/assignment/UnitSelect';
import { CategoryList } from './components/assignment/CategoryList';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UnitsManagement } from './components/admin/UnitsManagement';
import { CategoriesManagement } from './components/admin/CategoriesManagement';
import { QuestionsManagement } from './components/admin/QuestionsManagement';
import { AssignmentsManagement } from './components/admin/AssignmentsManagement';
import { UsersManagement } from './components/admin/UsersManagement';
import { CompaniesManagement } from './components/admin/CompaniesManagement';
import { Toaster } from './components/ui/sonner';

// 管理者専用ルートのラッパー
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  return <>{children}</>;
};

// 受講生ルートのラッパー（ログイン不要・会社選択必須）
const StudentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { selectedCompany } = useCompany();

  // 会社未選択なら選択画面へ
  if (!selectedCompany) return <Navigate to="/select-company" replace />;

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 公開ルート */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/select-company" element={<SelectCompany />} />

      {/* 受講生ルート（ログイン不要・会社選択必須） */}
      <Route path="/" element={<StudentRoute><Home /></StudentRoute>} />
      <Route path="/quiz/setup" element={<StudentRoute><QuizSetup /></StudentRoute>} />
      <Route path="/quiz" element={<StudentRoute><Quiz /></StudentRoute>} />
      <Route path="/result" element={<StudentRoute><Result /></StudentRoute>} />
      <Route path="/assignment/units" element={<StudentRoute><UnitSelect /></StudentRoute>} />
      <Route path="/assignment/categories/:unitId" element={<StudentRoute><CategoryList /></StudentRoute>} />

      {/* 管理者ルート */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/units" element={<AdminRoute><UnitsManagement /></AdminRoute>} />
      <Route path="/admin/categories" element={<AdminRoute><CategoriesManagement /></AdminRoute>} />
      <Route path="/admin/questions" element={<AdminRoute><QuestionsManagement /></AdminRoute>} />
      <Route path="/admin/assignments" element={<AdminRoute><AssignmentsManagement /></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><UsersManagement /></AdminRoute>} />
      <Route path="/admin/companies" element={<AdminRoute><CompaniesManagement /></AdminRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <AppRoutes />
          <Toaster />
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

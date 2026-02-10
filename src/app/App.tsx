import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/auth/Login';
import { AcceptInvite } from './components/auth/AcceptInvite';
import { Verify } from './components/auth/Verify';
import { Forgot } from './components/auth/Forgot';
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
import { Toaster } from './components/ui/sonner';

// 認証が必要なルートのラッパー
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  // Session復元中に /login へ飛ばすと、毎回ログインが必要になる。
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// 管理者専用ルートのラッパー
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

// ルーティング設定
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 認証ルート */}
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/forgot" element={<Forgot />} />
      
      {/* ユーザールート（認証必要） */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quiz/setup"
        element={
          <ProtectedRoute>
            <QuizSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quiz"
        element={
          <ProtectedRoute>
            <Quiz />
          </ProtectedRoute>
        }
      />
      <Route
        path="/result"
        element={
          <ProtectedRoute>
            <Result />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assignment/units"
        element={
          <ProtectedRoute>
            <UnitSelect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assignment/categories/:unitId"
        element={
          <ProtectedRoute>
            <CategoryList />
          </ProtectedRoute>
        }
      />
      
      {/* 管理者ルート（管理者権限必要） */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/units"
        element={
          <AdminRoute>
            <UnitsManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <AdminRoute>
            <CategoriesManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/questions"
        element={
          <AdminRoute>
            <QuestionsManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/assignments"
        element={
          <AdminRoute>
            <AssignmentsManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <UsersManagement />
          </AdminRoute>
        }
      />
      
      {/* その他 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

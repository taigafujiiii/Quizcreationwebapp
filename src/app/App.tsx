import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/auth/Login';
import { Register } from './components/auth/Register';
import { Verify } from './components/auth/Verify';
import { Forgot } from './components/auth/Forgot';
import { QuizSetup } from './components/quiz/QuizSetup';
import { Quiz } from './components/quiz/Quiz';
import { Result } from './components/quiz/Result';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UnitsManagement } from './components/admin/UnitsManagement';
import { QuestionsManagement } from './components/admin/QuestionsManagement';

// 認証が必要なルートのラッパー
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// 管理者専用ルートのラッパー
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
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
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/forgot" element={<Forgot />} />
      
      {/* ユーザールート（認証必要） */}
      <Route
        path="/"
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
        path="/admin/questions"
        element={
          <AdminRoute>
            <QuestionsManagement />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider, useCompany } from './context/CompanyContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Login } from './components/auth/Login';
import { Forgot } from './components/auth/Forgot';
import { SelectCompany } from './components/auth/SelectCompany';
import { Toaster } from './components/ui/sonner';

// 受講生系ルート（ルート単位で lazy 化。名前付き export を default へマップ）
const Home = React.lazy(() =>
  import('./components/user/Home').then((m) => ({ default: m.Home }))
);
const QuizSetup = React.lazy(() =>
  import('./components/quiz/QuizSetup').then((m) => ({ default: m.QuizSetup }))
);
const Quiz = React.lazy(() =>
  import('./components/quiz/Quiz').then((m) => ({ default: m.Quiz }))
);
const Result = React.lazy(() =>
  import('./components/quiz/Result').then((m) => ({ default: m.Result }))
);
const UnitSelect = React.lazy(() =>
  import('./components/assignment/UnitSelect').then((m) => ({
    default: m.UnitSelect,
  }))
);
const CategoryList = React.lazy(() =>
  import('./components/assignment/CategoryList').then((m) => ({
    default: m.CategoryList,
  }))
);

// 管理系ルート（ルート単位で lazy 化。名前付き export を default へマップ）
const AdminDashboard = React.lazy(() =>
  import('./components/admin/AdminDashboard').then((m) => ({
    default: m.AdminDashboard,
  }))
);
const UnitsManagement = React.lazy(() =>
  import('./components/admin/UnitsManagement').then((m) => ({
    default: m.UnitsManagement,
  }))
);
const CategoriesManagement = React.lazy(() =>
  import('./components/admin/CategoriesManagement').then((m) => ({
    default: m.CategoriesManagement,
  }))
);
const QuestionsManagement = React.lazy(() =>
  import('./components/admin/QuestionsManagement').then((m) => ({
    default: m.QuestionsManagement,
  }))
);
const AssignmentsManagement = React.lazy(() =>
  import('./components/admin/AssignmentsManagement').then((m) => ({
    default: m.AssignmentsManagement,
  }))
);
const UsersManagement = React.lazy(() =>
  import('./components/admin/UsersManagement').then((m) => ({
    default: m.UsersManagement,
  }))
);
const CompaniesManagement = React.lazy(() =>
  import('./components/admin/CompaniesManagement').then((m) => ({
    default: m.CompaniesManagement,
  }))
);

// 遅延ロード中の共通フォールバック UI（AdminRoute のローディングパターンに合わせる）
const RouteFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-gray-500">読み込み中...</div>
  </div>
);

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
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
            <AppRoutes />
            <Toaster />
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

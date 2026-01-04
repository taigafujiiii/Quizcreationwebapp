import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // モックユーザー（実際にはSupabaseから取得）
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    // モックログイン処理
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // 簡易的な管理者判定
    const isAdmin = email.includes('admin');
    
    setUser({
      id: '1',
      email,
      role: isAdmin ? 'admin' : 'user',
      verified: true,
    });
  };

  const logout = () => {
    setUser(null);
  };

  const register = async (email: string, password: string) => {
    // モック登録処理
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

import { supabase, getFunctionsBaseUrl } from './supabase';
import type { User } from '../types';

const functionsBaseUrl = getFunctionsBaseUrl();
const adminFunctionName = (import.meta.env.VITE_SUPABASE_ADMIN_FUNCTION || 'server').trim();
const adminFunctionBasePath = adminFunctionName ? `/${adminFunctionName}` : '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const adminFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('認証情報がありません。再ログインしてください。');
  }

  const requestInit: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  };

  const res = await fetch(`${functionsBaseUrl}${adminFunctionBasePath}${path}`, requestInit);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
};

export const adminApi = {
  listUsers: async () => {
    return adminFetch<User[]>('/admin/users', { method: 'GET' });
  },
  inviteUser: async (payload: {
    email: string;
    role: 'user' | 'admin';
    allowedUnitIds?: string[];
  }) => {
    return adminFetch<{ success: true }>(
      '/admin/invite',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },
  updateUser: async (userId: string, payload: {
    username?: string;
    allowedUnitIds?: string[];
    role?: 'user' | 'admin';
    updatedAt?: string;
  }) => {
    return adminFetch<{ success: true; updatedAt?: string | null }>(
      `/admin/users/${userId}`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    );
  },
  deactivateUser: async (userId: string) => {
    return adminFetch<{ success: true; action: 'deactivated' | 'deleted' }>(
      `/admin/users/${userId}/deactivate`,
      { method: 'POST' }
    );
  },
};

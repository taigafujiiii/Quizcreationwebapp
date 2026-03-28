import { supabase, getFunctionsBaseUrl } from './supabase';
import type { Company, RegistrationRequest, User } from '../types';

const functionsBaseUrl = getFunctionsBaseUrl();
const adminFunctionName = (import.meta.env.VITE_SUPABASE_ADMIN_FUNCTION || 'server').trim();
const adminFunctionBasePath = adminFunctionName ? `/${adminFunctionName}` : '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const publicFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const res = await fetch(`${functionsBaseUrl}${adminFunctionBasePath}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
};

export const publicApi = {
  listCompanies: async () => {
    return publicFetch<{ id: string; name: string }[]>('/public/companies', { method: 'GET' });
  },
  getUnitCategories: async (unitId: string) => {
    return publicFetch<{
      unit: { id: string; name: string; description: string };
      categories: { id: string; name: string; description: string; unitId: string }[];
      questions: { id: string; categoryId: string }[];
    }>(`/public/unit-categories/${unitId}`, { method: 'GET' });
  },
  getQuizData: async () => {
    return publicFetch<{ units: { id: string; name: string; description: string }[]; categories: { id: string; name: string; description: string; unitId: string }[] }>('/public/quiz-data', { method: 'GET' });
  },
  verifyPin: async (payload: { pin: string }) => {
    return publicFetch<{ id: string; name: string; allowedUnitIds: string[] }>('/public/verify-pin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  submitRegistrationRequest: async (payload: {
    email: string;
    lastName: string;
    firstName: string;
    companyId: string;
  }) => {
    return publicFetch<{ success: true }>('/public/register-request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

const getAccessToken = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    const { data: refreshData } = await supabase.auth.refreshSession();
    accessToken = refreshData.session?.access_token;
  }

  return accessToken;
};

const doFetch = async <T>(path: string, options: RequestInit, accessToken: string): Promise<T> => {
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

const adminFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('認証情報がありません。再ログインしてください。');
  }

  try {
    return await doFetch<T>(path, options, accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    const unauthorized = message.includes('401') || message.toLowerCase().includes('unauthorized');
    if (!unauthorized) throw error;

    const { data: refreshed } = await supabase.auth.refreshSession();
    const retryToken = refreshed.session?.access_token;
    if (!retryToken) {
      throw new Error('セッションの有効期限が切れています。再ログインしてください。');
    }
    return doFetch<T>(path, options, retryToken);
  }
};

export const adminApi = {
  listUsers: async () => {
    return adminFetch<User[]>('/admin/users', { method: 'GET' });
  },
  inviteUser: async (payload: {
    email: string;
    role: 'user' | 'admin';
    allowedUnitIds?: string[];
    companyId?: string;
  }) => {
    return adminFetch<{ success: true }>(
      '/admin/invite',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },
  updateUser: async (userId: string, payload: {
    username?: string;
    allowedUnitIds?: string[];
    companyId?: string;
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
  listCompanies: async () => {
    return adminFetch<Company[]>('/admin/companies', { method: 'GET' });
  },
  createCompany: async (payload: { name: string; description?: string }) => {
    return adminFetch<Company>('/admin/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  deleteCompany: async (companyId: string) => {
    return adminFetch<{ success: true }>(`/admin/companies/${companyId}`, { method: 'DELETE' });
  },
  updateCompany: async (companyId: string, payload: { allowedUnitIds?: string[]; pin?: string | null }) => {
    return adminFetch<{ success: true }>(`/admin/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  listRegistrationRequests: async (status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending') => {
    return adminFetch<RegistrationRequest[]>(`/admin/registration-requests?status=${status}`, { method: 'GET' });
  },
  approveRegistrationRequest: async (requestId: string) => {
    return adminFetch<{ success: true }>(`/admin/registration-requests/${requestId}/approve`, { method: 'POST' });
  },
  rejectRegistrationRequest: async (requestId: string, notes?: string) => {
    return adminFetch<{ success: true }>(`/admin/registration-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes: notes || '' }),
    });
  },
};

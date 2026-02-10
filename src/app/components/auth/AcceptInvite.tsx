import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Mail, Lock, CheckCircle, User, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type InviteStatus = 'valid' | 'expired' | 'invalid' | 'used';

const parseHashParams = (hash: string) => {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
};

const getErrorMessage = (err: unknown) => {
  if (err && typeof err === 'object') {
    const anyErr = err as any;
    const msg = typeof anyErr.message === 'string' ? anyErr.message : '';
    const code = typeof anyErr.code === 'string' ? anyErr.code : '';
    const status = typeof anyErr.status === 'number' ? anyErr.status : undefined;
    const details = typeof anyErr.details === 'string' ? anyErr.details : '';
    const hint = typeof anyErr.hint === 'string' ? anyErr.hint : '';
    const parts = [
      msg,
      code ? `code=${code}` : '',
      typeof status === 'number' ? `status=${status}` : '',
      details ? `details=${details}` : '',
      hint ? `hint=${hint}` : '',
    ].filter(Boolean);
    if (parts.length) return parts.join(' / ');
  }
  return '登録に失敗しました';
};

const classifyAuthError = (err: unknown): InviteStatus => {
  const message = (err && typeof err === 'object' && 'message' in err) ? String((err as any).message) : '';
  const msg = message.toLowerCase();
  if (msg.includes('missing_invite_token')) return 'invalid';
  if (msg.includes('expired') || msg.includes('token has expired') || msg.includes('jwt expired')) return 'expired';
  if (msg.includes('already') && msg.includes('used')) return 'used';
  return 'invalid';
};

const establishSessionFromUrl = async (rawUrl: string) => {
  const url = new URL(rawUrl);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const hashParams = parseHashParams(url.hash);
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (!code && !(tokenHash && type) && !(accessToken && refreshToken)) {
    throw new Error('missing_invite_token');
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  // Newer email link style: token_hash + type in query params
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash: tokenHash,
    });
    if (error) throw error;
    return;
  }

  // Common invite link style: access_token + refresh_token in the URL fragment
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return;
  }

  // Fallback (kept for compatibility)
  const { error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
  if (error) throw error;
};

export const AcceptInvite: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>('valid');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [manualInviteUrl, setManualInviteUrl] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        await supabase.auth.signOut();
        await establishSessionFromUrl(window.location.href);

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          setInviteStatus('invalid');
          return;
        }

        setEmail(userData.user.email || '');
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, username')
          .eq('id', userData.user.id)
          .maybeSingle();

        if (profile?.username) {
          setUsername(profile.username);
        }
        setRole((profile?.role as 'admin' | 'user') || 'user');
        setInviteStatus('valid');

        // Remove token fragments from the address bar to reduce accidental leaks.
        try {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.hash = '';
          cleanUrl.searchParams.delete('code');
          cleanUrl.searchParams.delete('token_hash');
          cleanUrl.searchParams.delete('type');
          window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);
        } catch {
          // ignore
        }
      } catch (_err) {
        setInviteStatus(classifyAuthError(_err));
      }
    };

    void init();
  }, []);

  const handleRetryWithManualUrl = async () => {
    setError('');
    const raw = manualInviteUrl.trim();
    if (!raw) {
      setError('招待リンク(URL)を貼り付けてください');
      return;
    }
      setLoading(true);
    try {
      await supabase.auth.signOut();
      await establishSessionFromUrl(raw);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setInviteStatus('invalid');
        setError('招待リンクを読み込めませんでした。リンクが正しいか確認してください。');
        return;
      }

      setEmail(userData.user.email || '');
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (profile?.username) {
        setUsername(profile.username);
      }
      setRole((profile?.role as 'admin' | 'user') || 'user');
      setInviteStatus('valid');
    } catch (err) {
      setInviteStatus(classifyAuthError(err));
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('ユーザー名を入力してください');
      return;
    }

    if (username.length > 50) {
      setError('ユーザー名は50文字以内で入力してください');
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }

    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setError('セッションが無効です。再度招待メールからお試しください。');
        setLoading(false);
        return;
      }
      if (userError) throw userError;

      const { error: updateAuthError } = await supabase.auth.updateUser({
        password,
      });
      if (updateAuthError) {
        throw updateAuthError;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username: username.trim() })
        .eq('id', userId);

      if (profileError) {
        throw profileError;
      }

      navigate('/login', { state: { registrationComplete: true } });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (roleValue: string) => {
    if (roleValue === 'admin') {
      return (
        <Badge className="bg-purple-100 text-purple-700 border-purple-200">
          ADMIN
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200">
        USER
      </Badge>
    );
  };

  if (inviteStatus === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <Card className="w-full max-w-md border-2 border-yellow-200">
          <CardContent className="flex flex-col items-center justify-center py-12 px-4">
            <div className="rounded-full bg-yellow-100 p-4 mb-4">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-center">
              招待リンクの有効期限が切れています
            </h3>
            <p className="text-gray-600 text-center text-sm max-w-md mb-6">
              この招待リンクは有効期限が切れています。管理者に再招待を依頼してください。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteStatus === 'used' || inviteStatus === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <Card className="w-full max-w-md border-2 border-red-200">
          <CardContent className="flex flex-col items-center justify-center py-12 px-4">
            <div className="rounded-full bg-red-100 p-4 mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-center">
              この招待リンクは使用できません
            </h3>
            <p className="text-gray-600 text-center text-sm max-w-md mb-6">
              {inviteStatus === 'used'
                ? 'この招待リンクはすでに使用されています。'
                : '招待リンクが無効です。管理者にお問い合わせください。'}
            </p>
            <div className="w-full max-w-sm space-y-3">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2 text-left">
                <Label htmlFor="manualInviteUrl">招待リンク(URL)を貼り付け</Label>
                <Input
                  id="manualInviteUrl"
                  type="url"
                  placeholder="例）https://.../accept-invite#access_token=..."
                  value={manualInviteUrl}
                  onChange={(e) => setManualInviteUrl(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  メールアプリ/ブラウザによってはリンク末尾の情報(#以降)が欠けることがあります。元のURLを貼り付けてください。
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => void handleRetryWithManualUrl()}
                disabled={loading}
              >
                {loading ? '読み込み中...' : '招待リンクを読み込む'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center">アカウント登録</CardTitle>
          <CardDescription className="text-center">
            招待を受け取りました。ユーザー名とパスワードを設定してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="space-y-1">
                <Label className="text-sm text-gray-600">メールアドレス</Label>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  {email || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-gray-600">ロール</Label>
                <div>{getRoleBadge(role)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">ユーザー名</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="username"
                  type="text"
                  placeholder="例）山田 太郎"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  maxLength={50}
                  required
                />
              </div>
              <p className="text-xs text-gray-500">
                {username.length} / 50文字
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="8文字以上"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">パスワード（確認）</Label>
              <div className="relative">
                <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="もう一度入力"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登録中...' : '登録する'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

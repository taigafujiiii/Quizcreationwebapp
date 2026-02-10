import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Mail, Lock, CheckCircle } from 'lucide-react';

const REMEMBER_EMAIL_KEY = 'quizapp.rememberEmail';
const REMEMBERED_EMAIL_KEY = 'quizapp.rememberedEmail';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);

  // 既にログイン済みならログイン画面に留まらない
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    navigate(user.role === 'admin' ? '/admin' : '/', { replace: true });
  }, [user, authLoading, navigate]);

  // メールアドレス保存の復元
  useEffect(() => {
    try {
      const remember = localStorage.getItem(REMEMBER_EMAIL_KEY) === '1';
      setRememberEmail(remember);
      if (remember) {
        const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
        if (savedEmail) setEmail(savedEmail);
      }
    } catch {
      // localStorage が使えない環境でもログインはできるようにする
    }
  }, []);

  // 招待登録完了後のメッセージ表示
  useEffect(() => {
    if (location.state?.registrationComplete) {
      setSuccessMessage('登録が完了しました。ログインしてください。');
      // 5秒後にメッセージを消す
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const currentUser = await login(email, password);

      if (!currentUser) {
        setError('アカウントが有効ではありません');
        return;
      }

      try {
        localStorage.setItem(REMEMBER_EMAIL_KEY, rememberEmail ? '1' : '0');
        if (rememberEmail) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
      } catch {
        // ignore
      }

      // 管理者かユーザーかで遷移先を変更
      if (currentUser.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/'); // ユーザーはHomeに遷移
      }
    } catch (err) {
      setError('ログインに失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center">ログイン</CardTitle>
          <CardDescription className="text-center">
            クイズアプリにログインします
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert variant="success">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  // Chromeのパスワードマネージャは email より username を期待することがある
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                管理者または招待されたユーザーのメールアドレスでログインします
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="パスワード"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <Checkbox
                  checked={rememberEmail}
                  onCheckedChange={(v) => setRememberEmail(Boolean(v))}
                />
                メールアドレスを保存
              </Label>
              <Link to="/forgot" className="text-sm text-blue-600 hover:underline">
                パスワードを忘れた場合
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'ログイン中...' : 'ログイン'}
            </Button>

            <div className="text-center text-sm text-gray-600">
              このサービスは招待制です。招待メールをご確認ください。
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

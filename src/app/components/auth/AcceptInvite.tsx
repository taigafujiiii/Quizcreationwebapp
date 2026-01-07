import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Mail, Lock, CheckCircle, User, AlertCircle, Clock } from 'lucide-react';

type InviteStatus = 'valid' | 'expired' | 'invalid' | 'used';

export const AcceptInvite: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>('valid');
  
  // URLから招待情報を取得（実際にはトークンをバックエンドで検証）
  const token = searchParams.get('token');
  const email = searchParams.get('email') || 'user@example.com'; // デモ用
  const role = searchParams.get('role') || 'user'; // デモ用

  useEffect(() => {
    // トークンの検証（モック）
    if (!token) {
      setInviteStatus('invalid');
      return;
    }

    // 実際にはバックエンドでトークンを検証
    // デモでは一定の条件でステータスを設定
    if (token === 'expired') {
      setInviteStatus('expired');
    } else if (token === 'used') {
      setInviteStatus('used');
    } else if (token === 'invalid') {
      setInviteStatus('invalid');
    } else {
      setInviteStatus('valid');
    }
  }, [token]);

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
      // アカウント登録処理（モック）
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // 登録完了後、ログイン画面に遷移
      navigate('/login', { state: { registrationComplete: true } });
    } catch (err) {
      setError('登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
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

  // 期限切れ・無効な招待の場合
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
            <Button variant="outline" onClick={() => navigate('/login')}>
              ログイン画面に戻る
            </Button>
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
            <Button variant="outline" onClick={() => navigate('/login')}>
              ログイン画面に戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 有効な招待の場合
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

            {/* 読み取り専用情報 */}
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="space-y-1">
                <Label className="text-sm text-gray-600">メールアドレス</Label>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  {email}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-gray-600">ロール</Label>
                <div>{getRoleBadge(role)}</div>
              </div>
            </div>

            {/* 入力項目 */}
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

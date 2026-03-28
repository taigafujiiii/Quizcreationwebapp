import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { CheckCircle, Mail, User, Building2 } from 'lucide-react';
import { publicApi } from '../../lib/adminApi';

export const Register: React.FC = () => {
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await publicApi.listCompanies();
        setCompanies(data);
      } catch {
        setError('会社一覧の取得に失敗しました。しばらく経ってから再度お試しください。');
      } finally {
        setLoadingCompanies(false);
      }
    };
    void load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedLastName = lastName.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedLastName) { setError('姓を入力してください'); return; }
    if (!trimmedFirstName) { setError('名を入力してください'); return; }
    if (!trimmedEmail) { setError('メールアドレスを入力してください'); return; }
    if (!companyId) { setError('所属会社を選択してください'); return; }

    setLoading(true);
    try {
      await publicApi.submitRegistrationRequest({
        email: trimmedEmail,
        lastName: trimmedLastName,
        firstName: trimmedFirstName,
        companyId,
      });
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      try {
        const parsed = JSON.parse(msg);
        setError(typeof parsed?.error === 'string' ? parsed.error : msg || '申請に失敗しました');
      } catch {
        setError(msg || '申請に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <Card className="w-full max-w-md border-2 border-green-200">
          <CardContent className="flex flex-col items-center justify-center py-12 px-6">
            <div className="rounded-full bg-green-100 p-4 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-center">招待メールを送信しました</h3>
            <p className="text-gray-600 text-center text-sm max-w-sm">
              ご入力いただいたメールアドレスに招待メールをお送りしました。
              メール内のリンクからパスワードを設定してログインしてください。
            </p>
            <Link to="/login" className="mt-6 text-sm text-blue-600 hover:underline">
              ログイン画面に戻る
            </Link>
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
            必要事項を入力すると招待メールが届きます。メール内のリンクからパスワードを設定してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lastName">姓 *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="山田"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="pl-10"
                    maxLength={50}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">名 *</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="太郎"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={50}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="example@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">所属会社 *</Label>
              {loadingCompanies ? (
                <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-gray-50 text-sm text-gray-500">
                  <Building2 className="h-4 w-4" />
                  読み込み中...
                </div>
              ) : companies.length === 0 ? (
                <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-gray-50 text-sm text-gray-500">
                  <Building2 className="h-4 w-4" />
                  会社が登録されていません
                </div>
              ) : (
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger id="company">
                    <SelectValue placeholder="会社を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || loadingCompanies || companies.length === 0}
            >
              {loading ? '送信中...' : '登録する'}
            </Button>

            <p className="text-center text-sm text-gray-500">
              すでにアカウントをお持ちの方は{' '}
              <Link to="/login" className="text-blue-600 hover:underline">
                ログイン
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

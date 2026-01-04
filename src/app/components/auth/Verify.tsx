import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export const Verify: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const email = location.state?.email;

  useEffect(() => {
    // モック認証処理
    const timer = setTimeout(() => {
      setStatus('success');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">メール認証</CardTitle>
          <CardDescription className="text-center">
            {email ? `${email} に送信されたメールを確認してください` : '認証を確認しています...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === 'loading' && (
            <>
              <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
              <p className="text-gray-600">認証を確認しています...</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 text-green-500" />
              <div className="text-center space-y-2">
                <h3 className="text-xl">認証が完了しました！</h3>
                <p className="text-gray-600">
                  アカウントが有効化されました。ログインしてご利用ください。
                </p>
              </div>
              <Button onClick={() => navigate('/login')} className="w-full">
                ログインページへ
              </Button>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-red-500" />
              <div className="text-center space-y-2">
                <h3 className="text-xl">認証に失敗しました</h3>
                <p className="text-gray-600">
                  リンクが無効か、期限切れの可能性があります。
                </p>
              </div>
              <Button onClick={() => navigate('/register')} className="w-full">
                新規登録へ戻る
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

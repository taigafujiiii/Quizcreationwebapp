import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../../lib/adminApi';
import { useCompany } from '../../context/CompanyContext';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { GraduationCap, Loader2, KeyRound, User } from 'lucide-react';

export const SelectCompany: React.FC = () => {
  const navigate = useNavigate();
  const { selectCompany } = useCompany();

  const [studentName, setStudentName] = useState('');
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (verifying) return;
    const name = studentName.trim();
    const pinValue = pin.trim();

    if (!name) {
      setError('お名前を入力してください');
      return;
    }
    if (!pinValue) {
      setError('PINを入力してください');
      return;
    }

    setVerifying(true);
    setError('');
    try {
      const result = await publicApi.verifyPin({ pin: pinValue });
      selectCompany({ ...result, studentName: name });
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      try {
        const parsed = JSON.parse(msg);
        setError(parsed.error || 'PINが正しくありません');
      } catch {
        setError(msg || 'PINが正しくありません');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground rounded-lg p-3">
              <GraduationCap className="h-8 w-8" />
            </div>
            <span className="text-2xl font-semibold">クイズ学習システム</span>
          </div>
        </div>

        <h1 className="text-xl font-semibold mb-1 text-center">ログイン</h1>
        <p className="text-gray-500 text-sm text-center mb-6">
          お名前と会社のPINを入力してください
        </p>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="student-name">
              <User className="inline h-4 w-4 mr-1 text-gray-400" />
              お名前
            </Label>
            <Input
              id="student-name"
              type="text"
              value={studentName}
              onChange={(e) => { setStudentName(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
              placeholder="山田 太郎"
              maxLength={50}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin">
              <KeyRound className="inline h-4 w-4 mr-1 text-gray-400" />
              会社PIN
            </Label>
            <Input
              id="pin"
              type="text"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
              placeholder="PIN"
              className={`font-mono ${error ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
              maxLength={20}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            className="w-full"
            onClick={() => void handleSubmit()}
            disabled={!studentName.trim() || !pin.trim() || verifying}
          >
            {verifying ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />確認中...</>
            ) : (
              '開始'
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          <a href="/login" className="hover:underline">管理者の方はこちら</a>
        </p>
      </div>
    </div>
  );
};

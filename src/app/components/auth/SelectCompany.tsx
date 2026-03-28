import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../../lib/adminApi';
import { useCompany } from '../../context/CompanyContext';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { GraduationCap, Search, Building2, Loader2, ArrowLeft, KeyRound } from 'lucide-react';

type Company = { id: string; name: string };

export const SelectCompany: React.FC = () => {
  const navigate = useNavigate();
  const { selectCompany } = useCompany();

  // Step 1: 会社選択
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [search, setSearch] = useState('');

  // Step 2: PIN入力
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pinError, setPinError] = useState('');
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    publicApi
      .listCompanies()
      .then(setCompanies)
      .catch(() => {})
      .finally(() => setLoadingCompanies(false));
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      setTimeout(() => pinRef.current?.focus(), 50);
    }
  }, [selectedCompany]);

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.trim().toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    setPin('');
    setPinError('');
  };

  const handleBack = () => {
    setSelectedCompany(null);
    setPin('');
    setPinError('');
  };

  const handleVerify = async () => {
    if (!selectedCompany || !pin.trim() || verifying) return;
    setVerifying(true);
    setPinError('');
    try {
      const result = await publicApi.verifyPin({ companyId: selectedCompany.id, pin: pin.trim() });
      selectCompany(result);
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      try {
        const parsed = JSON.parse(msg);
        setPinError(parsed.error || 'PINが正しくありません');
      } catch {
        setPinError(msg || 'PINが正しくありません');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground rounded-lg p-3">
              <GraduationCap className="h-8 w-8" />
            </div>
            <span className="text-2xl font-semibold">クイズ学習システム</span>
          </div>
        </div>

        {!selectedCompany ? (
          /* Step 1: 会社選択 */
          <>
            <h1 className="text-xl font-semibold mb-1 text-center">所属会社を選択してください</h1>
            <p className="text-gray-500 text-sm text-center mb-6">
              選択後に会社専用のPINを入力します
            </p>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-10"
                placeholder="会社名で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loadingCompanies ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                {filtered.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => handleSelectCompany(company)}
                    className="w-full text-left px-4 py-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all flex items-center gap-3"
                  >
                    <Building2 className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    <span className="font-medium">{company.name}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-gray-500 py-8">該当する会社が見つかりません</p>
                )}
              </div>
            )}
          </>
        ) : (
          /* Step 2: PIN入力 */
          <>
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              会社を選び直す
            </button>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-50">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">選択中の会社</p>
                  <p className="font-semibold">{selectedCompany.name}</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  <KeyRound className="inline h-4 w-4 mr-1 text-gray-400" />
                  会社のPINを入力してください
                </label>
                <Input
                  ref={pinRef}
                  type="text"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setPinError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && void handleVerify()}
                  placeholder="PIN"
                  className={pinError ? 'border-red-400 focus-visible:ring-red-400' : ''}
                  maxLength={20}
                />
                {pinError && (
                  <p className="text-sm text-red-600">{pinError}</p>
                )}
              </div>

              <Button
                className="w-full mt-4"
                onClick={() => void handleVerify()}
                disabled={!pin.trim() || verifying}
              >
                {verifying ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />確認中...</>
                ) : (
                  '確認して開始'
                )}
              </Button>
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          <a href="/login" className="hover:underline">管理者の方はこちら</a>
        </p>
      </div>
    </div>
  );
};

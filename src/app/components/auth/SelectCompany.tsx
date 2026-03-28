import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../../lib/adminApi';
import { useCompany, SelectedCompany } from '../../context/CompanyContext';
import { Input } from '../ui/input';
import { GraduationCap, Search, Building2, Loader2 } from 'lucide-react';

export const SelectCompany: React.FC = () => {
  const navigate = useNavigate();
  const { selectCompany } = useCompany();
  const [companies, setCompanies] = useState<SelectedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    publicApi
      .listCompanies()
      .then((data) => setCompanies(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.trim().toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  const handleSelect = (company: SelectedCompany) => {
    selectCompany(company);
    navigate('/');
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

        <h1 className="text-xl font-semibold mb-1 text-center">所属会社を選択してください</h1>
        <p className="text-gray-500 text-sm text-center mb-6">
          会社によって受講できる単元が異なります
        </p>

        {/* 検索 */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-10"
            placeholder="会社名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
            {filtered.map((company) => (
              <button
                key={company.id}
                onClick={() => handleSelect(company)}
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

        <p className="text-center text-xs text-gray-400 mt-8">
          <a href="/login" className="hover:underline">管理者の方はこちら</a>
        </p>
      </div>
    </div>
  );
};

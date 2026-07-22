import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

export interface SelectedCompany {
  id: string;
  name: string;
  allowedUnitIds: string[];
  studentName: string;
}

interface CompanyContextType {
  selectedCompany: SelectedCompany | null;
  selectCompany: (company: SelectedCompany) => void;
  clearCompany: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);
const STORAGE_KEY = 'quiz_selected_company';

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
};

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCompany, setSelectedCompany] = useState<SelectedCompany | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as SelectedCompany) : null;
    } catch {
      return null;
    }
  });

  const selectCompany = useCallback((company: SelectedCompany) => {
    setSelectedCompany(company);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(company));
  }, []);

  const clearCompany = useCallback(() => {
    setSelectedCompany(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ selectedCompany, selectCompany, clearCompany }),
    [selectedCompany, selectCompany, clearCompany]
  );

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};

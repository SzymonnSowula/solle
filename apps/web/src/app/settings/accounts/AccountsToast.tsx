'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';

export function AccountsToast() {
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (success) {
      setToast({ message: decodeURIComponent(success).replace(/_/g, ' '), type: 'success' });
      window.history.replaceState({}, '', '/settings/accounts');
    } else if (error) {
      setToast({ message: decodeURIComponent(error).replace(/_/g, ' '), type: 'error' });
      window.history.replaceState({}, '', '/settings/accounts');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className={`fixed top-4 right-4 z-[200] flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg ${
      toast.type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-red-200 bg-red-50 text-red-800'
    }`}>
      {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}

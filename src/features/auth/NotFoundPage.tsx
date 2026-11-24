import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { getDashboardHomePath, useAuth } from '../../app/providers/AuthProvider';
import { Button } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Halaman Tidak Ditemukan (404)');
  const { user } = useAuth();
  const navigate = useNavigate();

  const homePath = user ? getDashboardHomePath(user.role) : '/login';

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#F6F8FB] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-[#E2E8F0] bg-white p-8 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#F2F5FA] text-[#10264D]">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-xs font-semibold text-[#8D6B22]">404 — TIDAK DITEMUKAN</p>
          <h1 className="text-xl font-bold text-[#10264D]">Halaman Tidak Ditemukan</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Alamat halaman yang Anda buka tidak tersedia atau telah dipindahkan.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Kembali
          </Button>
          <Button variant="primary" onClick={() => navigate(homePath, { replace: true })}>
            Ke Halaman Utama
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldOff } from 'lucide-react';
import {
  getDashboardHomePath,
  getRoleLabelIndonesian,
  useAuth,
} from '../../app/providers/AuthProvider';
import { Button } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function ForbiddenPage() {
  useDocumentTitle('Akses Ditolak (403)');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const homePath = user ? getDashboardHomePath(user.role) : '/login';

  const handleSwitchAccount = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#F6F8FB] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-[#E2E8F0] bg-white p-8 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#B91C1C]">
          <ShieldOff className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-xs font-semibold text-[#B91C1C]">403 — AKSES DITOLAK</p>
          <h1 className="text-xl font-bold text-[#10264D]">Anda Tidak Memiliki Izin</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Halaman atau modul ini dibatasi untuk peran pengguna tertentu. Silakan kembali ke
            dashboard sesuai hak akses Anda atau keluar untuk masuk dengan akun lain.
          </p>
          {user && (
            <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-slate-700">
              Sesi aktif saat ini: <strong className="font-mono">{user.username}</strong> (
              <strong>{getRoleLabelIndonesian(user.role)}</strong>)
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Halaman Sebelumnya
          </Button>
          <Button variant="primary" onClick={() => navigate(homePath, { replace: true })}>
            Ke Dashboard Saya
          </Button>
          {user && (
            <Button
              variant="gold"
              loading={loggingOut}
              onClick={() => void handleSwitchAccount()}
              leftIcon={<LogOut className="h-4 w-4" />}
            >
              Keluar &amp; Ganti Akun
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

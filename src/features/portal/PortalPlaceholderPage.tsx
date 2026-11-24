import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, QrCode, Volume2 } from 'lucide-react';
import { getDashboardHomePath, useAuth } from '../../app/providers/AuthProvider';
import { Button } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateLongJakarta, formatTimeWithSecondsJakarta } from '../../lib/date';

export function PortalPlaceholderPage() {
  useDocumentTitle('Portal Absensi QR');
  const { user, publicSettings } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const schoolName = publicSettings?.schoolName ?? 'MI Miftahul Ulum Sumberwuluh';
  const backTarget = user ? getDashboardHomePath(user.role) : '/login';

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#09162E] text-white flex flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-xs font-semibold text-[#E7D4A3]">Portal Absensi QR</p>
          <h1 className="text-base sm:text-lg font-bold text-white">{schoolName}</h1>
        </div>
        <Link to={backTarget}>
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            {user ? 'Kembali ke Dashboard' : 'Kembali ke Login'}
          </Button>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="space-y-1.5">
          <p className="text-sm text-[#E7D4A3]">{formatDateLongJakarta(now)}</p>
          <p className="font-mono text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
            {formatTimeWithSecondsJakarta(now)}
          </p>
        </div>

        <div className="max-w-lg w-full rounded-2xl border border-white/15 bg-[#10264D] p-8 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C69B3C]/15 text-[#E7D4A3]">
            <QrCode className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold">Layar Pemindaian QR (Persiapan Tahap 5)</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Layar Portal Absensi berdiri terpisah di luar dashboard. Pemindai kamera QR, dukungan
            scanner USB, status GPS, pengumuman suara, dan kunci keluar berpassword akan
            diaktifkan pada Tahap 5.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#C69B3C]" aria-hidden="true" />
              Validasi GPS &amp; Geofence
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-[#C69B3C]" aria-hidden="true" />
              Pengumuman Suara Kustom
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

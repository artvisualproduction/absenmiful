import { useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Button } from '../ui/Button';

/**
 * Manages safe Service Worker registration, controlled update prompts (SKIP_WAITING),
 * and a clear non-intrusive offline indicator banner.
 */
export function PWAStatusControls() {
  const isOnline = useOnlineStatus();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const registerSw = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
        }

        reg.addEventListener('updatefound', () => {
          const nextWorker = reg.installing;
          if (!nextWorker) return;
          nextWorker.addEventListener('statechange', () => {
            if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(nextWorker);
            }
          });
        });
      } catch {
        // Service worker may be blocked in restricted preview iframes; gracefully ignore
      }
    };

    void registerSw();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const handleApplyUpdate = () => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  if (isOnline && !waitingWorker) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm print:hidden">
      {!isOnline && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-xs text-[#92400E] shadow-lg"
        >
          <WifiOff className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold">Koneksi Terputus (Offline)</p>
            <p className="mt-0.5 leading-snug">
              Pencatatan absensi dan sinkronisasi data memerlukan jaringan internet aktif.
            </p>
          </div>
        </div>
      )}

      {waitingWorker && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#10264D] bg-[#10264D] px-4 py-3 text-xs text-white shadow-lg"
        >
          <div>
            <p className="font-bold text-[#E7D4A3]">Pembaruan Aplikasi Tersedia</p>
            <p className="text-slate-200 mt-0.5">Muat ulang untuk mengaktifkan versi terbaru.</p>
          </div>
          <Button
            size="sm"
            variant="gold"
            onClick={handleApplyUpdate}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Perbarui
          </Button>
        </div>
      )}
    </div>
  );
}

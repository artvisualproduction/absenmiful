import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Cloud,
  CloudOff,
  Database,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { testFrontendFirestoreConnection } from '../../lib/firebase';
import { firebaseWebConfig } from '../../lib/firebaseConfig';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

interface HealthCheckData {
  status: 'ok' | 'degraded';
  dataMode: 'mock' | 'real';
  databaseConnected: boolean;
  databaseLabel: string;
  persistent: boolean;
  latencyMs: number;
  databaseError: string | null;
}

interface ConnectivityState {
  internetOnline: boolean;
  databaseConnected: boolean;
  databaseLabel: string;
  persistent: boolean;
  latencyMs: number | null;
  databaseError: string | null;
  checking: boolean;
  lastCheckedAt: Date | null;
}

const HEALTH_POLL_INTERVAL_MS = 25_000;

export function ConnectivityStatus() {
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevOverallRef = useRef<'online' | 'offline' | null>(null);
  const checkingRef = useRef(false);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const [state, setState] = useState<ConnectivityState>(() => ({
    internetOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    databaseConnected: true,
    databaseLabel: 'Database',
    persistent: true,
    latencyMs: null,
    databaseError: null,
    checking: false,
    lastCheckedAt: null,
  }));

  const checkConnectivity = useCallback(
    async (options?: { silentToast?: boolean }) => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      setState((prev) => ({ ...prev, checking: true }));

      const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!browserOnline) {
        setState((prev) => ({
          ...prev,
          internetOnline: false,
          databaseConnected: false,
          databaseError: 'Perangkat sedang tidak terhubung ke internet.',
          checking: false,
          lastCheckedAt: new Date(),
        }));
        if (!options?.silentToast && prevOverallRef.current !== 'offline') {
          showToast({
            variant: 'error',
            title: 'Koneksi Terputus (OFFLINE)',
            message: 'Tidak ada koneksi internet. Perubahan mungkin tidak tersimpan.',
          });
        }
        prevOverallRef.current = 'offline';
        checkingRef.current = false;
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 8000);

      try {
        const [res, firestoreProbe] = await Promise.all([
          fetch('/api/health', {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include',
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          }),
          testFrontendFirestoreConnection(),
        ]);
        window.clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Server merespons status ${res.status}`);
        }

        const json = (await res.json()) as {
          success?: boolean;
          data?: Partial<HealthCheckData>;
        };
        const payload = json?.data;
        const apiDbConnected = payload?.databaseConnected ?? Boolean(json?.success);
        const dbConnected = firestoreProbe.connected || apiDbConnected;
        const isApiRealFirestore = payload?.dataMode === 'real' || payload?.persistent === true;
        const persistent = firestoreProbe.connected || isApiRealFirestore;
        const dbLabel =
          firestoreProbe.connected || isApiRealFirestore
            ? `Cloud Firestore (${firebaseWebConfig.projectId})`
            : payload?.databaseLabel ?? `Cloud Firestore (${firebaseWebConfig.projectId})`;
        const latencyMs =
          typeof payload?.latencyMs === 'number' && isApiRealFirestore
            ? payload.latencyMs
            : firestoreProbe.connected
              ? firestoreProbe.latencyMs
              : typeof payload?.latencyMs === 'number'
                ? payload.latencyMs
                : null;
        const dbError = dbConnected
          ? null
          : payload?.databaseError ?? firestoreProbe.error ?? null;

        setState({
          internetOnline: true,
          databaseConnected: dbConnected,
          databaseLabel: dbLabel,
          persistent,
          latencyMs,
          databaseError: dbError,
          checking: false,
          lastCheckedAt: new Date(),
        });

        const nextOverall: 'online' | 'offline' = dbConnected ? 'online' : 'offline';
        if (!options?.silentToast) {
          if (nextOverall === 'offline' && prevOverallRef.current !== 'offline') {
            showToast({
              variant: 'error',
              title: 'Koneksi Database Gagal',
              message: dbError || 'Cloud Firestore sedang tidak dapat dijangkau.',
            });
          } else if (nextOverall === 'online' && prevOverallRef.current === 'offline') {
            showToast({
              variant: 'success',
              title: 'Koneksi Kembali Pulih (ONLINE)',
              message: `Terhubung kembali ke internet dan ${dbLabel}.`,
            });
          }
        }
        prevOverallRef.current = nextOverall;
      } catch {
        window.clearTimeout(timeoutId);
        const stillOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
        setState((prev) => ({
          ...prev,
          internetOnline: stillOnline,
          databaseConnected: false,
          databaseError: stillOnline
            ? 'Gagal menjangkau Cloud Firestore.'
            : 'Tidak ada koneksi internet.',
          checking: false,
          lastCheckedAt: new Date(),
        }));

        if (!options?.silentToast && prevOverallRef.current !== 'offline') {
          showToast({
            variant: 'error',
            title: stillOnline ? 'Database Offline' : 'Koneksi Terputus (OFFLINE)',
            message: stillOnline
              ? 'Database tidak merespons. Periksa aturan akses Firestore atau muat ulang halaman.'
              : 'Tidak ada koneksi internet. Periksa jaringan Anda.',
          });
        }
        prevOverallRef.current = 'offline';
      } finally {
        checkingRef.current = false;
      }
    },
    [showToast],
  );

  // Initial check, online/offline browser listeners, focus listener, and heartbeat
  useEffect(() => {
    void checkConnectivity({ silentToast: true });

    const handleOnline = () => {
      void checkConnectivity();
    };
    const handleOffline = () => {
      void checkConnectivity();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkConnectivity();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = window.setInterval(() => {
      void checkConnectivity();
    }, HEALTH_POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [checkConnectivity]);

  // Click-outside & Escape auto-close for anchored popover
  useEffect(() => {
    if (!popoverOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPopoverOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [popoverOpen]);

  // Escape & body scroll lock for full-screen clear cache modal
  useEffect(() => {
    if (!clearModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !clearingCache) {
        setClearModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [clearModalOpen, clearingCache]);

  const isOverallOnline = state.internetOnline && state.databaseConnected;
  const hasPersistenceWarning = isOverallOnline && !state.persistent;

  const handleRefreshPage = () => {
    setPopoverOpen(false);
    window.location.reload();
  };

  const handleConfirmClearCache = async () => {
    setClearingCache(true);
    try {
      try {
        window.localStorage.clear();
      } catch {
        // Ignore restricted storage environments
      }
      try {
        window.sessionStorage.clear();
      } catch {
        // Ignore restricted storage environments
      }
      if ('caches' in window && typeof window.caches?.keys === 'function') {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      }
      if ('serviceWorker' in navigator && typeof navigator.serviceWorker.getRegistrations === 'function') {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
    } finally {
      window.location.reload();
    }
  };

  const lastCheckedText = state.lastCheckedAt
    ? state.lastCheckedAt.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Trigger Badge in Header/Navbar */}
        <button
          type="button"
          onClick={() => {
            const next = !popoverOpen;
            setPopoverOpen(next);
            if (next) {
              void checkConnectivity({ silentToast: true });
            }
          }}
          aria-haspopup="dialog"
          aria-expanded={popoverOpen}
          aria-label={
            isOverallOnline
              ? 'Status konektivitas ONLINE — klik untuk detail'
              : 'Status konektivitas OFFLINE — klik untuk detail'
          }
          className={cn(
            'inline-flex h-9 w-9 sm:w-auto lg:h-10 items-center justify-center gap-1.5 rounded-xl border px-0 sm:px-3 text-xs font-bold tracking-wide transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10264D] focus-visible:ring-offset-1',
            !isOverallOnline
              ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C] hover:bg-[#FEE2E2] shadow-xs'
              : hasPersistenceWarning
                ? 'border-[#FCD34D] bg-[#FFFBEB] text-[#B45309] hover:bg-[#FEF3C7]'
                : 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D] hover:bg-[#DCFCE7]',
          )}
        >
          {isOverallOnline ? (
            <Cloud
              className={cn(
                'h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0',
                hasPersistenceWarning ? 'text-[#D97706]' : 'text-[#15803D]',
              )}
              aria-hidden="true"
            />
          ) : (
            <CloudOff
              className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0 text-[#DC2626] animate-pulse"
              aria-hidden="true"
            />
          )}

          <span className="hidden sm:inline">{isOverallOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </button>

        {/* Anchored Popover Dropdown right below status badge */}
        {popoverOpen && (
          <div
            role="dialog"
            aria-label="Status Konektivitas Aplikasi"
            className="absolute right-0 top-full mt-2 z-50 w-72 sm:w-80 rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_45px_-16px_rgba(16,38,77,0.28)] overflow-hidden animate-fade-in"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between gap-2 border-b border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#10264D]">Status Konektivitas</p>
                <p className="text-[11px] text-slate-500">
                  Cek terakhir: <span className="font-mono tabular-nums">{lastCheckedText}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => void checkConnectivity()}
                disabled={state.checking}
                title="Periksa ulang status sekarang"
                aria-label="Periksa ulang status sekarang"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-slate-600 hover:bg-[#F1F5F9] hover:text-[#10264D] disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', state.checking && 'animate-spin')}
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Connection Indicators */}
            <div className="p-4 space-y-2.5">
              {/* 1. Indikator Internet */}
              <div
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                  state.internetOnline
                    ? 'border-[#BBF7D0] bg-[#F0FDF4]/70'
                    : 'border-[#FECACA] bg-[#FEF2F2]',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    state.internetOnline
                      ? 'bg-[#DCFCE7] text-[#15803D]'
                      : 'bg-[#FEE2E2] text-[#B91C1C]',
                  )}
                >
                  {state.internetOnline ? (
                    <Wifi className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <WifiOff className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-500">Jaringan Internet</p>
                  <p
                    className={cn(
                      'text-xs font-bold',
                      state.internetOnline ? 'text-[#15803D]' : 'text-[#B91C1C]',
                    )}
                  >
                    {state.internetOnline ? 'Terhubung ke Internet' : 'Tidak Ada Koneksi'}
                  </p>
                </div>
              </div>

              {/* 2. Indikator Database */}
              <div
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                  state.databaseConnected
                    ? hasPersistenceWarning
                      ? 'border-[#FDE68A] bg-[#FFFBEB]'
                      : 'border-[#BBF7D0] bg-[#F0FDF4]/70'
                    : 'border-[#FECACA] bg-[#FEF2F2]',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    state.databaseConnected
                      ? hasPersistenceWarning
                        ? 'bg-[#FEF3C7] text-[#B45309]'
                        : 'bg-[#DCFCE7] text-[#15803D]'
                      : 'bg-[#FEE2E2] text-[#B91C1C]',
                  )}
                >
                  <Database className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-500">Backend &amp; Database</p>
                  <p
                    className={cn(
                      'text-xs font-bold',
                      state.databaseConnected
                        ? hasPersistenceWarning
                          ? 'text-[#B45309]'
                          : 'text-[#15803D]'
                        : 'text-[#B91C1C]',
                    )}
                  >
                    {state.databaseConnected ? 'Terhubung ke Database' : 'Database Offline'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {state.databaseConnected
                      ? `${state.databaseLabel}${state.latencyMs !== null ? ` · ${state.latencyMs} ms` : ''}`
                      : state.databaseError ?? 'Tidak dapat menjangkau server database.'}
                  </p>
                </div>
              </div>

              {hasPersistenceWarning && (
                <div className="flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11px] leading-relaxed text-[#92400E]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#D97706]" />
                  <span>
                    Aplikasi sedang berjalan dalam mode penyimpanan lokal sementara. Pastikan
                    koneksi Cloud Firestore aktif agar data tersimpan permanen.
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#F1F5F9] space-y-2">
                {/* 3. Tombol Refresh Halaman */}
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={handleRefreshPage}
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Refresh Halaman
                </Button>

                {/* 4. Tombol Hapus Cache Lokal Aplikasi */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setPopoverOpen(false);
                    setClearModalOpen(true);
                  }}
                  leftIcon={<Trash2 className="h-3.5 w-3.5 text-[#B91C1C]" />}
                  className="border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2] hover:border-[#FCA5A5]"
                >
                  Hapus Cache Lokal Aplikasi
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full-Screen Confirmation Modal for Clearing Local Cache (Portaled to document.body) */}
      {clearModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#09162E]/65 backdrop-blur-xs p-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-cache-modal-title"
            aria-describedby="clear-cache-modal-desc"
          >
            <div
              className="fixed inset-0"
              aria-hidden="true"
              onClick={() => {
                if (!clearingCache) setClearModalOpen(false);
              }}
            />

            <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl overflow-hidden animate-fade-up">
              <div className="flex items-start justify-between gap-3 border-b border-[#F1F5F9] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#DC2626]">
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2
                      id="clear-cache-modal-title"
                      className="text-base font-bold text-[#10264D]"
                    >
                      Hapus Cache Lokal Aplikasi
                    </h2>
                    <p className="text-xs text-slate-500">Konfirmasi pembersihan penyimpanan lokal</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={clearingCache}
                  onClick={() => setClearModalOpen(false)}
                  aria-label="Tutup dialog konfirmasi"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-[#F1F5F9] hover:text-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                <p id="clear-cache-modal-desc" className="text-sm leading-relaxed text-slate-600">
                  Apakah Anda yakin ingin menghapus seluruh cache lokal aplikasi? Data yang belum
                  tersimpan mungkin akan hilang.
                </p>
                <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#92400E]">
                  Tindakan ini akan membersihkan <strong>localStorage</strong>,{' '}
                  <strong>sessionStorage</strong>, dan <strong>Cache Storage</strong> browser lalu
                  memuat ulang aplikasi secara otomatis.
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 border-t border-[#F1F5F9] bg-[#F8FAFC] px-5 py-3.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={clearingCache}
                  onClick={() => setClearModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={clearingCache}
                  onClick={() => void handleConfirmClearCache()}
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Ya, Hapus Cache
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

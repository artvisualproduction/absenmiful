import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  Keyboard,
  Lock,
  LogOut,
  MapPin,
  Maximize2,
  Minimize2,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Volume2,
  VolumeX,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  SelfieCaptureCard,
  type CapturedSelfie,
} from '../../components/attendance/SelfieCaptureCard';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { ConnectivityStatus } from '../../components/layout/ConnectivityStatus';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cn } from '../../lib/cn';
import {
  formatDateLongJakarta,
  formatTimeWithSecondsJakarta,
  getTimeHHMMJakarta,
} from '../../lib/date';
import { formatVoiceMessage, speakAnnouncement, type VoiceOutcome } from '../../lib/speech';
import { ApiClientError } from '../../services/apiClient';
import {
  attendanceService,
  type PortalStatusResponse,
} from '../../services/attendanceService';
import {
  AttendanceEventType,
  AttendanceStatus,
  QrOwnerType,
  type VoiceTemplatesConfig,
} from '../../types';

interface GpsState {
  status: 'loading' | 'ready' | 'unavailable';
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
}

interface ScanFeedback {
  tone: 'success' | 'late' | 'error';
  name: string | null;
  statusLabel: string;
  eventLabel: string | null;
  message: string;
  timeText: string;
}

const COOLDOWN_MS = 4000;
const RESULT_DISPLAY_MS = 6500;
const SCANNER_REGION_ID = 'portal-qr-camera-region';

const DEFAULT_VOICE_TEMPLATES: VoiceTemplatesConfig = {
  success: 'ABSEN BERHASIL',
  failure: 'ABSEN GAGAL',
  namedSuccess: 'ABSEN ATAS NAMA {name} BERHASIL',
  late: 'ABSEN BERHASIL, {name} TERCATAT TERLAMBAT',
  closed: 'MAAF, WAKTU ABSENSI MASIH DITUTUP',
  alreadyRecorded: 'ANDA SUDAH MELAKUKAN ABSENSI HARI INI',
};

function classifyScanVoiceOutcome(err: unknown): VoiceOutcome {
  if (!(err instanceof ApiClientError)) return 'failure';
  const msg = err.message.toLowerCase();
  if (err.status === 409 || msg.includes('sudah tercatat')) {
    return 'alreadyRecorded';
  }
  if (
    msg.includes('ditutup') ||
    msg.includes('belum memasuki') ||
    msg.includes('telah terlewati') ||
    msg.includes('belum dibuka') ||
    msg.includes('di luar jam') ||
    msg.includes('berakhir') ||
    msg.includes('hari libur') ||
    msg.includes('bukan hari aktif')
  ) {
    return 'closed';
  }
  return 'failure';
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `scan_${crypto.randomUUID()}`;
  }
  return `scan_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function PortalAbsensiPage() {
  useDocumentTitle('Portal Absensi QR');
  const navigate = useNavigate();
  const { refreshSession, publicSettings } = useAuth();

  // Clock & Online state
  const [now, setNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Portal status
  const [portalStatus, setPortalStatus] = useState<PortalStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Activation form (when portal opened without Admin/Operator session)
  const [actUsername, setActUsername] = useState('');
  const [actPassword, setActPassword] = useState('');
  const [actError, setActError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  // Scanner Controls (Always AUTO detection, hardware USB wedge + Camera QR)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [processingScan, setProcessingScan] = useState(false);

  // Feedback & Recent Scans (names + status only, zero NIS/PII)
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [recentScans, setRecentScans] = useState<ScanFeedback[]>([]);

  // GPS State
  const [gps, setGps] = useState<GpsState>({
    status: 'loading',
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
  });

  // Exit Portal Modal
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exitPassword, setExitPassword] = useState('');
  const [exitError, setExitError] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  // Teacher QR_SELFIE verification step
  const [pendingTeacherQr, setPendingTeacherQr] = useState<{
    token: string;
    ownerId: string;
    name: string;
    eventType: AttendanceEventType;
  } | null>(null);
  const [teacherSelfie, setTeacherSelfie] = useState<CapturedSelfie | null>(null);
  const [teacherSelfieBusy, setTeacherSelfieBusy] = useState(false);
  const [teacherSelfieError, setTeacherSelfieError] = useState<string | null>(null);

  // Refs for scanner, cooldown, and latest state
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedMapRef = useRef<Map<string, number>>(new Map());
  const feedbackTimerRef = useRef<number | null>(null);
  const gpsRef = useRef<GpsState>(gps);
  const voiceEnabledRef = useRef<boolean>(voiceEnabled);
  const portalStatusRef = useRef<PortalStatusResponse | null>(portalStatus);
  const isOnlineRef = useRef<boolean>(isOnline);
  const processingRef = useRef<boolean>(false);

  useEffect(() => {
    gpsRef.current = gps;
  }, [gps]);
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);
  useEffect(() => {
    portalStatusRef.current = portalStatus;
  }, [portalStatus]);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  // Live clock tick
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Load portal status
  const loadPortalStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await attendanceService.getPortalStatus();
      setPortalStatus(res);
    } catch (err) {
      setStatusError(
        err instanceof ApiClientError ? err.message : 'Gagal memuat status Portal Absensi.',
      );
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPortalStatus();
  }, [loadPortalStatus]);

  // Browser Geolocation watcher
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGps({
        status: 'unavailable',
        latitude: null,
        longitude: null,
        accuracy: null,
        error: 'Perangkat tidak mendukung GPS.',
      });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({
          status: 'ready',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          error: null,
        });
      },
      (err) => {
        setGps({
          status: 'unavailable',
          latitude: null,
          longitude: null,
          accuracy: null,
          error:
            err.code === err.PERMISSION_DENIED
              ? 'Izin lokasi GPS ditolak oleh browser.'
              : 'Sinyal GPS belum tersedia.',
        });
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const showResultFeedback = useCallback((next: ScanFeedback) => {
    setFeedback(next);
    setRecentScans((prev) => [next, ...prev].slice(0, 6));
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
    }, RESULT_DISPLAY_MS);
  }, []);

  const submitScannedToken = useCallback(
    async (rawInput: string, options?: { bypassCooldown?: boolean }) => {
      const token = rawInput.trim();
      if (!token) return;

      // Never fake success while offline!
      if (!isOnlineRef.current) {
        const offlineMsg =
          'Perangkat sedang OFFLINE. Absensi tidak dapat dikonfirmasi tanpa koneksi server.';
        showResultFeedback({
          tone: 'error',
          name: null,
          statusLabel: 'OFFLINE',
          eventLabel: null,
          message: offlineMsg,
          timeText: getTimeHHMMJakarta(),
        });
        const templates = portalStatusRef.current?.voiceTemplates ?? DEFAULT_VOICE_TEMPLATES;
        speakAnnouncement(formatVoiceMessage(templates, 'failure'), voiceEnabledRef.current);
        return;
      }

      // Per-token cooldown prevents accidental duplicate reads from continuous scanner frames
      const nowMs = Date.now();
      const lastMs = lastScannedMapRef.current.get(token) ?? 0;
      if (!options?.bypassCooldown && nowMs - lastMs < COOLDOWN_MS) {
        return;
      }
      if (processingRef.current) {
        return;
      }

      lastScannedMapRef.current.set(token, nowMs);
      processingRef.current = true;
      setProcessingScan(true);

      const templates = portalStatusRef.current?.voiceTemplates ?? DEFAULT_VOICE_TEMPLATES;

      try {
        const res = await attendanceService.scanAttendance({
          token,
          eventType: 'AUTO',
          latitude: gpsRef.current.latitude,
          longitude: gpsRef.current.longitude,
          gpsAccuracyMeters: gpsRef.current.accuracy,
          idempotencyKey: generateIdempotencyKey(),
          clientTimestamp: new Date().toISOString(),
          deviceInfo:
            typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 160) : 'Portal Web',
        });

        const isLate = res.status === AttendanceStatus.LATE;
        const eventLabel =
          res.eventType === AttendanceEventType.CHECK_IN ? 'ABSEN MASUK' : 'ABSEN PULANG';

        showResultFeedback({
          tone: isLate ? 'late' : 'success',
          name: res.name,
          statusLabel: isLate ? 'TERLAMBAT' : 'HADIR',
          eventLabel,
          message: res.message,
          timeText: getTimeHHMMJakarta(res.recordedAt),
        });

        speakAnnouncement(
          formatVoiceMessage(templates, isLate ? 'late' : 'success', res.name),
          voiceEnabledRef.current,
        );
      } catch (err) {
        // Teacher QR scanned on portal -> transition into mandatory QR_SELFIE step
        if (err instanceof ApiClientError && err.code === 'SELFIE_REQUIRED') {
          const details = err.details as
            | {
                requiresSelfie?: boolean;
                ownerId?: string;
                name?: string;
                eventType?: AttendanceEventType;
              }
            | undefined;
          if (details?.requiresSelfie && details.ownerId) {
            // Release QR scanner camera so front selfie camera can open smoothly
            if (qrScannerRef.current?.isScanning) {
              void qrScannerRef.current.stop().catch(() => {});
              setCameraActive(false);
            }
            setTeacherSelfie(null);
            setTeacherSelfieError(null);
            setPendingTeacherQr({
              token,
              ownerId: details.ownerId,
              name: details.name ?? 'Guru',
              eventType: details.eventType ?? AttendanceEventType.CHECK_IN,
            });
            return;
          }
        }

        let errorName: string | null = null;
        let errorMessage = 'Gagal memproses pemindaian QR.';

        if (err instanceof ApiClientError) {
          errorMessage = err.message;
          const details = err.details as { name?: string } | undefined;
          if (details?.name) {
            errorName = details.name;
          }
        }

        showResultFeedback({
          tone: 'error',
          name: errorName,
          statusLabel: 'GAGAL',
          eventLabel: null,
          message: errorMessage,
          timeText: getTimeHHMMJakarta(),
        });

        speakAnnouncement(
          formatVoiceMessage(templates, classifyScanVoiceOutcome(err), errorName),
          voiceEnabledRef.current,
        );
      } finally {
        processingRef.current = false;
        setProcessingScan(false);
      }
    },
    [showResultFeedback],
  );

  const handleSubmitTeacherQrSelfie = async () => {
    if (!pendingTeacherQr || !teacherSelfie) {
      setTeacherSelfieError('Ambil foto selfie terlebih dahulu untuk menyelesaikan absensi guru.');
      return;
    }

    setTeacherSelfieBusy(true);
    setTeacherSelfieError(null);
    const templates = portalStatusRef.current?.voiceTemplates ?? DEFAULT_VOICE_TEMPLATES;

    try {
      const uploaded = await attendanceService.uploadSelfie({
        dataUrl: teacherSelfie.dataUrl,
        mimeType: teacherSelfie.mimeType,
        ownerType: QrOwnerType.TEACHER,
        ownerId: pendingTeacherQr.ownerId,
      });

      const res = await attendanceService.scanAttendance({
        token: pendingTeacherQr.token,
        eventType: 'AUTO',
        latitude: gpsRef.current.latitude,
        longitude: gpsRef.current.longitude,
        gpsAccuracyMeters: gpsRef.current.accuracy,
        idempotencyKey: generateIdempotencyKey(),
        clientTimestamp: new Date().toISOString(),
        deviceInfo:
          typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 160) : 'Portal Web',
        selfieFileId: uploaded.fileId,
      });

      const isLate = res.status === AttendanceStatus.LATE;
      const eventLabel =
        res.eventType === AttendanceEventType.CHECK_IN ? 'ABSEN MASUK (GURU)' : 'ABSEN PULANG (GURU)';

      setPendingTeacherQr(null);
      setTeacherSelfie(null);

      showResultFeedback({
        tone: isLate ? 'late' : 'success',
        name: res.name,
        statusLabel: isLate ? 'TERLAMBAT' : 'HADIR',
        eventLabel,
        message: res.message,
        timeText: getTimeHHMMJakarta(res.recordedAt),
      });

      speakAnnouncement(
        formatVoiceMessage(templates, isLate ? 'late' : 'success', res.name),
        voiceEnabledRef.current,
      );
    } catch (err) {
      setTeacherSelfieError(
        err instanceof ApiClientError
          ? err.message
          : 'Gagal menyelesaikan absensi guru via QR + Selfie.',
      );
      speakAnnouncement(
        formatVoiceMessage(templates, classifyScanVoiceOutcome(err), pendingTeacherQr.name),
        voiceEnabledRef.current,
      );
    } finally {
      setTeacherSelfieBusy(false);
    }
  };

  // Global USB Keyboard Wedge listener (rapid keystroke capture terminated by Enter)
  useEffect(() => {
    if (!portalStatus?.authorized || exitModalOpen || Boolean(pendingTeacherQr)) return;

    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const nowMs = Date.now();
      if (nowMs - lastKeyTime > 250) {
        buffer = '';
      }
      lastKeyTime = nowMs;

      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          e.preventDefault();
          e.stopPropagation();
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          const captured = buffer;
          buffer = '';
          void submitScannedToken(captured, { bypassCooldown: false });
        } else {
          buffer = '';
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [portalStatus?.authorized, exitModalOpen, pendingTeacherQr, submitScannedToken]);

  // Camera Scanner lifecycle
  const stopCamera = useCallback(async () => {
    const instance = qrScannerRef.current;
    if (!instance) {
      setCameraActive(false);
      return;
    }
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
      instance.clear();
    } catch {
      // Ignore cleanup errors on already-stopped camera
    } finally {
      qrScannerRef.current = null;
      setCameraActive(false);
    }
  }, []);

  const startCamera = useCallback(
    async (targetFacing: 'environment' | 'user') => {
      setCameraBusy(true);
      setCameraError(null);
      await stopCamera();

      try {
        const scanner = new Html5Qrcode(SCANNER_REGION_ID);
        qrScannerRef.current = scanner;
        await scanner.start(
          { facingMode: targetFacing },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            void submitScannedToken(decodedText);
          },
          () => {
            // Frame without QR code — ignore silently
          },
        );
        setCameraActive(true);
      } catch (err) {
        qrScannerRef.current = null;
        setCameraActive(false);
        const msg =
          err instanceof Error
            ? err.message
            : 'Kamera tidak dapat diakses. Pastikan izin kamera diaktifkan atau gunakan scanner USB.';
        setCameraError(msg);
      } finally {
        setCameraBusy(false);
      }
    },
    [stopCamera, submitScannedToken],
  );

  // Stop camera cleanly on unmount
  useEffect(() => {
    return () => {
      void stopCamera();
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, [stopCamera]);

  const handleToggleFacing = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (cameraActive) {
      await startCamera(next);
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Browser may block fullscreen in certain iframe policies
    }
  };

  const handleActivatePortal = async (e: FormEvent) => {
    e.preventDefault();
    setActError(null);
    setActivating(true);
    try {
      await attendanceService.activatePortal(actUsername, actPassword);
      setActPassword('');
      await refreshSession();
      await loadPortalStatus();
    } catch (err) {
      setActError(
        err instanceof ApiClientError
          ? err.message
          : 'Gagal mengaktifkan sesi perangkat Portal Absensi.',
      );
    } finally {
      setActivating(false);
    }
  };

  const handleConfirmExitPortal = async (e: FormEvent) => {
    e.preventDefault();
    setExitError(null);
    setExiting(true);
    try {
      await attendanceService.exitPortal(exitPassword);
      await stopCamera();
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      await refreshSession();
      navigate('/login', { replace: true });
    } catch (err) {
      setExitError(
        err instanceof ApiClientError ? err.message : 'Kata sandi keluar portal tidak valid.',
      );
    } finally {
      setExiting(false);
    }
  };

  const appName = portalStatus?.appName ?? publicSettings?.appName ?? 'Absensi Digital';
  const schoolName =
    portalStatus?.schoolName ?? publicSettings?.schoolName ?? 'MI MIFTAHUL ULUM';
  const schoolAddress =
    portalStatus?.schoolAddress ??
    publicSettings?.schoolAddress ??
    'Sumberwuluh - Candipuro - Lumajang';
  const logoSrc = portalStatus?.logoPath ?? publicSettings?.logoPath ?? '/images/school-logo.png';
  const portalScanMethod = portalStatus?.portalScanMethod ?? 'CAMERA_AND_USB';
  const allowCamera = portalScanMethod !== 'USB_SCANNER_ONLY';
  const scanMethodLabel =
    portalScanMethod === 'CAMERA_ONLY'
      ? 'Kamera QR Otomatis'
      : portalScanMethod === 'USB_SCANNER_ONLY'
        ? 'Alat Scanner USB / Barcode'
        : 'Kamera QR & Alat Scanner USB';

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#071226] text-white flex flex-col selection:bg-[#C69B3C]/30">
      {/* Offline Banner — strictly warns that offline scans CANNOT succeed */}
      {!isOnline && (
        <div
          role="alert"
          className="flex items-center justify-center gap-2.5 bg-[#991B1B] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            KONEKSI TERPUTUS (OFFLINE) — Absensi tidak dapat dicatat atau dikonfirmasi hingga
            koneksi server kembali pulih.
          </span>
        </div>
      )}

      {/* Top Portal Header */}
      <header className="border-b border-white/10 bg-[#0B1C3A]/95 px-4 sm:px-6 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 sm:py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Prominent School Identity & Enlarged Logo */}
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={logoSrc}
              alt={`Logo ${schoolName}`}
              referrerPolicy="no-referrer"
              className="h-16 w-16 sm:h-20 sm:w-20 object-contain bg-transparent shrink-0 drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-[#E7D4A3]">
                  {appName} · Portal Absensi QR
                </span>
                {!isOnline ? (
                  <span className="rounded px-2 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-200 border border-red-400/30 whitespace-nowrap">
                    OFFLINE
                  </span>
                ) : portalStatus && !portalStatus.authorized ? (
                  <span className="rounded px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/30 whitespace-nowrap">
                    MENUNGGU AKTIVASI
                  </span>
                ) : null}
              </div>
              <h1 className="font-display text-xl sm:text-2xl lg:text-[26px] font-bold tracking-[0.02em] text-white leading-tight break-words">
                {schoolName}
              </h1>
              {schoolAddress && (
                <p className="flex items-start gap-1.5 text-xs text-slate-300 leading-snug">
                  <MapPin className="h-3.5 w-3.5 text-[#E7D4A3] shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="line-clamp-2">{schoolAddress}</span>
                </p>
              )}
            </div>
          </div>

          {/* Right Utility & Action Controls */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0 [&>*]:whitespace-nowrap [&>*]:shrink-0">
            <ConnectivityStatus />

            {/* GPS Status */}
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                gps.status === 'ready'
                  ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
                  : gps.status === 'loading'
                    ? 'border-amber-400/30 bg-amber-500/15 text-amber-200'
                    : 'border-white/15 bg-white/5 text-slate-300',
              )}
              title={gps.error ?? 'Koordinat perangkat aktif'}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="tabular-nums">
                {gps.status === 'ready'
                  ? `GPS Aktif (±${Math.round(gps.accuracy ?? 0)}m)`
                  : gps.status === 'loading'
                    ? 'Mencari GPS...'
                    : 'GPS Tidak Aktif'}
              </span>
            </div>

            {/* Voice Toggle */}
            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                voiceEnabled
                  ? 'border-[#C69B3C]/50 bg-[#C69B3C]/15 text-[#F6E4B5]'
                  : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10',
              )}
            >
              {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span>{voiceEnabled ? 'Suara Aktif' : 'Suara Senyap'}</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => void handleToggleFullscreen()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>Keluar Layar Penuh</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Layar Penuh</span>
                </>
              )}
            </button>

            {/* Exit Portal Button */}
            {portalStatus?.authorized ? (
              <button
                type="button"
                onClick={() => {
                  setExitPassword('');
                  setExitError(null);
                  setExitModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/35 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/25 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Keluar Portal</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
              >
                Kembali ke Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6">
        {statusError && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-100"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{statusError}</span>
          </div>
        )}

        {portalStatus?.bypassAttendanceTimeWindow && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/15 px-4 py-2.5 text-xs sm:text-sm text-[#FDE68A]"
          >
            <Clock className="h-4 w-4 shrink-0 text-[#FBBF24]" />
            <span>
              <strong>Mode Bypass Waktu Absensi Aktif:</strong> Absen masuk dan pulang dapat
              dicoba kapan saja tanpa dibatasi jam operasional. Matikan di menu Pengaturan Sistem
              jika sudah selesai uji coba.
            </span>
          </div>
        )}

        {/* Live Clock Hero Strip */}
        <section className="rounded-2xl border border-white/10 bg-[#0F2142] px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs sm:text-sm font-medium text-[#E7D4A3]">
              {formatDateLongJakarta(now)}
            </p>
            <p className="mt-0.5 font-mono text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums">
              {formatTimeWithSecondsJakarta(now)}
            </p>
          </div>
        </section>

        {/* Either Device Activation Gate OR Live Scanner Workspace */}
        {statusLoading ? (
          <div className="flex-1 flex items-center justify-center py-16 text-sm text-slate-300">
            Memeriksa otorisasi perangkat Portal Absensi...
          </div>
        ) : !portalStatus?.authorized ? (
          <section className="mx-auto w-full max-w-md rounded-2xl border border-white/15 bg-[#0F2142] p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#C69B3C]/20 text-[#E7D4A3]">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Aktivasi Perangkat Portal</h2>
                <p className="text-xs text-slate-300">
                  Masuk menggunakan akun Admin atau Operator untuk mengaktifkan pemindai.
                </p>
              </div>
            </div>

            {actError && (
              <div
                role="alert"
                className="rounded-lg border border-red-400/35 bg-red-500/15 px-3.5 py-2.5 text-xs font-medium text-red-100"
              >
                {actError}
              </div>
            )}

            <form onSubmit={handleActivatePortal} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-200" htmlFor="portal-user">
                  Username Admin / Operator
                </label>
                <input
                  id="portal-user"
                  type="text"
                  required
                  autoComplete="username"
                  value={actUsername}
                  onChange={(e) => setActUsername(e.target.value)}
                  placeholder="Contoh: admin"
                  className="w-full rounded-lg border border-white/20 bg-[#071226] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 focus:border-[#C69B3C] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-200" htmlFor="portal-pass">
                  Kata Sandi
                </label>
                <input
                  id="portal-pass"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={actPassword}
                  onChange={(e) => setActPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full rounded-lg border border-white/20 bg-[#071226] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 focus:border-[#C69B3C] focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                variant="gold"
                fullWidth
                loading={activating}
                disabled={!isOnline}
              >
                Aktifkan Portal Absensi
              </Button>
            </form>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 flex-1">
            {/* Left: Camera + USB Scanner (controlled by Pengaturan -> Metode Absen Portal) */}
            <section className="lg:col-span-7 flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0F2142] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {allowCamera ? (
                    <Camera className="h-4 w-4 text-[#E7D4A3]" />
                  ) : (
                    <Keyboard className="h-4 w-4 text-[#E7D4A3]" />
                  )}
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      {allowCamera ? 'Pemindai Kamera QR' : 'Mode Scanner USB / Barcode'}
                    </h2>
                    <p className="text-[11px] text-slate-400">Metode aktif: {scanMethodLabel}</p>
                  </div>
                </div>
                {allowCamera && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggleFacing()}
                      disabled={cameraBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{facingMode === 'environment' ? 'Kamera Belakang' : 'Kamera Depan'}</span>
                    </button>
                    {cameraActive ? (
                      <button
                        type="button"
                        onClick={() => void stopCamera()}
                        disabled={cameraBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/35 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/25"
                      >
                        <CameraOff className="h-3.5 w-3.5" />
                        <span>Matikan Kamera</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void startCamera(facingMode)}
                        disabled={cameraBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#C69B3C] px-3.5 py-1.5 text-xs font-semibold text-[#071226] hover:bg-[#D4AE52] disabled:opacity-50"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>{cameraBusy ? 'Membuka...' : 'Aktifkan Kamera'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Camera Viewport (hidden when Pengaturan = USB_SCANNER_ONLY) */}
              {allowCamera ? (
                <div className="relative flex min-h-[280px] sm:min-h-[340px] items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-[#071226]">
                  <div id={SCANNER_REGION_ID} className="w-full" />
                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#C69B3C]/35 bg-[#10264D] text-[#E7D4A3]">
                        <QrCode className="h-7 w-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">
                          Pemindai QR &amp; Scanner USB Siap
                        </p>
                        <p className="text-xs text-slate-300 max-w-sm">
                          Arahkan kartu QR ke alat scanner USB kapan saja, atau klik{' '}
                          <strong>Aktifkan Kamera</strong> untuk memindai melalui kamera perangkat.
                        </p>
                      </div>
                      {cameraError && (
                        <p className="rounded-lg border border-amber-400/35 bg-amber-500/15 px-3 py-2 text-xs text-amber-100 max-w-md">
                          {cameraError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 min-h-[260px] flex-col items-center justify-center rounded-xl border border-white/15 bg-[#071226] p-8 text-center space-y-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#C69B3C]/35 bg-[#10264D] text-[#E7D4A3]">
                    <Keyboard className="h-8 w-8" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <p className="text-base font-bold text-white">Scanner USB / Barcode Aktif</p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Arahkan alat pemindai USB ke kartu QR siswa atau guru. Portal akan mendeteksi
                      absensi masuk atau pulang secara otomatis.
                    </p>
                  </div>
                </div>
              )}

              {/* Non-input Hardware Scanner Status Strip */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#071226] px-4 py-3 text-xs text-slate-300">
                <div className="flex items-center gap-2 min-w-0">
                  <Keyboard className="h-4 w-4 text-[#E7D4A3] shrink-0" />
                  <span className="truncate">
                    {processingScan
                      ? 'Memproses data pemindaian dari alat scanner...'
                      : 'Alat scanner USB / barcode aktif di latar belakang — pindai kartu kapan saja.'}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[11px] font-semibold text-[#E7D4A3]">
                  AUTO
                </span>
              </div>
            </section>

            {/* Right: Color-Coded Live Result & Recent Activity */}
            <section className="lg:col-span-5 flex flex-col gap-4">
              {/* Result Panel */}
              <div
                aria-live="assertive"
                className={cn(
                  'rounded-2xl border p-6 transition-colors min-h-[220px] flex flex-col justify-center',
                  !feedback
                    ? 'border-white/10 bg-[#0F2142]'
                    : feedback.tone === 'success'
                      ? 'border-emerald-400/50 bg-emerald-950/80'
                      : feedback.tone === 'late'
                        ? 'border-amber-400/50 bg-amber-950/80'
                        : 'border-red-400/50 bg-red-950/80',
                )}
              >
                {!feedback ? (
                  <div className="text-center space-y-2.5">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#E7D4A3]">
                      <Clock className="h-6 w-6" />
                    </div>
                    <h2 className="text-base font-bold text-white">Menunggu Pemindaian QR</h2>
                    <p className="text-xs text-slate-300">
                      Tempelkan kartu QR siswa di depan kamera atau scanner USB. Hasil konfirmasi
                      server tampil otomatis di layar ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                      {feedback.tone === 'success' ? (
                        <CheckCircle2 className="h-8 w-8 text-emerald-300" />
                      ) : feedback.tone === 'late' ? (
                        <AlertTriangle className="h-8 w-8 text-amber-300" />
                      ) : (
                        <XCircle className="h-8 w-8 text-red-300" />
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <span
                        className={cn(
                          'rounded-md px-2.5 py-0.5 text-xs font-bold tracking-wide',
                          feedback.tone === 'success'
                            ? 'bg-emerald-500/25 text-emerald-100'
                            : feedback.tone === 'late'
                              ? 'bg-amber-500/25 text-amber-100'
                              : 'bg-red-500/25 text-red-100',
                        )}
                      >
                        {feedback.statusLabel}
                      </span>
                      {feedback.eventLabel && (
                        <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-100">
                          {feedback.eventLabel}
                        </span>
                      )}
                    </div>

                    {feedback.name && (
                      <p className="text-2xl font-extrabold tracking-tight text-white">
                        {feedback.name}
                      </p>
                    )}

                    <p className="text-sm text-slate-100 leading-relaxed">{feedback.message}</p>
                    <p className="font-mono text-xs text-slate-300 tabular-nums">
                      Waktu server: {feedback.timeText}
                    </p>
                  </div>
                )}
              </div>

              {/* Recent Scans Log (Minimal Privacy-Safe: Name + Status + Time only) */}
              <div className="flex-1 rounded-2xl border border-white/10 bg-[#0F2142] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#E7D4A3]">
                    Aktivitas Pindaian Terakhir
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Operator: {portalStatus.operatorUsername}
                  </span>
                </div>

                {recentScans.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    Belum ada pemindaian pada sesi layar ini.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {recentScans.map((item, idx) => (
                      <li
                        key={`${item.timeText}-${idx}`}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {item.name ?? 'Tidak Dikenali'}
                          </p>
                          <p className="truncate text-xs text-slate-300">{item.message}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={cn(
                              'inline-block rounded px-2 py-0.5 text-[11px] font-semibold',
                              item.tone === 'success'
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : item.tone === 'late'
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : 'bg-red-500/20 text-red-200',
                            )}
                          >
                            {item.statusLabel}
                          </span>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-400 tabular-nums">
                            {item.timeText}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer note */}
      <footer className="border-t border-white/10 bg-[#0B1C3A]/60 px-6 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] text-center text-[11px] text-slate-400">
        Catatan keamanan: Kunci keluar Portal Absensi merupakan pengaman tingkat aplikasi web,
        bukan kiosk lock tingkat sistem operasi atau perangkat keras.
      </footer>

      {/* Modal: Keluar Portal (verifies portalExitPasswordHash on server) */}
      <Modal
        open={exitModalOpen}
        onClose={() => !exiting && setExitModalOpen(false)}
        title="Keluar dari Portal Absensi"
        size="sm"
      >
        <form onSubmit={handleConfirmExitPortal} className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-[#E7D4A3] bg-[#FCF9F1] p-3 text-xs text-[#8D6B22]">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Masukkan <strong>kata sandi keluar portal</strong> untuk menutup sesi pemindai dan
              kembali ke halaman login. Catatan: kunci keluar ini bukan kiosk lock tingkat
              perangkat/sistem operasi.
            </span>
          </div>

          {exitError && (
            <div
              role="alert"
              className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              {exitError}
            </div>
          )}

          <PasswordInput
            label="Kata Sandi Keluar Portal"
            required
            value={exitPassword}
            onChange={(e) => setExitPassword(e.target.value)}
            placeholder="Masukkan kata sandi keluar portal..."
          />

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-1 [&>button]:w-full sm:[&>button]:w-auto">
            <Button
              variant="outline"
              onClick={() => setExitModalOpen(false)}
              disabled={exiting}
            >
              Batal
            </Button>
            <Button type="submit" variant="danger" loading={exiting}>
              Verifikasi &amp; Keluar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Verifikasi Selfie Guru (QR_SELFIE) */}
      <Modal
        open={Boolean(pendingTeacherQr)}
        onClose={() => {
          if (!teacherSelfieBusy) {
            setPendingTeacherQr(null);
            setTeacherSelfie(null);
            setTeacherSelfieError(null);
          }
        }}
        title="Verifikasi Selfie Absensi Guru"
        size="md"
      >
        {pendingTeacherQr && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#E7D4A3] bg-[#FCF9F1] p-3.5 text-xs space-y-1">
              <p className="font-semibold text-[#10264D] text-sm">{pendingTeacherQr.name}</p>
              <p className="text-[#8D6B22]">
                Jenis:{' '}
                {pendingTeacherQr.eventType === AttendanceEventType.CHECK_IN
                  ? 'Absen Masuk Guru'
                  : 'Absen Pulang Guru'}{' '}
                · Metode QR + Selfie (QR_SELFIE)
              </p>
            </div>

            {teacherSelfieError && (
              <div
                role="alert"
                className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
              >
                {teacherSelfieError}
              </div>
            )}

            <SelfieCaptureCard
              value={teacherSelfie}
              onChange={setTeacherSelfie}
              disabled={teacherSelfieBusy}
              helperText="Ambil foto selfie guru untuk menyelesaikan absensi QR di Portal."
            />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-1 [&>button]:w-full sm:[&>button]:w-auto">
              <Button
                type="button"
                variant="outline"
                disabled={teacherSelfieBusy}
                onClick={() => {
                  setPendingTeacherQr(null);
                  setTeacherSelfie(null);
                  setTeacherSelfieError(null);
                }}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="gold"
                loading={teacherSelfieBusy}
                disabled={!teacherSelfie}
                onClick={() => void handleSubmitTeacherQrSelfie()}
              >
                Konfirmasi &amp; Catat Absensi
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Crosshair,
  History,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  SelfieCaptureCard,
  type CapturedSelfie,
} from '../../components/attendance/SelfieCaptureCard';
import { AppShell } from '../../components/layout/AppShell';
import { SchoolGeofenceMap } from '../../components/maps/SchoolGeofenceMap';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { mapStatusToBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cn } from '../../lib/cn';
import { formatDateLongJakarta, getTimeHHMMJakarta } from '../../lib/date';
import { validateGeofence } from '../../lib/haversine';
import { formatIndonesianDaysList } from '../../lib/teacherWorkingDays';
import { ApiClientError } from '../../services/apiClient';
import {
  attendanceService,
  type MyAttendanceResponse,
} from '../../services/attendanceService';
import { AttendanceEventType, AttendanceStatus, QrOwnerType, UserRole } from '../../types';

interface GpsReading {
  status: 'loading' | 'ready' | 'error';
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tself_${crypto.randomUUID()}`;
  }
  return `tself_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function TeacherSelfAttendancePage() {
  const { user } = useAuth();
  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const historyPath = isPrincipal ? '/principal/history' : '/teacher/history';
  useDocumentTitle(isPrincipal ? 'Absensi Harian Kepala Sekolah' : 'Absensi Saya');
  const { showToast } = useToast();

  const [context, setContext] = useState<MyAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selfie, setSelfie] = useState<CapturedSelfie | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    status: AttendanceStatus;
    eventType: AttendanceEventType;
    message: string;
    serverTimestamp: string;
    distanceMeters: number | null;
  } | null>(null);

  const [gps, setGps] = useState<GpsReading>({
    status: 'loading',
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
  });

  const loadContext = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await attendanceService.getMyAttendance({ limit: 5 });
      setContext(res);
    } catch (err) {
      setLoadError(
        err instanceof ApiClientError ? err.message : 'Gagal memuat status absensi hari ini.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const requestGpsLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGps({
        status: 'error',
        latitude: null,
        longitude: null,
        accuracy: null,
        error: 'Perangkat atau browser Anda tidak mendukung GPS (Geolocation).',
      });
      return;
    }

    setGps((prev) => ({ ...prev, status: 'loading', error: null }));
    navigator.geolocation.getCurrentPosition(
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
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser Anda.'
            : err.code === err.TIMEOUT
              ? 'Waktu pembacaan sinyal GPS habis. Coba pindah ke area terbuka lalu muat ulang GPS.'
              : 'Sinyal GPS belum tersedia. Pastikan layanan lokasi perangkat menyala.';
        setGps({
          status: 'error',
          latitude: null,
          longitude: null,
          accuracy: null,
          error: msg,
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  }, []);

  useEffect(() => {
    requestGpsLocation();
  }, [requestGpsLocation]);

  const geofencePreview = useMemo(() => {
    const loc = context?.activeLocation;
    if (!loc || gps.status !== 'ready' || gps.latitude === null || gps.longitude === null) {
      return null;
    }
    return validateGeofence({
      school: { latitude: loc.latitude, longitude: loc.longitude },
      device: { latitude: gps.latitude, longitude: gps.longitude },
      radiusMeters: loc.radiusMeters,
      maxAccuracyMeters: loc.maxGpsAccuracyMeters,
      accuracyMeters: gps.accuracy,
    });
  }, [context?.activeLocation, gps]);

  const todayCheckIn = context?.todayCheckIn ?? null;
  const todayCheckOut = context?.todayCheckOut ?? null;
  const rule = context?.teacherRule ?? null;
  const activeLocation = context?.activeLocation ?? null;
  const selfServiceDisabled = context ? !context.teacherSelfServiceEnabled : false;
  const gpsRequired = Boolean(
    context?.gpsEnabledForTeachers && (rule ? rule.gpsRequired || rule.geofenceRequired : true),
  );

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitResult(null);

    if (!selfie) {
      setSubmitError('Ambil foto selfie terlebih dahulu sebelum mengirim absensi.');
      return;
    }
    if (gpsRequired && (gps.status !== 'ready' || gps.latitude === null || gps.longitude === null)) {
      setSubmitError(
        'Koordinat GPS belum terbaca. Aktifkan GPS lalu tekan "Perbarui GPS", atau hubungi Admin untuk jalur pengecualian manual.',
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload selfie privately to server (validated MIME + magic bytes + <= 2MB)
      const uploaded = await attendanceService.uploadSelfie({
        dataUrl: selfie.dataUrl,
        mimeType: selfie.mimeType,
        ownerType: QrOwnerType.TEACHER,
      });

      // 2. Submit server-authoritative self-service attendance (auto Masuk/Pulang)
      const res = await attendanceService.submitTeacherSelfAttendance({
        eventType: 'AUTO',
        latitude: gps.status === 'ready' ? gps.latitude : null,
        longitude: gps.status === 'ready' ? gps.longitude : null,
        gpsAccuracyMeters: gps.status === 'ready' ? (gps.accuracy ?? 0) : null,
        selfieFileId: uploaded.fileId,
        idempotencyKey: generateIdempotencyKey(),
        clientTimestamp: new Date().toISOString(),
        deviceInfo:
          typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 160) : 'Web Browser',
      });

      setSubmitResult({
        status: res.record.status,
        eventType: res.record.eventType,
        message: res.message,
        serverTimestamp: res.record.serverTimestamp,
        distanceMeters: res.record.distanceFromSchoolMeters,
      });
      setSelfie(null);
      showToast({
        variant: 'success',
        title: 'Absensi tercatat',
        message: res.message,
      });
      await loadContext();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : 'Gagal mengirim absensi mandiri. Periksa koneksi dan coba lagi.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title={isPrincipal ? 'Absensi Harian Kepala Sekolah' : 'Absensi Saya'}
      subtitle={`${formatDateLongJakarta()} · Validasi waktu server, selfie privat${gpsRequired ? ', dan geofencing' : ''}`}
      actions={
        <Link to={historyPath}>
          <Button variant="outline" size="sm" leftIcon={<History className="h-4 w-4" />}>
            Riwayat Absensi
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {loadError && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {context?.isTodayHlt && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-[#99F6E4] bg-[#F0FDFA] px-4 py-3.5 text-xs sm:text-sm text-[#115E59]"
          >
            <CalendarOff className="h-4 w-4 shrink-0 mt-0.5 text-[#0F766E]" />
            <div className="space-y-0.5">
              <p className="font-semibold text-[#0F766E]">
                Hari Ini Terjadwal sebagai HLT (Hari Libur Tertentu) Anda
              </p>
              <p className="text-xs text-[#115E59]/90">
                Hari wajib absen Anda:{' '}
                <strong>{formatIndonesianDaysList(context.teacherWorkingDays ?? [])}</strong>. Anda
                tidak wajib absen hari ini dan tidak akan dihitung Alfa, namun tetap diperbolehkan
                melakukan absensi bila sedang bertugas di madrasah.
              </p>
            </div>
          </div>
        )}

        {context?.bypassAttendanceTimeWindow && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-xs sm:text-sm text-[#92400E]"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-[#D97706]" />
            <span>
              <strong>Mode Bypass Waktu Absensi Aktif:</strong> Absensi masuk dan pulang dapat
              dicoba kapan saja tanpa dibatasi jam sekolah.
            </span>
          </div>
        )}

        {/* Today's Status Summary Strip */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500">Absen Masuk Hari Ini</p>
              {loading ? (
                <Skeleton className="h-6 w-32" />
              ) : todayCheckIn ? (
                <>
                  <p className="font-mono text-xl font-bold text-[#10264D] tabular-nums">
                    {getTimeHHMMJakarta(todayCheckIn.serverTimestamp)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Metode {todayCheckIn.method}
                    {todayCheckIn.distanceFromSchoolMeters !== null
                      ? ` · Jarak ${Math.round(todayCheckIn.distanceFromSchoolMeters)} m`
                      : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-[#10264D]">Belum Absen Masuk</p>
                  <p className="text-xs text-slate-500">
                    {rule
                      ? `Jendela masuk ${rule.checkInStart} – ${rule.checkInDeadline} (terlambat > ${rule.lateAfter})`
                      : 'Mengikuti aturan jam guru aktif'}
                  </p>
                </>
              )}
            </div>
            {todayCheckIn ? (
              <StatusBadge
                label={mapStatusToBadge(todayCheckIn.status).label}
                tone={mapStatusToBadge(todayCheckIn.status).tone}
              />
            ) : (
              <StatusBadge label="Menunggu" tone="neutral" />
            )}
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500">Absen Pulang Hari Ini</p>
              {loading ? (
                <Skeleton className="h-6 w-32" />
              ) : todayCheckOut ? (
                <>
                  <p className="font-mono text-xl font-bold text-[#10264D] tabular-nums">
                    {getTimeHHMMJakarta(todayCheckOut.serverTimestamp)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Metode {todayCheckOut.method}
                    {todayCheckOut.distanceFromSchoolMeters !== null
                      ? ` · Jarak ${Math.round(todayCheckOut.distanceFromSchoolMeters)} m`
                      : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-[#10264D]">Belum Absen Pulang</p>
                  <p className="text-xs text-slate-500">
                    {rule
                      ? `Jendela pulang ${rule.checkOutStart} – ${rule.checkOutDeadline}`
                      : 'Mengikuti aturan jam guru aktif'}
                  </p>
                </>
              )}
            </div>
            {todayCheckOut ? (
              <StatusBadge
                label={mapStatusToBadge(todayCheckOut.status).label}
                tone={mapStatusToBadge(todayCheckOut.status).tone}
              />
            ) : (
              <StatusBadge label="Menunggu" tone="neutral" />
            )}
          </div>
        </section>

        {selfServiceDisabled && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Absensi Mandiri Sedang Dinonaktifkan</p>
              <p className="text-xs mt-0.5">
                Admin Madrasah sedang menonaktifkan fitur absensi mandiri guru. Gunakan QR Guru di
                Portal Absensi sekolah atau hubungi Admin.
              </p>
            </div>
          </div>
        )}

        {submitResult && (
          <div
            role="status"
            className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-[#15803D] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-[#14532D]">
                  {submitResult.eventType === AttendanceEventType.CHECK_IN
                    ? 'Absen Masuk Berhasil Dicatat'
                    : 'Absen Pulang Berhasil Dicatat'}
                </p>
                <p className="text-xs text-[#166534]">{submitResult.message}</p>
                <p className="font-mono text-xs text-[#15803D] tabular-nums">
                  Waktu server: {getTimeHHMMJakarta(submitResult.serverTimestamp)}
                  {submitResult.distanceMeters !== null
                    ? ` · Jarak ${Math.round(submitResult.distanceMeters)} m dari titik sekolah`
                    : ''}
                </p>
              </div>
            </div>
            <StatusBadge
              label={mapStatusToBadge(submitResult.status).label}
              tone={mapStatusToBadge(submitResult.status).tone}
            />
          </div>
        )}

        {/* Main 2-Column Self-Attendance Workspace */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Step 1 — GPS & Geofence Verification */}
          <section className="lg:col-span-6 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-[#10264D]">
                  1. Lokasi GPS &amp; Radius Sekolah
                </h2>
                <p className="text-xs text-slate-500">
                  {activeLocation
                    ? `${activeLocation.name} (Radius ${activeLocation.radiusMeters} m)`
                    : 'Memuat lokasi sekolah...'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={gps.status === 'loading'}
                onClick={requestGpsLocation}
                leftIcon={<Crosshair className="h-3.5 w-3.5" />}
              >
                Perbarui GPS
              </Button>
            </div>

            <div className="p-5 space-y-4 flex-1">
              {/* GPS Telemetry Summary */}
              {!gpsRequired && gps.status !== 'ready' ? (
                <div className="rounded-lg border border-[#E7D4A3] bg-[#FCF9F1] p-3.5 text-xs text-[#8D6B22] space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0" />
                    Validasi GPS Opsional
                  </p>
                  <p>
                    Validasi GPS/Radius sedang dinonaktifkan oleh Admin. Anda tetap dapat mengirim
                    absensi dengan foto selfie meski sinyal GPS tidak tersedia.
                  </p>
                </div>
              ) : gps.status === 'error' ? (
                <div
                  role="alert"
                  className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-xs text-[#B91C1C] space-y-1.5"
                >
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Lokasi GPS Belum Tersedia
                  </p>
                  <p>{gps.error}</p>
                  <p className="text-[#991B1B]">
                    Jika perangkat tidak dapat memperoleh sinyal GPS di area sekolah, silakan
                    hubungi <strong>Admin Madrasah</strong> untuk pencatatan pengecualian manual
                    beralasan.
                  </p>
                </div>
              ) : gps.status === 'loading' ? (
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs text-slate-600 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#C69B3C]" />
                  <span>Sedang membaca koordinat GPS presisi tinggi...</span>
                </div>
              ) : (
                <div
                  className={cn(
                    'rounded-lg border p-3.5 text-xs space-y-1.5',
                    geofencePreview && !geofencePreview.passed && context?.gpsEnabledForTeachers
                      ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]'
                      : 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {geofencePreview
                        ? geofencePreview.passed
                          ? 'Di dalam radius area sekolah'
                          : 'Perlu perhatian: di luar radius / akurasi rendah'
                        : 'Koordinat GPS aktif'}
                    </span>
                    <span className="font-mono tabular-nums font-semibold">
                      Akurasi ±{Math.round(gps.accuracy ?? 0)} m
                    </span>
                  </div>
                  <p className="font-mono tabular-nums">
                    Posisi Anda: {gps.latitude?.toFixed(6)}, {gps.longitude?.toFixed(6)}
                    {geofencePreview ? ` · Jarak ${Math.round(geofencePreview.distanceMeters)} m` : ''}
                  </p>
                  {geofencePreview?.reason && context?.gpsEnabledForTeachers && (
                    <p className="font-medium">{geofencePreview.reason}</p>
                  )}
                </div>
              )}

              {activeLocation ? (
                <SchoolGeofenceMap
                  schoolLat={activeLocation.latitude}
                  schoolLng={activeLocation.longitude}
                  radiusMeters={activeLocation.radiusMeters}
                  schoolName={activeLocation.name}
                  userLat={gps.latitude}
                  userLng={gps.longitude}
                  userAccuracyMeters={gps.accuracy}
                  heightClassName="h-[260px]"
                />
              ) : (
                <Skeleton className="h-[260px] w-full rounded-xl" />
              )}

              <div className="flex items-start gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#8D6B22] mt-0.5" />
                <span>
                  Jarak dihitung ulang secara resmi di server dengan rumus Haversine. Status final
                  ditentukan oleh jam server.
                </span>
              </div>
            </div>
          </section>

          {/* Right: Step 2 — Selfie & Submit */}
          <section className="lg:col-span-6 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden flex flex-col">
            <div className="border-b border-[#E2E8F0] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-[#10264D]">
                2. Foto Selfie &amp; Kirim Absensi
              </h2>
              <p className="text-xs text-slate-500">
                Ambil foto selfie langsung dari kamera depan sebagai bukti kehadiran privat
                (masuk/pulang otomatis mengikuti waktu server).
              </p>
            </div>

            <div className="p-5 space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Selfie Camera */}
                <SelfieCaptureCard
                  value={selfie}
                  onChange={setSelfie}
                  disabled={submitting || selfServiceDisabled}
                />

                {submitError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#E2E8F0] space-y-2.5">
                <Button
                  type="button"
                  variant="gold"
                  size="lg"
                  fullWidth
                  loading={submitting}
                  disabled={selfServiceDisabled || !selfie || (gpsRequired && gps.status !== 'ready')}
                  onClick={() => void handleSubmit()}
                  leftIcon={<ClipboardCheck className="h-4 w-4" />}
                >
                  Kirim Absensi Mandiri Sekarang
                </Button>
                <p className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Waktu tercatat menggunakan jam server resmi (format 24 jam)</span>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

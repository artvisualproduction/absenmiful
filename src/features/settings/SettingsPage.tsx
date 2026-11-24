import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  Clock,
  DatabaseBackup,
  GraduationCap,
  Image as ImageIcon,
  Keyboard,
  KeyRound,
  MapPin,
  Palette,
  Play,
  QrCode,
  Save,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Users,
  Volume2,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  getMaxBrandingBytes,
  type BrandingSlot,
} from '../../lib/adminSettingsValidation';
import { cn } from '../../lib/cn';
import { formatVoiceMessage, speakAnnouncement, type VoiceOutcome } from '../../lib/speech';
import { adminService } from '../../services/adminService';
import { ApiClientError } from '../../services/apiClient';
import type { PortalScanMethod, VoiceTemplatesConfig } from '../../types';

type SettingsTab = 'identity' | 'portal' | 'attendance' | 'security';

const PORTAL_SCAN_METHOD_OPTIONS: Array<{
  value: PortalScanMethod;
  title: string;
  description: string;
}> = [
  {
    value: 'CAMERA_AND_USB',
    title: 'Kamera QR & Scanner USB (Disarankan)',
    description:
      'Portal menampilkan pemindai kamera sekaligus menerima pindaian scanner barcode/QR USB.',
  },
  {
    value: 'CAMERA_ONLY',
    title: 'Kamera QR Saja',
    description:
      'Hanya menggunakan kamera perangkat (HP/tablet/webcam) untuk memindai QR NIS/NIY.',
  },
  {
    value: 'USB_SCANNER_ONLY',
    title: 'Scanner USB / Barcode Saja',
    description:
      'Menyembunyikan kamera dan memfokuskan layar pada alat pemindai USB keyboard wedge.',
  },
  {
    value: 'MANUAL_AND_SCANNER',
    title: 'Kamera & Scanner USB (Mode Kompatibilitas)',
    description:
      'Mengaktifkan kamera serta alat pemindai USB eksternal di meja piket.',
  },
];

export function SettingsPage() {
  useDocumentTitle('Pengaturan Sistem');
  const { refreshPublicSettings } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('identity');
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<BrandingSlot | null>(null);

  // Form state
  const [appName, setAppName] = useState('Absensi Digital');
  const [pwaAppName, setPwaAppName] = useState('MiFUL');
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolBio, setSchoolBio] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jakarta');

  const [primaryColor, setPrimaryColor] = useState('#10264D');
  const [accentColor, setAccentColor] = useState('#C69B3C');
  const [bgColor, setBgColor] = useState('#F6F8FB');

  const [portalScanMethod, setPortalScanMethod] = useState<PortalScanMethod>('CAMERA_AND_USB');
  const [gpsStudents, setGpsStudents] = useState(false);
  const [gpsTeachers, setGpsTeachers] = useState(true);
  const [teacherSelfService, setTeacherSelfService] = useState(true);
  const [permissionAffectsRecap, setPermissionAffectsRecap] = useState(true);
  const [quickLoginEnabled, setQuickLoginEnabled] = useState(true);
  const [bypassAttendanceTimeWindow, setBypassAttendanceTimeWindow] = useState(false);
  const [requireUserLinkedToTeacher, setRequireUserLinkedToTeacher] = useState(true);
  const [photoRetentionDays, setPhotoRetentionDays] = useState(90);

  const [voiceSuccess, setVoiceSuccess] = useState('ABSEN BERHASIL');
  const [voiceNamedSuccess, setVoiceNamedSuccess] = useState('ABSEN ATAS NAMA {name} BERHASIL');
  const [voiceLate, setVoiceLate] = useState('ABSEN BERHASIL, {name} TERCATAT TERLAMBAT');
  const [voiceFailure, setVoiceFailure] = useState('ABSEN GAGAL, KARTU TIDAK TERDAFTAR');
  const [voiceClosed, setVoiceClosed] = useState('MAAF, WAKTU ABSENSI MASIH DITUTUP');
  const [voiceAlreadyRecorded, setVoiceAlreadyRecorded] = useState(
    'ANDA SUDAH MELAKUKAN ABSENSI HARI INI',
  );

  const [portalExitPassword, setPortalExitPassword] = useState('');
  const [hasPortalExitPassword, setHasPortalExitPassword] = useState(true);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loginBgUrl, setLoginBgUrl] = useState<string | null>(null);

  const [savingToggleKey, setSavingToggleKey] = useState<string | null>(null);

  const syncFormFromSettings = useCallback(
    (s: Awaited<ReturnType<typeof adminService.getSettings>>['settings']) => {
      setAppName(s.appName);
      setPwaAppName(s.pwaAppName?.trim() || 'MiFUL');
      setSchoolName(s.schoolName);
      setSchoolAddress(s.schoolAddress);
      setSchoolBio(s.schoolBio);
      setTimezone(s.timezone);
      setPrimaryColor(s.theme.primary);
      setAccentColor(s.theme.accent);
      setBgColor(s.theme.background);
      setPortalScanMethod(s.portalScanMethod ?? 'CAMERA_AND_USB');
      setGpsStudents(s.gpsEnabledForStudents);
      setGpsTeachers(s.gpsEnabledForTeachers);
      setTeacherSelfService(s.teacherSelfServiceEnabled);
      setPermissionAffectsRecap(s.approvedPermissionAffectsRecap ?? true);
      setQuickLoginEnabled(s.quickLoginEnabled ?? true);
      setBypassAttendanceTimeWindow(s.bypassAttendanceTimeWindow ?? false);
      setRequireUserLinkedToTeacher(s.requireUserLinkedToTeacher ?? true);
      setPhotoRetentionDays(s.photoRetentionDays ?? 90);
      setVoiceSuccess(s.voiceTemplates.success || 'ABSEN BERHASIL');
      setVoiceNamedSuccess(
        s.voiceTemplates.namedSuccess || 'ABSEN ATAS NAMA {name} BERHASIL',
      );
      setVoiceLate(s.voiceTemplates.late || 'ABSEN BERHASIL, {name} TERCATAT TERLAMBAT');
      setVoiceFailure(s.voiceTemplates.failure || 'ABSEN GAGAL, KARTU TIDAK TERDAFTAR');
      setVoiceClosed(s.voiceTemplates.closed || 'MAAF, WAKTU ABSENSI MASIH DITUTUP');
      setVoiceAlreadyRecorded(
        s.voiceTemplates.alreadyRecorded || 'ANDA SUDAH MELAKUKAN ABSENSI HARI INI',
      );
      setHasPortalExitPassword(s.hasPortalExitPassword);
      setLogoUrl(s.logoPath);
      setLoginBgUrl(s.loginBackgroundPath);
    },
    [],
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getSettings();
      setCanEdit(res.canEdit);
      syncFormFromSettings(res.settings);
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal memuat pengaturan',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast, syncFormFromSettings]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const patchSingleSetting = async (
    key: string,
    patch: Parameters<typeof adminService.updateSettings>[0],
    label: string,
    rollback: () => void,
  ) => {
    if (!canEdit) return;
    setSavingToggleKey(key);
    try {
      const res = await adminService.updateSettings(patch);
      syncFormFromSettings(res.settings);
      await refreshPublicSettings();
      showToast({
        variant: 'success',
        title: 'Tersimpan otomatis',
        message: `${label} langsung diterapkan.`,
      });
    } catch (err) {
      rollback();
      showToast({
        variant: 'error',
        title: 'Gagal menyimpan perubahan',
        message:
          err instanceof ApiClientError
            ? err.message
            : 'Periksa koneksi internet/database lalu coba lagi.',
      });
    } finally {
      setSavingToggleKey(null);
    }
  };

  const currentVoiceTemplates = (): VoiceTemplatesConfig => ({
    success: voiceSuccess.trim() || 'ABSEN BERHASIL',
    failure: voiceFailure.trim() || 'ABSEN GAGAL, KARTU TIDAK TERDAFTAR',
    namedSuccess: voiceNamedSuccess.trim() || 'ABSEN ATAS NAMA {name} BERHASIL',
    late: voiceLate.trim() || 'ABSEN BERHASIL, {name} TERCATAT TERLAMBAT',
    closed: voiceClosed.trim() || 'MAAF, WAKTU ABSENSI MASIH DITUTUP',
    alreadyRecorded: voiceAlreadyRecorded.trim() || 'ANDA SUDAH MELAKUKAN ABSENSI HARI INI',
  });

  const handleTestVoice = (outcome: VoiceOutcome, includeSampleName: boolean) => {
    const text = formatVoiceMessage(
      currentVoiceTemplates(),
      outcome,
      includeSampleName ? 'Ahmad Faqih' : null,
    );
    speakAnnouncement(text, true);
    showToast({
      variant: 'info',
      title: 'Memutar tes suara',
      message: text,
    });
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await adminService.updateSettings({
        appName: appName.trim(),
        pwaAppName: pwaAppName.trim() || 'MiFUL',
        schoolName: schoolName.trim(),
        schoolAddress: schoolAddress.trim(),
        schoolBio: schoolBio.trim(),
        timezone: timezone.trim(),
        theme: {
          primary: primaryColor,
          accent: accentColor,
          background: bgColor,
        },
        portalScanMethod,
        gpsEnabledForStudents: gpsStudents,
        gpsEnabledForTeachers: gpsTeachers,
        teacherSelfServiceEnabled: teacherSelfService,
        approvedPermissionAffectsRecap: permissionAffectsRecap,
        quickLoginEnabled,
        bypassAttendanceTimeWindow,
        requireUserLinkedToTeacher,
        photoRetentionDays: Number(photoRetentionDays),
        voiceTemplates: currentVoiceTemplates(),
        ...(portalExitPassword.trim().length > 0
          ? { portalExitPassword: portalExitPassword.trim() }
          : {}),
      });
      syncFormFromSettings(res.settings);
      setPortalExitPassword('');
      await refreshPublicSettings();
      showToast({
        variant: 'success',
        title: 'Pengaturan disimpan',
        message:
          'Perubahan langsung diterapkan ke halaman Login, Portal Absensi, dan Manifest PWA.',
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menyimpan pengaturan',
        message: err instanceof ApiClientError ? err.message : 'Periksa kembali isian formulir.',
      });
    } finally {
      setSaving(false);
    }
  };

  const prepareBrandingPayload = async (
    file: File,
    slot: 'logo' | 'loginBackground',
  ): Promise<{ dataUrl: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }> => {
    const readFileAsDataUrl = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
        reader.readAsDataURL(blob);
      });

    const originalMime = file.type as 'image/png' | 'image/jpeg' | 'image/webp';
    const TARGET_BYTES = 650 * 1024;

    if (file.size <= TARGET_BYTES) {
      return { dataUrl: await readFileAsDataUrl(file), mimeType: originalMime };
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Gagal memproses gambar.'));
        image.src = objectUrl;
      });

      const maxDim = slot === 'loginBackground' ? 1920 : 512;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return { dataUrl: await readFileAsDataUrl(file), mimeType: originalMime };
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const targetMime: 'image/jpeg' | 'image/webp' =
        slot === 'logo' && originalMime === 'image/png' ? 'image/webp' : 'image/jpeg';

      const canvasToBlob = (mime: string, quality: number) =>
        new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));

      let bestBlob: Blob | null = null;
      let usedMime: 'image/png' | 'image/jpeg' | 'image/webp' = targetMime;

      for (const quality of [0.86, 0.78, 0.7, 0.6, 0.5]) {
        const candidate = await canvasToBlob(targetMime, quality);
        if (!candidate) continue;
        const resolvedMime =
          candidate.type === 'image/webp' ||
          candidate.type === 'image/jpeg' ||
          candidate.type === 'image/png'
            ? (candidate.type as 'image/png' | 'image/jpeg' | 'image/webp')
            : 'image/jpeg';
        bestBlob = candidate;
        usedMime = resolvedMime;
        if (candidate.size <= TARGET_BYTES) {
          break;
        }
      }

      if (bestBlob && bestBlob.size < file.size) {
        return {
          dataUrl: await readFileAsDataUrl(bestBlob),
          mimeType: usedMime,
        };
      }

      return { dataUrl: await readFileAsDataUrl(file), mimeType: originalMime };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const generateSquarePwaPng = async (
    file: File,
    size: number,
    paddingRatio: number,
  ): Promise<string | null> => {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Gagal memuat gambar untuk ikon PWA.'));
        image.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Solid clean background ensures transparent/non-square logos look crisp on Android & iOS launchers
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      const pad = Math.round(size * paddingRatio);
      const inner = size - pad * 2;
      const srcW = img.naturalWidth || img.width || size;
      const srcH = img.naturalHeight || img.height || size;
      const scale = Math.min(inner / srcW, inner / srcH);
      const drawW = Math.max(1, Math.round(srcW * scale));
      const drawH = Math.max(1, Math.round(srcH * scale));
      const dx = Math.round((size - drawW) / 2);
      const dy = Math.round((size - drawH) / 2);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, dx, dy, drawW, drawH);

      let dataUrl = canvas.toDataURL('image/png');
      // If 512px PNG base64 approaches Firestore 1 MiB document ceiling, try compact 384px PNG
      if (dataUrl.length > 900_000 && size > 384) {
        const compactCanvas = document.createElement('canvas');
        compactCanvas.width = 384;
        compactCanvas.height = 384;
        const cCtx = compactCanvas.getContext('2d');
        if (cCtx) {
          cCtx.drawImage(canvas, 0, 0, 384, 384);
          dataUrl = compactCanvas.toDataURL('image/png');
        }
      }
      return dataUrl;
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleBrandingUpload = async (
    slot: 'logo' | 'loginBackground',
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canEdit) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showToast({
        variant: 'error',
        title: 'Format gambar tidak didukung',
        message: 'Gunakan file PNG, JPEG, atau WebP.',
      });
      return;
    }

    const maxBytes = getMaxBrandingBytes(slot);
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    if (file.size > maxBytes) {
      showToast({
        variant: 'error',
        title: 'Ukuran file terlalu besar',
        message:
          slot === 'loginBackground'
            ? `Ukuran maksimal gambar background adalah ${maxMb} MB.`
            : `Ukuran maksimal gambar logo adalah ${maxMb} MB.`,
      });
      return;
    }

    setUploadingSlot(slot);
    try {
      const prepared = await prepareBrandingPayload(file, slot);
      const uploaded = await adminService.uploadBrandingAsset({
        slot,
        dataUrl: prepared.dataUrl,
        mimeType: prepared.mimeType,
        fileName: file.name,
      });

      if (slot === 'logo') {
        setLogoUrl(uploaded.url);
        // Generate exact 192x192 & 512x512 square PNG icons from the uploaded school logo
        // so Android/Chrome/iOS PWA installers reliably use the school logo as the app icon.
        const [png192, png512] = await Promise.all([
          generateSquarePwaPng(file, 192, 0.06),
          generateSquarePwaPng(file, 512, 0.12),
        ]);
        if (png192) {
          await adminService
            .uploadBrandingAsset({
              slot: 'pwaIcon192',
              dataUrl: png192,
              mimeType: 'image/png',
              fileName: 'pwa-192x192.png',
            })
            .catch(() => undefined);
        }
        if (png512) {
          await adminService
            .uploadBrandingAsset({
              slot: 'pwaIcon512',
              dataUrl: png512,
              mimeType: 'image/png',
              fileName: 'pwa-512x512.png',
            })
            .catch(() => undefined);
        }
      } else {
        setLoginBgUrl(uploaded.url);
      }
      await refreshPublicSettings();
      showToast({
        variant: 'success',
        title: slot === 'logo' ? 'Logo sekolah diperbarui' : 'Background sekolah diperbarui',
        message:
          slot === 'logo'
            ? 'Logo baru otomatis diterapkan ke tampilan aplikasi, kartu QR, favicon, dan ikon instalasi PWA.'
            : 'Background halaman login langsung aktif.',
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengunggah gambar',
        message: err instanceof ApiClientError ? err.message : 'Gagal memproses gambar.',
      });
    } finally {
      setUploadingSlot(null);
    }
  };

  if (loading) {
    return (
      <AppShell title="Pengaturan" subtitle="Memuat konfigurasi lembaga...">
        <div className="py-16 flex justify-center">
          <LoadingSpinner label="Memuat pengaturan aplikasi..." />
        </div>
      </AppShell>
    );
  }

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Palette }> = [
    { id: 'identity', label: 'Identitas & Tampilan', icon: Palette },
    { id: 'portal', label: 'Portal & Suara Absensi', icon: Volume2 },
    { id: 'attendance', label: 'Absensi Guru & Siswa', icon: SlidersHorizontal },
    { id: 'security', label: 'Keamanan & Akses', icon: ShieldCheck },
  ];

  const voiceFields: Array<{
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    outcome: VoiceOutcome;
    includeName: boolean;
    helperText: string;
  }> = [
    {
      id: 'voice-success',
      label: 'Suara Berhasil (Umum)',
      value: voiceSuccess,
      onChange: setVoiceSuccess,
      outcome: 'success',
      includeName: false,
      helperText: 'Diputar jika nama peserta tidak tersedia.',
    },
    {
      id: 'voice-named-success',
      label: 'Suara Berhasil Dengan Nama',
      value: voiceNamedSuccess,
      onChange: setVoiceNamedSuccess,
      outcome: 'success',
      includeName: true,
      helperText: 'Gunakan {name} untuk menyebut nama peserta tepat waktu.',
    },
    {
      id: 'voice-late',
      label: 'Suara Terlambat',
      value: voiceLate,
      onChange: setVoiceLate,
      outcome: 'late',
      includeName: true,
      helperText: 'Diputar saat absen masuk melewati batas terlambat ({name}).',
    },
    {
      id: 'voice-failure',
      label: 'Suara Gagal / Salah Kartu',
      value: voiceFailure,
      onChange: setVoiceFailure,
      outcome: 'failure',
      includeName: true,
      helperText: 'Diputar saat kartu QR tidak terdaftar atau ditolak.',
    },
    {
      id: 'voice-closed',
      label: 'Suara Jam Absensi Masih Ditutup',
      value: voiceClosed,
      onChange: setVoiceClosed,
      outcome: 'closed',
      includeName: true,
      helperText: 'Diputar saat memindai di luar jam masuk/pulang atau hari libur.',
    },
    {
      id: 'voice-already',
      label: 'Suara Sudah Absen Hari Ini',
      value: voiceAlreadyRecorded,
      onChange: setVoiceAlreadyRecorded,
      outcome: 'alreadyRecorded',
      includeName: true,
      helperText: 'Diputar jika peserta sudah melakukan absen masuk & pulang.',
    },
  ];

  return (
    <AppShell
      title="Pengaturan Sistem"
      subtitle="Atur identitas sekolah, metode & suara portal, kebijakan absensi guru/siswa, dan keamanan akses."
      actions={
        canEdit ? (
          <Button
            variant="primary"
            size="sm"
            loading={saving}
            onClick={() => {
              const form = document.getElementById('settings-main-form') as HTMLFormElement | null;
              form?.requestSubmit();
            }}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Simpan Pengaturan
          </Button>
        ) : (
          <StatusBadge label="Mode Lihat Saja" tone="warning" />
        )
      }
    >
      <div className="space-y-6">
        {!canEdit && (
          <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5 text-xs text-[#92400E]">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Anda masuk sebagai <strong>Kepala Sekolah</strong>. Halaman pengaturan ditampilkan
              dalam mode lihat saja; perubahan konfigurasi dilakukan oleh Admin Sekolah atau Super
              Admin.
            </span>
          </div>
        )}

        {/* Section Tabs */}
        <div
          role="tablist"
          aria-label="Bagian Pengaturan Sistem"
          className="inline-flex flex-wrap gap-1.5 rounded-xl border border-[#E2E8F0] bg-white p-1.5"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0',
                  active
                    ? 'bg-[#10264D] text-white'
                    : 'text-slate-600 hover:text-[#10264D] hover:bg-[#F8FAFC]',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <form id="settings-main-form" onSubmit={handleSave} className="space-y-6">
          {/* TAB 1: IDENTITAS & TAMPILAN */}
          {activeTab === 'identity' && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 space-y-4">
                <div className="border-b border-[#F1F5F9] pb-3">
                  <h2 className="text-sm font-bold text-[#10264D]">
                    Identitas Sekolah
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Langsung tampil pada halaman Login, Sidebar, Portal Absensi, Kartu QR, dan
                    Laporan.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nama Aplikasi (Web & Header)"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    disabled={!canEdit}
                    required
                  />
                  <Input
                    label="Nama Aplikasi PWA / APK (Saat Diinstal)"
                    value={pwaAppName}
                    onChange={(e) => setPwaAppName(e.target.value)}
                    maxLength={25}
                    placeholder="MiFUL"
                    helperText="Nama yang muncul di ikon aplikasi setelah diinstal di HP/desktop (maks 25 karakter)."
                    disabled={!canEdit}
                    required
                  />
                  <Input
                    label="Nama Sekolah / Madrasah"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    disabled={!canEdit}
                    className="md:col-span-2"
                    required
                  />
                  <Input
                    label="Alamat Lengkap"
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    disabled={!canEdit}
                    className="md:col-span-2"
                  />
                  <Input
                    label="Bio / Keterangan Singkat Lembaga"
                    value={schoolBio}
                    onChange={(e) => setSchoolBio(e.target.value)}
                    disabled={!canEdit}
                    className="md:col-span-2"
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 space-y-4">
                <div className="border-b border-[#F1F5F9] pb-3">
                  <h2 className="text-sm font-bold text-[#10264D] flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-[#C69B3C]" aria-hidden="true" />
                    Logo Sekolah &amp; Foto Background Halaman Login
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ikon aplikasi PWA dan favicon tab browser otomatis mengikuti Logo Sekolah yang
                    Anda unggah (PNG transparan disarankan, maks 2 MB).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-col justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 shrink-0 flex items-center justify-center">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo Sekolah"
                            referrerPolicy="no-referrer"
                            className="h-20 w-20 object-contain bg-transparent"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-slate-400" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-bold text-[#10264D]">Logo Sekolah</p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Tampil bersih tanpa bingkai di Login, Sidebar, Portal, dan Kartu QR.
                          Otomatis menjadi Ikon PWA &amp; Favicon.
                        </p>
                      </div>
                    </div>

                    {canEdit && (
                      <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#10264D] hover:bg-[#EEF3FA] cursor-pointer">
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {uploadingSlot === 'logo' ? 'Mengunggah...' : 'Unggah Logo Sekolah'}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={uploadingSlot === 'logo'}
                          onChange={(e) => void handleBrandingUpload('logo', e)}
                          className="sr-only"
                        />
                      </label>
                    )}
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-col justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-32 rounded-lg overflow-hidden shrink-0 bg-[#10264D]/10 flex items-center justify-center">
                        {loginBgUrl ? (
                          <img
                            src={loginBgUrl}
                            alt="Background Sekolah"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-slate-400" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-bold text-[#10264D]">
                          Background Sekolah (Login)
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Foto gedung atau halaman sekolah yang tampil di belakang kartu Login
                          (rasio 16:9, maks 10 MB).
                        </p>
                      </div>
                    </div>

                    {canEdit && (
                      <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#10264D] hover:bg-[#EEF3FA] cursor-pointer">
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {uploadingSlot === 'loginBackground'
                            ? 'Mengunggah...'
                            : 'Unggah Background Sekolah'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={uploadingSlot === 'loginBackground'}
                          onChange={(e) => void handleBrandingUpload('loginBackground', e)}
                          className="sr-only"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#10264D] flex items-center gap-2">
                      <Palette className="h-4 w-4 text-[#C69B3C]" aria-hidden="true" />
                      Tema Warna Lembaga (Navy · Gold · Putih)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Digunakan pada tombol utama, header kartu QR, dan theme-color PWA.
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPrimaryColor('#10264D');
                        setAccentColor('#C69B3C');
                        setBgColor('#F6F8FB');
                      }}
                    >
                      Reset Preset Resmi
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 text-xs">
                    <div>
                      <p className="font-semibold text-[#10264D]">Warna Utama (Navy)</p>
                      <p className="font-mono text-slate-500">{primaryColor}</p>
                    </div>
                    <input
                      type="color"
                      value={primaryColor}
                      disabled={!canEdit}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border border-slate-300"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 text-xs">
                    <div>
                      <p className="font-semibold text-[#10264D]">Warna Aksen (Gold)</p>
                      <p className="font-mono text-slate-500">{accentColor}</p>
                    </div>
                    <input
                      type="color"
                      value={accentColor}
                      disabled={!canEdit}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border border-slate-300"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 text-xs">
                    <div>
                      <p className="font-semibold text-[#10264D]">Warna Latar (Putih/Abu)</p>
                      <p className="font-mono text-slate-500">{bgColor}</p>
                    </div>
                    <input
                      type="color"
                      value={bgColor}
                      disabled={!canEdit}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border border-slate-300"
                    />
                  </label>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: PORTAL & SUARA ABSENSI */}
          {activeTab === 'portal' && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 space-y-4">
                <div className="border-b border-[#F1F5F9] pb-3">
                  <h2 className="text-sm font-bold text-[#10264D] flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-[#C69B3C]" aria-hidden="true" />
                    Metode Pemindaian Portal Absensi
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pilih perangkat pemindaian yang aktif dipakai pada layar Portal Absensi QR
                    otomatis di gerbang atau meja piket.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PORTAL_SCAN_METHOD_OPTIONS.map((opt) => {
                    const selected = portalScanMethod === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-4 transition-all cursor-pointer',
                          selected
                            ? 'border-[#10264D] bg-[#EEF3FA]/70 ring-1 ring-[#10264D]'
                            : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]',
                          !canEdit && 'opacity-75 cursor-default',
                        )}
                      >
                        <input
                          type="radio"
                          name="portalScanMethod"
                          value={opt.value}
                          checked={selected}
                          disabled={!canEdit || savingToggleKey === 'portalScanMethod'}
                          onChange={() => {
                            const prev = portalScanMethod;
                            setPortalScanMethod(opt.value);
                            void patchSingleSetting(
                              'portalScanMethod',
                              { portalScanMethod: opt.value },
                              `Metode scan (${opt.title})`,
                              () => setPortalScanMethod(prev),
                            );
                          }}
                          className="mt-1 h-4 w-4 text-[#10264D] focus:ring-[#10264D]"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs font-bold text-[#10264D] flex items-center gap-1.5">
                            {opt.value === 'USB_SCANNER_ONLY' ? (
                              <Keyboard className="h-3.5 w-3.5 text-[#C69B3C]" aria-hidden="true" />
                            ) : (
                              <Camera className="h-3.5 w-3.5 text-[#C69B3C]" aria-hidden="true" />
                            )}
                            <span>{opt.title}</span>
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {opt.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 space-y-4">
                <div className="border-b border-[#F1F5F9] pb-3">
                  <h2 className="text-sm font-bold text-[#10264D] flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-[#C69B3C]" aria-hidden="true" />
                    Pengumuman Suara Portal &amp; Uji Coba Audio
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sesuaikan kalimat suara berbahasa Indonesia untuk setiap kondisi pemindaian,
                    lalu klik <strong>Tes Suara</strong> untuk mendengarkan langsung melalui speaker
                    perangkat.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {voiceFields.map((field) => (
                    <div
                      key={field.id}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <label
                          htmlFor={field.id}
                          className="text-xs font-bold text-[#10264D] leading-snug"
                        >
                          {field.label}
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleTestVoice(field.outcome, field.includeName)}
                          leftIcon={<Play className="h-3 w-3" />}
                        >
                          Tes Suara
                        </Button>
                      </div>
                      <Input
                        id={field.id}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        disabled={!canEdit}
                        helperText={field.helperText}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-[#10264D] flex items-center gap-1.5">
                      <KeyRound className="h-4 w-4 text-[#C69B3C]" aria-hidden="true" />
                      Kata Sandi Keluar Portal Absensi
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Default kata sandi keluar portal adalah{' '}
                      <code className="rounded bg-[#F8FAFC] px-1.5 py-0.5 font-mono font-bold text-[#10264D] border border-[#E2E8F0]">
                        123
                      </code>{' '}
                      dan disimpan aman sebagai hash bcrypt di server.{' '}
                      {hasPortalExitPassword
                        ? 'Saat ini kata sandi portal aktif terpasang.'
                        : 'Belum ada kata sandi keluar portal.'}
                    </p>
                  </div>
                  <PasswordInput
                    label="Ubah Kata Sandi Portal (Kosongkan jika tidak diubah)"
                    value={portalExitPassword}
                    onChange={(e) => setPortalExitPassword(e.target.value)}
                    placeholder="Minimal 3 karakter (default: 123)"
                    disabled={!canEdit}
                  />
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: ABSENSI GURU & SISWA */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pengaturan Absensi Siswa */}
                <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 flex flex-col justify-between gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                      <div>
                        <h2 className="text-sm font-bold text-[#10264D] flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-[#C69B3C]" aria-hidden="true" />
                          Pengaturan Absensi Siswa
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Berlaku pada pemindaian kartu QR siswa di Portal Absensi.
                        </p>
                      </div>
                      <StatusBadge label="Siswa" tone="info" showIcon={false} />
                    </div>

                    <label className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-3.5 cursor-pointer hover:bg-[#F8FAFC]">
                      <input
                        type="checkbox"
                        checked={gpsStudents}
                        disabled={!canEdit || savingToggleKey === 'gpsEnabledForStudents'}
                        onChange={(e) => {
                          const prev = gpsStudents;
                          const next = e.target.checked;
                          setGpsStudents(next);
                          void patchSingleSetting(
                            'gpsEnabledForStudents',
                            { gpsEnabledForStudents: next },
                            `Validasi GPS Siswa (${next ? 'Aktif' : 'Nonaktif'})`,
                            () => setGpsStudents(prev),
                          );
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#10264D]"
                      />
                      <div>
                        <p className="text-xs font-semibold text-[#10264D]">
                          Aktifkan Validasi GPS Portal Siswa
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Pemindaian siswa di portal menyertakan verifikasi koordinat perangkat
                          terhadap lokasi sekolah.
                        </p>
                      </div>
                    </label>

                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs text-slate-600 leading-relaxed">
                      Jam masuk, batas terlambat, dan jam pulang berbeda untuk tiap tingkat atau
                      kelas (misal Kelas 1–2 pulang lebih awal) diatur pada halaman{' '}
                      <strong className="text-[#10264D]">Aturan Jam Absensi</strong>.
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#F1F5F9] flex flex-wrap gap-2">
                    <Link to="/admin/attendance-rules">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Clock className="h-3.5 w-3.5" />}
                      >
                        Atur Jam Masuk &amp; Pulang Per Kelas
                      </Button>
                    </Link>
                  </div>
                </section>

                {/* Pengaturan Absensi Guru & Rekap */}
                <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 flex flex-col justify-between gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                      <div>
                        <h2 className="text-sm font-bold text-[#10264D] flex items-center gap-2">
                          <Users className="h-4 w-4 text-[#C69B3C]" aria-hidden="true" />
                          Pengaturan Absensi Guru &amp; Rekap
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Berlaku untuk Absensi Mandiri Guru (Selfie + GPS) dan QR+Selfie Portal.
                        </p>
                      </div>
                      <StatusBadge label="Guru" tone="gold" showIcon={false} />
                    </div>

                    <label className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-3.5 cursor-pointer hover:bg-[#F8FAFC]">
                      <input
                        type="checkbox"
                        checked={gpsTeachers}
                        disabled={!canEdit || savingToggleKey === 'gpsEnabledForTeachers'}
                        onChange={(e) => {
                          const prev = gpsTeachers;
                          const next = e.target.checked;
                          setGpsTeachers(next);
                          void patchSingleSetting(
                            'gpsEnabledForTeachers',
                            { gpsEnabledForTeachers: next },
                            `GPS & Geofencing Guru (${next ? 'Aktif' : 'Nonaktif'})`,
                            () => setGpsTeachers(prev),
                          );
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#10264D]"
                      />
                      <div>
                        <p className="text-xs font-semibold text-[#10264D]">
                          Wajib GPS &amp; Geofencing Radius Sekolah (Guru)
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Mewajibkan lokasi GPS valid dalam radius sekolah saat guru melakukan
                          absensi.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-3.5 cursor-pointer hover:bg-[#F8FAFC]">
                      <input
                        type="checkbox"
                        checked={teacherSelfService}
                        disabled={!canEdit || savingToggleKey === 'teacherSelfServiceEnabled'}
                        onChange={(e) => {
                          const prev = teacherSelfService;
                          const next = e.target.checked;
                          setTeacherSelfService(next);
                          void patchSingleSetting(
                            'teacherSelfServiceEnabled',
                            { teacherSelfServiceEnabled: next },
                            `Absensi Mandiri Guru (${next ? 'Aktif' : 'Nonaktif'})`,
                            () => setTeacherSelfService(prev),
                          );
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#10264D]"
                      />
                      <div>
                        <p className="text-xs font-semibold text-[#10264D]">
                          Izinkan Absensi Mandiri Guru (Selfie + GPS)
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Memungkinkan guru absen masuk/pulang langsung dari Dashboard Guru.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-3.5 cursor-pointer hover:bg-[#F8FAFC]">
                      <input
                        type="checkbox"
                        checked={permissionAffectsRecap}
                        disabled={!canEdit || savingToggleKey === 'approvedPermissionAffectsRecap'}
                        onChange={(e) => {
                          const prev = permissionAffectsRecap;
                          const next = e.target.checked;
                          setPermissionAffectsRecap(next);
                          void patchSingleSetting(
                            'approvedPermissionAffectsRecap',
                            { approvedPermissionAffectsRecap: next },
                            `Izin Memengaruhi Rekap (${next ? 'Aktif' : 'Nonaktif'})`,
                            () => setPermissionAffectsRecap(prev),
                          );
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#10264D]"
                      />
                      <div>
                        <p className="text-xs font-semibold text-[#10264D]">
                          Izin Disetujui Memengaruhi Rekap Kehadiran
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Hari izin yang disetujui Kepala Sekolah dicatat sebagai IZIN/SAKIT bukan
                          ALPA.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="pt-2 border-t border-[#F1F5F9] flex flex-wrap gap-2">
                    <Link to="/admin/geofencing">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<MapPin className="h-3.5 w-3.5" />}
                      >
                        Lokasi &amp; Radius Sekolah
                      </Button>
                    </Link>
                    <Link to="/admin/attendance-rules">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Clock className="h-3.5 w-3.5" />}
                      >
                        Atur Jam Kerja Guru
                      </Button>
                    </Link>
                  </div>
                </section>
              </div>

              {/* Retensi & Mode Uji Coba */}
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <Input
                    type="number"
                    min={7}
                    max={730}
                    label="Kebijakan Retensi Foto Selfie Guru (Hari)"
                    value={String(photoRetentionDays)}
                    onChange={(e) => setPhotoRetentionDays(Number(e.target.value) || 90)}
                    disabled={!canEdit}
                    helperText="Menentukan masa simpan foto selfie privat (7–730 hari)."
                  />

                  <label
                    className={cn(
                      'flex items-center justify-between gap-4 rounded-xl border p-4 cursor-pointer transition-colors',
                      bypassAttendanceTimeWindow
                        ? 'border-[#F59E0B] bg-[#FFFBEB] hover:bg-[#FEF3C7]/70'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9]/70',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#10264D]">
                        Bypass Batas Waktu Absensi (Mode Uji Coba)
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Mengabaikan sementara jam masuk/pulang &amp; hari libur untuk pengujian.
                        Matikan kembali saat jam sekolah normal.
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className={cn(
                          'text-[11px] font-semibold',
                          bypassAttendanceTimeWindow ? 'text-[#B45309]' : 'text-slate-500',
                        )}
                      >
                        {bypassAttendanceTimeWindow ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <input
                        type="checkbox"
                        checked={bypassAttendanceTimeWindow}
                        disabled={!canEdit || savingToggleKey === 'bypassAttendanceTimeWindow'}
                        onChange={(e) => {
                          const prev = bypassAttendanceTimeWindow;
                          const next = e.target.checked;
                          setBypassAttendanceTimeWindow(next);
                          void patchSingleSetting(
                            'bypassAttendanceTimeWindow',
                            { bypassAttendanceTimeWindow: next },
                            `Bypass Batas Waktu Absensi (${next ? 'Aktif' : 'Nonaktif'})`,
                            () => setBypassAttendanceTimeWindow(prev),
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-[#10264D] cursor-pointer"
                      />
                    </div>
                  </label>
                </div>
              </section>
            </div>
          )}

          {/* TAB 4: KEAMANAN & AKSES */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 space-y-4">
                <div className="border-b border-[#F1F5F9] pb-3">
                  <h2 className="text-sm font-bold text-[#10264D]">
                    Keamanan Login &amp; Pengelolaan Akses
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Atur metode masuk pada halaman login dan akses cepat ke modul akun serta backup.
                  </p>
                </div>

                <label className="flex items-center justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 cursor-pointer hover:bg-[#F1F5F9]/70 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-[#10264D]">
                      Wajib ambilkan/tautkan user dari profil guru
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Mewajibkan pembuatan akun Kepala Sekolah dan Guru diambil/ditautkan langsung
                      dari profil Data Guru aktif (selain akun dasar Super Admin).
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={cn(
                        'text-[11px] font-semibold',
                        requireUserLinkedToTeacher ? 'text-[#15803D]' : 'text-slate-500',
                      )}
                    >
                      {requireUserLinkedToTeacher ? 'Wajib' : 'Opsional'}
                    </span>
                    <input
                      type="checkbox"
                      checked={requireUserLinkedToTeacher}
                      disabled={!canEdit || savingToggleKey === 'requireUserLinkedToTeacher'}
                      onChange={(e) => {
                        const prev = requireUserLinkedToTeacher;
                        const next = e.target.checked;
                        setRequireUserLinkedToTeacher(next);
                        void patchSingleSetting(
                          'requireUserLinkedToTeacher',
                          { requireUserLinkedToTeacher: next },
                          `Wajib Tautkan User ke Profil Guru (${next ? 'Aktif' : 'Nonaktif'})`,
                          () => setRequireUserLinkedToTeacher(prev),
                        );
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-[#10264D] cursor-pointer"
                    />
                  </div>
                </label>

                <label className="flex items-center justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 cursor-pointer hover:bg-[#F1F5F9]/70 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-[#10264D]">
                      Tampilkan Akses Cepat (1-Klik) pada Halaman Login
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Menampilkan tombol masuk cepat akun dasar (Super Admin) pada halaman Login.
                      Matikan opsi ini agar seluruh pengguna masuk dengan mengetik username dan
                      kata sandi secara manual.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={cn(
                        'text-[11px] font-semibold',
                        quickLoginEnabled ? 'text-[#15803D]' : 'text-slate-500',
                      )}
                    >
                      {quickLoginEnabled ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <input
                      type="checkbox"
                      checked={quickLoginEnabled}
                      disabled={!canEdit || savingToggleKey === 'quickLoginEnabled'}
                      onChange={(e) => {
                        const prev = quickLoginEnabled;
                        const next = e.target.checked;
                        setQuickLoginEnabled(next);
                        void patchSingleSetting(
                          'quickLoginEnabled',
                          { quickLoginEnabled: next },
                          `Akses Cepat Login (${next ? 'Aktif' : 'Nonaktif'})`,
                          () => setQuickLoginEnabled(prev),
                        );
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-[#10264D] cursor-pointer"
                    />
                  </div>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="rounded-xl border border-[#E2E8F0] p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#10264D] flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-[#C69B3C]" aria-hidden="true" />
                        Manajemen Akun &amp; Kata Sandi
                      </p>
                      <p className="text-xs text-slate-500">
                        Kelola peran akun dan tentukan kata sandi pengguna secara langsung.
                      </p>
                    </div>
                    <Link to="/admin/users" className="shrink-0">
                      <Button variant="outline" size="sm">
                        Buka Pengguna
                      </Button>
                    </Link>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#10264D] flex items-center gap-1.5">
                        <DatabaseBackup className="h-4 w-4 text-[#C69B3C]" aria-hidden="true" />
                        Backup &amp; Restore Database
                      </p>
                      <p className="text-xs text-slate-500">
                        Ekspor cadangan JSON atau pulihkan seluruh data operasional sekolah.
                      </p>
                    </div>
                    <Link to="/admin/backup" className="shrink-0">
                      <Button variant="gold" size="sm">
                        Buka Backup
                      </Button>
                    </Link>
                  </div>
                </div>
              </section>
            </div>
          )}
        </form>
      </div>
    </AppShell>
  );
}

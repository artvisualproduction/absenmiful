import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileJson,
  History,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTimeJakarta } from '../../lib/date';
import { triggerBlobDownload } from '../../lib/qrCardRenderer';
import {
  adminService,
  type BackupSnapshotResponse,
  type RestorePointSummary,
} from '../../services/adminService';
import { ApiClientError } from '../../services/apiClient';
import { UserRole } from '../../types';

type BackupSectionTab = 'backup' | 'restore-point' | 'factory-reset';

const COLLECTION_LABELS: Record<string, string> = {
  appSettings: 'Pengaturan Sistem',
  academicYears: 'Tahun Ajaran',
  classes: 'Data Kelas',
  subjects: 'Mata Pelajaran',
  students: 'Data Siswa',
  teachers: 'Data Guru',
  studentEnrollments: 'Penempatan Kelas',
  enrollments: 'Penempatan Kelas',
  teachingSchedules: 'Jadwal Mengajar',
  attendanceRules: 'Aturan Jam Absensi',
  schoolLocations: 'Lokasi Geofencing',
  holidays: 'Hari Libur',
  attendanceRecords: 'Catatan Kehadiran',
  teacherPermissions: 'Perizinan Guru',
  users: 'Pengguna',
  qrTokens: 'Token QR',
  fileMetadata: 'Berkas Unggahan',
  publicBrandingAssets: 'Aset Branding',
  teacherUsers: 'Akun Guru',
};

export function BackupRestorePage() {
  useDocumentTitle('Backup & Restore');
  const { user, refreshPublicSettings } = useAuth();
  const { showToast } = useToast();

  const canEdit = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN;
  const [activeTab, setActiveTab] = useState<BackupSectionTab>('backup');

  // Section 1: JSON Backup & Import
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [lastExportMeta, setLastExportMeta] = useState<{
    exportedAt: string;
    counts: Record<string, number>;
  } | null>(null);

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [parsedSnapshot, setParsedSnapshot] = useState<BackupSnapshotResponse | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState<{
    restoredAt: string;
    restoredCounts: Record<string, number>;
  } | null>(null);

  // Section 2: Restore Point (Titik Pemulihan)
  const [restorePoints, setRestorePoints] = useState<RestorePointSummary[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [createPointOpen, setCreatePointOpen] = useState(false);
  const [pointName, setPointName] = useState('');
  const [pointNote, setPointNote] = useState('');
  const [creatingPoint, setCreatingPoint] = useState(false);
  const [applyTarget, setApplyTarget] = useState<RestorePointSummary | null>(null);
  const [applyingPoint, setApplyingPoint] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RestorePointSummary | null>(null);
  const [deletingPoint, setDeletingPoint] = useState(false);

  // Section 3: Format Factory (Setelan Pabrik)
  const [factoryText, setFactoryText] = useState('');
  const [factoryConfirmOpen, setFactoryConfirmOpen] = useState(false);
  const [resettingFactory, setResettingFactory] = useState(false);
  const [factoryResult, setFactoryResult] = useState<{
    resetAt: string;
    clearedCounts: Record<string, number>;
  } | null>(null);
  const [factoryBaseline, setFactoryBaseline] = useState<{
    configured: boolean;
    baseline: RestorePointSummary | null;
  } | null>(null);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [saveBaselineConfirmOpen, setSaveBaselineConfirmOpen] = useState(false);
  const [clearingBaseline, setClearingBaseline] = useState(false);

  const loadRestorePoints = useCallback(async () => {
    setLoadingPoints(true);
    try {
      const [res, baselineRes] = await Promise.all([
        adminService.listRestorePoints(),
        adminService.getFactoryBaselineStatus().catch(() => null),
      ]);
      setRestorePoints(res.items);
      if (baselineRes) {
        setFactoryBaseline(baselineRes);
      }
    } catch {
      // Keep UI clean; toast only when user opens tab or triggers action
    } finally {
      setLoadingPoints(false);
    }
  }, []);

  useEffect(() => {
    void loadRestorePoints();
  }, [loadRestorePoints]);

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const snapshot = await adminService.exportBackup();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: 'application/json',
      });
      const dateStamp = new Date().toISOString().slice(0, 10);
      triggerBlobDownload(blob, `backup-absensi-mi-miftahul-ulum-${dateStamp}.json`);
      setLastExportMeta({
        exportedAt: snapshot.exportedAt,
        counts: snapshot.counts,
      });
      showToast({
        variant: 'success',
        title: 'Backup JSON berhasil diunduh',
        message: 'Seluruh master data dan riwayat operasional berhasil diekspor dengan aman.',
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengekspor backup',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan saat mengekspor.',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleSelectRestoreFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setParseError(null);
    setParsedSnapshot(null);
    setRestoreSummary(null);
    setSelectedFileName(file.name);

    try {
      const text = await file.text();
      const json = JSON.parse(text) as Record<string, unknown>;
      if (
        !json ||
        typeof json !== 'object' ||
        !json.collections ||
        typeof json.collections !== 'object'
      ) {
        setParseError(
          'Format berkas backup tidak valid. Pastikan menggunakan berkas .json hasil ekspor sistem ini.',
        );
        return;
      }

      const collections = json.collections as Record<string, unknown[]>;
      const counts: Record<string, number> = {};
      for (const [key, val] of Object.entries(collections)) {
        if (Array.isArray(val)) {
          counts[key] = val.length;
        }
      }

      setParsedSnapshot({
        schemaVersion: String(json.schemaVersion ?? '1.0'),
        exportedAt: String(json.exportedAt ?? new Date().toISOString()),
        exportedBy: String(json.exportedBy ?? '-'),
        counts,
        collections,
      });
    } catch {
      setParseError('Gagal membaca berkas JSON. Pastikan berkas tidak rusak.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!parsedSnapshot || !canEdit) return;
    setRestoring(true);
    try {
      const res = await adminService.restoreBackup(parsedSnapshot);
      setRestoreConfirmOpen(false);
      setRestoreSummary({
        restoredAt: res.restoredAt,
        restoredCounts: res.restoredCounts,
      });
      await refreshPublicSettings();
      showToast({
        variant: 'success',
        title: 'Restore data berhasil',
        message: 'Seluruh data dari arsip backup JSON telah dipulihkan.',
      });
    } catch (err) {
      setRestoreConfirmOpen(false);
      showToast({
        variant: 'error',
        title: 'Gagal memulihkan data backup',
        message:
          err instanceof ApiClientError
            ? err.message
            : 'Periksa format berkas backup lalu coba lagi.',
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleCreateRestorePoint = async () => {
    if (!canEdit) return;
    if (pointName.trim().length < 3) {
      showToast({
        variant: 'warning',
        title: 'Nama Restore Point terlalu pendek',
        message: 'Masukkan minimal 3 karakter untuk menandai titik pemulihan.',
      });
      return;
    }

    setCreatingPoint(true);
    try {
      const created = await adminService.createRestorePoint({
        name: pointName.trim(),
        note: pointNote.trim() || undefined,
      });
      setRestorePoints((prev) => [created, ...prev]);
      setCreatePointOpen(false);
      setPointName('');
      setPointNote('');
      showToast({
        variant: 'success',
        title: 'Restore Point disimpan',
        message: `Titik pemulihan "${created.name}" siap dipulihkan kapan saja.`,
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal membuat Restore Point',
        message: err instanceof ApiClientError ? err.message : 'Silakan coba kembali.',
      });
    } finally {
      setCreatingPoint(false);
    }
  };

  const handleApplyRestorePoint = async () => {
    if (!applyTarget || !canEdit) return;
    setApplyingPoint(true);
    try {
      const res = await adminService.restoreFromPoint(applyTarget.id);
      setApplyTarget(null);
      await refreshPublicSettings();
      showToast({
        variant: 'success',
        title: 'Sistem dipulihkan',
        message: `Seluruh data kembali ke titik pemulihan "${res.restorePointName}".`,
      });
    } catch (err) {
      setApplyTarget(null);
      showToast({
        variant: 'error',
        title: 'Gagal memulihkan titik pemulihan',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan saat memulihkan.',
      });
    } finally {
      setApplyingPoint(false);
    }
  };

  const handleDeleteRestorePoint = async () => {
    if (!deleteTarget || !canEdit) return;
    setDeletingPoint(true);
    try {
      await adminService.deleteRestorePoint(deleteTarget.id);
      setRestorePoints((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast({
        variant: 'success',
        title: 'Restore Point dihapus',
        message: 'Titik pemulihan telah dihapus dari daftar.',
      });
    } catch (err) {
      setDeleteTarget(null);
      showToast({
        variant: 'error',
        title: 'Gagal menghapus Restore Point',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan saat menghapus.',
      });
    } finally {
      setDeletingPoint(false);
    }
  };

  const handleSaveFactoryBaseline = async () => {
    if (!canEdit) return;
    setSavingBaseline(true);
    try {
      const res = await adminService.saveFactoryBaseline();
      setFactoryBaseline(res);
      setSaveBaselineConfirmOpen(false);
      showToast({
        variant: 'success',
        title: 'Setelan Pabrik diperbarui',
        message:
          'Kondisi setelan dan database sekolah saat ini telah ditetapkan sebagai acuan Reset Pabrik.',
      });
    } catch (err) {
      setSaveBaselineConfirmOpen(false);
      showToast({
        variant: 'error',
        title: 'Gagal menyimpan Setelan Pabrik',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan sistem.',
      });
    } finally {
      setSavingBaseline(false);
    }
  };

  const handleClearFactoryBaseline = async () => {
    if (!canEdit) return;
    setClearingBaseline(true);
    try {
      const res = await adminService.clearFactoryBaseline();
      setFactoryBaseline(res);
      showToast({
        variant: 'success',
        title: 'Acuan pabrik dikembalikan ke bawaan resmi',
        message:
          'Format Factory kini akan mengosongkan siswa, guru, kelas, dan jadwal agar siap diisi ulang dari awal.',
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengembalikan acuan pabrik',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan sistem.',
      });
    } finally {
      setClearingBaseline(false);
    }
  };

  const handleConfirmFactoryReset = async () => {
    if (!canEdit || factoryText.trim() !== 'RESET PABRIK') return;
    setResettingFactory(true);
    try {
      const res = await adminService.factoryReset({ confirmationText: 'RESET PABRIK' });
      setFactoryConfirmOpen(false);
      setFactoryText('');
      setFactoryResult({
        resetAt: res.resetAt,
        clearedCounts: res.clearedCounts,
      });
      await refreshPublicSettings();
      showToast({
        variant: 'success',
        title: 'Format Factory berhasil',
        message: res.usedCustomBaseline
          ? 'Seluruh data & setelan telah dikembalikan ke Setelan Pabrik yang tersimpan.'
          : 'Data master & setelan telah dikembalikan ke setelan pabrik resmi MI MIFTAHUL ULUM.',
      });
    } catch (err) {
      setFactoryConfirmOpen(false);
      showToast({
        variant: 'error',
        title: 'Gagal menjalankan Format Factory',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan sistem.',
      });
    } finally {
      setResettingFactory(false);
    }
  };

  return (
    <AppShell
      title="Backup & Restore Data"
      subtitle="Kelola cadangan JSON, titik pemulihan server (Restore Point), hingga Format Factory."
    >
      <div className="space-y-6">
        {!canEdit && (
          <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5 text-xs text-[#92400E]">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Anda masuk sebagai <strong>Kepala Sekolah</strong>. Pemulihan data, pembuatan Restore
              Point, dan Format Factory hanya diizinkan untuk Super Admin atau Admin Sekolah.
            </span>
          </div>
        )}

        {/* Navigation Tabs: 3 Sections */}
        <div
          role="tablist"
          aria-label="Bagian Backup dan Restore"
          className="inline-flex flex-wrap gap-1.5 rounded-2xl border border-[#E2E8F0] bg-white p-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'backup'}
            onClick={() => setActiveTab('backup')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'backup'
                ? 'bg-[#10264D] text-white shadow-xs'
                : 'text-slate-600 hover:bg-[#F8FAFC] hover:text-[#10264D]'
            }`}
          >
            <DatabaseBackup className="h-4 w-4" aria-hidden="true" />
            <span>1. Backup (Ekspor / Impor JSON)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'restore-point'}
            onClick={() => setActiveTab('restore-point')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'restore-point'
                ? 'bg-[#10264D] text-white shadow-xs'
                : 'text-slate-600 hover:bg-[#F8FAFC] hover:text-[#10264D]'
            }`}
          >
            <History className="h-4 w-4" aria-hidden="true" />
            <span>2. Restore Point</span>
            <span
              className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ${
                activeTab === 'restore-point'
                  ? 'bg-white/15 text-[#F4D078]'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {restorePoints.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'factory-reset'}
            onClick={() => setActiveTab('factory-reset')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'factory-reset'
                ? 'bg-[#B91C1C] text-white shadow-xs'
                : 'text-slate-600 hover:bg-[#FEF2F2] hover:text-[#B91C1C]'
            }`}
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span>3. Format Factory</span>
          </button>
        </div>

        {/* SECTION 1: BACKUP JSON EXPORT & IMPORT */}
        {activeTab === 'backup' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Export JSON */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-[#F1F5F9] pb-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-[#10264D] flex items-center gap-2">
                      <DatabaseBackup className="h-5 w-5 text-[#C69B3C]" aria-hidden="true" />
                      Ekspor Backup Sistem (JSON)
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Mengunduh arsip lengkap master data (siswa, guru, kelas, mapel), jadwal
                      mengajar, aturan jam, lokasi GPS, riwayat kehadiran, dan perizinan tanpa
                      kata sandi maupun token rahasia.
                    </p>
                  </div>
                  <StatusBadge label="Aman" tone="success" />
                </div>

                {lastExportMeta ? (
                  <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 space-y-2">
                    <p className="text-xs font-semibold text-[#15803D] flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Backup terakhir diunduh ({formatDateTimeJakarta(lastExportMeta.exportedAt)})
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700 pt-1">
                      {Object.entries(lastExportMeta.counts).map(([key, count]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="truncate">{COLLECTION_LABELS[key] ?? key}</span>
                          <span className="font-mono font-bold text-[#10264D] tabular-nums">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-slate-600 space-y-1.5">
                    <p className="font-semibold text-[#10264D]">Rekomendasi Jadwal Cadangan</p>
                    <p>
                      Unduh arsip JSON secara berkala setiap akhir pekan atau sebelum melakukan
                      perubahan massal seperti impor data siswa, guru, atau penghapusan data lama.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <Button
                  variant="gold"
                  fullWidth
                  loading={exporting}
                  onClick={() => void handleExportBackup()}
                  leftIcon={<Download className="h-4 w-4" />}
                >
                  Unduh Arsip Backup (.JSON)
                </Button>
              </div>
            </section>

            {/* Import JSON */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-[#F1F5F9] pb-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-[#10264D] flex items-center gap-2">
                      <RotateCcw className="h-5 w-5 text-[#10264D]" aria-hidden="true" />
                      Impor &amp; Pulihkan dari Arsip (.JSON)
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Memulihkan data sekolah dari berkas JSON backup. Kata sandi keluar portal dan
                      kredensial login admin Anda saat ini tetap dijaga agar akses tidak terputus.
                    </p>
                  </div>
                  <StatusBadge label="Hati-hati" tone="warning" />
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center space-y-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => void handleSelectRestoreFile(e)}
                  />
                  <FileJson className="h-7 w-7 text-[#10264D]/70" aria-hidden="true" />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canEdit || restoring}
                    onClick={() => fileInputRef.current?.click()}
                    leftIcon={<Upload className="h-3.5 w-3.5" />}
                  >
                    {selectedFileName ? 'Pilih Berkas Backup Lain' : 'Pilih Berkas Backup (.json)'}
                  </Button>
                  {selectedFileName && (
                    <p className="text-xs text-slate-600">
                      Berkas dipilih:{' '}
                      <span className="font-semibold text-[#10264D]">{selectedFileName}</span>
                    </p>
                  )}
                </div>

                {parseError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{parseError}</span>
                  </div>
                )}

                {parsedSnapshot && (
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#FCF9F1] p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#10264D]">Pratinjau Isi Arsip Backup</p>
                      <span className="font-mono text-[11px] text-slate-600">
                        Diekspor: {formatDateTimeJakarta(parsedSnapshot.exportedAt)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
                      {Object.entries(parsedSnapshot.counts).map(([key, count]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="truncate">{COLLECTION_LABELS[key] ?? key}</span>
                          <span className="font-mono font-bold text-[#10264D] tabular-nums">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {restoreSummary && (
                  <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 space-y-2">
                    <p className="text-xs font-bold text-[#15803D] flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Restore selesai pada {formatDateTimeJakarta(restoreSummary.restoredAt)}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
                      {Object.entries(restoreSummary.restoredCounts).map(([key, count]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="truncate">{COLLECTION_LABELS[key] ?? key}</span>
                          <span className="font-mono font-bold text-[#15803D] tabular-nums">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Button
                  variant="danger"
                  fullWidth
                  disabled={!canEdit || !parsedSnapshot || restoring}
                  loading={restoring}
                  onClick={() => setRestoreConfirmOpen(true)}
                  leftIcon={<RotateCcw className="h-4 w-4" />}
                >
                  Pulihkan Data dari Backup Ini
                </Button>
              </div>
            </section>
          </div>
        )}

        {/* SECTION 2: RESTORE POINT (TITIK PEMULIHAN) */}
        {activeTab === 'restore-point' && (
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#F1F5F9] pb-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#10264D] flex items-center gap-2">
                  <History className="h-5 w-5 text-[#C69B3C]" aria-hidden="true" />
                  Titik Pemulihan Sistem (Restore Point)
                </h2>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Simpan snapshot kondisi database saat ini langsung di server agar dapat dipulihkan
                  kapan saja tanpa harus mengunggah berkas JSON secara manual.
                </p>
              </div>

              {canEdit && (
                <Button
                  variant="gold"
                  onClick={() => setCreatePointOpen(true)}
                  leftIcon={<BookmarkPlus className="h-4 w-4" />}
                >
                  Buat Restore Point
                </Button>
              )}
            </div>

            {loadingPoints ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : restorePoints.length === 0 ? (
              <EmptyState
                title="Belum ada Restore Point tersimpan"
                description="Buat titik pemulihan sebelum melakukan pembaruan jadwal, impor siswa massal, atau perubahan aturan jam."
                action={
                  canEdit ? (
                    <Button variant="gold" size="sm" onClick={() => setCreatePointOpen(true)}>
                      Buat Restore Point Pertama
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Nama Titik Pemulihan</th>
                      <th className="py-3 px-4">Ringkasan Data</th>
                      <th className="py-3 px-4">Dibuat Oleh</th>
                      <th className="py-3 px-4">Waktu</th>
                      {canEdit && <th className="py-3 px-4 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9] text-sm">
                    {restorePoints.map((rp) => (
                      <tr key={rp.id} className="hover:bg-[#F8FAFC]/80">
                        <td className="py-3.5 px-4 align-top">
                          <p className="font-semibold text-[#10264D]">{rp.name}</p>
                          {rp.note && <p className="text-xs text-slate-500 mt-0.5">{rp.note}</p>}
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-700">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5">
                              Siswa: {rp.counts.students ?? 0}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5">
                              Guru: {rp.counts.teachers ?? 0}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5">
                              Kelas: {rp.counts.classes ?? 0}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5">
                              Absen: {rp.counts.attendanceRecords ?? 0}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top text-xs text-slate-600 font-medium">
                          {rp.createdByName}
                        </td>
                        <td className="py-3.5 px-4 align-top font-mono text-xs text-slate-600 whitespace-nowrap">
                          {formatDateTimeJakarta(rp.createdAt)}
                        </td>
                        {canEdit && (
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                title="Pulihkan sistem ke titik ini"
                                aria-label={`Pulihkan ke ${rp.name}`}
                                onClick={() => setApplyTarget(rp)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#FCF9F1] hover:border-[#C69B3C] transition-colors"
                              >
                                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                title="Hapus Restore Point"
                                aria-label={`Hapus ${rp.name}`}
                                onClick={() => setDeleteTarget(rp)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#FECACA] bg-white text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* SECTION 3: FORMAT FACTORY (SETELAN PABRIK) */}
        {activeTab === 'factory-reset' && (
          <div className="space-y-6">
            {/* Baseline Pabrik Kustom Card */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-[#F1F5F9] pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-[#10264D] flex items-center gap-2">
                      <BookmarkPlus className="h-5 w-5 text-[#C69B3C]" aria-hidden="true" />
                      Acuan Setelan &amp; Database Pabrik
                    </h2>
                    {factoryBaseline?.configured ? (
                      <StatusBadge label="Baseline Kustom Aktif" tone="success" />
                    ) : (
                      <StatusBadge label="Bawaan Resmi MI MIFTAHUL ULUM" tone="info" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                    Secara bawaan, Reset Pabrik mengembalikan setelan resmi{' '}
                    <strong>MI MIFTAHUL ULUM</strong> (nama PWA <strong>MiFUL</strong>, logo &amp;
                    latar sekolah, 2 aturan umum absensi, dengan <strong>0 siswa</strong>,{' '}
                    <strong>0 guru</strong>, <strong>0 kelas</strong>, <strong>0 mapel</strong>, dan{' '}
                    <strong>0 jadwal mengajar</strong>) agar Anda dapat menambahkannya sendiri. Anda
                    juga dapat membekukan kondisi saat ini sebagai Setelan Pabrik kustom.
                  </p>
                </div>

                {canEdit && (
                  <div className="flex flex-wrap items-center gap-2">
                    {factoryBaseline?.configured && (
                      <Button
                        variant="outline"
                        size="sm"
                        loading={clearingBaseline}
                        onClick={() => void handleClearFactoryBaseline()}
                        leftIcon={<RotateCcw className="h-4 w-4" />}
                      >
                        Pakai Bawaan Bersih
                      </Button>
                    )}
                    <Button
                      variant="gold"
                      size="sm"
                      loading={savingBaseline}
                      onClick={() => setSaveBaselineConfirmOpen(true)}
                      leftIcon={<BookmarkPlus className="h-4 w-4" />}
                    >
                      Jadikan Setelan &amp; Database Saat Ini Sebagai Setelan Pabrik
                    </Button>
                  </div>
                )}
              </div>

              {factoryBaseline?.configured && factoryBaseline.baseline ? (
                <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-[#15803D] flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Setelan Pabrik Kustom tersimpan ({formatDateTimeJakarta(factoryBaseline.baseline.createdAt)})
                    </p>
                    <p className="text-slate-600">
                      Disimpan oleh <strong className="text-[#10264D]">{factoryBaseline.baseline.createdByName}</strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-700">
                    <span className="rounded-md bg-white border border-[#BBF7D0] px-2 py-0.5">
                      Guru: {factoryBaseline.baseline.counts.teachers ?? 0}
                    </span>
                    <span className="rounded-md bg-white border border-[#BBF7D0] px-2 py-0.5">
                      Kelas: {factoryBaseline.baseline.counts.classes ?? 0}
                    </span>
                    <span className="rounded-md bg-white border border-[#BBF7D0] px-2 py-0.5">
                      Mapel: {factoryBaseline.baseline.counts.subjects ?? 0}
                    </span>
                    <span className="rounded-md bg-white border border-[#BBF7D0] px-2 py-0.5">
                      Siswa: {factoryBaseline.baseline.counts.students ?? 0}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-slate-600">
                  Belum ada baseline kustom tersimpan — tombol <strong>Format Factory</strong> akan
                  memulihkan setelan resmi <strong>MI MIFTAHUL ULUM</strong> dengan database siswa,
                  guru, kelas, mata pelajaran, dan jadwal yang bersih (0 data seed/demo).
                </div>
              )}
            </section>

            {/* Zona Reset Permanen */}
            <section className="rounded-2xl border border-[#FECACA] bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-[#7F1D1D] to-[#991B1B] px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FCA5A5]">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    Zona Reset Permanen
                  </span>
                  <h2 className="text-lg font-bold tracking-tight">
                    Format Factory (Setelan Awal Pabrik)
                  </h2>
                  <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
                    Membersihkan data siswa, guru, kelas, jadwal mengajar, riwayat absensi,
                    perizinan guru, dan token QR di luar acuan pabrik yang aktif.
                  </p>
                </div>
                <StatusBadge label="Tindakan Kritis" tone="danger" />
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 space-y-1.5">
                    <p className="font-bold text-[#991B1B]">Data operasional yang dibersihkan:</p>
                    <ul className="list-disc pl-4 space-y-1 text-[#7F1D1D]">
                      <li>Seluruh riwayat kehadiran, foto selfie, perizinan guru, &amp; token QR terbit</li>
                      <li>Seluruh data siswa, data guru, kelas, mata pelajaran, dan jadwal mengajar di luar baseline aktif</li>
                      <li>Akun login guru yang tidak termasuk dalam baseline pabrik aktif</li>
                      <li>Aset unggahan sementara di luar branding baseline pabrik</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-1.5">
                    <p className="font-bold text-[#10264D]">Data yang dipulihkan sesuai Setelan Pabrik:</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      <li>Akun Super Admin, Admin Sekolah, dan Kepala Sekolah tetap aktif</li>
                      <li>Identitas <strong>MI MIFTAHUL ULUM</strong>, nama PWA <strong>MiFUL</strong>, logo &amp; latar sekolah</li>
                      <li>Tahun Ajaran 2026/2027, lokasi GPS utama, &amp; hari libur (0 data demo mapel)</li>
                      <li>Aturan jam absensi umum siswa &amp; guru (siap digunakan saat kelas/guru ditambahkan)</li>
                    </ul>
                  </div>
                </div>

                {factoryResult && (
                  <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 space-y-2">
                    <p className="text-xs font-bold text-[#15803D] flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Format Factory selesai pada {formatDateTimeJakarta(factoryResult.resetAt)}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-700">
                      {Object.entries(factoryResult.clearedCounts).map(([key, count]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="truncate">{COLLECTION_LABELS[key] ?? key}</span>
                          <span className="font-mono font-bold text-[#15803D] tabular-nums">
                            {count} diproses
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="max-w-md space-y-3 pt-1">
                  <Input
                    label="Ketik RESET PABRIK untuk mengaktifkan tombol format"
                    placeholder="RESET PABRIK"
                    value={factoryText}
                    onChange={(e) => setFactoryText(e.target.value)}
                    disabled={!canEdit || resettingFactory}
                    className="font-mono uppercase"
                  />

                  <Button
                    variant="danger"
                    disabled={!canEdit || factoryText.trim() !== 'RESET PABRIK' || resettingFactory}
                    loading={resettingFactory}
                    onClick={() => setFactoryConfirmOpen(true)}
                    leftIcon={<AlertTriangle className="h-4 w-4" />}
                  >
                    Jalankan Format Factory Sekarang
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Create Restore Point Modal */}
      <Modal
        open={createPointOpen}
        onClose={() => {
          if (!creatingPoint) setCreatePointOpen(false);
        }}
        title="Buat Restore Point Baru"
        description="Simpan titik pemulihan kondisi seluruh data saat ini ke server."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setCreatePointOpen(false)}
              disabled={creatingPoint}
            >
              Batal
            </Button>
            <Button
              variant="gold"
              loading={creatingPoint}
              onClick={() => void handleCreateRestorePoint()}
            >
              Simpan Restore Point
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nama Titik Pemulihan"
            required
            placeholder="Contoh: Sebelum Impor Siswa Semester Genap"
            value={pointName}
            onChange={(e) => setPointName(e.target.value)}
          />
          <Input
            label="Catatan (Opsional)"
            placeholder="Keterangan singkat kondisi data saat ini"
            value={pointNote}
            onChange={(e) => setPointNote(e.target.value)}
          />
        </div>
      </Modal>

      {/* Confirm Restore from JSON */}
      <ConfirmDialog
        open={restoreConfirmOpen}
        onClose={() => !restoring && setRestoreConfirmOpen(false)}
        onConfirm={handleConfirmRestore}
        title="Konfirmasi Restore Data Backup"
        message="Data operasional saat ini pada koleksi yang ada di berkas backup akan digantikan sesuai arsip tersebut. Disarankan mengunduh backup kondisi terbaru terlebih dahulu sebelum melanjutkan."
        confirmLabel="Ya, Pulihkan Sekarang"
        variant="danger"
        loading={restoring}
      />

      {/* Confirm Apply Restore Point */}
      <ConfirmDialog
        open={Boolean(applyTarget)}
        onClose={() => !applyingPoint && setApplyTarget(null)}
        onConfirm={handleApplyRestorePoint}
        title="Pulihkan ke Restore Point?"
        message={
          applyTarget
            ? `Seluruh data saat ini akan dikembalikan sesuai titik pemulihan "${applyTarget.name}". Kredensial admin aktif tetap dijaga agar tidak terputus.`
            : ''
        }
        confirmLabel="Ya, Pulihkan Sekarang"
        variant="danger"
        loading={applyingPoint}
      />

      {/* Confirm Delete Restore Point */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => !deletingPoint && setDeleteTarget(null)}
        onConfirm={handleDeleteRestorePoint}
        title="Hapus Restore Point?"
        message={
          deleteTarget
            ? `Titik pemulihan "${deleteTarget.name}" akan dihapus permanen.`
            : ''
        }
        confirmLabel="Hapus"
        variant="danger"
        loading={deletingPoint}
      />

      {/* Confirm Save Factory Baseline */}
      <ConfirmDialog
        open={saveBaselineConfirmOpen}
        onClose={() => !savingBaseline && setSaveBaselineConfirmOpen(false)}
        onConfirm={handleSaveFactoryBaseline}
        title="Jadikan Kondisi Saat Ini Sebagai Setelan Pabrik?"
        message="Seluruh pengaturan aplikasi, branding, serta master data dan database saat ini akan disimpan sebagai acuan resmi Format Factory (Reset Pabrik) menggantikan acuan sebelumnya."
        confirmLabel="Ya, Simpan Sebagai Setelan Pabrik"
        variant="primary"
        loading={savingBaseline}
      />

      {/* Confirm Format Factory */}
      <ConfirmDialog
        open={factoryConfirmOpen}
        onClose={() => !resettingFactory && setFactoryConfirmOpen(false)}
        onConfirm={handleConfirmFactoryReset}
        title="Konfirmasi Akhir Format Factory"
        message="Data operasional saat ini akan dibersihkan dan dikembalikan ke Setelan & Database Pabrik yang aktif. Anda yakin ingin melanjutkan?"
        confirmLabel="Ya, Format Factory Sekarang"
        variant="danger"
        loading={resettingFactory}
      />
    </AppShell>
  );
}

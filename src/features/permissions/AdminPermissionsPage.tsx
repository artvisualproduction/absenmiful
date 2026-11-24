import { type FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck2,
  Paperclip,
  RotateCcw,
  Search,
  Send,
} from 'lucide-react';
import { Input } from '../../components/forms/Input';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { mapStatusToBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTimeJakarta } from '../../lib/date';
import {
  PERMISSION_LEAVE_TYPE_LABELS,
  PERMISSION_STATUS_LABELS,
} from '../../lib/permissionValidation';
import { ApiClientError } from '../../services/apiClient';
import { attendanceService } from '../../services/attendanceService';
import {
  permissionService,
  type EnrichedPermission,
  type PermissionListResponse,
} from '../../services/permissionService';
import { PermissionStatus, ReviewDecision } from '../../types';

const STATUS_TABS: Array<{ value: PermissionStatus | ''; label: string }> = [
  { value: PermissionStatus.SUBMITTED, label: 'Menunggu Admin' },
  { value: PermissionStatus.ADMIN_REVIEWED, label: 'Menunggu Kepsek' },
  { value: PermissionStatus.RETURNED, label: 'Dikembalikan' },
  { value: PermissionStatus.APPROVED, label: 'Disetujui' },
  { value: PermissionStatus.REJECTED, label: 'Ditolak' },
  { value: '', label: 'Semua' },
];

export function AdminPermissionsPage() {
  useDocumentTitle('Verifikasi Perizinan Guru');
  const { showToast } = useToast();

  const [items, setItems] = useState<EnrichedPermission[]>([]);
  const [counts, setCounts] = useState<PermissionListResponse['counts']>({
    total: 0,
    pendingAdmin: 0,
    pendingPrincipal: 0,
    returned: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  });
  const [statusFilter, setStatusFilter] = useState<PermissionStatus | ''>(
    PermissionStatus.SUBMITTED,
  );
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Policy setting toggle (approvedPermissionAffectsRecap)
  const [affectsRecap, setAffectsRecap] = useState<boolean>(true);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Admin Review Modal
  const [reviewTarget, setReviewTarget] = useState<EnrichedPermission | null>(null);
  const [reviewDecision, setReviewDecision] = useState<
    ReviewDecision.RECOMMEND_APPROVE | ReviewDecision.RETURN
  >(ReviewDecision.RECOMMEND_APPROVE);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Private Attachment Viewer Modal
  const [previewAttachment, setPreviewAttachment] = useState<{
    fileId: string;
    signedUrl: string | null;
    mimeType: string;
    loading: boolean;
  } | null>(null);

  const loadPermissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await permissionService.listPermissions({
        status: statusFilter,
        search: debouncedSearch || undefined,
        limit: 1000,
      });
      setItems(res.items);
      setCounts(res.counts);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat daftar perizinan guru.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPermissions();
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    void attendanceService
      .getGpsSettings()
      .then((cfg) => {
        setAffectsRecap(cfg.approvedPermissionAffectsRecap ?? true);
      })
      .catch(() => undefined);
  }, []);

  const handleToggleRecapPolicy = async () => {
    const nextValue = !affectsRecap;
    setSavingPolicy(true);
    try {
      const updated = await attendanceService.updateGpsSettings({
        approvedPermissionAffectsRecap: nextValue,
      });
      setAffectsRecap(updated.approvedPermissionAffectsRecap ?? nextValue);
      showToast({
        variant: 'success',
        title: 'Kebijakan rekap izin diperbarui',
        message: nextValue
          ? 'Izin disetujui otomatis berstatus Sakit/Izin pada rekap laporan.'
          : 'Izin disetujui tidak mengubah perhitungan alfa di rekap laporan.',
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menyimpan kebijakan',
        message: err instanceof ApiClientError ? err.message : 'Periksa hak akses Anda.',
      });
    } finally {
      setSavingPolicy(false);
    }
  };

  const openReviewModal = (
    item: EnrichedPermission,
    defaultDecision: ReviewDecision.RECOMMEND_APPROVE | ReviewDecision.RETURN,
  ) => {
    setReviewTarget(item);
    setReviewDecision(defaultDecision);
    setReviewNote('');
    setReviewError(null);
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    setReviewError(null);

    if (reviewDecision === ReviewDecision.RETURN && reviewNote.trim().length < 5) {
      setReviewError('Catatan wajib diisi minimal 5 karakter saat mengembalikan ke guru.');
      return;
    }

    setSubmittingReview(true);
    try {
      await permissionService.adminReview(reviewTarget.id, {
        decision: reviewDecision,
        note: reviewNote.trim(),
      });
      showToast({
        variant: 'success',
        title:
          reviewDecision === ReviewDecision.RECOMMEND_APPROVE
            ? 'Rekomendasi dikirim ke Kepala Sekolah'
            : 'Pengajuan dikembalikan ke guru',
      });
      setReviewTarget(null);
      await loadPermissions();
    } catch (err) {
      setReviewError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan hasil verifikasi.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleViewAttachment = async (storagePath: string) => {
    setPreviewAttachment({ fileId: storagePath, signedUrl: null, mimeType: '', loading: true });
    try {
      const res = await attendanceService.getSignedFileUrl({ storagePath });
      setPreviewAttachment({
        fileId: storagePath,
        signedUrl: res.signedUrl,
        mimeType: res.mimeType,
        loading: false,
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal membuka lampiran',
        message: err instanceof ApiClientError ? err.message : 'Tautan sementara gagal dibuat.',
      });
      setPreviewAttachment(null);
    }
  };

  const columns: Array<TableColumn<EnrichedPermission>> = [
    {
      key: 'teacher',
      header: 'Guru Pemohon',
      render: (row) => (
        <div>
          <p className="font-semibold text-[#10264D]">{row.teacherNameSnapshot}</p>
          <p className="text-xs text-slate-500">
            {PERMISSION_LEAVE_TYPE_LABELS[row.leaveType]} ·{' '}
            {formatDateTimeJakarta(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Rentang Izin',
      render: (row) => (
        <div className="font-mono text-xs text-slate-700 tabular-nums space-y-0.5">
          <p>{formatDateTimeJakarta(row.startAt)}</p>
          <p className="text-slate-400">s.d. {formatDateTimeJakarta(row.endAt)}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Alasan & Lampiran',
      render: (row) => (
        <div className="max-w-xs space-y-1.5">
          <p className="text-xs text-slate-700 line-clamp-2" title={row.reason}>
            {row.reason}
          </p>
          {row.attachmentPaths && row.attachmentPaths.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {row.attachmentPaths.map((storagePath, idx) => (
                <button
                  key={storagePath}
                  type="button"
                  onClick={() => void handleViewAttachment(storagePath)}
                  className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-medium text-[#10264D] hover:border-[#C69B3C] cursor-pointer"
                >
                  <Paperclip className="h-3 w-3 text-[#8D6B22]" />
                  <span>Lampiran #{idx + 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status & Catatan',
      render: (row) => {
        const badge = mapStatusToBadge(row.status);
        return (
          <div className="space-y-1">
            <StatusBadge label={badge.label} tone={badge.tone} />
            {row.adminReview?.reviewedAt && (
              <p
                className="text-[11px] text-slate-500 max-w-[200px] truncate"
                title={row.adminReview.note ?? undefined}
              >
                Admin: {row.adminReview.note || 'Direkomendasikan'}
              </p>
            )}
            {row.principalDecision?.decidedAt && (
              <p
                className="text-[11px] text-slate-500 max-w-[200px] truncate"
                title={row.principalDecision.note ?? undefined}
              >
                Kepsek: {row.principalDecision.note || PERMISSION_STATUS_LABELS[row.status]}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (row) =>
        row.status === PermissionStatus.SUBMITTED ? (
          <div className="inline-flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => openReviewModal(row, ReviewDecision.RECOMMEND_APPROVE)}
              title={`Verifikasi & teruskan pengajuan ${row.teacherNameSnapshot}`}
              aria-label={`Verifikasi pengajuan ${row.teacherNameSnapshot}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#10264D] bg-[#10264D] text-white hover:bg-[#19386B] transition-colors cursor-pointer"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => openReviewModal(row, ReviewDecision.RETURN)}
              title={`Kembalikan pengajuan ${row.teacherNameSnapshot}`}
              aria-label={`Kembalikan pengajuan ${row.teacherNameSnapshot}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#B45309] hover:bg-[#FFFBEB] hover:border-[#FDE68A] transition-colors cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  return (
    <AppShell
      title="Verifikasi Perizinan Guru"
      subtitle="Periksa kelengkapan alasan & lampiran guru, lalu teruskan rekomendasi ke Kepala Sekolah atau kembalikan untuk perbaikan."
    >
      <div className="space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Menunggu Verifikasi Admin"
            value={counts.pendingAdmin}
            subtext="Perlu diperiksa sekarang"
            accent={counts.pendingAdmin > 0 ? 'warning' : 'navy'}
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            label="Menunggu Kepala Sekolah"
            value={counts.pendingPrincipal}
            subtext="Sudah direkomendasikan Admin"
            accent="gold"
            icon={<Send className="h-5 w-5" />}
          />
          <StatCard
            label="Dikembalikan ke Guru"
            value={counts.returned}
            subtext="Menunggu perbaikan pemohon"
            accent="navy"
            icon={<RotateCcw className="h-5 w-5" />}
          />
          <StatCard
            label="Disetujui Kepala Sekolah"
            value={counts.approved}
            subtext={`Ditolak: ${counts.rejected} · Batal: ${counts.cancelled}`}
            accent="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </div>

        {/* Policy Toggle Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white px-5 py-3.5">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-[#10264D]">
              Kebijakan Dampak Izin Disetujui pada Rekap Kehadiran
            </p>
            <p className="text-xs text-slate-500">
              {affectsRecap
                ? 'Aktif: Hari izin guru yang disetujui otomatis dihitung sebagai SAKIT/IZIN (bukan Alfa).'
                : 'Nonaktif: Izin disetujui tetap dicatat tetapi tidak mengecualikan hari alfa pada rekap.'}
            </p>
          </div>
          <Button
            variant={affectsRecap ? 'primary' : 'outline'}
            size="sm"
            loading={savingPolicy}
            onClick={() => void handleToggleRecapPolicy()}
            leftIcon={<FileCheck2 className="h-3.5 w-3.5" />}
          >
            {affectsRecap ? 'Aktif di Rekap' : 'Aktifkan di Rekap'}
          </Button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            const badgeNum =
              tab.value === PermissionStatus.SUBMITTED
                ? counts.pendingAdmin
                : tab.value === PermissionStatus.ADMIN_REVIEWED
                  ? counts.pendingPrincipal
                  : null;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-[#10264D] bg-[#10264D] text-white'
                    : 'border-[#E2E8F0] bg-white text-slate-600 hover:border-[#10264D] hover:text-[#10264D]'
                }`}
              >
                <span>{tab.label}</span>
                {badgeNum !== null && badgeNum > 0 && (
                  <span
                    className={`rounded px-1.5 py-0.2 text-[11px] font-mono tabular-nums ${
                      active ? 'bg-[#C69B3C] text-[#10264D]' : 'bg-[#FEF2F2] text-[#B91C1C]'
                    }`}
                  >
                    {badgeNum}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Tidak ada pengajuan izin pada filter ini"
          emptyDescription="Pengajuan izin guru yang baru masuk akan tampil di tab Menunggu Admin."
          toolbar={
            <div className="max-w-md">
              <Input
                placeholder="Cari nama guru atau alasan izin..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftAddon={<Search className="h-4 w-4" />}
              />
            </div>
          }
        />
      </div>

      {/* Admin Review Modal */}
      <Modal
        open={Boolean(reviewTarget)}
        onClose={() => !submittingReview && setReviewTarget(null)}
        title="Verifikasi & Rekomendasi Admin"
      >
        {reviewTarget && (
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs space-y-1">
              <p className="text-sm font-semibold text-[#10264D]">
                {reviewTarget.teacherNameSnapshot} — {PERMISSION_LEAVE_TYPE_LABELS[reviewTarget.leaveType]}
              </p>
              <p className="font-mono text-slate-600 tabular-nums">
                {formatDateTimeJakarta(reviewTarget.startAt)} s.d.{' '}
                {formatDateTimeJakarta(reviewTarget.endAt)}
              </p>
              <p className="pt-1 text-slate-700">{reviewTarget.reason}</p>
            </div>

            {reviewError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{reviewError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setReviewDecision(ReviewDecision.RECOMMEND_APPROVE)}
                className={`rounded-lg border px-3 py-2.5 text-xs font-semibold text-left transition-colors cursor-pointer ${
                  reviewDecision === ReviewDecision.RECOMMEND_APPROVE
                    ? 'border-[#10264D] bg-[#10264D] text-white'
                    : 'border-[#E2E8F0] bg-white text-slate-700 hover:border-[#10264D]'
                }`}
              >
                Teruskan ke Kepala Sekolah
                <span className="block font-normal opacity-80 mt-0.5">
                  Kelengkapan terpenuhi
                </span>
              </button>
              <button
                type="button"
                onClick={() => setReviewDecision(ReviewDecision.RETURN)}
                className={`rounded-lg border px-3 py-2.5 text-xs font-semibold text-left transition-colors cursor-pointer ${
                  reviewDecision === ReviewDecision.RETURN
                    ? 'border-[#B45309] bg-[#FFFBEB] text-[#B45309]'
                    : 'border-[#E2E8F0] bg-white text-slate-700 hover:border-[#B45309]'
                }`}
              >
                Kembalikan ke Guru
                <span className="block font-normal opacity-80 mt-0.5">
                  Perlu revisi / lampiran
                </span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#10264D]" htmlFor="admin-note">
                Catatan Verifikasi Admin{' '}
                {reviewDecision === ReviewDecision.RETURN ? '(Wajib)' : '(Opsional)'}
              </label>
              <textarea
                id="admin-note"
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                required={reviewDecision === ReviewDecision.RETURN}
                placeholder={
                  reviewDecision === ReviewDecision.RETURN
                    ? 'Jelaskan kekurangan dokumen atau data yang harus diperbaiki guru...'
                    : 'Contoh: Berkas surat dokter sudah diperiksa dan sesuai jadwal.'
                }
                className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#10264D] focus:outline-none focus:ring-2 focus:ring-[#10264D]/15"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReviewTarget(null)}
                disabled={submittingReview}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant={reviewDecision === ReviewDecision.RECOMMEND_APPROVE ? 'primary' : 'gold'}
                size="sm"
                loading={submittingReview}
              >
                Simpan Verifikasi
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Private Attachment Viewer */}
      <Modal
        open={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
        title="Pratinjau Lampiran Izin (Privat)"
        size="lg"
      >
        {previewAttachment && (
          <div className="space-y-3">
            {previewAttachment.loading ? (
              <p className="py-12 text-center text-xs text-slate-500">
                Menyiapkan tautan sementara terotorisasi...
              </p>
            ) : previewAttachment.signedUrl ? (
              previewAttachment.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewAttachment.signedUrl}
                  title="Lampiran PDF"
                  className="h-[460px] w-full rounded-lg border border-[#E2E8F0]"
                />
              ) : (
                <div className="flex justify-center overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#0F172A]">
                  <img
                    src={previewAttachment.signedUrl}
                    alt="Lampiran izin guru"
                    referrerPolicy="no-referrer"
                    className="max-h-[460px] w-full object-contain"
                  />
                </div>
              )
            ) : (
              <p className="py-8 text-center text-xs text-slate-500">Lampiran tidak tersedia.</p>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

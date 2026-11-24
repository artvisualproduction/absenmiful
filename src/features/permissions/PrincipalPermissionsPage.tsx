import { type FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Paperclip,
  Search,
  ThumbsDown,
  ThumbsUp,
  XCircle,
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
import { PERMISSION_LEAVE_TYPE_LABELS } from '../../lib/permissionValidation';
import { ApiClientError } from '../../services/apiClient';
import { attendanceService } from '../../services/attendanceService';
import {
  permissionService,
  type EnrichedPermission,
  type PermissionListResponse,
} from '../../services/permissionService';
import { PermissionStatus, ReviewDecision } from '../../types';

export interface PrincipalPermissionsPageProps {
  defaultTab?: 'pending' | 'history';
}

export function PrincipalPermissionsPage({
  defaultTab = 'pending',
}: PrincipalPermissionsPageProps) {
  const isHistoryMode = defaultTab === 'history';
  useDocumentTitle(isHistoryMode ? 'Riwayat Persetujuan Izin' : 'Persetujuan Perizinan');
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>(
    isHistoryMode ? 'approved' : 'pending',
  );
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
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Decision Modal
  const [decisionTarget, setDecisionTarget] = useState<EnrichedPermission | null>(null);
  const [decisionType, setDecisionType] = useState<ReviewDecision.APPROVE | ReviewDecision.REJECT>(
    ReviewDecision.APPROVE,
  );
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Private Attachment Viewer Modal
  const [previewAttachment, setPreviewAttachment] = useState<{
    fileId: string;
    signedUrl: string | null;
    mimeType: string;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    setActiveTab(defaultTab === 'history' ? 'approved' : 'pending');
  }, [defaultTab]);

  const statusForTab: PermissionStatus =
    activeTab === 'pending'
      ? PermissionStatus.ADMIN_REVIEWED
      : activeTab === 'approved'
        ? PermissionStatus.APPROVED
        : PermissionStatus.REJECTED;

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await permissionService.listPermissions({
        status: statusForTab,
        search: debouncedSearch || undefined,
        limit: 1000,
      });
      setItems(res.items);
      setCounts(res.counts);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat daftar perizinan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadList();
  }, [statusForTab, debouncedSearch]);

  const openDecisionModal = (
    item: EnrichedPermission,
    decision: ReviewDecision.APPROVE | ReviewDecision.REJECT,
  ) => {
    setDecisionTarget(item);
    setDecisionType(decision);
    setDecisionNote('');
    setDecisionError(null);
  };

  const handleSubmitDecision = async (e: FormEvent) => {
    e.preventDefault();
    if (!decisionTarget) return;
    setDecisionError(null);

    if (decisionType === ReviewDecision.REJECT && decisionNote.trim().length < 5) {
      setDecisionError('Catatan wajib diisi minimal 5 karakter saat menolak pengajuan izin.');
      return;
    }

    setSubmitting(true);
    try {
      await permissionService.principalDecision(decisionTarget.id, {
        decision: decisionType,
        note: decisionNote.trim(),
      });
      showToast({
        variant: 'success',
        title:
          decisionType === ReviewDecision.APPROVE
            ? 'Pengajuan izin disetujui'
            : 'Pengajuan izin ditolak',
      });
      setDecisionTarget(null);
      await loadList();
    } catch (err) {
      setDecisionError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan keputusan.');
    } finally {
      setSubmitting(false);
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
          <p className="text-xs text-slate-500">{PERMISSION_LEAVE_TYPE_LABELS[row.leaveType]}</p>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Tanggal & Waktu Izin',
      render: (row) => (
        <div className="font-mono text-xs text-slate-700 tabular-nums space-y-0.5">
          <p>{formatDateTimeJakarta(row.startAt)}</p>
          <p className="text-slate-400">s.d. {formatDateTimeJakarta(row.endAt)}</p>
        </div>
      ),
    },
    {
      key: 'adminReview',
      header: 'Alasan & Rekomendasi Admin',
      render: (row) => (
        <div className="max-w-xs space-y-1">
          <p className="text-xs text-slate-700 line-clamp-2" title={row.reason}>
            {row.reason}
          </p>
          {row.adminReview?.reviewedAt && (
            <p className="text-[11px] text-[#1D4ED8]">
              Diverifikasi {row.adminReviewerName ?? 'Admin'}:{' '}
              {row.adminReview.note || 'Direkomendasikan setuju'}
            </p>
          )}
          {row.attachmentPaths && row.attachmentPaths.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
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
      header: 'Keputusan',
      render: (row) => {
        const badge = mapStatusToBadge(row.status);
        return (
          <div className="space-y-1">
            <StatusBadge label={badge.label} tone={badge.tone} />
            {row.principalDecision?.decidedAt && (
              <div className="text-[11px] text-slate-500">
                <p>{row.principalDecision.note || 'Tanpa catatan tambahan'}</p>
                <p className="font-mono text-slate-400 tabular-nums">
                  {formatDateTimeJakarta(row.principalDecision.decidedAt)}
                </p>
              </div>
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
        row.status === PermissionStatus.ADMIN_REVIEWED ? (
          <div className="inline-flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => openDecisionModal(row, ReviewDecision.APPROVE)}
              title={`Setujui pengajuan ${row.teacherNameSnapshot}`}
              aria-label={`Setujui pengajuan ${row.teacherNameSnapshot}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D] hover:bg-[#DCFCE7] transition-colors cursor-pointer"
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => openDecisionModal(row, ReviewDecision.REJECT)}
              title={`Tolak pengajuan ${row.teacherNameSnapshot}`}
              aria-label={`Tolak pengajuan ${row.teacherNameSnapshot}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
            >
              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  return (
    <AppShell
      title={isHistoryMode ? 'Riwayat Persetujuan Izin' : 'Persetujuan Perizinan Guru'}
      subtitle="Hanya pengajuan yang telah diverifikasi Admin yang dapat diputuskan oleh Kepala Sekolah."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Menunggu Keputusan Anda"
            value={counts.pendingPrincipal}
            subtext="Sudah lolos verifikasi Admin"
            accent={counts.pendingPrincipal > 0 ? 'warning' : 'navy'}
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            label="Total Disetujui"
            value={counts.approved}
            subtext="Tercatat resmi pada rekap"
            accent="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Total Ditolak"
            value={counts.rejected}
            subtext={`Menunggu Admin: ${counts.pendingAdmin}`}
            accent="danger"
            icon={<XCircle className="h-5 w-5" />}
          />
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'pending'
                ? 'border-[#10264D] bg-[#10264D] text-white'
                : 'border-[#E2E8F0] bg-white text-slate-600 hover:border-[#10264D]'
            }`}
          >
            <span>Menunggu Keputusan</span>
            {counts.pendingPrincipal > 0 && (
              <span
                className={`rounded px-1.5 font-mono text-[11px] tabular-nums ${
                  activeTab === 'pending'
                    ? 'bg-[#C69B3C] text-[#10264D]'
                    : 'bg-[#FEF2F2] text-[#B91C1C]'
                }`}
              >
                {counts.pendingPrincipal}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approved')}
            className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'approved'
                ? 'border-[#10264D] bg-[#10264D] text-white'
                : 'border-[#E2E8F0] bg-white text-slate-600 hover:border-[#10264D]'
            }`}
          >
            Riwayat Disetujui ({counts.approved})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rejected')}
            className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'rejected'
                ? 'border-[#10264D] bg-[#10264D] text-white'
                : 'border-[#E2E8F0] bg-white text-slate-600 hover:border-[#10264D]'
            }`}
          >
            Riwayat Ditolak ({counts.rejected})
          </button>
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
          emptyTitle={
            activeTab === 'pending'
              ? 'Tidak ada pengajuan menunggu keputusan'
              : 'Belum ada riwayat keputusan pada kategori ini'
          }
          emptyDescription={
            activeTab === 'pending'
              ? 'Pengajuan izin guru yang telah diverifikasi Admin akan otomatis muncul di sini.'
              : 'Keputusan persetujuan atau penolakan Anda akan tercatat secara permanen.'
          }
          toolbar={
            <div className="max-w-md">
              <Input
                placeholder="Cari nama guru atau alasan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftAddon={<Search className="h-4 w-4" />}
              />
            </div>
          }
        />
      </div>

      {/* Decision Modal */}
      <Modal
        open={Boolean(decisionTarget)}
        onClose={() => !submitting && setDecisionTarget(null)}
        title="Keputusan Akhir Kepala Sekolah"
      >
        {decisionTarget && (
          <form onSubmit={handleSubmitDecision} className="space-y-4">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs space-y-1.5">
              <p className="text-sm font-semibold text-[#10264D]">
                {decisionTarget.teacherNameSnapshot} —{' '}
                {PERMISSION_LEAVE_TYPE_LABELS[decisionTarget.leaveType]}
              </p>
              <p className="font-mono text-slate-600 tabular-nums">
                {formatDateTimeJakarta(decisionTarget.startAt)} s.d.{' '}
                {formatDateTimeJakarta(decisionTarget.endAt)}
              </p>
              <p className="text-slate-700">{decisionTarget.reason}</p>
              {decisionTarget.adminReview && (
                <p className="border-t border-[#E2E8F0] pt-1.5 text-[#1D4ED8]">
                  Rekomendasi Admin ({decisionTarget.adminReviewerName ?? 'Admin'}):{' '}
                  {decisionTarget.adminReview.note || 'Kelengkapan sesuai, direkomendasikan setuju.'}
                </p>
              )}
            </div>

            {decisionError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{decisionError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDecisionType(ReviewDecision.APPROVE)}
                className={`rounded-lg border px-3 py-2.5 text-xs font-semibold text-left transition-colors cursor-pointer ${
                  decisionType === ReviewDecision.APPROVE
                    ? 'border-[#15803D] bg-[#F0FDF4] text-[#15803D]'
                    : 'border-[#E2E8F0] bg-white text-slate-700 hover:border-[#15803D]'
                }`}
              >
                Setujui Pengajuan
                <span className="block font-normal opacity-80 mt-0.5">
                  Tercatat sebagai Izin / Sakit
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDecisionType(ReviewDecision.REJECT)}
                className={`rounded-lg border px-3 py-2.5 text-xs font-semibold text-left transition-colors cursor-pointer ${
                  decisionType === ReviewDecision.REJECT
                    ? 'border-[#B91C1C] bg-[#FEF2F2] text-[#B91C1C]'
                    : 'border-[#E2E8F0] bg-white text-slate-700 hover:border-[#B91C1C]'
                }`}
              >
                Tolak Pengajuan
                <span className="block font-normal opacity-80 mt-0.5">
                  Catatan alasan wajib diisi
                </span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#10264D]" htmlFor="principal-note">
                Catatan Keputusan Kepala Sekolah{' '}
                {decisionType === ReviewDecision.REJECT ? '(Wajib)' : '(Opsional)'}
              </label>
              <textarea
                id="principal-note"
                rows={3}
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                required={decisionType === ReviewDecision.REJECT}
                placeholder={
                  decisionType === ReviewDecision.REJECT
                    ? 'Tuliskan alasan penolakan secara jelas (minimal 5 karakter)...'
                    : 'Contoh: Disetujui, mohon pastikan tugas kelas dialihkan ke guru piket.'
                }
                className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#10264D] focus:outline-none focus:ring-2 focus:ring-[#10264D]/15"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 border-t border-[#E2E8F0] pt-4 [&>button]:w-full sm:[&>button]:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDecisionTarget(null)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant={decisionType === ReviewDecision.APPROVE ? 'primary' : 'danger'}
                size="sm"
                loading={submitting}
              >
                {decisionType === ReviewDecision.APPROVE
                  ? 'Tetapkan: Setujui'
                  : 'Tetapkan: Tolak'}
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

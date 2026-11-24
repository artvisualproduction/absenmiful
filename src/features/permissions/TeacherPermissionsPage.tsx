import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  Paperclip,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Input } from '../../components/forms/Input';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/StatCard';
import { mapStatusToBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTimeJakarta, getDateKeyJakarta } from '../../lib/date';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_PERMISSION_ATTACHMENTS,
  PERMISSION_LEAVE_TYPE_LABELS,
  PERMISSION_STATUS_LABELS,
} from '../../lib/permissionValidation';
import { ApiClientError } from '../../services/apiClient';
import { attendanceService } from '../../services/attendanceService';
import {
  permissionService,
  type EnrichedPermission,
  type MyPermissionListResponse,
} from '../../services/permissionService';
import { PermissionLeaveType, PermissionStatus } from '../../types';

interface UploadedFileChip {
  fileId: string;
  label: string;
  mimeType?: string;
}

function toLocalDateTimeInput(isoOrEmpty?: string): string {
  if (!isoOrEmpty) {
    const today = getDateKeyJakarta();
    return `${today}T07:00`;
  }
  const date = new Date(isoOrEmpty);
  if (Number.isNaN(date.getTime())) return `${getDateKeyJakarta()}T07:00`;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hh = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hh}:${get('minute')}`;
}

function toJakartaIso(localDateTime: string): string {
  if (!localDateTime) return '';
  if (localDateTime.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(localDateTime)) {
    return localDateTime;
  }
  return `${localDateTime}:00+07:00`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Gagal membaca berkas lampiran.'));
    reader.readAsDataURL(file);
  });
}

export function TeacherPermissionsPage() {
  useDocumentTitle('Pengajuan Izin Saya');
  const { showToast } = useToast();

  const [items, setItems] = useState<EnrichedPermission[]>([]);
  const [counts, setCounts] = useState<MyPermissionListResponse['counts']>({
    total: 0,
    active: 0,
    approved: 0,
    rejected: 0,
    returned: 0,
  });
  const [statusFilter, setStatusFilter] = useState<PermissionStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Modal (New or Resubmit Returned)
  const [formOpen, setFormOpen] = useState(false);
  const [resubmitTarget, setResubmitTarget] = useState<EnrichedPermission | null>(null);
  const [leaveType, setLeaveType] = useState<PermissionLeaveType>(PermissionLeaveType.SICK);
  const [startAt, setStartAt] = useState(() => `${getDateKeyJakarta()}T07:00`);
  const [endAt, setEndAt] = useState(() => `${getDateKeyJakarta()}T15:00`);
  const [reason, setReason] = useState('');
  const [attachments, setAttachments] = useState<UploadedFileChip[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Cancel Confirm
  const [cancelTarget, setCancelTarget] = useState<EnrichedPermission | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Private Attachment Viewer Modal
  const [previewAttachment, setPreviewAttachment] = useState<{
    fileId: string;
    signedUrl: string | null;
    mimeType: string;
    loading: boolean;
  } | null>(null);

  const loadMyPermissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await permissionService.listMyPermissions({
        status: statusFilter,
        limit: 1000,
      });
      setItems(res.items);
      setCounts(res.counts);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat daftar pengajuan izin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMyPermissions();
  }, [statusFilter]);

  const openCreateModal = () => {
    setResubmitTarget(null);
    setLeaveType(PermissionLeaveType.SICK);
    const today = getDateKeyJakarta();
    setStartAt(`${today}T07:00`);
    setEndAt(`${today}T15:00`);
    setReason('');
    setAttachments([]);
    setFormError(null);
    setFormOpen(true);
  };

  const openResubmitModal = (item: EnrichedPermission) => {
    setResubmitTarget(item);
    setLeaveType(item.leaveType);
    setStartAt(toLocalDateTimeInput(item.startAt));
    setEndAt(toLocalDateTimeInput(item.endAt));
    setReason(item.reason);
    setAttachments([]);
    setFormError(null);
    setFormOpen(true);
  };

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (attachments.length >= MAX_PERMISSION_ATTACHMENTS) {
      setFormError(`Maksimal ${MAX_PERMISSION_ATTACHMENTS} berkas lampiran per pengajuan.`);
      return;
    }

    if (
      !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
      )
    ) {
      setFormError('Format lampiran hanya mendukung gambar JPEG, PNG, atau dokumen PDF.');
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFormError('Ukuran berkas lampiran melebihi batas maksimum 5 MB.');
      return;
    }

    setUploadingFile(true);
    setFormError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await permissionService.uploadAttachment({
        dataUrl,
        mimeType: file.type as 'image/jpeg' | 'image/png' | 'application/pdf',
        fileName: file.name,
      });
      setAttachments((prev) => [
        ...prev,
        { fileId: uploaded.fileId, label: file.name, mimeType: uploaded.mimeType },
      ]);
      showToast({ variant: 'success', title: 'Lampiran berhasil diunggah' });
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : 'Gagal mengunggah lampiran ke server.',
      );
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (reason.trim().length < 8) {
      setFormError('Alasan izin wajib diisi minimal 8 karakter.');
      return;
    }

    const startIso = toJakartaIso(startAt);
    const endIso = toJakartaIso(endAt);
    if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
      setFormError('Tanggal/waktu selesai harus sama dengan atau setelah waktu mulai.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        leaveType,
        startAt: startIso,
        endAt: endIso,
        reason: reason.trim(),
        attachmentFileIds: attachments.map((a) => a.fileId),
      };

      if (resubmitTarget) {
        await permissionService.resubmitPermission(resubmitTarget.id, payload);
        showToast({
          variant: 'success',
          title: 'Pengajuan izin diajukan ulang',
          message: 'Menunggu verifikasi Admin sebelum diteruskan ke Kepala Sekolah.',
        });
      } else {
        await permissionService.submitPermission(payload);
        showToast({
          variant: 'success',
          title: 'Pengajuan izin terkirim',
          message: 'Menunggu verifikasi Admin sebelum diteruskan ke Kepala Sekolah.',
        });
      }
      setFormOpen(false);
      await loadMyPermissions();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan pengajuan izin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await permissionService.cancelPermission(cancelTarget.id, 'Dibatalkan oleh guru pemohon.');
      showToast({ variant: 'info', title: 'Pengajuan izin dibatalkan' });
      setCancelTarget(null);
      await loadMyPermissions();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal membatalkan izin',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan server.',
      });
    } finally {
      setCancelling(false);
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

  const canCancel = (status: PermissionStatus) =>
    status === PermissionStatus.SUBMITTED ||
    status === PermissionStatus.RETURNED ||
    status === PermissionStatus.ADMIN_REVIEWED;

  return (
    <AppShell
      title="Pengajuan Izin Guru"
      subtitle="Ajukan permohonan sakit, izin pribadi, atau tugas dinas. Alur resmi: Verifikasi Admin lalu Keputusan Kepala Sekolah."
      actions={
        <Button variant="gold" size="sm" onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
          Ajukan Izin Baru
        </Button>
      }
    >
      <div className="space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Sedang Diproses"
            value={counts.active}
            subtext="Menunggu Admin / Kepsek"
            accent="gold"
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            label="Disetujui"
            value={counts.approved}
            subtext="Tercatat sebagai Izin/Sakit"
            accent="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Dikembalikan"
            value={counts.returned}
            subtext="Perlu perbaikan data"
            accent="warning"
            icon={<RotateCcw className="h-5 w-5" />}
          />
          <StatCard
            label="Ditolak"
            value={counts.rejected}
            subtext={`Total ${counts.total} pengajuan`}
            accent="danger"
            icon={<XCircle className="h-5 w-5" />}
          />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-slate-600">
            Menampilkan hanya riwayat perizinan milik akun Anda sendiri.
          </p>
          <div className="w-full sm:w-64">
            <Select
              aria-label="Filter status pengajuan"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PermissionStatus | '')}
              options={[
                { value: '', label: 'Semua Status' },
                { value: PermissionStatus.SUBMITTED, label: 'Diajukan (Menunggu Admin)' },
                { value: PermissionStatus.ADMIN_REVIEWED, label: 'Diverifikasi Admin' },
                { value: PermissionStatus.RETURNED, label: 'Dikembalikan' },
                { value: PermissionStatus.APPROVED, label: 'Disetujui' },
                { value: PermissionStatus.REJECTED, label: 'Ditolak' },
                { value: PermissionStatus.CANCELLED, label: 'Dibatalkan' },
              ]}
            />
          </div>
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

        {/* Permission List */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-8">
            <EmptyState
              icon={<FileCheck2 className="h-6 w-6" />}
              title="Belum ada pengajuan izin"
              description="Klik tombol Ajukan Izin Baru bila Anda berhalangan hadir karena sakit, izin pribadi, atau tugas dinas."
              action={
                <Button variant="primary" size="sm" onClick={openCreateModal}>
                  Ajukan Izin Pertama
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const badge = mapStatusToBadge(item.status);
              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-[#10264D]">
                          {PERMISSION_LEAVE_TYPE_LABELS[item.leaveType]}
                        </h3>
                        <StatusBadge label={badge.label} tone={badge.tone} />
                      </div>
                      <p className="font-mono text-xs text-slate-600 tabular-nums">
                        {formatDateTimeJakarta(item.startAt)} — {formatDateTimeJakarta(item.endAt)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Diajukan {formatDateTimeJakarta(item.createdAt)} ·{' '}
                        {PERMISSION_STATUS_LABELS[item.status]}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.status === PermissionStatus.RETURNED && (
                        <Button
                          variant="gold"
                          size="sm"
                          onClick={() => openResubmitModal(item)}
                          leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                        >
                          Perbaiki & Ajukan Ulang
                        </Button>
                      )}
                      {canCancel(item.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelTarget(item)}
                        >
                          Batalkan
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">{item.reason}</p>

                  {/* Attachments */}
                  {item.attachmentPaths && item.attachmentPaths.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {item.attachmentPaths.map((storagePath, idx) => (
                        <button
                          key={storagePath}
                          type="button"
                          onClick={() => void handleViewAttachment(storagePath)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs font-medium text-[#10264D] hover:border-[#C69B3C] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-[#8D6B22]" />
                          <span>Lampiran #{idx + 1}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Workflow Audit Notes */}
                  {(item.adminReview?.reviewedAt || item.principalDecision?.decidedAt) && (
                    <div className="grid grid-cols-1 gap-3 border-t border-[#E2E8F0] pt-3.5 sm:grid-cols-2">
                      {item.adminReview?.reviewedAt && (
                        <div className="rounded-lg bg-[#F8FAFC] p-3 text-xs space-y-1">
                          <p className="font-semibold text-[#10264D]">
                            Verifikasi Admin ({item.adminReviewerName ?? 'Admin'})
                          </p>
                          <p className="text-slate-600">
                            {item.adminReview.note || 'Direkomendasikan untuk keputusan Kepala Sekolah.'}
                          </p>
                          <p className="text-[11px] text-slate-400 tabular-nums">
                            {formatDateTimeJakarta(item.adminReview.reviewedAt)}
                          </p>
                        </div>
                      )}
                      {item.principalDecision?.decidedAt && (
                        <div className="rounded-lg bg-[#F8FAFC] p-3 text-xs space-y-1">
                          <p className="font-semibold text-[#10264D]">
                            Keputusan Kepala Sekolah ({item.principalReviewerName ?? 'Kepala Sekolah'})
                          </p>
                          <p className="text-slate-600">
                            {item.principalDecision.note ||
                              (item.status === PermissionStatus.APPROVED
                                ? 'Disetujui oleh Kepala Sekolah.'
                                : 'Ditolak oleh Kepala Sekolah.')}
                          </p>
                          <p className="text-[11px] text-slate-400 tabular-nums">
                            {formatDateTimeJakarta(item.principalDecision.decidedAt)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Ajukan / Ajukan Ulang Izin */}
      <Modal
        open={formOpen}
        onClose={() => !submitting && setFormOpen(false)}
        title={resubmitTarget ? 'Perbaiki & Ajukan Ulang Izin' : 'Formulir Pengajuan Izin Guru'}
        size="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {resubmitTarget?.adminReview?.note && (
            <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E]">
              <p className="font-semibold">Catatan Pengembalian Admin:</p>
              <p className="mt-0.5">{resubmitTarget.adminReview.note}</p>
            </div>
          )}

          {formError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-xs text-[#B91C1C]"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Select
            label="Jenis Izin"
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as PermissionLeaveType)}
            options={[
              { value: PermissionLeaveType.SICK, label: 'Sakit' },
              { value: PermissionLeaveType.PERSONAL, label: 'Izin Pribadi' },
              { value: PermissionLeaveType.OFFICIAL_DUTY, label: 'Tugas Dinas' },
              { value: PermissionLeaveType.OTHER, label: 'Lainnya' },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Tanggal & Waktu Mulai"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
            <Input
              label="Tanggal & Waktu Selesai"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#10264D]" htmlFor="perm-reason">
              Alasan Pengajuan Izin
            </label>
            <textarea
              id="perm-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Jelaskan alasan ketidakhadiran secara singkat dan jelas (minimal 8 karakter)..."
              className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#10264D] focus:outline-none focus:ring-2 focus:ring-[#10264D]/15"
            />
          </div>

          {/* Secure Attachment Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#10264D]">
              Lampiran Pendukung (Opsional · JPEG, PNG, PDF · Maks 5 MB)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[#94A3B8] bg-[#F8FAFC] px-3.5 py-2 text-xs font-medium text-[#10264D] hover:border-[#10264D] cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingFile ? 'Mengunggah...' : 'Pilih Berkas'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  disabled={uploadingFile || attachments.length >= MAX_PERMISSION_ATTACHMENTS}
                  onChange={(e) => void handleAttachmentChange(e)}
                  className="sr-only"
                />
              </label>
              <span className="text-[11px] text-slate-500">
                {attachments.length}/{MAX_PERMISSION_ATTACHMENTS} berkas terunggah ke penyimpanan privat.
              </span>
            </div>

            {attachments.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {attachments.map((att) => (
                  <li
                    key={att.fileId}
                    className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs"
                  >
                    <span className="inline-flex items-center gap-2 truncate text-[#10264D]">
                      <FileText className="h-3.5 w-3.5 text-[#8D6B22] shrink-0" />
                      <span className="truncate">{att.label}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((item) => item.fileId !== att.fileId))
                      }
                      className="text-slate-400 hover:text-[#B91C1C] cursor-pointer"
                      aria-label={`Hapus ${att.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting || uploadingFile}>
              {resubmitTarget ? 'Ajukan Ulang' : 'Kirim Pengajuan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Cancel Dialog */}
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => void handleConfirmCancel()}
        loading={cancelling}
        variant="danger"
        title="Batalkan Pengajuan Izin?"
        message="Pengajuan yang dibatalkan tidak akan diproses oleh Admin maupun Kepala Sekolah. Anda dapat membuat pengajuan baru kapan saja."
        confirmLabel="Ya, Batalkan"
      />

      {/* Private Attachment Viewer Modal */}
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
                <div className="space-y-3">
                  <iframe
                    src={previewAttachment.signedUrl}
                    title="Dokumen Lampiran PDF"
                    className="h-[460px] w-full rounded-lg border border-[#E2E8F0]"
                  />
                  <div className="flex justify-end">
                    <a
                      href={previewAttachment.signedUrl}
                      download
                      className="text-xs font-semibold text-[#10264D] underline hover:text-[#C69B3C]"
                    >
                      Unduh Berkas PDF
                    </a>
                  </div>
                </div>
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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  UserX,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { mapStatusToBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ANOMALY_FLAG_LABELS } from '../../lib/attendanceAnomaly';
import { formatDateShortJakarta, getTimeHHMMJakarta } from '../../lib/date';
import { downloadReportPdf, downloadReportXlsx } from '../../lib/reportExport';
import { ApiClientError } from '../../services/apiClient';
import {
  attendanceService,
  type MyAttendanceResponse,
} from '../../services/attendanceService';
import { reportService } from '../../services/reportService';
import {
  AttendanceEventType,
  AttendanceStatus,
  UserRole,
  type AttendanceRecord,
} from '../../types';

export function TeacherHistoryPage() {
  const { user } = useAuth();
  const isPrincipal = user?.role === UserRole.PRINCIPAL;
  const selfAttendancePath = isPrincipal ? '/principal/attendance' : '/teacher/attendance';
  useDocumentTitle('Riwayat Absensi Saya');
  const { showToast } = useToast();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<MyAttendanceResponse['summary']>({
    total: 0,
    present: 0,
    late: 0,
    sick: 0,
    excused: 0,
    absent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | ''>('');

  // Private Selfie Viewer Modal (via temporary signed URL)
  const [viewingRecord, setViewingRecord] = useState<AttendanceRecord | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'XLSX' | 'PDF' | null>(null);

  const handleExportPersonal = async (format: 'XLSX' | 'PDF') => {
    setExportingFormat(format);
    try {
      const hasCustomRange = Boolean(dateFrom && dateTo);
      const exported = await reportService.exportAttendanceReport({
        format,
        period: hasCustomRange ? 'custom' : 'monthly',
        dateFrom: hasCustomRange ? dateFrom : undefined,
        dateTo: hasCustomRange ? dateTo : undefined,
        dimension: 'TEACHER',
        status: statusFilter || undefined,
      });
      if (format === 'XLSX') {
        downloadReportXlsx(exported);
        showToast({ variant: 'success', title: 'Riwayat pribadi XLSX diunduh' });
      } else {
        downloadReportPdf(exported);
        showToast({ variant: 'success', title: 'Riwayat pribadi PDF diunduh' });
      }
    } catch (err) {
      showToast({
        variant: 'error',
        title: `Gagal mengekspor ${format}`,
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan saat ekspor.',
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendanceService.getMyAttendance({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        status: statusFilter,
        limit: 1000,
      });
      setRecords(res.items);
      setSummary(res.summary);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Gagal memuat riwayat absensi pribadi.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [dateFrom, dateTo, statusFilter]);

  const handleViewSelfie = async (row: AttendanceRecord) => {
    if (!row.selfiePath) return;
    setViewingRecord(row);
    setSignedUrl(null);
    setLoadingPhoto(true);
    try {
      const res = await attendanceService.getSignedFileUrl({ storagePath: row.selfiePath });
      setSignedUrl(res.signedUrl);
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal memuat foto selfie',
        message: err instanceof ApiClientError ? err.message : 'Tautan sementara gagal dibuat.',
      });
      setViewingRecord(null);
    } finally {
      setLoadingPhoto(false);
    }
  };

  const columns: Array<TableColumn<AttendanceRecord>> = [
    {
      key: 'date',
      header: 'Tanggal & Jam Server',
      render: (row) => (
        <div className="tabular-nums">
          <p className="font-mono text-xs font-semibold text-[#10264D]">
            {getTimeHHMMJakarta(row.serverTimestamp)}
          </p>
          <p className="text-xs text-slate-500">
            {formatDateShortJakarta(`${row.attendanceDate}T00:00:00+07:00`)}
          </p>
        </div>
      ),
    },
    {
      key: 'event',
      header: 'Jenis',
      render: (row) => (
        <span className="text-xs font-semibold text-[#10264D]">
          {row.eventType === AttendanceEventType.CHECK_IN ? 'Masuk' : 'Pulang'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const badge = mapStatusToBadge(row.status);
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge label={badge.label} tone={badge.tone} />
              {row.corrected && <StatusBadge label="Dikoreksi" tone="gold" showIcon={false} />}
            </div>
            {row.correctionReason && (
              <p className="text-[11px] text-slate-500 max-w-xs truncate" title={row.correctionReason}>
                Catatan: {row.correctionReason}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'location',
      header: 'Metode & Lokasi',
      render: (row) => (
        <div className="text-xs text-slate-600 tabular-nums">
          <p className="font-medium text-slate-700">{row.method}</p>
          {row.distanceFromSchoolMeters !== null ? (
            <p>
              Jarak {Math.round(row.distanceFromSchoolMeters)} m
              {row.gpsAccuracyMeters !== null ? ` (±${Math.round(row.gpsAccuracyMeters)} m)` : ''}
            </p>
          ) : (
            <p className="text-slate-400">Tanpa koordinat</p>
          )}
        </div>
      ),
    },
    {
      key: 'selfie',
      header: 'Selfie',
      align: 'right',
      render: (row) =>
        row.selfiePath ? (
          <button
            type="button"
            title="Lihat Foto Selfie"
            aria-label={`Lihat selfie ${row.attendanceDate}`}
            onClick={() => void handleViewSelfie(row)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
          >
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  return (
    <AppShell
      title="Riwayat Absensi Saya"
      subtitle="Catatan kehadiran masuk dan pulang pribadi milik akun Anda."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={exportingFormat === 'XLSX'}
            onClick={() => void handleExportPersonal('XLSX')}
            leftIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-[#15803D]" />}
          >
            Ekspor XLSX
          </Button>
          <Button
            variant="outline"
            size="sm"
            loading={exportingFormat === 'PDF'}
            onClick={() => void handleExportPersonal('PDF')}
            leftIcon={<FileText className="h-3.5 w-3.5 text-[#10264D]" />}
          >
            Ekspor PDF
          </Button>
          <Link to={selfAttendancePath}>
            <Button variant="gold" size="sm" leftIcon={<ClipboardCheck className="h-4 w-4" />}>
              Absensi Sekarang
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Catatan"
            value={summary.total}
            subtext="Sesuai filter aktif"
            accent="navy"
            icon={<ClipboardCheck className="h-5 w-5" />}
          />
          <StatCard
            label="Hadir Tepat Waktu"
            value={summary.present}
            subtext="Status PRESENT"
            accent="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Terlambat"
            value={summary.late}
            subtext="Status LATE"
            accent="gold"
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            label="Sakit / Izin / Alfa"
            value={summary.sick + summary.excused + summary.absent}
            subtext={`S:${summary.sick} · I:${summary.excused} · A:${summary.absent}`}
            accent="navy"
            icon={<UserX className="h-5 w-5" />}
          />
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
          data={records}
          loading={loading}
          emptyTitle="Belum ada riwayat absensi"
          emptyDescription="Catatan absensi masuk dan pulang Anda akan muncul secara otomatis di sini."
          toolbar={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                aria-label="Dari tanggal"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <Input
                aria-label="Sampai tanggal"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
              <Select
                aria-label="Filter status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AttendanceStatus | '')}
                options={[
                  { value: '', label: 'Semua Status' },
                  { value: AttendanceStatus.PRESENT, label: 'Hadir' },
                  { value: AttendanceStatus.LATE, label: 'Terlambat' },
                  { value: AttendanceStatus.SICK, label: 'Sakit' },
                  { value: AttendanceStatus.EXCUSED, label: 'Izin' },
                  { value: AttendanceStatus.ABSENT, label: 'Alfa' },
                ]}
              />
            </div>
          }
        />
      </div>

      {/* Modal Foto Selfie Privat */}
      <Modal
        open={Boolean(viewingRecord)}
        onClose={() => {
          setViewingRecord(null);
          setSignedUrl(null);
        }}
        title="Bukti Selfie Kehadiran (Privat)"
      >
        {viewingRecord && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs space-y-1">
              <p className="font-semibold text-[#10264D] text-sm">
                {viewingRecord.attendanceDate} ·{' '}
                {viewingRecord.eventType === AttendanceEventType.CHECK_IN ? 'Masuk' : 'Pulang'} (
                {getTimeHHMMJakarta(viewingRecord.serverTimestamp)})
              </p>
              <p className="text-slate-600 tabular-nums">
                Metode: {viewingRecord.method}
                {viewingRecord.distanceFromSchoolMeters !== null
                  ? ` · Jarak ${Math.round(viewingRecord.distanceFromSchoolMeters)} m (±${Math.round(viewingRecord.gpsAccuracyMeters ?? 0)} m)`
                  : ''}
              </p>
            </div>

            <div className="flex min-h-[240px] items-center justify-center overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#0F172A]">
              {loadingPhoto ? (
                <p className="text-xs text-slate-300">Memuat tautan foto sementara...</p>
              ) : signedUrl ? (
                <img
                  src={signedUrl}
                  alt="Bukti selfie kehadiran guru"
                  referrerPolicy="no-referrer"
                  className="max-h-[360px] w-full object-contain"
                />
              ) : (
                <p className="text-xs text-slate-300">Foto tidak tersedia.</p>
              )}
            </div>

            {viewingRecord.anomalyFlags && viewingRecord.anomalyFlags.length > 0 && (
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E] space-y-1">
                <p className="font-semibold">Indikator Diagnostik Lokasi:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {viewingRecord.anomalyFlags.map((flag) => (
                    <li key={flag}>{ANOMALY_FLAG_LABELS[flag] ?? flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

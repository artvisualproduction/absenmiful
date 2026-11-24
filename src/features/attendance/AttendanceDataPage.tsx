import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Image as ImageIcon,
  Pencil,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Trash2,
  UserX,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { mapStatusToBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ANOMALY_FLAG_LABELS } from '../../lib/attendanceAnomaly';
import { attendanceCorrectionSchema } from '../../lib/attendanceScanValidation';
import { formatDateShortJakarta, getDateKeyJakarta, getTimeHHMMJakarta } from '../../lib/date';
import { formatClassName } from '../../lib/formatters';
import { manualExceptionAttendanceSchema } from '../../lib/teacherAttendanceValidation';
import { ApiClientError } from '../../services/apiClient';
import {
  attendanceService,
  type AttendanceListResponse,
} from '../../services/attendanceService';
import {
  masterDataService,
  type EnrichedClass,
  type EnrichedStudent,
  type EnrichedTeacher,
} from '../../services/masterDataService';
import {
  AttendanceEventType,
  AttendanceStatus,
  QrOwnerType,
  UserRole,
  type AttendanceRecord,
} from '../../types';

export function AttendanceDataPage() {
  useDocumentTitle('Data Kehadiran');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const canCorrect = user
    ? user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.OPERATOR
    : false;

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceListResponse['summary']>({
    total: 0,
    present: 0,
    late: 0,
    sick: 0,
    excused: 0,
    absent: 0,
  });
  const [classes, setClasses] = useState<EnrichedClass[]>([]);
  const [teachers, setTeachers] = useState<EnrichedTeacher[]>([]);
  const [students, setStudents] = useState<EnrichedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalConfirmOpen, setPortalConfirmOpen] = useState(false);

  // Filters
  const [dateFilter, setDateFilter] = useState(() => getDateKeyJakarta());
  const [personType, setPersonType] = useState<QrOwnerType>(QrOwnerType.STUDENT);
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | ''>('');
  const [eventFilter, setEventFilter] = useState<AttendanceEventType | ''>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  // Correction Modal (Admin only)
  const [correcting, setCorrecting] = useState<AttendanceRecord | null>(null);
  const [corrStatus, setCorrStatus] = useState<AttendanceStatus>(AttendanceStatus.PRESENT);
  const [corrReason, setCorrReason] = useState('');
  const [corrError, setCorrError] = useState<string | null>(null);
  const [savingCorr, setSavingCorr] = useState(false);

  // Delete Confirmation (Superadmin / Admin / Operator)
  const [deletingTarget, setDeletingTarget] = useState<AttendanceRecord | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Private Selfie Viewer Modal (Admin/Principal via temporary signed URL)
  const [viewingSelfie, setViewingSelfie] = useState<AttendanceRecord | null>(null);
  const [signedSelfieUrl, setSignedSelfieUrl] = useState<string | null>(null);
  const [loadingSelfie, setLoadingSelfie] = useState(false);

  // Admin-only Manual GPS Exception Modal
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exPersonType, setExPersonType] = useState<QrOwnerType>(QrOwnerType.TEACHER);
  const [exPersonId, setExPersonId] = useState('');
  const [exDate, setExDate] = useState(() => getDateKeyJakarta());
  const [exEventType, setExEventType] = useState<AttendanceEventType>(AttendanceEventType.CHECK_IN);
  const [exStatus, setExStatus] = useState<AttendanceStatus>(AttendanceStatus.PRESENT);
  const [exReason, setExReason] = useState('');
  const [exError, setExError] = useState<string | null>(null);
  const [savingEx, setSavingEx] = useState(false);

  useEffect(() => {
    void masterDataService
      .listClasses({ isActive: 'true' })
      .then((res) => setClasses(res.items))
      .catch(() => {});
  }, []);

  const openExceptionModal = async () => {
    setExceptionOpen(true);
    setExError(null);
    setExReason('');
    setExDate(dateFilter || getDateKeyJakarta());
    setExPersonType(personType);
    setExPersonId('');

    if (teachers.length === 0) {
      void masterDataService
        .listTeachers({ limit: 1000 })
        .then((res) => setTeachers(res.items))
        .catch(() => {});
    }
    if (students.length === 0) {
      void masterDataService
        .listStudents({ limit: 2000 })
        .then((res) => setStudents(res.items))
        .catch(() => {});
    }
  };

  const loadAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendanceService.listAttendance({
        date: dateFilter || undefined,
        personType,
        classId: personType === QrOwnerType.STUDENT ? classFilter || undefined : undefined,
        status: statusFilter,
        eventType: eventFilter,
        search: debouncedSearch || undefined,
        limit: 2000,
      });
      setRecords(res.items);
      setSummary(res.summary);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Gagal memuat data kehadiran.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAttendance();
  }, [dateFilter, personType, classFilter, statusFilter, eventFilter, debouncedSearch]);

  const openCorrection = (row: AttendanceRecord) => {
    setCorrecting(row);
    setCorrStatus(row.status);
    setCorrReason('');
    setCorrError(null);
  };

  const handleViewSelfie = async (row: AttendanceRecord) => {
    if (!row.selfiePath) return;
    setViewingSelfie(row);
    setSignedSelfieUrl(null);
    setLoadingSelfie(true);
    try {
      const res = await attendanceService.getSignedFileUrl({ storagePath: row.selfiePath });
      setSignedSelfieUrl(res.signedUrl);
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal memuat foto selfie',
        message: err instanceof ApiClientError ? err.message : 'Tautan sementara gagal dibuat.',
      });
      setViewingSelfie(null);
    } finally {
      setLoadingSelfie(false);
    }
  };

  const handleSubmitCorrection = async (e: FormEvent) => {
    e.preventDefault();
    if (!correcting) return;
    setCorrError(null);

    const parsed = attendanceCorrectionSchema.safeParse({
      status: corrStatus,
      reason: corrReason,
    });
    if (!parsed.success) {
      setCorrError(parsed.error.issues[0]?.message ?? 'Data koreksi tidak valid.');
      return;
    }

    setSavingCorr(true);
    try {
      await attendanceService.correctAttendance(correcting.id, parsed.data);
      showToast({
        variant: 'success',
        title: 'Kehadiran dikoreksi',
        message: 'Perubahan status telah dicatat dalam log audit.',
      });
      setCorrecting(null);
      await loadAttendance();
    } catch (err) {
      setCorrError(
        err instanceof ApiClientError ? err.message : 'Gagal menyimpan koreksi kehadiran.',
      );
    } finally {
      setSavingCorr(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTarget) return;
    setDeletingBusy(true);
    try {
      await attendanceService.deleteAttendance(deletingTarget.id);
      showToast({
        variant: 'success',
        title: 'Data kehadiran dihapus',
        message: `Catatan kehadiran ${deletingTarget.personNameSnapshot} berhasil dihapus dan dicatat di log audit.`,
      });
      setDeletingTarget(null);
      await loadAttendance();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menghapus data kehadiran',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan saat menghapus data.',
      });
    } finally {
      setDeletingBusy(false);
    }
  };

  const handleSubmitManualException = async (e: FormEvent) => {
    e.preventDefault();
    setExError(null);

    const parsed = manualExceptionAttendanceSchema.safeParse({
      personType: exPersonType,
      personId: exPersonId,
      attendanceDate: exDate,
      eventType: exEventType,
      status: exStatus,
      reason: exReason,
    });

    if (!parsed.success) {
      setExError(parsed.error.issues[0]?.message ?? 'Data pengecualian manual tidak valid.');
      return;
    }

    setSavingEx(true);
    try {
      await attendanceService.createManualException(parsed.data);
      showToast({
        variant: 'success',
        title: 'Pengecualian manual dicatat',
        message: 'Catatan absensi pengecualian GPS telah disimpan dan diaudit.',
      });
      setExceptionOpen(false);
      await loadAttendance();
    } catch (err) {
      setExError(
        err instanceof ApiClientError
          ? err.message
          : 'Gagal menyimpan catatan pengecualian manual.',
      );
    } finally {
      setSavingEx(false);
    }
  };

  const columns: Array<TableColumn<AttendanceRecord>> = [
    {
      key: 'time',
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
      key: 'person',
      header: personType === QrOwnerType.STUDENT ? 'Siswa & NIS' : 'Guru & NIY/NIP',
      render: (row) => (
        <div>
          <p className="font-semibold text-[#10264D]">{row.personNameSnapshot}</p>
          <p className="font-mono text-xs text-slate-500">
            {row.personType === QrOwnerType.STUDENT
              ? `NIS ${row.nisSnapshot ?? '-'}`
              : `NIP ${row.niyNipSnapshot ?? '-'}`}
          </p>
        </div>
      ),
    },
    ...(personType === QrOwnerType.STUDENT
      ? [
          {
            key: 'class',
            header: 'Kelas',
            render: (row: AttendanceRecord) => (
              <span className="inline-flex rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-xs font-semibold text-[#10264D]">
                {row.classNameSnapshot ? formatClassName(row.classNameSnapshot) : '-'}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'event',
      header: 'Jenis',
      render: (row) => (
        <span className="text-xs font-medium text-slate-700">
          {row.eventType === AttendanceEventType.CHECK_IN ? 'Masuk' : 'Pulang'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const badge = mapStatusToBadge(row.status);
        const hasAnomaly = (row.anomalyFlags?.length ?? 0) > 0;
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge label={badge.label} tone={badge.tone} />
              {row.corrected && (
                <StatusBadge label="Dikoreksi" tone="gold" showIcon={false} />
              )}
              {hasAnomaly && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309]"
                  title={row.anomalyFlags
                    ?.map((f) => ANOMALY_FLAG_LABELS[f] ?? f)
                    .join('; ')}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Anomali GPS
                </span>
              )}
            </div>
            {row.corrected && row.correctionReason && (
              <p
                className="text-[11px] text-slate-500 max-w-xs truncate"
                title={row.correctionReason}
              >
                Alasan: {row.correctionReason}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'location',
      header: 'Metode & GPS',
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
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center justify-end gap-1">
          {row.selfiePath && (
            <button
              type="button"
              title="Lihat Bukti Selfie"
              aria-label={`Lihat selfie ${row.personNameSnapshot}`}
              onClick={() => void handleViewSelfie(row)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#FCF9F1] hover:border-[#C69B3C] transition-colors cursor-pointer"
            >
              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {canCorrect && (
            <>
              <button
                type="button"
                title="Koreksi Status Kehadiran"
                aria-label={`Koreksi ${row.personNameSnapshot}`}
                onClick={() => openCorrection(row)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                title="Hapus Data Kehadiran"
                aria-label={`Hapus kehadiran ${row.personNameSnapshot}`}
                onClick={() => setDeletingTarget(row)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#FECACA] bg-white text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}
          {!row.selfiePath && !canCorrect && <span className="text-xs text-slate-400">—</span>}
        </div>
      ),
    },
  ];

  const classOptions = classes.map((c) => ({ value: c.id, label: formatClassName(c.name) }));
  const exceptionPersonOptions =
    exPersonType === QrOwnerType.TEACHER
      ? teachers.map((t) => ({ value: t.id, label: `${t.fullName} (${t.niyNip})` }))
      : students.map((s) => ({ value: s.id, label: `${s.fullName} (${s.nis})` }));

  return (
    <AppShell
      title={canCorrect ? 'Data Kehadiran' : 'Monitoring Kehadiran'}
      subtitle={
        canCorrect
          ? 'Pantau catatan kehadiran berbasis waktu server, periksa bukti selfie guru, dan lakukan koreksi teraudit.'
          : 'Tampilan lihat saja (read-only) monitoring kehadiran siswa dan guru madrasah beserta bukti selfie.'
      }
      actions={
        canCorrect ? (
          <div className="flex flex-wrap items-center gap-2 [&>button]:whitespace-nowrap [&>button]:shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void openExceptionModal()}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Pengecualian GPS
            </Button>
            <Button
              variant="gold"
              size="sm"
              onClick={() => setPortalConfirmOpen(true)}
              leftIcon={<QrCode className="h-4 w-4" />}
            >
              Portal Absensi
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Catatan"
            value={summary.total}
            subtext={dateFilter ? `Tanggal ${dateFilter}` : 'Semua tanggal'}
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
          emptyTitle="Belum ada data kehadiran"
          emptyDescription="Belum ada catatan absensi pada tanggal dan filter yang dipilih."
          toolbar={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Input
                aria-label="Tanggal kehadiran"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              <Select
                aria-label="Kategori"
                value={personType}
                onChange={(e) => setPersonType(e.target.value as QrOwnerType)}
                options={[
                  { value: QrOwnerType.STUDENT, label: 'Kehadiran Siswa' },
                  { value: QrOwnerType.TEACHER, label: 'Kehadiran Guru' },
                ]}
              />
              {personType === QrOwnerType.STUDENT && (
                <Select
                  aria-label="Filter Kelas"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  options={[{ value: '', label: 'Semua Kelas' }, ...classOptions]}
                />
              )}
              <Select
                aria-label="Filter Jenis"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value as AttendanceEventType | '')}
                options={[
                  { value: '', label: 'Masuk & Pulang' },
                  { value: AttendanceEventType.CHECK_IN, label: 'Masuk saja' },
                  { value: AttendanceEventType.CHECK_OUT, label: 'Pulang saja' },
                ]}
              />
              <Select
                aria-label="Filter Status"
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
              <Input
                aria-label="Cari nama atau nomor induk"
                placeholder="Cari nama / NIS / NIP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftAddon={<Search className="h-4 w-4" />}
              />
            </div>
          }
        />
      </div>

      {/* Modal Foto Selfie Privat (Admin / Kepala Sekolah) */}
      <Modal
        open={Boolean(viewingSelfie)}
        onClose={() => {
          setViewingSelfie(null);
          setSignedSelfieUrl(null);
        }}
        title="Verifikasi Bukti Selfie & Lokasi"
      >
        {viewingSelfie && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs space-y-1">
              <p className="font-semibold text-[#10264D] text-sm">
                {viewingSelfie.personNameSnapshot}
              </p>
              <p className="text-slate-600 tabular-nums">
                {viewingSelfie.attendanceDate} ·{' '}
                {viewingSelfie.eventType === AttendanceEventType.CHECK_IN ? 'Masuk' : 'Pulang'} (
                {getTimeHHMMJakarta(viewingSelfie.serverTimestamp)}) · Metode{' '}
                {viewingSelfie.method}
              </p>
              {viewingSelfie.distanceFromSchoolMeters !== null && (
                <p className="font-mono text-slate-600 tabular-nums">
                  Jarak: {Math.round(viewingSelfie.distanceFromSchoolMeters)} m · Akurasi GPS: ±
                  {Math.round(viewingSelfie.gpsAccuracyMeters ?? 0)} m · Geofence:{' '}
                  {viewingSelfie.geofencePassed ? 'Lolos' : 'Di luar/tidak lolos'}
                </p>
              )}
            </div>

            <div className="flex min-h-[240px] items-center justify-center overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#0F172A]">
              {loadingSelfie ? (
                <p className="text-xs text-slate-300">Membuat tautan sementara...</p>
              ) : signedSelfieUrl ? (
                <img
                  src={signedSelfieUrl}
                  alt={`Bukti selfie ${viewingSelfie.personNameSnapshot}`}
                  referrerPolicy="no-referrer"
                  className="max-h-[360px] w-full object-contain"
                />
              ) : (
                <p className="text-xs text-slate-300">Foto tidak tersedia.</p>
              )}
            </div>

            {viewingSelfie.anomalyFlags && viewingSelfie.anomalyFlags.length > 0 && (
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E] space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Indikator Anomali Lokasi (Diagnostik)
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {viewingSelfie.anomalyFlags.map((flag) => (
                    <li key={flag}>{ANOMALY_FLAG_LABELS[flag] ?? flag}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-[#92400E]/90 pt-1">
                  Catatan: GPS browser tidak menjamin anti-spoofing mutlak; indikator ini digunakan
                  sebagai bahan verifikasi administratif.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="h-4 w-4 text-[#8D6B22] shrink-0" />
              <span>Foto diakses lewat tautan sementara bertanda tangan (berlaku 5 menit).</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Koreksi Kehadiran (Admin/Operator Only) */}
      <Modal
        open={Boolean(correcting)}
        onClose={() => !savingCorr && setCorrecting(null)}
        title="Koreksi Status Kehadiran"
      >
        {correcting && (
          <form onSubmit={handleSubmitCorrection} className="space-y-4">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs space-y-1">
              <p className="font-semibold text-[#10264D] text-sm">
                {correcting.personNameSnapshot}
              </p>
              <p className="text-slate-600">
                {correcting.classNameSnapshot ? `Kelas ${correcting.classNameSnapshot} · ` : ''}
                {correcting.attendanceDate} ·{' '}
                {correcting.eventType === AttendanceEventType.CHECK_IN ? 'Masuk' : 'Pulang'} (
                {getTimeHHMMJakarta(correcting.serverTimestamp)})
              </p>
            </div>

            {corrError && (
              <div
                role="alert"
                className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
              >
                {corrError}
              </div>
            )}

            <Select
              label="Status Kehadiran Baru"
              required
              value={corrStatus}
              onChange={(e) => setCorrStatus(e.target.value as AttendanceStatus)}
              options={[
                { value: AttendanceStatus.PRESENT, label: 'Hadir (PRESENT)' },
                { value: AttendanceStatus.LATE, label: 'Terlambat (LATE)' },
                { value: AttendanceStatus.SICK, label: 'Sakit (SICK)' },
                { value: AttendanceStatus.EXCUSED, label: 'Izin (EXCUSED)' },
                { value: AttendanceStatus.ABSENT, label: 'Alfa (ABSENT)' },
              ]}
            />

            <div className="space-y-1.5">
              <label
                htmlFor="correction-reason"
                className="block text-sm font-medium text-[#10264D]"
              >
                Alasan Koreksi <span className="text-[#B91C1C]">*</span>
              </label>
              <textarea
                id="correction-reason"
                rows={3}
                required
                value={corrReason}
                onChange={(e) => setCorrReason(e.target.value)}
                placeholder="Jelaskan alasan koreksi (minimal 5 karakter, otomatis masuk log audit)..."
                className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-sm text-[#10264D] focus:border-[#10264D] focus:outline-none focus:ring-2 focus:ring-[#10264D]/20"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={() => setCorrecting(null)}
                disabled={savingCorr}
              >
                Batal
              </Button>
              <Button type="submit" variant="primary" loading={savingCorr}>
                Simpan Koreksi
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Pengecualian Manual GPS Gagal (Khusus Admin/Operator) */}
      <Modal
        open={exceptionOpen}
        onClose={() => !savingEx && setExceptionOpen(false)}
        title="Pencatatan Pengecualian Manual (GPS Gagal)"
      >
        <form onSubmit={handleSubmitManualException} className="space-y-4">
          <div className="rounded-lg border border-[#E7D4A3] bg-[#FCF9F1] p-3 text-xs text-[#8D6B22]">
            Jalur pengecualian khusus Admin apabila perangkat guru/siswa gagal memperoleh sinyal
            GPS. Wajib menyertakan alasan jelas yang tercatat permanen pada log audit.
          </div>

          {exError && (
            <div
              role="alert"
              className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              {exError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Kategori"
              required
              value={exPersonType}
              onChange={(e) => {
                setExPersonType(e.target.value as QrOwnerType);
                setExPersonId('');
              }}
              options={[
                { value: QrOwnerType.TEACHER, label: 'Guru' },
                { value: QrOwnerType.STUDENT, label: 'Siswa' },
              ]}
            />
            <Input
              label="Tanggal"
              type="date"
              required
              value={exDate}
              onChange={(e) => setExDate(e.target.value)}
            />
          </div>

          <Select
            label={exPersonType === QrOwnerType.TEACHER ? 'Pilih Guru' : 'Pilih Siswa'}
            required
            value={exPersonId}
            onChange={(e) => setExPersonId(e.target.value)}
            options={[
              {
                value: '',
                label:
                  exPersonType === QrOwnerType.TEACHER
                    ? '-- Pilih guru --'
                    : '-- Pilih siswa --',
              },
              ...exceptionPersonOptions,
            ]}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Jenis Absensi"
              required
              value={exEventType}
              onChange={(e) => setExEventType(e.target.value as AttendanceEventType)}
              options={[
                { value: AttendanceEventType.CHECK_IN, label: 'Masuk (CHECK_IN)' },
                { value: AttendanceEventType.CHECK_OUT, label: 'Pulang (CHECK_OUT)' },
              ]}
            />
            <Select
              label="Status"
              required
              value={exStatus}
              onChange={(e) => setExStatus(e.target.value as AttendanceStatus)}
              options={[
                { value: AttendanceStatus.PRESENT, label: 'Hadir (PRESENT)' },
                { value: AttendanceStatus.LATE, label: 'Terlambat (LATE)' },
                { value: AttendanceStatus.SICK, label: 'Sakit (SICK)' },
                { value: AttendanceStatus.EXCUSED, label: 'Izin (EXCUSED)' },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="exception-reason"
              className="block text-sm font-medium text-[#10264D]"
            >
              Alasan Pengecualian Manual <span className="text-[#B91C1C]">*</span>
            </label>
            <textarea
              id="exception-reason"
              rows={3}
              required
              value={exReason}
              onChange={(e) => setExReason(e.target.value)}
              placeholder="Contoh: GPS perangkat guru tidak terkunci saat hujan di ruang guru, kehadiran diverifikasi fisik oleh Admin..."
              className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-sm text-[#10264D] focus:border-[#10264D] focus:outline-none focus:ring-2 focus:ring-[#10264D]/20"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExceptionOpen(false)}
              disabled={savingEx}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={savingEx}>
              Simpan Pengecualian
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingTarget)}
        onClose={() => !deletingBusy && setDeletingTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Hapus Data Kehadiran?"
        message={
          deletingTarget
            ? `Catatan absensi ${deletingTarget.eventType === AttendanceEventType.CHECK_IN ? 'Masuk' : 'Pulang'} atas nama ${deletingTarget.personNameSnapshot} pada ${deletingTarget.attendanceDate} (${getTimeHHMMJakarta(deletingTarget.serverTimestamp)}) akan dihapus permanen dan dicatat di log audit.`
            : ''
        }
        confirmLabel="Ya, Hapus Data"
        variant="danger"
        loading={deletingBusy}
      />

      <ConfirmDialog
        open={portalConfirmOpen}
        onClose={() => setPortalConfirmOpen(false)}
        onConfirm={() => {
          setPortalConfirmOpen(false);
          navigate('/portal');
        }}
        title="Masuk ke Portal Absensi?"
        message="Perhatian: Setelah masuk ke mode layar penuh Portal Absensi, Anda wajib memasukkan kata sandi keluar portal untuk dapat kembali ke halaman admin atau login."
        confirmLabel="Ya, Buka Portal"
        variant="primary"
      />
    </AppShell>
  );
}

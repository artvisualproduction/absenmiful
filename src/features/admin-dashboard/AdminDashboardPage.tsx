import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  BellRing,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileBarChart2,
  FileCheck2,
  Filter,
  GraduationCap,
  IdCard,
  QrCode,
  RotateCcw,
  School,
  SlidersHorizontal,
  Users,
  UserX,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { AttendanceTrendChart } from '../../components/charts/AttendanceTrendChart';
import { Input } from '../../components/forms/Input';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateLongJakarta, formatDateTimeJakarta, getDateKeyJakarta } from '../../lib/date';
import type { ReportDimension } from '../../lib/reportValidation';
import { ApiClientError } from '../../services/apiClient';
import {
  reportService,
  type ClassRecapRow,
  type DashboardSummaryResponse,
} from '../../services/reportService';
import { AttendanceStatus } from '../../types';

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Login berhasil',
  LOGIN_FAILED: 'Percobaan login gagal',
  PERMISSION_SUBMITTED: 'Pengajuan izin baru',
  PERMISSION_RESUBMITTED: 'Pengajuan ulang izin guru',
  PERMISSION_ADMIN_RECOMMENDED: 'Rekomendasi izin oleh Admin',
  PERMISSION_ADMIN_RETURNED: 'Pengembalian izin oleh Admin',
  PERMISSION_PRINCIPAL_APPROVED: 'Persetujuan izin Kepala Sekolah',
  PERMISSION_PRINCIPAL_REJECTED: 'Penolakan izin Kepala Sekolah',
  PERMISSION_CANCELLED: 'Pembatalan izin guru',
  REPORT_EXPORTED: 'Ekspor laporan kehadiran',
  ATTENDANCE_CORRECTED: 'Koreksi absensi',
  ATTENDANCE_MANUAL_EXCEPTION: 'Pengecualian GPS manual',
  TEACHER_SELF_ATTENDANCE: 'Absensi mandiri guru',
  GPS_SETTINGS_UPDATED: 'Pembaruan pengaturan',
  SYSTEM_RESTORE_POINT_CREATED: 'Restore point dibuat',
  SYSTEM_RESTORE_POINT_APPLIED: 'Pemulihan dari restore point',
  SYSTEM_FACTORY_RESET: 'Reset setelan pabrik',
};

export function AdminDashboardPage() {
  useDocumentTitle('Dashboard Admin');
  const { user } = useAuth();

  const todayDefault = getDateKeyJakarta();
  const [selectedDate, setSelectedDate] = useState(() => todayDefault);
  const [dimension, setDimension] = useState<ReportDimension>('ALL');
  const [classId, setClassId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal filter state
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(selectedDate);
  const [draftDimension, setDraftDimension] = useState<ReportDimension>(dimension);
  const [draftClassId, setDraftClassId] = useState(classId);
  const [draftStatus, setDraftStatus] = useState(statusFilter);

  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeFilterCount =
    (selectedDate !== todayDefault ? 1 : 0) +
    (dimension !== 'ALL' ? 1 : 0) +
    (classId ? 1 : 0) +
    (statusFilter ? 1 : 0);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportService.getDashboardSummary({
        date: selectedDate,
        dimension,
        classId: dimension === 'TEACHER' ? undefined : classId || undefined,
        status: statusFilter || undefined,
      });
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Gagal memuat ringkasan operasional sekolah.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, [selectedDate, dimension, classId, statusFilter]);

  const openFilterModal = () => {
    setDraftDate(selectedDate);
    setDraftDimension(dimension);
    setDraftClassId(classId);
    setDraftStatus(statusFilter);
    setFilterModalOpen(true);
  };

  const applyFilterModal = () => {
    setSelectedDate(draftDate || todayDefault);
    setDimension(draftDimension);
    setClassId(draftDimension === 'TEACHER' ? '' : draftClassId);
    setStatusFilter(draftStatus);
    setFilterModalOpen(false);
  };

  const resetFilterModal = () => {
    const freshDate = getDateKeyJakarta();
    setDraftDate(freshDate);
    setDraftDimension('ALL');
    setDraftClassId('');
    setDraftStatus('');
    setSelectedDate(freshDate);
    setDimension('ALL');
    setClassId('');
    setStatusFilter('');
    setFilterModalOpen(false);
  };

  const classColumns: Array<TableColumn<ClassRecapRow>> = [
    {
      key: 'className',
      header: 'Kelas',
      render: (row) => <span className="font-semibold text-[#10264D]">Kelas {row.className}</span>,
    },
    {
      key: 'totalStudents',
      header: 'Siswa',
      align: 'right',
      render: (row) => <span className="font-mono text-xs tabular-nums">{row.totalStudents}</span>,
    },
    {
      key: 'present',
      header: 'Hadir',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#15803D] tabular-nums">
          {row.present}
        </span>
      ),
    },
    {
      key: 'late',
      header: 'Terlambat',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#B45309] tabular-nums">
          {row.late}
        </span>
      ),
    },
    {
      key: 'excusedSick',
      header: 'Izin/Sakit',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#1D4ED8] tabular-nums">
          {row.excusedSick}
        </span>
      ),
    },
    {
      key: 'missing',
      header: 'Blm Masuk/Pulang',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 tabular-nums">
          {row.missingCheckIn} / {row.missingCheckOut}
        </span>
      ),
    },
    {
      key: 'rate',
      header: '% Hadir',
      align: 'right',
      render: (row) => (
        <StatusBadge
          label={`${row.attendanceRate}%`}
          tone={
            row.attendanceRate >= 90
              ? 'success'
              : row.attendanceRate >= 75
                ? 'warning'
                : 'danger'
          }
          showIcon={false}
        />
      ),
    },
  ];

  return (
    <AppShell
      title="Dashboard Admin"
      subtitle={formatDateLongJakarta()}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openFilterModal}
            title="Filter Ringkasan"
            aria-label="Filter Ringkasan"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white text-[#10264D] hover:border-[#10264D] hover:bg-[#F2F5FA] transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C69B3C] px-1 text-[10px] font-bold text-[#09162E] tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </button>
          <Link to="/admin/reports">
            <Button variant="gold" size="sm" leftIcon={<FileBarChart2 className="h-3.5 w-3.5" />}>
              Buka Laporan
            </Button>
          </Link>
        </div>
      }
    >
      {loading && !data ? (
        <PageSkeleton />
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 text-sm text-[#B91C1C]">
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadSummary()}>
            Coba Lagi
          </Button>
        </div>
      ) : data ? (
        <div className="space-y-5">
          {/* Interactive Navy & Gold Greeting + Overview Banner */}
          <section className="rounded-2xl border border-[#173466] bg-gradient-to-r from-[#0B1C3A] via-[#10264D] to-[#173466] p-5 sm:p-6 text-white shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-white/10 pb-4 mb-4">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#E7D4A3]">
                  Assalamualaikum !
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white truncate">
                  {user?.displayName ?? 'Administrator'}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#E7D4A3] shrink-0">
                <span className="font-semibold uppercase tracking-wider">{data.schoolName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{data.selectedDate}</span>
              </div>
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2.5 max-w-xl">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-3xl sm:text-4xl font-bold tabular-nums text-white">
                    {data.kpis.attendanceRateToday}%
                  </span>
                  <span className="text-xs sm:text-sm text-slate-200">
                    Tingkat Kehadiran ({data.kpis.presentToday} hadir · {data.kpis.lateToday} terlambat)
                  </span>
                </div>
                <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#D5AC4E] to-[#E7D4A3] transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, data.kpis.attendanceRateToday))}%` }}
                  />
                </div>
              </div>

              {/* Interactive Quick Operations */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                <Link
                  to="/portal"
                  className="group flex flex-col justify-between rounded-xl border border-white/15 bg-white/8 px-3.5 py-2.5 hover:border-[#C69B3C]/60 hover:bg-white/12 transition-all"
                >
                  <QrCode className="h-4 w-4 text-[#E7D4A3] mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold text-white">Portal QR</span>
                </Link>
                <Link
                  to="/admin/attendance"
                  className="group flex flex-col justify-between rounded-xl border border-white/15 bg-white/8 px-3.5 py-2.5 hover:border-[#C69B3C]/60 hover:bg-white/12 transition-all"
                >
                  <ClipboardCheck className="h-4 w-4 text-[#E7D4A3] mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold text-white">Kehadiran</span>
                </Link>
                <Link
                  to="/admin/permissions"
                  className="group flex flex-col justify-between rounded-xl border border-white/15 bg-white/8 px-3.5 py-2.5 hover:border-[#C69B3C]/60 hover:bg-white/12 transition-all"
                >
                  <FileCheck2 className="h-4 w-4 text-[#E7D4A3] mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold text-white">Perizinan</span>
                </Link>
                <Link
                  to="/admin/qr-cards"
                  className="group flex flex-col justify-between rounded-xl border border-white/15 bg-white/8 px-3.5 py-2.5 hover:border-[#C69B3C]/60 hover:bg-white/12 transition-all"
                >
                  <IdCard className="h-4 w-4 text-[#E7D4A3] mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold text-white">Kartu QR</span>
                </Link>
              </div>
            </div>
          </section>

          {/* Pending Permission Alert Banner */}
          {data.kpis.pendingAdminPermissions > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7D4A3] bg-[#FCF9F1] px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10264D] text-[#E7D4A3]">
                  <BellRing className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[#10264D]">
                    {data.kpis.pendingAdminPermissions} Pengajuan Izin Guru Menunggu Verifikasi
                  </p>
                  <p className="text-xs text-slate-600 truncate">
                    Periksa kelengkapan alasan dan lampiran sebelum diteruskan ke Kepala Sekolah.
                  </p>
                </div>
              </div>
              <Link to="/admin/permissions">
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                  Verifikasi Sekarang
                </Button>
              </Link>
            </div>
          )}

          {/* Primary KPI Row */}
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <StatCard
              label="Total Siswa Aktif"
              value={data.kpis.activeStudents}
              subtext={`${data.kpis.activeClasses} rombongan belajar aktif`}
              accent="navy"
              icon={<GraduationCap className="h-5 w-5" />}
            />
            <StatCard
              label="Total Guru Aktif"
              value={data.kpis.activeTeachers}
              subtext={data.schoolName}
              accent="gold"
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="Hadir Tanggal Ini"
              value={data.kpis.presentToday}
              subtext={`Tingkat kehadiran ${data.kpis.attendanceRateToday}%`}
              accent="success"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <StatCard
              label="Izin Menunggu Admin"
              value={data.kpis.pendingAdminPermissions}
              subtext={`Menunggu Kepsek: ${data.kpis.pendingPrincipalPermissions}`}
              accent={data.kpis.pendingAdminPermissions > 0 ? 'warning' : 'navy'}
              icon={<FileCheck2 className="h-5 w-5" />}
            />
          </div>

          {/* Secondary Operational KPI Row */}
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <StatCard
              label="Terlambat"
              value={data.kpis.lateToday}
              subtext={`Tanggal ${data.selectedDate}`}
              accent="warning"
              icon={<Clock className="h-4.5 w-4.5" />}
            />
            <StatCard
              label="Izin / Sakit"
              value={data.kpis.excusedSickToday}
              subtext="Termasuk izin guru disetujui"
              accent="navy"
              icon={<CalendarClock className="h-4.5 w-4.5" />}
            />
            <StatCard
              label="Belum Absen Masuk"
              value={data.kpis.missingCheckInToday}
              subtext={`Alfa / belum tercatat: ${data.kpis.absentToday}`}
              accent="danger"
              icon={<UserX className="h-4.5 w-4.5" />}
            />
            <StatCard
              label="Belum Absen Pulang"
              value={data.kpis.missingCheckOutToday}
              subtext="Sudah masuk, belum pulang"
              accent="gold"
              icon={<Clock className="h-4.5 w-4.5" />}
            />
          </div>

          {/* Trend Chart + Recent Activity Feed */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <AttendanceTrendChart
                title="Tren Kehadiran 7 Hari Terakhir"
                subtitle={`Rentang berakhir ${data.selectedDate} · Klik tombol Tabel untuk tampilan aksesibel`}
                data={data.trend}
              />
            </div>

            <section className="rounded-2xl border border-[#E2E8F0]/90 bg-white overflow-hidden shadow-[0_1px_2px_rgba(16,38,77,0.03)] flex flex-col">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#FDF8EC] text-[#9A711D] ring-1 ring-[#C69B3C]/20">
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <h3 className="text-[13px] font-bold text-[#10264D]">Aktivitas Terbaru</h3>
                </div>
                <Link
                  to="/admin/attendance"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#10264D] hover:text-[#C69B3C]"
                >
                  <span>Lihat</span>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
              <div className="divide-y divide-[#F1F5F9] px-4 py-1 flex-1">
                {data.recentActivities.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">
                    Belum ada aktivitas terekam.
                  </p>
                ) : (
                  data.recentActivities.map((act) => (
                    <div key={act.id} className="py-2.5 flex items-start gap-2.5">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#10264D]">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-semibold text-[#10264D] truncate">
                          {ACTION_LABELS[act.action] ?? act.action}
                        </p>
                        <p className="text-[11px] text-slate-600 truncate">
                          {act.actorName} · {act.actorRole}
                          {act.reason ? ` · ${act.reason}` : ''}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400 tabular-nums">
                          {formatDateTimeJakarta(act.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Per-Class Recap */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF3FA] text-[#10264D] ring-1 ring-[#10264D]/10">
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <h2 className="text-[13.5px] font-bold text-[#10264D] truncate">
                  Rekap Kehadiran Siswa per Kelas ({data.selectedDate})
                </h2>
              </div>
              <Link
                to="/admin/reports"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#10264D] hover:text-[#C69B3C] whitespace-nowrap shrink-0"
              >
                <span>Laporan Lengkap</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <DataTable
              columns={classColumns}
              data={data.classBreakdown}
              emptyTitle="Belum ada data kelas aktif"
            />
          </div>
        </div>
      ) : null}

      {/* Pop-up Filter Ringkasan */}
      <Modal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Filter Ringkasan Harian"
        description="Sesuaikan tanggal pantauan, kategori pengguna, kelas, atau status kehadiran."
      >
        <div className="space-y-4">
          <Input
            label="Tanggal Pantauan"
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            leftAddon={<Calendar className="h-3.5 w-3.5" />}
          />
          <Select
            label="Jenis Pengguna"
            value={draftDimension}
            leftAddon={<Users className="h-3.5 w-3.5" />}
            onChange={(e) => {
              const next = e.target.value as ReportDimension;
              setDraftDimension(next);
              if (next === 'TEACHER') setDraftClassId('');
            }}
            options={[
              { value: 'ALL', label: 'Siswa & Guru' },
              { value: 'STUDENT', label: 'Siswa Saja' },
              { value: 'TEACHER', label: 'Guru Saja' },
            ]}
          />
          <Select
            label="Kelas"
            value={draftClassId}
            disabled={draftDimension === 'TEACHER'}
            leftAddon={<School className="h-3.5 w-3.5" />}
            onChange={(e) => setDraftClassId(e.target.value)}
            options={[
              { value: '', label: 'Semua Kelas' },
              ...(data?.classes ?? []).map((c) => ({ value: c.id, label: `Kelas ${c.name}` })),
            ]}
          />
          <Select
            label="Filter Status"
            value={draftStatus}
            leftAddon={<Filter className="h-3.5 w-3.5" />}
            onChange={(e) => setDraftStatus(e.target.value)}
            options={[
              { value: '', label: 'Semua Status' },
              { value: AttendanceStatus.PRESENT, label: 'Hadir' },
              { value: AttendanceStatus.LATE, label: 'Terlambat' },
              { value: AttendanceStatus.SICK, label: 'Sakit' },
              { value: AttendanceStatus.EXCUSED, label: 'Izin' },
              { value: AttendanceStatus.ABSENT, label: 'Alfa' },
              { value: 'MISSING_CHECK_IN', label: 'Belum Absen Masuk' },
              { value: 'MISSING_CHECK_OUT', label: 'Belum Absen Pulang' },
            ]}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F1F5F9]">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilterModal}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Reset Default
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setFilterModalOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" size="sm" onClick={applyFilterModal}>
                Terapkan Filter
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Clock,
  FileBarChart2,
  GraduationCap,
  History,
  RotateCcw,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { AttendanceTrendChart } from '../../components/charts/AttendanceTrendChart';
import { Input } from '../../components/forms/Input';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/StatCard';
import { mapStatusToBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  formatDateLongJakarta,
  formatDateTimeJakarta,
  getDateKeyJakarta,
  getTimeHHMMJakarta,
} from '../../lib/date';
import { PERMISSION_LEAVE_TYPE_LABELS } from '../../lib/permissionValidation';
import { formatIndonesianDaysList } from '../../lib/teacherWorkingDays';
import { ApiClientError } from '../../services/apiClient';
import {
  attendanceService,
  type MyAttendanceResponse,
} from '../../services/attendanceService';
import {
  reportService,
  type ClassRecapRow,
  type DashboardSummaryResponse,
} from '../../services/reportService';

export function PrincipalDashboardPage() {
  useDocumentTitle('Dashboard Kepala Sekolah');
  const { user } = useAuth();

  const todayDefault = getDateKeyJakarta();
  const [selectedDate, setSelectedDate] = useState(() => todayDefault);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(selectedDate);

  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [myAttendance, setMyAttendance] = useState<MyAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFiltered = selectedDate !== todayDefault;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, myAttRes] = await Promise.all([
        reportService.getDashboardSummary({
          date: selectedDate,
          dimension: 'ALL',
        }),
        attendanceService.getMyAttendance({ limit: 5 }).catch(() => null),
      ]);
      setData(res);
      setMyAttendance(myAttRes);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Gagal memuat ringkasan kehadiran madrasah.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [selectedDate]);

  const classColumns: Array<TableColumn<ClassRecapRow>> = [
    {
      key: 'className',
      header: 'Nama Kelas',
      render: (row) => <span className="font-semibold text-[#10264D]">Kelas {row.className}</span>,
    },
    {
      key: 'totalStudents',
      header: 'Siswa Aktif',
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
      key: 'absent',
      header: 'Belum Hadir / Alfa',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#B91C1C] tabular-nums">
          {row.absent}
        </span>
      ),
    },
    {
      key: 'attendanceRate',
      header: 'Kehadiran',
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
      title="Dashboard Kepala Sekolah"
      subtitle={formatDateLongJakarta()}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraftDate(selectedDate);
              setFilterModalOpen(true);
            }}
            title="Filter Tanggal Ringkasan"
            aria-label="Filter Tanggal Ringkasan"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white text-[#10264D] hover:border-[#10264D] hover:bg-[#F2F5FA] transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {isFiltered && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C69B3C] px-1 text-[10px] font-bold text-[#09162E]">
                1
              </span>
            )}
          </button>
          <Link to="/principal/reports">
            <Button variant="gold" size="sm" leftIcon={<FileBarChart2 className="h-3.5 w-3.5" />}>
              Unduh Laporan
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
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Coba Lagi
          </Button>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Interactive Greeting + Executive Banner */}
          <section className="rounded-2xl border border-[#173466] bg-gradient-to-r from-[#0B1C3A] via-[#10264D] to-[#173466] p-5 sm:p-6 text-white shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-white/10 pb-4 mb-4">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#E7D4A3]">
                  Assalamualaikum !
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white truncate">
                  {user?.displayName ?? 'Kepala Sekolah'}
                </h2>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="inline-flex items-center rounded-md bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white border border-white/15">
                    Kepala Madrasah / Kepala Sekolah
                  </span>
                </div>
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
                    Kehadiran Madrasah ({data.kpis.presentToday} hadir · {data.kpis.lateToday} terlambat)
                  </span>
                </div>
                <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#D5AC4E] to-[#E7D4A3] transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, data.kpis.attendanceRateToday))}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                <Link
                  to="/principal/monitoring"
                  className="group flex flex-col justify-between rounded-xl border border-white/15 bg-white/8 px-3.5 py-2.5 hover:border-[#C69B3C]/60 hover:bg-white/12 transition-all"
                >
                  <ClipboardCheck className="h-4 w-4 text-[#E7D4A3] mb-1.5" />
                  <span className="text-xs font-semibold text-white">Monitoring</span>
                </Link>
                <Link
                  to="/principal/recap-students"
                  className="group flex flex-col justify-between rounded-xl border border-white/15 bg-white/8 px-3.5 py-2.5 hover:border-[#C69B3C]/60 hover:bg-white/12 transition-all"
                >
                  <GraduationCap className="h-4 w-4 text-[#E7D4A3] mb-1.5" />
                  <span className="text-xs font-semibold text-white">Rekap Siswa</span>
                </Link>
                <Link
                  to="/principal/recap-teachers"
                  className="group flex flex-col justify-between rounded-xl border border-white/15 bg-white/8 px-3.5 py-2.5 hover:border-[#C69B3C]/60 hover:bg-white/12 transition-all"
                >
                  <Users className="h-4 w-4 text-[#E7D4A3] mb-1.5" />
                  <span className="text-xs font-semibold text-white">Rekap Guru</span>
                </Link>
                <Link
                  to="/principal/permissions"
                  className="group flex flex-col justify-between rounded-xl border border-white/15 bg-white/8 px-3.5 py-2.5 hover:border-[#C69B3C]/60 hover:bg-white/12 transition-all"
                >
                  <CheckSquare className="h-4 w-4 text-[#E7D4A3] mb-1.5" />
                  <span className="text-xs font-semibold text-white">Persetujuan</span>
                </Link>
              </div>
            </div>
          </section>

          {/* Absensi Harian Kepala Sekolah */}
          <section className="rounded-xl border border-[#CBD5E1] border-l-4 border-l-[#C69B3C] bg-white p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between shadow-xs">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-[#10264D]">
                  Absensi Harian Kepala Sekolah ({myAttendance?.todayDate ?? todayDefault})
                </h3>
                {myAttendance?.isTodayHlt ? (
                  <span className="inline-flex items-center rounded-md border border-[#99F6E4] bg-[#F0FDFA] px-2 py-0.5 text-[11px] font-semibold text-[#0F766E]">
                    HLT Hari Ini
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md border border-[#E7D4A3] bg-[#FCF9F1] px-2 py-0.5 text-[11px] font-semibold text-[#8D6B22]">
                    Wajib Absen Harian
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums">
                <span>
                  Masuk:{' '}
                  <strong className="font-mono text-[#10264D]">
                    {myAttendance?.todayCheckIn
                      ? getTimeHHMMJakarta(myAttendance.todayCheckIn.serverTimestamp)
                      : 'Belum tercatat'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Pulang:{' '}
                  <strong className="font-mono text-[#10264D]">
                    {myAttendance?.todayCheckOut
                      ? getTimeHHMMJakarta(myAttendance.todayCheckOut.serverTimestamp)
                      : 'Belum tercatat'}
                  </strong>
                </span>
                {myAttendance?.teacherWorkingDays && myAttendance.teacherWorkingDays.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Hari masuk:{' '}
                      <strong className="text-[#10264D]">
                        {formatIndonesianDaysList(myAttendance.teacherWorkingDays)}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {myAttendance?.todayCheckIn && (
                <StatusBadge
                  label={`Masuk: ${mapStatusToBadge(myAttendance.todayCheckIn.status).label}`}
                  tone={mapStatusToBadge(myAttendance.todayCheckIn.status).tone}
                />
              )}
              <Link to="/principal/history">
                <Button variant="outline" size="sm" leftIcon={<History className="h-3.5 w-3.5" />}>
                  Riwayat Saya
                </Button>
              </Link>
              <Link to="/principal/attendance">
                <Button
                  variant="gold"
                  size="sm"
                  leftIcon={<ClipboardCheck className="h-3.5 w-3.5" />}
                >
                  {!myAttendance?.todayCheckIn
                    ? 'Absen Masuk Sekarang'
                    : !myAttendance?.todayCheckOut
                      ? 'Absen Pulang Sekarang'
                      : 'Lihat Absensi Saya'}
                </Button>
              </Link>
            </div>
          </section>

          {/* Pending Principal Decision Banner */}
          {data.kpis.pendingPrincipalPermissions > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E7D4A3] bg-[#FCF9F1] px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#10264D] px-2 font-mono text-sm font-bold text-[#C69B3C] tabular-nums">
                  {data.kpis.pendingPrincipalPermissions}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#10264D]">
                    Pengajuan Izin Guru Menunggu Keputusan Kepala Sekolah
                  </p>
                  <p className="text-xs text-slate-600">
                    Seluruh pengajuan di antrean ini telah melewati tahap verifikasi Admin.
                  </p>
                </div>
              </div>
              <Link to="/principal/permissions">
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                  Tinjau &amp; Putuskan
                </Button>
              </Link>
            </div>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Ringkasan Kehadiran Madrasah"
              value={`${data.kpis.attendanceRateToday}%`}
              subtext={`Hadir ${data.kpis.presentToday} · Terlambat ${data.kpis.lateToday}`}
              accent="success"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <StatCard
              label="Total Siswa & Rombel"
              value={data.kpis.activeStudents}
              subtext={`${data.kpis.activeClasses} kelas aktif`}
              accent="navy"
              icon={<GraduationCap className="h-5 w-5" />}
            />
            <StatCard
              label="Total Pendidik Aktif"
              value={data.kpis.activeTeachers}
              subtext={`Izin/Sakit hari ini: ${data.kpis.excusedSickToday}`}
              accent="gold"
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="Izin Menunggu Keputusan"
              value={data.kpis.pendingPrincipalPermissions}
              subtext={`Menunggu Admin: ${data.kpis.pendingAdminPermissions}`}
              accent={data.kpis.pendingPrincipalPermissions > 0 ? 'warning' : 'navy'}
              icon={<CheckSquare className="h-5 w-5" />}
            />
          </div>

          {/* Lateness & Absence Trend Chart + Pending Decisions Panel */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <AttendanceTrendChart
                title="Tren Keterlambatan & Ketidakhadiran (7 Hari)"
                subtitle={`Data siswa & guru hingga ${data.selectedDate}`}
                data={data.trend}
                variant="lateness"
              />
            </div>

            <section className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#8D6B22]" />
                  <h3 className="text-sm font-semibold text-[#10264D]">
                    Menunggu Keputusan ({data.kpis.pendingPrincipalPermissions})
                  </h3>
                </div>
                <Link
                  to="/principal/permissions"
                  className="text-xs font-medium text-[#10264D] hover:text-[#C69B3C]"
                >
                  Semua
                </Link>
              </div>
              <div className="divide-y divide-[#E2E8F0] px-5 py-2">
                {data.pendingPrincipalList.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">
                    Tidak ada pengajuan izin yang menunggu keputusan Anda.
                  </p>
                ) : (
                  data.pendingPrincipalList.map((perm) => (
                    <div key={perm.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#10264D]">
                          {perm.teacherNameSnapshot}
                        </p>
                        <StatusBadge
                          label={PERMISSION_LEAVE_TYPE_LABELS[perm.leaveType]}
                          tone="gold"
                          showIcon={false}
                        />
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2">{perm.reason}</p>
                      <p className="font-mono text-[10px] text-slate-400 tabular-nums">
                        {formatDateTimeJakarta(perm.startAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Per-Class Recap & Recent Decisions */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-3 xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#10264D]">
                  Rekap Kehadiran per Kelas ({data.selectedDate})
                </h2>
                <div className="flex items-center gap-3 text-xs font-medium">
                  <Link
                    to="/principal/recap-students"
                    className="text-[#10264D] hover:text-[#C69B3C]"
                  >
                    Rekap Siswa
                  </Link>
                  <Link
                    to="/principal/recap-teachers"
                    className="text-[#10264D] hover:text-[#C69B3C]"
                  >
                    Rekap Guru
                  </Link>
                </div>
              </div>
              <DataTable
                columns={classColumns}
                data={data.classBreakdown}
                emptyTitle="Belum ada data kelas"
              />
            </div>

            <section className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
                <h3 className="text-sm font-semibold text-[#10264D]">Riwayat Keputusan Terbaru</h3>
                <Link
                  to="/principal/approval-history"
                  className="text-xs font-medium text-[#10264D] hover:text-[#C69B3C]"
                >
                  Lihat Semua
                </Link>
              </div>
              <div className="divide-y divide-[#E2E8F0] px-5 py-2">
                {data.recentDecisions.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">
                    Belum ada riwayat persetujuan atau penolakan.
                  </p>
                ) : (
                  data.recentDecisions.map((perm) => {
                    const badge = mapStatusToBadge(perm.status);
                    return (
                      <div key={perm.id} className="py-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[#10264D]">
                            {perm.teacherNameSnapshot}
                          </p>
                          <StatusBadge label={badge.label} tone={badge.tone} showIcon={false} />
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {perm.principalDecision?.note || PERMISSION_LEAVE_TYPE_LABELS[perm.leaveType]}
                        </p>
                        {perm.principalDecision?.decidedAt && (
                          <p className="font-mono text-[10px] text-slate-400 tabular-nums">
                            {formatDateTimeJakarta(perm.principalDecision.decidedAt)}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      <Modal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Filter Ringkasan Madrasah"
        description="Pilih tanggal pantauan untuk melihat rekap kehadiran madrasah pada hari tertentu."
      >
        <div className="space-y-4">
          <Input
            label="Tanggal Pantauan"
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            leftAddon={<Calendar className="h-3.5 w-3.5" />}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F1F5F9]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const fresh = getDateKeyJakarta();
                setDraftDate(fresh);
                setSelectedDate(fresh);
                setFilterModalOpen(false);
              }}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Hari Ini
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setFilterModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedDate(draftDate || todayDefault);
                  setFilterModalOpen(false);
                }}
              >
                Terapkan
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

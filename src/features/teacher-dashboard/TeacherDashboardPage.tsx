import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  Clock,
  FileCheck2,
  History,
  KeyRound,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { TeacherWorkingDaysNotice } from '../../components/attendance/TeacherWorkingDaysNotice';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/StatCard';
import { mapStatusToBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateLongJakarta, getTimeHHMMJakarta, INDONESIAN_DAY_NAMES } from '../../lib/date';
import { ApiClientError } from '../../services/apiClient';
import {
  attendanceService,
  type MyAttendanceResponse,
} from '../../services/attendanceService';
import {
  permissionService,
  type MyPermissionListResponse,
} from '../../services/permissionService';
import {
  scheduleRulesService,
  type MyTeacherScheduleResponse,
} from '../../services/scheduleRulesService';

import {
  masterDataService,
} from '../../services/masterDataService';

export function TeacherDashboardPage() {
  useDocumentTitle('Dashboard Guru');
  const { user } = useAuth();

  const [scheduleData, setScheduleData] = useState<MyTeacherScheduleResponse | null>(null);
  const [attendanceData, setAttendanceData] = useState<MyAttendanceResponse | null>(null);
  const [permissionData, setPermissionData] = useState<MyPermissionListResponse | null>(null);
  const [homeroomClassName, setHomeroomClassName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [schedRes, attRes, permRes, classesRes] = await Promise.all([
          scheduleRulesService.getMyTeacherSchedule(),
          attendanceService.getMyAttendance({ limit: 5 }),
          permissionService.listMyPermissions({ limit: 5 }),
          masterDataService.listClasses().catch(() => ({ items: [] })),
        ]);
        if (active) {
          setScheduleData(schedRes);
          setAttendanceData(attRes);
          setPermissionData(permRes);
          if (user?.linkedTeacherId) {
            const foundClass = classesRes.items.find(
              (c) => c.homeroomTeacherId === user.linkedTeacherId,
            );
            setHomeroomClassName(foundClass ? foundClass.name : null);
          }
        }
      } catch (err) {
        if (active) {
          setLoadError(
            err instanceof ApiClientError
              ? err.message
              : 'Gagal memuat ringkasan jadwal dan absensi Anda.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadDashboard();
    return () => {
      active = false;
    };
  }, [user?.linkedTeacherId]);

  const todayCount = scheduleData?.todaySchedules.length ?? 0;
  const weeklyCount = scheduleData?.weeklySchedules.length ?? 0;
  const upcomingPreview = (scheduleData?.upcomingSchedules ?? []).slice(0, 4);
  const todayCheckIn = attendanceData?.todayCheckIn ?? null;
  const todayCheckOut = attendanceData?.todayCheckOut ?? null;

  return (
    <AppShell
      title="Dashboard Guru"
      subtitle={formatDateLongJakarta()}
      hideActionsOnMobile
      actions={
        <Link to="/teacher/attendance">
          <Button variant="gold" size="sm" leftIcon={<ClipboardCheck className="h-4 w-4" />}>
            Absensi Mandiri
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Greeting & Identity */}
        <div className="rounded-2xl border border-[#173466] bg-gradient-to-r from-[#0B1C3A] via-[#10264D] to-[#173466] p-6 text-white flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#E7D4A3]">
              Assalamualaikum !
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
              {user?.displayName ?? 'Guru'}
            </h2>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-200">
              {user?.position && (
                <span className="inline-flex items-center rounded-md bg-white/10 px-2.5 py-0.5 font-medium text-white border border-white/15">
                  {user.position}
                </span>
              )}
              {homeroomClassName && (
                <span className="inline-flex items-center rounded-md bg-[#C69B3C]/20 px-2.5 py-0.5 font-medium text-[#E7D4A3] border border-[#C69B3C]/40">
                  Wali Kelas {homeroomClassName}
                </span>
              )}
            </div>
          </div>
          <div className="hidden sm:flex flex-wrap gap-2">
            <Link to="/teacher/attendance">
              <Button variant="gold" size="sm" leftIcon={<ClipboardCheck className="h-4 w-4" />}>
                Absen Masuk / Pulang
              </Button>
            </Link>
            <Link to="/teacher/history">
              <Button
                variant="outline"
                size="sm"
                className="border-white/25 bg-white/10 text-white hover:bg-white/20"
                leftIcon={<History className="h-4 w-4" />}
              >
                Riwayat Absensi
              </Button>
            </Link>
            <Link to="/teacher/permissions">
              <Button
                variant="outline"
                size="sm"
                className="border-white/25 bg-white/10 text-white hover:bg-white/20"
                leftIcon={<FileCheck2 className="h-4 w-4" />}
              >
                Ajukan Izin
              </Button>
            </Link>
            <Link to="/change-password">
              <Button
                variant="outline"
                size="sm"
                className="border-white/25 bg-white/10 text-white hover:bg-white/20"
                leftIcon={<KeyRound className="h-4 w-4" />}
              >
                Ganti Sandi
              </Button>
            </Link>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Status Masuk Hari Ini"
            value={
              loading
                ? '…'
                : todayCheckIn
                  ? getTimeHHMMJakarta(todayCheckIn.serverTimestamp)
                  : 'Belum Absen'
            }
            subtext={
              loading
                ? 'Memeriksa catatan server...'
                : todayCheckIn
                  ? `${mapStatusToBadge(todayCheckIn.status).label}${
                      todayCheckOut
                        ? ` · Pulang ${getTimeHHMMJakarta(todayCheckOut.serverTimestamp)}`
                        : ' · Belum absen pulang'
                    }`
                  : 'Gunakan Absensi Mandiri dengan selfie & GPS'
            }
            accent={todayCheckIn ? 'success' : 'navy'}
            icon={<ClipboardCheck className="h-5 w-5" />}
          />
          <StatCard
            label="Jadwal Mengajar Hari Ini"
            value={loading ? '…' : todayCount}
            subtext={
              loading
                ? 'Memuat jadwal pribadi...'
                : `${weeklyCount} sesi aktif dalam seminggu`
            }
            accent="gold"
            icon={<CalendarClock className="h-5 w-5" />}
          />
          <StatCard
            label="Total Kehadiran Tercatat"
            value={loading ? '…' : (attendanceData?.summary.total ?? 0)}
            subtext={
              loading
                ? 'Memuat rekap...'
                : `Hadir ${attendanceData?.summary.present ?? 0} · Terlambat ${attendanceData?.summary.late ?? 0}`
            }
            accent="navy"
            icon={<History className="h-5 w-5" />}
          />
          <StatCard
            label="Pengajuan Izin Aktif"
            value={loading ? '…' : (permissionData?.counts.active ?? 0)}
            subtext={
              loading
                ? 'Memuat perizinan...'
                : `Disetujui ${permissionData?.counts.approved ?? 0} · Dikembalikan ${permissionData?.counts.returned ?? 0}`
            }
            accent={(permissionData?.counts.returned ?? 0) > 0 ? 'warning' : 'gold'}
            icon={<FileCheck2 className="h-5 w-5" />}
          />
        </div>

        {loadError && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Today's Self-Attendance Quick Status Banner */}
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#10264D]">
              Ringkasan Absensi Hari Ini ({attendanceData?.todayDate ?? 'Hari Ini'})
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums">
              <span>
                Masuk:{' '}
                <strong className="font-mono text-[#10264D]">
                  {todayCheckIn
                    ? getTimeHHMMJakarta(todayCheckIn.serverTimestamp)
                    : 'Belum tercatat'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Pulang:{' '}
                <strong className="font-mono text-[#10264D]">
                  {todayCheckOut
                    ? getTimeHHMMJakarta(todayCheckOut.serverTimestamp)
                    : 'Belum tercatat'}
                </strong>
              </span>
              {attendanceData?.activeLocation && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Radius sekolah: {attendanceData.activeLocation.radiusMeters} m
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {todayCheckIn && (
              <StatusBadge
                label={`Masuk: ${mapStatusToBadge(todayCheckIn.status).label}`}
                tone={mapStatusToBadge(todayCheckIn.status).tone}
              />
            )}
            <Link to="/teacher/attendance">
              <Button variant="gold" size="sm">
                {!todayCheckIn
                  ? 'Absen Masuk Sekarang'
                  : !todayCheckOut
                    ? 'Absen Pulang Sekarang'
                    : 'Lihat Detail Absensi'}
              </Button>
            </Link>
          </div>
        </section>

        {/* Ketentuan Hari Masuk Guru & HLT (tepat sebelum jadwal mengajar) */}
        <TeacherWorkingDaysNotice
          workingDays={attendanceData?.teacherWorkingDays ?? scheduleData?.teacherWorkingDays}
          hltDays={attendanceData?.teacherHltDays ?? scheduleData?.teacherHltDays}
          isTodayHlt={attendanceData?.isTodayHlt ?? scheduleData?.isTodayHlt}
          todayDayOfWeek={scheduleData?.todayDayOfWeek ?? attendanceData?.todayDayOfWeek}
          teacherRule={attendanceData?.teacherRule ?? scheduleData?.teacherRule}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Jadwal Hari Ini */}
          <section className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
              <div>
                <h3 className="text-sm font-semibold text-[#10264D]">Jadwal Mengajar Hari Ini</h3>
                <p className="text-xs text-slate-500">
                  {scheduleData
                    ? INDONESIAN_DAY_NAMES[scheduleData.todayDayOfWeek]
                    : 'Jadwal hari ini'}
                </p>
              </div>
              <Link
                to="/teacher/schedules"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#10264D] hover:text-[#C69B3C]"
              >
                Lihat Semua
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                </div>
              ) : !scheduleData || scheduleData.todaySchedules.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="h-5 w-5" />}
                  title="Tidak ada jadwal hari ini"
                  description="Anda tidak memiliki sesi mengajar terjadwal untuk hari ini."
                />
              ) : (
                <div className="space-y-3">
                  {scheduleData.todaySchedules.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-[#E7D4A3] bg-[#FCF9F1] p-3.5 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[#10264D]">
                          {item.subjectName}{' '}
                          <span className="font-mono text-xs font-normal text-slate-500">
                            ({item.subjectCode})
                          </span>
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1 font-mono font-medium text-[#8D6B22] tabular-nums">
                            <Clock className="h-3.5 w-3.5" />
                            {item.startTime} – {item.endTime}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {item.room || 'Ruang kelas reguler'}
                          </span>
                        </div>
                      </div>
                      <StatusBadge label={`Kelas ${item.className}`} tone="gold" showIcon={false} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Jadwal Mendatang */}
          <section className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
              <div>
                <h3 className="text-sm font-semibold text-[#10264D]">Jadwal Mendatang</h3>
                <p className="text-xs text-slate-500">Sesi mengajar berikutnya dalam minggu ini</p>
              </div>
              <Link
                to="/teacher/schedules"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#10264D] hover:text-[#C69B3C]"
              >
                Jadwal Lengkap
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                </div>
              ) : upcomingPreview.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="h-5 w-5" />}
                  title="Belum ada jadwal mendatang"
                  description="Jadwal mengajar mendatang akan tampil di sini secara otomatis."
                />
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {upcomingPreview.map((item) => (
                    <div
                      key={item.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#8D6B22]">
                            {INDONESIAN_DAY_NAMES[item.dayOfWeek]}
                          </span>
                          <span className="font-mono text-xs text-slate-500 tabular-nums">
                            {item.startTime}–{item.endTime}
                          </span>
                        </div>
                        <p className="truncate text-sm font-medium text-[#10264D]">
                          {item.subjectName}
                        </p>
                      </div>
                      <span className="shrink-0 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-xs font-semibold text-[#10264D]">
                        Kelas {item.className}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

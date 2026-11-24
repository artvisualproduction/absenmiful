import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, CalendarDays, Clock, MapPin } from 'lucide-react';
import { TeacherWorkingDaysNotice } from '../../components/attendance/TeacherWorkingDaysNotice';
import { AppShell } from '../../components/layout/AppShell';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateLongJakarta, INDONESIAN_DAY_NAMES } from '../../lib/date';
import { ApiClientError } from '../../services/apiClient';
import {
  scheduleRulesService,
  type MyTeacherScheduleItem,
  type MyTeacherScheduleResponse,
} from '../../services/scheduleRulesService';

export function TeacherSchedulePage() {
  useDocumentTitle('Jadwal Mengajar Saya');

  const [data, setData] = useState<MyTeacherScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await scheduleRulesService.getMyTeacherSchedule();
        if (active) setData(res);
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : 'Gagal memuat jadwal mengajar pribadi Anda.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const groupedByDay = useMemo(() => {
    const map = new Map<number, MyTeacherScheduleItem[]>();
    if (!data) return map;
    for (const item of data.weeklySchedules) {
      const list = map.get(item.dayOfWeek) ?? [];
      list.push(item);
      map.set(item.dayOfWeek, list);
    }
    return map;
  }, [data]);

  const activeDays = useMemo(() => {
    return Array.from(groupedByDay.keys()).sort((a, b) => a - b);
  }, [groupedByDay]);

  return (
    <AppShell
      title="Jadwal Mengajar Saya"
      subtitle={`Menampilkan jadwal resmi yang tertaut pada akun Anda · ${formatDateLongJakarta()}`}
    >
      <div className="space-y-6">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Ketentuan Hari Masuk Guru & HLT (di bagian atas menu jadwal) */}
        <TeacherWorkingDaysNotice
          workingDays={data?.teacherWorkingDays}
          hltDays={data?.teacherHltDays}
          isTodayHlt={data?.isTodayHlt}
          todayDayOfWeek={data?.todayDayOfWeek}
          teacherRule={data?.teacherRule}
        />

        {/* Section 1: Jadwal Hari Ini */}
        <section className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#10264D] px-5 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="h-4 w-4 text-[#C69B3C]" />
              <h2 className="text-sm font-semibold">
                Jadwal Hari Ini (
                {data ? INDONESIAN_DAY_NAMES[data.todayDayOfWeek] : 'Hari Ini'})
              </h2>
            </div>
            {data && (
              <span className="rounded bg-white/15 px-2.5 py-0.5 text-xs font-medium tabular-nums">
                {data.todaySchedules.length} sesi
              </span>
            )}
          </div>

          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
            ) : !data || data.todaySchedules.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-6 w-6" />}
                title="Tidak ada jadwal mengajar hari ini"
                description="Anda tidak memiliki sesi mengajar terjadwal pada hari ini."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {data.todaySchedules.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#E7D4A3] bg-[#FCF9F1] p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#8D6B22] tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        {item.startTime} – {item.endTime}
                      </span>
                      <StatusBadge label={`Kelas ${item.className}`} tone="gold" showIcon={false} />
                    </div>
                    <p className="text-base font-bold text-[#10264D]">{item.subjectName}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                        {item.subjectCode}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {item.room || 'Ruang kelas reguler'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Seluruh Jadwal Mingguan */}
        <section className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-[#10264D]">Jadwal Mingguan Lengkap</h2>
              <p className="text-xs text-slate-500">
                Seluruh sesi mengajar aktif Anda dari Senin hingga Minggu.
              </p>
            </div>
            {data && (
              <span className="text-xs font-medium text-slate-600 tabular-nums">
                Total {data.weeklySchedules.length} sesi/minggu
              </span>
            )}
          </div>

          <div className="p-5">
            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Skeleton className="h-36 rounded-lg" />
                <Skeleton className="h-36 rounded-lg" />
              </div>
            ) : activeDays.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-6 w-6" />}
                title="Belum ada jadwal mingguan"
                description="Hubungi Admin Madrasah apabila jadwal mengajar Anda belum dimasukkan."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeDays.map((day) => {
                  const items = groupedByDay.get(day) ?? [];
                  const isToday = data?.todayDayOfWeek === day;
                  return (
                    <div
                      key={day}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] overflow-hidden"
                    >
                      <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-2.5">
                        <span className="text-sm font-semibold text-[#10264D]">
                          {INDONESIAN_DAY_NAMES[day]}
                        </span>
                        {isToday ? (
                          <StatusBadge label="Hari Ini" tone="gold" showIcon={false} />
                        ) : (
                          <span className="text-xs text-slate-500 tabular-nums">
                            {items.length} sesi
                          </span>
                        )}
                      </div>
                      <div className="divide-y divide-[#E2E8F0] bg-white">
                        {items.map((item) => (
                          <div key={item.id} className="px-4 py-3 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-[#10264D] tabular-nums">
                                {item.startTime} – {item.endTime}
                              </span>
                              <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-semibold text-[#10264D]">
                                Kelas {item.className}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-[#10264D]">
                              {item.subjectName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.subjectCode} · {item.room || 'Ruang kelas reguler'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

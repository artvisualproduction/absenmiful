import { CalendarCheck2, CalendarOff, Clock, Info } from 'lucide-react';
import { INDONESIAN_DAY_NAMES } from '../../lib/date';
import {
  formatIndonesianDaysList,
  normalizeWorkingDays,
} from '../../lib/teacherWorkingDays';
import type { AttendanceRule } from '../../types';

export interface TeacherWorkingDaysNoticeProps {
  workingDays?: number[];
  hltDays?: number[];
  isTodayHlt?: boolean;
  todayDayOfWeek?: number;
  teacherRule?: AttendanceRule | null;
}

export function TeacherWorkingDaysNotice({
  workingDays,
  hltDays,
  isTodayHlt,
  todayDayOfWeek,
  teacherRule,
}: TeacherWorkingDaysNoticeProps) {
  const normalizedWork = normalizeWorkingDays(workingDays);
  const normalizedHlt = normalizeWorkingDays(hltDays);
  const effectiveWorkDays = normalizedWork.length > 0 ? normalizedWork : [1, 2, 3, 4, 5, 6];
  const todayLabel = todayDayOfWeek ? INDONESIAN_DAY_NAMES[todayDayOfWeek] : null;

  return (
    <section
      aria-label="Ketentuan Hari Masuk Guru dan HLT"
      className="rounded-xl border border-[#CBD5E1] border-l-4 border-l-[#10264D] bg-gradient-to-r from-[#F8FAFC] via-white to-[#FCF9F1] p-4 sm:p-5 space-y-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#10264D] text-[#E7D4A3]">
            <Info className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#10264D]">
              Ketentuan Hari Masuk Guru &amp; HLT (Hari Libur Tertentu)
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Pendidik wajib melakukan absensi kehadiran pada hari masuk yang telah ditetapkan.
              Bagi guru dengan jadwal masuk tertentu (misalnya 5 hari dalam seminggu), hari kerja
              sekolah di luar hari masuk tersebut otomatis dihitung sebagai{' '}
              <strong className="text-[#0F766E]">HLT (Hari Libur Tertentu)</strong> dan tidak
              dihitung Alfa.
            </p>
          </div>
        </div>

        {typeof isTodayHlt === 'boolean' && (
          <span
            className={
              isTodayHlt
                ? 'inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-[#99F6E4] bg-[#F0FDFA] px-3 py-1 text-xs font-semibold text-[#0F766E]'
                : 'inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-[#E7D4A3] bg-[#FCF9F1] px-3 py-1 text-xs font-semibold text-[#8D6B22]'
            }
          >
            {isTodayHlt ? (
              <>
                <CalendarOff className="h-3.5 w-3.5" aria-hidden="true" />
                {todayLabel ? `${todayLabel}: HLT (Tidak Wajib Absen)` : 'Hari Ini HLT'}
              </>
            ) : (
              <>
                <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                {todayLabel ? `${todayLabel}: Hari Wajib Absen` : 'Hari Wajib Absen'}
              </>
            )}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 pt-1">
        <div className="rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-slate-500">Hari Wajib Absen Anda</p>
          <p className="mt-0.5 text-xs font-bold text-[#10264D]">
            {formatIndonesianDaysList(effectiveWorkDays)}{' '}
            <span className="font-normal text-slate-500">({effectiveWorkDays.length} hari/minggu)</span>
          </p>
        </div>

        <div className="rounded-lg border border-[#CCFBF1] bg-[#F0FDFA]/70 px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-[#0F766E]">Hari Libur Tertentu (HLT)</p>
          <p className="mt-0.5 text-xs font-bold text-[#115E59]">
            {normalizedHlt.length > 0
              ? formatIndonesianDaysList(normalizedHlt)
              : 'Tidak ada (masuk setiap hari aktif)'}
          </p>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3 text-[#8D6B22]" aria-hidden="true" />
            Jam Absensi Guru Aktif
          </p>
          <p className="mt-0.5 font-mono text-xs font-semibold text-[#10264D] tabular-nums">
            {teacherRule
              ? `Masuk ${teacherRule.checkInStart}–${teacherRule.checkInDeadline} · Pulang ${teacherRule.checkOutStart}–${teacherRule.checkOutDeadline}`
              : 'Mengikuti aturan jam guru aktif'}
          </p>
        </div>
      </div>
    </section>
  );
}

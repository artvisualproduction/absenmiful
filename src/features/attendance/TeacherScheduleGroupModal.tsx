import { useMemo, useState } from 'react';
import {
  CalendarCheck2,
  Check,
  Clock,
  Search,
  Users,
} from 'lucide-react';
import { Input } from '../../components/forms/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { cn } from '../../lib/cn';
import { INDONESIAN_DAY_NAMES } from '../../lib/date';
import {
  DEFAULT_TEACHER_WORKING_DAYS,
  formatIndonesianDaysList,
  normalizeWorkingDays,
} from '../../lib/teacherWorkingDays';
import { ApiClientError } from '../../services/apiClient';
import { masterDataService, type EnrichedTeacher } from '../../services/masterDataService';
import { scheduleRulesService } from '../../services/scheduleRulesService';
import { AttendanceAudience, type AttendanceRule } from '../../types';

export interface TeacherScheduleGroupModalProps {
  open: boolean;
  onClose: () => void;
  teachers: EnrichedTeacher[];
  activeTeacherRule: AttendanceRule | null;
  onApplied: () => Promise<void> | void;
}

const DAY_OPTIONS = [
  { value: 1, label: 'Senin', short: 'Sen' },
  { value: 2, label: 'Selasa', short: 'Sel' },
  { value: 3, label: 'Rabu', short: 'Rab' },
  { value: 4, label: 'Kamis', short: 'Kam' },
  { value: 5, label: 'Jumat', short: 'Jum' },
  { value: 6, label: 'Sabtu', short: 'Sab' },
  { value: 7, label: 'Minggu', short: 'Min' },
];

export function TeacherScheduleGroupModal({
  open,
  onClose,
  teachers,
  activeTeacherRule,
  onApplied,
}: TeacherScheduleGroupModalProps) {
  const { showToast } = useToast();

  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [updateHours, setUpdateHours] = useState(false);

  // Jam Absensi
  const [checkInStart, setCheckInStart] = useState(activeTeacherRule?.checkInStart ?? '06:00');
  const [lateAfter, setLateAfter] = useState(activeTeacherRule?.lateAfter ?? '07:00');
  const [lateToleranceMinutes, setLateToleranceMinutes] = useState(
    activeTeacherRule?.lateToleranceMinutes ?? 0,
  );
  const [checkInDeadline, setCheckInDeadline] = useState(
    activeTeacherRule?.checkInDeadline ?? '08:30',
  );
  const [checkOutStart, setCheckOutStart] = useState(
    activeTeacherRule?.checkOutStart ?? '14:00',
  );
  const [checkOutDeadline, setCheckOutDeadline] = useState(
    activeTeacherRule?.checkOutDeadline ?? '17:00',
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.status === 'ACTIVE'),
    [teachers],
  );

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeTeachers;
    return activeTeachers.filter(
      (t) =>
        t.fullName.toLowerCase().includes(q) ||
        t.niyNip.toLowerCase().includes(q) ||
        t.position.toLowerCase().includes(q),
    );
  }, [activeTeachers, search]);

  const hltDays = useMemo(() => {
    const workSet = new Set(selectedDays);
    return [1, 2, 3, 4, 5, 6, 7].filter((d) => !workSet.has(d) && d <= 6);
  }, [selectedDays]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      return normalizeWorkingDays(next);
    });
  };

  const toggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId],
    );
  };

  const selectAll = () => {
    setSelectedTeacherIds(filteredTeachers.map((t) => t.id));
  };

  const selectNonPrincipal = () => {
    setSelectedTeacherIds(
      filteredTeachers
        .filter((t) => !t.position.toLowerCase().includes('kepala'))
        .map((t) => t.id),
    );
  };

  const deselectAll = () => {
    setSelectedTeacherIds([]);
  };

  const handleSubmit = async () => {
    if (selectedDays.length === 0) {
      setError('Pilih minimal 1 hari masuk kerja.');
      return;
    }
    if (selectedTeacherIds.length === 0) {
      setError('Pilih minimal 1 guru untuk diterapkan.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Bulk update working days of selected teachers
      await masterDataService.bulkUpdateTeacherWorkingDays(selectedTeacherIds, selectedDays);

      // 2. If hours updated, save versioned teacher rule
      if (updateHours) {
        await scheduleRulesService.createAttendanceRuleVersion({
          name: `Aturan Jam Guru (${selectedDays.length} Hari)`,
          audience: AttendanceAudience.TEACHER,
          classIds: [],
          daysOfWeek: selectedDays,
          checkInStart,
          lateAfter,
          lateToleranceMinutes: Number(lateToleranceMinutes) || 0,
          checkInDeadline,
          checkOutStart,
          checkOutDeadline,
          gpsRequired: activeTeacherRule?.gpsRequired ?? true,
          geofenceRequired: activeTeacherRule?.geofenceRequired ?? true,
          effectiveFrom: new Date().toISOString().slice(0, 10),
          isActive: true,
        });
      }

      showToast({
        variant: 'success',
        title: 'Jadwal grup guru berhasil diterapkan',
        message: `Berhasil mengatur ${selectedDays.length} hari masuk kerja untuk ${selectedTeacherIds.length} guru.`,
      });

      await onApplied();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal menerapkan jadwal grup guru.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Atur Jadwal Grup Guru & Hari Libur (HLT)"
      description="Terapkan hari masuk wajib, hari libur (HLT), serta jam absensi masuk & pulang secara massal ke daftar guru terpilih tanpa perlu input satu per satu."
      size="xl"
    >
      <div className="space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#B91C1C]"
          >
            {error}
          </div>
        )}

        {/* BAGIAN 1: HARI MASUK WAJIB & HLT */}
        <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[#10264D] inline-flex items-center gap-1.5">
                <CalendarCheck2 className="h-4 w-4 text-[#C69B3C]" />
                <span>1. Tentukan Hari Masuk Wajib</span>
              </p>
              <p className="text-[11px] text-slate-500">
                Pilih hari di mana guru wajib hadir. Hari yang tidak dipilih otomatis menjadi HLT (Hari Libur Tertentu).
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                className="rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-[#10264D] cursor-pointer"
              >
                Senin–Jumat (5 Hari)
              </button>
              <button
                type="button"
                onClick={() => setSelectedDays([1, 2, 3, 4, 5, 6])}
                className="rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-[#10264D] cursor-pointer"
              >
                Senin–Sabtu (6 Hari)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {DAY_OPTIONS.map((d) => {
              const selected = selectedDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer',
                    selected
                      ? 'border-[#10264D] bg-[#10264D] text-white shadow-sm'
                      : 'border-[#CBD5E1] bg-white text-slate-600 hover:border-[#10264D]',
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
            <span className="font-semibold text-[#10264D]">
              Hari Masuk: <span className="text-[#8D6B22]">{formatIndonesianDaysList(selectedDays)}</span> ({selectedDays.length} Hari)
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-[#0F766E]">
              Hari Libur (HLT): {hltDays.length > 0 ? hltDays.map((d) => INDONESIAN_DAY_NAMES[d]).join(', ') : 'Tidak ada (Masuk Penuh)'}
            </span>
          </div>
        </section>

        {/* BAGIAN 2: JAM ABSENSI MASUK & PULANG GURU */}
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={updateHours}
                onChange={(e) => setUpdateHours(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#10264D] focus:ring-[#10264D]"
              />
              <span className="text-xs font-bold text-[#10264D] inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#C69B3C]" />
                <span>2. Sekaligus Perbarui Jam Masuk &amp; Pulang Guru</span>
              </span>
            </label>
            <span className="text-[11px] text-slate-500">
              {updateHours ? 'Aktif (Akan disimpan)' : 'Nonaktif (Hanya hari masuk)'}
            </span>
          </div>

          {updateHours && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-[#F1F5F9]">
              <Input
                label="Mulai Absen Masuk"
                type="time"
                value={checkInStart}
                onChange={(e) => setCheckInStart(e.target.value)}
                required
              />
              <Input
                label="Batas Jam Masuk (Terlambat Jika Lewat)"
                type="time"
                value={lateAfter}
                onChange={(e) => setLateAfter(e.target.value)}
                required
              />
              <Input
                label="Toleransi Terlambat (Menit)"
                type="number"
                min="0"
                max="60"
                value={String(lateToleranceMinutes)}
                onChange={(e) => setLateToleranceMinutes(Number(e.target.value) || 0)}
              />
              <Input
                label="Batas Akhir Masuk (Tutup)"
                type="time"
                value={checkInDeadline}
                onChange={(e) => setCheckInDeadline(e.target.value)}
                required
              />
              <Input
                label="Mulai Absen Pulang"
                type="time"
                value={checkOutStart}
                onChange={(e) => setCheckOutStart(e.target.value)}
                required
              />
              <Input
                label="Batas Akhir Pulang"
                type="time"
                value={checkOutDeadline}
                onChange={(e) => setCheckOutDeadline(e.target.value)}
                required
              />
            </div>
          )}
        </section>

        {/* BAGIAN 3: DAFTAR GURU PENERAPAN */}
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-[#10264D] inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#C69B3C]" />
                <span>3. Pilih Guru yang Diterapkan</span>
              </p>
              <p className="text-[11px] text-slate-500">
                Centang guru-guru yang akan menggunakan aturan jadwal di atas.
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] font-semibold text-[#10264D] hover:underline cursor-pointer"
              >
                Pilih Semua ({filteredTeachers.length})
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={selectNonPrincipal}
                className="text-[11px] font-semibold text-slate-600 hover:underline cursor-pointer"
              >
                Hanya Guru (Bukan Kepsek)
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Batal Pilih
              </button>
            </div>
          </div>

          <div className="w-full">
            <Input
              placeholder="Cari nama guru atau jabatan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftAddon={<Search className="h-3.5 w-3.5" />}
            />
          </div>

          {/* Teacher Selection List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-[#F1F5F9] rounded-lg border border-[#E2E8F0]">
            {filteredTeachers.map((t) => {
              const checked = selectedTeacherIds.includes(t.id);
              const currentDays = t.workingDays ?? DEFAULT_TEACHER_WORKING_DAYS;
              return (
                <label
                  key={t.id}
                  className={cn(
                    'flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors cursor-pointer select-none text-xs',
                    checked ? 'bg-[#FCF9F1]/80 hover:bg-[#FCF9F1]' : 'hover:bg-[#F8FAFC]',
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTeacher(t.id)}
                      className="h-4 w-4 rounded border-slate-300 text-[#10264D] focus:ring-[#10264D]"
                    />
                    <div className="truncate">
                      <p className="font-semibold text-[#10264D] truncate">{t.fullName}</p>
                      <p className="font-mono text-[11px] text-slate-500 truncate">
                        {t.niyNip} · {t.position}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      Saat ini: {currentDays.length} hari
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
          <span className="text-xs font-semibold text-[#10264D]">
            {selectedTeacherIds.length} dari {activeTeachers.length} guru terpilih
          </span>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button
              variant="primary"
              disabled={selectedTeacherIds.length === 0 || saving}
              loading={saving}
              onClick={() => void handleSubmit()}
              leftIcon={<Check className="h-4 w-4" />}
            >
              Terapkan ke {selectedTeacherIds.length} Guru
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

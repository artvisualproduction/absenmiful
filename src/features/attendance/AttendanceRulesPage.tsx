import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Archive,
  CalendarCheck2,
  CalendarOff,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
  Users,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cn } from '../../lib/cn';
import { formatDateShortJakarta, getDateKeyJakarta } from '../../lib/date';
import {
  attendanceRuleCreateSchema,
  DAY_OF_WEEK_OPTIONS,
  holidayCreateSchema,
} from '../../lib/scheduleRulesValidation';
import {
  formatIndonesianDaysList,
  getSchoolTeacherActiveDays,
  resolveTeacherHltDays,
  resolveTeacherWorkingDays,
} from '../../lib/teacherWorkingDays';
import { ApiClientError } from '../../services/apiClient';
import {
  masterDataService,
  type EnrichedClass,
  type EnrichedTeacher,
} from '../../services/masterDataService';
import { scheduleRulesService } from '../../services/scheduleRulesService';
import {
  AttendanceAudience,
  HolidayScope,
  TeacherStatus,
  UserRole,
  type AttendanceRule,
  type Holiday,
} from '../../types';
import { TeacherScheduleGroupModal } from './TeacherScheduleGroupModal';
import { HolidayImportModal } from './HolidayImportModal';

const HOLIDAY_SCOPE_LABELS: Record<HolidayScope, string> = {
  [HolidayScope.SCHOOL]: 'Seluruh Sekolah',
  [HolidayScope.STUDENT]: 'Khusus Siswa',
  [HolidayScope.TEACHER]: 'Khusus Guru',
};

function formatDaysList(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join(',') === '1,2,3,4,5,6') return 'Senin – Sabtu';
  if (sorted.join(',') === '1,2,3,4,5') return 'Senin – Jumat';
  return sorted
    .map((d) => DAY_OF_WEEK_OPTIONS.find((opt) => opt.value === d)?.short ?? String(d))
    .join(', ');
}

function resolveEffectiveRuleForClass(
  classId: string,
  activeStudentRules: AttendanceRule[],
): AttendanceRule | null {
  const compareNewest = (a: AttendanceRule, b: AttendanceRule): number => {
    const timeCmp = (b.updatedAt ?? b.createdAt ?? '').localeCompare(
      a.updatedAt ?? a.createdAt ?? '',
    );
    if (timeCmp !== 0) return timeCmp;
    return (b.version ?? 1) - (a.version ?? 1);
  };

  const specific = activeStudentRules
    .filter((r) => r.classIds.includes(classId))
    .sort((a, b) => {
      if (a.classIds.length !== b.classIds.length) {
        return a.classIds.length - b.classIds.length;
      }
      return compareNewest(a, b);
    });
  if (specific.length > 0) return specific[0];

  const fallback = activeStudentRules
    .filter((r) => r.classIds.length === 0)
    .sort(compareNewest);
  return fallback[0] ?? null;
}

export function AttendanceRulesPage() {
  useDocumentTitle('Aturan Jam Absensi & Hari Libur');
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = user ? user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER : false;

  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'holidays'>('students');
  const [classes, setClasses] = useState<EnrichedClass[]>([]);
  const [teachers, setTeachers] = useState<EnrichedTeacher[]>([]);
  const [teacherDaysDraft, setTeacherDaysDraft] = useState<Record<string, number[]>>({});
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showIndividualTeachers, setShowIndividualTeachers] = useState(false);
  const [savingTeacherId, setSavingTeacherId] = useState<string | null>(null);
  const [allRules, setAllRules] = useState<AttendanceRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Rule Editor Modal
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleAudience, setRuleAudience] = useState<AttendanceAudience>(AttendanceAudience.STUDENT);
  const [ruleClassIds, setRuleClassIds] = useState<string[]>([]);
  const [applyToAllClasses, setApplyToAllClasses] = useState(false);
  const [ruleDays, setRuleDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [checkInStart, setCheckInStart] = useState('06:00');
  const [lateAfter, setLateAfter] = useState('07:00');
  const [lateToleranceMinutes, setLateToleranceMinutes] = useState('0');
  const [checkInDeadline, setCheckInDeadline] = useState('07:30');
  const [checkOutStart, setCheckOutStart] = useState('12:00');
  const [checkOutDeadline, setCheckOutDeadline] = useState('14:30');
  const [gpsRequired, setGpsRequired] = useState(true);
  const [geofenceRequired, setGeofenceRequired] = useState(false);
  const [effectiveFromDate, setEffectiveFromDate] = useState(getDateKeyJakarta());
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  // Holidays State
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [holidaysError, setHolidaysError] = useState<string | null>(null);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [teacherGroupModalOpen, setTeacherGroupModalOpen] = useState(false);
  const [holidayImportModalOpen, setHolidayImportModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [holidayDate, setHolidayDate] = useState(getDateKeyJakarta());
  const [holidayName, setHolidayName] = useState('');
  const [holidayScope, setHolidayScope] = useState<HolidayScope>(HolidayScope.SCHOOL);
  const [holidayActive, setHolidayActive] = useState(true);
  const [holidayFormError, setHolidayFormError] = useState<string | null>(null);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [archivingHoliday, setArchivingHoliday] = useState<Holiday | null>(null);
  const [archivingBusy, setArchivingBusy] = useState(false);

  const loadRulesAndClasses = async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const [classesRes, rulesRes, teachersRes] = await Promise.all([
        masterDataService.listClasses({ isActive: 'true' }),
        scheduleRulesService.listAttendanceRules(),
        masterDataService.listTeachers({ status: TeacherStatus.ACTIVE, limit: 500 }),
      ]);
      setClasses(classesRes.items);
      setAllRules(rulesRes.items);

      const resolvedTeacherRule =
        rulesRes.items
          .filter((r) => r.audience === AttendanceAudience.TEACHER && r.isActive)
          .sort((a, b) => {
            const timeCmp = (b.updatedAt ?? b.createdAt ?? '').localeCompare(
              a.updatedAt ?? a.createdAt ?? '',
            );
            if (timeCmp !== 0) return timeCmp;
            return (b.version ?? 1) - (a.version ?? 1);
          })[0] ?? null;

      const sortedTeachers = [...teachersRes.items].sort((a, b) => {
        const aHead = a.position.toLowerCase().includes('kepala') ? 0 : 1;
        const bHead = b.position.toLowerCase().includes('kepala') ? 0 : 1;
        if (aHead !== bHead) return aHead - bHead;
        return a.fullName.localeCompare(b.fullName, 'id');
      });
      setTeachers(sortedTeachers);

      const nextDraft: Record<string, number[]> = {};
      for (const t of sortedTeachers) {
        nextDraft[t.id] = resolveTeacherWorkingDays(t, resolvedTeacherRule);
      }
      setTeacherDaysDraft(nextDraft);
    } catch (err) {
      setRulesError(err instanceof ApiClientError ? err.message : 'Gagal memuat aturan absensi.');
    } finally {
      setRulesLoading(false);
    }
  };

  const loadHolidays = async () => {
    setHolidaysLoading(true);
    setHolidaysError(null);
    try {
      const res = await scheduleRulesService.listHolidays();
      setHolidays(res.items);
    } catch (err) {
      setHolidaysError(err instanceof ApiClientError ? err.message : 'Gagal memuat hari libur.');
    } finally {
      setHolidaysLoading(false);
    }
  };

  useEffect(() => {
    void loadRulesAndClasses();
    void loadHolidays();
  }, []);

  const classNameMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  const activeStudentRules = useMemo(
    () => allRules.filter((r) => r.audience === AttendanceAudience.STUDENT && r.isActive),
    [allRules],
  );
  const studentRulesAll = useMemo(
    () => allRules.filter((r) => r.audience === AttendanceAudience.STUDENT),
    [allRules],
  );
  const activeTeacherRule = useMemo(
    () =>
      allRules
        .filter((r) => r.audience === AttendanceAudience.TEACHER && r.isActive)
        .sort((a, b) => {
          const timeCmp = (b.updatedAt ?? b.createdAt ?? '').localeCompare(
            a.updatedAt ?? a.createdAt ?? '',
          );
          if (timeCmp !== 0) return timeCmp;
          return (b.version ?? 1) - (a.version ?? 1);
        })[0] ?? null,
    [allRules],
  );
  const teacherRulesAll = useMemo(
    () => allRules.filter((r) => r.audience === AttendanceAudience.TEACHER),
    [allRules],
  );
  const schoolActiveTeacherDays = useMemo(
    () => getSchoolTeacherActiveDays(activeTeacherRule),
    [activeTeacherRule],
  );
  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.fullName.toLowerCase().includes(q) ||
        t.niyNip.toLowerCase().includes(q) ||
        t.position.toLowerCase().includes(q),
    );
  }, [teachers, teacherSearch]);

  const teacherScheduleSummary = useMemo(() => {
    let fullCount = 0;
    let hltCount = 0;
    const schoolDaysCount = schoolActiveTeacherDays.length;

    for (const t of teachers) {
      const days = teacherDaysDraft[t.id] ?? resolveTeacherWorkingDays(t, activeTeacherRule);
      if (days.length >= schoolDaysCount) {
        fullCount++;
      } else {
        hltCount++;
      }
    }

    return {
      total: teachers.length,
      fullCount,
      hltCount,
    };
  }, [teachers, teacherDaysDraft, activeTeacherRule, schoolActiveTeacherDays]);

  const toggleTeacherWorkDay = (teacherId: string, dayVal: number) => {
    setTeacherDaysDraft((prev) => {
      const current = prev[teacherId] ?? schoolActiveTeacherDays;
      const exists = current.includes(dayVal);
      if (exists && current.length <= 1) {
        showToast({
          variant: 'warning',
          title: 'Minimal 1 hari masuk',
          message: 'Setiap guru harus memiliki minimal 1 hari wajib masuk dalam seminggu.',
        });
        return prev;
      }
      const next = exists
        ? current.filter((d) => d !== dayVal)
        : [...current, dayVal].sort((a, b) => a - b);
      return { ...prev, [teacherId]: next };
    });
  };

  const applyTeacherPreset = (teacherId: string, days: number[]) => {
    setTeacherDaysDraft((prev) => ({ ...prev, [teacherId]: [...days] }));
  };

  const handleSaveTeacherWorkingDays = async (teacher: EnrichedTeacher) => {
    const days = teacherDaysDraft[teacher.id] ?? resolveTeacherWorkingDays(teacher, activeTeacherRule);
    if (days.length === 0) {
      showToast({
        variant: 'warning',
        title: 'Pilih minimal 1 hari masuk',
      });
      return;
    }
    setSavingTeacherId(teacher.id);
    try {
      await masterDataService.updateTeacher(teacher.id, { workingDays: days });
      setTeachers((prev) =>
        prev.map((item) => (item.id === teacher.id ? { ...item, workingDays: days } : item)),
      );
      const hlt = resolveTeacherHltDays(days, activeTeacherRule);
      showToast({
        variant: 'success',
        title: `Hari masuk ${teacher.fullName} disimpan`,
        message:
          hlt.length > 0
            ? `Wajib absen ${days.length} hari (${formatIndonesianDaysList(days)}). HLT: ${formatIndonesianDaysList(hlt)}.`
            : `Wajib absen ${days.length} hari (${formatIndonesianDaysList(days)}).`,
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menyimpan hari masuk guru',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan saat menyimpan.',
      });
    } finally {
      setSavingTeacherId(null);
    }
  };

  // Open modal pre-configured for a specific class (or multiple classes) or Teacher
  const openEditForClass = (cls: EnrichedClass, effectiveRule: AttendanceRule | null) => {
    setRuleAudience(AttendanceAudience.STUDENT);
    setRuleClassIds([cls.id]);
    setApplyToAllClasses(false);
    setRuleName(`Jam Absensi Kelas ${cls.name}`);
    setRuleDays(effectiveRule?.daysOfWeek?.length ? effectiveRule.daysOfWeek : [1, 2, 3, 4, 5, 6]);
    setCheckInStart(effectiveRule?.checkInStart ?? '06:00');
    setLateAfter(effectiveRule?.lateAfter ?? '07:00');
    setLateToleranceMinutes(String(effectiveRule?.lateToleranceMinutes ?? 0));
    setCheckInDeadline(effectiveRule?.checkInDeadline ?? '07:30');
    setCheckOutStart(effectiveRule?.checkOutStart ?? '12:00');
    setCheckOutDeadline(effectiveRule?.checkOutDeadline ?? '14:30');
    setGpsRequired(effectiveRule?.gpsRequired ?? true);
    setGeofenceRequired(effectiveRule?.geofenceRequired ?? false);
    setEffectiveFromDate(getDateKeyJakarta());
    setRuleFormError(null);
    setRuleModalOpen(true);
  };

  const openEditRuleGroup = (baseRule: AttendanceRule | null, audience: AttendanceAudience) => {
    setRuleAudience(audience);
    const initialClassIds = audience === AttendanceAudience.STUDENT ? baseRule?.classIds ?? [] : [];
    setRuleClassIds(initialClassIds);
    setApplyToAllClasses(
      audience === AttendanceAudience.STUDENT && Boolean(baseRule && baseRule.classIds.length === 0),
    );
    setRuleName(
      baseRule?.name ??
        (audience === AttendanceAudience.STUDENT
          ? 'Jam Absensi Grup Kelas'
          : 'Jam Absensi Guru & Tenaga Pendidik'),
    );
    setRuleDays(baseRule?.daysOfWeek?.length ? baseRule.daysOfWeek : [1, 2, 3, 4, 5, 6]);
    setCheckInStart(baseRule?.checkInStart ?? '06:00');
    setLateAfter(baseRule?.lateAfter ?? '07:00');
    setLateToleranceMinutes(
      String(baseRule?.lateToleranceMinutes ?? (audience === AttendanceAudience.TEACHER ? 5 : 0)),
    );
    setCheckInDeadline(baseRule?.checkInDeadline ?? '07:30');
    setCheckOutStart(
      baseRule?.checkOutStart ?? (audience === AttendanceAudience.TEACHER ? '13:30' : '12:00'),
    );
    setCheckOutDeadline(
      baseRule?.checkOutDeadline ?? (audience === AttendanceAudience.TEACHER ? '16:30' : '14:30'),
    );
    setGpsRequired(baseRule?.gpsRequired ?? true);
    setGeofenceRequired(
      baseRule?.geofenceRequired ?? (audience === AttendanceAudience.TEACHER ? true : false),
    );
    setEffectiveFromDate(getDateKeyJakarta());
    setRuleFormError(null);
    setRuleModalOpen(true);
  };

  const toggleRuleDay = (dayVal: number) => {
    setRuleDays((prev) =>
      prev.includes(dayVal) ? prev.filter((d) => d !== dayVal) : [...prev, dayVal].sort((a, b) => a - b),
    );
  };

  const toggleRuleClass = (clsId: string) => {
    setApplyToAllClasses(false);
    setRuleClassIds((prev) =>
      prev.includes(clsId) ? prev.filter((id) => id !== clsId) : [...prev, clsId],
    );
  };

  const handleSubmitRule = async (e: FormEvent) => {
    e.preventDefault();
    setRuleFormError(null);

    if (
      ruleAudience === AttendanceAudience.STUDENT &&
      !applyToAllClasses &&
      ruleClassIds.length === 0
    ) {
      setRuleFormError(
        'Pilih minimal 1 kelas terlebih dahulu, atau klik "Semua Kelas (Ganti Semua)" jika ingin menyeragamkan jam seluruh kelas.',
      );
      return;
    }

    const parsed = attendanceRuleCreateSchema.safeParse({
      name: ruleName,
      audience: ruleAudience,
      classIds:
        ruleAudience === AttendanceAudience.STUDENT
          ? applyToAllClasses
            ? []
            : ruleClassIds
          : [],
      daysOfWeek: ruleDays,
      checkInStart,
      lateAfter,
      lateToleranceMinutes: Number(lateToleranceMinutes) || 0,
      checkInDeadline,
      checkOutStart,
      checkOutDeadline,
      gpsRequired,
      geofenceRequired,
      effectiveFrom: `${effectiveFromDate}T00:00:00+07:00`,
      isActive: true,
    });

    if (!parsed.success) {
      setRuleFormError(parsed.error.issues[0]?.message ?? 'Konfigurasi aturan tidak valid.');
      return;
    }

    setSavingRule(true);
    try {
      await scheduleRulesService.createAttendanceRuleVersion(parsed.data);
      showToast({
        variant: 'success',
        title: 'Aturan jam absensi disimpan',
        message: 'Jam absensi terbaru langsung aktif pada Portal Absensi & Dashboard.',
      });
      setRuleModalOpen(false);
      await loadRulesAndClasses();
    } catch (err) {
      setRuleFormError(
        err instanceof ApiClientError ? err.message : 'Gagal menyimpan aturan jam absensi.',
      );
    } finally {
      setSavingRule(false);
    }
  };

  // Holiday handlers
  const openCreateHoliday = () => {
    setEditingHoliday(null);
    setHolidayDate(getDateKeyJakarta());
    setHolidayName('');
    setHolidayScope(HolidayScope.SCHOOL);
    setHolidayActive(true);
    setHolidayFormError(null);
    setHolidayModalOpen(true);
  };

  const openEditHoliday = (row: Holiday) => {
    setEditingHoliday(row);
    setHolidayDate(row.date);
    setHolidayName(row.name);
    setHolidayScope(row.scope);
    setHolidayActive(row.isActive);
    setHolidayFormError(null);
    setHolidayModalOpen(true);
  };

  const handleSubmitHoliday = async (e: FormEvent) => {
    e.preventDefault();
    setHolidayFormError(null);

    const parsed = holidayCreateSchema.safeParse({
      date: holidayDate,
      name: holidayName,
      scope: holidayScope,
      isActive: holidayActive,
    });

    if (!parsed.success) {
      setHolidayFormError(parsed.error.issues[0]?.message ?? 'Data hari libur tidak valid.');
      return;
    }

    setSavingHoliday(true);
    try {
      if (editingHoliday) {
        await scheduleRulesService.updateHoliday(editingHoliday.id, parsed.data);
        showToast({ variant: 'success', title: 'Hari libur diperbarui' });
      } else {
        await scheduleRulesService.createHoliday(parsed.data);
        showToast({ variant: 'success', title: 'Hari libur ditambahkan' });
      }
      setHolidayModalOpen(false);
      await loadHolidays();
    } catch (err) {
      setHolidayFormError(
        err instanceof ApiClientError ? err.message : 'Gagal menyimpan hari libur.',
      );
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleConfirmArchiveHoliday = async () => {
    if (!archivingHoliday) return;
    setArchivingBusy(true);
    try {
      await scheduleRulesService.archiveHoliday(archivingHoliday.id);
      showToast({ variant: 'success', title: 'Hari libur dinonaktifkan' });
      setArchivingHoliday(null);
      await loadHolidays();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menonaktifkan hari libur',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setArchivingBusy(false);
    }
  };

  const holidayColumns: Array<TableColumn<Holiday>> = [
    {
      key: 'date',
      header: 'Tanggal',
      render: (row) => (
        <div>
          <p className="font-mono text-xs font-semibold text-[#10264D] tabular-nums">{row.date}</p>
          <p className="text-xs text-slate-500">
            {formatDateShortJakarta(`${row.date}T00:00:00+07:00`)}
          </p>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Keterangan Hari Libur',
      render: (row) => <span className="font-semibold text-[#10264D]">{row.name}</span>,
    },
    {
      key: 'scope',
      header: 'Cakupan',
      render: (row) => (
        <StatusBadge
          label={HOLIDAY_SCOPE_LABELS[row.scope]}
          tone={row.scope === HolidayScope.SCHOOL ? 'gold' : 'info'}
          showIcon={false}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.isActive ? (
          <StatusBadge label="Aktif" tone="success" />
        ) : (
          <StatusBadge label="Nonaktif" tone="neutral" />
        ),
    },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: 'Aksi',
            align: 'right' as const,
            render: (row: Holiday) => (
              <div className="inline-flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  title="Ubah Hari Libur"
                  aria-label={`Ubah ${row.name}`}
                  onClick={() => openEditHoliday(row)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {row.isActive && (
                  <button
                    type="button"
                    title="Nonaktifkan Hari Libur"
                    aria-label={`Nonaktifkan ${row.name}`}
                    onClick={() => setArchivingHoliday(row)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#FECACA] bg-white text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                  >
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <AppShell
      title="Aturan Jam Absensi & Hari Libur"
      subtitle="Atur jam masuk & pulang berbeda untuk setiap kelas siswa, jadwal khusus guru, serta kalender libur."
      actions={
        canEdit ? (
          <div className="flex flex-wrap items-center gap-2 [&>button]:whitespace-nowrap [&>button]:shrink-0">
            {activeTab === 'holidays' ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHolidayImportModalOpen(true)}
                  leftIcon={<Upload className="h-4 w-4" />}
                >
                  Impor Excel Hari Libur
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={openCreateHoliday}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Tambah Hari Libur
                </Button>
              </>
            ) : activeTab === 'teachers' ? (
              <>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={() => setTeacherGroupModalOpen(true)}
                  leftIcon={<CalendarCheck2 className="h-4 w-4" />}
                >
                  Atur Jadwal Grup Guru
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditRuleGroup(activeTeacherRule, AttendanceAudience.TEACHER)}
                  leftIcon={<SlidersHorizontal className="h-4 w-4" />}
                >
                  Ubah Jam Guru
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => openEditRuleGroup(null, AttendanceAudience.STUDENT)}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Atur Jam Grup Kelas
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Intuitive 3-Tab Switcher */}
        <div
          role="tablist"
          aria-label="Kategori aturan jam absensi"
          className="inline-flex flex-wrap rounded-xl border border-[#E2E8F0] bg-white p-1 gap-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'students'}
            onClick={() => setActiveTab('students')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap',
              activeTab === 'students'
                ? 'bg-[#10264D] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#10264D] hover:bg-[#F8FAFC]',
            )}
          >
            <GraduationCap className="h-4 w-4" />
            Jam Siswa (Per Kelas)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'teachers'}
            onClick={() => setActiveTab('teachers')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap',
              activeTab === 'teachers'
                ? 'bg-[#10264D] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#10264D] hover:bg-[#F8FAFC]',
            )}
          >
            <Users className="h-4 w-4" />
            Jam Guru
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'holidays'}
            onClick={() => setActiveTab('holidays')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap',
              activeTab === 'holidays'
                ? 'bg-[#10264D] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#10264D] hover:bg-[#F8FAFC]',
            )}
          >
            <CalendarOff className="h-4 w-4" />
            Hari Libur ({holidays.filter((h) => h.isActive).length})
          </button>
        </div>

        {/* TAB 1: JAM SISWA PER KELAS */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            {rulesError && (
              <div
                role="alert"
                className="flex items-center gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{rulesError}</span>
              </div>
            )}

            {rulesLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner label="Memuat jadwal absensi per kelas..." />
              </div>
            ) : (
              <>
                {/* Visual Per-Class Cards Grid */}
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-[#10264D]">
                        Jadwal Masuk &amp; Pulang Aktif Per Kelas
                      </h2>
                      <p className="text-xs text-slate-500">
                        Setiap kelas dapat memiliki jam masuk dan jam pulang berbeda. Klik{' '}
                        <strong>Atur Jam</strong> pada kelas mana saja untuk mengubah jam khusus
                        kelas tersebut.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {classes.map((cls) => {
                      const effective = resolveEffectiveRuleForClass(cls.id, activeStudentRules);
                      const isDedicated = Boolean(
                        effective &&
                          effective.classIds.length === 1 &&
                          effective.classIds[0] === cls.id,
                      );
                      return (
                        <div
                          key={cls.id}
                          className="rounded-2xl border border-[#E2E8F0] bg-white p-4 flex flex-col justify-between gap-3.5 hover:border-[#CBD5E1] hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-base font-bold text-[#10264D]">
                                Kelas {cls.name}
                              </h3>
                              <p className="text-[11px] text-slate-500 truncate max-w-[165px]">
                                {effective?.name ?? 'Belum ada aturan'}
                              </p>
                            </div>
                            <StatusBadge
                              label={isDedicated ? 'Khusus' : 'Grup'}
                              tone={isDedicated ? 'gold' : 'info'}
                              showIcon={false}
                            />
                          </div>

                          {effective ? (
                            <div className="space-y-2 text-xs border-t border-b border-[#F1F5F9] py-3">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Jam Masuk</span>
                                <span className="font-mono font-semibold text-[#15803D] tabular-nums">
                                  {effective.checkInStart} – {effective.checkInDeadline}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Batas Terlambat</span>
                                <span className="font-mono font-semibold text-[#B45309] tabular-nums">
                                  &gt; {effective.lateAfter}
                                  {(effective.lateToleranceMinutes ?? 0) > 0
                                    ? ` (+${effective.lateToleranceMinutes}m)`
                                    : ''}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Jam Pulang</span>
                                <span className="font-mono font-bold text-[#10264D] tabular-nums">
                                  {effective.checkOutStart} – {effective.checkOutDeadline}
                                </span>
                              </div>
                              <div className="flex items-center justify-between pt-0.5">
                                <span className="text-slate-500">Hari Aktif</span>
                                <span className="font-medium text-slate-700">
                                  {formatDaysList(effective.daysOfWeek)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 py-3">
                              Belum dikonfigurasi.
                            </p>
                          )}

                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              fullWidth
                              onClick={() => openEditForClass(cls, effective)}
                              leftIcon={<Pencil className="h-3.5 w-3.5" />}
                            >
                              Atur Jam Kelas {cls.name}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Active Rule Groups Summary */}
                <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#10264D]">
                        Daftar Paket Aturan Siswa ({activeStudentRules.length} Aktif)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Aturan khusus 1 kelas otomatis diprioritaskan di atas aturan grup kelas atau
                        aturan umum.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowHistory((v) => !v)}
                    >
                      {showHistory ? 'Sembunyikan Riwayat' : 'Lihat Riwayat Versi'}
                    </Button>
                  </div>

                  <div className="divide-y divide-[#F1F5F9]">
                    {(showHistory ? studentRulesAll : activeStudentRules).map((r) => (
                      <div
                        key={r.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-[#10264D]">{r.name}</span>
                            <span className="font-mono text-[11px] text-slate-500">v{r.version ?? 1}</span>
                            <StatusBadge
                              label={r.isActive ? 'Aktif' : 'Riwayat'}
                              tone={r.isActive ? 'success' : 'neutral'}
                              showIcon={false}
                            />
                          </div>
                          <p className="text-xs text-slate-600">
                            Cakupan:{' '}
                            <strong>
                              {r.classIds.length === 0
                                ? 'Semua Kelas (Cadangan)'
                                : r.classIds
                                    .map((id) => `Kelas ${classNameMap.get(id) ?? id}`)
                                    .join(', ')}
                            </strong>{' '}
                            · {formatDaysList(r.daysOfWeek)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="text-left sm:text-right font-mono text-xs tabular-nums">
                            <p className="text-[#15803D] font-semibold">
                              Masuk {r.checkInStart}–{r.checkInDeadline} (Telat &gt; {r.lateAfter})
                            </p>
                            <p className="text-[#10264D] font-bold">
                              Pulang {r.checkOutStart}–{r.checkOutDeadline}
                            </p>
                          </div>
                          {canEdit && r.isActive && (
                            <button
                              type="button"
                              title={`Ubah ${r.name}`}
                              aria-label={`Ubah ${r.name}`}
                              onClick={() => openEditRuleGroup(r, AttendanceAudience.STUDENT)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {/* TAB 2: JAM GURU (TERPISAH & BERBEDA JAM PULANG) */}
        {activeTab === 'teachers' && (
          <div className="space-y-5">
            {rulesLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner label="Memuat jadwal absensi guru..." />
              </div>
            ) : (
              <>
                <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F1F5F9] pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[#10264D]">
                          {activeTeacherRule?.name ?? 'Aturan Jam Absensi Guru'}
                        </h2>
                        <StatusBadge label="Aktif" tone="success" />
                      </div>
                      <p className="text-xs text-slate-500">
                        Jam absensi guru berdiri sendiri dan terpisah dari jam pulang siswa,
                        berlaku untuk Portal QR+Selfie maupun Absensi Mandiri Guru.
                      </p>
                    </div>
                    {canEdit && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          openEditRuleGroup(activeTeacherRule, AttendanceAudience.TEACHER)
                        }
                        leftIcon={<Pencil className="h-3.5 w-3.5" />}
                      >
                        Ubah Jam Masuk &amp; Pulang Guru
                      </Button>
                    )}
                  </div>

                  {activeTeacherRule ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 space-y-1">
                        <p className="text-xs font-medium text-[#15803D]">Jendela Masuk</p>
                        <p className="font-mono text-xl font-bold text-[#10264D] tabular-nums">
                          {activeTeacherRule.checkInStart} – {activeTeacherRule.checkInDeadline}
                        </p>
                        <p className="text-[11px] text-slate-600">Rentang jam masuk aktif</p>
                      </div>

                      <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 space-y-1">
                        <p className="text-xs font-medium text-[#B45309]">Batas Terlambat</p>
                        <p className="font-mono text-xl font-bold text-[#10264D] tabular-nums">
                          &gt; {activeTeacherRule.lateAfter}
                        </p>
                        <p className="text-[11px] text-slate-600">
                          Toleransi {activeTeacherRule.lateToleranceMinutes ?? 0} menit
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#CBD5E1] bg-[#EEF3FA] p-4 space-y-1">
                        <p className="text-xs font-medium text-[#10264D]">Jendela Pulang Guru</p>
                        <p className="font-mono text-xl font-bold text-[#10264D] tabular-nums">
                          {activeTeacherRule.checkOutStart} – {activeTeacherRule.checkOutDeadline}
                        </p>
                        <p className="text-[11px] text-slate-600">
                          Berbeda dari jam pulang siswa
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-1">
                        <p className="text-xs font-medium text-slate-600">Hari Kerja &amp; Lokasi</p>
                        <p className="text-sm font-bold text-[#10264D]">
                          {formatDaysList(activeTeacherRule.daysOfWeek)}
                        </p>
                        <p className="text-[11px] text-slate-600">
                          {activeTeacherRule.gpsRequired ? 'GPS Wajib' : 'GPS Opsional'} ·{' '}
                          {activeTeacherRule.geofenceRequired ? 'Radius Sekolah Wajib' : 'Tanpa Radius'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Belum ada aturan jam guru aktif.</p>
                  )}
                </section>

                {/* Pengaturan Hari Masuk Wajib Guru (Diringkas) */}
                <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#F1F5F9] pb-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CalendarCheck2 className="h-5 w-5 text-[#10264D]" />
                        <h2 className="text-base font-bold text-[#10264D]">
                          Hari Masuk Wajib Guru &amp; Ketentuan HLT
                        </h2>
                        <span className="inline-flex items-center rounded-md border border-[#99F6E4] bg-[#F0FDFA] px-2 py-0.5 text-[11px] font-semibold text-[#0F766E]">
                          HLT = Hari Libur Tertentu
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                        Kelola hari wajib masuk absensi dan hari libur tertentu (HLT) untuk guru. Guru yang libur pada hari aktif sekolah tidak terhitung Alfa pada rekap kehadiran.
                      </p>
                    </div>

                    {canEdit && (
                      <Button
                        variant="gold"
                        size="md"
                        onClick={() => setTeacherGroupModalOpen(true)}
                        leftIcon={<CalendarCheck2 className="h-4 w-4" />}
                        className="shrink-0 font-semibold shadow-sm"
                      >
                        Atur Jadwal Grup Guru
                      </Button>
                    )}
                  </div>

                  {/* Ringkasan Status Jadwal Guru */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">Total Guru Aktif</span>
                        <Users className="h-4 w-4 text-[#10264D]" />
                      </div>
                      <p className="text-xl font-bold text-[#10264D]">
                        {teacherScheduleSummary.total}{' '}
                        <span className="text-xs font-normal text-slate-500">orang</span>
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">
                          Jadwal Penuh ({schoolActiveTeacherDays.length} Hari)
                        </span>
                        <Check className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="text-xl font-bold text-emerald-700">
                        {teacherScheduleSummary.fullCount}{' '}
                        <span className="text-xs font-normal text-slate-500">orang</span>
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#99F6E4] bg-[#F0FDFA] p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#0F766E]">
                          Dengan Hari Libur Tertentu (HLT)
                        </span>
                        <span className="text-[10px] font-bold uppercase rounded bg-[#CCFBF1] text-[#0F766E] px-1.5 py-0.5">
                          HLT
                        </span>
                      </div>
                      <p className="text-xl font-bold text-[#0F766E]">
                        {teacherScheduleSummary.hltCount}{' '}
                        <span className="text-xs font-normal text-teal-600">orang</span>
                      </p>
                    </div>
                  </div>

                  {/* Accordion / Toggle Rincian Perorangan Guru */}
                  <div className="border-t border-[#F1F5F9] pt-2 space-y-4">
                    <button
                      type="button"
                      onClick={() => setShowIndividualTeachers((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-left transition hover:bg-[#F1F5F9] cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-white p-1.5 shadow-xs border border-[#E2E8F0]">
                          <Users className="h-4 w-4 text-[#10264D]" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#10264D]">
                            Rincian &amp; Penyesuaian Perorangan Guru
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {showIndividualTeachers
                              ? 'Klik untuk menyembunyikan daftar guru perorangan'
                              : 'Sudah ada fitur grup. Buka ini hanya jika ingin melihat atau menyesuaikan jadwal guru satu per satu.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#10264D] shrink-0">
                        <span>{showIndividualTeachers ? 'Sembunyikan' : 'Buka Rincian'}</span>
                        {showIndividualTeachers ? (
                          <ChevronUp className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        )}
                      </div>
                    </button>

                    {showIndividualTeachers && (
                      <div className="space-y-4 pt-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-slate-600">
                            Menampilkan <strong>{filteredTeachers.length}</strong> guru aktif:
                          </p>
                          <div className="w-full sm:w-64">
                            <Input
                              aria-label="Cari guru"
                              placeholder="Cari nama / NIP / jabatan..."
                              value={teacherSearch}
                              onChange={(e) => setTeacherSearch(e.target.value)}
                              leftAddon={<Search className="h-3.5 w-3.5" />}
                            />
                          </div>
                        </div>

                        {filteredTeachers.length === 0 ? (
                          <p className="py-6 text-center text-xs text-slate-500">
                            Tidak ada data guru aktif yang sesuai pencarian.
                          </p>
                        ) : (
                          <div className="divide-y divide-[#F1F5F9]">
                            {filteredTeachers.map((teacher) => {
                              const savedDays = resolveTeacherWorkingDays(teacher, activeTeacherRule);
                              const draftDays = teacherDaysDraft[teacher.id] ?? savedDays;
                              const hltDays = resolveTeacherHltDays(draftDays, activeTeacherRule);
                              const isDirty = draftDays.join(',') !== savedDays.join(',');
                              const isSavingThis = savingTeacherId === teacher.id;

                              return (
                                <div
                                  key={teacher.id}
                                  className="py-4 first:pt-0 last:pb-0 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                                >
                                  <div className="space-y-1 min-w-0 lg:w-64 shrink-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-sm text-[#10264D] truncate">
                                        {teacher.fullName}
                                      </p>
                                    </div>
                                    <p className="font-mono text-[11px] text-slate-500">
                                      {teacher.niyNip} · {teacher.position}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                                      <span className="font-semibold text-[#10264D]">
                                        Masuk: {draftDays.length} hari
                                      </span>
                                      <span className="text-slate-300">·</span>
                                      {hltDays.length > 0 ? (
                                        <span className="font-semibold text-[#0F766E]">
                                          HLT: {formatIndonesianDaysList(hltDays)}
                                        </span>
                                      ) : (
                                        <span className="text-slate-500">Tanpa HLT (penuh)</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {DAY_OF_WEEK_OPTIONS.map((d) => {
                                        const selected = draftDays.includes(d.value);
                                        const isSchoolActive = schoolActiveTeacherDays.includes(d.value);
                                        const isHltDay = !selected && isSchoolActive;
                                        return (
                                          <button
                                            key={d.value}
                                            type="button"
                                            disabled={!canEdit || isSavingThis}
                                            onClick={() => toggleTeacherWorkDay(teacher.id, d.value)}
                                            title={
                                              selected
                                                ? `${d.label}: Hari wajib absen`
                                                : isHltDay
                                                  ? `${d.label}: Dihitung HLT (Hari Libur Tertentu)`
                                                  : `${d.label}: Libur sekolah`
                                            }
                                            className={cn(
                                              'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all tabular-nums',
                                              canEdit ? 'cursor-pointer' : 'cursor-default opacity-80',
                                              selected
                                                ? 'border-[#10264D] bg-[#10264D] text-white'
                                                : isHltDay
                                                  ? 'border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E] hover:border-[#0F766E]'
                                                  : 'border-[#E2E8F0] bg-[#F8FAFC] text-slate-400 hover:text-slate-600',
                                            )}
                                          >
                                            {d.short}
                                            {isHltDay && (
                                              <span className="ml-1 text-[9px] font-bold uppercase opacity-90">
                                                HLT
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {canEdit && (
                                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <button
                                          type="button"
                                          disabled={isSavingThis}
                                          onClick={() => applyTeacherPreset(teacher.id, [1, 2, 3, 4, 5])}
                                          className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-[#10264D] hover:text-[#10264D] cursor-pointer"
                                        >
                                          5 Hari
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isSavingThis}
                                          onClick={() =>
                                            applyTeacherPreset(teacher.id, schoolActiveTeacherDays)
                                          }
                                          className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-[#10264D] hover:text-[#10264D] cursor-pointer"
                                        >
                                          Penuh ({schoolActiveTeacherDays.length} Hari)
                                        </button>
                                        <Button
                                          type="button"
                                          variant={isDirty ? 'gold' : 'outline'}
                                          size="sm"
                                          loading={isSavingThis}
                                          onClick={() => void handleSaveTeacherWorkingDays(teacher)}
                                          leftIcon={<Check className="h-3.5 w-3.5" />}
                                        >
                                          {isDirty ? 'Simpan' : 'Tersimpan'}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {teacherRulesAll.length > 1 && (
                  <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Riwayat Perubahan Aturan Guru
                    </h3>
                    <div className="divide-y divide-[#F1F5F9] text-xs">
                      {teacherRulesAll.map((r) => (
                        <div key={r.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-[#10264D]">v{r.version ?? 1}</span>
                            <span className="font-medium text-slate-700">{r.name}</span>
                            <StatusBadge
                              label={r.isActive ? 'Aktif' : 'Riwayat'}
                              tone={r.isActive ? 'success' : 'neutral'}
                              showIcon={false}
                            />
                          </div>
                          <span className="font-mono text-slate-600 tabular-nums">
                            Masuk {r.checkInStart}–{r.checkInDeadline} · Pulang {r.checkOutStart}–{r.checkOutDeadline}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 3: HARI LIBUR */}
        {activeTab === 'holidays' && (
          <div className="space-y-4">
            {holidaysError && (
              <div
                role="alert"
                className="flex items-center gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{holidaysError}</span>
              </div>
            )}
            <DataTable
              columns={holidayColumns}
              data={holidays}
              loading={holidaysLoading}
              emptyTitle="Belum ada hari libur terdaftar"
              emptyDescription="Tambahkan hari libur nasional atau libur khusus sekolah agar tidak terhitung alfa."
            />
          </div>
        )}
      </div>

      {/* Modal: Easy-to-Understand Rule Editor */}
      <Modal
        open={ruleModalOpen}
        onClose={() => !savingRule && setRuleModalOpen(false)}
        title={
          ruleAudience === AttendanceAudience.TEACHER
            ? 'Atur Jam Absensi Guru'
            : 'Atur Jam Absensi Siswa Per Kelas'
        }
        description="Simpan pengaturan jam masuk, batas terlambat, dan jam pulang (format 24 jam). Riwayat aturan lama tetap tersimpan rapi."
        size="lg"
      >
        <form onSubmit={handleSubmitRule} className="space-y-5">
          {ruleFormError && (
            <div
              role="alert"
              className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              {ruleFormError}
            </div>
          )}

          <Input
            label="Nama Paket Jam Absensi"
            placeholder="Contoh: Jam Absensi Kelas 1A"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            required
          />

          {/* Class Picker for Students */}
          {ruleAudience === AttendanceAudience.STUDENT && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#10264D]">
                  Pilih Kelas yang Menggunakan Jam Ini
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setApplyToAllClasses(false);
                      setRuleClassIds(
                        classes.filter((c) => Number(c.gradeLevel) <= 2).map((c) => c.id),
                      );
                    }}
                    className="text-[11px] font-semibold text-[#10264D] hover:underline cursor-pointer"
                  >
                    Kelas 1–2
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setApplyToAllClasses(false);
                      setRuleClassIds(
                        classes.filter((c) => Number(c.gradeLevel) >= 3).map((c) => c.id),
                      );
                    }}
                    className="text-[11px] font-semibold text-[#10264D] hover:underline cursor-pointer"
                  >
                    Kelas 3–6
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setApplyToAllClasses(true);
                      setRuleClassIds([]);
                    }}
                    className={cn(
                      'text-[11px] font-semibold hover:underline cursor-pointer',
                      applyToAllClasses ? 'text-[#B45309] underline' : 'text-slate-500',
                    )}
                  >
                    Semua Kelas (Ganti Semua)
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {classes.map((cls) => {
                  const selected = !applyToAllClasses && ruleClassIds.includes(cls.id);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => toggleRuleClass(cls.id)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer',
                        selected
                          ? 'border-[#10264D] bg-[#10264D] text-white'
                          : 'border-[#CBD5E1] bg-white text-[#10264D] hover:bg-[#F8FAFC]',
                      )}
                    >
                      Kelas {cls.name}
                    </button>
                  );
                })}
              </div>
              <p
                className={cn(
                  'text-[11px]',
                  applyToAllClasses ? 'text-[#B45309] font-medium' : 'text-slate-500',
                )}
              >
                {applyToAllClasses
                  ? 'Mode Semua Kelas aktif: menyimpan aturan ini akan mengganti jadwal seluruh kelas.'
                  : ruleClassIds.length === 0
                    ? 'Pilih minimal 1 kelas di atas, atau klik "Semua Kelas (Ganti Semua)".'
                    : `Berlaku khusus untuk ${ruleClassIds.length} kelas terpilih tanpa mengubah jadwal kelas lain.`}
              </p>
            </div>
          )}

          {/* Section 1: Jam Masuk */}
          <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4]/60 p-4 space-y-3">
            <p className="text-xs font-bold text-[#15803D] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              1. Pengaturan Jam Masuk
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input
                label="Mulai Absen Masuk"
                type="time"
                value={checkInStart}
                onChange={(e) => setCheckInStart(e.target.value)}
                required
              />
              <Input
                label="Batas Tepat Waktu"
                type="time"
                value={lateAfter}
                onChange={(e) => setLateAfter(e.target.value)}
                required
              />
              <Input
                label="Toleransi (Menit)"
                type="number"
                min={0}
                max={60}
                value={lateToleranceMinutes}
                onChange={(e) => setLateToleranceMinutes(e.target.value)}
              />
              <Input
                label="Tutup Absen Masuk"
                type="time"
                value={checkInDeadline}
                onChange={(e) => setCheckInDeadline(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Section 2: Jam Pulang */}
          <div className="rounded-xl border border-[#CBD5E1] bg-[#EEF3FA]/60 p-4 space-y-3">
            <p className="text-xs font-bold text-[#10264D] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#C69B3C]" />
              2. Pengaturan Jam Pulang
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Mulai Boleh Absen Pulang"
                type="time"
                value={checkOutStart}
                onChange={(e) => setCheckOutStart(e.target.value)}
                required
              />
              <Input
                label="Batas Akhir Absen Pulang"
                type="time"
                value={checkOutDeadline}
                onChange={(e) => setCheckOutDeadline(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Section 3: Hari Kerja */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#10264D]">3. Hari Masuk Aktif</label>
            <div className="flex flex-wrap gap-2">
              {DAY_OF_WEEK_OPTIONS.map((d) => {
                const active = ruleDays.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleRuleDay(d.value)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all',
                      active
                        ? 'border-[#C69B3C] bg-[#FDF8EC] text-[#8D6B22]'
                        : 'border-[#E2E8F0] bg-white text-slate-500 hover:bg-[#F8FAFC]',
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: GPS & Effective Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
            <Input
              label="Berlaku Mulai Tanggal"
              type="date"
              value={effectiveFromDate}
              onChange={(e) => setEffectiveFromDate(e.target.value)}
              required
            />
            <label className="flex items-center gap-2 text-xs font-medium text-[#10264D] pt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={gpsRequired}
                onChange={(e) => setGpsRequired(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#10264D]"
              />
              <span>Wajib GPS Aktif</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-[#10264D] pt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={geofenceRequired}
                onChange={(e) => setGeofenceRequired(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#10264D]"
              />
              <span>Wajib Radius Sekolah</span>
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-[#F1F5F9]">
            <Button variant="outline" onClick={() => setRuleModalOpen(false)} disabled={savingRule}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={savingRule}>
              Simpan Jam Absensi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Holiday Create / Edit */}
      <Modal
        open={holidayModalOpen}
        onClose={() => !savingHoliday && setHolidayModalOpen(false)}
        title={editingHoliday ? 'Ubah Hari Libur' : 'Tambah Hari Libur'}
      >
        <form onSubmit={handleSubmitHoliday} className="space-y-4">
          {holidayFormError && (
            <div
              role="alert"
              className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              {holidayFormError}
            </div>
          )}

          <Input
            label="Tanggal Libur"
            type="date"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
            required
          />
          <Input
            label="Keterangan Hari Libur"
            placeholder="Contoh: Hari Raya Idul Fitri"
            value={holidayName}
            onChange={(e) => setHolidayName(e.target.value)}
            required
          />
          <Select
            label="Cakupan"
            value={holidayScope}
            onChange={(e) => setHolidayScope(e.target.value as HolidayScope)}
            options={[
              { value: HolidayScope.SCHOOL, label: 'Seluruh Sekolah (Siswa & Guru)' },
              { value: HolidayScope.STUDENT, label: 'Khusus Siswa' },
              { value: HolidayScope.TEACHER, label: 'Khusus Guru' },
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-[#10264D] cursor-pointer">
            <input
              type="checkbox"
              checked={holidayActive}
              onChange={(e) => setHolidayActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#10264D]"
            />
            <span>Hari libur aktif</span>
          </label>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              onClick={() => setHolidayModalOpen(false)}
              disabled={savingHoliday}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={savingHoliday}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(archivingHoliday)}
        onClose={() => setArchivingHoliday(null)}
        onConfirm={handleConfirmArchiveHoliday}
        title="Nonaktifkan Hari Libur"
        message={`Nonaktifkan "${archivingHoliday?.name ?? ''}" pada tanggal ${archivingHoliday?.date ?? ''}?`}
        confirmLabel="Ya, Nonaktifkan"
        variant="danger"
        loading={archivingBusy}
      />

      {/* Teacher Schedule Group Modal */}
      <TeacherScheduleGroupModal
        open={teacherGroupModalOpen}
        onClose={() => setTeacherGroupModalOpen(false)}
        teachers={teachers}
        activeTeacherRule={activeTeacherRule}
        onApplied={() => void loadRulesAndClasses()}
      />

      {/* Holiday Excel Import Modal */}
      <HolidayImportModal
        open={holidayImportModalOpen}
        onClose={() => setHolidayImportModalOpen(false)}
        onImported={() => void loadHolidays()}
      />
    </AppShell>
  );
}

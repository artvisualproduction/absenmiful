import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  CalendarDays,
  Clock,
  Info,
  LayoutGrid,
  Pencil,
  Plus,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cn } from '../../lib/cn';
import { formatDateShortJakarta, getDateKeyJakarta, INDONESIAN_DAY_NAMES } from '../../lib/date';
import { teachingScheduleCreateSchema } from '../../lib/scheduleRulesValidation';
import { ApiClientError } from '../../services/apiClient';
import {
  masterDataService,
  type EnrichedClass,
  type EnrichedTeacher,
} from '../../services/masterDataService';
import {
  scheduleRulesService,
  type EnrichedTeachingSchedule,
} from '../../services/scheduleRulesService';
import { UserRole, type Subject } from '../../types';
import { ScheduleImportModal } from './ScheduleImportModal';

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
  value: String(day),
  label: INDONESIAN_DAY_NAMES[day],
}));

const WEEKLY_CALENDAR_DAYS = [1, 2, 3, 4, 5, 6] as const;

export function AdminSchedulesPage() {
  useDocumentTitle('Jadwal Mengajar');
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = user ? user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER : false;

  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [schedules, setSchedules] = useState<EnrichedTeachingSchedule[]>([]);
  const [teachers, setTeachers] = useState<EnrichedTeacher[]>([]);
  const [classes, setClasses] = useState<EnrichedClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterTeacherId, setFilterTeacherId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [filterActive, setFilterActive] = useState('true');

  // Form Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<EnrichedTeachingSchedule | null>(null);
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [useHomeroomTeacher, setUseHomeroomTeacher] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('07:15');
  const [endTime, setEndTime] = useState('08:25');
  const [room, setRoom] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => getDateKeyJakarta());
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Archive Confirmation
  const [archivingTarget, setArchivingTarget] = useState<EnrichedTeachingSchedule | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Bulk Delete
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadMasterOptions = async () => {
    try {
      const [teachersRes, classesRes, subjectsRes] = await Promise.all([
        masterDataService.listTeachers({ limit: 1000 }),
        masterDataService.listClasses({ isActive: 'true' }),
        masterDataService.listSubjects({ isActive: 'true' }),
      ]);
      setTeachers(teachersRes.items);
      setClasses(classesRes.items);
      setSubjects(subjectsRes.items);
    } catch {
      // Master option errors will surface cleanly when opening modal
    }
  };

  const loadSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await scheduleRulesService.listSchedules({
        teacherId: filterTeacherId || undefined,
        classId: filterClassId || undefined,
        dayOfWeek: filterDay || undefined,
        isActive: filterActive || undefined,
      });
      setSchedules(res.items);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat jadwal mengajar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMasterOptions();
  }, []);

  useEffect(() => {
    void loadSchedules();
  }, [filterTeacherId, filterClassId, filterDay, filterActive]);

  const openCreate = () => {
    setEditing(null);
    const initialSubjectId = subjects[0]?.id || '';
    const initialClassId = filterClassId || classes[0]?.id || '';
    const initialSubject = subjects.find((s) => s.id === initialSubjectId);
    const initialClass = classes.find((c) => c.id === initialClassId);
    const autoHomeroom = Boolean(initialSubject?.defaultToHomeroomTeacher);

    setSubjectId(initialSubjectId);
    setClassId(initialClassId);
    setUseHomeroomTeacher(autoHomeroom);
    setTeacherId(
      autoHomeroom
        ? initialClass?.homeroomTeacherId ?? ''
        : filterTeacherId || teachers[0]?.id || '',
    );
    setDayOfWeek(filterDay || '1');
    setStartTime('07:15');
    setEndTime('08:25');
    setRoom('');
    setEffectiveFrom(getDateKeyJakarta());
    setEffectiveUntil('');
    setIsActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: EnrichedTeachingSchedule) => {
    setEditing(row);
    const matchedSubject = subjects.find((s) => s.id === row.subjectId);
    const matchedClass = classes.find((c) => c.id === row.classId);
    const isHomeroom = Boolean(
      matchedSubject?.defaultToHomeroomTeacher &&
        matchedClass?.homeroomTeacherId &&
        matchedClass.homeroomTeacherId === row.teacherId,
    );
    setTeacherId(row.teacherId);
    setSubjectId(row.subjectId);
    setClassId(row.classId);
    setUseHomeroomTeacher(isHomeroom);
    setDayOfWeek(String(row.dayOfWeek));
    setStartTime(row.startTime);
    setEndTime(row.endTime);
    setRoom(row.room ?? '');
    setEffectiveFrom(getDateKeyJakarta(row.effectiveFrom));
    setEffectiveUntil(row.effectiveUntil ? getDateKeyJakarta(row.effectiveUntil) : '');
    setIsActive(row.isActive);
    setFormError(null);
    setModalOpen(true);
  };

  const selectedModalClass = classes.find((c) => c.id === classId) ?? null;

  const handleSubjectSelect = (nextSubjectId: string) => {
    setSubjectId(nextSubjectId);
    const nextSubject = subjects.find((s) => s.id === nextSubjectId);
    if (nextSubject?.defaultToHomeroomTeacher) {
      setUseHomeroomTeacher(true);
      setTeacherId(selectedModalClass?.homeroomTeacherId ?? '');
    } else {
      setUseHomeroomTeacher(false);
    }
  };

  const handleClassSelect = (nextClassId: string) => {
    setClassId(nextClassId);
    if (useHomeroomTeacher) {
      const nextClass = classes.find((c) => c.id === nextClassId);
      setTeacherId(nextClass?.homeroomTeacherId ?? '');
    }
  };

  const handleToggleHomeroom = (checked: boolean) => {
    setUseHomeroomTeacher(checked);
    if (checked) {
      setTeacherId(selectedModalClass?.homeroomTeacherId ?? '');
    } else if (!teacherId) {
      setTeacherId(teachers[0]?.id ?? '');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = teachingScheduleCreateSchema.safeParse({
      teacherId,
      subjectId,
      classId,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
      room: room.trim() ? room.trim() : null,
      effectiveFrom: `${effectiveFrom}T00:00:00+07:00`,
      effectiveUntil: effectiveUntil.trim() ? `${effectiveUntil.trim()}T23:59:59+07:00` : null,
      isActive,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Data jadwal mengajar tidak valid.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await scheduleRulesService.updateSchedule(editing.id, parsed.data);
        showToast({ variant: 'success', title: 'Jadwal mengajar diperbarui' });
      } else {
        await scheduleRulesService.createSchedule(parsed.data);
        showToast({ variant: 'success', title: 'Jadwal mengajar berhasil ditambahkan' });
      }
      setModalOpen(false);
      await loadSchedules();
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : 'Gagal menyimpan jadwal mengajar.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!archivingTarget) return;
    setArchiving(true);
    try {
      await scheduleRulesService.archiveSchedule(archivingTarget.id);
      showToast({
        variant: 'success',
        title: 'Jadwal diarsipkan',
        message: 'Jadwal ditandai nonaktif tanpa menghapus riwayat.',
      });
      setArchivingTarget(null);
      await loadSchedules();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengarsipkan jadwal',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      const res = await scheduleRulesService.bulkDeleteSchedules(selectedIds);
      showToast({
        variant: 'success',
        title: `${res.deletedCount} jadwal mengajar berhasil dihapus`,
      });
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      await loadSchedules();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menghapus jadwal terpilih',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const schedulesByDay = useMemo(() => {
    const grouped = new Map<number, EnrichedTeachingSchedule[]>();
    for (const day of [1, 2, 3, 4, 5, 6, 7]) {
      grouped.set(day, []);
    }
    for (const item of schedules) {
      const list = grouped.get(item.dayOfWeek) ?? [];
      list.push(item);
      grouped.set(item.dayOfWeek, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return grouped;
  }, [schedules]);

  const hasSundaySchedules = (schedulesByDay.get(7)?.length ?? 0) > 0;
  const calendarDays = hasSundaySchedules ? [1, 2, 3, 4, 5, 6, 7] : [...WEEKLY_CALENDAR_DAYS];

  const columns: Array<TableColumn<EnrichedTeachingSchedule>> = [
    {
      key: 'day',
      header: 'Hari & Jam',
      render: (row) => (
        <div>
          <p className="font-semibold text-[#10264D]">
            {INDONESIAN_DAY_NAMES[row.dayOfWeek] ?? `Hari ${row.dayOfWeek}`}
          </p>
          <p className="font-mono text-xs text-slate-600 tabular-nums">
            {row.startTime} – {row.endTime}
          </p>
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Kelas',
      render: (row) => (
        <span className="inline-flex items-center rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-xs font-semibold text-[#10264D]">
          Kelas {row.className}
        </span>
      ),
    },
    {
      key: 'subject',
      header: 'Mata Pelajaran',
      render: (row) => (
        <div>
          <p className="font-medium text-[#10264D]">{row.subjectName}</p>
          <p className="font-mono text-xs text-slate-500">{row.subjectCode}</p>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'Guru Pengampu',
      render: (row) => <span className="text-slate-700">{row.teacherName}</span>,
    },
    {
      key: 'room',
      header: 'Ruang & Masa Berlaku',
      render: (row) => (
        <div className="text-xs text-slate-600">
          <p className="font-medium text-slate-700">{row.room || 'Ruang kelas reguler'}</p>
          <p className="tabular-nums">
            Mulai {formatDateShortJakarta(row.effectiveFrom)}
            {row.effectiveUntil ? ` s.d. ${formatDateShortJakarta(row.effectiveUntil)}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.isActive ? (
          <StatusBadge label="Aktif" tone="success" />
        ) : (
          <StatusBadge label="Arsip" tone="neutral" />
        ),
    },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: 'Aksi',
            align: 'right' as const,
            render: (row: EnrichedTeachingSchedule) => (
              <div className="inline-flex items-center justify-end gap-1">
                <button
                  type="button"
                  title="Ubah Jadwal"
                  aria-label={`Ubah jadwal ${row.subjectName}`}
                  onClick={() => openEdit(row)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {row.isActive && (
                  <button
                    type="button"
                    title="Arsipkan Jadwal"
                    aria-label={`Arsipkan jadwal ${row.subjectName}`}
                    onClick={() => setArchivingTarget(row)}
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

  const teacherOptions = teachers.map((t) => ({
    value: t.id,
    label: `${t.fullName} (${t.position})`,
  }));
  const classOptions = classes.map((c) => ({
    value: c.id,
    label: `Kelas ${c.name}`,
  }));
  const subjectOptions = subjects.map((s) => ({
    value: s.id,
    label: `${s.code} — ${s.name}`,
  }));

  const filterToolbar = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 flex-1">
        <Select
          aria-label="Filter Guru"
          value={filterTeacherId}
          onChange={(e) => setFilterTeacherId(e.target.value)}
          options={[{ value: '', label: 'Semua Guru' }, ...teacherOptions]}
        />
        <Select
          aria-label="Filter Kelas"
          value={filterClassId}
          onChange={(e) => setFilterClassId(e.target.value)}
          options={[{ value: '', label: 'Semua Kelas' }, ...classOptions]}
        />
        <Select
          aria-label="Filter Hari"
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value)}
          options={[{ value: '', label: 'Semua Hari' }, ...DAY_OPTIONS]}
        />
        <Select
          aria-label="Filter Status"
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          options={[
            { value: 'true', label: 'Jadwal Aktif' },
            { value: '', label: 'Semua Status' },
            { value: 'false', label: 'Arsip / Nonaktif' },
          ]}
        />
      </div>

      <div
        role="group"
        aria-label="Pilih tampilan jadwal"
        className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1 self-start lg:self-auto shrink-0"
      >
        <button
          type="button"
          onClick={() => setViewMode('table')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            viewMode === 'table'
              ? 'bg-[#10264D] text-white'
              : 'text-slate-600 hover:text-[#10264D]',
          )}
        >
          <Table2 className="h-3.5 w-3.5" />
          Tabel
        </button>
        <button
          type="button"
          onClick={() => setViewMode('calendar')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            viewMode === 'calendar'
              ? 'bg-[#10264D] text-white'
              : 'text-slate-600 hover:text-[#10264D]',
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Kalender Mingguan
        </button>
      </div>
    </div>
  );

  return (
    <AppShell
      title="Jadwal Mengajar"
      subtitle="Penjadwalan guru per kelas dengan validasi otomatis bentrok guru maupun kelas."
      actions={
        canEdit ? (
          <div className="flex flex-wrap items-center gap-2 [&>button]:whitespace-nowrap [&>button]:shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              leftIcon={<Upload className="h-4 w-4" />}
            >
              Impor Excel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={openCreate}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Tambah Jadwal
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Ketentuan Hari Masuk Guru & HLT (di bagian atas menu jadwal) */}
        <section className="rounded-xl border border-[#CBD5E1] border-l-4 border-l-[#10264D] bg-gradient-to-r from-[#F8FAFC] via-white to-[#FCF9F1] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#10264D] text-[#E7D4A3]">
              <Info className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-[#10264D]">
                Ketentuan Hari Masuk Guru &amp; HLT (Hari Libur Tertentu)
              </h2>
              <p className="text-xs leading-relaxed text-slate-600">
                Setiap guru wajib absen sesuai hari masuk yang ditetapkan pada menu{' '}
                <strong>Aturan Jam Absensi &rarr; Jam Guru</strong>. Bagi guru yang hanya masuk 5
                hari dalam seminggu, hari kerja sekolah lainnya otomatis dihitung sebagai{' '}
                <strong className="text-[#0F766E]">HLT (Hari Libur Tertentu)</strong> dan tidak
                terhitung Alfa.
              </p>
            </div>
          </div>
          <Link to="/admin/attendance-rules" className="shrink-0">
            <Button variant="outline" size="sm" leftIcon={<Clock className="h-3.5 w-3.5" />}>
              Atur Hari Masuk Guru
            </Button>
          </Link>
        </section>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {canEdit && selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#10264D]/20 bg-[#F2F5FA] px-4 py-3">
            <p className="text-xs font-semibold text-[#10264D] tabular-nums">
              {selectedIds.length} jadwal mengajar dipilih
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            >
              Hapus Terpilih ({selectedIds.length})
            </Button>
          </div>
        )}

        {viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={schedules}
            loading={loading}
            emptyTitle="Belum ada jadwal mengajar"
            emptyDescription="Tambahkan jadwal mengajar baru atau sesuaikan filter guru, kelas, dan hari."
            selectable={canEdit}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            toolbar={filterToolbar}
          />
        ) : (
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="border-b border-[#E2E8F0] p-4">{filterToolbar}</div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-44 rounded-lg" />
                ))}
              </div>
            ) : schedules.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<CalendarDays className="h-6 w-6" />}
                  title="Belum ada jadwal mengajar"
                  description="Tidak ada jadwal yang sesuai dengan filter yang dipilih."
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                {calendarDays.map((day) => {
                  const dayItems = schedulesByDay.get(day) ?? [];
                  return (
                    <div
                      key={day}
                      className="flex flex-col rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] overflow-hidden"
                    >
                      <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#10264D] px-4 py-2.5 text-white">
                        <span className="text-sm font-semibold">
                          {INDONESIAN_DAY_NAMES[day]}
                        </span>
                        <span className="rounded bg-white/15 px-2 py-0.5 text-xs font-medium tabular-nums">
                          {dayItems.length} sesi
                        </span>
                      </div>

                      <div className="flex-1 divide-y divide-[#E2E8F0] bg-white">
                        {dayItems.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-slate-400">
                            Tidak ada jadwal terjadwal
                          </div>
                        ) : (
                          dayItems.map((item) => (
                            <div
                              key={item.id}
                              className="p-3.5 transition-colors hover:bg-[#FCF9F1]/60"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-[#8D6B22] tabular-nums">
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  <span>
                                    {item.startTime}–{item.endTime}
                                  </span>
                                </div>
                                <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[11px] font-semibold text-[#10264D]">
                                  Kelas {item.className}
                                </span>
                              </div>
                              <p className="mt-1.5 text-sm font-semibold text-[#10264D]">
                                {item.subjectName}{' '}
                                <span className="font-mono text-xs font-normal text-slate-500">
                                  ({item.subjectCode})
                                </span>
                              </p>
                              <p className="mt-0.5 text-xs text-slate-600">{item.teacherName}</p>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="text-[11px] text-slate-500">
                                  {item.room || 'Ruang kelas reguler'}
                                </span>
                                {canEdit && (
                                  <button
                                    type="button"
                                    title="Ubah Jadwal"
                                    aria-label={`Ubah jadwal ${item.subjectName}`}
                                    onClick={() => openEdit(item)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:text-[#C69B3C] hover:border-[#C69B3C] transition-colors cursor-pointer"
                                  >
                                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
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

      {/* Modal Tambah / Ubah Jadwal */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Ubah Jadwal Mengajar' : 'Tambah Jadwal Mengajar'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Kelas"
              required
              placeholder="Pilih kelas..."
              value={classId}
              onChange={(e) => handleClassSelect(e.target.value)}
              options={classOptions}
            />
            <Select
              label="Mata Pelajaran"
              required
              placeholder="Pilih mata pelajaran..."
              value={subjectId}
              onChange={(e) => handleSubjectSelect(e.target.value)}
              options={subjectOptions}
            />
          </div>

          <div className="space-y-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
            <label className="flex items-start gap-2.5 text-sm text-[#10264D] cursor-pointer">
              <input
                type="checkbox"
                checked={useHomeroomTeacher}
                onChange={(e) => handleToggleHomeroom(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#10264D] focus:ring-[#10264D]"
              />
              <span>
                <span className="block text-xs font-semibold text-[#10264D]">
                  Wali kelas adalah guru mata pelajaran (untuk jenjang SD/MI)
                </span>
                <span className="block text-[11px] text-slate-500">
                  Otomatis menetapkan wali kelas dari kelas terpilih sebagai guru pengampu jadwal.
                </span>
              </span>
            </label>

            {useHomeroomTeacher && !selectedModalClass?.homeroomTeacherId && (
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
                Kelas terpilih belum memiliki Wali Kelas. Atur Wali Kelas di menu Kelas atau hapus
                centang di atas untuk memilih guru secara manual.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Guru Pengampu"
              required
              placeholder="Pilih guru..."
              value={teacherId}
              disabled={useHomeroomTeacher}
              onChange={(e) => setTeacherId(e.target.value)}
              options={teacherOptions}
              helperText={
                useHomeroomTeacher && selectedModalClass?.homeroomTeacherName
                  ? `Diambil otomatis dari Wali Kelas: ${selectedModalClass.homeroomTeacherName}`
                  : undefined
              }
            />
            <Select
              label="Hari Mengajar"
              required
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
              options={DAY_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Jam Mulai"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="Jam Selesai"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
            <Input
              label="Ruang (Opsional)"
              placeholder="Contoh: Ruang 1A"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Tanggal Mulai Berlaku"
              type="date"
              required
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
            <Input
              label="Tanggal Berakhir (Opsional)"
              type="date"
              value={effectiveUntil}
              onChange={(e) => setEffectiveUntil(e.target.value)}
              helperText="Kosongkan jika berlaku hingga akhir semester."
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-[#10264D] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#10264D] focus:ring-[#10264D]"
            />
            <span>Jadwal aktif (otomatis diperiksa bentrok guru dan kelas)</span>
          </label>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Simpan Jadwal
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(archivingTarget)}
        onClose={() => !archiving && setArchivingTarget(null)}
        onConfirm={handleConfirmArchive}
        title="Arsipkan Jadwal Mengajar?"
        message={
          archivingTarget
            ? `Jadwal ${archivingTarget.subjectName} di Kelas ${archivingTarget.className} (${INDONESIAN_DAY_NAMES[archivingTarget.dayOfWeek]}, ${archivingTarget.startTime}–${archivingTarget.endTime}) akan dinonaktifkan tanpa menghapus data riwayat.`
            : ''
        }
        confirmLabel="Ya, Arsipkan"
        variant="danger"
        loading={archiving}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => !deleting && setBulkDeleteOpen(false)}
        onConfirm={() => void handleBulkDelete()}
        title="Hapus Jadwal Mengajar Terpilih?"
        message={`Sebanyak ${selectedIds.length} jadwal mengajar terpilih akan dihapus permanen dari sistem.`}
        confirmLabel="Ya, Hapus Permanen"
        variant="danger"
        loading={deleting}
      />

      <ScheduleImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadSchedules}
      />
    </AppShell>
  );
}

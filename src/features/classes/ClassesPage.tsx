import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Eye, Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/Skeleton';
import { mapStatusToBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatClassName } from '../../lib/formatters';
import { schoolClassCreateSchema } from '../../lib/masterDataValidation';
import { ApiClientError } from '../../services/apiClient';
import {
  masterDataService,
  type EnrichedClass,
  type EnrichedStudent,
  type EnrichedTeacher,
} from '../../services/masterDataService';
import { UserRole, type AcademicYear } from '../../types';
import { ClassImportModal } from './ClassImportModal';

export function ClassesPage() {
  useDocumentTitle('Data Kelas');
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = user ? user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER : false;

  const [items, setItems] = useState<EnrichedClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<EnrichedTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  // Selection & Bulk Delete
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);

  // Create / Edit Class Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<EnrichedClass | null>(null);
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('1');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [capacity, setCapacity] = useState('30');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // View Class Students Pop-up Modal
  const [viewingClass, setViewingClass] = useState<EnrichedClass | null>(null);
  const [classStudents, setClassStudents] = useState<EnrichedStudent[]>([]);
  const [classStudentsLoading, setClassStudentsLoading] = useState(false);
  const [classStudentsError, setClassStudentsError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  // Delete Class Dialog
  const [deleteTarget, setDeleteTarget] = useState<EnrichedClass | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadReference = async () => {
    try {
      const [yearsRes, teachersRes] = await Promise.all([
        masterDataService.listAcademicYears(),
        masterDataService.listTeachers({ limit: 1000 }),
      ]);
      setYears(yearsRes.items);
      setTeachers(teachersRes.items);
    } catch {
      // Handled by main loader
    }
  };

  const loadClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await masterDataService.listClasses({
        search: debouncedSearch,
        academicYearId: yearFilter || undefined,
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat data kelas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReference();
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [debouncedSearch, yearFilter]);

  const openViewStudents = async (row: EnrichedClass) => {
    setViewingClass(row);
    setStudentSearch('');
    setClassStudents([]);
    setClassStudentsError(null);
    setClassStudentsLoading(true);
    try {
      const res = await masterDataService.listStudents({
        classId: row.id,
        limit: 2000,
      });
      setClassStudents(res.items);
    } catch (err) {
      setClassStudentsError(
        err instanceof ApiClientError ? err.message : 'Gagal memuat daftar siswa kelas ini.',
      );
    } finally {
      setClassStudentsLoading(false);
    }
  };

  const filteredClassStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return classStudents;
    return classStudents.filter(
      (s) => s.fullName.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q),
    );
  }, [classStudents, studentSearch]);

  const openCreate = () => {
    const activeYear = years.find((y) => y.isActive) ?? years[0];
    setEditing(null);
    setName('');
    setGradeLevel('1');
    setHomeroomTeacherId('');
    setAcademicYearId(activeYear?.id ?? '');
    setCapacity('30');
    setIsActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: EnrichedClass) => {
    setEditing(row);
    setName(row.name);
    setGradeLevel(row.gradeLevel);
    setHomeroomTeacherId(row.homeroomTeacherId ?? '');
    setAcademicYearId(row.academicYearId);
    setCapacity(String(row.capacity ?? 30));
    setIsActive(row.isActive);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = schoolClassCreateSchema.safeParse({
      name,
      gradeLevel,
      homeroomTeacherId: homeroomTeacherId || null,
      academicYearId,
      capacity: capacity ? Number(capacity) : null,
      isActive,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Data kelas tidak valid.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await masterDataService.updateClass(editing.id, parsed.data);
        showToast({ variant: 'success', title: 'Data kelas diperbarui' });
      } else {
        await masterDataService.createClass(parsed.data);
        showToast({ variant: 'success', title: 'Kelas baru ditambahkan' });
      }
      setModalOpen(false);
      await loadClasses();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan data kelas.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await masterDataService.deleteClass(deleteTarget.id);
      showToast({
        variant: 'success',
        title: 'Kelas dihapus',
        message: `Kelas ${deleteTarget.name} telah dihapus permanen.`,
      });
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      setDeleteTarget(null);
      await loadClasses();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menghapus kelas',
        message: err instanceof ApiClientError ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeletingBulk(true);
    try {
      const res = await masterDataService.bulkDeleteClasses(selectedIds);
      if (res.failedIds && res.failedIds.length > 0) {
        showToast({
          variant: 'error',
          title: 'Beberapa kelas tidak dapat dihapus',
          message: res.failedIds[0]?.reason ?? 'Masih memiliki siswa terdaftar.',
        });
      }
      if (res.deletedCount > 0) {
        showToast({
          variant: 'success',
          title: `${res.deletedCount} kelas berhasil dihapus`,
        });
      }
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      await loadClasses();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menghapus kelas terpilih',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setDeletingBulk(false);
    }
  };

  const columns: Array<TableColumn<EnrichedClass>> = [
    {
      key: 'name',
      header: 'Nama Kelas',
      render: (row) => <span className="font-semibold text-[#10264D]">{formatClassName(row.name)}</span>,
    },
    {
      key: 'gradeLevel',
      header: 'Tingkat',
      render: (row) => <span className="tabular-nums">Tingkat {row.gradeLevel}</span>,
    },
    {
      key: 'homeroom',
      header: 'Wali Kelas',
      render: (row) => <span>{row.homeroomTeacherName ?? 'Belum ditentukan'}</span>,
    },
    {
      key: 'year',
      header: 'Tahun Ajaran',
      render: (row) => <span className="tabular-nums">{row.academicYearLabel}</span>,
    },
    {
      key: 'studentCount',
      header: 'Siswa Aktif',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-semibold text-[#10264D] tabular-nums">
          {row.studentCount}
        </span>
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
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (row: EnrichedClass) => (
        <div className="inline-flex items-center justify-end gap-1">
          <button
            type="button"
            title="Lihat Daftar Siswa"
            aria-label={`Lihat siswa Kelas ${row.name}`}
            onClick={() => void openViewStudents(row)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#FCF9F1] hover:border-[#C69B3C] transition-colors cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                title="Ubah Data Kelas"
                aria-label={`Ubah Kelas ${row.name}`}
                onClick={() => openEdit(row)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                title="Hapus Data Kelas"
                aria-label={`Hapus Kelas ${row.name}`}
                onClick={() => setDeleteTarget(row)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#FECACA] bg-white text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell
      title="Data Kelas"
      subtitle="Kelola tingkat, rombongan belajar, wali kelas, dan daftar siswa per kelas."
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
              Tambah Kelas
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
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
              {selectedIds.length} kelas dipilih
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

        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Tidak ada data kelas"
          emptyDescription="Ubah filter pencarian atau tambahkan kelas baru untuk mulai mengelola siswa."
          selectable={canEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          emptyAction={
            canEdit ? (
              <Button
                variant="primary"
                size="sm"
                onClick={openCreate}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Tambah Kelas
              </Button>
            ) : undefined
          }
          toolbar={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Input
                  placeholder="Cari nama kelas, tingkat, atau wali kelas..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftAddon={<Search className="h-4 w-4" />}
                />
              </div>
              <Select
                aria-label="Filter tahun ajaran"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                options={[
                  { value: '', label: 'Semua Tahun Ajaran' },
                  ...years.map((y) => ({
                    value: y.id,
                    label: `${y.label}${y.isActive ? ' (Aktif)' : ''}`,
                  })),
                ]}
              />
            </div>
          }
        />
      </div>

      {/* Pop-up Daftar Siswa Dalam Kelas */}
      <Modal
        open={Boolean(viewingClass)}
        onClose={() => setViewingClass(null)}
        title={viewingClass ? `Daftar Siswa Kelas ${viewingClass.name}` : 'Daftar Siswa'}
        description={
          viewingClass
            ? `Wali Kelas: ${viewingClass.homeroomTeacherName ?? 'Belum ditentukan'} · Tahun Ajaran ${viewingClass.academicYearLabel}`
            : undefined
        }
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-full sm:max-w-xs">
              <Input
                placeholder="Cari nama atau NIS siswa..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                leftAddon={<Search className="h-4 w-4" />}
              />
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#10264D] tabular-nums">
              <Users className="h-3.5 w-3.5 text-[#C69B3C]" aria-hidden="true" />
              <span>Total: {filteredClassStudents.length} siswa</span>
            </div>
          </div>

          {classStudentsError && (
            <div
              role="alert"
              className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              {classStudentsError}
            </div>
          )}

          {classStudentsLoading ? (
            <div className="py-10 flex justify-center">
              <LoadingSpinner label="Memuat daftar siswa kelas..." />
            </div>
          ) : filteredClassStudents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-10 text-center space-y-1">
              <p className="text-sm font-semibold text-[#10264D]">
                Belum ada siswa di kelas ini
              </p>
              <p className="text-xs text-slate-500">
                Tambahkan atau pindahkan siswa ke kelas ini melalui menu Data Siswa.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] max-h-[55vh] overflow-y-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 w-12 text-center">No</th>
                    <th className="px-4 py-2.5">NIS</th>
                    <th className="px-4 py-2.5">Nama Lengkap</th>
                    <th className="px-4 py-2.5">L/P</th>
                    <th className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] bg-white">
                  {filteredClassStudents.map((student, index) => {
                    const badge = mapStatusToBadge(student.status);
                    return (
                      <tr key={student.id} className="hover:bg-[#F8FAFC]/80">
                        <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-500 tabular-nums">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#10264D] tabular-nums">
                          {student.nis}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-[#10264D]">
                          {student.fullName}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">
                          {student.gender ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <StatusBadge label={badge.label} tone={badge.tone} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button variant="primary" size="sm" onClick={() => setViewingClass(null)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Ubah Data Kelas' : 'Tambah Kelas Baru'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              {formError}
            </div>
          )}

          {years.length === 0 && (
            <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#92400E]">
              Belum ada tahun ajaran terdaftar.{' '}
              <Link to="/admin/academic-years" className="font-semibold underline">
                Tambahkan Tahun Ajaran
              </Link>{' '}
              terlebih dahulu sebelum membuat kelas.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nama Kelas"
              placeholder="Contoh: 1A, 4B"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Select
              label="Tingkat"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              options={['1', '2', '3', '4', '5', '6'].map((lvl) => ({
                value: lvl,
                label: `Kelas ${lvl}`,
              }))}
              required
            />
          </div>

          <Select
            label="Tahun Ajaran"
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            placeholder="Pilih tahun ajaran"
            options={years.map((y) => ({
              value: y.id,
              label: `${y.label}${y.isActive ? ' (Aktif)' : ''}`,
            }))}
            required
          />

          <Select
            label="Wali Kelas"
            value={homeroomTeacherId}
            onChange={(e) => setHomeroomTeacherId(e.target.value)}
            options={[
              { value: '', label: 'Belum ditentukan' },
              ...teachers.map((t) => ({
                value: t.id,
                label: `${t.fullName} (${t.position})`,
              })),
            ]}
          />

          <Input
            label="Kapasitas Maksimal (Opsional)"
            type="number"
            min={1}
            max={100}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />

          <label className="flex items-center gap-2.5 text-sm text-[#10264D] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#10264D] focus:ring-[#10264D]"
            />
            <span>Kelas aktif</span>
          </label>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteClass}
        title="Hapus Data Kelas"
        message={`Yakin ingin menghapus permanen Kelas ${deleteTarget?.name ?? ''}? Kelas hanya dapat dihapus jika tidak ada siswa yang terdaftar di dalamnya.`}
        confirmLabel="Ya, Hapus Kelas"
        variant="danger"
        loading={deleting}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => !deletingBulk && setBulkDeleteOpen(false)}
        onConfirm={() => void handleBulkDelete()}
        title="Hapus Kelas Terpilih?"
        message={`Sebanyak ${selectedIds.length} kelas terpilih akan dihapus permanen dari sistem (kecuali yang masih memiliki siswa terdaftar).`}
        confirmLabel="Ya, Hapus Permanen"
        variant="danger"
        loading={deletingBulk}
      />

      <ClassImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadClasses}
      />
    </AppShell>
  );
}

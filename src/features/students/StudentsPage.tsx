import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Download,
  History,
  Pencil,
  Plus,
  QrCode,
  Search,
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
import { Modal } from '../../components/ui/Modal';
import { mapStatusToBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateShortJakarta } from '../../lib/date';
import { formatClassName } from '../../lib/formatters';
import { exportRowsToExcel } from '../../lib/excel';
import { studentCreateSchema } from '../../lib/masterDataValidation';
import { ApiClientError } from '../../services/apiClient';
import {
  masterDataService,
  type EnrichedClass,
  type EnrichedStudent,
  type StudentDetailResponse,
} from '../../services/masterDataService';
import { Gender, StudentStatus, UserRole } from '../../types';
import { StudentImportModal } from './StudentImportModal';
import { StudentQrModal } from './StudentQrModal';

export function StudentsPage() {
  useDocumentTitle('Data Siswa');
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = user ? user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER : false;

  const [items, setItems] = useState<EnrichedStudent[]>([]);
  const [classes, setClasses] = useState<EnrichedClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  // Create/Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EnrichedStudent | null>(null);
  const [nis, setNis] = useState('');
  const [fullName, setFullName] = useState('');
  const [classId, setClassId] = useState('');
  const [gender, setGender] = useState('');
  const [photoPath, setPhotoPath] = useState('');
  const [status, setStatus] = useState<StudentStatus>(StudentStatus.ACTIVE);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete dialogs
  const [deleteTarget, setDeleteTarget] = useState<EnrichedStudent | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Enrollment history detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<StudentDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // QR Token modal
  const [qrTarget, setQrTarget] = useState<EnrichedStudent | null>(null);

  const loadClasses = async () => {
    try {
      const res = await masterDataService.listClasses();
      setClasses(res.items);
    } catch {
      // Handled by main fetch
    }
  };

  const loadStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await masterDataService.listStudents({
        search: debouncedSearch,
        classId: classFilter || undefined,
        status: statusFilter || undefined,
        limit: 2000,
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat data siswa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClasses();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
    void loadStudents();
  }, [debouncedSearch, classFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setNis('');
    setFullName('');
    setClassId(classes[0]?.id ?? '');
    setGender('');
    setPhotoPath('');
    setStatus(StudentStatus.ACTIVE);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: EnrichedStudent) => {
    setEditing(row);
    setNis(row.nis);
    setFullName(row.fullName);
    setClassId(row.classId);
    setGender(row.gender ?? '');
    setPhotoPath(row.photoPath ?? '');
    setStatus(row.status);
    setFormError(null);
    setFormOpen(true);
  };

  const openDetail = async (row: EnrichedStudent) => {
    setDetailModalOpen(true);
    setLoadingDetail(true);
    setDetailData(null);
    try {
      const detail = await masterDataService.getStudent(row.id);
      setDetailData(detail);
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal memuat riwayat kelas siswa',
        message: err instanceof ApiClientError ? err.message : undefined,
      });
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = studentCreateSchema.safeParse({
      nis,
      fullName,
      classId,
      gender: gender === Gender.L ? Gender.L : gender === Gender.P ? Gender.P : null,
      photoPath: photoPath.trim() || null,
      status,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Periksa kembali isian data siswa.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await masterDataService.updateStudent(editing.id, parsed.data);
        showToast({
          variant: 'success',
          title: 'Data siswa diperbarui',
          message:
            editing.classId !== parsed.data.classId
              ? 'Riwayat penempatan kelas (enrollment) ikut diperbarui.'
              : undefined,
        });
      } else {
        await masterDataService.createStudent(parsed.data);
        showToast({ variant: 'success', title: 'Siswa baru berhasil ditambahkan' });
      }
      setFormOpen(false);
      await loadStudents();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan data siswa.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await masterDataService.deleteStudent(deleteTarget.id);
      showToast({
        variant: 'success',
        title: 'Data siswa dihapus',
        message: `${deleteTarget.fullName} telah dihapus permanen dari daftar siswa.`,
      });
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      setDeleteTarget(null);
      await loadStudents();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menghapus data siswa',
        message: err instanceof ApiClientError ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      const res = await masterDataService.bulkDeleteStudents(selectedIds);
      showToast({
        variant: 'success',
        title: `${res.deletedCount} siswa dihapus permanen`,
      });
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      await loadStudents();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menghapus data terpilih',
        message: err instanceof ApiClientError ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await masterDataService.listStudents({
        search: debouncedSearch,
        classId: classFilter || undefined,
        status: statusFilter || undefined,
        limit: 2000,
      });

      exportRowsToExcel(
        'data_siswa_mi_miftahul_ulum.xlsx',
        'Data Siswa',
        res.items.map((s) => ({
          NIS: s.nis,
          'Nama Lengkap': s.fullName,
          Kelas: s.className,
          'Jenis Kelamin': s.gender ?? '-',
          Status: mapStatusToBadge(s.status).label,
        })),
        ['NIS'],
      );
      showToast({
        variant: 'success',
        title: 'Ekspor Excel berhasil',
        message: `${res.items.length} data siswa diunduh.`,
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengekspor data siswa',
        message: err instanceof ApiClientError ? err.message : undefined,
      });
    }
  };

  const columns: Array<TableColumn<EnrichedStudent>> = [
    {
      key: 'nis',
      header: 'NIS',
      render: (row) => <span className="font-mono text-xs font-medium text-[#10264D]">{row.nis}</span>,
    },
    {
      key: 'fullName',
      header: 'Nama Lengkap',
      render: (row) => (
        <span className="font-semibold text-[#10264D]">{row.fullName}</span>
      ),
    },
    {
      key: 'className',
      header: 'Kelas',
      render: (row) => <span className="font-medium tabular-nums">Kelas {row.className}</span>,
    },
    {
      key: 'gender',
      header: 'L/P',
      render: (row) => <span className="text-xs text-slate-600">{row.gender ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const badge = mapStatusToBadge(row.status);
        return <StatusBadge label={badge.label} tone={badge.tone} />;
      },
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center justify-end gap-1">
          <button
            type="button"
            title="Riwayat Penempatan Kelas"
            aria-label={`Riwayat kelas ${row.fullName}`}
            onClick={() => void openDetail(row)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-slate-600 hover:bg-[#F8FAFC] hover:text-[#10264D] transition-colors cursor-pointer"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                title="Kartu & QR Code (NIS)"
                aria-label={`QR ${row.fullName}`}
                onClick={() => setQrTarget(row)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#FCF9F1] hover:border-[#C69B3C] transition-colors cursor-pointer"
              >
                <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                title="Ubah Data Siswa"
                aria-label={`Ubah ${row.fullName}`}
                onClick={() => openEdit(row)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                title="Hapus Data Siswa"
                aria-label={`Hapus ${row.fullName}`}
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
      title="Data Siswa"
      subtitle="Master data siswa MI Miftahul Ulum Sumberwuluh beserta riwayat penempatan kelas."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportExcel()}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            Ekspor Excel
          </Button>
          {canEdit && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setImportOpen(true)}
                leftIcon={<Upload className="h-3.5 w-3.5" />}
              >
                Impor Excel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={openCreate}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Tambah Siswa
              </Button>
            </>
          )}
        </div>
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
              {selectedIds.length} siswa dipilih
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Hapus Terpilih
              </Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          selectable={canEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          emptyTitle="Tidak ada data siswa"
          emptyDescription={
            classes.length === 0
              ? 'Belum ada kelas terdaftar. Buat data kelas terlebih dahulu sebelum menambahkan siswa.'
              : 'Ubah pencarian atau filter, atau tambahkan siswa baru.'
          }
          emptyAction={
            canEdit ? (
              classes.length === 0 ? (
                <Link to="/admin/classes">
                  <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                    Buat Kelas Terlebih Dahulu
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={openCreate}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Tambah Siswa
                </Button>
              )
            ) : undefined
          }
          toolbar={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Input
                  placeholder="Cari nama siswa atau NIS..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftAddon={<Search className="h-4 w-4" />}
                />
              </div>
              <Select
                aria-label="Filter kelas"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                options={[
                  { value: '', label: 'Semua Kelas' },
                  ...classes.map((c) => ({ value: c.id, label: `Kelas ${c.name}` })),
                ]}
              />
              <Select
                aria-label="Filter status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'Semua Status' },
                  { value: StudentStatus.ACTIVE, label: 'Aktif' },
                  { value: StudentStatus.GRADUATED, label: 'Lulus' },
                  { value: StudentStatus.TRANSFERRED, label: 'Pindah' },
                  { value: StudentStatus.INACTIVE, label: 'Nonaktif / Arsip' },
                ]}
              />
            </div>
          }
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Ubah Data Siswa' : 'Tambah Siswa Baru'}
        description={
          editing
            ? 'Mengubah kelas akan otomatis mencatat riwayat perpindahan pada studentEnrollments.'
            : 'NIS disimpan sebagai teks sehingga angka nol di depan tetap terjaga.'
        }
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

          {classes.length === 0 && (
            <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#92400E]">
              Belum ada data kelas.{' '}
              <Link to="/admin/classes" className="font-semibold underline">
                Buat kelas terlebih dahulu di menu Data Kelas
              </Link>{' '}
              sebelum menambahkan siswa.
            </div>
          )}

          <Input
            label="NIS (Unik)"
            placeholder="Contoh: 00260001"
            value={nis}
            onChange={(e) => setNis(e.target.value)}
            required
          />
          <Input
            label="Nama Lengkap"
            placeholder="Nama lengkap sesuai data madrasah"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Kelas"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              placeholder="Pilih kelas"
              options={classes.map((c) => ({
                value: c.id,
                label: `${formatClassName(c.name)} (${c.academicYearLabel})`,
              }))}
              required
            />
            <Select
              label="Jenis Kelamin (Opsional)"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              options={[
                { value: '', label: 'Tidak diisi' },
                { value: Gender.L, label: 'Laki-laki (L)' },
                { value: Gender.P, label: 'Perempuan (P)' },
              ]}
            />
          </div>

          <Select
            label="Status Siswa"
            value={status}
            onChange={(e) => setStatus(e.target.value as StudentStatus)}
            options={[
              { value: StudentStatus.ACTIVE, label: 'Aktif' },
              { value: StudentStatus.GRADUATED, label: 'Lulus' },
              { value: StudentStatus.TRANSFERRED, label: 'Pindah' },
              { value: StudentStatus.INACTIVE, label: 'Nonaktif / Diarsipkan' },
            ]}
          />

          <Input
            label="Path / URL Foto (Opsional)"
            placeholder="students/photo.jpg"
            value={photoPath}
            onChange={(e) => setPhotoPath(e.target.value)}
          />

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={saving} disabled={!editing && classes.length === 0}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Enrollment History Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Riwayat Penempatan Kelas Siswa"
        size="md"
      >
        {loadingDetail ? (
          <p className="text-sm text-slate-500 py-4 text-center">Memuat riwayat kelas...</p>
        ) : detailData ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs space-y-1">
              <p className="font-semibold text-[#10264D] text-sm">{detailData.fullName}</p>
              <p className="font-mono text-slate-600">
                NIS: {detailData.nis} · Kelas saat ini: {formatClassName(detailData.className)}
              </p>
            </div>
            <div className="divide-y divide-slate-100 rounded-lg border border-[#E2E8F0]">
              {detailData.enrollments.length === 0 ? (
                <p className="p-4 text-xs text-slate-500 text-center">
                  Belum ada catatan riwayat penempatan kelas.
                </p>
              ) : (
                detailData.enrollments.map((enr) => (
                  <div
                    key={enr.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#10264D]">
                        {formatClassName(enr.className)} · TA {enr.academicYearLabel}
                      </p>
                      <p className="text-slate-500 tabular-nums">
                        Mulai {formatDateShortJakarta(enr.startDate)}
                        {enr.endDate ? ` s/d ${formatDateShortJakarta(enr.endDate)}` : ' — Sekarang'}
                      </p>
                    </div>
                    <StatusBadge
                      label={enr.status === 'ACTIVE' ? 'Aktif' : 'Selesai'}
                      tone={enr.status === 'ACTIVE' ? 'success' : 'neutral'}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <StudentImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadStudents}
      />

      <StudentQrModal
        student={qrTarget}
        onClose={() => setQrTarget(null)}
        onUpdated={loadStudents}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSingle}
        title="Hapus Data Siswa Permanen"
        message={`Yakin ingin menghapus permanen data siswa "${deleteTarget?.fullName ?? ''}" (NIS: ${deleteTarget?.nis ?? ''})? Riwayat kelas dan data terkait siswa ini juga akan dihapus.`}
        confirmLabel="Ya, Hapus Permanen"
        variant="danger"
        loading={deleting}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title="Hapus Permanen Siswa Terpilih"
        message={`Anda akan menghapus permanen ${selectedIds.length} data siswa terpilih beserta token QR dan riwayat kelasnya. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Permanen Semua"
        variant="danger"
        loading={deleting}
      />
    </AppShell>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { subjectCreateSchema } from '../../lib/masterDataValidation';
import { ApiClientError } from '../../services/apiClient';
import { masterDataService } from '../../services/masterDataService';
import { UserRole, type Subject } from '../../types';
import { SubjectImportModal } from './SubjectImportModal';

export function SubjectsPage() {
  useDocumentTitle('Mata Pelajaran');
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = user ? user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER : false;

  const [items, setItems] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [defaultToHomeroomTeacher, setDefaultToHomeroomTeacher] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSubjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await masterDataService.listSubjects({ search: debouncedSearch });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat mata pelajaran.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSubjects();
  }, [debouncedSearch]);

  const openCreate = () => {
    setEditing(null);
    setCode('');
    setName('');
    setDefaultToHomeroomTeacher(false);
    setIsActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: Subject) => {
    setEditing(row);
    setCode(row.code);
    setName(row.name);
    setDefaultToHomeroomTeacher(Boolean(row.defaultToHomeroomTeacher));
    setIsActive(row.isActive);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = subjectCreateSchema.safeParse({
      code,
      name,
      defaultToHomeroomTeacher,
      isActive,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Data mata pelajaran tidak valid.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await masterDataService.updateSubject(editing.id, parsed.data);
        showToast({ variant: 'success', title: 'Mata pelajaran diperbarui' });
      } else {
        await masterDataService.createSubject(parsed.data);
        showToast({ variant: 'success', title: 'Mata pelajaran ditambahkan' });
      }
      setModalOpen(false);
      await loadSubjects();
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : 'Gagal menyimpan mata pelajaran.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      const res = await masterDataService.bulkDeleteSubjects(selectedIds);
      if (res.failedIds && res.failedIds.length > 0) {
        showToast({
          variant: 'error',
          title: 'Beberapa mapel tidak dapat dihapus',
          message: res.failedIds[0]?.reason ?? 'Masih memiliki jadwal aktif.',
        });
      }
      if (res.deletedCount > 0) {
        showToast({
          variant: 'success',
          title: `${res.deletedCount} mata pelajaran berhasil dihapus`,
        });
      }
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      await loadSubjects();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menghapus mata pelajaran',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns: Array<TableColumn<Subject>> = [
    {
      key: 'code',
      header: 'Kode',
      render: (row) => <span className="font-mono text-xs font-semibold text-[#10264D]">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Nama Mata Pelajaran',
      render: (row) => <span className="font-medium text-[#10264D]">{row.name}</span>,
    },
    {
      key: 'defaultToHomeroomTeacher',
      header: 'Pengampu Default',
      render: (row) =>
        row.defaultToHomeroomTeacher ? (
          <StatusBadge label="Wali Kelas (SD/MI)" tone="gold" showIcon={false} />
        ) : (
          <StatusBadge label="Guru Mapel" tone="neutral" showIcon={false} />
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
            render: (row: Subject) => (
              <button
                type="button"
                title="Ubah Mata Pelajaran"
                aria-label={`Ubah ${row.name}`}
                onClick={() => openEdit(row)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <AppShell
      title="Mata Pelajaran"
      subtitle="Kelola daftar mata pelajaran untuk penjadwalan guru."
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
              Tambah Mapel
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
              {selectedIds.length} mata pelajaran dipilih
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
          emptyTitle="Tidak ada mata pelajaran"
          selectable={canEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          toolbar={
            <div className="max-w-md">
              <Input
                placeholder="Cari kode atau nama mata pelajaran..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftAddon={<Search className="h-4 w-4" />}
              />
            </div>
          }
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Ubah Mata Pelajaran' : 'Tambah Mata Pelajaran'}
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

          <Input
            label="Kode Mata Pelajaran"
            placeholder="Contoh: MTK, BIND, FQH"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
          <Input
            label="Nama Mata Pelajaran"
            placeholder="Contoh: Matematika"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label className="flex items-start gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#10264D] cursor-pointer">
            <input
              type="checkbox"
              checked={defaultToHomeroomTeacher}
              onChange={(e) => setDefaultToHomeroomTeacher(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#10264D] focus:ring-[#10264D]"
            />
            <span className="space-y-0.5">
              <span className="block text-xs font-semibold text-[#10264D]">
                Wali kelas adalah guru mata pelajaran (untuk jenjang SD/MI)
              </span>
              <span className="block text-[11px] text-slate-500 leading-relaxed">
                Saat menambah jadwal mengajar untuk mata pelajaran ini, sistem otomatis memilih
                wali kelas dari kelas terkait sebagai guru pengampu.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2.5 text-sm text-[#10264D] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#10264D] focus:ring-[#10264D]"
            />
            <span>Mata pelajaran aktif</span>
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
        open={bulkDeleteOpen}
        onClose={() => !deleting && setBulkDeleteOpen(false)}
        onConfirm={() => void handleBulkDelete()}
        title="Hapus Mata Pelajaran Terpilih?"
        message={`Sebanyak ${selectedIds.length} mata pelajaran terpilih akan dihapus permanen dari sistem (kecuali yang masih memiliki jadwal mengajar aktif).`}
        confirmLabel="Ya, Hapus Permanen"
        variant="danger"
        loading={deleting}
      />

      <SubjectImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadSubjects}
      />
    </AppShell>
  );
}

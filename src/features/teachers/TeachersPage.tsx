import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Archive,
  Download,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { PasswordInput } from '../../components/forms/PasswordInput';
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
import { exportRowsToExcel } from '../../lib/excel';
import { teacherCreateSchema } from '../../lib/masterDataValidation';
import { ApiClientError } from '../../services/apiClient';
import { authService } from '../../services/authService';
import { masterDataService, type EnrichedTeacher } from '../../services/masterDataService';
import { TeacherStatus, UserRole } from '../../types';
import { TeacherImportModal } from './TeacherImportModal';

export function TeachersPage() {
  useDocumentTitle('Data Guru');
  const { user } = useAuth();
  const { showToast } = useToast();

  const canEdit = user ? user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER : false;
  const canResetPassword =
    user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN;

  const [items, setItems] = useState<EnrichedTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [importOpen, setImportOpen] = useState(false);

  // Create/Edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EnrichedTeacher | null>(null);
  const [niyNip, setNiyNip] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('Guru');
  const [status, setStatus] = useState<TeacherStatus>(TeacherStatus.ACTIVE);
  const [photoPath, setPhotoPath] = useState('');
  const [createAccount, setCreateAccount] = useState(false);
  const [username, setUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Set Password modal (strictly admin-defined)
  const [resetTarget, setResetTarget] = useState<EnrichedTeacher | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Archive & Delete dialogs
  const [archiveTarget, setArchiveTarget] = useState<EnrichedTeacher | null>(null);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedTeacher | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadTeachers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await masterDataService.listTeachers({
        search: debouncedSearch,
        status: statusFilter || undefined,
        limit: 1000,
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat data guru.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedIds([]);
    void loadTeachers();
  }, [debouncedSearch, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setNiyNip('');
    setFullName('');
    setPosition('Guru');
    setStatus(TeacherStatus.ACTIVE);
    setPhotoPath('');
    setCreateAccount(true);
    setUsername('');
    setAccountPassword('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: EnrichedTeacher) => {
    setEditing(row);
    setNiyNip(row.niyNip);
    setFullName(row.fullName);
    setPosition(row.position);
    setStatus(row.status);
    setPhotoPath(row.photoPath ?? '');
    setCreateAccount(false);
    setUsername('');
    setAccountPassword('');
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = teacherCreateSchema.safeParse({
      niyNip,
      fullName,
      position,
      status,
      photoPath: photoPath.trim() || null,
      createAccount,
      username: username.trim() || undefined,
      password: createAccount ? accountPassword.trim() : undefined,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Periksa kembali isian data guru.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const res = await masterDataService.updateTeacher(editing.id, parsed.data);
        showToast({
          variant: 'success',
          title: 'Data guru diperbarui',
          message: res.accountProvisioned
            ? `Akun login "${res.accountProvisioned.username}" diaktifkan.`
            : undefined,
        });
      } else {
        const res = await masterDataService.createTeacher(parsed.data);
        showToast({
          variant: 'success',
          title: 'Data guru ditambahkan',
          message: res.accountProvisioned
            ? `Akun login "${res.accountProvisioned.username}" siap digunakan.`
            : undefined,
        });
      }
      setFormOpen(false);
      await loadTeachers();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan data guru.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetTarget?.userId) return;
    setResetError(null);
    if (resetPasswordValue.trim().length < 6) {
      setResetError('Kata sandi baru minimal 6 karakter.');
      return;
    }

    setResetting(true);
    try {
      const res = await authService.resetPassword(
        resetTarget.userId,
        resetPasswordValue.trim(),
        resetReason.trim(),
      );
      setResetTarget(null);
      setResetPasswordValue('');
      setResetReason('');
      showToast({
        variant: 'success',
        title: 'Kata sandi diperbarui',
        message: `Akun ${res.username} langsung dapat masuk menggunakan kata sandi baru.`,
      });
      await loadTeachers();
    } catch (err) {
      setResetError(err instanceof ApiClientError ? err.message : 'Gagal memperbarui kata sandi.');
    } finally {
      setResetting(false);
    }
  };

  const handleArchiveSingle = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await masterDataService.archiveTeacher(archiveTarget.id);
      showToast({ variant: 'info', title: 'Data guru diarsipkan' });
      setArchiveTarget(null);
      await loadTeachers();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengarsipkan guru',
        message: err instanceof ApiClientError ? err.message : undefined,
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    setArchiving(true);
    try {
      const res = await masterDataService.bulkArchiveTeachers(selectedIds);
      showToast({ variant: 'info', title: `${res.archivedCount} guru diarsipkan` });
      setSelectedIds([]);
      setBulkArchiveOpen(false);
      await loadTeachers();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengarsipkan data terpilih',
        message: err instanceof ApiClientError ? err.message : undefined,
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await masterDataService.deleteTeacher(deleteTarget.id);
      showToast({
        variant: 'success',
        title: 'Data guru dihapus',
        message: `${deleteTarget.fullName} telah dihapus permanen.`,
      });
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      setDeleteTarget(null);
      await loadTeachers();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menghapus data guru',
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
      const res = await masterDataService.bulkDeleteTeachers(selectedIds);
      showToast({
        variant: 'success',
        title: `${res.deletedCount} guru dihapus permanen`,
      });
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      await loadTeachers();
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
      const res = await masterDataService.listTeachers({
        search: debouncedSearch,
        status: statusFilter || undefined,
        limit: 1000,
      });

      // STRICT SECURITY: NEVER export password or passwordHash
      exportRowsToExcel(
        'data_guru_mi_miftahul_ulum.xlsx',
        'Data Guru',
        res.items.map((t) => ({
          'NIY/NIP': t.niyNip,
          'Nama Lengkap': t.fullName,
          Jabatan: t.position,
          Username: t.username ?? 'Belum ada akun',
          Status: mapStatusToBadge(t.status).label,
        })),
        ['NIY/NIP'],
      );
      showToast({
        variant: 'success',
        title: 'Ekspor Excel berhasil',
        message: `${res.items.length} data guru diunduh (tanpa kata sandi).`,
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengekspor data guru',
        message: err instanceof ApiClientError ? err.message : undefined,
      });
    }
  };

  const columns: Array<TableColumn<EnrichedTeacher>> = [
    {
      key: 'niyNip',
      header: 'NIY / NIP',
      render: (row) => <span className="font-mono text-xs text-[#10264D]">{row.niyNip}</span>,
    },
    {
      key: 'fullName',
      header: 'Nama Lengkap',
      render: (row) => <span className="font-semibold text-[#10264D]">{row.fullName}</span>,
    },
    {
      key: 'position',
      header: 'Jabatan',
      render: (row) => <span>{row.position}</span>,
    },
    {
      key: 'account',
      header: 'Akun Login',
      render: (row) =>
        row.username ? (
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-medium text-[#10264D]">{row.username}</p>
            {row.mustChangePassword && (
              <p className="text-[11px] text-[#B45309]">Wajib ganti sandi</p>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400">Belum tertaut</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const badge = mapStatusToBadge(row.status);
        return <StatusBadge label={badge.label} tone={badge.tone} />;
      },
    },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: 'Aksi',
            align: 'right' as const,
            render: (row: EnrichedTeacher) => (
              <div className="inline-flex items-center justify-end gap-1">
                {canResetPassword && row.userId && (
                  <button
                    type="button"
                    title="Atur Kata Sandi Guru"
                    aria-label={`Atur kata sandi ${row.fullName}`}
                    onClick={() => {
                      setResetTarget(row);
                      setResetPasswordValue('');
                      setResetReason('');
                      setResetError(null);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#8D6B22] hover:bg-[#FCF9F1] hover:border-[#C69B3C] transition-colors cursor-pointer"
                  >
                    <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  title="Ubah Data Guru"
                  aria-label={`Ubah ${row.fullName}`}
                  onClick={() => openEdit(row)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {row.status !== TeacherStatus.INACTIVE && (
                  <button
                    type="button"
                    title="Arsipkan Data Guru"
                    aria-label={`Arsipkan ${row.fullName}`}
                    onClick={() => setArchiveTarget(row)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#FDE68A] bg-white text-[#B45309] hover:bg-[#FFFBEB] transition-colors cursor-pointer"
                  >
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
                {row.userId !== user?.id && (
                  <button
                    type="button"
                    title="Hapus Data Guru"
                    aria-label={`Hapus ${row.fullName}`}
                    onClick={() => setDeleteTarget(row)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#FECACA] bg-white text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
      title="Data Guru"
      subtitle="Master data pendidik, tautan akun login, dan reset kata sandi aman."
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
                Tambah Guru
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
              {selectedIds.length} guru dipilih
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkArchiveOpen(true)}
                leftIcon={<Archive className="h-3.5 w-3.5" />}
              >
                Arsipkan Terpilih
              </Button>
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
          emptyTitle="Tidak ada data guru"
          emptyDescription="Belum ada data guru terdaftar atau tidak cocok dengan filter pencarian."
          emptyAction={
            canEdit ? (
              <Button
                variant="primary"
                size="sm"
                onClick={openCreate}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Tambah Guru
              </Button>
            ) : undefined
          }
          toolbar={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Input
                  placeholder="Cari nama guru, NIY/NIP, jabatan, atau username..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftAddon={<Search className="h-4 w-4" />}
                />
              </div>
              <Select
                aria-label="Filter status guru"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'Semua Status' },
                  { value: TeacherStatus.ACTIVE, label: 'Aktif' },
                  { value: TeacherStatus.INACTIVE, label: 'Nonaktif / Arsip' },
                ]}
              />
            </div>
          }
        />
      </div>

      {/* Create/Edit Teacher Modal */}
      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Ubah Data Guru' : 'Tambah Guru Baru'}
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
            label="NIY / NIP (Unik)"
            placeholder="Contoh: 20521133199001"
            value={niyNip}
            onChange={(e) => setNiyNip(e.target.value)}
            required
          />
          <Input
            label="Nama Lengkap"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Jabatan"
              placeholder="Contoh: Guru, Kepala Sekolah"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              required
            />
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TeacherStatus)}
              options={[
                { value: TeacherStatus.ACTIVE, label: 'Aktif' },
                { value: TeacherStatus.INACTIVE, label: 'Nonaktif / Arsip' },
              ]}
            />
          </div>

          <Input
            label="Path / URL Foto (Opsional)"
            value={photoPath}
            onChange={(e) => setPhotoPath(e.target.value)}
          />

          {(!editing || !editing.userId) && (
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
              <label className="flex items-center gap-2.5 text-sm font-medium text-[#10264D] cursor-pointer">
                <input
                  type="checkbox"
                  checked={createAccount}
                  onChange={(e) => setCreateAccount(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#10264D]"
                />
                <span>Buat &amp; tautkan akun login guru</span>
              </label>
              {createAccount && (
                <div className="space-y-3">
                  <Input
                    label="Username (Opsional — otomatis dari nama jika kosong)"
                    placeholder="Contoh: ahmad.fauzi"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <PasswordInput
                    label="Kata Sandi Akun Guru"
                    placeholder="Minimal 6 karakter (ditentukan oleh admin)"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Admin-Defined Password Modal */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => !resetting && setResetTarget(null)}
        title={`Atur Kata Sandi — ${resetTarget?.fullName ?? ''}`}
        description="Tentukan kata sandi baru secara langsung untuk akun guru ini. Semua sesi aktif pengguna akan dicabut."
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          {resetError && (
            <div
              role="alert"
              className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              {resetError}
            </div>
          )}

          <PasswordInput
            label="Kata Sandi Baru"
            placeholder="Minimal 6 karakter"
            value={resetPasswordValue}
            onChange={(e) => setResetPasswordValue(e.target.value)}
            required
          />

          <Input
            label="Catatan Audit (Opsional)"
            placeholder="Contoh: Penetapan ulang kata sandi oleh admin"
            value={resetReason}
            onChange={(e) => setResetReason(e.target.value)}
          />

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetting}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={resetting}>
              Simpan Kata Sandi
            </Button>
          </div>
        </form>
      </Modal>

      <TeacherImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => loadTeachers()}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchiveSingle}
        title="Arsipkan Data Guru"
        message={`Arsipkan ${archiveTarget?.fullName ?? ''}? Akun login terkait juga akan dinonaktifkan tanpa menghapus data historis.`}
        confirmLabel="Ya, Arsipkan"
        variant="danger"
        loading={archiving}
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        onClose={() => setBulkArchiveOpen(false)}
        onConfirm={handleBulkArchive}
        title="Arsipkan Guru Terpilih"
        message={`Anda akan mengarsipkan ${selectedIds.length} guru terpilih.`}
        confirmLabel="Arsipkan Semua"
        variant="danger"
        loading={archiving}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSingle}
        title="Hapus Data Guru Permanen"
        message={`Yakin ingin menghapus permanen data guru "${deleteTarget?.fullName ?? ''}"? Akun login tertaut, jadwal mengajar terkait, dan token QR guru ini juga akan dihapus.`}
        confirmLabel="Ya, Hapus Permanen"
        variant="danger"
        loading={deleting}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title="Hapus Permanen Guru Terpilih"
        message={`Anda akan menghapus permanen ${selectedIds.length} data guru terpilih beserta akun login tertaut, jadwal mengajar, dan token QR-nya. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Permanen Semua"
        variant="danger"
        loading={deleting}
      />
    </AppShell>
  );
}

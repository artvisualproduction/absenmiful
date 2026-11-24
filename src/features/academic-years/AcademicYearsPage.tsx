import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Pencil, Plus } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateShortJakarta } from '../../lib/date';
import { academicYearCreateSchema } from '../../lib/masterDataValidation';
import { ApiClientError } from '../../services/apiClient';
import { masterDataService } from '../../services/masterDataService';
import { UserRole, type AcademicYear } from '../../types';

function toDateInputValue(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

export function AcademicYearsPage() {
  useDocumentTitle('Tahun Ajaran');
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = user ? user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER : false;

  const [items, setItems] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [label, setLabel] = useState('');
  const [semester, setSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await masterDataService.listAcademicYears();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat tahun ajaran.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setLabel('');
    setSemester('Ganjil');
    setStartDate('2026-07-13');
    setEndDate('2027-06-30');
    setIsActive(false);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: AcademicYear) => {
    setEditing(row);
    setLabel(row.label);
    setSemester(row.semester === 'Genap' ? 'Genap' : 'Ganjil');
    setStartDate(toDateInputValue(row.startDate));
    setEndDate(toDateInputValue(row.endDate));
    setIsActive(row.isActive);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const check = academicYearCreateSchema.safeParse({
      label,
      semester,
      startDate,
      endDate,
      isActive,
    });
    if (!check.success) {
      setFormError(check.error.issues[0]?.message ?? 'Periksa kembali isian formulir.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await masterDataService.updateAcademicYear(editing.id, check.data);
        showToast({ variant: 'success', title: 'Tahun ajaran diperbarui' });
      } else {
        await masterDataService.createAcademicYear(check.data);
        showToast({ variant: 'success', title: 'Tahun ajaran ditambahkan' });
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan tahun ajaran.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (row: AcademicYear) => {
    try {
      await masterDataService.updateAcademicYear(row.id, { isActive: true });
      showToast({
        variant: 'success',
        title: `Tahun ajaran ${row.label} diaktifkan`,
        message: 'Tahun ajaran lainnya otomatis dinonaktifkan.',
      });
      await loadData();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengaktifkan tahun ajaran',
        message: err instanceof ApiClientError ? err.message : undefined,
      });
    }
  };

  const columns: Array<TableColumn<AcademicYear>> = [
    {
      key: 'label',
      header: 'Tahun Ajaran',
      render: (row) => (
        <span className="font-semibold text-[#10264D] tabular-nums">{row.label}</span>
      ),
    },
    {
      key: 'semester',
      header: 'Semester',
      render: (row) => <span>{row.semester ?? 'Ganjil'}</span>,
    },
    {
      key: 'period',
      header: 'Periode Berlaku',
      render: (row) => (
        <span className="text-xs text-slate-600 tabular-nums">
          {formatDateShortJakarta(row.startDate)} — {formatDateShortJakarta(row.endDate)}
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
          <StatusBadge label="Tidak Aktif" tone="neutral" />
        ),
    },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: 'Aksi',
            align: 'right' as const,
            render: (row: AcademicYear) => (
              <div className="inline-flex items-center justify-end gap-1">
                {!row.isActive && (
                  <button
                    type="button"
                    title="Jadikan Tahun Ajaran Aktif"
                    aria-label={`Aktifkan ${row.label}`}
                    onClick={() => void handleSetActive(row)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D] hover:bg-[#DCFCE7] transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  title="Ubah Tahun Ajaran"
                  aria-label={`Ubah ${row.label}`}
                  onClick={() => openEdit(row)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <AppShell
      title="Tahun Ajaran"
      subtitle="Kelola periode tahun ajaran aktif (hanya satu tahun ajaran aktif pada satu waktu)."
      actions={
        canEdit ? (
          <Button variant="primary" size="sm" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Tambah Tahun Ajaran
          </Button>
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

        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Belum ada tahun ajaran"
          emptyDescription="Tambahkan tahun ajaran pertama untuk mulai menempatkan kelas dan siswa."
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Ubah Tahun Ajaran' : 'Tambah Tahun Ajaran'}
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
            label="Label Tahun Ajaran"
            placeholder="Contoh: 2026/2027"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />

          <Select
            label="Semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value === 'Genap' ? 'Genap' : 'Ganjil')}
            options={[
              { value: 'Ganjil', label: 'Semester Ganjil' },
              { value: 'Genap', label: 'Semester Genap' },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Tanggal Mulai"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="Tanggal Selesai"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-[#10264D] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#10264D] focus:ring-[#10264D]"
            />
            <span>Tetapkan sebagai tahun ajaran aktif</span>
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
    </AppShell>
  );
}

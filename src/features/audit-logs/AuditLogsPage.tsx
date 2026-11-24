import { useCallback, useEffect, useState } from 'react';
import { Eye, Lock, ShieldCheck } from 'lucide-react';
import { getRoleLabelIndonesian } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTimeJakarta } from '../../lib/date';
import { adminService, type AuditLogRow } from '../../services/adminService';
import { ApiClientError } from '../../services/apiClient';

export function AuditLogsPage() {
  useDocumentTitle('Log Aktivitas');
  const { showToast } = useToast();

  const [items, setItems] = useState<AuditLogRow[]>([]);
  const [scope, setScope] = useState<'FULL_ADMIN' | 'LIMITED_PRINCIPAL'>('FULL_ADMIN');
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [actors, setActors] = useState<Array<{ id: string; label: string }>>([]);

  const [actorUserId, setActorUserId] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [detailRow, setDetailRow] = useState<AuditLogRow | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.listAuditLogs({
        actorUserId,
        action: actionFilter,
        dateFrom,
        dateTo,
        search,
        limit: 2000,
      });
      setItems(res.items);
      setAvailableActions(res.availableActions);
      setActors(res.actors);
      setScope(res.scope);
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal memuat log aktivitas',
        message: err instanceof ApiClientError ? err.message : 'Silakan coba beberapa saat lagi.',
      });
    } finally {
      setLoading(false);
    }
  }, [actorUserId, actionFilter, dateFrom, dateTo, search, showToast]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const columns: Array<TableColumn<AuditLogRow>> = [
    {
      key: 'time',
      header: 'Waktu',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
          {formatDateTimeJakarta(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Aktor',
      render: (row) => (
        <div>
          <p className="text-xs font-semibold text-[#10264D]">{row.actorName}</p>
          <p className="text-[11px] text-slate-500">{getRoleLabelIndonesian(row.actorRole)}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Aksi',
      render: (row) => (
        <span className="inline-block rounded bg-[#F2F5FA] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#10264D]">
          {row.action}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Entitas',
      render: (row) => (
        <div className="text-xs">
          <span className="font-medium text-slate-700">{row.entityType}</span>
          <span className="block font-mono text-[11px] text-slate-500 truncate max-w-[160px]">
            {row.entityId}
          </span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Catatan / Alasan',
      render: (row) => (
        <span className="text-xs text-slate-600 line-clamp-2 max-w-[260px]">
          {row.reason || '—'}
        </span>
      ),
    },
    {
      key: 'detail',
      header: 'Aksi',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          title="Lihat Detail Log"
          aria-label={`Lihat detail ${row.action}`}
          onClick={() => setDetailRow(row)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <AppShell
      title="Log Aktivitas"
      subtitle="Rekam jejak audit sistem bersifat append-only (hanya tambah, tidak dapat diubah atau dihapus lewat API)."
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-700">
            <Lock className="h-4 w-4 text-[#10264D] shrink-0" aria-hidden="true" />
            <span>
              Data sensitif seperti hash kata sandi, token sesi, dan token QR disaring otomatis dari
              snapshot <code className="font-mono">before/after</code>.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge label="Append-Only" tone="info" />
            <StatusBadge
              label={
                scope === 'FULL_ADMIN'
                  ? 'Cakupan Admin Penuh'
                  : 'Cakupan Tata Kelola Kepala Sekolah'
              }
              tone={scope === 'FULL_ADMIN' ? 'gold' : 'neutral'}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Belum ada catatan audit"
          emptyDescription="Aktivitas login, perubahan master data, koreksi absensi, perizinan, dan ekspor akan terekam di sini."
          toolbar={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input
                placeholder="Cari aksi, entitas, alasan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                value={actorUserId}
                onChange={(e) => setActorUserId(e.target.value)}
                options={[
                  { value: '', label: 'Semua Aktor' },
                  ...actors.map((a) => ({ value: a.id, label: a.label })),
                ]}
              />
              <Select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                options={[
                  { value: '', label: 'Semua Aksi' },
                  ...availableActions.map((act) => ({ value: act, label: act })),
                ]}
              />
              <Input
                type="date"
                aria-label="Dari tanggal"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <Input
                type="date"
                aria-label="Sampai tanggal"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          }
        />
      </div>

      {/* Audit Detail Modal */}
      <Modal
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        title={`Detail Audit — ${detailRow?.action ?? ''}`}
        description={
          detailRow
            ? `${detailRow.actorName} (${getRoleLabelIndonesian(detailRow.actorRole)}) · ${formatDateTimeJakarta(
                detailRow.createdAt,
              )}`
            : undefined
        }
        size="lg"
      >
        {detailRow && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div>
                <p className="text-slate-500 font-semibold">Entitas</p>
                <p className="font-mono font-bold text-[#10264D]">
                  {detailRow.entityType} / {detailRow.entityId}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">Alasan</p>
                <p className="text-[#10264D]">{detailRow.reason || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                  Snapshot Sebelum (Before)
                </p>
                <pre className="rounded-lg border border-[#E2E8F0] bg-[#0F172A] text-slate-100 p-3 font-mono text-[11px] overflow-x-auto max-h-60">
                  {detailRow.before ? JSON.stringify(detailRow.before, null, 2) : 'null'}
                </pre>
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#C69B3C]" />
                  Snapshot Sesudah (After)
                </p>
                <pre className="rounded-lg border border-[#E2E8F0] bg-[#0F172A] text-slate-100 p-3 font-mono text-[11px] overflow-x-auto max-h-60">
                  {detailRow.after ? JSON.stringify(detailRow.after, null, 2) : 'null'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

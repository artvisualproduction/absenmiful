import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { downloadHolidayTemplate, parseExcelFileAsTextRows, pickRowField } from '../../lib/excel';
import { ApiClientError } from '../../services/apiClient';
import { scheduleRulesService } from '../../services/scheduleRulesService';

export interface HolidayImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

export function HolidayImportModal({ open, onClose, onImported }: HolidayImportModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Array<Record<string, unknown>>>([]);
  const [preview, setPreview] = useState<{
    total: number;
    validCount: number;
    invalidCount: number;
    rows: Array<{
      rowNumber: number;
      date: string;
      name: string;
      scope: string;
      scopeLabel: string;
      isActive: boolean;
      valid: boolean;
      errors: string[];
    }>;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setFileName(null);
    setRawRows([]);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (committing || loadingPreview) return;
    resetState();
    onClose();
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setPreview(null);
    setFileName(file.name);
    setLoadingPreview(true);

    try {
      const parsed = await parseExcelFileAsTextRows(file);
      if (parsed.length === 0) {
        setError('Berkas Excel tidak memiliki baris data.');
        return;
      }

      const mapped = parsed.map((row) => ({
        date: pickRowField(row, ['tanggal', 'tgl', 'date', 'waktu']),
        name: pickRowField(row, ['namaharilibur', 'nama', 'namalibur', 'keterangan', 'name']),
        scope: pickRowField(row, ['cakupan', 'lingkup', 'sasaran', 'scope', 'untuk']),
        isActive: pickRowField(row, ['statusaktif', 'status', 'isactive', 'aktif']),
      }));

      setRawRows(mapped);
      const previewRes = await scheduleRulesService.previewHolidaysImport(mapped);
      setPreview(previewRes);
    } catch (err) {
      setError(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : 'Gagal membaca berkas Excel.',
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    if (!preview || preview.validCount === 0) return;
    setCommitting(true);
    setError(null);

    try {
      const res = await scheduleRulesService.commitHolidaysImport(rawRows);
      showToast({
        variant: 'success',
        title: 'Impor hari libur berhasil',
        message: `${res.importedCount} tanggal hari libur berhasil ditambahkan ke kalender sekolah.`,
      });
      await onImported();
      handleClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : 'Gagal menyimpan hari libur.',
      );
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Impor Hari Libur dari Excel"
      description="Unggah berkas .xlsx atau .csv berisi daftar tanggal hari libur nasional atau libur khusus madrasah."
      size="xl"
    >
      <div className="space-y-5">
        {/* Template Download & Instructions */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-[#10264D]">Gunakan Format Kolom Standar</p>
            <p className="text-xs text-slate-500">
              Kolom wajib:{' '}
              <span className="font-mono font-medium text-[#10264D]">tanggal</span> (YYYY-MM-DD atau DD/MM/YYYY),{' '}
              <span className="font-mono font-medium text-[#10264D]">namaHariLibur</span>, dan{' '}
              <span className="font-mono font-medium text-[#10264D]">cakupan</span> (SEMUA / GURU / SISWA).
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadHolidayTemplate}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            Unduh Format Excel
          </Button>
        </div>

        {/* File Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFileChange(file);
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#FAFAFA] p-6 text-center transition-colors hover:border-[#10264D] hover:bg-[#F8FAFC]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void handleFileChange(file);
            }}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#10264D]/5 text-[#10264D] mb-2">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-[#10264D]">
            {fileName ?? 'Klik untuk memilih berkas Excel atau seret ke sini'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Mendukung format .xlsx, .xls, dan .csv</p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#B91C1C]"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview Summary */}
        {loadingPreview && (
          <div className="py-8 text-center text-xs text-slate-500">
            Sedang membaca dan memvalidasi berkas hari libur...
          </div>
        )}

        {preview && !loadingPreview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-center">
                <p className="text-xs text-slate-500">Total Baris</p>
                <p className="font-mono text-lg font-bold text-[#10264D]">{preview.total}</p>
              </div>
              <div className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-center">
                <p className="text-xs text-[#15803D]">Siap Disimpan</p>
                <p className="font-mono text-lg font-bold text-[#15803D]">{preview.validCount}</p>
              </div>
              <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-center">
                <p className="text-xs text-[#B91C1C]">Perlu Perbaikan</p>
                <p className="font-mono text-lg font-bold text-[#B91C1C]">{preview.invalidCount}</p>
              </div>
            </div>

            {/* Preview Table */}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#F8FAFC] text-[11px] font-semibold text-slate-600 border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2 text-center w-12">No</th>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Nama Hari Libur</th>
                    <th className="px-3 py-2">Cakupan</th>
                    <th className="px-3 py-2 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {preview.rows.map((r) => (
                    <tr key={r.rowNumber} className={r.valid ? 'hover:bg-[#F8FAFC]' : 'bg-[#FEF2F2]/40'}>
                      <td className="px-3 py-2 text-center font-mono text-slate-500">{r.rowNumber}</td>
                      <td className="px-3 py-2 font-mono font-medium text-[#10264D]">{r.date}</td>
                      <td className="px-3 py-2 font-semibold text-[#10264D]">
                        {r.name}
                        {r.errors.length > 0 && (
                          <p className="text-[11px] font-normal text-[#B91C1C] mt-0.5">
                            {r.errors.join(' · ')}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{r.scopeLabel}</td>
                      <td className="px-3 py-2 text-center">
                        {r.valid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#15803D]">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#B91C1C]">
                            <XCircle className="h-3.5 w-3.5" /> Gagal
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
          <Button variant="outline" onClick={handleClose} disabled={committing || loadingPreview}>
            Batal
          </Button>
          <Button
            variant="primary"
            disabled={!preview || preview.validCount === 0 || committing}
            loading={committing}
            onClick={() => void handleCommit()}
            leftIcon={<Upload className="h-4 w-4" />}
          >
            {preview ? `Simpan ${preview.validCount} Hari Libur` : 'Simpan Hari Libur'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

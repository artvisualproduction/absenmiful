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
import { downloadClassTemplate, parseExcelFileAsTextRows, pickRowField } from '../../lib/excel';
import { ApiClientError } from '../../services/apiClient';
import { masterDataService } from '../../services/masterDataService';

export interface ClassImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

export function ClassImportModal({ open, onClose, onImported }: ClassImportModalProps) {
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
      name: string;
      gradeLevel: string;
      academicYearLabel: string;
      homeroomTeacherName: string;
      capacity: number;
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
        setError('Berkas tidak memiliki baris data.');
        return;
      }

      const mapped = parsed.map((row) => ({
        name: pickRowField(row, ['namakelas', 'kelas', 'name']),
        gradeLevel: pickRowField(row, ['tingkat', 'kelaslevel', 'gradelevel', 'grade']),
        academicYearLabel: pickRowField(row, ['tahunajaran', 'ajaran', 'academicyear', 'tahun']),
        homeroomTeacherName: pickRowField(row, ['walikelas', 'gurukelas', 'teacher', 'homeroom']),
        capacity: pickRowField(row, ['kapasitas', 'kapasitassiswa', 'capacity']) || '30',
        isActive: pickRowField(row, ['statusaktif', 'isactive', 'aktif', 'status']) || undefined,
      }));

      setRawRows(mapped);
      const previewRes = await masterDataService.previewClassesImport(mapped);
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
    if (!preview || preview.invalidCount > 0 || rawRows.length === 0) return;
    setCommitting(true);
    setError(null);
    try {
      const res = await masterDataService.commitClassesImport(rawRows);
      showToast({
        variant: 'success',
        title: 'Impor data kelas berhasil',
        message: `${res.importedCount} kelas baru telah ditambahkan.`,
      });
      await onImported();
      resetState();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan data impor.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Impor Data Kelas dari Excel"
      description="Unggah berkas .xlsx atau .csv berisi daftar kelas / rombongan belajar."
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={committing}>
            Batal
          </Button>
          <Button
            variant="primary"
            disabled={!preview || preview.invalidCount > 0 || preview.validCount === 0}
            loading={committing}
            onClick={() => void handleCommit()}
          >
            Konfirmasi &amp; Simpan ({preview?.validCount ?? 0} Kelas)
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-[#10264D] shrink-0" aria-hidden="true" />
            <div className="text-xs text-slate-600">
              <p className="font-semibold text-[#10264D]">Format Kolom Excel</p>
              <p>
                Wajib: <span className="font-mono">namaKelas</span>, <span className="font-mono">tingkat</span> (1–6)
                · Opsional: <span className="font-mono">tahunAjaran</span>, <span className="font-mono">waliKelas</span>, <span className="font-mono">kapasitas</span>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadClassTemplate}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            Unduh Template .xlsx
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] p-6 text-center space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="secondary"
            loading={loadingPreview}
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Upload className="h-4 w-4" />}
          >
            {fileName ? 'Pilih Berkas Lain' : 'Pilih Berkas Excel (.xlsx / .csv)'}
          </Button>
          {fileName && (
            <p className="text-xs text-slate-600">
              Berkas terpilih: <span className="font-semibold text-[#10264D]">{fileName}</span>
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#B91C1C]"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#10264D]">
                Pratinjau Validasi ({preview.total} baris)
              </p>
              <div className="flex items-center gap-2">
                <StatusBadge label={`Valid: ${preview.validCount}`} tone="success" />
                {preview.invalidCount > 0 && (
                  <StatusBadge label={`Bermasalah: ${preview.invalidCount}`} tone="danger" />
                )}
              </div>
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-[#E2E8F0]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E2E8F0] text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Baris</th>
                    <th className="px-3 py-2">Nama Kelas</th>
                    <th className="px-3 py-2">Tingkat</th>
                    <th className="px-3 py-2">Tahun Ajaran</th>
                    <th className="px-3 py-2">Wali Kelas</th>
                    <th className="px-3 py-2">Kapasitas</th>
                    <th className="px-3 py-2">Hasil Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((r) => (
                    <tr key={r.rowNumber} className={r.valid ? 'bg-white' : 'bg-[#FEF2F2]/60'}>
                      <td className="px-3 py-2 font-mono tabular-nums">{r.rowNumber}</td>
                      <td className="px-3 py-2 font-semibold text-[#10264D]">Kelas {r.name || '-'}</td>
                      <td className="px-3 py-2 tabular-nums">Tingkat {r.gradeLevel || '-'}</td>
                      <td className="px-3 py-2">{r.academicYearLabel}</td>
                      <td className="px-3 py-2">{r.homeroomTeacherName}</td>
                      <td className="px-3 py-2 tabular-nums">{r.capacity}</td>
                      <td className="px-3 py-2">
                        {r.valid ? (
                          <span className="inline-flex items-center gap-1 text-[#15803D] font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Siap disimpan
                          </span>
                        ) : (
                          <ul className="space-y-0.5 text-[#B91C1C]">
                            {r.errors.map((errMsg, idx) => (
                              <li key={idx} className="inline-flex items-start gap-1">
                                <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                                <span>{errMsg}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

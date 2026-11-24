import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  XCircle,
} from 'lucide-react';
import { Input } from '../../components/forms/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { getDateKeyJakarta } from '../../lib/date';
import {
  downloadScheduleTemplate,
  parseExcelFileAsTextRows,
  pickRowField,
} from '../../lib/excel';
import { ApiClientError } from '../../services/apiClient';
import {
  scheduleRulesService,
  type ScheduleImportPreviewResponse,
  type ScheduleImportRowInput,
} from '../../services/scheduleRulesService';

export interface ScheduleImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

export function ScheduleImportModal({ open, onClose, onImported }: ScheduleImportModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(() => getDateKeyJakarta());
  const [rawRows, setRawRows] = useState<ScheduleImportRowInput[]>([]);
  const [preview, setPreview] = useState<ScheduleImportPreviewResponse | null>(null);
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

  const runPreview = async (rows: ScheduleImportRowInput[], dateKey: string) => {
    const effectiveIso = dateKey ? `${dateKey}T00:00:00+07:00` : undefined;
    const previewRes = await scheduleRulesService.previewSchedulesImport(rows, effectiveIso);
    setPreview(previewRes);
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

      const mapped: ScheduleImportRowInput[] = parsed.map((row) => ({
        className: pickRowField(row, ['kelas', 'classname', 'rombel']),
        subjectCodeOrName: pickRowField(row, [
          'mapel',
          'matapelajaran',
          'subject',
          'subjectcodeorname',
          'kodemapel',
        ]),
        dayOfWeek: pickRowField(row, ['hari', 'dayofweek', 'harimengajar']),
        startTime: pickRowField(row, ['jammulai', 'starttime', 'mulai']),
        endTime: pickRowField(row, ['jamselesai', 'endtime', 'selesai']),
        teacherNiyOrName:
          pickRowField(row, ['guru', 'gurupengampu', 'teacherniyorname', 'niy', 'nip']) ||
          undefined,
        useHomeroomTeacher:
          pickRowField(row, [
            'gunakanwalikelas',
            'usehomeroomteacher',
            'walikelas',
            'walikelasmapel',
          ]) || undefined,
        room: pickRowField(row, ['ruang', 'room', 'ruangan']) || undefined,
        isActive:
          pickRowField(row, ['statusaktif', 'isactive', 'aktif', 'status']) || undefined,
      }));

      setRawRows(mapped);
      await runPreview(mapped, effectiveDate);
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
      const effectiveIso = effectiveDate ? `${effectiveDate}T00:00:00+07:00` : undefined;
      const res = await scheduleRulesService.commitSchedulesImport(rawRows, effectiveIso);
      showToast({
        variant: 'success',
        title: 'Impor jadwal mengajar berhasil',
        message: `${res.importedCount} jadwal mengajar baru telah disimpan.`,
      });
      await onImported();
      resetState();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan jadwal impor.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Impor Jadwal Mengajar dari Excel"
      description="Unggah berkas .xlsx atau .csv. Bentrok jadwal guru maupun kelas otomatis diperiksa, dan kolom gunakanWaliKelas = YA akan memakai wali kelas secara otomatis."
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
            Konfirmasi &amp; Simpan ({preview?.validCount ?? 0} Jadwal)
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <FileSpreadsheet className="h-5 w-5 text-[#10264D] shrink-0" aria-hidden="true" />
            <div className="text-xs text-slate-600 space-y-0.5">
              <p className="font-semibold text-[#10264D]">Format Kolom Excel</p>
              <p>
                Wajib: <span className="font-mono">kelas</span>,{' '}
                <span className="font-mono">mapel</span> (kode/nama),{' '}
                <span className="font-mono">hari</span> (Senin–Sabtu),{' '}
                <span className="font-mono">jamMulai</span>,{' '}
                <span className="font-mono">jamSelesai</span>,{' '}
                <span className="font-mono">guru</span> (NIY/nama) atau{' '}
                <span className="font-mono">gunakanWaliKelas</span> (YA/TIDAK).
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadScheduleTemplate}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            Unduh Template .xlsx
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <Input
            label="Tanggal Mulai Berlaku Jadwal"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            helperText="Berlaku untuk semua jadwal hasil impor ini."
          />

          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] p-4 text-center space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="secondary"
              size="sm"
              loading={loadingPreview}
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<Upload className="h-4 w-4" />}
            >
              {fileName ? 'Pilih Berkas Lain' : 'Pilih Berkas Excel (.xlsx / .csv)'}
            </Button>
            {fileName && (
              <p className="text-xs text-slate-600 truncate max-w-full">
                Terpilih: <span className="font-semibold text-[#10264D]">{fileName}</span>
              </p>
            )}
          </div>
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

            {preview.invalidCount > 0 && (
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#92400E]">
                Perbaiki seluruh baris yang bermasalah pada berkas Excel lalu unggah ulang sebelum
                menyimpan.
              </div>
            )}

            <div className="max-h-72 overflow-auto rounded-lg border border-[#E2E8F0]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E2E8F0] text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Baris</th>
                    <th className="px-3 py-2">Kelas</th>
                    <th className="px-3 py-2">Hari &amp; Jam</th>
                    <th className="px-3 py-2">Mata Pelajaran</th>
                    <th className="px-3 py-2">Guru Pengampu</th>
                    <th className="px-3 py-2">Hasil Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((r) => (
                    <tr key={r.rowNumber} className={r.valid ? 'bg-white' : 'bg-[#FEF2F2]/60'}>
                      <td className="px-3 py-2 font-mono tabular-nums">{r.rowNumber}</td>
                      <td className="px-3 py-2 font-semibold text-[#10264D]">
                        {r.className || '-'}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                        {r.dayLabel}, {r.startTime || '--:--'}–{r.endTime || '--:--'}
                      </td>
                      <td className="px-3 py-2 font-medium text-[#10264D]">
                        {r.subjectLabel || '-'}
                      </td>
                      <td className="px-3 py-2">
                        <span>{r.teacherName || '-'}</span>
                        {r.useHomeroomTeacher && (
                          <span className="block text-[10px] text-[#8D6B22] font-medium">
                            Otomatis Wali Kelas
                          </span>
                        )}
                      </td>
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

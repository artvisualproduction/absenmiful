import { useEffect, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Grid3X3,
  Printer,
  Search,
  Users,
  UserX,
} from 'lucide-react';
import { AttendanceTrendChart } from '../../components/charts/AttendanceTrendChart';
import { Input } from '../../components/forms/Input';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cn } from '../../lib/cn';
import { formatDateTimeJakarta, getDateKeyJakarta } from '../../lib/date';
import { exportRowsToExcel } from '../../lib/excel';
import {
  downloadReportPdf,
  downloadReportXlsx,
  triggerPrintReport,
} from '../../lib/reportExport';
import type { ReportDimension, ReportPeriod } from '../../lib/reportValidation';
import { ApiClientError } from '../../services/apiClient';
import { masterDataService, type EnrichedClass } from '../../services/masterDataService';
import {
  reportService,
  type AttendanceMatrixResponse,
  type AttendanceReportPersonRow,
  type AttendanceReportResponse,
  type ClassRecapRow,
  type MatrixCellCode,
} from '../../services/reportService';
import { AttendanceStatus } from '../../types';

const MATRIX_CELL_STYLES: Record<MatrixCellCode, string> = {
  H: 'bg-[#ECFDF5] text-[#15803D] font-bold',
  T: 'bg-[#FFFBEB] text-[#B45309] font-bold',
  S: 'bg-[#EFF6FF] text-[#1D4ED8] font-bold',
  I: 'bg-[#EEF2FF] text-[#4338CA] font-bold',
  A: 'bg-[#FEF2F2] text-[#B91C1C] font-bold',
  HLT: 'bg-[#F0FDFA] text-[#0F766E] font-bold text-[10px]',
  L: 'bg-[#F1F5F9] text-slate-400 font-medium',
  '-': 'bg-white text-slate-300',
};

const MATRIX_CODE_LABELS: Record<MatrixCellCode, string> = {
  H: 'Hadir',
  T: 'Terlambat',
  S: 'Sakit',
  I: 'Izin',
  A: 'Alfa',
  HLT: 'Hari Libur Tertentu',
  L: 'Libur / Minggu',
  '-': 'Belum berlangsung',
};

export interface ReportsPageProps {
  defaultDimension?: ReportDimension;
  titleOverride?: string;
  subtitleOverride?: string;
}

export function ReportsPage({
  defaultDimension = 'STUDENT',
  titleOverride,
  subtitleOverride,
}: ReportsPageProps) {
  const pageTitle = titleOverride ?? 'Rekap & Laporan Kehadiran';
  useDocumentTitle(pageTitle);
  const { showToast } = useToast();

  const today = getDateKeyJakarta();
  const [viewMode, setViewMode] = useState<'summary' | 'matrix'>('summary');

  // Shared filter state
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [referenceDate, setReferenceDate] = useState(today);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [dimension, setDimension] = useState<ReportDimension>(defaultDimension);
  const [classId, setClassId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  // Matrix-specific period state ('weekly' | 'monthly' | 'custom')
  const [matrixPeriod, setMatrixPeriod] = useState<'weekly' | 'monthly' | 'custom'>('weekly');
  const [matrixRefDate, setMatrixRefDate] = useState(today);
  const [matrixFrom, setMatrixFrom] = useState(today);
  const [matrixTo, setMatrixTo] = useState(today);
  const [matrixDimension, setMatrixDimension] = useState<'STUDENT' | 'TEACHER'>(
    defaultDimension === 'TEACHER' ? 'TEACHER' : 'STUDENT',
  );
  const [matrixData, setMatrixData] = useState<AttendanceMatrixResponse | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const [classes, setClasses] = useState<EnrichedClass[]>([]);
  const [report, setReport] = useState<AttendanceReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'XLSX' | 'PDF' | 'PRINT' | null>(null);

  useEffect(() => {
    setDimension(defaultDimension);
    setMatrixDimension(defaultDimension === 'TEACHER' ? 'TEACHER' : 'STUDENT');
    if (defaultDimension === 'TEACHER') {
      setClassId('');
    }
  }, [defaultDimension]);

  useEffect(() => {
    void masterDataService
      .listClasses({ isActive: 'true' })
      .then((res) => setClasses(res.items))
      .catch(() => undefined);
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportService.getAttendanceReport({
        period,
        referenceDate: period === 'custom' ? undefined : referenceDate,
        dateFrom: period === 'custom' ? dateFrom : undefined,
        dateTo: period === 'custom' ? dateTo : undefined,
        dimension,
        classId: dimension === 'TEACHER' ? undefined : classId || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        limit: 2000,
      });
      setReport(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat laporan kehadiran.');
    } finally {
      setLoading(false);
    }
  };

  const loadMatrix = async () => {
    setMatrixLoading(true);
    setMatrixError(null);
    try {
      const res = await reportService.getAttendanceMatrix({
        period: matrixPeriod,
        referenceDate: matrixPeriod === 'custom' ? undefined : matrixRefDate,
        dateFrom: matrixPeriod === 'custom' ? matrixFrom : undefined,
        dateTo: matrixPeriod === 'custom' ? matrixTo : undefined,
        dimension: matrixDimension,
        classId: matrixDimension === 'TEACHER' ? undefined : classId || undefined,
        search: debouncedSearch || undefined,
      });
      setMatrixData(res);
    } catch (err) {
      setMatrixError(
        err instanceof ApiClientError ? err.message : 'Gagal memuat rekap matriks kehadiran.',
      );
    } finally {
      setMatrixLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode !== 'summary') return;
    void loadReport();
  }, [viewMode, period, referenceDate, dateFrom, dateTo, dimension, classId, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (viewMode !== 'matrix') return;
    void loadMatrix();
  }, [viewMode, matrixPeriod, matrixRefDate, matrixFrom, matrixTo, matrixDimension, classId, debouncedSearch]);

  const handleExport = async (format: 'XLSX' | 'PDF' | 'PRINT') => {
    setExportingFormat(format);
    try {
      const exported = await reportService.exportAttendanceReport({
        format,
        period,
        referenceDate: period === 'custom' ? undefined : referenceDate,
        dateFrom: period === 'custom' ? dateFrom : undefined,
        dateTo: period === 'custom' ? dateTo : undefined,
        dimension,
        classId: dimension === 'TEACHER' ? undefined : classId || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
      });

      if (format === 'XLSX') {
        downloadReportXlsx(exported);
        showToast({ variant: 'success', title: 'Laporan XLSX berhasil diunduh' });
      } else if (format === 'PDF') {
        downloadReportPdf(exported);
        showToast({ variant: 'success', title: 'Laporan PDF berhasil diunduh' });
      } else {
        triggerPrintReport();
      }
    } catch (err) {
      showToast({
        variant: 'error',
        title: `Gagal mengekspor ${format}`,
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan saat ekspor.',
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportMatrixExcel = () => {
    if (!matrixData || matrixData.rows.length === 0) {
      showToast({ variant: 'warning', title: 'Tidak ada data matriks untuk diekspor' });
      return;
    }

    const rows = matrixData.rows.map((row, idx) => {
      const entry: Record<string, string | number> = {
        No: idx + 1,
        [matrixData.dimension === 'STUDENT' ? 'NIS' : 'NIY/NIP']: row.identifier,
        'Nama Lengkap': row.fullName,
        [matrixData.dimension === 'STUDENT' ? 'Kelas' : 'Jabatan']: row.groupLabel,
      };
      for (const d of matrixData.dates) {
        entry[`${d.dayNum}/${d.date.slice(5, 7)} (${d.dayLabel})`] = row.cells[d.date] ?? '-';
      }
      entry.Hadir = row.summary.present;
      entry.Terlambat = row.summary.late;
      entry.Sakit = row.summary.sick;
      entry.Izin = row.summary.excused;
      entry.Alfa = row.summary.absent;
      if (matrixData.dimension === 'TEACHER') {
        entry.HLT = row.summary.hlt ?? 0;
      }
      entry['Kehadiran (%)'] = `${row.summary.ratePercent}%`;
      return entry;
    });

    exportRowsToExcel(
      `rekap-matriks-${matrixData.dimension.toLowerCase()}-${matrixData.dateFrom}_sd_${matrixData.dateTo}.xlsx`,
      'Rekap Matriks',
      rows,
      [matrixData.dimension === 'STUDENT' ? 'NIS' : 'NIY/NIP'],
    );
    showToast({ variant: 'success', title: 'Rekap Matriks XLSX berhasil diunduh' });
  };

  const personColumns: Array<TableColumn<AttendanceReportPersonRow>> = [
    {
      key: 'person',
      header: dimension === 'TEACHER' ? 'Nama Guru' : 'Nama Lengkap',
      render: (row) => (
        <div>
          <p className="font-semibold text-[#10264D]">{row.fullName}</p>
          <p className="font-mono text-xs text-slate-500">
            {row.identifier}
            {row.className ? ` · ${row.className}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'workingDays',
      header: 'Hari Kerja',
      align: 'right',
      render: (row) => <span className="font-mono text-xs tabular-nums">{row.workingDays}</span>,
    },
    {
      key: 'present',
      header: 'Hadir',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#15803D] tabular-nums">
          {row.present}
        </span>
      ),
    },
    {
      key: 'late',
      header: 'Terlambat',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#B45309] tabular-nums">
          {row.late}
        </span>
      ),
    },
    {
      key: 'sickExcused',
      header: 'Sakit / Izin',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#1D4ED8] tabular-nums">
          {row.sick} / {row.excused}
        </span>
      ),
    },
    {
      key: 'absent',
      header: 'Alfa',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#B91C1C] tabular-nums">
          {row.absent}
        </span>
      ),
    },
    ...(dimension !== 'STUDENT'
      ? [
          {
            key: 'hlt',
            header: 'HLT',
            align: 'right' as const,
            render: (row: AttendanceReportPersonRow) => (
              <span className="font-mono text-xs font-semibold text-[#0F766E] tabular-nums">
                {row.hlt ?? 0}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'missing',
      header: 'Blm Masuk / Pulang',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 tabular-nums">
          {row.missingCheckIn} / {row.missingCheckOut}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Kehadiran',
      align: 'right',
      render: (row) => (
        <StatusBadge
          label={`${row.attendanceRate}%`}
          tone={
            row.attendanceRate >= 90
              ? 'success'
              : row.attendanceRate >= 75
                ? 'warning'
                : 'danger'
          }
          showIcon={false}
        />
      ),
    },
  ];

  const classColumns: Array<TableColumn<ClassRecapRow>> = [
    {
      key: 'className',
      header: 'Kelas',
      render: (row) => <span className="font-semibold text-[#10264D]">Kelas {row.className}</span>,
    },
    {
      key: 'totalStudents',
      header: 'Siswa Aktif',
      align: 'right',
      render: (row) => <span className="font-mono text-xs tabular-nums">{row.totalStudents}</span>,
    },
    {
      key: 'present',
      header: 'Hadir',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#15803D] tabular-nums">
          {row.present}
        </span>
      ),
    },
    {
      key: 'late',
      header: 'Terlambat',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#B45309] tabular-nums">
          {row.late}
        </span>
      ),
    },
    {
      key: 'excusedSick',
      header: 'Izin / Sakit',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#1D4ED8] tabular-nums">
          {row.excusedSick}
        </span>
      ),
    },
    {
      key: 'absent',
      header: 'Alfa',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#B91C1C] tabular-nums">
          {row.absent}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Tingkat Hadir',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#10264D] tabular-nums">
          {row.attendanceRate}%
        </span>
      ),
    },
  ];

  return (
    <AppShell
      title={pageTitle}
      subtitle={
        subtitleOverride ??
        'Rekap ringkasan, grafik tren, serta Rekap Matriks harian per minggu, bulan, atau rentang tanggal tertentu.'
      }
      actions={
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {viewMode === 'summary' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                loading={exportingFormat === 'XLSX'}
                onClick={() => void handleExport('XLSX')}
                leftIcon={<FileSpreadsheet className="h-4 w-4 text-[#15803D]" />}
              >
                Ekspor XLSX
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={exportingFormat === 'PDF'}
                onClick={() => void handleExport('PDF')}
                leftIcon={<FileText className="h-4 w-4" />}
              >
                Ekspor PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={exportingFormat === 'PRINT'}
                onClick={() => void handleExport('PRINT')}
                leftIcon={<Printer className="h-4 w-4" />}
              >
                Cetak
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMatrixExcel}
                leftIcon={<FileSpreadsheet className="h-4 w-4 text-[#15803D]" />}
              >
                Ekspor Matriks XLSX
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => triggerPrintReport()}
                leftIcon={<Printer className="h-4 w-4" />}
              >
                Cetak Matriks
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* View Mode Switcher: Ringkasan vs Rekap Matriks */}
        <div
          role="tablist"
          aria-label="Mode tampilan laporan"
          className="inline-flex rounded-xl border border-[#E2E8F0] bg-white p-1 gap-1 print:hidden"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'summary'}
            onClick={() => setViewMode('summary')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap',
              viewMode === 'summary'
                ? 'bg-[#10264D] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#10264D] hover:bg-[#F8FAFC]',
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Rekap Ringkasan &amp; Grafik
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'matrix'}
            onClick={() => setViewMode('matrix')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap',
              viewMode === 'matrix'
                ? 'bg-[#10264D] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#10264D] hover:bg-[#F8FAFC]',
            )}
          >
            <Grid3X3 className="h-4 w-4" />
            Rekap Matriks Harian
          </button>
        </div>

        {/* ===================== MODE 1: SUMMARY & CHART ===================== */}
        {viewMode === 'summary' && (
          <>
            {/* Filter Bar: Guru/Siswa -> Periode -> Tanggal Acuan -> Kelas -> Status (tanpa nomor) */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 space-y-3 print:hidden">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Select
                  label="Guru / Siswa"
                  value={dimension}
                  onChange={(e) => {
                    const next = e.target.value as ReportDimension;
                    setDimension(next);
                    if (next === 'TEACHER') setClassId('');
                  }}
                  options={[
                    { value: 'STUDENT', label: 'Siswa' },
                    { value: 'TEACHER', label: 'Guru' },
                    { value: 'ALL', label: 'Siswa & Guru' },
                  ]}
                />

                <Select
                  label="Periode"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
                  options={[
                    { value: 'daily', label: 'Harian' },
                    { value: 'weekly', label: 'Mingguan' },
                    { value: 'monthly', label: 'Bulanan' },
                    { value: 'yearly', label: 'Tahunan' },
                    { value: 'custom', label: 'Rentang Kustom' },
                  ]}
                />

                {period !== 'custom' ? (
                  <Input
                    label="Tanggal Acuan"
                    type="date"
                    value={referenceDate}
                    onChange={(e) => setReferenceDate(e.target.value)}
                  />
                ) : (
                  <>
                    <Input
                      label="Dari Tanggal"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                    <Input
                      label="Sampai Tanggal"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </>
                )}

                {dimension !== 'TEACHER' && (
                  <Select
                    label="Kelas"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    options={[
                      { value: '', label: 'Semua Kelas' },
                      ...classes.map((c) => ({ value: c.id, label: `Kelas ${c.name}` })),
                    ]}
                  />
                )}

                <Select
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: '', label: 'Semua Status' },
                    { value: AttendanceStatus.PRESENT, label: 'Hadir' },
                    { value: AttendanceStatus.LATE, label: 'Terlambat' },
                    { value: AttendanceStatus.SICK, label: 'Sakit' },
                    { value: AttendanceStatus.EXCUSED, label: 'Izin' },
                    { value: AttendanceStatus.ABSENT, label: 'Alfa' },
                    { value: 'MISSING_CHECK_IN', label: 'Belum Absen Masuk' },
                    { value: 'MISSING_CHECK_OUT', label: 'Belum Absen Pulang' },
                  ]}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="w-full max-w-md">
                  <Input
                    placeholder="Cari nama atau NIS / NIY..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    leftAddon={<Search className="h-4 w-4" />}
                  />
                </div>
                {report && (
                  <p className="text-xs text-slate-500 tabular-nums">
                    Rentang aktif:{' '}
                    <strong className="font-mono text-[#10264D]">{report.dateFrom}</strong> s.d.{' '}
                    <strong className="font-mono text-[#10264D]">{report.dateTo}</strong> ·{' '}
                    {report.workingDaysCount} hari kerja aktif
                  </p>
                )}
              </div>
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

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatCard
                label="Total Terdata"
                value={report?.summary.totalPeople ?? 0}
                subtext={`${report?.workingDaysCount ?? 0} hari kerja aktif`}
                accent="navy"
                icon={<Users className="h-5 w-5" />}
              />
              <StatCard
                label="Tingkat Kehadiran"
                value={`${report?.summary.attendanceRate ?? 0}%`}
                subtext="Hadir + Terlambat"
                accent="success"
                icon={<CheckCircle2 className="h-5 w-5" />}
              />
              <StatCard
                label="Terlambat"
                value={report?.summary.late ?? 0}
                subtext={`Hadir tepat: ${report?.summary.present ?? 0}`}
                accent="gold"
                icon={<Clock className="h-5 w-5" />}
              />
              <StatCard
                label="Sakit & Izin"
                value={(report?.summary.sick ?? 0) + (report?.summary.excused ?? 0)}
                subtext={`Sakit ${report?.summary.sick ?? 0} · Izin ${report?.summary.excused ?? 0}`}
                accent="navy"
                icon={<CalendarDays className="h-5 w-5" />}
              />
              <StatCard
                label="Alfa"
                value={report?.summary.absent ?? 0}
                subtext={`Blm pulang: ${report?.summary.missingCheckOut ?? 0}`}
                accent="danger"
                icon={<UserX className="h-5 w-5" />}
              />
            </div>

            {/* Trend Chart */}
            <AttendanceTrendChart
              title="Tren Kehadiran Periode Terpilih"
              subtitle={
                report
                  ? `${report.schoolName} · ${report.dateFrom} s.d. ${report.dateTo}`
                  : 'Memuat data tren...'
              }
              data={report?.trend ?? []}
            />

            {/* Paginated Detail Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#10264D]">
                  Rincian Rekap Per Orang ({report?.total ?? 0})
                </h2>
                {report && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Download className="h-3.5 w-3.5" />
                    Semua baris terfilter ikut diekspor saat unduh XLSX/PDF
                  </span>
                )}
              </div>

              <DataTable
                columns={personColumns}
                data={report?.items ?? []}
                loading={loading}
                emptyTitle="Tidak ada data kehadiran pada periode ini"
                emptyDescription="Coba ubah rentang tanggal, kelas, atau filter status di atas."
              />
            </div>

            {report && report.classBreakdown.length > 0 && dimension !== 'TEACHER' && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-[#10264D]">Rekap Kehadiran per Kelas</h2>
                <DataTable
                  columns={classColumns}
                  data={report.classBreakdown}
                  emptyTitle="Belum ada data kelas"
                />
              </div>
            )}

            {report && (
              <footer className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{report.schoolName}</strong> · Kebijakan izin disetujui:{' '}
                  {report.approvedPermissionAffectsRecap
                    ? 'Otomatis dihitung sebagai Sakit/Izin'
                    : 'Tidak mengubah perhitungan Alfa'}
                </span>
                <span className="font-mono tabular-nums">
                  Dibuat: {formatDateTimeJakarta(report.generatedAt)}
                </span>
              </footer>
            )}
          </>
        )}

        {/* ===================== MODE 2: REKAP MATRIKS HARIAN ===================== */}
        {viewMode === 'matrix' && (
          <div className="space-y-5">
            {/* Matrix Filter Bar: Guru/Siswa -> Periode -> Tanggal Acuan -> Kelas (tanpa nomor) */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 space-y-3 print:hidden">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Select
                  label="Guru / Siswa"
                  value={matrixDimension}
                  onChange={(e) => {
                    const next = e.target.value as 'STUDENT' | 'TEACHER';
                    setMatrixDimension(next);
                    if (next === 'TEACHER') setClassId('');
                  }}
                  options={[
                    { value: 'STUDENT', label: 'Siswa' },
                    { value: 'TEACHER', label: 'Guru' },
                  ]}
                />

                <Select
                  label="Periode"
                  value={matrixPeriod}
                  onChange={(e) =>
                    setMatrixPeriod(e.target.value as 'weekly' | 'monthly' | 'custom')
                  }
                  options={[
                    { value: 'weekly', label: 'Per Minggu' },
                    { value: 'monthly', label: 'Per Bulan' },
                    { value: 'custom', label: 'Rentang Tanggal Tertentu' },
                  ]}
                />

                {matrixPeriod !== 'custom' ? (
                  <Input
                    label="Tanggal Acuan"
                    type="date"
                    value={matrixRefDate}
                    onChange={(e) => setMatrixRefDate(e.target.value)}
                  />
                ) : (
                  <>
                    <Input
                      label="Dari Tanggal"
                      type="date"
                      value={matrixFrom}
                      onChange={(e) => setMatrixFrom(e.target.value)}
                    />
                    <Input
                      label="Sampai Tanggal"
                      type="date"
                      value={matrixTo}
                      onChange={(e) => setMatrixTo(e.target.value)}
                    />
                  </>
                )}

                {matrixDimension === 'STUDENT' && (
                  <Select
                    label="Kelas"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    options={[
                      { value: '', label: 'Semua Kelas' },
                      ...classes.map((c) => ({ value: c.id, label: `Kelas ${c.name}` })),
                    ]}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="w-full max-w-md">
                  <Input
                    placeholder="Cari nama atau NIS / NIY..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    leftAddon={<Search className="h-4 w-4" />}
                  />
                </div>

                {/* Color Legend */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {(
                    matrixDimension === 'TEACHER'
                      ? (['H', 'T', 'S', 'I', 'A', 'HLT', 'L'] as MatrixCellCode[])
                      : (['H', 'T', 'S', 'I', 'A', 'L'] as MatrixCellCode[])
                  ).map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-2 py-1"
                    >
                      <span
                        className={cn(
                          'inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px]',
                          MATRIX_CELL_STYLES[code],
                        )}
                      >
                        {code}
                      </span>
                      <span className="text-slate-600">{MATRIX_CODE_LABELS[code]}</span>
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {matrixError && (
              <div
                role="alert"
                className="flex items-center gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{matrixError}</span>
              </div>
            )}

            {/* Matrix Table Card */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden">
              <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-[#10264D]">
                    Matriks Kehadiran {matrixDimension === 'STUDENT' ? 'Siswa' : 'Guru'}
                  </h2>
                  {matrixData && (
                    <p className="text-xs text-slate-500 tabular-nums">
                      {matrixData.schoolName} · Rentang{' '}
                      <strong className="font-mono text-[#10264D]">{matrixData.dateFrom}</strong>{' '}
                      s.d. <strong className="font-mono text-[#10264D]">{matrixData.dateTo}</strong>{' '}
                      ({matrixData.dates.length} hari · {matrixData.rows.length} peserta)
                    </p>
                  )}
                </div>
              </div>

              {matrixLoading ? (
                <div className="py-16 flex justify-center">
                  <LoadingSpinner label="Menyusun matriks kehadiran..." />
                </div>
              ) : !matrixData || matrixData.rows.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Tidak ada data peserta untuk ditampilkan pada matriks ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#10264D] text-white">
                        <th className="sticky left-0 z-20 bg-[#10264D] border-r border-white/15 px-3 py-2.5 text-center w-10">
                          No
                        </th>
                        <th className="sticky left-10 z-20 bg-[#10264D] border-r border-white/15 px-3 py-2.5 text-left min-w-[190px]">
                          {matrixData.dimension === 'STUDENT' ? 'Nama Siswa / NIS' : 'Nama Guru / NIY'}
                        </th>
                        {matrixData.dates.map((d) => (
                          <th
                            key={d.date}
                            title={d.holidayName ? `${d.date} · ${d.holidayName}` : d.date}
                            className={cn(
                              'border-r border-white/10 px-1.5 py-2 text-center min-w-[36px] tabular-nums',
                              (d.isWeekend || d.isHoliday) && 'bg-[#1B3A6E] text-[#E7D4A3]',
                            )}
                          >
                            <div className="text-[10px] font-medium opacity-80">{d.dayLabel}</div>
                            <div className="font-mono text-xs font-bold">{d.dayNum}</div>
                          </th>
                        ))}
                        <th className="bg-[#0B1C3A] border-l border-white/15 px-2 py-2 text-center font-mono">
                          H
                        </th>
                        <th className="bg-[#0B1C3A] px-2 py-2 text-center font-mono">T</th>
                        <th className="bg-[#0B1C3A] px-2 py-2 text-center font-mono">S</th>
                        <th className="bg-[#0B1C3A] px-2 py-2 text-center font-mono">I</th>
                        <th className="bg-[#0B1C3A] px-2 py-2 text-center font-mono">A</th>
                        {matrixData.dimension === 'TEACHER' && (
                          <th className="bg-[#0B1C3A] px-2 py-2 text-center font-mono">HLT</th>
                        )}
                        <th className="bg-[#0B1C3A] px-2.5 py-2 text-right font-mono">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {matrixData.rows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-[#F8FAFC]">
                          <td className="sticky left-0 z-10 bg-white border-r border-[#E2E8F0] px-3 py-2 text-center font-mono text-slate-500 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="sticky left-10 z-10 bg-white border-r border-[#E2E8F0] px-3 py-2">
                            <p className="font-semibold text-[#10264D] truncate max-w-[190px]">
                              {row.fullName}
                            </p>
                            <p className="font-mono text-[10px] text-slate-500">
                              {row.identifier} · {row.groupLabel}
                            </p>
                          </td>
                          {matrixData.dates.map((d) => {
                            const code = row.cells[d.date] ?? '-';
                            return (
                              <td
                                key={d.date}
                                title={`${row.fullName} · ${d.date}: ${MATRIX_CODE_LABELS[code]}`}
                                className={cn(
                                  'border-r border-[#F1F5F9] px-1 py-2 text-center font-mono tabular-nums',
                                  MATRIX_CELL_STYLES[code],
                                )}
                              >
                                {code}
                              </td>
                            );
                          })}
                          <td className="border-l border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 text-center font-mono font-bold text-[#15803D] tabular-nums">
                            {row.summary.present}
                          </td>
                          <td className="bg-[#F8FAFC] px-2 py-2 text-center font-mono font-bold text-[#B45309] tabular-nums">
                            {row.summary.late}
                          </td>
                          <td className="bg-[#F8FAFC] px-2 py-2 text-center font-mono font-bold text-[#1D4ED8] tabular-nums">
                            {row.summary.sick}
                          </td>
                          <td className="bg-[#F8FAFC] px-2 py-2 text-center font-mono font-bold text-[#4338CA] tabular-nums">
                            {row.summary.excused}
                          </td>
                          <td className="bg-[#F8FAFC] px-2 py-2 text-center font-mono font-bold text-[#B91C1C] tabular-nums">
                            {row.summary.absent}
                          </td>
                          {matrixData.dimension === 'TEACHER' && (
                            <td className="bg-[#F8FAFC] px-2 py-2 text-center font-mono font-bold text-[#0F766E] tabular-nums">
                              {row.summary.hlt ?? 0}
                            </td>
                          )}
                          <td className="bg-[#F8FAFC] px-2.5 py-2 text-right font-mono font-bold text-[#10264D] tabular-nums">
                            {row.summary.ratePercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

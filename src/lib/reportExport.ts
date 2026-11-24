import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ReportExportResponse } from '../services/reportService';
import { formatDateShortJakarta, getTimeHHMMJakarta } from './date';

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
  custom: 'Rentang Kustom',
};

const DIMENSION_LABELS: Record<string, string> = {
  STUDENT: 'Siswa',
  TEACHER: 'Guru',
  ALL: 'Siswa & Guru',
};

function formatGeneratedTimestamp(iso: string): string {
  return `${formatDateShortJakarta(iso)} ${getTimeHHMMJakarta(iso)}`;
}

function buildFilterSummary(data: ReportExportResponse): string {
  const parts = [
    `Periode: ${PERIOD_LABELS[data.period] ?? data.period} (${data.dateFrom} s.d. ${data.dateTo})`,
    `Kategori: ${DIMENSION_LABELS[data.dimension] ?? data.dimension}`,
  ];
  if (data.appliedFilters.classId) {
    parts.push(`Filter Kelas: ${data.appliedFilters.classId}`);
  }
  if (data.appliedFilters.status) {
    parts.push(`Filter Status: ${data.appliedFilters.status}`);
  }
  if (data.appliedFilters.search) {
    parts.push(`Pencarian: "${data.appliedFilters.search}"`);
  }
  return parts.join(' | ');
}

export function downloadReportXlsx(data: ReportExportResponse): void {
  const generatedStr = formatGeneratedTimestamp(data.generatedAt);
  const filterStr = buildFilterSummary(data);
  const includeHlt = data.dimension !== 'STUDENT';
  const hltSummaryText = includeHlt ? `, HLT: ${data.summary.hlt ?? 0}` : '';

  const metaRows = [
    ['LAPORAN KEHADIRAN RESMI'],
    ['Nama Sekolah', data.schoolName],
    ['Waktu Pembuatan', generatedStr],
    ['Dibuat Oleh', `${data.generatedBy} (${data.generatedByRole})`],
    ['Parameter & Filter', filterStr],
    ['Hari Kerja Aktif', data.workingDaysCount],
    [
      'Ringkasan',
      `Hadir: ${data.summary.present}, Terlambat: ${data.summary.late}, Sakit: ${data.summary.sick}, Izin: ${data.summary.excused}, Alfa: ${data.summary.absent}${hltSummaryText}, Tingkat Kehadiran: ${data.summary.attendanceRate}%`,
    ],
    [],
    [
      'No',
      'Nama Lengkap',
      data.dimension === 'TEACHER' ? 'NIY / NIP' : 'NIS / NIY',
      data.dimension === 'TEACHER' ? 'Jabatan' : 'Kelas / Jabatan',
      'Hari Kerja',
      'Hadir',
      'Terlambat',
      'Sakit',
      'Izin',
      'Alfa',
      ...(includeHlt ? ['HLT'] : []),
      'Belum Masuk',
      'Belum Pulang',
      'Persentase (%)',
    ],
  ];

  const dataRows = data.items.map((row, idx) => [
    idx + 1,
    row.fullName,
    String(row.identifier),
    row.className ?? '-',
    row.workingDays,
    row.present,
    row.late,
    row.sick,
    row.excused,
    row.absent,
    ...(includeHlt ? [row.hlt ?? 0] : []),
    row.missingCheckIn,
    row.missingCheckOut,
    `${row.attendanceRate}%`,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...metaRows, ...dataRows]);
  ws['!cols'] = [
    { wch: 5 },
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
    { wch: 11 },
    { wch: 8 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    ...(includeHlt ? [{ wch: 8 }] : []),
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Kehadiran');

  const safeFile = `laporan-kehadiran-${data.dimension.toLowerCase()}-${data.dateFrom}-sd-${data.dateTo}.xlsx`;
  XLSX.writeFile(wb, safeFile);
}

export function downloadReportPdf(data: ReportExportResponse): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const generatedStr = formatGeneratedTimestamp(data.generatedAt);
  const filterStr = buildFilterSummary(data);
  const includeHlt = data.dimension !== 'STUDENT';
  const hltPdfSummary = includeHlt ? ` · HLT: ${data.summary.hlt ?? 0}` : '';

  // Institutional Navy Header Banner
  doc.setFillColor(16, 38, 77); // #10264D
  doc.rect(0, 0, 297, 26, 'F');
  doc.setFillColor(198, 155, 60); // #C69B3C gold accent rule
  doc.rect(0, 26, 297, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.schoolName.toUpperCase(), 14, 11);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Laporan Rekapitulasi Kehadiran Resmi', 14, 18);

  doc.setFontSize(8.5);
  doc.text(`Dibuat: ${generatedStr}`, 283, 11, { align: 'right' });
  doc.text(`Oleh: ${data.generatedBy}`, 283, 18, { align: 'right' });

  // Filter & Summary Metadata
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8.5);
  doc.text(filterStr, 14, 34);
  doc.text(
    `Hari Kerja Aktif: ${data.workingDaysCount} hari · Total Terdata: ${data.summary.totalPeople} orang · Hadir: ${data.summary.present} · Terlambat: ${data.summary.late} · Sakit: ${data.summary.sick} · Izin: ${data.summary.excused} · Alfa: ${data.summary.absent}${hltPdfSummary} · Kehadiran: ${data.summary.attendanceRate}%`,
    14,
    40,
  );

  autoTable(doc, {
    startY: 45,
    head: [
      [
        'No',
        'Nama Lengkap',
        data.dimension === 'TEACHER' ? 'NIY / NIP' : 'NIS / NIY',
        data.dimension === 'TEACHER' ? 'Jabatan' : 'Kelas',
        'Kerja',
        'Hadir',
        'Telat',
        'Sakit',
        'Izin',
        'Alfa',
        ...(includeHlt ? ['HLT'] : []),
        'Blm Masuk',
        'Blm Pulang',
        '%',
      ],
    ],
    body: data.items.map((row, idx) => [
      String(idx + 1),
      row.fullName,
      String(row.identifier),
      row.className ?? '-',
      String(row.workingDays),
      String(row.present),
      String(row.late),
      String(row.sick),
      String(row.excused),
      String(row.absent),
      ...(includeHlt ? [String(row.hlt ?? 0)] : []),
      String(row.missingCheckIn),
      String(row.missingCheckOut),
      `${row.attendanceRate}%`,
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
    },
    headStyles: {
      fillColor: [16, 38, 77],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const safeFile = `laporan-kehadiran-${data.dimension.toLowerCase()}-${data.dateFrom}-sd-${data.dateTo}.pdf`;
  doc.save(safeFile);
}

export function triggerPrintReport(): void {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
  }
}

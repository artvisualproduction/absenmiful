import * as XLSX from 'xlsx';

/**
 * Reads an uploaded Excel (.xlsx/.xls/.csv) file into an array of string-valued objects.
 * Uses `raw: false` and explicit String conversion so NIS/NIY/NIP leading zeroes
 * are NEVER truncated as numbers.
 */
export async function parseExcelFileAsTextRows(
  file: File,
): Promise<Array<Record<string, string>>> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: false, codepage: 65001 });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Berkas Excel tidak memiliki lembar kerja (sheet).');
  }

  const sheet = workbook.Sheets[firstSheetName]!;
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  return rawRows.map((row) => {
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key.replace(/^\uFEFF/, '').trim();
      clean[normalizedKey] = value === null || value === undefined ? '' : String(value).trim();
    }
    return clean;
  });
}

/** Picks the first matching header alias (case-insensitive) from a parsed Excel row */
export function pickRowField(row: Record<string, string>, aliases: string[]): string {
  const lowerMap = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) {
    lowerMap.set(k.toLowerCase().replace(/[\s/_-]+/g, ''), v);
  }
  for (const alias of aliases) {
    const found = lowerMap.get(alias.toLowerCase().replace(/[\s/_-]+/g, ''));
    if (found !== undefined && found !== '') {
      return found.trim();
    }
  }
  return '';
}

/**
 * Exports tabular data to an .xlsx workbook.
 * Forces string cells for columns marked in `textColumnKeys` so NIS/NIY/NIP
 * retain leading zeroes when opened in Excel.
 */
export function exportRowsToExcel(
  filename: string,
  sheetName: string,
  rows: Array<Record<string, string | number | boolean | null | undefined>>,
  textColumnKeys: string[] = [],
): void {
  const worksheet = XLSX.utils.json_to_sheet(rows);

  if (textColumnKeys.length > 0 && rows.length > 0) {
    const headers = Object.keys(rows[0]!);
    const textColIndices = headers
      .map((h, idx) => (textColumnKeys.includes(h) ? idx : -1))
      .filter((idx) => idx >= 0);

    for (let r = 1; r <= rows.length; r++) {
      for (const c of textColIndices) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddr];
        if (cell) {
          cell.t = 's';
          cell.v = String(cell.v ?? '');
          cell.z = '@';
        }
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const safeFileName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, safeFileName);
}

export function downloadStudentTemplate(): void {
  exportRowsToExcel(
    'template_impor_siswa.xlsx',
    'Template Siswa',
    [
      {
        nis: '00260001',
        fullName: 'CONTOH NAMA SISWA',
        className: '1A',
        gender: 'L',
        status: 'ACTIVE',
      },
    ],
    ['nis'],
  );
}

export function downloadTeacherTemplate(): void {
  exportRowsToExcel(
    'template_impor_guru.xlsx',
    'Template Guru',
    [
      {
        niyNip: '20521133199001',
        fullName: 'CONTOH NAMA GURU',
        position: 'Guru',
        status: 'ACTIVE',
      },
    ],
    ['niyNip'],
  );
}

export function downloadSubjectTemplate(): void {
  exportRowsToExcel(
    'template_impor_mapel.xlsx',
    'Template Mapel',
    [
      {
        kodeMapel: 'PKN',
        namaMapel: 'Pendidikan Pancasila',
        waliKelasSebagaiGuruMapel: 'YA',
        statusAktif: 'YA',
      },
      {
        kodeMapel: 'PJOK',
        namaMapel: 'Pendidikan Jasmani Olahraga dan Kesehatan',
        waliKelasSebagaiGuruMapel: 'TIDAK',
        statusAktif: 'YA',
      },
    ],
    ['kodeMapel'],
  );
}

export function downloadClassTemplate(): void {
  exportRowsToExcel(
    'template_impor_kelas.xlsx',
    'Template Kelas',
    [
      {
        namaKelas: '1A',
        tingkat: '1',
        tahunAjaran: '2026/2027',
        waliKelas: '',
        kapasitas: 30,
        statusAktif: 'YA',
      },
      {
        namaKelas: '4B',
        tingkat: '4',
        tahunAjaran: '2026/2027',
        waliKelas: 'Nama Guru Wali Kelas',
        kapasitas: 28,
        statusAktif: 'YA',
      },
    ],
    ['tingkat'],
  );
}

export function downloadScheduleTemplate(): void {
  exportRowsToExcel(
    'template_impor_jadwal_mengajar.xlsx',
    'Template Jadwal',
    [
      {
        kelas: '1A',
        mapel: 'BIND',
        hari: 'Senin',
        jamMulai: '07:15',
        jamSelesai: '08:25',
        guru: '',
        gunakanWaliKelas: 'YA',
        ruang: 'Ruang 1A',
        statusAktif: 'YA',
      },
      {
        kelas: '2A',
        mapel: 'MTK',
        hari: 'Selasa',
        jamMulai: '08:30',
        jamSelesai: '09:40',
        guru: '20521133196004',
        gunakanWaliKelas: 'TIDAK',
        ruang: 'Ruang 2A',
        statusAktif: 'YA',
      },
    ],
    ['guru', 'jamMulai', 'jamSelesai'],
  );
}

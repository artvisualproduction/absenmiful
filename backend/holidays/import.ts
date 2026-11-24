import { CollectionName, HolidayScope } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export interface HolidayImportPreviewRow {
  rowNumber: number;
  date: string;
  name: string;
  scope: HolidayScope;
  scopeLabel: string;
  isActive: boolean;
  valid: boolean;
  errors: string[];
}

function parseDateString(raw: unknown): string | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Format 1: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) return str;
  }

  // Format 2: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const iso = `${year}-${month}-${day}`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return iso;
  }

  // Format 3: Excel serial number (e.g. 45678)
  const num = Number(str);
  if (!Number.isNaN(num) && num > 30000 && num < 60000) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  return null;
}

function resolveScope(raw: unknown): HolidayScope {
  const str = String(raw ?? '').trim().toUpperCase();
  if (str.includes('GURU')) return HolidayScope.TEACHER;
  if (str.includes('SISWA')) return HolidayScope.STUDENT;
  return HolidayScope.SCHOOL;
}

function getScopeLabel(scope: HolidayScope): string {
  switch (scope) {
    case HolidayScope.TEACHER:
      return 'Khusus Guru';
    case HolidayScope.STUDENT:
      return 'Khusus Siswa';
    default:
      return 'Semua (Sekolah)';
  }
}

/**
 * POST /api/holidays/import
 * Previews or commits Excel/CSV import of school holidays (e.g. Hari Libur Nasional).
 */
export async function handleHolidaysImport(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const body = req.body as {
      mode?: 'preview' | 'commit';
      rows?: Array<Record<string, unknown>>;
    };
    const mode = body?.mode ?? 'preview';
    const rawRows = body?.rows ?? [];

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      throw ApiError.badRequest('Minimal 1 baris data hari libur untuk diimpor.');
    }

    const holidaysCol = repo.collection(CollectionName.HOLIDAYS);
    const existingHolidays = await holidaysCol.list();
    const existingDateKeys = new Set(
      existingHolidays.items.filter((h) => h.isActive).map((h) => `${h.date}_${h.scope}`),
    );

    const previewRows: HolidayImportPreviewRow[] = [];
    const seenImportKeys = new Set<string>();

    rawRows.forEach((row, idx) => {
      const rowNumber = idx + 1;
      const errors: string[] = [];

      const rawDate = row.date ?? row.tanggal ?? row.tgl ?? row.waktu;
      const parsedDate = parseDateString(rawDate);
      const name = String(row.name ?? row.nama ?? row.keterangan ?? row.namalibur ?? '').trim();
      const scope = resolveScope(row.scope ?? row.cakupan ?? row.lingkup ?? row.sasaran);
      const scopeLabel = getScopeLabel(scope);
      const isActive = row.isActive !== false && String(row.status ?? '').toUpperCase() !== 'NONAKTIF';

      if (!parsedDate) {
        errors.push(`Format tanggal tidak valid ("${String(rawDate ?? '')}"). Gunakan YYYY-MM-DD atau DD/MM/YYYY.`);
      }

      if (!name || name.length < 3) {
        errors.push('Nama hari libur wajib diisi (minimal 3 karakter).');
      }

      if (parsedDate) {
        const key = `${parsedDate}_${scope}`;
        if (seenImportKeys.has(key)) {
          errors.push(`Tanggal ${parsedDate} dengan cakupan ini ganda di dalam file Excel.`);
        } else {
          seenImportKeys.add(key);
        }

        if (existingDateKeys.has(key)) {
          errors.push(`Tanggal libur ${parsedDate} (${scopeLabel}) sudah terdaftar di sistem.`);
        }
      }

      previewRows.push({
        rowNumber,
        date: parsedDate ?? String(rawDate ?? ''),
        name: name || '—',
        scope,
        scopeLabel,
        isActive,
        valid: errors.length === 0,
        errors,
      });
    });

    const validRows = previewRows.filter((r) => r.valid);

    if (mode === 'preview') {
      sendOk(res, {
        total: previewRows.length,
        validCount: validRows.length,
        invalidCount: previewRows.length - validRows.length,
        rows: previewRows,
      });
      return;
    }

    // mode === 'commit'
    if (validRows.length === 0) {
      throw ApiError.badRequest('Tidak ada baris data hari libur yang valid untuk disimpan.');
    }

    const createdItems: Array<{ id: string; date: string; name: string; scope: string }> = [];

    for (const row of validRows) {
      const created = await holidaysCol.create({
        date: row.date,
        name: row.name,
        scope: row.scope,
        isActive: row.isActive,
        createdBy: auth.user.id,
      });
      createdItems.push({
        id: created.id,
        date: created.date,
        name: created.name,
        scope: created.scope,
      });
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'HOLIDAYS_BULK_IMPORTED',
      entityType: 'HOLIDAY',
      entityId: 'bulk',
      after: {
        totalRequested: rawRows.length,
        importedCount: createdItems.length,
        items: createdItems.slice(0, 20),
      },
      clientIp: auth.clientIp,
    });

    sendOk(res, {
      success: true,
      importedCount: createdItems.length,
      items: createdItems,
    });
  } catch (err) {
    sendError(res, err);
  }
}

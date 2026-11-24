import { subjectImportRequestSchema } from '../../src/lib/masterDataValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

function parseBooleanInput(raw: boolean | string | undefined, defaultValue: boolean): boolean {
  if (typeof raw === 'boolean') return raw;
  const val = String(raw ?? '').trim().toUpperCase();
  if (!val) return defaultValue;
  if (['YA', 'Y', 'TRUE', '1', 'AKTIF', 'WALI', 'WALI KELAS'].includes(val)) return true;
  if (['TIDAK', 'NO', 'FALSE', '0', 'NONAKTIF'].includes(val)) return false;
  return defaultValue;
}

export interface SubjectImportPreviewRow {
  rowNumber: number;
  code: string;
  name: string;
  defaultToHomeroomTeacher: boolean;
  isActive: boolean;
  valid: boolean;
  errors: string[];
}

export async function handleSubjectsImport(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = subjectImportRequestSchema.parse(req.body ?? {});

    const subjectCol = repo.collection(CollectionName.SUBJECTS);
    const existingSubjects = await subjectCol.list();
    const existingCodes = new Set(existingSubjects.items.map((s) => s.code.toUpperCase()));
    const seenCodesInFile = new Set<string>();

    const previewRows: SubjectImportPreviewRow[] = parsed.rows.map((row, idx) => {
      const errors: string[] = [];
      const code = row.code.trim().toUpperCase();
      const name = row.name.trim();
      const defaultToHomeroomTeacher = parseBooleanInput(row.defaultToHomeroomTeacher, false);
      const isActive = parseBooleanInput(row.isActive, true);

      if (!code) {
        errors.push('Kode mata pelajaran wajib diisi.');
      } else if (code.length < 2 || code.length > 20 || !/^[A-Za-z0-9_-]+$/.test(code)) {
        errors.push('Kode harus 2–20 karakter (huruf, angka, "-" atau "_").');
      } else if (existingCodes.has(code)) {
        errors.push(`Kode "${code}" sudah terdaftar di sistem.`);
      } else if (seenCodesInFile.has(code)) {
        errors.push(`Kode "${code}" duplikat di dalam file impor.`);
      } else {
        seenCodesInFile.add(code);
      }

      if (!name || name.length < 2) {
        errors.push('Nama mata pelajaran minimal 2 karakter.');
      }

      return {
        rowNumber: idx + 1,
        code,
        name,
        defaultToHomeroomTeacher,
        isActive,
        valid: errors.length === 0,
        errors,
      };
    });

    const validCount = previewRows.filter((r) => r.valid).length;
    const invalidCount = previewRows.length - validCount;

    if (parsed.mode === 'preview') {
      sendOk(res, {
        mode: 'preview',
        total: previewRows.length,
        validCount,
        invalidCount,
        rows: previewRows,
      });
      return;
    }

    if (invalidCount > 0) {
      throw ApiError.badRequest(
        `Impor dibatalkan karena masih terdapat ${invalidCount} baris tidak valid.`,
        { previewRows, invalidCount },
      );
    }

    const createdSubjects = await Promise.all(
      previewRows.map((row) =>
        subjectCol.create({
          code: row.code,
          name: row.name,
          defaultToHomeroomTeacher: row.defaultToHomeroomTeacher,
          isActive: row.isActive,
          createdBy: auth.user.id,
        }),
      ),
    );

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'SUBJECTS_IMPORTED',
      entityType: 'SUBJECT',
      entityId: 'bulk_import',
      after: { count: createdSubjects.length },
      clientIp: auth.clientIp,
    });

    sendOk(
      res,
      {
        mode: 'commit',
        importedCount: createdSubjects.length,
      },
      201,
    );
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleSubjectsImport(req, res);
}

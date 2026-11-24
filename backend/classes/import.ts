import { schoolClassCreateSchema } from '../../src/lib/masterDataValidation';
import { CollectionName, TeacherStatus } from '../../src/types';
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
  if (['YA', 'Y', 'TRUE', '1', 'AKTIF'].includes(val)) return true;
  if (['TIDAK', 'NO', 'FALSE', '0', 'NONAKTIF'].includes(val)) return false;
  return defaultValue;
}

export interface ClassImportPreviewRow {
  rowNumber: number;
  name: string;
  gradeLevel: string;
  academicYearLabel: string;
  academicYearId: string | null;
  homeroomTeacherName: string;
  homeroomTeacherId: string | null;
  capacity: number;
  isActive: boolean;
  valid: boolean;
  errors: string[];
}

/**
 * POST /api/classes/import
 * Previews or commits Excel/CSV import of school classes.
 */
export async function handleClassesImport(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const body = req.body as { mode?: 'preview' | 'commit'; rows?: Array<Record<string, unknown>> };
    const mode = body?.mode ?? 'preview';
    const rawRows = body?.rows ?? [];

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      throw ApiError.badRequest('Minimal 1 baris data kelas untuk diimpor.');
    }

    const [classesRes, yearsRes, teachersRes] = await Promise.all([
      repo.collection(CollectionName.CLASSES).list(),
      repo.collection(CollectionName.ACADEMIC_YEARS).list(),
      repo.collection(CollectionName.TEACHERS).list(),
    ]);

    const existingClasses = classesRes.items;
    const yearMap = new Map(yearsRes.items.map((y) => [y.label.trim().toUpperCase(), y]));
    const defaultYear = yearsRes.items.find((y) => y.isActive) ?? yearsRes.items[0] ?? null;

    const teacherByName = new Map(
      teachersRes.items.map((t) => [t.fullName.trim().toUpperCase(), t]),
    );

    const seenClassKeys = new Set<string>();
    const previewRows: ClassImportPreviewRow[] = [];

    rawRows.forEach((row, idx) => {
      const rowNumber = idx + 1;
      const errors: string[] = [];

      const name = String(row.name ?? '').trim();
      const gradeLevel = String(row.gradeLevel ?? '').trim();
      const academicYearLabelInput = String(row.academicYearLabel ?? '').trim();
      const homeroomTeacherName = String(row.homeroomTeacherName ?? '').trim();
      const capacityRaw = row.capacity !== undefined && row.capacity !== '' ? Number(row.capacity) : 30;
      const capacity = Number.isInteger(capacityRaw) && capacityRaw > 0 ? capacityRaw : 30;
      const isActive = parseBooleanInput(row.isActive as boolean | string | undefined, true);

      if (!name || name.length > 20) {
        errors.push('Nama kelas wajib diisi (maksimal 20 karakter).');
      }

      if (!gradeLevel || !['1', '2', '3', '4', '5', '6'].includes(gradeLevel)) {
        errors.push('Tingkat kelas harus berupa angka antara 1 sampai 6.');
      }

      let academicYearId = defaultYear?.id ?? null;
      let academicYearLabel = defaultYear?.label ?? '—';

      if (academicYearLabelInput) {
        const matchedYear = yearMap.get(academicYearLabelInput.toUpperCase());
        if (matchedYear) {
          academicYearId = matchedYear.id;
          academicYearLabel = matchedYear.label;
        } else {
          errors.push(`Tahun ajaran "${academicYearLabelInput}" tidak ditemukan di sistem.`);
        }
      } else if (!defaultYear) {
        errors.push('Belum ada tahun ajaran aktif di sistem. Tambahkan tahun ajaran terlebih dahulu.');
      }

      let homeroomTeacherId: string | null = null;
      if (homeroomTeacherName) {
        const matchedTeacher = teacherByName.get(homeroomTeacherName.toUpperCase());
        if (matchedTeacher) {
          homeroomTeacherId = matchedTeacher.id;
        } else {
          errors.push(`Wali kelas "${homeroomTeacherName}" tidak ditemukan di Data Guru.`);
        }
      }

      if (name && academicYearId) {
        const key = `${name.toUpperCase()}_${academicYearId}`;
        const isDuplicateInDb = existingClasses.some(
          (c) => c.name.trim().toUpperCase() === name.toUpperCase() && c.academicYearId === academicYearId,
        );
        if (isDuplicateInDb) {
          errors.push(`Kelas "${name}" sudah terdaftar pada tahun ajaran tersebut.`);
        }
        if (seenClassKeys.has(key)) {
          errors.push(`Kelas "${name}" duplikat di dalam berkas impor.`);
        }
        seenClassKeys.add(key);
      }

      previewRows.push({
        rowNumber,
        name,
        gradeLevel,
        academicYearLabel,
        academicYearId,
        homeroomTeacherName: homeroomTeacherName || 'Belum ditentukan',
        homeroomTeacherId,
        capacity,
        isActive,
        valid: errors.length === 0,
        errors,
      });
    });

    const validCount = previewRows.filter((r) => r.valid).length;
    const invalidCount = previewRows.length - validCount;

    if (mode === 'preview') {
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
        `Impor dibatalkan karena masih terdapat ${invalidCount} baris data kelas tidak valid.`,
        { previewRows, invalidCount },
      );
    }

    const classCol = repo.collection(CollectionName.CLASSES);
    const createdItems = await Promise.all(
      previewRows.map((row) =>
        classCol.create({
          name: row.name,
          gradeLevel: row.gradeLevel,
          homeroomTeacherId: row.homeroomTeacherId,
          academicYearId: row.academicYearId!,
          capacity: row.capacity,
          isActive: row.isActive,
          createdBy: auth.user.id,
        }),
      ),
    );

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'CLASSES_IMPORTED',
      entityType: 'CLASS',
      entityId: 'bulk_import',
      after: { count: createdItems.length },
      clientIp: auth.clientIp,
    });

    sendOk(
      res,
      {
        mode: 'commit',
        importedCount: createdItems.length,
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
  await handleClassesImport(req, res);
}

import { teacherImportRequestSchema } from '../../src/lib/masterDataValidation';
import { niyNipSchema } from '../../src/lib/validation';
import { CollectionName, TeacherStatus } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export interface TeacherImportValidatedRow {
  rowNumber: number;
  niyNip: string;
  fullName: string;
  position: string;
  status: TeacherStatus;
  valid: boolean;
  errors: string[];
}

function parseTeacherStatus(raw: string): { value: TeacherStatus; error?: string } {
  const clean = raw.trim().toUpperCase();
  if (!clean || clean === 'ACTIVE' || clean === 'AKTIF') return { value: TeacherStatus.ACTIVE };
  if (clean === 'INACTIVE' || clean === 'NONAKTIF') return { value: TeacherStatus.INACTIVE };
  return {
    value: TeacherStatus.ACTIVE,
    error: `Status "${raw}" tidak dikenali (gunakan ACTIVE atau INACTIVE).`,
  };
}

export async function handleTeachersImport(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = teacherImportRequestSchema.parse(req.body ?? {});

    const existingTeachersRes = await repo.collection(CollectionName.TEACHERS).list();
    const existingNipSet = new Set(existingTeachersRes.items.map((t) => t.niyNip));
    const seenInFile = new Set<string>();
    const validatedRows: TeacherImportValidatedRow[] = [];

    parsed.rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const errors: string[] = [];

      const niyNip = String(row.niyNip ?? '').trim();
      const fullName = String(row.fullName ?? '').trim();
      const position = String(row.position ?? '').trim();

      if (!niyNip) {
        errors.push('Kolom NIY/NIP kosong.');
      } else {
        const check = niyNipSchema.safeParse(niyNip);
        if (!check.success) {
          errors.push(check.error.issues[0]?.message ?? 'Format NIY/NIP tidak valid.');
        }
        if (existingNipSet.has(niyNip)) {
          errors.push(`NIY/NIP "${niyNip}" sudah terdaftar di sistem.`);
        }
        if (seenInFile.has(niyNip)) {
          errors.push(`NIY/NIP "${niyNip}" duplikat di dalam berkas impor.`);
        }
        seenInFile.add(niyNip);
      }

      if (!fullName || fullName.length < 2) {
        errors.push('Nama lengkap guru wajib diisi (minimal 2 karakter).');
      }

      if (!position || position.length < 2) {
        errors.push('Jabatan wajib diisi.');
      }

      const statusParsed = parseTeacherStatus(row.status ?? '');
      if (statusParsed.error) errors.push(statusParsed.error);

      validatedRows.push({
        rowNumber,
        niyNip,
        fullName,
        position,
        status: statusParsed.value,
        valid: errors.length === 0,
        errors,
      });
    });

    const validCount = validatedRows.filter((r) => r.valid).length;
    const invalidCount = validatedRows.length - validCount;

    if (parsed.mode === 'preview') {
      sendOk(res, {
        mode: 'preview',
        totalRows: validatedRows.length,
        validCount,
        invalidCount,
        rows: validatedRows,
      });
      return;
    }

    if (invalidCount > 0) {
      throw ApiError.badRequest(
        `Impor dibatalkan karena terdapat ${invalidCount} baris tidak valid. Perbaiki berkas dan pratinjau ulang.`,
        { rows: validatedRows.filter((r) => !r.valid) },
      );
    }

    const teacherCol = repo.collection(CollectionName.TEACHERS);
    const createdIds: string[] = [];

    for (const row of validatedRows) {
      const created = await teacherCol.create({
        niyNip: row.niyNip,
        fullName: row.fullName,
        position: row.position,
        photoPath: null,
        userId: null,
        qrTokenId: null,
        status: row.status,
        createdBy: auth.user.id,
      });
      createdIds.push(created.id);
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'TEACHERS_IMPORTED',
      entityType: 'TEACHER',
      entityId: 'batch_import',
      after: { importedCount: createdIds.length },
      clientIp: auth.clientIp,
    });

    sendOk(res, { mode: 'commit', importedCount: createdIds.length, createdIds }, 201);
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleTeachersImport(req, res);
}

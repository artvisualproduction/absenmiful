import { studentImportRequestSchema } from '../../src/lib/masterDataValidation';
import { nisSchema } from '../../src/lib/validation';
import { CollectionName, EnrollmentStatus, Gender, StudentStatus } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export interface StudentImportValidatedRow {
  rowNumber: number;
  nis: string;
  fullName: string;
  className: string;
  classId: string | null;
  gender: Gender | null;
  status: StudentStatus;
  valid: boolean;
  errors: string[];
}

function parseGender(raw: string): { value: Gender | null; error?: string } {
  const clean = raw.trim().toUpperCase();
  if (!clean) return { value: null };
  if (clean === 'L' || clean === 'LAKI-LAKI' || clean === 'LAKI LAKI') return { value: Gender.L };
  if (clean === 'P' || clean === 'PEREMPUAN') return { value: Gender.P };
  return { value: null, error: 'Jenis kelamin harus L atau P (atau dikosongkan).' };
}

function parseStudentStatus(raw: string): { value: StudentStatus; error?: string } {
  const clean = raw.trim().toUpperCase();
  if (!clean || clean === 'ACTIVE' || clean === 'AKTIF') return { value: StudentStatus.ACTIVE };
  if (clean === 'GRADUATED' || clean === 'LULUS') return { value: StudentStatus.GRADUATED };
  if (clean === 'TRANSFERRED' || clean === 'PINDAH') return { value: StudentStatus.TRANSFERRED };
  if (clean === 'INACTIVE' || clean === 'NONAKTIF') return { value: StudentStatus.INACTIVE };
  return {
    value: StudentStatus.ACTIVE,
    error: `Status "${raw}" tidak dikenali (gunakan ACTIVE, GRADUATED, TRANSFERRED, atau INACTIVE).`,
  };
}

export async function handleStudentsImport(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = studentImportRequestSchema.parse(req.body ?? {});

    const [existingStudentsRes, classesRes, activeYear] = await Promise.all([
      repo.collection(CollectionName.STUDENTS).list(),
      repo.collection(CollectionName.CLASSES).list(),
      repo
        .collection(CollectionName.ACADEMIC_YEARS)
        .findFirst([{ field: 'isActive', op: '==', value: true }]),
    ]);

    const existingNisSet = new Set(existingStudentsRes.items.map((s) => s.nis));
    const classByName = new Map(
      classesRes.items.map((c) => [c.name.trim().toUpperCase(), c]),
    );

    const seenInFile = new Set<string>();
    const validatedRows: StudentImportValidatedRow[] = [];

    parsed.rows.forEach((row, index) => {
      const rowNumber = index + 2; // Excel row 1 is header
      const errors: string[] = [];

      const nis = String(row.nis ?? '').trim();
      const fullName = String(row.fullName ?? '').trim();
      const className = String(row.className ?? '').trim();

      if (!nis) {
        errors.push('Kolom NIS kosong.');
      } else {
        const nisCheck = nisSchema.safeParse(nis);
        if (!nisCheck.success) {
          errors.push(nisCheck.error.issues[0]?.message ?? 'Format NIS tidak valid.');
        }
        if (existingNisSet.has(nis)) {
          errors.push(`NIS "${nis}" sudah terdaftar di sistem.`);
        }
        if (seenInFile.has(nis)) {
          errors.push(`NIS "${nis}" duplikat di dalam berkas impor.`);
        }
        seenInFile.add(nis);
      }

      if (!fullName || fullName.length < 2) {
        errors.push('Nama lengkap wajib diisi (minimal 2 karakter).');
      }

      let classId: string | null = null;
      if (!className) {
        errors.push('Kolom kelas kosong.');
      } else {
        const matchedClass = classByName.get(className.toUpperCase());
        if (!matchedClass) {
          errors.push(`Kelas "${className}" tidak ditemukan di master kelas.`);
        } else {
          classId = matchedClass.id;
        }
      }

      const genderParsed = parseGender(row.gender ?? '');
      if (genderParsed.error) errors.push(genderParsed.error);

      const statusParsed = parseStudentStatus(row.status ?? '');
      if (statusParsed.error) errors.push(statusParsed.error);

      validatedRows.push({
        rowNumber,
        nis,
        fullName,
        className,
        classId,
        gender: genderParsed.value,
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

    // Commit mode: reject if there are invalid rows to maintain data integrity
    if (invalidCount > 0) {
      throw ApiError.badRequest(
        `Impor dibatalkan karena terdapat ${invalidCount} baris tidak valid. Perbaiki berkas dan pratinjau ulang.`,
        { rows: validatedRows.filter((r) => !r.valid) },
      );
    }

    const studentCol = repo.collection(CollectionName.STUDENTS);
    const enrollmentCol = repo.collection(CollectionName.STUDENT_ENROLLMENTS);
    const nowIso = new Date().toISOString();
    const createdIds: string[] = [];

    for (const row of validatedRows) {
      const created = await studentCol.create({
        nis: row.nis,
        fullName: row.fullName,
        classId: row.classId!,
        gender: row.gender,
        photoPath: null,
        status: row.status,
        qrTokenId: null,
        isDemo: false,
        createdBy: auth.user.id,
      });
      createdIds.push(created.id);

      await enrollmentCol.create({
        studentId: created.id,
        classId: created.classId,
        academicYearId: activeYear?.id ?? 'ay_2026_2027',
        startDate: nowIso,
        endDate: null,
        status: EnrollmentStatus.ACTIVE,
        createdBy: auth.user.id,
      });
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'STUDENTS_IMPORTED',
      entityType: 'STUDENT',
      entityId: 'batch_import',
      after: { importedCount: createdIds.length },
      clientIp: auth.clientIp,
    });

    sendOk(
      res,
      {
        mode: 'commit',
        importedCount: createdIds.length,
        createdIds,
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
  await handleStudentsImport(req, res);
}

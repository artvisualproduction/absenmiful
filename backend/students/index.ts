import { studentCreateSchema } from '../../src/lib/masterDataValidation';
import { CollectionName, EnrollmentStatus, StudentStatus } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import {
  getQueryInt,
  getQueryString,
  MASTER_READ_ROLES,
  MASTER_WRITE_ROLES,
  paginateArrayByCursor,
} from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleStudents(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const studentCol = repo.collection(CollectionName.STUDENTS);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });

      const search = getQueryString(req, 'search').toLowerCase();
      const classId = getQueryString(req, 'classId');
      const status = getQueryString(req, 'status');
      const isDemoParam = getQueryString(req, 'isDemo');
      const cursor = getQueryString(req, 'cursor');
      const limit = getQueryInt(req, 'limit', 10, 1, 2000);

      const [studentsRes, classesRes] = await Promise.all([
        studentCol.list({ sort: { field: 'nis', direction: 'asc' } }),
        repo.collection(CollectionName.CLASSES).list(),
      ]);

      const classMap = new Map(classesRes.items.map((c) => [c.id, c.name]));
      const totalDemoStudents = studentsRes.items.filter(
        (s) => Boolean(s.isDemo) && s.status !== StudentStatus.INACTIVE,
      ).length;

      const filtered = studentsRes.items
        .filter((s) => {
          if (classId && s.classId !== classId) return false;
          if (status && s.status !== status) return false;
          if (isDemoParam === 'true' && !s.isDemo) return false;
          if (isDemoParam === 'false' && s.isDemo) return false;
          if (search) {
            const clsName = (classMap.get(s.classId) ?? '').toLowerCase();
            if (
              !s.fullName.toLowerCase().includes(search) &&
              !s.nis.toLowerCase().includes(search) &&
              !clsName.includes(search)
            ) {
              return false;
            }
          }
          return true;
        })
        .map((s) => ({
          ...s,
          className: classMap.get(s.classId) ?? '-',
          isDemo: Boolean(s.isDemo),
        }));

      const paginated = paginateArrayByCursor(filtered, cursor, limit);

      sendOk(res, {
        items: paginated.items,
        total: paginated.total,
        nextCursor: paginated.nextCursor,
        totalDemoStudents,
      });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = studentCreateSchema.parse(req.body ?? {});

      // Unique NIS check (string comparison preserving leading zeroes)
      const duplicate = await studentCol.findFirst([
        { field: 'nis', op: '==', value: parsed.nis },
      ]);
      if (duplicate) {
        throw ApiError.conflict(`NIS "${parsed.nis}" sudah terdaftar pada siswa lain.`);
      }

      const schoolClass = await repo.collection(CollectionName.CLASSES).getById(parsed.classId);
      if (!schoolClass) {
        throw ApiError.badRequest('Kelas yang dipilih tidak ditemukan.');
      }

      const activeYear = await repo
        .collection(CollectionName.ACADEMIC_YEARS)
        .findFirst([{ field: 'isActive', op: '==', value: true }]);

      const nowIso = new Date().toISOString();
      const created = await studentCol.create({
        nis: parsed.nis,
        fullName: parsed.fullName,
        classId: parsed.classId,
        gender: parsed.gender ?? null,
        photoPath: parsed.photoPath ?? null,
        status: parsed.status,
        qrTokenId: null,
        isDemo: false,
        createdBy: auth.user.id,
      });

      // Record initial enrollment history so past reports remain intact on promotion
      await repo.collection(CollectionName.STUDENT_ENROLLMENTS).create({
        studentId: created.id,
        classId: created.classId,
        academicYearId: activeYear?.id ?? schoolClass.academicYearId,
        startDate: nowIso,
        endDate: null,
        status: EnrollmentStatus.ACTIVE,
        createdBy: auth.user.id,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'STUDENT_CREATED',
        entityType: 'STUDENT',
        entityId: created.id,
        after: {
          nis: created.nis,
          fullName: created.fullName,
          classId: created.classId,
          status: created.status,
        },
        clientIp: auth.clientIp,
      });

      sendOk(res, { ...created, className: schoolClass.name }, 201);
      return;
    }

    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.');
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleStudents(req, res);
}

import { schoolClassCreateSchema } from '../../src/lib/masterDataValidation';
import { CollectionName, StudentStatus } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import {
  getQueryString,
  MASTER_READ_ROLES,
  MASTER_WRITE_ROLES,
} from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleClasses(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const classCol = repo.collection(CollectionName.CLASSES);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });

      const search = getQueryString(req, 'search').toLowerCase();
      const academicYearId = getQueryString(req, 'academicYearId');
      const activeParam = getQueryString(req, 'isActive');

      const [classesRes, teachersRes, yearsRes, studentsRes] = await Promise.all([
        classCol.list({ sort: { field: 'name', direction: 'asc' } }),
        repo.collection(CollectionName.TEACHERS).list(),
        repo.collection(CollectionName.ACADEMIC_YEARS).list(),
        repo.collection(CollectionName.STUDENTS).list(),
      ]);

      const teacherMap = new Map(teachersRes.items.map((t) => [t.id, t.fullName]));
      const yearMap = new Map(yearsRes.items.map((y) => [y.id, y.label]));
      const studentCountMap = new Map<string, number>();

      for (const s of studentsRes.items) {
        if (s.status === StudentStatus.ACTIVE || s.status === StudentStatus.DEMO_ACTIVE) {
          studentCountMap.set(s.classId, (studentCountMap.get(s.classId) ?? 0) + 1);
        }
      }

      const filtered = classesRes.items
        .filter((c) => {
          if (academicYearId && c.academicYearId !== academicYearId) return false;
          if (activeParam === 'true' && !c.isActive) return false;
          if (activeParam === 'false' && c.isActive) return false;
          if (search) {
            const teacherName = c.homeroomTeacherId
              ? (teacherMap.get(c.homeroomTeacherId) ?? '').toLowerCase()
              : '';
            if (
              !c.name.toLowerCase().includes(search) &&
              !c.gradeLevel.toLowerCase().includes(search) &&
              !teacherName.includes(search)
            ) {
              return false;
            }
          }
          return true;
        })
        .map((c) => ({
          ...c,
          homeroomTeacherName: c.homeroomTeacherId
            ? (teacherMap.get(c.homeroomTeacherId) ?? null)
            : null,
          academicYearLabel: yearMap.get(c.academicYearId) ?? '-',
          studentCount: studentCountMap.get(c.id) ?? 0,
        }));

      sendOk(res, { items: filtered, total: filtered.length });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = schoolClassCreateSchema.parse(req.body ?? {});

      const year = await repo.collection(CollectionName.ACADEMIC_YEARS).getById(parsed.academicYearId);
      if (!year) throw ApiError.badRequest('Tahun ajaran tidak ditemukan.');

      if (parsed.homeroomTeacherId) {
        const teacher = await repo
          .collection(CollectionName.TEACHERS)
          .getById(parsed.homeroomTeacherId);
        if (!teacher) throw ApiError.badRequest('Wali kelas tidak ditemukan.');
      }

      const duplicate = await classCol.findFirst([
        { field: 'name', op: '==', value: parsed.name },
        { field: 'academicYearId', op: '==', value: parsed.academicYearId },
      ]);
      if (duplicate) {
        throw ApiError.conflict(
          `Kelas "${parsed.name}" sudah terdaftar pada tahun ajaran ${year.label}.`,
        );
      }

      const created = await classCol.create({
        name: parsed.name,
        gradeLevel: parsed.gradeLevel,
        homeroomTeacherId: parsed.homeroomTeacherId || null,
        academicYearId: parsed.academicYearId,
        capacity: parsed.capacity ?? 30,
        isActive: parsed.isActive,
        createdBy: auth.user.id,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'CLASS_CREATED',
        entityType: 'CLASS',
        entityId: created.id,
        after: { name: created.name, gradeLevel: created.gradeLevel, academicYearId: created.academicYearId },
        clientIp: auth.clientIp,
      });

      sendOk(res, created, 201);
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
  await handleClasses(req, res);
}

import { schoolClassUpdateSchema } from '../../src/lib/masterDataValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleClassById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID kelas wajib diisi.');

    const classCol = repo.collection(CollectionName.CLASSES);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const item = await classCol.getById(id);
      if (!item) throw ApiError.notFound('Kelas tidak ditemukan.');
      sendOk(res, item);
      return;
    }

    if (req.method === 'PATCH') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await classCol.getById(id);
      if (!existing) throw ApiError.notFound('Kelas tidak ditemukan.');

      const parsed = schoolClassUpdateSchema.parse(req.body ?? {});
      const targetName = parsed.name ?? existing.name;
      const targetYearId = parsed.academicYearId ?? existing.academicYearId;

      if (targetName !== existing.name || targetYearId !== existing.academicYearId) {
        const dup = await classCol.findFirst([
          { field: 'name', op: '==', value: targetName },
          { field: 'academicYearId', op: '==', value: targetYearId },
        ]);
        if (dup && dup.id !== id) {
          throw ApiError.conflict(`Kelas "${targetName}" sudah terdaftar pada tahun ajaran ini.`);
        }
      }

      if (parsed.homeroomTeacherId) {
        const teacher = await repo
          .collection(CollectionName.TEACHERS)
          .getById(parsed.homeroomTeacherId);
        if (!teacher) throw ApiError.badRequest('Wali kelas tidak ditemukan.');
      }

      const updated = await classCol.update(id, {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.gradeLevel !== undefined ? { gradeLevel: parsed.gradeLevel } : {}),
        ...(parsed.homeroomTeacherId !== undefined
          ? { homeroomTeacherId: parsed.homeroomTeacherId || null }
          : {}),
        ...(parsed.academicYearId !== undefined ? { academicYearId: parsed.academicYearId } : {}),
        ...(parsed.capacity !== undefined ? { capacity: parsed.capacity } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'CLASS_UPDATED',
        entityType: 'CLASS',
        entityId: id,
        before: { name: existing.name, isActive: existing.isActive },
        after: { name: updated?.name, isActive: updated?.isActive },
        clientIp: auth.clientIp,
      });

      sendOk(res, updated);
      return;
    }

    if (req.method === 'DELETE') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await classCol.getById(id);
      if (!existing) throw ApiError.notFound('Kelas tidak ditemukan.');

      const studentsInClass = await repo.collection(CollectionName.STUDENTS).list({
        filters: [{ field: 'classId', op: '==', value: id }],
      });
      if (studentsInClass.items.length > 0) {
        throw ApiError.conflict(
          `Kelas "${existing.name}" masih memiliki ${studentsInClass.items.length} siswa terdaftar. Pindahkan atau hapus siswa terlebih dahulu sebelum menghapus kelas.`,
        );
      }

      const scheduleCol = repo.collection(CollectionName.TEACHING_SCHEDULES);
      const enrollmentCol = repo.collection(CollectionName.STUDENT_ENROLLMENTS);
      const [schedulesRes, enrollmentsRes] = await Promise.all([
        scheduleCol.list({ filters: [{ field: 'classId', op: '==', value: id }] }),
        enrollmentCol.list({ filters: [{ field: 'classId', op: '==', value: id }] }),
      ]);

      await Promise.all([
        ...schedulesRes.items.map((s) => scheduleCol.delete(s.id)),
        ...enrollmentsRes.items.map((enr) => enrollmentCol.delete(enr.id)),
      ]);

      await classCol.delete(id);

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'CLASS_DELETED',
        entityType: 'CLASS',
        entityId: id,
        before: { name: existing.name, academicYearId: existing.academicYearId },
        reason: 'Dihapus oleh admin.',
        clientIp: auth.clientIp,
      });

      sendOk(res, { deleted: true, id });
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
  await handleClassById(req, res);
}

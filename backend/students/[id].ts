import { studentUpdateSchema } from '../../src/lib/masterDataValidation';
import { CollectionName, EnrollmentStatus, QrOwnerType, StudentStatus } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleStudentById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID siswa wajib diisi.');

    const studentCol = repo.collection(CollectionName.STUDENTS);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const student = await studentCol.getById(id);
      if (!student) throw ApiError.notFound('Data siswa tidak ditemukan.');

      const [cls, enrollmentsRes, classesRes, yearsRes] = await Promise.all([
        repo.collection(CollectionName.CLASSES).getById(student.classId),
        repo.collection(CollectionName.STUDENT_ENROLLMENTS).list({
          filters: [{ field: 'studentId', op: '==', value: student.id }],
          sort: { field: 'startDate', direction: 'desc' },
        }),
        repo.collection(CollectionName.CLASSES).list(),
        repo.collection(CollectionName.ACADEMIC_YEARS).list(),
      ]);

      const classMap = new Map(classesRes.items.map((c) => [c.id, c.name]));
      const yearMap = new Map(yearsRes.items.map((y) => [y.id, y.label]));

      sendOk(res, {
        ...student,
        className: cls?.name ?? '-',
        enrollments: enrollmentsRes.items.map((enr) => ({
          ...enr,
          className: classMap.get(enr.classId) ?? '-',
          academicYearLabel: yearMap.get(enr.academicYearId) ?? '-',
        })),
      });
      return;
    }

    if (req.method === 'PATCH') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await studentCol.getById(id);
      if (!existing) throw ApiError.notFound('Data siswa tidak ditemukan.');

      const parsed = studentUpdateSchema.parse(req.body ?? {});

      if (parsed.nis && parsed.nis !== existing.nis) {
        const dup = await studentCol.findFirst([{ field: 'nis', op: '==', value: parsed.nis }]);
        if (dup && dup.id !== id) {
          throw ApiError.conflict(`NIS "${parsed.nis}" sudah terdaftar pada siswa lain.`);
        }
      }

      let targetClassName: string | undefined;
      let targetClassAcademicYearId: string | undefined;
      if (parsed.classId && parsed.classId !== existing.classId) {
        const nextClass = await repo.collection(CollectionName.CLASSES).getById(parsed.classId);
        if (!nextClass) {
          throw ApiError.badRequest('Kelas tujuan tidak ditemukan.');
        }
        targetClassName = nextClass.name;
        targetClassAcademicYearId = nextClass.academicYearId;
      }

      const updated = await studentCol.update(id, {
        ...(parsed.nis !== undefined ? { nis: parsed.nis } : {}),
        ...(parsed.fullName !== undefined ? { fullName: parsed.fullName } : {}),
        ...(parsed.classId !== undefined ? { classId: parsed.classId } : {}),
        ...(parsed.gender !== undefined ? { gender: parsed.gender } : {}),
        ...(parsed.photoPath !== undefined ? { photoPath: parsed.photoPath } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
      });

      // Rotate studentEnrollments when class changes so historical class placements remain intact
      if (parsed.classId && parsed.classId !== existing.classId) {
        const enrCol = repo.collection(CollectionName.STUDENT_ENROLLMENTS);
        const nowIso = new Date().toISOString();
        const activeEnrollments = await enrCol.list({
          filters: [
            { field: 'studentId', op: '==', value: id },
            { field: 'status', op: '==', value: EnrollmentStatus.ACTIVE },
          ],
        });

        await Promise.all(
          activeEnrollments.items.map((enr) =>
            enrCol.update(enr.id, {
              endDate: nowIso,
              status: EnrollmentStatus.COMPLETED,
            }),
          ),
        );

        const activeYear = await repo
          .collection(CollectionName.ACADEMIC_YEARS)
          .findFirst([{ field: 'isActive', op: '==', value: true }]);

        await enrCol.create({
          studentId: id,
          classId: parsed.classId,
          academicYearId: activeYear?.id ?? targetClassAcademicYearId ?? 'ay_2026_2027',
          startDate: nowIso,
          endDate: null,
          status: EnrollmentStatus.ACTIVE,
          createdBy: auth.user.id,
        });
      }

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'STUDENT_UPDATED',
        entityType: 'STUDENT',
        entityId: id,
        before: {
          nis: existing.nis,
          fullName: existing.fullName,
          classId: existing.classId,
          status: existing.status,
        },
        after: {
          nis: updated?.nis,
          fullName: updated?.fullName,
          classId: updated?.classId,
          status: updated?.status,
        },
        reason: parsed.reason ?? null,
        clientIp: auth.clientIp,
      });

      sendOk(res, { ...updated, ...(targetClassName ? { className: targetClassName } : {}) });
      return;
    }

    if (req.method === 'DELETE') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await studentCol.getById(id);
      if (!existing) throw ApiError.notFound('Data siswa tidak ditemukan.');

      const isPermanent = getQueryString(req, 'permanent') === 'true';
      if (isPermanent) {
        const enrollmentCol = repo.collection(CollectionName.STUDENT_ENROLLMENTS);
        const qrCol = repo.collection(CollectionName.QR_TOKENS);

        const [enrollments, qrTokens] = await Promise.all([
          enrollmentCol.list({ filters: [{ field: 'studentId', op: '==', value: id }] }),
          qrCol.list({
            filters: [
              { field: 'ownerType', op: '==', value: QrOwnerType.STUDENT },
              { field: 'ownerId', op: '==', value: id },
            ],
          }),
        ]);

        await Promise.all([
          ...enrollments.items.map((enr) => enrollmentCol.delete(enr.id)),
          ...qrTokens.items.map((qr) => qrCol.delete(qr.id)),
        ]);

        await studentCol.delete(id);

        await recordActivityLog(repo, {
          actorUserId: auth.user.id,
          actorRole: auth.user.role,
          action: 'STUDENT_DELETED',
          entityType: 'STUDENT',
          entityId: id,
          before: { nis: existing.nis, fullName: existing.fullName, classId: existing.classId },
          reason: 'Dihapus permanen oleh admin.',
          clientIp: auth.clientIp,
        });

        sendOk(res, { deleted: true, id });
        return;
      }

      const archived = await studentCol.update(id, {
        status: StudentStatus.INACTIVE,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'STUDENT_ARCHIVED',
        entityType: 'STUDENT',
        entityId: id,
        before: { status: existing.status },
        after: { status: StudentStatus.INACTIVE },
        reason: 'Diarsipkan oleh admin (tanpa penghapusan permanen).',
        clientIp: auth.clientIp,
      });

      sendOk(res, { archived: true, student: archived });
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
  await handleStudentById(req, res);
}

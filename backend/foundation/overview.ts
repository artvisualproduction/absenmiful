import { CollectionName, UserRole, type FoundationOverviewData } from '../../src/types';
import { sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleFoundationOverview(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method && req.method !== 'GET') {
      res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak diizinkan.' },
        serverTime: new Date().toISOString(),
      });
      return;
    }

    await requireAuth(req, {
      repo,
      allowedRoles: [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.OPERATOR,
        UserRole.PRINCIPAL,
      ],
    });

    const [settingsRes, academicYearsRes, teachersRes, studentsRes, classesRes, subjectsRes] =
      await Promise.all([
        repo.collection(CollectionName.APP_SETTINGS).list({ limit: 1 }),
        repo
          .collection(CollectionName.ACADEMIC_YEARS)
          .list({ filters: [{ field: 'isActive', op: '==', value: true }], limit: 1 }),
        repo.collection(CollectionName.TEACHERS).list({ sort: { field: 'fullName', direction: 'asc' } }),
        repo.collection(CollectionName.STUDENTS).list({ sort: { field: 'nis', direction: 'asc' } }),
        repo.collection(CollectionName.CLASSES).list({ sort: { field: 'name', direction: 'asc' } }),
        repo.collection(CollectionName.SUBJECTS).list(),
      ]);

    const settings = settingsRes.items[0];
    const activeYear = academicYearsRes.items[0];
    const classMap = new Map(classesRes.items.map((c) => [c.id, c.name]));

    const studentCountByClass = new Map<string, number>();
    for (const s of studentsRes.items) {
      studentCountByClass.set(s.classId, (studentCountByClass.get(s.classId) ?? 0) + 1);
    }

    const overview: FoundationOverviewData = {
      dataMode: repo.mode,
      schoolName: settings?.schoolName ?? 'MI Miftahul Ulum Sumberwuluh',
      appName: settings?.appName ?? 'Absensi Digital',
      timezone: settings?.timezone ?? 'Asia/Jakarta',
      activeAcademicYear: activeYear?.label ?? '2026/2027',
      counts: {
        teachers: teachersRes.total,
        students: studentsRes.total,
        demoStudents: studentsRes.items.filter((s) => Boolean(s.isDemo)).length,
        classes: classesRes.total,
        subjects: subjectsRes.total,
      },
      teachers: teachersRes.items.map((t) => ({
        id: t.id,
        niyNip: t.niyNip,
        fullName: t.fullName,
        position: t.position,
        status: t.status,
      })),
      students: studentsRes.items.map((s) => ({
        id: s.id,
        nis: s.nis,
        fullName: s.fullName,
        className: classMap.get(s.classId) ?? '-',
        status: s.status,
        isDemo: Boolean(s.isDemo),
      })),
      classes: classesRes.items.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        studentCount: studentCountByClass.get(c.id) ?? 0,
      })),
    };

    sendOk(res, overview);
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleFoundationOverview(req, res);
}

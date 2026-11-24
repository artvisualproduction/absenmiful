import { appSettingsUpdateSchema } from '../../src/lib/adminSettingsValidation';
import { CollectionName, UserRole, type PublicAppSettings } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { syncPublicSettingsMirror } from '../_lib/auth/bootstrapService';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { hashPassword } from '../_lib/auth/password';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const SETTINGS_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

const SETTINGS_WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

const DEFAULT_VOICE_TEMPLATES = {
  success: 'ABSEN BERHASIL',
  failure: 'ABSEN GAGAL',
  namedSuccess: 'ABSEN ATAS NAMA {name} BERHASIL',
  late: 'ABSEN BERHASIL, {name} TERCATAT TERLAMBAT',
  closed: 'MAAF, WAKTU ABSENSI MASIH DITUTUP',
  alreadyRecorded: 'ANDA SUDAH MELAKUKAN ABSENSI HARI INI',
};

function stripSensitiveSettings(
  raw: Record<string, unknown>,
): PublicAppSettings & { hasPortalExitPassword: boolean } {
  const { portalExitPasswordHash, ...rest } = raw;
  const existingVoice = (rest.voiceTemplates as Record<string, unknown> | undefined) ?? {};
  return {
    ...(rest as unknown as PublicAppSettings),
    pwaAppName:
      typeof rest.pwaAppName === 'string' && rest.pwaAppName.trim()
        ? rest.pwaAppName.trim()
        : 'MiFUL',
    approvedPermissionAffectsRecap:
      typeof rest.approvedPermissionAffectsRecap === 'boolean'
        ? rest.approvedPermissionAffectsRecap
        : true,
    requireUserLinkedToTeacher:
      typeof rest.requireUserLinkedToTeacher === 'boolean'
        ? rest.requireUserLinkedToTeacher
        : true,
    voiceTemplates: {
      ...DEFAULT_VOICE_TEMPLATES,
      ...existingVoice,
    } as PublicAppSettings['voiceTemplates'],
    hasPortalExitPassword:
      typeof portalExitPasswordHash === 'string' && portalExitPasswordHash.length > 0,
  };
}

/**
 * GET / PATCH /api/settings
 * - GET: Admin, Super Admin, and Principal (read-only view for Principal)
 * - PATCH: Admin & Super Admin only. Never exposes or logs `portalExitPasswordHash`.
 */
export async function handleAppSettings(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const col = repo.collection(CollectionName.APP_SETTINGS);

    if (req.method === 'GET') {
      const auth = await requireAuth(req, { repo, allowedRoles: SETTINGS_READ_ROLES });
      const existing = await col.getById('default');
      if (!existing) {
        throw ApiError.notFound('Dokumen pengaturan sekolah belum tersedia.');
      }

      sendOk(res, {
        settings: stripSensitiveSettings(existing as unknown as Record<string, unknown>),
        canEdit: SETTINGS_WRITE_ROLES.includes(auth.user.role),
      });
      return;
    }

    if (req.method === 'PATCH') {
      const auth = await requireAuth(req, { repo, allowedRoles: SETTINGS_WRITE_ROLES });
      const existing = await col.getById('default');
      if (!existing) {
        throw ApiError.notFound('Dokumen pengaturan sekolah belum tersedia.');
      }

      const parsed = appSettingsUpdateSchema.parse(req.body ?? {});
      const patch: Record<string, unknown> = {};

      if (parsed.appName !== undefined) patch.appName = parsed.appName;
      if (parsed.pwaAppName !== undefined) patch.pwaAppName = parsed.pwaAppName;
      if (parsed.schoolName !== undefined) patch.schoolName = parsed.schoolName;
      if (parsed.schoolAddress !== undefined) patch.schoolAddress = parsed.schoolAddress;
      if (parsed.schoolBio !== undefined) patch.schoolBio = parsed.schoolBio;
      if (parsed.timezone !== undefined) patch.timezone = parsed.timezone;
      if (parsed.theme !== undefined) patch.theme = parsed.theme;
      if (parsed.gpsEnabledForStudents !== undefined) {
        patch.gpsEnabledForStudents = parsed.gpsEnabledForStudents;
      }
      if (parsed.gpsEnabledForTeachers !== undefined) {
        patch.gpsEnabledForTeachers = parsed.gpsEnabledForTeachers;
      }
      if (parsed.teacherSelfServiceEnabled !== undefined) {
        patch.teacherSelfServiceEnabled = parsed.teacherSelfServiceEnabled;
      }
      if (parsed.portalScanMethod !== undefined) {
        patch.portalScanMethod = parsed.portalScanMethod;
      }
      if (parsed.approvedPermissionAffectsRecap !== undefined) {
        patch.approvedPermissionAffectsRecap = parsed.approvedPermissionAffectsRecap;
      }
      if (parsed.quickLoginEnabled !== undefined) {
        patch.quickLoginEnabled = parsed.quickLoginEnabled;
      }
      if (parsed.bypassAttendanceTimeWindow !== undefined) {
        patch.bypassAttendanceTimeWindow = parsed.bypassAttendanceTimeWindow;
      }
      if (parsed.requireUserLinkedToTeacher !== undefined) {
        patch.requireUserLinkedToTeacher = parsed.requireUserLinkedToTeacher;
      }
      if (parsed.photoRetentionDays !== undefined) {
        patch.photoRetentionDays = parsed.photoRetentionDays;
      }
      if (parsed.voiceTemplates !== undefined) {
        patch.voiceTemplates = {
          ...DEFAULT_VOICE_TEMPLATES,
          ...(existing.voiceTemplates ?? {}),
          ...parsed.voiceTemplates,
        };
      }

      let portalPasswordChanged = false;
      if (parsed.portalExitPassword) {
        patch.portalExitPasswordHash = await hashPassword(parsed.portalExitPassword);
        portalPasswordChanged = true;
      }

      const updated = await col.update('default', patch);
      if (!updated) {
        throw ApiError.notFound('Gagal memperbarui pengaturan sekolah.');
      }

      await syncPublicSettingsMirror(repo, updated);

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'APP_SETTINGS_UPDATED',
        entityType: 'APP_SETTINGS',
        entityId: 'default',
        before: {
          schoolName: existing.schoolName,
          appName: existing.appName,
          pwaAppName: existing.pwaAppName ?? 'MiFUL',
          theme: existing.theme,
          timezone: existing.timezone,
          gpsEnabledForStudents: existing.gpsEnabledForStudents,
          gpsEnabledForTeachers: existing.gpsEnabledForTeachers,
          portalScanMethod: existing.portalScanMethod ?? 'CAMERA_AND_USB',
          approvedPermissionAffectsRecap: existing.approvedPermissionAffectsRecap ?? true,
          quickLoginEnabled: existing.quickLoginEnabled ?? false,
          bypassAttendanceTimeWindow: existing.bypassAttendanceTimeWindow ?? false,
          requireUserLinkedToTeacher: existing.requireUserLinkedToTeacher ?? true,
          photoRetentionDays: existing.photoRetentionDays ?? 90,
        },
        after: {
          schoolName: updated.schoolName,
          appName: updated.appName,
          pwaAppName: updated.pwaAppName ?? 'MiFUL',
          theme: updated.theme,
          timezone: updated.timezone,
          gpsEnabledForStudents: updated.gpsEnabledForStudents,
          gpsEnabledForTeachers: updated.gpsEnabledForTeachers,
          portalScanMethod: updated.portalScanMethod ?? 'CAMERA_AND_USB',
          approvedPermissionAffectsRecap: updated.approvedPermissionAffectsRecap ?? true,
          quickLoginEnabled: updated.quickLoginEnabled ?? true,
          bypassAttendanceTimeWindow: updated.bypassAttendanceTimeWindow ?? false,
          requireUserLinkedToTeacher: updated.requireUserLinkedToTeacher ?? true,
          photoRetentionDays: updated.photoRetentionDays ?? 90,
          portalPasswordChanged,
        },
        clientIp: auth.clientIp,
      });

      sendOk(res, {
        settings: stripSensitiveSettings(updated as unknown as Record<string, unknown>),
        canEdit: true,
      });
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
  await handleAppSettings(req, res);
}

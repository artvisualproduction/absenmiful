import { auditLogQuerySchema } from '../../src/lib/adminSettingsValidation';
import { getDateKeyJakarta } from '../../src/lib/date';
import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { sanitizeAuditSnapshot } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const AUDIT_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

// Principal has a restricted governance view (no low-level auth/session/backup internals)
const PRINCIPAL_VISIBLE_ENTITY_TYPES = new Set([
  'ATTENDANCE_RECORD',
  'TEACHER_PERMISSION',
  'ATTENDANCE_REPORT',
  'STUDENT',
  'TEACHER',
  'CLASS',
  'TEACHING_SCHEDULE',
  'ATTENDANCE_RULE',
  'HOLIDAY',
]);

/**
 * GET /api/audit-logs (Append-only read endpoint; POST/PATCH/DELETE strictly rejected 405).
 * - SUPER_ADMIN & ADMIN see all logs with filters (actor, action, entityType, date range, search).
 * - PRINCIPAL sees restricted governance audit logs only.
 * - All snapshots are defensively sanitized to strip any password/token/secret fields.
 */
export async function handleAuditLogs(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'GET') {
      throw new ApiError(
        405,
        'METHOD_NOT_ALLOWED',
        'Log aktivitas bersifat append-only dan hanya dapat dibaca melalui GET.',
      );
    }

    const auth = await requireAuth(req, { repo, allowedRoles: AUDIT_READ_ROLES });
    const parsed = auditLogQuerySchema.parse(req.query ?? {});

    const [logsRes, usersRes, teachersRes] = await Promise.all([
      repo.collection(CollectionName.ACTIVITY_LOGS).list({
        sort: { field: 'createdAt', direction: 'desc' },
      }),
      repo.collection(CollectionName.USERS).list(),
      repo.collection(CollectionName.TEACHERS).list(),
    ]);

    const teacherNameMap = new Map(teachersRes.items.map((t) => [t.id, t.fullName]));
    const actorNameMap = new Map(
      usersRes.items.map((u) => [
        u.id,
        (u.linkedTeacherId ? teacherNameMap.get(u.linkedTeacherId) : undefined) ?? u.username,
      ]),
    );

    const isPrincipal = auth.user.role === UserRole.PRINCIPAL;
    const searchLower = parsed.search.toLowerCase();

    const filtered = logsRes.items
      .filter((log) => {
        if (isPrincipal && !PRINCIPAL_VISIBLE_ENTITY_TYPES.has(log.entityType)) {
          return false;
        }
        if (parsed.actorUserId && log.actorUserId !== parsed.actorUserId) {
          return false;
        }
        if (parsed.action && log.action !== parsed.action) {
          return false;
        }
        if (parsed.entityType && log.entityType !== parsed.entityType) {
          return false;
        }
        if (parsed.dateFrom || parsed.dateTo) {
          const logDate = getDateKeyJakarta(log.createdAt ?? new Date().toISOString());
          if (parsed.dateFrom && logDate < parsed.dateFrom) return false;
          if (parsed.dateTo && logDate > parsed.dateTo) return false;
        }
        if (searchLower) {
          const actorName = actorNameMap.get(log.actorUserId) ?? log.actorUserId;
          const hay =
            `${log.action} ${log.entityType} ${log.entityId} ${actorName} ${log.reason ?? ''}`.toLowerCase();
          if (!hay.includes(searchLower)) return false;
        }
        return true;
      })
      .map((log) => ({
        id: log.id,
        actorUserId: log.actorUserId,
        actorName: actorNameMap.get(log.actorUserId) ?? log.actorRole,
        actorRole: log.actorRole,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        before: sanitizeAuditSnapshot(log.before),
        after: sanitizeAuditSnapshot(log.after),
        reason: log.reason,
        createdAt: log.createdAt ?? '',
      }));

    // Cursor pagination
    const total = filtered.length;
    let startIdx = 0;
    if (parsed.cursor) {
      const idx = filtered.findIndex((item) => item.id === parsed.cursor);
      if (idx >= 0) startIdx = idx + 1;
    }

    const pageItems = filtered.slice(startIdx, startIdx + parsed.limit);
    const nextCursor =
      startIdx + parsed.limit < total && pageItems.length > 0
        ? pageItems[pageItems.length - 1].id
        : null;

    const availableActions = Array.from(new Set(logsRes.items.map((l) => l.action))).sort();
    const actors = usersRes.items.map((u) => ({
      id: u.id,
      label: `${(u.linkedTeacherId ? teacherNameMap.get(u.linkedTeacherId) : undefined) ?? u.username} (${u.role})`,
    }));

    sendOk(res, {
      items: pageItems,
      total,
      nextCursor,
      availableActions,
      actors,
      scope: isPrincipal ? 'LIMITED_PRINCIPAL' : 'FULL_ADMIN',
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleAuditLogs(req, res);
}

import { ASIA_JAKARTA_TZ, parseTimeToMinutes } from '../../src/lib/date';
import { attendanceRuleCreateSchema } from '../../src/lib/scheduleRulesValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

function sameClassScope(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, idx) => v === sortedB[idx]);
}

/**
 * GET /api/attendance-rules
 * POST /api/attendance-rules (creates a NEW version — NEVER overwrites historical rules)
 */
export async function handleAttendanceRules(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const col = repo.collection(CollectionName.ATTENDANCE_RULES);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const audience = getQueryString(req, 'audience');
      const activeOnly = getQueryString(req, 'activeOnly');

      const result = await col.list({ sort: { field: 'createdAt', direction: 'desc' } });
      const filtered = result.items
        .filter((r) => {
          if (audience && r.audience !== audience) return false;
          if (activeOnly === 'true' && !r.isActive) return false;
          return true;
        })
        .sort((a, b) => {
          const timeCmp = (b.updatedAt ?? b.createdAt ?? '').localeCompare(
            a.updatedAt ?? a.createdAt ?? '',
          );
          if (timeCmp !== 0) return timeCmp;
          return (b.version ?? 1) - (a.version ?? 1);
        });

      sendOk(res, { items: filtered, total: filtered.length });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = attendanceRuleCreateSchema.parse(req.body ?? {});
      const targetClassIds = [...new Set(parsed.classIds)];

      const inStart = parseTimeToMinutes(parsed.checkInStart);
      const lateMin = parseTimeToMinutes(parsed.lateAfter);
      const inDeadline = parseTimeToMinutes(parsed.checkInDeadline);
      const outStart = parseTimeToMinutes(parsed.checkOutStart);
      const outDeadline = parseTimeToMinutes(parsed.checkOutDeadline);

      if (!(inStart <= lateMin && lateMin <= inDeadline)) {
        throw ApiError.badRequest(
          'Urutan jam masuk harus valid: mulai masuk <= batas terlambat <= batas akhir masuk.',
        );
      }
      if (outDeadline <= outStart) {
        throw ApiError.badRequest('Batas akhir pulang harus setelah jam mulai pulang.');
      }

      const existingSameAudience = await col.list({
        filters: [{ field: 'audience', op: '==', value: parsed.audience }],
      });

      const matchingScopeRules = existingSameAudience.items.filter((r) =>
        sameClassScope(r.classIds ?? [], targetClassIds),
      );
      const nextVersion =
        matchingScopeRules.reduce((max, r) => Math.max(max, r.version ?? 1), 0) + 1;

      const effectiveFromIso = new Date(parsed.effectiveFrom).toISOString();

      // Supersede overlapping active rules so the newly saved schedule takes effect immediately
      if (parsed.isActive) {
        const activeSameAudience = existingSameAudience.items.filter((r) => r.isActive);
        if (targetClassIds.length === 0) {
          // Saving a rule for ALL classes (or teachers) overrides all currently active rules of that audience
          await Promise.all(
            activeSameAudience.map((prev) =>
              col.update(prev.id, {
                isActive: false,
                effectiveUntil: effectiveFromIso,
              }),
            ),
          );
        } else {
          const targetSet = new Set(targetClassIds);
          await Promise.all(
            activeSameAudience.map((prev) => {
              const prevClassIds = prev.classIds ?? [];
              // Exact same class scope -> deactivate old version
              if (sameClassScope(prevClassIds, targetClassIds)) {
                return col.update(prev.id, {
                  isActive: false,
                  effectiveUntil: effectiveFromIso,
                });
              }
              // School-wide fallback rule stays active for untouched classes
              if (prevClassIds.length === 0) {
                return Promise.resolve(null);
              }
              // Overlapping class-specific rule -> strip overridden classes so new rule always wins
              const hasOverlap = prevClassIds.some((id) => targetSet.has(id));
              if (!hasOverlap) {
                return Promise.resolve(null);
              }
              const remainingClassIds = prevClassIds.filter((id) => !targetSet.has(id));
              if (remainingClassIds.length === 0) {
                return col.update(prev.id, {
                  isActive: false,
                  effectiveUntil: effectiveFromIso,
                });
              }
              return col.update(prev.id, {
                classIds: remainingClassIds,
              });
            }),
          );
        }
      }

      const created = await col.create({
        name: parsed.name,
        version: nextVersion,
        audience: parsed.audience,
        classIds: targetClassIds,
        daysOfWeek: [...new Set(parsed.daysOfWeek)].sort((a, b) => a - b),
        checkInStart: parsed.checkInStart,
        lateAfter: parsed.lateAfter,
        lateToleranceMinutes: parsed.lateToleranceMinutes,
        checkInDeadline: parsed.checkInDeadline,
        checkOutStart: parsed.checkOutStart,
        checkOutDeadline: parsed.checkOutDeadline,
        timezone: ASIA_JAKARTA_TZ,
        gpsRequired: parsed.gpsRequired,
        geofenceRequired: parsed.geofenceRequired,
        effectiveFrom: effectiveFromIso,
        effectiveUntil: null,
        isActive: parsed.isActive,
        createdBy: auth.user.id,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'ATTENDANCE_RULE_VERSION_CREATED',
        entityType: 'ATTENDANCE_RULE',
        entityId: created.id,
        after: {
          name: created.name,
          version: created.version,
          audience: created.audience,
          effectiveFrom: created.effectiveFrom,
        },
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
  await handleAttendanceRules(req, res);
}

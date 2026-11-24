import type { BrandingSlot } from '../lib/adminSettingsValidation';
import type {
  PortalScanMethod,
  PublicAppSettings,
  QrOwnerType,
  SafeUser,
  UserRole,
  VoiceTemplatesConfig,
} from '../types';
import { apiRequest } from './apiClient';
import type { IssuedQrTokenResponse } from './attendanceService';

export interface AdminAppSettingsResponse {
  settings: PublicAppSettings & { hasPortalExitPassword: boolean };
  canEdit: boolean;
}

export interface ManagedUserAccount extends SafeUser {
  linkedTeacherName: string | null;
  linkedTeacherPosition: string | null;
  currentPassword: string | null;
}

export interface UserListResponse {
  items: ManagedUserAccount[];
  total: number;
  actorRole: UserRole;
}

export interface AuditLogRow {
  id: string;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLogRow[];
  total: number;
  nextCursor: string | null;
  availableActions: string[];
  actors: Array<{ id: string; label: string }>;
  scope: 'FULL_ADMIN' | 'LIMITED_PRINCIPAL';
}

export interface BackupSnapshotResponse {
  schemaVersion: string;
  exportedAt: string;
  exportedBy: string;
  counts: Record<string, number>;
  collections: Record<string, unknown[]>;
}

export interface RestorePointSummary {
  id: string;
  name: string;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
  createdByName: string;
  counts: Record<string, number>;
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      sp.set(k, String(v));
    }
  }
  const str = sp.toString();
  return str ? `?${str}` : '';
}

export const adminService = {
  // QR Bulk Issue
  bulkIssueQrTokens(ownerType: QrOwnerType, ownerIds: string[]) {
    return apiRequest<{ items: IssuedQrTokenResponse[]; count: number }>('/api/qr/bulk', {
      method: 'POST',
      body: { ownerType, ownerIds },
    });
  },

  // Settings
  getSettings() {
    return apiRequest<AdminAppSettingsResponse>('/api/settings');
  },

  updateSettings(payload: {
    appName?: string;
    pwaAppName?: string;
    schoolName?: string;
    schoolAddress?: string;
    schoolBio?: string;
    timezone?: string;
    theme?: { primary: string; accent: string; background: string };
    gpsEnabledForStudents?: boolean;
    gpsEnabledForTeachers?: boolean;
    teacherSelfServiceEnabled?: boolean;
    portalScanMethod?: PortalScanMethod;
    approvedPermissionAffectsRecap?: boolean;
    quickLoginEnabled?: boolean;
    bypassAttendanceTimeWindow?: boolean;
    requireUserLinkedToTeacher?: boolean;
    photoRetentionDays?: number;
    voiceTemplates?: VoiceTemplatesConfig;
    portalExitPassword?: string;
  }) {
    return apiRequest<AdminAppSettingsResponse>('/api/settings', {
      method: 'PATCH',
      body: payload,
    });
  },

  uploadBrandingAsset(payload: {
    slot: BrandingSlot;
    dataUrl: string;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
    fileName?: string;
  }) {
    return apiRequest<{
      slot: BrandingSlot;
      fileId: string;
      url: string;
      mimeType: string;
      sizeBytes: number;
    }>('/api/settings/branding', {
      method: 'POST',
      body: payload,
    });
  },

  exportBackup() {
    return apiRequest<BackupSnapshotResponse>('/api/settings/backup', {
      method: 'POST',
    });
  },

  restoreBackup(snapshot: BackupSnapshotResponse | Record<string, unknown>) {
    return apiRequest<{
      restored: boolean;
      restoredCounts: Record<string, number>;
      restoredAt: string;
    }>('/api/settings/restore', {
      method: 'POST',
      body: snapshot,
    });
  },

  listRestorePoints() {
    return apiRequest<{ items: RestorePointSummary[]; total: number }>(
      '/api/settings/restore-points',
    );
  },

  createRestorePoint(payload: { name: string; note?: string }) {
    return apiRequest<RestorePointSummary>('/api/settings/restore-points', {
      method: 'POST',
      body: payload,
    });
  },

  restoreFromPoint(id: string) {
    return apiRequest<{
      restored: boolean;
      restorePointId: string;
      restorePointName: string;
      restoredCounts: Record<string, number>;
      restoredAt: string;
    }>(`/api/settings/restore-points/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
    });
  },

  deleteRestorePoint(id: string) {
    return apiRequest<{ deleted: boolean; id: string }>(
      `/api/settings/restore-points/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },

  getFactoryBaselineStatus() {
    return apiRequest<{ configured: boolean; baseline: RestorePointSummary | null }>(
      '/api/settings/factory-baseline',
    );
  },

  saveFactoryBaseline() {
    return apiRequest<{ configured: boolean; baseline: RestorePointSummary | null }>(
      '/api/settings/factory-baseline',
      { method: 'POST' },
    );
  },

  clearFactoryBaseline() {
    return apiRequest<{ configured: boolean; baseline: RestorePointSummary | null }>(
      '/api/settings/factory-baseline',
      { method: 'DELETE' },
    );
  },

  factoryReset(payload: { confirmationText: string }) {
    return apiRequest<{
      reset: boolean;
      usedCustomBaseline?: boolean;
      clearedCounts: Record<string, number>;
      resetAt: string;
    }>('/api/settings/factory-reset', {
      method: 'POST',
      body: payload,
    });
  },

  // Users & RBAC
  listUsers(params?: { role?: UserRole | ''; isActive?: string; search?: string }) {
    return apiRequest<UserListResponse>(`/api/users${buildQuery(params ?? {})}`);
  },

  createUser(payload: {
    username: string;
    password: string;
    role: UserRole;
    linkedTeacherId?: string | null;
    isActive?: boolean;
    mustChangePassword?: boolean;
  }) {
    return apiRequest<SafeUser>('/api/users', {
      method: 'POST',
      body: payload,
    });
  },

  updateUser(
    id: string,
    payload: {
      username?: string;
      role?: UserRole;
      isActive?: boolean;
      linkedTeacherId?: string | null;
      mustChangePassword?: boolean;
      password?: string;
    },
  ) {
    return apiRequest<SafeUser>(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  deleteUser(id: string) {
    return apiRequest<{
      deleted: boolean;
      id: string;
      username: string;
      unlinkedTeacherId: string | null;
    }>(`/api/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  generateUsersFromTeachers(
    items: Array<{
      teacherId: string;
      role?: UserRole.PRINCIPAL | UserRole.TEACHER;
      customUsername?: string;
      customPassword?: string;
    }>,
  ) {
    return apiRequest<{
      created: Array<{
        userId: string;
        teacherId: string;
        fullName: string;
        niyNip: string;
        position: string;
        role: UserRole.PRINCIPAL | UserRole.TEACHER;
        username: string;
        generatedPassword: string;
      }>;
      skipped: Array<{ teacherId: string; fullName: string; reason: string }>;
      createdCount: number;
    }>('/api/users/generate-from-teachers', {
      method: 'POST',
      body: { items },
    });
  },

  resetUserPassword(
    targetUserId: string,
    options: {
      customPassword: string;
      reason?: string;
      mustChangePassword?: boolean;
    },
  ) {
    return apiRequest<{
      targetUserId: string;
      username: string;
      passwordUpdated: boolean;
      mustChangePassword: boolean;
    }>('/api/auth/reset-password', {
      method: 'POST',
      body: {
        targetUserId,
        customPassword: options.customPassword,
        reason: options.reason ?? '',
        ...(options.mustChangePassword !== undefined
          ? { mustChangePassword: options.mustChangePassword }
          : {}),
      },
    });
  },

  // Audit Logs
  listAuditLogs(params?: {
    actorUserId?: string;
    action?: string;
    entityType?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }) {
    return apiRequest<AuditLogListResponse>(`/api/audit-logs${buildQuery(params ?? {})}`);
  },
};

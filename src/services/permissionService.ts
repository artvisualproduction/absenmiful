import type {
  PermissionLeaveType,
  PermissionStatus,
  ReviewDecision,
  TeacherPermission,
} from '../types';
import { apiRequest } from './apiClient';

export interface EnrichedPermission extends TeacherPermission {
  adminReviewerName?: string | null;
  principalReviewerName?: string | null;
}

export interface PermissionListResponse {
  items: EnrichedPermission[];
  total: number;
  nextCursor: string | null;
  counts: {
    total: number;
    pendingAdmin: number;
    pendingPrincipal: number;
    returned: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };
}

export interface MyPermissionListResponse {
  items: EnrichedPermission[];
  total: number;
  nextCursor: string | null;
  counts: {
    total: number;
    active: number;
    approved: number;
    rejected: number;
    returned: number;
  };
}

export interface UploadedAttachmentResponse {
  fileId: string;
  storagePath: string;
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf';
  sizeBytes: number;
  signedUrl: string;
  signedUrlExpiresAt: string;
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

export const permissionService = {
  uploadAttachment(payload: {
    dataUrl: string;
    mimeType: 'image/jpeg' | 'image/png' | 'application/pdf';
    fileName?: string;
  }) {
    return apiRequest<UploadedAttachmentResponse>('/api/uploads/attachment', {
      method: 'POST',
      body: payload,
    });
  },

  submitPermission(payload: {
    leaveType: PermissionLeaveType;
    startAt: string;
    endAt: string;
    reason: string;
    attachmentFileIds?: string[];
  }) {
    return apiRequest<TeacherPermission>('/api/permissions', {
      method: 'POST',
      body: payload,
    });
  },

  resubmitPermission(
    id: string,
    payload: {
      leaveType: PermissionLeaveType;
      startAt: string;
      endAt: string;
      reason: string;
      attachmentFileIds?: string[];
    },
  ) {
    return apiRequest<TeacherPermission>(`/api/permissions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  cancelPermission(id: string, reason?: string) {
    return apiRequest<TeacherPermission>(`/api/permissions/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: { reason: reason ?? '' },
    });
  },

  listPermissions(params?: {
    status?: PermissionStatus | '';
    leaveType?: PermissionLeaveType | '';
    teacherId?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }) {
    return apiRequest<PermissionListResponse>(`/api/permissions${buildQuery(params ?? {})}`);
  },

  listMyPermissions(params?: {
    status?: PermissionStatus | '';
    cursor?: string;
    limit?: number;
  }) {
    return apiRequest<MyPermissionListResponse>(`/api/permissions/me${buildQuery(params ?? {})}`);
  },

  adminReview(
    id: string,
    payload: { decision: ReviewDecision.RECOMMEND_APPROVE | ReviewDecision.RETURN; note: string },
  ) {
    return apiRequest<TeacherPermission>(
      `/api/permissions/${encodeURIComponent(id)}/admin-review`,
      {
        method: 'POST',
        body: payload,
      },
    );
  },

  principalDecision(
    id: string,
    payload: { decision: ReviewDecision.APPROVE | ReviewDecision.REJECT; note: string },
  ) {
    return apiRequest<TeacherPermission>(
      `/api/permissions/${encodeURIComponent(id)}/decision`,
      {
        method: 'POST',
        body: payload,
      },
    );
  },
};

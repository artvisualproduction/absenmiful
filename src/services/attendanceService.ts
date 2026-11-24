import type {
  AttendanceEventType,
  AttendanceRecord,
  AttendanceRule,
  AttendanceStatus,
  PortalScanMethod,
  QrOwnerType,
  SchoolLocation,
  VoiceTemplatesConfig,
} from '../types';
import { apiRequest } from './apiClient';

export interface PortalStatusResponse {
  authorized: boolean;
  operatorUsername: string | null;
  serverTime: string;
  schoolName: string;
  schoolAddress?: string;
  appName: string;
  logoPath: string | null;
  gpsEnabledForStudents: boolean;
  portalScanMethod: PortalScanMethod;
  bypassAttendanceTimeWindow?: boolean;
  hasExitPassword: boolean;
  voiceTemplates: VoiceTemplatesConfig;
}

export interface IssuedQrTokenResponse {
  qrTokenId: string;
  rawToken: string;
  ownerType: QrOwnerType;
  ownerId: string;
  ownerName: string;
  issuedAt: string;
}

export interface AttendanceScanPayload {
  token: string;
  eventType: AttendanceEventType | 'AUTO';
  latitude: number | null;
  longitude: number | null;
  gpsAccuracyMeters: number | null;
  idempotencyKey: string;
  clientTimestamp: string;
  deviceInfo: string;
  selfieFileId?: string | null;
}

export interface AttendanceScanResponse {
  name: string;
  status: AttendanceStatus;
  eventType: AttendanceEventType;
  message: string;
  attendanceDate: string;
  recordedAt: string;
  lateMinutes?: number;
  idempotentReplay?: boolean;
}

export interface AttendanceListResponse {
  items: AttendanceRecord[];
  total: number;
  nextCursor: string | null;
  summary: {
    total: number;
    present: number;
    late: number;
    sick: number;
    excused: number;
    absent: number;
  };
}

export interface UploadedSelfieResponse {
  fileId: string;
  storagePath: string;
  mimeType: 'image/jpeg' | 'image/png';
  sizeBytes: number;
  retentionUntil: string;
  signedUrl: string;
  signedUrlExpiresAt: string;
}

export interface SignedUrlResponse {
  fileId: string;
  mimeType: string;
  signedUrl: string;
  expiresAt: string;
}

export interface TeacherSelfAttendancePayload {
  eventType: AttendanceEventType | 'AUTO';
  latitude: number | null;
  longitude: number | null;
  gpsAccuracyMeters: number | null;
  selfieFileId: string;
  idempotencyKey: string;
  clientTimestamp: string | null;
  deviceInfo: string | null;
}

export interface TeacherSelfAttendanceResponse {
  record: AttendanceRecord;
  message: string;
  lateMinutes?: number;
  idempotentReplay?: boolean;
}

export interface MyAttendanceResponse {
  todayDate: string;
  todayDayOfWeek?: number;
  linkedTeacherId?: string | null;
  teacherName?: string | null;
  teacherPosition?: string | null;
  teacherWorkingDays?: number[];
  teacherHltDays?: number[];
  isTodayHlt?: boolean;
  todayCheckIn: AttendanceRecord | null;
  todayCheckOut: AttendanceRecord | null;
  activeLocation: SchoolLocation | null;
  teacherRule: AttendanceRule | null;
  gpsEnabledForTeachers: boolean;
  teacherSelfServiceEnabled: boolean;
  bypassAttendanceTimeWindow?: boolean;
  items: AttendanceRecord[];
  total: number;
  nextCursor: string | null;
  summary: {
    total: number;
    present: number;
    late: number;
    sick: number;
    excused: number;
    absent: number;
  };
}

export interface GpsSettingsConfig {
  gpsEnabledForStudents: boolean;
  gpsEnabledForTeachers: boolean;
  teacherSelfServiceEnabled: boolean;
  approvedPermissionAffectsRecap?: boolean;
}

export interface SchoolLocationsResponse {
  items: SchoolLocation[];
  total: number;
  gpsSettings: GpsSettingsConfig;
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

export const attendanceService = {
  // Portal
  getPortalStatus() {
    return apiRequest<PortalStatusResponse>('/api/portal/status');
  },
  activatePortal(username: string, password: string) {
    return apiRequest<{ authorized: boolean; operatorUsername: string; expiresAt: string }>(
      '/api/portal/activate',
      {
        method: 'POST',
        body: { username, password },
      },
    );
  },
  exitPortal(password: string) {
    return apiRequest<{ exited: boolean }>('/api/portal/exit', {
      method: 'POST',
      body: { password },
    });
  },

  // QR Tokens
  issueQrToken(ownerType: QrOwnerType, ownerId: string) {
    return apiRequest<IssuedQrTokenResponse>('/api/qr/tokens', {
      method: 'POST',
      body: { ownerType, ownerId },
    });
  },
  revokeQrToken(payload: {
    qrTokenId?: string;
    ownerType?: QrOwnerType;
    ownerId?: string;
    reason?: string;
  }) {
    return apiRequest<{ revokedCount: number; revokedIds: string[] }>('/api/qr/revoke', {
      method: 'POST',
      body: payload,
    });
  },

  // Attendance Scan & Monitoring
  scanAttendance(payload: AttendanceScanPayload) {
    return apiRequest<AttendanceScanResponse>('/api/attendance/scan', {
      method: 'POST',
      body: payload,
    });
  },

  listAttendance(params?: {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    personType?: QrOwnerType;
    classId?: string;
    status?: AttendanceStatus | '';
    eventType?: AttendanceEventType | '';
    search?: string;
    cursor?: string;
    limit?: number;
  }) {
    return apiRequest<AttendanceListResponse>(`/api/attendance${buildQuery(params ?? {})}`);
  },

  correctAttendance(id: string, payload: { status: AttendanceStatus; reason: string }) {
    return apiRequest<AttendanceRecord>(`/api/attendance/${encodeURIComponent(id)}/correction`, {
      method: 'PATCH',
      body: payload,
    });
  },

  deleteAttendance(id: string) {
    return apiRequest<{ deleted: boolean; id: string }>(
      `/api/attendance/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },

  // Stage 6: Secure Private Selfie Uploads & Temporary Signed URLs
  uploadSelfie(payload: {
    dataUrl: string;
    mimeType: 'image/jpeg' | 'image/png';
    ownerType?: QrOwnerType;
    ownerId?: string;
  }) {
    return apiRequest<UploadedSelfieResponse>('/api/uploads/selfie', {
      method: 'POST',
      body: payload,
    });
  },

  getSignedFileUrl(payload: { fileId?: string; storagePath?: string }) {
    return apiRequest<SignedUrlResponse>('/api/uploads/signed-url', {
      method: 'POST',
      body: payload,
    });
  },

  // Stage 6: Teacher Self-Service Attendance & Personal History
  submitTeacherSelfAttendance(payload: TeacherSelfAttendancePayload) {
    return apiRequest<TeacherSelfAttendanceResponse>('/api/attendance/teacher-self', {
      method: 'POST',
      body: payload,
    });
  },

  getMyAttendance(params?: {
    dateFrom?: string;
    dateTo?: string;
    status?: AttendanceStatus | '';
    cursor?: string;
    limit?: number;
  }) {
    return apiRequest<MyAttendanceResponse>(`/api/attendance/me${buildQuery(params ?? {})}`);
  },

  // Stage 6: Admin-only Manual GPS Failure Exception
  createManualException(payload: {
    personType: QrOwnerType;
    personId: string;
    attendanceDate: string;
    eventType: AttendanceEventType;
    status: AttendanceStatus;
    reason: string;
  }) {
    return apiRequest<AttendanceRecord>('/api/attendance/manual-exception', {
      method: 'POST',
      body: payload,
    });
  },

  // Stage 6: School Locations & Geofencing Settings
  listSchoolLocations() {
    return apiRequest<SchoolLocationsResponse>('/api/locations');
  },

  createSchoolLocation(payload: {
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    maxGpsAccuracyMeters: number;
    isActive: boolean;
  }) {
    return apiRequest<SchoolLocation>('/api/locations', {
      method: 'POST',
      body: payload,
    });
  },

  updateSchoolLocation(
    id: string,
    payload: Partial<{
      name: string;
      latitude: number;
      longitude: number;
      radiusMeters: number;
      maxGpsAccuracyMeters: number;
      isActive: boolean;
    }>,
  ) {
    return apiRequest<SchoolLocation>(`/api/locations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  archiveSchoolLocation(id: string) {
    return apiRequest<{ archived: boolean; location: SchoolLocation }>(
      `/api/locations/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },

  getGpsSettings() {
    return apiRequest<GpsSettingsConfig>('/api/settings/gps');
  },

  updateGpsSettings(payload: Partial<GpsSettingsConfig>) {
    return apiRequest<GpsSettingsConfig>('/api/settings/gps', {
      method: 'PATCH',
      body: payload,
    });
  },
};

import {
  AttendanceAudience,
  AttendanceEventType,
  AttendanceMethod,
  AttendanceStatus,
  CollectionName,
  EnrollmentStatus,
  FileCategory,
  Gender,
  HolidayScope,
  PermissionLeaveType,
  PermissionStatus,
  QrOwnerType,
  ReviewDecision,
  StudentStatus,
  TeacherStatus,
  UserRole,
} from './enums';

/**
 * ISO-8601 UTC timestamp string representing Firestore timestamp values
 * when serialized across REST API and application boundaries.
 */
export type TimestampISO = string;

export interface BaseDocument {
  id: string;
  createdAt?: TimestampISO;
  updatedAt?: TimestampISO;
  createdBy?: string | null;
}

export interface AppThemeConfig {
  primary: string;
  accent: string;
  background: string;
}

export interface VoiceTemplatesConfig {
  success: string;
  failure: string;
  namedSuccess: string;
  late?: string;
  closed?: string;
  alreadyRecorded?: string;
}

export type PortalScanMethod =
  | 'CAMERA_AND_USB'
  | 'CAMERA_ONLY'
  | 'USB_SCANNER_ONLY'
  | 'MANUAL_AND_SCANNER';

/** 3.1 appSettings/{settingsId} */
export interface AppSettings extends BaseDocument {
  appName: string;
  pwaAppName?: string;
  schoolName: string;
  schoolAddress: string;
  schoolBio: string;
  logoPath: string | null;
  faviconPath: string | null;
  pwaIcon192Path: string | null;
  pwaIcon512Path: string | null;
  loginBackgroundPath: string | null;
  theme: AppThemeConfig;
  timezone: string;
  gpsEnabledForStudents: boolean;
  gpsEnabledForTeachers: boolean;
  teacherSelfServiceEnabled: boolean;
  portalScanMethod?: PortalScanMethod;
  portalExitPasswordHash: string;
  voiceTemplates: VoiceTemplatesConfig;
  photoRetentionDays?: number;
  approvedPermissionAffectsRecap?: boolean;
  quickLoginEnabled?: boolean;
  bypassAttendanceTimeWindow?: boolean;
  requireUserLinkedToTeacher?: boolean;
  initialSeedCompleted?: boolean;
}

/** Public-safe settings without sensitive hashes */
export type PublicAppSettings = Omit<AppSettings, 'portalExitPasswordHash'>;

/** 3.2 users/{userId} */
export interface User extends BaseDocument {
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  /** AES-256-GCM encrypted password copy for authorized admin password inspection */
  passwordCipher?: string | null;
  role: UserRole;
  linkedTeacherId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: TimestampISO | null;
  failedLoginCount: number;
  lockedUntil: TimestampISO | null;
}

/** Public-safe user projection — passwordHash & passwordCipher are NEVER returned by API */
export type SafeUser = Omit<User, 'passwordHash' | 'passwordCipher'>;

/** uniqueUsernames/{normalizedUsername} */
export interface UniqueUsernameRecord extends BaseDocument {
  userId: string;
  normalizedUsername: string;
}

/** 3.3 students/{studentId} */
export interface Student extends BaseDocument {
  nis: string;
  fullName: string;
  classId: string;
  photoPath: string | null;
  gender: Gender | null;
  status: StudentStatus;
  qrTokenId: string | null;
  isDemo?: boolean;
}

/** 3.4 teachers/{teacherId} */
export interface Teacher extends BaseDocument {
  niyNip: string;
  fullName: string;
  position: string;
  photoPath: string | null;
  userId: string | null;
  qrTokenId: string | null;
  /** Hari masuk wajib guru (1 = Senin .. 7 = Minggu). Hari aktif sekolah di luar daftar ini dihitung HLT. */
  workingDays?: number[] | null;
  status: TeacherStatus;
}

/** 3.5 classes/{classId} */
export interface SchoolClass extends BaseDocument {
  name: string;
  gradeLevel: string;
  homeroomTeacherId: string | null;
  academicYearId: string;
  capacity?: number | null;
  isActive: boolean;
}

/** 3.6 subjects/{subjectId} */
export interface Subject extends BaseDocument {
  name: string;
  code: string;
  defaultToHomeroomTeacher?: boolean;
  isActive: boolean;
}

/** 3.7 academicYears/{academicYearId} */
export interface AcademicYear extends BaseDocument {
  label: string;
  semester?: string;
  startDate: TimestampISO;
  endDate: TimestampISO;
  isActive: boolean;
}

/** 3.8 studentEnrollments/{enrollmentId} */
export interface StudentEnrollment extends BaseDocument {
  studentId: string;
  classId: string;
  academicYearId: string;
  startDate: TimestampISO;
  endDate: TimestampISO | null;
  status: EnrollmentStatus;
}

/** 3.9 teachingSchedules/{scheduleId} */
export interface TeachingSchedule extends BaseDocument {
  teacherId: string;
  subjectId: string;
  classId: string;
  /** 1 = Senin ... 7 = Minggu */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  effectiveFrom: TimestampISO;
  effectiveUntil: TimestampISO | null;
  isActive: boolean;
}

/** 3.10 attendanceRules/{ruleId} */
export interface AttendanceRule extends BaseDocument {
  name?: string;
  version?: number;
  audience: AttendanceAudience;
  classIds: string[];
  /** 1 = Senin ... 7 = Minggu */
  daysOfWeek: number[];
  checkInStart: string;
  checkInDeadline: string;
  lateAfter: string;
  lateToleranceMinutes?: number;
  checkOutStart: string;
  checkOutDeadline: string;
  timezone: string;
  gpsRequired: boolean;
  geofenceRequired: boolean;
  effectiveFrom?: TimestampISO;
  effectiveUntil?: TimestampISO | null;
  isActive: boolean;
}

/** 3.11 schoolLocations/{locationId} */
export interface SchoolLocation extends BaseDocument {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxGpsAccuracyMeters: number;
  isActive: boolean;
}

/** 3.12 qrTokens/{qrTokenId} */
export interface QrToken extends BaseDocument {
  tokenHash: string;
  ownerType: QrOwnerType;
  ownerId: string;
  isActive: boolean;
  issuedAt: TimestampISO;
  revokedAt: TimestampISO | null;
}

/** 3.13 attendanceRecords/{attendanceId} */
export interface AttendanceRecord extends BaseDocument {
  personType: QrOwnerType;
  personId: string;
  personNameSnapshot: string;
  nisSnapshot?: string | null;
  niyNipSnapshot?: string | null;
  classIdSnapshot: string | null;
  classNameSnapshot: string | null;
  /** Format YYYY-MM-DD in Asia/Jakarta */
  attendanceDate: string;
  eventType: AttendanceEventType;
  status: AttendanceStatus;
  method: AttendanceMethod;
  serverTimestamp: TimestampISO;
  clientTimestamp: TimestampISO | null;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracyMeters: number | null;
  distanceFromSchoolMeters: number | null;
  geofencePassed: boolean | null;
  selfiePath: string | null;
  deviceInfo: string | null;
  idempotencyKey: string;
  corrected: boolean;
  correctionReason: string | null;
  anomalyFlags?: string[];
}

/** 3.14 teacherPermissions/{permissionId} */
export interface PermissionAdminReview {
  reviewerId: string | null;
  decision: ReviewDecision | null;
  note: string | null;
  reviewedAt: TimestampISO | null;
}

export interface PermissionPrincipalDecision {
  reviewerId: string | null;
  decision: ReviewDecision | null;
  note: string | null;
  decidedAt: TimestampISO | null;
}

export interface TeacherPermission extends BaseDocument {
  teacherId: string;
  teacherNameSnapshot: string;
  leaveType: PermissionLeaveType;
  startAt: TimestampISO;
  endAt: TimestampISO;
  reason: string;
  attachmentPaths: string[];
  status: PermissionStatus;
  adminReview: PermissionAdminReview;
  principalDecision: PermissionPrincipalDecision;
}

/** 3.15 userSessions/{sessionId} */
export interface UserSession extends BaseDocument {
  userId: string;
  sessionTokenHash: string;
  expiresAt: TimestampISO;
  revokedAt: TimestampISO | null;
  lastSeenAt: TimestampISO;
}

/** 3.16 fileMetadata/{fileId} */
export interface FileMetadata extends BaseDocument {
  ownerType: QrOwnerType | 'SCHOOL';
  ownerId: string;
  category: FileCategory;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  retentionUntil: TimestampISO | null;
  /** Optional base64 content persisted in Firestore for small public branding assets across serverless cold starts */
  dataBase64?: string | null;
}

/** 3.17 activityLogs/{logId} */
export interface ActivityLog extends BaseDocument {
  actorUserId: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  ipHash: string | null;
}

/** 3.18 holidays/{holidayId} */
export interface Holiday extends BaseDocument {
  /** Format YYYY-MM-DD */
  date: string;
  name: string;
  scope: HolidayScope;
  isActive: boolean;
}

/** 3.19 publicBrandingAssets/{assetId} */
export interface PublicBrandingAsset extends BaseDocument {
  slot: 'logo' | 'favicon' | 'pwaIcon192' | 'pwaIcon512' | 'loginBackground';
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  sizeBytes: number;
  storagePath?: string | null;
  dataBase64: string;
}

/** 3.20 admins/{uid} */
export interface AdminAccount extends BaseDocument {
  email: string;
  displayName?: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN';
}

/** 3.21 restorePoints/{restorePointId} */
export interface RestorePoint extends BaseDocument {
  name: string;
  note: string | null;
  createdByName: string;
  counts: Record<string, number>;
  snapshot: {
    schemaVersion: string;
    exportedAt: string;
    collections: Record<string, unknown[]>;
  };
}

/** Collection-to-Document type mapping for strongly typed repository access */
export interface CollectionDocumentMap {
  [CollectionName.APP_SETTINGS]: AppSettings;
  [CollectionName.USERS]: User;
  [CollectionName.UNIQUE_USERNAMES]: UniqueUsernameRecord;
  [CollectionName.STUDENTS]: Student;
  [CollectionName.TEACHERS]: Teacher;
  [CollectionName.CLASSES]: SchoolClass;
  [CollectionName.SUBJECTS]: Subject;
  [CollectionName.ACADEMIC_YEARS]: AcademicYear;
  [CollectionName.STUDENT_ENROLLMENTS]: StudentEnrollment;
  [CollectionName.TEACHING_SCHEDULES]: TeachingSchedule;
  [CollectionName.ATTENDANCE_RULES]: AttendanceRule;
  [CollectionName.SCHOOL_LOCATIONS]: SchoolLocation;
  [CollectionName.QR_TOKENS]: QrToken;
  [CollectionName.ATTENDANCE_RECORDS]: AttendanceRecord;
  [CollectionName.TEACHER_PERMISSIONS]: TeacherPermission;
  [CollectionName.FILE_METADATA]: FileMetadata;
  [CollectionName.USER_SESSIONS]: UserSession;
  [CollectionName.ACTIVITY_LOGS]: ActivityLog;
  [CollectionName.HOLIDAYS]: Holiday;
  [CollectionName.PUBLIC_SETTINGS]: PublicAppSettings;
  [CollectionName.PUBLIC_BRANDING_ASSETS]: PublicBrandingAsset;
  [CollectionName.ADMINS]: AdminAccount;
  [CollectionName.RESTORE_POINTS]: RestorePoint;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  PRINCIPAL = 'PRINCIPAL',
  OPERATOR = 'OPERATOR',
  TEACHER = 'TEACHER',
}

export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  DEMO_ACTIVE = 'DEMO_ACTIVE',
  GRADUATED = 'GRADUATED',
  TRANSFERRED = 'TRANSFERRED',
  INACTIVE = 'INACTIVE',
}

export enum TeacherStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum Gender {
  L = 'L',
  P = 'P',
}

export enum EnrollmentStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  TRANSFERRED = 'TRANSFERRED',
}

export enum AttendanceAudience {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
}

export enum AttendanceEventType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
  SICK = 'SICK',
  ABSENT = 'ABSENT',
  REJECTED = 'REJECTED',
}

export enum AttendanceMethod {
  QR = 'QR',
  QR_SELFIE = 'QR_SELFIE',
  SELF_SERVICE_SELFIE = 'SELF_SERVICE_SELFIE',
  MANUAL_CORRECTION = 'MANUAL_CORRECTION',
}

export enum QrOwnerType {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
}

export enum PermissionLeaveType {
  SICK = 'SICK',
  PERSONAL = 'PERSONAL',
  OFFICIAL_DUTY = 'OFFICIAL_DUTY',
  OTHER = 'OTHER',
}

export enum PermissionStatus {
  SUBMITTED = 'SUBMITTED',
  ADMIN_REVIEWED = 'ADMIN_REVIEWED',
  RETURNED = 'RETURNED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum ReviewDecision {
  RECOMMEND_APPROVE = 'RECOMMEND_APPROVE',
  RETURN = 'RETURN',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export enum FileCategory {
  ATTENDANCE_SELFIE = 'ATTENDANCE_SELFIE',
  PERMISSION_ATTACHMENT = 'PERMISSION_ATTACHMENT',
  STUDENT_PHOTO = 'STUDENT_PHOTO',
  TEACHER_PHOTO = 'TEACHER_PHOTO',
  BRANDING = 'BRANDING',
}

export enum HolidayScope {
  SCHOOL = 'SCHOOL',
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
}

export enum CollectionName {
  APP_SETTINGS = 'appSettings',
  USERS = 'users',
  UNIQUE_USERNAMES = 'uniqueUsernames',
  STUDENTS = 'students',
  TEACHERS = 'teachers',
  CLASSES = 'classes',
  SUBJECTS = 'subjects',
  ACADEMIC_YEARS = 'academicYears',
  STUDENT_ENROLLMENTS = 'studentEnrollments',
  TEACHING_SCHEDULES = 'teachingSchedules',
  ATTENDANCE_RULES = 'attendanceRules',
  SCHOOL_LOCATIONS = 'schoolLocations',
  QR_TOKENS = 'qrTokens',
  ATTENDANCE_RECORDS = 'attendanceRecords',
  TEACHER_PERMISSIONS = 'teacherPermissions',
  FILE_METADATA = 'fileMetadata',
  USER_SESSIONS = 'userSessions',
  ACTIVITY_LOGS = 'activityLogs',
  HOLIDAYS = 'holidays',
  PUBLIC_SETTINGS = 'publicSettings',
  PUBLIC_BRANDING_ASSETS = 'publicBrandingAssets',
  ADMINS = 'admins',
  RESTORE_POINTS = 'restorePoints',
}

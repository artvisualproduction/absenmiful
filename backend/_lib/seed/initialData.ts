import {
  AttendanceAudience,
  EnrollmentStatus,
  HolidayScope,
  StudentStatus,
  TeacherStatus,
  type AcademicYear,
  type AppSettings,
  type AttendanceRule,
  type Holiday,
  type SchoolClass,
  type SchoolLocation,
  type Student,
  type StudentEnrollment,
  type Subject,
  type Teacher,
  type TeachingSchedule,
} from '../../../src/types';

/**
 * Seed data awal untuk mode MOCK (in-memory).
 * Sumber: DATA_AWAL_GURU.json (7 guru resmi) dan DEMO_DATA_SISWA.json (24 siswa fiktif demo).
 *
 * ATURAN KETAT:
 * - NIS dan NIY/NIP disimpan sebagai string agar tidak kehilangan angka nol di depan.
 * - Tidak ada username atau password di file seed ini.
 */

const SEED_TIMESTAMP = '2026-07-01T00:00:00.000Z';
const RULE_EFFECTIVE_FROM = '2024-01-01T00:00:00.000Z';

export const SEED_ACADEMIC_YEARS: AcademicYear[] = [
  {
    id: 'ay_2026_2027',
    label: '2026/2027',
    semester: 'Ganjil',
    startDate: '2026-07-13T00:00:00.000Z',
    endDate: '2027-06-30T23:59:59.000Z',
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

export const SEED_APP_SETTINGS: AppSettings[] = [
  {
    id: 'default',
    appName: 'Absensi Digital',
    pwaAppName: 'MiFUL',
    schoolName: 'MI Miftahul Ulum Sumberwuluh',
    schoolAddress: 'Desa Sumberwuluh, Kecamatan Candipuro, Kabupaten Lumajang, Jawa Timur',
    schoolBio: 'Madrasah Ibtidaiyah Miftahul Ulum Sumberwuluh — Sistem Kehadiran Digital Terpadu.',
    logoPath: '/images/school-logo.png',
    faviconPath: '/favicon.png',
    pwaIcon192Path: '/icons/pwa-192x192.png',
    pwaIcon512Path: '/icons/pwa-512x512.png',
    loginBackgroundPath: '/images/school-backdrop.jpg',
    theme: {
      primary: '#10264D',
      accent: '#C69B3C',
      background: '#FFFFFF',
    },
    timezone: 'Asia/Jakarta',
    gpsEnabledForStudents: true,
    gpsEnabledForTeachers: true,
    teacherSelfServiceEnabled: true,
    portalScanMethod: 'CAMERA_AND_USB',
    portalExitPasswordHash: '',
    voiceTemplates: {
      success: 'ABSEN BERHASIL',
      failure: 'ABSEN GAGAL',
      namedSuccess: 'ABSEN ATAS NAMA {name} BERHASIL',
      late: 'ABSEN BERHASIL, {name} TERCATAT TERLAMBAT',
      closed: 'MAAF, WAKTU ABSENSI MASIH DITUTUP',
      alreadyRecorded: 'ANDA SUDAH MELAKUKAN ABSENSI HARI INI',
    },
    photoRetentionDays: 90,
    quickLoginEnabled: false,
    bypassAttendanceTimeWindow: false,
    requireUserLinkedToTeacher: true,
    initialSeedCompleted: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

/** Setelan pabrik resmi MI MIFTAHUL ULUM (digunakan saat inisialisasi DB baru & Reset Pabrik) */
export const FACTORY_APP_SETTINGS: AppSettings = {
  ...SEED_APP_SETTINGS[0]!,
  appName: 'Absensi Digital',
  pwaAppName: 'MiFUL',
  schoolName: 'MI MIFTAHUL ULUM',
  schoolAddress: 'Sumberwuluh - Candipuro - Lumajang',
  schoolBio: 'Madrasah Ibtidaiyah Miftahul Ulum Sumberwuluh — Sistem Kehadiran Digital Terpadu.',
  logoPath: '/images/school-logo.png',
  faviconPath: '/favicon.png',
  pwaIcon192Path: '/icons/pwa-192x192.png',
  pwaIcon512Path: '/icons/pwa-512x512.png',
  loginBackgroundPath: '/images/school-backdrop.jpg',
  quickLoginEnabled: false,
  approvedPermissionAffectsRecap: true,
  requireUserLinkedToTeacher: true,
};

/** 7 Guru resmi — Kepala Sekolah di urutan teratas */
export const SEED_TEACHERS: Teacher[] = [
  {
    id: 'tch_06',
    niyNip: '20521133191001',
    fullName: 'IMAM MUSTHOFA',
    position: 'Kepala Sekolah',
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: TeacherStatus.ACTIVE,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'tch_01',
    niyNip: '20521133197001',
    fullName: 'NUR ANIFATUL IZZA',
    position: 'Guru',
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: TeacherStatus.ACTIVE,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'tch_02',
    niyNip: '20521133196004',
    fullName: 'ZULKARNAIN NUR HARDIANSYAH',
    position: 'Guru',
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: TeacherStatus.ACTIVE,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'tch_03',
    niyNip: '20521133197002',
    fullName: 'ISTIQOMARIYAH',
    position: 'Guru',
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: TeacherStatus.ACTIVE,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'tch_04',
    niyNip: '20521133104001',
    fullName: 'NUR ANISA',
    position: 'Guru',
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: TeacherStatus.ACTIVE,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'tch_05',
    niyNip: '20596237101001',
    fullName: 'HANIA AINUN NAFISA',
    position: 'Guru',
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: TeacherStatus.ACTIVE,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'tch_07',
    niyNip: '20521133193002',
    fullName: 'MUHAMAD HASMINULLAH HASBULLAH',
    position: 'Guru',
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: TeacherStatus.ACTIVE,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

/** 6 Kelas default: masing-masing tingkat 1 rombel (1A - 6A) */
const CLASS_DEFINITIONS: Array<{ name: string; gradeLevel: string; homeroomTeacherId: string | null }> = [
  { name: '1A', gradeLevel: '1', homeroomTeacherId: 'tch_01' },
  { name: '2A', gradeLevel: '2', homeroomTeacherId: 'tch_02' },
  { name: '3A', gradeLevel: '3', homeroomTeacherId: 'tch_03' },
  { name: '4A', gradeLevel: '4', homeroomTeacherId: 'tch_04' },
  { name: '5A', gradeLevel: '5', homeroomTeacherId: 'tch_05' },
  { name: '6A', gradeLevel: '6', homeroomTeacherId: 'tch_07' },
];

export const SEED_CLASSES: SchoolClass[] = CLASS_DEFINITIONS.map((cls) => ({
  id: `cls_${cls.name.toLowerCase()}`,
  name: cls.name,
  gradeLevel: cls.gradeLevel,
  homeroomTeacherId: cls.homeroomTeacherId,
  academicYearId: 'ay_2026_2027',
  capacity: 30,
  isActive: true,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
}));

const RAW_DEMO_STUDENTS: Array<{ nis: string; fullName: string; className: string }> = [
  { nis: '90000001', fullName: 'AHMAD FAQIH', className: '1A' },
  { nis: '90000002', fullName: 'AISYAH ZAHRA', className: '1A' },
  { nis: '90000003', fullName: 'MUHAMMAD RIZKI', className: '1A' },
  { nis: '90000004', fullName: 'NADIA PUTRI', className: '1A' },
  { nis: '90000005', fullName: 'FAHRI RAMADHAN', className: '2A' },
  { nis: '90000006', fullName: 'SITI AULIA', className: '2A' },
  { nis: '90000007', fullName: 'RAFI ALFARIZI', className: '2A' },
  { nis: '90000008', fullName: 'NABILA SAFITRI', className: '2A' },
  { nis: '90000009', fullName: 'DIMAS PRATAMA', className: '3A' },
  { nis: '90000010', fullName: 'KHADIJAH HUMAIRA', className: '3A' },
  { nis: '90000011', fullName: 'RAIHAN AKBAR', className: '3A' },
  { nis: '90000012', fullName: 'ZAHRA NURFADILAH', className: '3A' },
  { nis: '90000013', fullName: 'M. ILHAM', className: '4A' },
  { nis: '90000014', fullName: 'AMIRA SALSABILA', className: '4A' },
  { nis: '90000015', fullName: 'FIKRI MAULANA', className: '5A' },
  { nis: '90000016', fullName: 'SALMA NADHIRA', className: '5A' },
  { nis: '90000017', fullName: 'ALIF FATHUR', className: '5A' },
  { nis: '90000018', fullName: 'NAZWA KHAIRUNNISA', className: '5A' },
  { nis: '90000019', fullName: 'DAFFA ARYA', className: '6A' },
  { nis: '90000020', fullName: 'HANA MAHARANI', className: '6A' },
  { nis: '90000021', fullName: 'FARHAN HIDAYAT', className: '6A' },
  { nis: '90000022', fullName: 'SYIFA AZZAHRA', className: '6A' },
  { nis: '90000023', fullName: 'RIZAL MAULANA', className: '6A' },
  { nis: '90000024', fullName: 'ALYA FITRIANI', className: '6A' },
];

/** 24 Siswa aktif awal */
export const SEED_STUDENTS: Student[] = RAW_DEMO_STUDENTS.map((s, index) => ({
  id: `std_${String(index + 1).padStart(2, '0')}`,
  nis: s.nis,
  fullName: s.fullName,
  classId: `cls_${s.className.toLowerCase()}`,
  photoPath: null,
  gender: null,
  status: StudentStatus.ACTIVE,
  qrTokenId: null,
  isDemo: false,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
}));

export const SEED_STUDENT_ENROLLMENTS: StudentEnrollment[] = SEED_STUDENTS.map((student, index) => ({
  id: `enr_${String(index + 1).padStart(2, '0')}`,
  studentId: student.id,
  classId: student.classId,
  academicYearId: 'ay_2026_2027',
  startDate: SEED_TIMESTAMP,
  endDate: null,
  status: EnrollmentStatus.ACTIVE,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
}));

export const SEED_SUBJECTS: Subject[] = [
  { id: 'sbj_mtk', name: 'Matematika', code: 'MTK', isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: 'sbj_bind', name: 'Bahasa Indonesia', code: 'BIND', isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: 'sbj_qh', name: 'Al-Qur\'an Hadis', code: 'QH', isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: 'sbj_aa', name: 'Akidah Akhlak', code: 'AA', isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: 'sbj_fqh', name: 'Fikih', code: 'FQH', isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: 'sbj_ski', name: 'Sejarah Kebudayaan Islam', code: 'SKI', isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: 'sbj_bar', name: 'Bahasa Arab', code: 'BAR', isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: 'sbj_ipas', name: 'IPAS', code: 'IPAS', isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
];

export const SEED_ATTENDANCE_RULES: AttendanceRule[] = [
  {
    id: 'rule_student_lower',
    name: 'Jam Absensi Kelas Rendah (1A–2A)',
    version: 1,
    audience: AttendanceAudience.STUDENT,
    classIds: ['cls_1a', 'cls_2a'],
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    checkInStart: '06:00',
    checkInDeadline: '07:30',
    lateAfter: '07:00',
    lateToleranceMinutes: 0,
    checkOutStart: '10:45',
    checkOutDeadline: '12:30',
    timezone: 'Asia/Jakarta',
    gpsRequired: true,
    geofenceRequired: false,
    effectiveFrom: RULE_EFFECTIVE_FROM,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'rule_student_upper',
    name: 'Jam Absensi Kelas Tinggi (3A–6A)',
    version: 1,
    audience: AttendanceAudience.STUDENT,
    classIds: ['cls_3a', 'cls_4a', 'cls_5a', 'cls_6a'],
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    checkInStart: '06:00',
    checkInDeadline: '07:30',
    lateAfter: '07:00',
    lateToleranceMinutes: 0,
    checkOutStart: '12:15',
    checkOutDeadline: '14:30',
    timezone: 'Asia/Jakarta',
    gpsRequired: true,
    geofenceRequired: false,
    effectiveFrom: RULE_EFFECTIVE_FROM,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'rule_student_default',
    name: 'Aturan Jam Absensi Siswa (Umum / Cadangan)',
    version: 1,
    audience: AttendanceAudience.STUDENT,
    classIds: [],
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    checkInStart: '06:00',
    checkInDeadline: '07:30',
    lateAfter: '07:00',
    lateToleranceMinutes: 0,
    checkOutStart: '11:30',
    checkOutDeadline: '15:30',
    timezone: 'Asia/Jakarta',
    gpsRequired: true,
    geofenceRequired: false,
    effectiveFrom: RULE_EFFECTIVE_FROM,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'rule_teacher_default',
    name: 'Aturan Jam Absensi Guru & Tenaga Pendidik',
    version: 1,
    audience: AttendanceAudience.TEACHER,
    classIds: [],
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    checkInStart: '06:00',
    checkInDeadline: '07:30',
    lateAfter: '07:00',
    lateToleranceMinutes: 5,
    checkOutStart: '13:30',
    checkOutDeadline: '16:30',
    timezone: 'Asia/Jakarta',
    gpsRequired: true,
    geofenceRequired: true,
    effectiveFrom: RULE_EFFECTIVE_FROM,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

export const SEED_SCHOOL_LOCATIONS: SchoolLocation[] = [
  {
    id: 'loc_main',
    name: 'MI Miftahul Ulum Sumberwuluh (Kampus Utama)',
    latitude: -8.2134,
    longitude: 113.0792,
    radiusMeters: 100,
    maxGpsAccuracyMeters: 50,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

export const SEED_TEACHING_SCHEDULES: TeachingSchedule[] = [
  {
    id: 'sch_01',
    teacherId: 'tch_01',
    subjectId: 'sbj_mtk',
    classId: 'cls_1a',
    dayOfWeek: 1,
    startTime: '07:15',
    endTime: '08:25',
    room: 'Ruang 1A',
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'sch_02',
    teacherId: 'tch_01',
    subjectId: 'sbj_bind',
    classId: 'cls_1a',
    dayOfWeek: 4,
    startTime: '07:15',
    endTime: '08:25',
    room: 'Ruang 1A',
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'sch_03',
    teacherId: 'tch_02',
    subjectId: 'sbj_qh',
    classId: 'cls_2a',
    dayOfWeek: 2,
    startTime: '07:15',
    endTime: '08:25',
    room: 'Ruang 2A',
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'sch_04',
    teacherId: 'tch_03',
    subjectId: 'sbj_fqh',
    classId: 'cls_3a',
    dayOfWeek: 3,
    startTime: '08:30',
    endTime: '09:40',
    room: 'Ruang 3A',
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'sch_05',
    teacherId: 'tch_04',
    subjectId: 'sbj_ipas',
    classId: 'cls_4a',
    dayOfWeek: 4,
    startTime: '08:30',
    endTime: '09:40',
    room: 'Ruang 4A',
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'sch_06',
    teacherId: 'tch_05',
    subjectId: 'sbj_bar',
    classId: 'cls_5a',
    dayOfWeek: 5,
    startTime: '07:15',
    endTime: '08:25',
    room: 'Ruang 5A',
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'sch_07',
    teacherId: 'tch_07',
    subjectId: 'sbj_ski',
    classId: 'cls_6a',
    dayOfWeek: 6,
    startTime: '07:15',
    endTime: '08:25',
    room: 'Ruang 6A',
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

export const SEED_HOLIDAYS: Holiday[] = [
  {
    id: 'hol_01',
    date: '2026-08-17',
    name: 'Hari Kemerdekaan Republik Indonesia',
    scope: HolidayScope.SCHOOL,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'hol_02',
    date: '2026-12-25',
    name: 'Libur Nasional Akhir Tahun',
    scope: HolidayScope.SCHOOL,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

/**
 * Dataset Baseline Pabrik Resmi MI MIFTAHUL ULUM
 * Bersih dari data seed/demo siswa, guru, kelas, mata pelajaran, dan jadwal mengajar sehingga admin
 * dapat menambahkan data madrasah sendiri dari awal.
 */
export const FACTORY_ACADEMIC_YEARS: AcademicYear[] = SEED_ACADEMIC_YEARS;

export const FACTORY_TEACHERS: Teacher[] = [];

export const FACTORY_CLASSES: SchoolClass[] = [];

export const FACTORY_SUBJECTS: Subject[] = [];

export const FACTORY_TEACHING_SCHEDULES: TeachingSchedule[] = [];

export const FACTORY_ATTENDANCE_RULES: AttendanceRule[] = [
  {
    ...SEED_ATTENDANCE_RULES[2]!,
    name: 'Aturan Jam Absensi Siswa',
    classIds: [],
  },
  SEED_ATTENDANCE_RULES[3]!,
];

export const FACTORY_SCHOOL_LOCATIONS: SchoolLocation[] = SEED_SCHOOL_LOCATIONS;

export const FACTORY_HOLIDAYS: Holiday[] = SEED_HOLIDAYS;

export const FACTORY_STUDENTS: Student[] = [];

export const FACTORY_STUDENT_ENROLLMENTS: StudentEnrollment[] = [];


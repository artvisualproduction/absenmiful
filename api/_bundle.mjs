// backend/createApiApp.ts
import express from "express";

// src/types/enums.ts
var Gender = /* @__PURE__ */ ((Gender2) => {
  Gender2["L"] = "L";
  Gender2["P"] = "P";
  return Gender2;
})(Gender || {});
var CollectionName = /* @__PURE__ */ ((CollectionName2) => {
  CollectionName2["APP_SETTINGS"] = "appSettings";
  CollectionName2["USERS"] = "users";
  CollectionName2["UNIQUE_USERNAMES"] = "uniqueUsernames";
  CollectionName2["STUDENTS"] = "students";
  CollectionName2["TEACHERS"] = "teachers";
  CollectionName2["CLASSES"] = "classes";
  CollectionName2["SUBJECTS"] = "subjects";
  CollectionName2["ACADEMIC_YEARS"] = "academicYears";
  CollectionName2["STUDENT_ENROLLMENTS"] = "studentEnrollments";
  CollectionName2["TEACHING_SCHEDULES"] = "teachingSchedules";
  CollectionName2["ATTENDANCE_RULES"] = "attendanceRules";
  CollectionName2["SCHOOL_LOCATIONS"] = "schoolLocations";
  CollectionName2["QR_TOKENS"] = "qrTokens";
  CollectionName2["ATTENDANCE_RECORDS"] = "attendanceRecords";
  CollectionName2["TEACHER_PERMISSIONS"] = "teacherPermissions";
  CollectionName2["FILE_METADATA"] = "fileMetadata";
  CollectionName2["USER_SESSIONS"] = "userSessions";
  CollectionName2["ACTIVITY_LOGS"] = "activityLogs";
  CollectionName2["HOLIDAYS"] = "holidays";
  CollectionName2["PUBLIC_SETTINGS"] = "publicSettings";
  CollectionName2["PUBLIC_BRANDING_ASSETS"] = "publicBrandingAssets";
  CollectionName2["ADMINS"] = "admins";
  CollectionName2["RESTORE_POINTS"] = "restorePoints";
  return CollectionName2;
})(CollectionName || {});

// backend/_lib/auth/bootstrapService.ts
import crypto2 from "node:crypto";

// backend/_lib/apiError.ts
import { ZodError } from "zod";

// src/lib/validation.ts
import { z } from "zod";
var nisSchema = z.string().trim().min(4, "NIS minimal 4 karakter.").max(30, "NIS maksimal 30 karakter.").regex(/^[0-9A-Za-z-]+$/, "NIS hanya boleh berisi angka, huruf, atau tanda hubung.");
var niyNipSchema = z.string().trim().min(4, "NIY/NIP minimal 4 karakter.").max(30, "NIY/NIP maksimal 30 karakter.").regex(/^[0-9A-Za-z.\- ]+$/, "NIY/NIP mengandung karakter yang tidak diizinkan.");
var timeHHMMSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format jam harus HH:mm (contoh: 07:00).");
var dateYYYYMMDDSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.");
var coordinatesSchema = z.object({
  latitude: z.number().min(-90, "Latitude tidak valid.").max(90, "Latitude tidak valid."),
  longitude: z.number().min(-180, "Longitude tidak valid.").max(180, "Longitude tidak valid."),
  accuracyMeters: z.number().min(0).max(5e3).nullable().optional()
});
var paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
  cursor: z.string().trim().optional()
});
function formatZodErrors(error) {
  const fieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

// backend/_lib/apiError.ts
var ApiError = class _ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
  static badRequest(message, details) {
    return new _ApiError(400, "BAD_REQUEST", message, details);
  }
  static unauthorized(message = "Sesi tidak valid atau telah berakhir.") {
    return new _ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "Anda tidak memiliki hak akses untuk tindakan ini.") {
    return new _ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Data tidak ditemukan.") {
    return new _ApiError(404, "NOT_FOUND", message);
  }
  static conflict(message, details) {
    return new _ApiError(409, "CONFLICT", message, details);
  }
  static tooManyRequests(message = "Terlalu banyak percobaan. Silakan coba lagi nanti.") {
    return new _ApiError(429, "RATE_LIMITED", message);
  }
  static internal(message = "Terjadi kesalahan pada server.") {
    return new _ApiError(500, "INTERNAL_ERROR", message);
  }
};
function buildSuccessPayload(data, meta) {
  return {
    success: true,
    data,
    ...meta ? { meta } : {},
    serverTime: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function buildErrorPayload(error) {
  const serverTime = (/* @__PURE__ */ new Date()).toISOString();
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...error.details !== void 0 ? { details: error.details } : {}
        },
        serverTime
      }
    };
  }
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Data yang dikirim tidak valid.",
          details: formatZodErrors(error)
        },
        serverTime
      }
    };
  }
  console.error("[API_UNHANDLED_ERROR]", error);
  return {
    statusCode: 500,
    body: {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan internal pada server."
      },
      serverTime
    }
  };
}
function sendOk(res, data, statusCode = 200, meta) {
  res.status(statusCode).json(buildSuccessPayload(data, meta));
}
function sendError(res, error) {
  const { statusCode, body } = buildErrorPayload(error);
  res.status(statusCode).json(body);
}

// backend/_lib/auth/password.ts
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
var BCRYPT_ROUNDS = 10;
var DUMMY_PASSWORD_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}
async function verifyPassword(plainPassword, passwordHash) {
  const hashToCompare = passwordHash && passwordHash.length > 0 ? passwordHash : DUMMY_PASSWORD_HASH;
  const matched = await bcrypt.compare(plainPassword, hashToCompare);
  return Boolean(passwordHash && matched);
}
function generateRandomToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString("base64url");
}
function hashToken(rawToken) {
  const secretPepper = process.env.SESSION_SECRET ?? "";
  return crypto.createHash("sha256").update(`${secretPepper}:${rawToken}`).digest("hex");
}
function hashIpAddress(ip) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip.trim()).digest("hex").slice(0, 32);
}
function derivePasswordVaultKey() {
  const seed = process.env.SESSION_SECRET || "absensi-digital-local-vault-key-v1";
  return crypto.createHash("sha256").update(`pw-vault:${seed}`).digest();
}
function encryptPasswordForAdminView(plainPassword) {
  const key = derivePasswordVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainPassword, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}
function decryptPasswordForAdminView(payload) {
  if (!payload || !payload.startsWith("v1:")) return null;
  try {
    const parts = payload.split(":");
    if (parts.length !== 4) return null;
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const encrypted = Buffer.from(parts[3], "base64url");
    const key = derivePasswordVaultKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
var UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
var LOWER = "abcdefghijkmnopqrstuvwxyz";
var DIGITS = "23456789";
var SYMBOLS = "!@#$%&*?";
var ALL_CHARS = UPPER + LOWER + DIGITS + SYMBOLS;
function pickRandomChar(charset) {
  const idx = crypto.randomInt(0, charset.length);
  return charset[idx];
}
function generateTemporaryPassword(length = 12) {
  const required = [
    pickRandomChar(UPPER),
    pickRandomChar(LOWER),
    pickRandomChar(DIGITS),
    pickRandomChar(SYMBOLS)
  ];
  const remainingCount = Math.max(8, length) - required.length;
  const chars = [...required];
  for (let i = 0; i < remainingCount; i++) {
    chars.push(pickRandomChar(ALL_CHARS));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join("");
}

// backend/_lib/auth/audit.ts
var REDACTED_KEYS = /* @__PURE__ */ new Set([
  "password",
  "passwordHash",
  "currentPassword",
  "newPassword",
  "temporaryPassword",
  "sessionTokenHash",
  "tokenHash",
  "rawToken",
  "portalExitPassword",
  "portalExitPasswordHash",
  "privateKey",
  "secret"
]);
function sanitizeAuditSnapshot(obj) {
  if (!obj) return null;
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key)) continue;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      clean[key] = sanitizeAuditSnapshot(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}
async function recordActivityLog(repo, input) {
  await repo.collection("activityLogs" /* ACTIVITY_LOGS */).create({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: sanitizeAuditSnapshot(input.before),
    after: sanitizeAuditSnapshot(input.after),
    reason: input.reason ?? null,
    ipHash: hashIpAddress(input.clientIp)
  });
}

// backend/_lib/auth/uniqueUsername.ts
function normalizeUsername(raw) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}
function buildUsernameBaseFromName(fullName) {
  const slug = fullName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
  return slug || "guru";
}
function buildFirstNameUsernameBase(fullName) {
  const words = fullName.trim().toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter(Boolean);
  if (words.length === 0) return "guru";
  let candidate = words[0];
  let idx = 1;
  while (candidate.length < 3 && idx < words.length) {
    candidate += words[idx];
    idx++;
  }
  if (candidate.length < 3) {
    candidate = `${candidate}guru`.slice(0, 8);
  }
  return candidate.slice(0, 32);
}
async function reserveUniqueUsername(repo, username, userId) {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3) {
    throw ApiError.badRequest("Username minimal 3 karakter (huruf, angka, titik, atau garis bawah).");
  }
  if (/^__.*__$/.test(normalized)) {
    throw ApiError.badRequest("Username tidak boleh diawali dan diakhiri garis bawah ganda (__).");
  }
  const col = repo.collection("uniqueUsernames" /* UNIQUE_USERNAMES */);
  const existing = await col.getById(normalized);
  if (existing) {
    throw ApiError.conflict(`Username "${normalized}" sudah digunakan.`);
  }
  await col.create({
    id: normalized,
    normalizedUsername: normalized,
    userId
  });
  return normalized;
}
async function releaseUniqueUsername(repo, normalizedUsername) {
  await repo.collection("uniqueUsernames" /* UNIQUE_USERNAMES */).delete(normalizedUsername);
}
async function findAvailableUsername(repo, base) {
  const normalizedBase = normalizeUsername(base) || "user";
  const col = repo.collection("uniqueUsernames" /* UNIQUE_USERNAMES */);
  if (!/^__.*__$/.test(normalizedBase) && !await col.getById(normalizedBase)) {
    return normalizedBase;
  }
  for (let suffix = 2; suffix <= 999; suffix++) {
    const candidate = `${normalizedBase}${suffix}`;
    if (!/^__.*__$/.test(candidate) && !await col.getById(candidate)) {
      return candidate;
    }
  }
  throw ApiError.conflict("Tidak dapat menemukan username unik yang tersedia.");
}

// backend/_lib/seed/initialData.ts
var SEED_TIMESTAMP = "2026-07-01T00:00:00.000Z";
var RULE_EFFECTIVE_FROM = "2024-01-01T00:00:00.000Z";
var SEED_ACADEMIC_YEARS = [
  {
    id: "ay_2026_2027",
    label: "2026/2027",
    semester: "Ganjil",
    startDate: "2026-07-13T00:00:00.000Z",
    endDate: "2027-06-30T23:59:59.000Z",
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  }
];
var SEED_APP_SETTINGS = [
  {
    id: "default",
    appName: "Absensi Digital",
    pwaAppName: "MiFUL",
    schoolName: "MI Miftahul Ulum Sumberwuluh",
    schoolAddress: "Desa Sumberwuluh, Kecamatan Candipuro, Kabupaten Lumajang, Jawa Timur",
    schoolBio: "Madrasah Ibtidaiyah Miftahul Ulum Sumberwuluh \u2014 Sistem Kehadiran Digital Terpadu.",
    logoPath: "/images/school-logo.png",
    faviconPath: "/favicon.png",
    pwaIcon192Path: "/icons/pwa-192x192.png",
    pwaIcon512Path: "/icons/pwa-512x512.png",
    loginBackgroundPath: "/images/school-backdrop.jpg",
    theme: {
      primary: "#10264D",
      accent: "#C69B3C",
      background: "#FFFFFF"
    },
    timezone: "Asia/Jakarta",
    gpsEnabledForStudents: true,
    gpsEnabledForTeachers: true,
    teacherSelfServiceEnabled: true,
    portalScanMethod: "CAMERA_AND_USB",
    portalExitPasswordHash: "",
    voiceTemplates: {
      success: "ABSEN BERHASIL",
      failure: "ABSEN GAGAL",
      namedSuccess: "ABSEN ATAS NAMA {name} BERHASIL",
      late: "ABSEN BERHASIL, {name} TERCATAT TERLAMBAT",
      closed: "MAAF, WAKTU ABSENSI MASIH DITUTUP",
      alreadyRecorded: "ANDA SUDAH MELAKUKAN ABSENSI HARI INI"
    },
    photoRetentionDays: 90,
    quickLoginEnabled: false,
    bypassAttendanceTimeWindow: false,
    requireUserLinkedToTeacher: true,
    initialSeedCompleted: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  }
];
var FACTORY_APP_SETTINGS = {
  ...SEED_APP_SETTINGS[0],
  appName: "Absensi Digital",
  pwaAppName: "MiFUL",
  schoolName: "MI MIFTAHUL ULUM",
  schoolAddress: "Sumberwuluh - Candipuro - Lumajang",
  schoolBio: "Madrasah Ibtidaiyah Miftahul Ulum Sumberwuluh \u2014 Sistem Kehadiran Digital Terpadu.",
  logoPath: "/images/school-logo.png",
  faviconPath: "/favicon.png",
  pwaIcon192Path: "/icons/pwa-192x192.png",
  pwaIcon512Path: "/icons/pwa-512x512.png",
  loginBackgroundPath: "/images/school-backdrop.jpg",
  quickLoginEnabled: false,
  approvedPermissionAffectsRecap: true,
  requireUserLinkedToTeacher: true
};
var SEED_TEACHERS = [
  {
    id: "tch_06",
    niyNip: "20521133191001",
    fullName: "IMAM MUSTHOFA",
    position: "Kepala Sekolah",
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: "ACTIVE" /* ACTIVE */,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "tch_01",
    niyNip: "20521133197001",
    fullName: "NUR ANIFATUL IZZA",
    position: "Guru",
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: "ACTIVE" /* ACTIVE */,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "tch_02",
    niyNip: "20521133196004",
    fullName: "ZULKARNAIN NUR HARDIANSYAH",
    position: "Guru",
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: "ACTIVE" /* ACTIVE */,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "tch_03",
    niyNip: "20521133197002",
    fullName: "ISTIQOMARIYAH",
    position: "Guru",
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: "ACTIVE" /* ACTIVE */,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "tch_04",
    niyNip: "20521133104001",
    fullName: "NUR ANISA",
    position: "Guru",
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: "ACTIVE" /* ACTIVE */,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "tch_05",
    niyNip: "20596237101001",
    fullName: "HANIA AINUN NAFISA",
    position: "Guru",
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: "ACTIVE" /* ACTIVE */,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "tch_07",
    niyNip: "20521133193002",
    fullName: "MUHAMAD HASMINULLAH HASBULLAH",
    position: "Guru",
    photoPath: null,
    userId: null,
    qrTokenId: null,
    status: "ACTIVE" /* ACTIVE */,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  }
];
var CLASS_DEFINITIONS = [
  { name: "1A", gradeLevel: "1", homeroomTeacherId: "tch_01" },
  { name: "2A", gradeLevel: "2", homeroomTeacherId: "tch_02" },
  { name: "3A", gradeLevel: "3", homeroomTeacherId: "tch_03" },
  { name: "4A", gradeLevel: "4", homeroomTeacherId: "tch_04" },
  { name: "5A", gradeLevel: "5", homeroomTeacherId: "tch_05" },
  { name: "6A", gradeLevel: "6", homeroomTeacherId: "tch_07" }
];
var SEED_CLASSES = CLASS_DEFINITIONS.map((cls) => ({
  id: `cls_${cls.name.toLowerCase()}`,
  name: cls.name,
  gradeLevel: cls.gradeLevel,
  homeroomTeacherId: cls.homeroomTeacherId,
  academicYearId: "ay_2026_2027",
  capacity: 30,
  isActive: true,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP
}));
var RAW_DEMO_STUDENTS = [
  { nis: "90000001", fullName: "AHMAD FAQIH", className: "1A" },
  { nis: "90000002", fullName: "AISYAH ZAHRA", className: "1A" },
  { nis: "90000003", fullName: "MUHAMMAD RIZKI", className: "1A" },
  { nis: "90000004", fullName: "NADIA PUTRI", className: "1A" },
  { nis: "90000005", fullName: "FAHRI RAMADHAN", className: "2A" },
  { nis: "90000006", fullName: "SITI AULIA", className: "2A" },
  { nis: "90000007", fullName: "RAFI ALFARIZI", className: "2A" },
  { nis: "90000008", fullName: "NABILA SAFITRI", className: "2A" },
  { nis: "90000009", fullName: "DIMAS PRATAMA", className: "3A" },
  { nis: "90000010", fullName: "KHADIJAH HUMAIRA", className: "3A" },
  { nis: "90000011", fullName: "RAIHAN AKBAR", className: "3A" },
  { nis: "90000012", fullName: "ZAHRA NURFADILAH", className: "3A" },
  { nis: "90000013", fullName: "M. ILHAM", className: "4A" },
  { nis: "90000014", fullName: "AMIRA SALSABILA", className: "4A" },
  { nis: "90000015", fullName: "FIKRI MAULANA", className: "5A" },
  { nis: "90000016", fullName: "SALMA NADHIRA", className: "5A" },
  { nis: "90000017", fullName: "ALIF FATHUR", className: "5A" },
  { nis: "90000018", fullName: "NAZWA KHAIRUNNISA", className: "5A" },
  { nis: "90000019", fullName: "DAFFA ARYA", className: "6A" },
  { nis: "90000020", fullName: "HANA MAHARANI", className: "6A" },
  { nis: "90000021", fullName: "FARHAN HIDAYAT", className: "6A" },
  { nis: "90000022", fullName: "SYIFA AZZAHRA", className: "6A" },
  { nis: "90000023", fullName: "RIZAL MAULANA", className: "6A" },
  { nis: "90000024", fullName: "ALYA FITRIANI", className: "6A" }
];
var SEED_STUDENTS = RAW_DEMO_STUDENTS.map((s, index) => ({
  id: `std_${String(index + 1).padStart(2, "0")}`,
  nis: s.nis,
  fullName: s.fullName,
  classId: `cls_${s.className.toLowerCase()}`,
  photoPath: null,
  gender: null,
  status: "ACTIVE" /* ACTIVE */,
  qrTokenId: null,
  isDemo: false,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP
}));
var SEED_STUDENT_ENROLLMENTS = SEED_STUDENTS.map((student, index) => ({
  id: `enr_${String(index + 1).padStart(2, "0")}`,
  studentId: student.id,
  classId: student.classId,
  academicYearId: "ay_2026_2027",
  startDate: SEED_TIMESTAMP,
  endDate: null,
  status: "ACTIVE" /* ACTIVE */,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP
}));
var SEED_SUBJECTS = [
  { id: "sbj_mtk", name: "Matematika", code: "MTK", isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: "sbj_bind", name: "Bahasa Indonesia", code: "BIND", isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: "sbj_qh", name: "Al-Qur'an Hadis", code: "QH", isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: "sbj_aa", name: "Akidah Akhlak", code: "AA", isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: "sbj_fqh", name: "Fikih", code: "FQH", isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: "sbj_ski", name: "Sejarah Kebudayaan Islam", code: "SKI", isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: "sbj_bar", name: "Bahasa Arab", code: "BAR", isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: "sbj_ipas", name: "IPAS", code: "IPAS", isActive: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP }
];
var SEED_ATTENDANCE_RULES = [
  {
    id: "rule_student_lower",
    name: "Jam Absensi Kelas Rendah (1A\u20132A)",
    version: 1,
    audience: "STUDENT" /* STUDENT */,
    classIds: ["cls_1a", "cls_2a"],
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    checkInStart: "06:00",
    checkInDeadline: "07:30",
    lateAfter: "07:00",
    lateToleranceMinutes: 0,
    checkOutStart: "10:45",
    checkOutDeadline: "12:30",
    timezone: "Asia/Jakarta",
    gpsRequired: true,
    geofenceRequired: false,
    effectiveFrom: RULE_EFFECTIVE_FROM,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "rule_student_upper",
    name: "Jam Absensi Kelas Tinggi (3A\u20136A)",
    version: 1,
    audience: "STUDENT" /* STUDENT */,
    classIds: ["cls_3a", "cls_4a", "cls_5a", "cls_6a"],
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    checkInStart: "06:00",
    checkInDeadline: "07:30",
    lateAfter: "07:00",
    lateToleranceMinutes: 0,
    checkOutStart: "12:15",
    checkOutDeadline: "14:30",
    timezone: "Asia/Jakarta",
    gpsRequired: true,
    geofenceRequired: false,
    effectiveFrom: RULE_EFFECTIVE_FROM,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "rule_student_default",
    name: "Aturan Jam Absensi Siswa (Umum / Cadangan)",
    version: 1,
    audience: "STUDENT" /* STUDENT */,
    classIds: [],
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    checkInStart: "06:00",
    checkInDeadline: "07:30",
    lateAfter: "07:00",
    lateToleranceMinutes: 0,
    checkOutStart: "11:30",
    checkOutDeadline: "15:30",
    timezone: "Asia/Jakarta",
    gpsRequired: true,
    geofenceRequired: false,
    effectiveFrom: RULE_EFFECTIVE_FROM,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "rule_teacher_default",
    name: "Aturan Jam Absensi Guru & Tenaga Pendidik",
    version: 1,
    audience: "TEACHER" /* TEACHER */,
    classIds: [],
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    checkInStart: "06:00",
    checkInDeadline: "07:30",
    lateAfter: "07:00",
    lateToleranceMinutes: 5,
    checkOutStart: "13:30",
    checkOutDeadline: "16:30",
    timezone: "Asia/Jakarta",
    gpsRequired: true,
    geofenceRequired: true,
    effectiveFrom: RULE_EFFECTIVE_FROM,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  }
];
var SEED_SCHOOL_LOCATIONS = [
  {
    id: "loc_main",
    name: "MI Miftahul Ulum Sumberwuluh (Kampus Utama)",
    latitude: -8.2134,
    longitude: 113.0792,
    radiusMeters: 100,
    maxGpsAccuracyMeters: 50,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  }
];
var SEED_TEACHING_SCHEDULES = [
  {
    id: "sch_01",
    teacherId: "tch_01",
    subjectId: "sbj_mtk",
    classId: "cls_1a",
    dayOfWeek: 1,
    startTime: "07:15",
    endTime: "08:25",
    room: "Ruang 1A",
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "sch_02",
    teacherId: "tch_01",
    subjectId: "sbj_bind",
    classId: "cls_1a",
    dayOfWeek: 4,
    startTime: "07:15",
    endTime: "08:25",
    room: "Ruang 1A",
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "sch_03",
    teacherId: "tch_02",
    subjectId: "sbj_qh",
    classId: "cls_2a",
    dayOfWeek: 2,
    startTime: "07:15",
    endTime: "08:25",
    room: "Ruang 2A",
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "sch_04",
    teacherId: "tch_03",
    subjectId: "sbj_fqh",
    classId: "cls_3a",
    dayOfWeek: 3,
    startTime: "08:30",
    endTime: "09:40",
    room: "Ruang 3A",
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "sch_05",
    teacherId: "tch_04",
    subjectId: "sbj_ipas",
    classId: "cls_4a",
    dayOfWeek: 4,
    startTime: "08:30",
    endTime: "09:40",
    room: "Ruang 4A",
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "sch_06",
    teacherId: "tch_05",
    subjectId: "sbj_bar",
    classId: "cls_5a",
    dayOfWeek: 5,
    startTime: "07:15",
    endTime: "08:25",
    room: "Ruang 5A",
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "sch_07",
    teacherId: "tch_07",
    subjectId: "sbj_ski",
    classId: "cls_6a",
    dayOfWeek: 6,
    startTime: "07:15",
    endTime: "08:25",
    room: "Ruang 6A",
    effectiveFrom: SEED_TIMESTAMP,
    effectiveUntil: null,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  }
];
var SEED_HOLIDAYS = [
  {
    id: "hol_01",
    date: "2026-08-17",
    name: "Hari Kemerdekaan Republik Indonesia",
    scope: "SCHOOL" /* SCHOOL */,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  },
  {
    id: "hol_02",
    date: "2026-12-25",
    name: "Libur Nasional Akhir Tahun",
    scope: "SCHOOL" /* SCHOOL */,
    isActive: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  }
];
var FACTORY_ACADEMIC_YEARS = SEED_ACADEMIC_YEARS;
var FACTORY_TEACHERS = [];
var FACTORY_CLASSES = [];
var FACTORY_SUBJECTS = SEED_SUBJECTS;
var FACTORY_TEACHING_SCHEDULES = [];
var FACTORY_ATTENDANCE_RULES = [
  {
    ...SEED_ATTENDANCE_RULES[2],
    name: "Aturan Jam Absensi Siswa",
    classIds: []
  },
  SEED_ATTENDANCE_RULES[3]
];
var FACTORY_SCHOOL_LOCATIONS = SEED_SCHOOL_LOCATIONS;
var FACTORY_HOLIDAYS = SEED_HOLIDAYS;
var FACTORY_STUDENTS = [];
var FACTORY_STUDENT_ENROLLMENTS = [];

// backend/_lib/auth/bootstrapService.ts
function validateProvidedPassword(label, value) {
  if (!value || value.length < 8) {
    throw ApiError.badRequest(`Kata sandi ${label} minimal 8 karakter.`);
  }
}
async function bootstrapInitialAccounts(repo, passwords, clientIp) {
  validateProvidedPassword("Super Admin", passwords.superAdminPassword);
  if (passwords.adminPassword !== void 0) {
    validateProvidedPassword("Admin", passwords.adminPassword);
  }
  if (passwords.principalPassword !== void 0) {
    validateProvidedPassword("Kepala Sekolah", passwords.principalPassword);
  }
  const usersCol = repo.collection("users" /* USERS */);
  const existingCount = await usersCol.count();
  if (existingCount > 0) {
    throw ApiError.forbidden("Akun awal sudah diinisialisasi sebelumnya.");
  }
  const teachersRes = await repo.collection("teachers" /* TEACHERS */).list({
    sort: { field: "id", direction: "asc" }
  });
  const principalTeacher = teachersRes.items.find(
    (t) => t.niyNip === "20521133191001" || t.position.toLowerCase().includes("kepala sekolah")
  ) ?? null;
  const accounts = [];
  const createFixedAccount = async (params) => {
    const userId = `usr_${crypto2.randomBytes(6).toString("hex")}`;
    const normalizedUsername = await reserveUniqueUsername(repo, params.username, userId);
    const passwordHash = await hashPassword(params.password);
    await usersCol.create({
      id: userId,
      username: normalizedUsername,
      normalizedUsername,
      passwordHash,
      passwordCipher: encryptPasswordForAdminView(params.password),
      role: params.role,
      linkedTeacherId: params.linkedTeacherId,
      isActive: true,
      mustChangePassword: params.mustChangePassword,
      lastLoginAt: null,
      failedLoginCount: 0,
      lockedUntil: null
    });
    accounts.push({
      userId,
      username: normalizedUsername,
      role: params.role,
      fullName: params.fullName,
      linkedTeacherId: params.linkedTeacherId,
      mustChangePassword: params.mustChangePassword
    });
    return userId;
  };
  const superAdminId = await createFixedAccount({
    username: "superadmin",
    password: passwords.superAdminPassword,
    role: "SUPER_ADMIN" /* SUPER_ADMIN */,
    fullName: "Super Admin Sistem",
    linkedTeacherId: null,
    mustChangePassword: false
  });
  if (passwords.adminPassword) {
    await createFixedAccount({
      username: "admin",
      password: passwords.adminPassword,
      role: "ADMIN" /* ADMIN */,
      fullName: "Admin Operasional Sekolah",
      linkedTeacherId: null,
      mustChangePassword: false
    });
  }
  if (passwords.principalPassword) {
    await createFixedAccount({
      username: "kepsek",
      password: passwords.principalPassword,
      role: "PRINCIPAL" /* PRINCIPAL */,
      fullName: principalTeacher?.fullName ?? "Kepala Sekolah",
      linkedTeacherId: principalTeacher?.id ?? null,
      mustChangePassword: false
    });
  }
  for (const teacher of teachersRes.items) {
    const base = buildUsernameBaseFromName(teacher.fullName);
    const availableUsername = await findAvailableUsername(repo, base);
    const userId = `usr_${crypto2.randomBytes(6).toString("hex")}`;
    const normalizedUsername = await reserveUniqueUsername(repo, availableUsername, userId);
    const temporaryPassword = generateTemporaryPassword(12);
    const passwordHash = await hashPassword(temporaryPassword);
    await usersCol.create({
      id: userId,
      username: normalizedUsername,
      normalizedUsername,
      passwordHash,
      passwordCipher: encryptPasswordForAdminView(temporaryPassword),
      role: "TEACHER" /* TEACHER */,
      linkedTeacherId: teacher.id,
      isActive: true,
      mustChangePassword: false,
      lastLoginAt: null,
      failedLoginCount: 0,
      lockedUntil: null
    });
    await repo.collection("teachers" /* TEACHERS */).update(teacher.id, { userId });
    accounts.push({
      userId,
      username: normalizedUsername,
      role: "TEACHER" /* TEACHER */,
      fullName: teacher.fullName,
      linkedTeacherId: teacher.id,
      mustChangePassword: false,
      temporaryPassword
    });
  }
  const settingsCol = repo.collection("appSettings" /* APP_SETTINGS */);
  const currentSettings = await settingsCol.getById("default");
  const exitPlain = passwords.portalExitPassword?.trim() || "123";
  if (!currentSettings) {
    const portalExitPasswordHash = await hashPassword(exitPlain);
    const seedSettings = repo.mode === "real" ? FACTORY_APP_SETTINGS : SEED_APP_SETTINGS[0];
    const createdSettings = await settingsCol.create({
      ...seedSettings,
      id: "default",
      portalExitPasswordHash
    });
    await syncPublicSettingsMirror(repo, createdSettings);
  } else if (!currentSettings.portalExitPasswordHash) {
    const portalExitPasswordHash = await hashPassword(exitPlain);
    await settingsCol.update("default", { portalExitPasswordHash });
  }
  await recordActivityLog(repo, {
    actorUserId: superAdminId,
    actorRole: "SUPER_ADMIN" /* SUPER_ADMIN */,
    action: "ACCOUNTS_BOOTSTRAPPED",
    entityType: "USER",
    entityId: "bootstrap",
    after: { totalAccountsCreated: accounts.length },
    clientIp
  });
  return { accounts };
}
async function ensurePreviewAccountsInitialized(repo) {
  const settingsCol = repo.collection("appSettings" /* APP_SETTINGS */);
  const usersCol = repo.collection("users" /* USERS */);
  const [existingSettings, usersCount] = await Promise.all([
    settingsCol.getById("default"),
    usersCol.count()
  ]);
  const isRealMode = repo.mode === "real";
  const baselineSettings = isRealMode ? FACTORY_APP_SETTINGS : SEED_APP_SETTINGS[0];
  let resolvedSettings = existingSettings;
  if (!existingSettings) {
    const portalExitPasswordHash = await hashPassword(
      process.env.PORTAL_DEFAULT_EXIT_PASSWORD || "123"
    );
    const { id: _seedId, initialSeedCompleted: _omitSeedFlag, ...seedSettingsRest } = baselineSettings;
    resolvedSettings = await settingsCol.createIfNotExists("default", {
      ...seedSettingsRest,
      initialSeedCompleted: false,
      portalExitPasswordHash
    }).then((res) => res.doc);
  }
  const shouldSeedInitialCollections = !existingSettings?.initialSeedCompleted && usersCount === 0;
  if (shouldSeedInitialCollections) {
    const baseAcademicYears = isRealMode ? FACTORY_ACADEMIC_YEARS : SEED_ACADEMIC_YEARS;
    const baseLocations = isRealMode ? FACTORY_SCHOOL_LOCATIONS : SEED_SCHOOL_LOCATIONS;
    const baseRules = isRealMode ? FACTORY_ATTENDANCE_RULES : SEED_ATTENDANCE_RULES;
    const baseTeachers = isRealMode ? FACTORY_TEACHERS : SEED_TEACHERS;
    const baseClasses = isRealMode ? FACTORY_CLASSES : SEED_CLASSES;
    const baseSubjects = isRealMode ? FACTORY_SUBJECTS : SEED_SUBJECTS;
    const baseStudents = isRealMode ? FACTORY_STUDENTS : SEED_STUDENTS;
    const baseEnrollments = isRealMode ? FACTORY_STUDENT_ENROLLMENTS : SEED_STUDENT_ENROLLMENTS;
    const baseSchedules = isRealMode ? FACTORY_TEACHING_SCHEDULES : SEED_TEACHING_SCHEDULES;
    const baseHolidays = isRealMode ? FACTORY_HOLIDAYS : SEED_HOLIDAYS;
    const [
      ayCount,
      locCount,
      rulesCount,
      teachersCount,
      classesCount,
      subjectsCount,
      studentsCount,
      enrollmentsCount,
      schedulesCount,
      holidaysCount
    ] = await Promise.all([
      repo.collection("academicYears" /* ACADEMIC_YEARS */).count(),
      repo.collection("schoolLocations" /* SCHOOL_LOCATIONS */).count(),
      repo.collection("attendanceRules" /* ATTENDANCE_RULES */).count(),
      repo.collection("teachers" /* TEACHERS */).count(),
      repo.collection("classes" /* CLASSES */).count(),
      repo.collection("subjects" /* SUBJECTS */).count(),
      repo.collection("students" /* STUDENTS */).count(),
      repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */).count(),
      repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */).count(),
      repo.collection("holidays" /* HOLIDAYS */).count()
    ]);
    const seedTasks = [];
    if (ayCount === 0) {
      for (const item of baseAcademicYears) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection("academicYears" /* ACADEMIC_YEARS */).createIfNotExists(id, rest));
      }
    }
    if (locCount === 0) {
      for (const item of baseLocations) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection("schoolLocations" /* SCHOOL_LOCATIONS */).createIfNotExists(id, rest));
      }
    }
    if (rulesCount === 0) {
      for (const item of baseRules) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection("attendanceRules" /* ATTENDANCE_RULES */).createIfNotExists(id, rest));
      }
    }
    if (teachersCount === 0) {
      for (const item of baseTeachers) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection("teachers" /* TEACHERS */).createIfNotExists(id, rest));
      }
    }
    if (classesCount === 0) {
      for (const item of baseClasses) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection("classes" /* CLASSES */).createIfNotExists(id, rest));
      }
    }
    if (subjectsCount === 0) {
      for (const item of baseSubjects) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection("subjects" /* SUBJECTS */).createIfNotExists(id, rest));
      }
    }
    if (studentsCount === 0) {
      for (const item of baseStudents) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection("students" /* STUDENTS */).createIfNotExists(id, rest));
      }
    }
    if (enrollmentsCount === 0) {
      for (const item of baseEnrollments) {
        const { id, ...rest } = item;
        seedTasks.push(
          repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */).createIfNotExists(id, rest)
        );
      }
    }
    if (schedulesCount === 0) {
      for (const item of baseSchedules) {
        const { id, ...rest } = item;
        seedTasks.push(
          repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */).createIfNotExists(id, rest)
        );
      }
    }
    if (holidaysCount === 0) {
      for (const item of baseHolidays) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection("holidays" /* HOLIDAYS */).createIfNotExists(id, rest));
      }
    }
    if (seedTasks.length > 0) {
      await Promise.all(seedTasks);
    }
  }
  if (!existingSettings?.initialSeedCompleted) {
    const updated = await settingsCol.update("default", { initialSeedCompleted: true });
    if (updated) {
      resolvedSettings = updated;
    }
  }
  if (resolvedSettings) {
    const existingPublic = await repo.collection("publicSettings" /* PUBLIC_SETTINGS */).getById("default");
    if (!existingPublic) {
      await syncPublicSettingsMirror(repo, resolvedSettings);
    }
  }
  if (usersCount > 0) return;
  await bootstrapInitialAccounts(
    repo,
    isRealMode ? {
      superAdminPassword: process.env.PREVIEW_SUPERADMIN_PASSWORD || "superadmin123",
      portalExitPassword: process.env.PORTAL_DEFAULT_EXIT_PASSWORD || "123"
    } : {
      superAdminPassword: process.env.PREVIEW_SUPERADMIN_PASSWORD || "superadmin123",
      adminPassword: process.env.PREVIEW_ADMIN_PASSWORD || "admin123",
      principalPassword: process.env.PREVIEW_PRINCIPAL_PASSWORD || "kepsek123",
      portalExitPassword: process.env.PORTAL_DEFAULT_EXIT_PASSWORD || "123"
    },
    "127.0.0.1"
  );
  if (!isRealMode) {
    const teachersRes = await repo.collection("teachers" /* TEACHERS */).list({
      sort: { field: "id", direction: "asc" }
    });
    if (teachersRes.items.length > 0) {
      const demoTeacher = teachersRes.items.find((t) => !t.position.toLowerCase().includes("kepala sekolah")) ?? teachersRes.items[0] ?? null;
      const existingGuru = await repo.collection("uniqueUsernames" /* UNIQUE_USERNAMES */).getById("guru");
      if (!existingGuru) {
        const guruUserId = `usr_${crypto2.randomBytes(6).toString("hex")}`;
        const normalizedUsername = await reserveUniqueUsername(repo, "guru", guruUserId);
        const guruPlain = process.env.PREVIEW_TEACHER_PASSWORD || "Guru1234!";
        const passwordHash = await hashPassword(guruPlain);
        await usersCol.create({
          id: guruUserId,
          username: normalizedUsername,
          normalizedUsername,
          passwordHash,
          passwordCipher: encryptPasswordForAdminView(guruPlain),
          role: "TEACHER" /* TEACHER */,
          linkedTeacherId: demoTeacher?.id ?? null,
          isActive: true,
          mustChangePassword: false,
          lastLoginAt: null,
          failedLoginCount: 0,
          lockedUntil: null
        });
      }
    }
  }
}
async function syncPublicSettingsMirror(repo, settings) {
  const {
    id: _omitId,
    createdAt: _omitCreatedAt,
    updatedAt: _omitUpdatedAt,
    portalExitPasswordHash: _omitSecret,
    initialSeedCompleted: _omitSeedFlag,
    ...publicFields
  } = settings;
  const publicPayload = publicFields;
  const publicCol = repo.collection("publicSettings" /* PUBLIC_SETTINGS */);
  const existing = await publicCol.getById("default");
  if (existing) {
    await publicCol.update("default", publicPayload);
  } else {
    await publicCol.createIfNotExists("default", publicPayload);
  }
}

// backend/_lib/repository/index.ts
import path2 from "node:path";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0062226420",
  appId: "1:8805791666:web:da4a3e595572277452d6ab",
  apiKey: "AIzaSyBsfjrLAtCMjC0lVd_2J7Drd8AhH4llgMA",
  authDomain: "gen-lang-client-0062226420.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-mifulabsensidigi-eb54e4c2-82ec-4359-869e-ca7daaf5c8db",
  storageBucket: "gen-lang-client-0062226420.firebasestorage.app",
  messagingSenderId: "8805791666",
  measurementId: "",
  oAuthClientId: "8805791666-pj2gu2h44cmgpahoao9cjd5gmlgfrbcn.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// src/lib/firebaseConfig.ts
var firebaseWebConfig = {
  apiKey: firebase_applet_config_default.apiKey,
  authDomain: firebase_applet_config_default.authDomain,
  projectId: firebase_applet_config_default.projectId,
  storageBucket: firebase_applet_config_default.storageBucket,
  messagingSenderId: firebase_applet_config_default.messagingSenderId,
  appId: firebase_applet_config_default.appId,
  measurementId: firebase_applet_config_default.measurementId,
  firestoreDatabaseId: firebase_applet_config_default.firestoreDatabaseId
};

// backend/_lib/config/firebase.ts
var BOOTSTRAPPED_ADMIN_EMAIL = process.env.BOOTSTRAPPED_ADMIN_EMAIL?.trim() || "pondokdarulmukhlisin@gmail.com";
function getDataMode() {
  if (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)) {
    return "mock";
  }
  if (process.env.VERCEL === "1") {
    return "real";
  }
  const raw = (process.env.DATA_MODE ?? "").trim().toLowerCase();
  if (raw === "mock") return "mock";
  return "real";
}
function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}
function getServerFirebaseConfig() {
  const dataMode = getDataMode();
  const projectId = stripWrappingQuotes(
    process.env.FIREBASE_PROJECT_ID ?? firebaseWebConfig.projectId
  );
  const databaseId = stripWrappingQuotes(
    process.env.FIREBASE_DATABASE_ID ?? firebaseWebConfig.firestoreDatabaseId ?? "(default)"
  ) || "(default)";
  const storageBucket = stripWrappingQuotes(
    process.env.FIREBASE_STORAGE_BUCKET ?? firebaseWebConfig.storageBucket
  );
  const apiKey = stripWrappingQuotes(
    process.env.FIREBASE_WEB_API_KEY ?? firebaseWebConfig.apiKey
  );
  const clientEmail = stripWrappingQuotes(process.env.FIREBASE_CLIENT_EMAIL ?? "");
  const privateKey = stripWrappingQuotes(process.env.FIREBASE_PRIVATE_KEY ?? "").replace(
    /\\n/g,
    "\n"
  );
  const authMode = clientEmail && privateKey ? "service_account" : "web_api_key";
  return {
    dataMode,
    authMode,
    projectId,
    databaseId,
    storageBucket,
    apiKey,
    clientEmail,
    privateKey
  };
}
function assertRealFirestoreCredentials(config) {
  if (!config.projectId) {
    throw new Error("FIREBASE_PROJECT_ID tidak tersedia pada konfigurasi Firebase.");
  }
  if (config.authMode === "web_api_key" && !config.apiKey) {
    throw new Error("Web API Key Firebase tidak tersedia pada firebaseWebConfig.");
  }
  if (config.authMode === "service_account" && (!config.clientEmail || !config.privateKey)) {
    throw new Error(
      "Konfigurasi Service Account Firestore belum lengkap."
    );
  }
}

// backend/_lib/repository/firestoreRestRepository.ts
import crypto3 from "node:crypto";

// backend/_lib/repository/firestoreConverter.ts
var ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
function toFirestoreValue(value) {
  if (value === null || value === void 0) {
    return { nullValue: null };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { nullValue: null };
    }
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (typeof value === "string") {
    if (ISO_TIMESTAMP_REGEX.test(value)) {
      return { timestampValue: value };
    }
    return { stringValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item))
      }
    };
  }
  if (typeof value === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== void 0) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}
function fromFirestoreValue(value) {
  if (!value || "nullValue" in value) {
    return null;
  }
  if ("booleanValue" in value) {
    return value.booleanValue;
  }
  if ("integerValue" in value) {
    return Number(value.integerValue);
  }
  if ("doubleValue" in value) {
    return Number(value.doubleValue);
  }
  if ("timestampValue" in value) {
    return value.timestampValue;
  }
  if ("stringValue" in value) {
    return value.stringValue;
  }
  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((item) => fromFirestoreValue(item));
  }
  if ("mapValue" in value) {
    const out = {};
    const fields = value.mapValue.fields ?? {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}
function extractDocumentId(resourceName) {
  if (!resourceName) return "";
  const segments = resourceName.split("/");
  return segments[segments.length - 1] ?? "";
}
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === "id" || val === void 0) continue;
    fields[key] = toFirestoreValue(val);
  }
  return fields;
}
function fromFirestoreDocument(doc) {
  const result = {
    id: extractDocumentId(doc.name)
  };
  if (doc.fields) {
    for (const [key, val] of Object.entries(doc.fields)) {
      result[key] = fromFirestoreValue(val);
    }
  }
  if (!result.createdAt && doc.createTime) {
    result.createdAt = doc.createTime;
  }
  if (!result.updatedAt && doc.updateTime) {
    result.updatedAt = doc.updateTime;
  }
  return result;
}

// backend/_lib/repository/firestoreRestRepository.ts
var FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
var GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function isValidFirestoreDocumentId(id) {
  if (typeof id !== "string" || id.length === 0) return false;
  if (id === "." || id === "..") return false;
  if (id.includes("\0")) return false;
  if (/^__.*__$/.test(id)) return false;
  if (Buffer.byteLength(id, "utf8") > 1500) return false;
  return true;
}
function mapOperatorToFirestore(op) {
  switch (op) {
    case "==":
      return "EQUAL";
    case "!=":
      return "NOT_EQUAL";
    case "<":
      return "LESS_THAN";
    case "<=":
      return "LESS_THAN_OR_EQUAL";
    case ">":
      return "GREATER_THAN";
    case ">=":
      return "GREATER_THAN_OR_EQUAL";
    case "in":
      return "IN";
    case "array-contains":
      return "ARRAY_CONTAINS";
  }
}
function matchesFilter(doc, filter) {
  const fieldValue = doc[filter.field];
  const target = filter.value;
  switch (filter.op) {
    case "==":
      return fieldValue === target;
    case "!=":
      return fieldValue !== target;
    case "<":
      return fieldValue < target;
    case "<=":
      return fieldValue <= target;
    case ">":
      return fieldValue > target;
    case ">=":
      return fieldValue >= target;
    case "in":
      return Array.isArray(target) && target.includes(fieldValue);
    case "array-contains":
      return Array.isArray(fieldValue) && fieldValue.includes(target);
    default:
      return false;
  }
}
var ServiceAccountTokenClient = class {
  constructor(config) {
    this.cache = null;
    this.config = config;
  }
  async getAccessToken() {
    assertRealFirestoreCredentials(this.config);
    const nowMs = Date.now();
    if (this.cache && nowMs < this.cache.expiresAtMs - 6e4) {
      return this.cache.accessToken;
    }
    const nowSec = Math.floor(nowMs / 1e3);
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64UrlEncode(
      JSON.stringify({
        iss: this.config.clientEmail,
        scope: FIRESTORE_SCOPE,
        aud: GOOGLE_TOKEN_URI,
        iat: nowSec,
        exp: nowSec + 3600
      })
    );
    const signingInput = `${header}.${payload}`;
    const signer = crypto3.createSign("RSA-SHA256");
    signer.update(signingInput);
    signer.end();
    const signature = base64UrlEncode(signer.sign(this.config.privateKey));
    const assertion = `${signingInput}.${signature}`;
    const response = await fetch(GOOGLE_TOKEN_URI, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gagal memperoleh OAuth2 token Google (${response.status}): ${errorText}`);
    }
    const tokenJson = await response.json();
    const expiresInSec = tokenJson.expires_in ?? 3600;
    this.cache = {
      accessToken: tokenJson.access_token,
      expiresAtMs: nowMs + expiresInSec * 1e3
    };
    return this.cache.accessToken;
  }
};
var FirestoreRestCollectionRepository = class {
  constructor(collectionName, config, tokenClient) {
    this.collectionName = collectionName;
    this.config = config;
    this.tokenClient = tokenClient;
  }
  get documentsRootUrl() {
    const dbId = this.config.databaseId?.trim() || "(default)";
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      this.config.projectId
    )}/databases/${encodeURIComponent(dbId)}/documents`;
  }
  buildAuthenticatedUrl(url) {
    if (this.config.authMode === "web_api_key") {
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}key=${encodeURIComponent(this.config.apiKey)}`;
    }
    return url;
  }
  async buildAuthHeaders(extra = {}) {
    assertRealFirestoreCredentials(this.config);
    if (this.config.authMode === "service_account") {
      const token = await this.tokenClient.getAccessToken();
      return {
        Authorization: `Bearer ${token}`,
        ...extra
      };
    }
    return { ...extra };
  }
  async request(url, init = {}) {
    const authHeaders = await this.buildAuthHeaders({
      "Content-Type": "application/json"
    });
    const response = await fetch(this.buildAuthenticatedUrl(url), {
      ...init,
      headers: {
        ...authHeaders,
        ...init.headers
      }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firestore REST error (${response.status}): ${text}`);
    }
    if (response.status === 204) {
      return void 0;
    }
    return await response.json();
  }
  async getById(id) {
    if (!isValidFirestoreDocumentId(id)) {
      return null;
    }
    const headers = await this.buildAuthHeaders();
    const url = this.buildAuthenticatedUrl(
      `${this.documentsRootUrl}/${this.collectionName}/${encodeURIComponent(id)}`
    );
    const response = await fetch(url, { headers });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firestore REST getById error (${response.status}): ${text}`);
    }
    const doc = await response.json();
    return fromFirestoreDocument(doc);
  }
  async list(options = {}) {
    const filters = options.filters ?? [];
    const structuredQuery = {
      from: [{ collectionId: this.collectionName }]
    };
    let pushedFilterIndex = -1;
    if (filters.length === 1) {
      pushedFilterIndex = 0;
    } else if (filters.length > 1) {
      pushedFilterIndex = filters.findIndex((f) => f.op === "==");
    }
    if (pushedFilterIndex >= 0) {
      const f = filters[pushedFilterIndex];
      structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: f.field },
          op: mapOperatorToFirestore(f.op),
          value: toFirestoreValue(f.value)
        }
      };
    }
    if (filters.length <= 1 && !options.sort && !options.cursor && !options.offset && typeof options.limit === "number" && options.limit > 0) {
      structuredQuery.limit = options.limit;
    }
    const rows = await this.request(
      `${this.documentsRootUrl}:runQuery`,
      {
        method: "POST",
        body: JSON.stringify({ structuredQuery })
      }
    );
    let items = rows.filter((row) => Boolean(row.document)).map((row) => fromFirestoreDocument(row.document));
    if (filters.length > 0) {
      items = items.filter((doc) => filters.every((f) => matchesFilter(doc, f)));
    }
    if (options.sort) {
      const { field, direction } = options.sort;
      items.sort((a, b) => {
        const av = a[field];
        const bv = b[field];
        if (av === bv) return 0;
        if (av === null || av === void 0) return 1;
        if (bv === null || bv === void 0) return -1;
        const cmp = String(av).localeCompare(String(bv), "id", { numeric: true });
        return direction === "desc" ? -cmp : cmp;
      });
    }
    const total = items.length;
    let startIndex = options.offset ?? 0;
    if (options.cursor) {
      const cursorIdx = items.findIndex((item) => item.id === options.cursor);
      if (cursorIdx >= 0) {
        startIndex = cursorIdx + 1;
      }
    }
    const sliced = typeof options.limit === "number" && options.limit > 0 ? items.slice(startIndex, startIndex + options.limit) : items.slice(startIndex);
    const hasMore = startIndex + sliced.length < total;
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1].id : null;
    return {
      items: sliced,
      total,
      nextCursor
    };
  }
  async findFirst(filters) {
    const result = await this.list({ filters, limit: 1 });
    return result.items[0] ?? null;
  }
  async create(data) {
    if (data.id !== void 0 && !isValidFirestoreDocumentId(data.id)) {
      throw ApiError.badRequest("ID dokumen tidak valid untuk penyimpanan database.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const payload = {
      ...data,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now
    };
    const querySuffix = data.id ? `?documentId=${encodeURIComponent(data.id)}` : "";
    const doc = await this.request(
      `${this.documentsRootUrl}/${this.collectionName}${querySuffix}`,
      {
        method: "POST",
        body: JSON.stringify({ fields: toFirestoreFields(payload) })
      }
    );
    return fromFirestoreDocument(doc);
  }
  async createIfNotExists(id, data) {
    if (!isValidFirestoreDocumentId(id)) {
      throw ApiError.badRequest("ID dokumen tidak valid untuk penyimpanan database.");
    }
    const headers = await this.buildAuthHeaders({ "Content-Type": "application/json" });
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const payload = {
      ...data,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now
    };
    const url = this.buildAuthenticatedUrl(
      `${this.documentsRootUrl}/${this.collectionName}?documentId=${encodeURIComponent(id)}`
    );
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ fields: toFirestoreFields(payload) })
    });
    if (response.status === 409) {
      const existing = await this.getById(id);
      if (existing) {
        return { created: false, doc: existing };
      }
      throw new Error(`Dokumen ${this.collectionName}/${id} mengalami konflik pembuatan.`);
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firestore REST createIfNotExists error (${response.status}): ${text}`);
    }
    const doc = await response.json();
    return { created: true, doc: fromFirestoreDocument(doc) };
  }
  async update(id, patch) {
    const existing = await this.getById(id);
    if (!existing) return null;
    const payload = {
      ...patch,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const fieldPaths = Object.keys(payload).filter((k) => k !== "id" && payload[k] !== void 0);
    const maskParams = fieldPaths.map((fp) => `updateMask.fieldPaths=${encodeURIComponent(fp)}`).join("&");
    const doc = await this.request(
      `${this.documentsRootUrl}/${this.collectionName}/${encodeURIComponent(id)}?${maskParams}`,
      {
        method: "PATCH",
        body: JSON.stringify({ fields: toFirestoreFields(payload) })
      }
    );
    return fromFirestoreDocument(doc);
  }
  async delete(id) {
    const existing = await this.getById(id);
    if (!existing) return false;
    await this.request(
      `${this.documentsRootUrl}/${this.collectionName}/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    return true;
  }
  async count(filters) {
    const result = await this.list({ filters });
    return result.total;
  }
};
var FirestoreRestRepository = class {
  constructor(config = getServerFirebaseConfig()) {
    this.mode = "real";
    this.config = config;
    this.tokenClient = new ServiceAccountTokenClient(config);
  }
  collection(name) {
    return new FirestoreRestCollectionRepository(
      name,
      this.config,
      this.tokenClient
    );
  }
};

// backend/_lib/repository/mockRepository.ts
import crypto4 from "node:crypto";
import fs from "node:fs";
import path from "node:path";
function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
function matchesFilter2(doc, filter) {
  const fieldValue = doc[filter.field];
  const target = filter.value;
  switch (filter.op) {
    case "==":
      return fieldValue === target;
    case "!=":
      return fieldValue !== target;
    case "<":
      return fieldValue < target;
    case "<=":
      return fieldValue <= target;
    case ">":
      return fieldValue > target;
    case ">=":
      return fieldValue >= target;
    case "in":
      return Array.isArray(target) && target.includes(fieldValue);
    case "array-contains":
      return Array.isArray(fieldValue) && fieldValue.includes(target);
    default:
      return false;
  }
}
var MockCollectionRepository = class {
  constructor(getStore, hooks) {
    this.getStore = getStore;
    this.onBeforeRead = hooks?.onBeforeRead;
    this.onBeforeWrite = hooks?.onBeforeWrite;
    this.onMutate = hooks?.onMutate;
  }
  async getById(id) {
    this.onBeforeRead?.();
    const found = this.getStore().get(id);
    return found ? deepClone(found) : null;
  }
  async list(options = {}) {
    this.onBeforeRead?.();
    let items = Array.from(this.getStore().values()).map((doc) => deepClone(doc));
    if (options.filters && options.filters.length > 0) {
      items = items.filter((doc) => options.filters.every((f) => matchesFilter2(doc, f)));
    }
    if (options.sort) {
      const { field, direction } = options.sort;
      items.sort((a, b) => {
        const av = a[field];
        const bv = b[field];
        if (av === bv) return 0;
        if (av === null || av === void 0) return 1;
        if (bv === null || bv === void 0) return -1;
        const cmp = String(av).localeCompare(String(bv), "id", { numeric: true });
        return direction === "desc" ? -cmp : cmp;
      });
    }
    const total = items.length;
    let startIndex = options.offset ?? 0;
    if (options.cursor) {
      const cursorIdx = items.findIndex((item) => item.id === options.cursor);
      if (cursorIdx >= 0) {
        startIndex = cursorIdx + 1;
      }
    }
    const sliced = typeof options.limit === "number" ? items.slice(startIndex, startIndex + options.limit) : items.slice(startIndex);
    const hasMore = startIndex + sliced.length < total;
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1].id : null;
    return {
      items: sliced,
      total,
      nextCursor
    };
  }
  async findFirst(filters) {
    const res = await this.list({ filters, limit: 1 });
    return res.items[0] ?? null;
  }
  async create(data) {
    this.onBeforeWrite?.();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const id = data.id ?? crypto4.randomBytes(8).toString("hex");
    const doc = {
      ...deepClone(data),
      id,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now
    };
    this.getStore().set(id, deepClone(doc));
    this.onMutate?.();
    return deepClone(doc);
  }
  async createIfNotExists(id, data) {
    this.onBeforeWrite?.();
    const existing = this.getStore().get(id);
    if (existing) {
      return { created: false, doc: deepClone(existing) };
    }
    const created = await this.create({ ...data, id });
    return { created: true, doc: created };
  }
  async update(id, patch) {
    this.onBeforeWrite?.();
    const store = this.getStore();
    const existing = store.get(id);
    if (!existing) return null;
    const updated = {
      ...deepClone(existing),
      ...deepClone(patch),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    store.set(id, deepClone(updated));
    this.onMutate?.();
    return deepClone(updated);
  }
  async delete(id) {
    this.onBeforeWrite?.();
    const deleted = this.getStore().delete(id);
    if (deleted) {
      this.onMutate?.();
    }
    return deleted;
  }
  async count(filters) {
    const res = await this.list({ filters });
    return res.total;
  }
};
var MockRepository = class {
  constructor(options = {}) {
    this.mode = "mock";
    this.collections = /* @__PURE__ */ new Map();
    this.lastDiskMtimeMs = 0;
    this.persistFilePath = options.persistFilePath ?? null;
    for (const name of Object.values(CollectionName)) {
      this.collections.set(name, /* @__PURE__ */ new Map());
    }
    const loaded = this.loadFromDisk();
    if (!loaded) {
      this.seedInitialData();
      this.saveToDisk();
    }
  }
  syncFromDiskIfNewer() {
    if (!this.persistFilePath) return;
    try {
      if (!fs.existsSync(this.persistFilePath)) return;
      const stat = fs.statSync(this.persistFilePath);
      if (stat.mtimeMs > this.lastDiskMtimeMs) {
        this.loadFromDisk();
      }
    } catch {
    }
  }
  loadFromDisk() {
    if (!this.persistFilePath) return false;
    try {
      if (!fs.existsSync(this.persistFilePath)) return false;
      const stat = fs.statSync(this.persistFilePath);
      const raw = fs.readFileSync(this.persistFilePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return false;
      let hasAnyRecords = false;
      for (const name of Object.values(CollectionName)) {
        const docs = parsed[name];
        const map = this.collections.get(name);
        if (Array.isArray(docs)) {
          map.clear();
          for (const doc of docs) {
            if (doc && typeof doc.id === "string") {
              map.set(doc.id, deepClone(doc));
              hasAnyRecords = true;
            }
          }
        }
      }
      if (hasAnyRecords) {
        this.lastDiskMtimeMs = stat.mtimeMs;
      }
      return hasAnyRecords;
    } catch {
      return false;
    }
  }
  saveToDisk() {
    if (!this.persistFilePath) return;
    try {
      const dir = path.dirname(this.persistFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const snapshot = {};
      for (const [name, map] of this.collections.entries()) {
        snapshot[name] = Array.from(map.values());
      }
      const tempPath = `${this.persistFilePath}.${process.pid}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(snapshot), "utf8");
      fs.renameSync(tempPath, this.persistFilePath);
      const stat = fs.statSync(this.persistFilePath);
      this.lastDiskMtimeMs = stat.mtimeMs;
    } catch {
    }
  }
  putAll(name, records) {
    const map = this.collections.get(name);
    for (const record of records) {
      map.set(record.id, deepClone(record));
    }
  }
  seedInitialData() {
    this.putAll("appSettings" /* APP_SETTINGS */, SEED_APP_SETTINGS);
    this.putAll("academicYears" /* ACADEMIC_YEARS */, SEED_ACADEMIC_YEARS);
    this.putAll("teachers" /* TEACHERS */, SEED_TEACHERS);
    this.putAll("classes" /* CLASSES */, SEED_CLASSES);
    this.putAll("students" /* STUDENTS */, SEED_STUDENTS);
    this.putAll("studentEnrollments" /* STUDENT_ENROLLMENTS */, SEED_STUDENT_ENROLLMENTS);
    this.putAll("subjects" /* SUBJECTS */, SEED_SUBJECTS);
    this.putAll("attendanceRules" /* ATTENDANCE_RULES */, SEED_ATTENDANCE_RULES);
    this.putAll("schoolLocations" /* SCHOOL_LOCATIONS */, SEED_SCHOOL_LOCATIONS);
    this.putAll("teachingSchedules" /* TEACHING_SCHEDULES */, SEED_TEACHING_SCHEDULES);
    this.putAll("holidays" /* HOLIDAYS */, SEED_HOLIDAYS);
  }
  collection(name) {
    return new MockCollectionRepository(
      () => this.collections.get(name),
      this.persistFilePath ? {
        onBeforeRead: () => this.syncFromDiskIfNewer(),
        onBeforeWrite: () => this.syncFromDiskIfNewer(),
        onMutate: () => this.saveToDisk()
      } : void 0
    );
  }
};

// backend/_lib/repository/index.ts
var singletonRepo = null;
var singletonMode = null;
function getRepository() {
  const mode = getDataMode();
  if (!singletonRepo || singletonMode !== mode) {
    singletonMode = mode;
    const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
    const persistFilePath = mode === "mock" && !isTestEnv ? process.env.VERCEL === "1" ? "/tmp/absensi-mock-db.json" : path2.resolve(process.cwd(), ".local-data/mock-db.json") : void 0;
    singletonRepo = mode === "real" ? new FirestoreRestRepository(getServerFirebaseConfig()) : new MockRepository(persistFilePath ? { persistFilePath } : {});
  }
  return singletonRepo;
}

// backend/_lib/storage/privateStorage.ts
import crypto5 from "node:crypto";

// src/lib/permissionValidation.ts
import { z as z2 } from "zod";
var ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf"
];
var MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
var MAX_PERMISSION_ATTACHMENTS = 3;
var permissionAttachmentUploadSchema = z2.object({
  dataUrl: z2.string().min(30, "Data berkas lampiran tidak valid."),
  mimeType: z2.enum(ALLOWED_ATTACHMENT_MIME_TYPES, {
    message: "Lampiran hanya mendukung format JPEG, PNG, atau PDF."
  }),
  fileName: z2.string().trim().min(1).max(160).optional(),
  category: z2.literal("PERMISSION_ATTACHMENT" /* PERMISSION_ATTACHMENT */).default("PERMISSION_ATTACHMENT" /* PERMISSION_ATTACHMENT */)
});
var permissionCreateSchema = z2.object({
  leaveType: z2.enum([
    "SICK" /* SICK */,
    "PERSONAL" /* PERSONAL */,
    "OFFICIAL_DUTY" /* OFFICIAL_DUTY */,
    "OTHER" /* OTHER */
  ]),
  startAt: z2.string().min(10, "Tanggal/waktu mulai wajib diisi."),
  endAt: z2.string().min(10, "Tanggal/waktu selesai wajib diisi."),
  reason: z2.string().trim().min(8, "Alasan pengajuan izin wajib diisi minimal 8 karakter.").max(1e3, "Alasan maksimal 1000 karakter."),
  attachmentFileIds: z2.array(z2.string().trim().min(4)).max(MAX_PERMISSION_ATTACHMENTS, `Maksimal ${MAX_PERMISSION_ATTACHMENTS} berkas lampiran.`).optional().default([])
}).refine(
  (d) => {
    const s = new Date(d.startAt).getTime();
    const e = new Date(d.endAt).getTime();
    return Number.isFinite(s) && Number.isFinite(e) && e >= s;
  },
  {
    message: "Waktu selesai izin harus sama dengan atau setelah waktu mulai.",
    path: ["endAt"]
  }
);
var permissionAdminReviewSchema = z2.object({
  decision: z2.enum(["RECOMMEND_APPROVE" /* RECOMMEND_APPROVE */, "RETURN" /* RETURN */]),
  note: z2.string().trim().max(500).optional().default("")
}).refine(
  (d) => d.decision !== "RETURN" /* RETURN */ || d.note.trim().length >= 5,
  {
    message: "Catatan wajib diisi minimal 5 karakter saat mengembalikan pengajuan ke guru.",
    path: ["note"]
  }
);
var permissionPrincipalDecisionSchema = z2.object({
  decision: z2.enum(["APPROVE" /* APPROVE */, "REJECT" /* REJECT */]),
  note: z2.string().trim().max(500).optional().default("")
}).refine(
  (d) => d.decision !== "REJECT" /* REJECT */ || d.note.trim().length >= 5,
  {
    message: "Catatan wajib diisi minimal 5 karakter saat menolak pengajuan izin.",
    path: ["note"]
  }
);
var permissionCancelSchema = z2.object({
  reason: z2.string().trim().max(300).optional().default("")
});
var PERMISSION_LEAVE_TYPE_LABELS = {
  ["SICK" /* SICK */]: "Sakit",
  ["PERSONAL" /* PERSONAL */]: "Izin Pribadi",
  ["OFFICIAL_DUTY" /* OFFICIAL_DUTY */]: "Tugas Dinas",
  ["OTHER" /* OTHER */]: "Lainnya"
};
var PERMISSION_STATUS_LABELS = {
  ["SUBMITTED" /* SUBMITTED */]: "Diajukan (Menunggu Admin)",
  ["ADMIN_REVIEWED" /* ADMIN_REVIEWED */]: "Diverifikasi Admin (Menunggu Kepsek)",
  ["RETURNED" /* RETURNED */]: "Dikembalikan ke Guru",
  ["APPROVED" /* APPROVED */]: "Disetujui",
  ["REJECTED" /* REJECTED */]: "Ditolak",
  ["CANCELLED" /* CANCELLED */]: "Dibatalkan"
};
function validatePermissionTransition(current, next) {
  if (current === "APPROVED" /* APPROVED */ || current === "REJECTED" /* REJECTED */ || current === "CANCELLED" /* CANCELLED */) {
    return {
      allowed: false,
      reason: `Pengajuan izin berstatus ${PERMISSION_STATUS_LABELS[current]} sudah bersifat final dan tidak dapat diubah lagi.`
    };
  }
  if (next === "APPROVED" /* APPROVED */ || next === "REJECTED" /* REJECTED */) {
    if (current !== "ADMIN_REVIEWED" /* ADMIN_REVIEWED */) {
      return {
        allowed: false,
        reason: "Urutan persetujuan tidak valid: pengajuan izin wajib diverifikasi Admin terlebih dahulu sebelum diputuskan Kepala Sekolah."
      };
    }
    return { allowed: true };
  }
  if (next === "ADMIN_REVIEWED" /* ADMIN_REVIEWED */ || next === "RETURNED" /* RETURNED */) {
    if (current !== "SUBMITTED" /* SUBMITTED */) {
      return {
        allowed: false,
        reason: "Hanya pengajuan berstatus SUBMITTED yang dapat ditinjau oleh Admin."
      };
    }
    return { allowed: true };
  }
  if (next === "CANCELLED" /* CANCELLED */) {
    return { allowed: true };
  }
  if (next === "SUBMITTED" /* SUBMITTED */ && current === "RETURNED" /* RETURNED */) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Transisi status dari ${current} ke ${next} tidak diizinkan.`
  };
}

// src/lib/teacherAttendanceValidation.ts
import { z as z3 } from "zod";
var ALLOWED_SELFIE_MIME_TYPES = ["image/jpeg", "image/png"];
var MAX_SELFIE_BYTES = 2 * 1024 * 1024;
var selfieUploadSchema = z3.object({
  dataUrl: z3.string().min(30, "Data gambar selfie tidak valid."),
  mimeType: z3.enum(ALLOWED_SELFIE_MIME_TYPES, {
    message: "Format foto hanya mendukung JPEG atau PNG."
  }),
  category: z3.literal("ATTENDANCE_SELFIE" /* ATTENDANCE_SELFIE */).default("ATTENDANCE_SELFIE" /* ATTENDANCE_SELFIE */),
  ownerType: z3.enum(["TEACHER" /* TEACHER */, "STUDENT" /* STUDENT */]).default("TEACHER" /* TEACHER */),
  ownerId: z3.string().trim().min(1).optional()
});
var teacherSelfAttendanceSchema = z3.object({
  eventType: z3.enum(["CHECK_IN" /* CHECK_IN */, "CHECK_OUT" /* CHECK_OUT */, "AUTO"]).default("AUTO"),
  latitude: z3.number().min(-90, "Latitude tidak valid.").max(90, "Latitude tidak valid.").nullable().optional().default(null),
  longitude: z3.number().min(-180, "Longitude tidak valid.").max(180, "Longitude tidak valid.").nullable().optional().default(null),
  gpsAccuracyMeters: z3.number().min(0, "Akurasi GPS tidak valid.").max(1e5, "Akurasi GPS tidak valid.").nullable().optional().default(null),
  selfieFileId: z3.string().trim().min(4, "Foto selfie wajib diunggah sebelum absen."),
  idempotencyKey: z3.string().trim().min(8, "Idempotency key minimal 8 karakter.").max(128),
  clientTimestamp: z3.string().nullable().optional().default(null),
  deviceInfo: z3.string().trim().max(200).nullable().optional().default(null)
});
var manualExceptionAttendanceSchema = z3.object({
  personType: z3.enum(["TEACHER" /* TEACHER */, "STUDENT" /* STUDENT */]),
  personId: z3.string().trim().min(1, "Siswa atau guru wajib dipilih."),
  attendanceDate: dateYYYYMMDDSchema,
  eventType: z3.enum(["CHECK_IN" /* CHECK_IN */, "CHECK_OUT" /* CHECK_OUT */]),
  status: z3.enum([
    "PRESENT" /* PRESENT */,
    "LATE" /* LATE */,
    "SICK" /* SICK */,
    "EXCUSED" /* EXCUSED */
  ]),
  reason: z3.string().trim().min(8, "Alasan pengecualian manual wajib diisi minimal 8 karakter.").max(400)
});
var schoolLocationCreateSchema = z3.object({
  name: z3.string().trim().min(2, "Nama lokasi minimal 2 karakter.").max(120),
  latitude: z3.coerce.number().min(-90, "Latitude harus antara -90 dan 90.").max(90),
  longitude: z3.coerce.number().min(-180, "Longitude harus antara -180 dan 180.").max(180),
  radiusMeters: z3.coerce.number().int().min(10, "Radius minimal 10 meter.").max(5e3, "Radius maksimal 5000 meter."),
  maxGpsAccuracyMeters: z3.coerce.number().int().min(5, "Ambang akurasi minimal 5 meter.").max(1e3, "Ambang akurasi maksimal 1000 meter."),
  isActive: z3.boolean().default(true)
});
var schoolLocationUpdateSchema = schoolLocationCreateSchema.partial();
var gpsSettingsUpdateSchema = z3.object({
  gpsEnabledForStudents: z3.boolean().optional(),
  gpsEnabledForTeachers: z3.boolean().optional(),
  teacherSelfServiceEnabled: z3.boolean().optional(),
  approvedPermissionAffectsRecap: z3.boolean().optional()
});

// backend/_lib/storage/privateStorage.ts
var privateBlobStore = /* @__PURE__ */ new Map();
var FALLBACK_SIGNING_SECRET = crypto5.randomBytes(32).toString("hex");
function getSigningSecret() {
  return process.env.SESSION_SECRET?.trim() || process.env.FILE_SIGNING_SECRET?.trim() || FALLBACK_SIGNING_SECRET;
}
function parseAndValidateImageDataUrl(dataUrl, declaredMime, maxBytes = MAX_SELFIE_BYTES) {
  if (!ALLOWED_SELFIE_MIME_TYPES.includes(declaredMime)) {
    throw ApiError.badRequest("Format gambar tidak diizinkan. Gunakan JPEG atau PNG.");
  }
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw ApiError.badRequest("Format data gambar base64 tidak valid.");
  }
  const embeddedMime = match[1];
  const base64Body = match[2];
  if (embeddedMime !== declaredMime) {
    throw ApiError.badRequest("MIME gambar tidak sesuai dengan isi berkas.");
  }
  const buffer = Buffer.from(base64Body, "base64");
  if (buffer.length === 0) {
    throw ApiError.badRequest("Berkas gambar kosong.");
  }
  if (buffer.length > maxBytes) {
    throw ApiError.badRequest(
      `Ukuran gambar melebihi batas maksimum (${Math.round(maxBytes / (1024 * 1024))} MB).`
    );
  }
  if (declaredMime === "image/jpeg") {
    const isJpeg = buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    if (!isJpeg) {
      throw ApiError.badRequest("Header biner berkas bukan gambar JPEG yang valid.");
    }
  } else if (declaredMime === "image/png") {
    const isPng = buffer.length >= 8 && buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71 && buffer[4] === 13 && buffer[5] === 10 && buffer[6] === 26 && buffer[7] === 10;
    if (!isPng) {
      throw ApiError.badRequest("Header biner berkas bukan gambar PNG yang valid.");
    }
  }
  return { buffer, mimeType: declaredMime };
}
function parseAndValidateAttachmentDataUrl(dataUrl, declaredMime, maxBytes = MAX_ATTACHMENT_BYTES) {
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(
    declaredMime
  )) {
    throw ApiError.badRequest("Format lampiran tidak diizinkan. Gunakan JPEG, PNG, atau PDF.");
  }
  if (declaredMime === "image/jpeg" || declaredMime === "image/png") {
    return parseAndValidateImageDataUrl(dataUrl, declaredMime, maxBytes);
  }
  const match = /^data:(application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw ApiError.badRequest("Format data PDF base64 tidak valid.");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) {
    throw ApiError.badRequest("Berkas PDF kosong.");
  }
  if (buffer.length > maxBytes) {
    throw ApiError.badRequest(
      `Ukuran lampiran melebihi batas maksimum (${Math.round(maxBytes / (1024 * 1024))} MB).`
    );
  }
  const isPdf = buffer.length >= 5 && buffer[0] === 37 && buffer[1] === 80 && buffer[2] === 68 && buffer[3] === 70 && buffer[4] === 45;
  if (!isPdf) {
    throw ApiError.badRequest("Header biner berkas bukan dokumen PDF yang valid.");
  }
  return { buffer, mimeType: "application/pdf" };
}
function buildPrivateStoragePath(category, ownerId, fileId, mimeType) {
  const ext = mimeType === "image/png" ? "png" : mimeType === "application/pdf" ? "pdf" : "jpg";
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const folder = category === "ATTENDANCE_SELFIE" /* ATTENDANCE_SELFIE */ ? "selfies" : category === "PERMISSION_ATTACHMENT" /* PERMISSION_ATTACHMENT */ ? "permissions" : "files";
  return `private/${folder}/${safeOwner}/${fileId}.${ext}`;
}
function putPrivateBlob(storagePath, buffer, mimeType) {
  privateBlobStore.set(storagePath, { buffer, mimeType });
}
function getPrivateBlob(storagePath) {
  return privateBlobStore.get(storagePath) ?? null;
}
function signFileAccess(fileId, expiresAtEpochSec) {
  return crypto5.createHmac("sha256", getSigningSecret()).update(`${fileId}:${expiresAtEpochSec}`).digest("base64url");
}
function createSignedFileUrl(fileId, ttlSeconds = 300) {
  const exp = Math.floor(Date.now() / 1e3) + ttlSeconds;
  const sig = signFileAccess(fileId, exp);
  return {
    url: `/api/uploads/file?id=${encodeURIComponent(fileId)}&exp=${exp}&sig=${encodeURIComponent(sig)}`,
    expiresAt: new Date(exp * 1e3).toISOString()
  };
}
function verifySignedFileSignature(fileId, expStr, sig, nowMs = Date.now()) {
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1e3 < nowMs) {
    return false;
  }
  const expected = signFileAccess(fileId, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto5.timingSafeEqual(a, b);
}
var PRIVILEGED_VIEW_ROLES = /* @__PURE__ */ new Set([
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "OPERATOR" /* OPERATOR */,
  "PRINCIPAL" /* PRINCIPAL */
]);
function canUserAccessPrivateFile(user, meta) {
  if (PRIVILEGED_VIEW_ROLES.has(user.role)) return true;
  if (user.role === "TEACHER" /* TEACHER */ && meta.ownerType === "TEACHER" /* TEACHER */ && user.linkedTeacherId && meta.ownerId === user.linkedTeacherId) {
    return true;
  }
  return false;
}

// src/lib/date.ts
var ASIA_JAKARTA_TZ = "Asia/Jakarta";
var DAY_NAME_TO_ISO = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7
};
var INDONESIAN_DAY_NAMES = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
  7: "Minggu"
};
function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}
function getDateKeyJakarta(input = /* @__PURE__ */ new Date()) {
  const date = toDate(input);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ASIA_JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}
function getTimeHHMMJakarta(input = /* @__PURE__ */ new Date()) {
  const date = toDate(input);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ASIA_JAKARTA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour === "24" ? "00" : hour}:${minute}`;
}
function getDayOfWeekJakarta(input = /* @__PURE__ */ new Date()) {
  const date = toDate(input);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: ASIA_JAKARTA_TZ,
    weekday: "short"
  }).format(date);
  return DAY_NAME_TO_ISO[weekday] ?? 1;
}
function parseTimeToMinutes(hhmm) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) {
    throw new Error(`Format waktu tidak valid: "${hhmm}". Gunakan format HH:mm.`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

// backend/health.ts
async function handler(req, res) {
  try {
    if (req.method && req.method !== "GET") {
      res.status(405).json({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Metode tidak diizinkan." },
        serverTime: (/* @__PURE__ */ new Date()).toISOString()
      });
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const firebaseConfig = getServerFirebaseConfig();
    const dataMode = firebaseConfig.dataMode;
    const repo = getRepository();
    const startedAt = Date.now();
    let databaseConnected = false;
    let databaseError = null;
    try {
      await repo.collection("appSettings" /* APP_SETTINGS */).getById("default");
      databaseConnected = true;
    } catch (err) {
      databaseConnected = false;
      databaseError = err instanceof Error ? err.message : "Koneksi ke database tidak dapat dijangkau.";
    }
    const latencyMs = Math.max(1, Date.now() - startedAt);
    const persistent = dataMode === "real";
    const databaseLabel = dataMode === "real" ? `Cloud Firestore (${firebaseConfig.projectId})` : "Database Lokal (Testing)";
    sendOk(res, {
      status: databaseConnected ? "ok" : "degraded",
      dataMode,
      databaseConnected,
      databaseLabel,
      persistent,
      latencyMs,
      databaseError,
      timezone: ASIA_JAKARTA_TZ,
      jakartaDate: getDateKeyJakarta(now),
      jakartaTime: getTimeHHMMJakarta(now)
    });
  } catch (err) {
    sendError(res, err);
  }
}

// backend/settings/public.ts
var DEFAULT_PUBLIC_SETTINGS = {
  id: "default",
  appName: "Absensi Digital",
  pwaAppName: "MiFUL",
  schoolName: "MI MIFTAHUL ULUM",
  schoolAddress: "Sumberwuluh - Candipuro - Lumajang",
  schoolBio: "Madrasah Ibtidaiyah Miftahul Ulum Sumberwuluh \u2014 Sistem Kehadiran Digital Terpadu.",
  logoPath: "/images/school-logo.png",
  faviconPath: "/favicon.png",
  pwaIcon192Path: "/icons/pwa-192x192.png",
  pwaIcon512Path: "/icons/pwa-512x512.png",
  loginBackgroundPath: "/images/school-backdrop.jpg",
  theme: { primary: "#10264D", accent: "#C69B3C", background: "#FFFFFF" },
  timezone: "Asia/Jakarta",
  gpsEnabledForStudents: true,
  gpsEnabledForTeachers: true,
  teacherSelfServiceEnabled: true,
  portalScanMethod: "CAMERA_AND_USB",
  quickLoginEnabled: false,
  bypassAttendanceTimeWindow: false,
  requireUserLinkedToTeacher: true,
  voiceTemplates: {
    success: "ABSEN BERHASIL",
    failure: "ABSEN GAGAL",
    namedSuccess: "ABSEN ATAS NAMA {name} BERHASIL"
  }
};
async function handlePublicSettings(req, res, repo = getRepository()) {
  try {
    if (req.method && req.method !== "GET") {
      res.status(405).json({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Metode tidak diizinkan." },
        serverTime: (/* @__PURE__ */ new Date()).toISOString()
      });
      return;
    }
    let raw = null;
    let needsBootstrap = false;
    const [settingsRes, userCount] = await Promise.all([
      repo.collection("appSettings" /* APP_SETTINGS */).list({ limit: 1 }),
      repo.collection("users" /* USERS */).count()
    ]);
    const first = settingsRes.items[0];
    if (first) {
      const { portalExitPasswordHash: _omit, ...safe } = first;
      raw = safe;
    } else if (repo.mode === "real") {
      try {
        raw = await repo.collection("publicSettings" /* PUBLIC_SETTINGS */).getById("default");
      } catch {
        raw = null;
      }
    }
    needsBootstrap = userCount === 0;
    const normalizeAssetPath = (val, fallback) => {
      if (!val || val.startsWith("/src/assets/images/")) return fallback;
      return val;
    };
    const settings = raw ? {
      ...DEFAULT_PUBLIC_SETTINGS,
      ...raw,
      id: "default",
      pwaAppName: raw.pwaAppName?.trim() || "MiFUL",
      quickLoginEnabled: raw.quickLoginEnabled ?? false,
      bypassAttendanceTimeWindow: raw.bypassAttendanceTimeWindow ?? false,
      requireUserLinkedToTeacher: raw.requireUserLinkedToTeacher ?? true,
      logoPath: normalizeAssetPath(raw.logoPath, "/images/school-logo.png"),
      loginBackgroundPath: normalizeAssetPath(
        raw.loginBackgroundPath,
        "/images/school-backdrop.jpg"
      )
    } : DEFAULT_PUBLIC_SETTINGS;
    sendOk(res, {
      settings,
      needsBootstrap,
      dataMode: repo.mode
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler2(req, res) {
  await handlePublicSettings(req, res);
}

// backend/_lib/auth/middleware.ts
import crypto7 from "node:crypto";

// backend/_lib/auth/cookies.ts
var SESSION_COOKIE_NAME = "absensi_session";
var CSRF_COOKIE_NAME = "absensi_csrf";
var CSRF_HEADER_NAME = "x-csrf-token";
function parseCookies(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}
function getHeaderValue(req, headerName) {
  const headers = req.headers;
  if (!headers) return void 0;
  const lower = headerName.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) {
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return void 0;
}
function isSecureContext(req) {
  const host = (getHeaderValue(req, "x-forwarded-host") ?? getHeaderValue(req, "host") ?? "").toLowerCase();
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("0.0.0.0");
  const proto = (getHeaderValue(req, "x-forwarded-proto") ?? "").toLowerCase();
  if (proto === "https") return true;
  const origin = (getHeaderValue(req, "origin") ?? getHeaderValue(req, "referer") ?? "").toLowerCase();
  if (origin.startsWith("https://")) return true;
  if (!isLocalHost && (process.env.NODE_ENV === "production" || process.env.VERCEL === "1")) {
    return true;
  }
  return false;
}
function serializeCookie(name, value, options) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? "/"}`];
  if (typeof options.maxAgeSeconds === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  return parts.join("; ");
}
function appendSetCookie(res, cookies) {
  if (!res.setHeader) return;
  const existing = res.getHeader?.("Set-Cookie");
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing.map(String), ...cookies]);
  } else if (typeof existing === "string") {
    res.setHeader("Set-Cookie", [existing, ...cookies]);
  } else {
    res.setHeader("Set-Cookie", cookies);
  }
}
function setAuthCookies(req, res, sessionToken, csrfToken, maxAgeSeconds = 12 * 60 * 60) {
  const secure = isSecureContext(req);
  const sameSite = process.env.VERCEL === "1" ? "Lax" : secure ? "None" : "Lax";
  const sessionCookie = serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAgeSeconds,
    path: "/"
  });
  const csrfCookie = serializeCookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure,
    sameSite,
    maxAgeSeconds,
    path: "/"
  });
  appendSetCookie(res, [sessionCookie, csrfCookie]);
}
function clearAuthCookies(req, res) {
  const secure = isSecureContext(req);
  const sameSite = process.env.VERCEL === "1" ? "Lax" : secure ? "None" : "Lax";
  appendSetCookie(res, [
    serializeCookie(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure,
      sameSite,
      maxAgeSeconds: 0,
      path: "/"
    }),
    serializeCookie(CSRF_COOKIE_NAME, "", {
      httpOnly: false,
      secure,
      sameSite,
      maxAgeSeconds: 0,
      path: "/"
    })
  ]);
}

// backend/_lib/auth/session.ts
import crypto6 from "node:crypto";
var SESSION_TTL_MS = 12 * 60 * 60 * 1e3;
function getStatelessSessionSecret() {
  return process.env.SESSION_SECRET?.trim() || process.env.VERCEL_PROJECT_ID?.trim() || "absensi-digital-serverless-mock-session-v1";
}
function signMockSessionToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto6.createHmac("sha256", getStatelessSessionSecret()).update(encoded).digest("base64url");
  return `st1.${encoded}.${sig}`;
}
function verifyMockSessionToken(token) {
  if (!token.startsWith("st1.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto6.createHmac("sha256", getStatelessSessionSecret()).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto6.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
    if (typeof parsed.sid !== "string" || typeof parsed.uid !== "string" || typeof parsed.un !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (!Number.isFinite(parsed.exp) || parsed.exp <= Date.now()) {
      return null;
    }
    return {
      sid: parsed.sid,
      uid: parsed.uid,
      un: parsed.un,
      exp: parsed.exp
    };
  } catch {
    return null;
  }
}
function toSafeUser(user) {
  const { passwordHash: _omitHash, passwordCipher: _omitCipher, ...safe } = user;
  return safe;
}
async function createUserSession(repo, userId, ttlMs = SESSION_TTL_MS) {
  const csrfToken = generateRandomToken(24);
  const now = /* @__PURE__ */ new Date();
  const expiresMs = now.getTime() + ttlMs;
  const expiresAt = new Date(expiresMs).toISOString();
  let rawSessionToken = generateRandomToken(32);
  if (repo.mode === "mock") {
    const user = await repo.collection("users" /* USERS */).getById(userId);
    if (user) {
      rawSessionToken = signMockSessionToken({
        sid: `sess_${crypto6.randomBytes(8).toString("hex")}`,
        uid: user.id,
        un: user.normalizedUsername,
        exp: expiresMs
      });
    }
  }
  const session = await repo.collection("userSessions" /* USER_SESSIONS */).create({
    userId,
    sessionTokenHash: hashToken(rawSessionToken),
    expiresAt,
    revokedAt: null,
    lastSeenAt: now.toISOString()
  });
  return {
    session,
    rawSessionToken,
    csrfToken,
    maxAgeSeconds: Math.max(0, Math.floor(ttlMs / 1e3))
  };
}
async function resolveActiveSession(repo, rawSessionToken) {
  if (!rawSessionToken || rawSessionToken.trim().length < 16) {
    return null;
  }
  const trimmed = rawSessionToken.trim();
  const tokenHash = hashToken(trimmed);
  const sessionCol = repo.collection("userSessions" /* USER_SESSIONS */);
  const session = await sessionCol.findFirst([
    { field: "sessionTokenHash", op: "==", value: tokenHash }
  ]);
  if (session) {
    if (session.revokedAt !== null) return null;
    const expiresMs = new Date(session.expiresAt).getTime();
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
      return null;
    }
    const user = await repo.collection("users" /* USERS */).getById(session.userId);
    if (!user || !user.isActive) {
      return null;
    }
    await sessionCol.update(session.id, {
      lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      user: toSafeUser(user),
      session
    };
  }
  if (repo.mode === "mock") {
    const payload = verifyMockSessionToken(trimmed);
    if (!payload) return null;
    const usersCol = repo.collection("users" /* USERS */);
    const user = await usersCol.getById(payload.uid) ?? await usersCol.findFirst([{ field: "normalizedUsername", op: "==", value: payload.un }]);
    if (!user || !user.isActive) return null;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const rehydrated = await sessionCol.create({
      userId: user.id,
      sessionTokenHash: tokenHash,
      expiresAt: new Date(payload.exp).toISOString(),
      revokedAt: null,
      lastSeenAt: nowIso
    });
    return {
      user: toSafeUser(user),
      session: rehydrated
    };
  }
  return null;
}
async function revokeSession(repo, sessionId) {
  await repo.collection("userSessions" /* USER_SESSIONS */).update(sessionId, {
    revokedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function revokeAllUserSessions(repo, userId, exceptSessionId) {
  const sessionCol = repo.collection("userSessions" /* USER_SESSIONS */);
  const sessions = await sessionCol.list({
    filters: [{ field: "userId", op: "==", value: userId }]
  });
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all(
    sessions.items.filter((s) => s.revokedAt === null && s.id !== exceptSessionId).map((s) => sessionCol.update(s.id, { revokedAt: nowIso }))
  );
}

// backend/_lib/auth/middleware.ts
var MUTATING_METHODS = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH", "DELETE"]);
function extractClientIp(req) {
  const forwarded = getHeaderValue(req, "x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}
function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto7.timingSafeEqual(bufA, bufB);
}
function assertCsrfToken(req) {
  const method = (req.method ?? "GET").toUpperCase();
  if (!MUTATING_METHODS.has(method)) return;
  const cookies = parseCookies(getHeaderValue(req, "cookie"));
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = getHeaderValue(req, CSRF_HEADER_NAME);
  if (!cookieToken || !headerToken || !timingSafeStringEqual(cookieToken, headerToken)) {
    throw ApiError.forbidden("Token keamanan CSRF tidak valid atau hilang. Muat ulang halaman.");
  }
}
async function requireAuth(req, options = {}) {
  const repo = options.repo ?? getRepository();
  const cookies = parseCookies(getHeaderValue(req, "cookie"));
  const rawSessionToken = cookies[SESSION_COOKIE_NAME];
  const resolved = await resolveActiveSession(repo, rawSessionToken);
  if (!resolved) {
    throw ApiError.unauthorized("Sesi tidak aktif atau telah berakhir. Silakan login kembali.");
  }
  if (!options.skipCsrf) {
    assertCsrfToken(req);
  }
  if (options.allowedRoles && options.allowedRoles.length > 0 && !options.allowedRoles.includes(resolved.user.role)) {
    throw ApiError.forbidden("Peran Anda tidak memiliki izin untuk mengakses sumber daya ini.");
  }
  if (!options.allowMustChangePassword && resolved.user.mustChangePassword && resolved.user.role !== "TEACHER" /* TEACHER */) {
    throw new ApiError(
      403,
      "MUST_CHANGE_PASSWORD",
      "Anda wajib mengganti kata sandi sementara sebelum menggunakan fitur ini."
    );
  }
  return {
    user: resolved.user,
    session: resolved.session,
    clientIp: extractClientIp(req)
  };
}

// backend/foundation/overview.ts
async function handleFoundationOverview(req, res, repo = getRepository()) {
  try {
    if (req.method && req.method !== "GET") {
      res.status(405).json({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Metode tidak diizinkan." },
        serverTime: (/* @__PURE__ */ new Date()).toISOString()
      });
      return;
    }
    await requireAuth(req, {
      repo,
      allowedRoles: [
        "SUPER_ADMIN" /* SUPER_ADMIN */,
        "ADMIN" /* ADMIN */,
        "OPERATOR" /* OPERATOR */,
        "PRINCIPAL" /* PRINCIPAL */
      ]
    });
    const [settingsRes, academicYearsRes, teachersRes, studentsRes, classesRes, subjectsRes] = await Promise.all([
      repo.collection("appSettings" /* APP_SETTINGS */).list({ limit: 1 }),
      repo.collection("academicYears" /* ACADEMIC_YEARS */).list({ filters: [{ field: "isActive", op: "==", value: true }], limit: 1 }),
      repo.collection("teachers" /* TEACHERS */).list({ sort: { field: "fullName", direction: "asc" } }),
      repo.collection("students" /* STUDENTS */).list({ sort: { field: "nis", direction: "asc" } }),
      repo.collection("classes" /* CLASSES */).list({ sort: { field: "name", direction: "asc" } }),
      repo.collection("subjects" /* SUBJECTS */).list()
    ]);
    const settings = settingsRes.items[0];
    const activeYear = academicYearsRes.items[0];
    const classMap = new Map(classesRes.items.map((c) => [c.id, c.name]));
    const studentCountByClass = /* @__PURE__ */ new Map();
    for (const s of studentsRes.items) {
      studentCountByClass.set(s.classId, (studentCountByClass.get(s.classId) ?? 0) + 1);
    }
    const overview = {
      dataMode: repo.mode,
      schoolName: settings?.schoolName ?? "MI Miftahul Ulum Sumberwuluh",
      appName: settings?.appName ?? "Absensi Digital",
      timezone: settings?.timezone ?? "Asia/Jakarta",
      activeAcademicYear: activeYear?.label ?? "2026/2027",
      counts: {
        teachers: teachersRes.total,
        students: studentsRes.total,
        demoStudents: studentsRes.items.filter((s) => Boolean(s.isDemo)).length,
        classes: classesRes.total,
        subjects: subjectsRes.total
      },
      teachers: teachersRes.items.map((t) => ({
        id: t.id,
        niyNip: t.niyNip,
        fullName: t.fullName,
        position: t.position,
        status: t.status
      })),
      students: studentsRes.items.map((s) => ({
        id: s.id,
        nis: s.nis,
        fullName: s.fullName,
        className: classMap.get(s.classId) ?? "-",
        status: s.status,
        isDemo: Boolean(s.isDemo)
      })),
      classes: classesRes.items.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        studentCount: studentCountByClass.get(c.id) ?? 0
      }))
    };
    sendOk(res, overview);
  } catch (err) {
    sendError(res, err);
  }
}
async function handler3(req, res) {
  await handleFoundationOverview(req, res);
}

// backend/auth/bootstrap.ts
import { z as z4 } from "zod";
var bootstrapBodySchema = z4.object({
  superAdminPassword: z4.string().min(8, "Kata sandi Super Admin minimal 8 karakter.").max(128),
  adminPassword: z4.string().min(8, "Kata sandi Admin minimal 8 karakter.").max(128).optional(),
  principalPassword: z4.string().min(8, "Kata sandi Kepala Sekolah minimal 8 karakter.").max(128).optional()
});
async function handleBootstrap(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const parsed = bootstrapBodySchema.parse(req.body ?? {});
    const result = await bootstrapInitialAccounts(repo, parsed, extractClientIp(req));
    sendOk(res, result, 201);
  } catch (err) {
    sendError(res, err);
  }
}
async function handler4(req, res) {
  await handleBootstrap(req, res);
}

// backend/auth/login.ts
import { z as z5 } from "zod";

// backend/_lib/auth/rateLimit.ts
var MAX_FAILED_ATTEMPTS = 5;
var ACCOUNT_LOCK_MINUTES = 15;
var IP_WINDOW_MS = 15 * 60 * 1e3;
var IP_MAX_ATTEMPTS = 20;
var ipAttempts = /* @__PURE__ */ new Map();
function checkIpRateLimit(ipKey, nowMs = Date.now(), maxAttempts = IP_MAX_ATTEMPTS, windowMs = IP_WINDOW_MS) {
  const entry = ipAttempts.get(ipKey);
  if (!entry) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const cutoff = nowMs - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= maxAttempts) {
    const oldest = entry.timestamps[0] ?? nowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1e3));
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
function recordIpFailedAttempt(ipKey, nowMs = Date.now()) {
  const entry = ipAttempts.get(ipKey) ?? { timestamps: [] };
  entry.timestamps.push(nowMs);
  ipAttempts.set(ipKey, entry);
}
function clearIpAttempts(ipKey) {
  ipAttempts.delete(ipKey);
}
function isAccountLocked(lockedUntil, nowMs = Date.now()) {
  if (!lockedUntil) return false;
  const lockMs = new Date(lockedUntil).getTime();
  return Number.isFinite(lockMs) && lockMs > nowMs;
}
function computeNextFailedState(currentFailedCount, nowMs = Date.now()) {
  const nextCount = currentFailedCount + 1;
  if (nextCount >= MAX_FAILED_ATTEMPTS) {
    return {
      failedLoginCount: nextCount,
      lockedUntil: new Date(nowMs + ACCOUNT_LOCK_MINUTES * 60 * 1e3).toISOString(),
      lockedNow: true
    };
  }
  return {
    failedLoginCount: nextCount,
    lockedUntil: null,
    lockedNow: false
  };
}

// backend/auth/login.ts
var GENERIC_LOGIN_ERROR = "Username atau kata sandi salah.";
var loginBodySchema = z5.object({
  username: z5.string().trim().min(1, "Username wajib diisi.").max(64),
  password: z5.string().min(1, "Kata sandi wajib diisi.").max(128)
});
async function handleLogin(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const clientIp = extractClientIp(req);
    const ipLimit = checkIpRateLimit(clientIp);
    if (!ipLimit.allowed) {
      await recordActivityLog(repo, {
        actorUserId: "anonymous",
        actorRole: "TEACHER" /* TEACHER */,
        action: "LOGIN_RATE_LIMITED",
        entityType: "AUTH",
        entityId: "ip_limit",
        reason: `Percobaan login melampaui batas dari IP terkait.`,
        clientIp
      });
      throw ApiError.tooManyRequests(
        `Terlalu banyak percobaan login. Silakan coba lagi dalam ${Math.ceil(ipLimit.retryAfterSeconds / 60)} menit.`
      );
    }
    const parsed = loginBodySchema.parse(req.body ?? {});
    const normalized = normalizeUsername(parsed.username);
    const usersCol = repo.collection("users" /* USERS */);
    const user = await usersCol.findFirst([
      { field: "normalizedUsername", op: "==", value: normalized }
    ]);
    if (user && isAccountLocked(user.lockedUntil)) {
      recordIpFailedAttempt(clientIp);
      await recordActivityLog(repo, {
        actorUserId: user.id,
        actorRole: user.role,
        action: "LOGIN_FAILED_LOCKED",
        entityType: "AUTH",
        entityId: user.id,
        reason: "Akun sedang dalam masa tunggu (cooldown) akibat kegagalan login berulang.",
        clientIp
      });
      throw ApiError.tooManyRequests(
        "Akun sementara dikunci karena terlalu banyak percobaan login gagal. Coba lagi beberapa menit lagi."
      );
    }
    const passwordMatches = await verifyPassword(parsed.password, user?.passwordHash);
    if (!user || !user.isActive || !passwordMatches) {
      recordIpFailedAttempt(clientIp);
      if (user) {
        const nextFailed = computeNextFailedState(user.failedLoginCount ?? 0);
        await usersCol.update(user.id, {
          failedLoginCount: nextFailed.failedLoginCount,
          lockedUntil: nextFailed.lockedUntil
        });
        await recordActivityLog(repo, {
          actorUserId: user.id,
          actorRole: user.role,
          action: "LOGIN_FAILED",
          entityType: "AUTH",
          entityId: user.id,
          reason: nextFailed.lockedNow ? "Login gagal dan akun dikunci sementara." : "Kredensial tidak cocok atau akun nonaktif.",
          clientIp
        });
        if (nextFailed.lockedNow) {
          throw ApiError.tooManyRequests(
            "Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit."
          );
        }
      } else {
        await recordActivityLog(repo, {
          actorUserId: "anonymous",
          actorRole: "TEACHER" /* TEACHER */,
          action: "LOGIN_FAILED",
          entityType: "AUTH",
          entityId: normalized || "unknown",
          reason: "Percobaan login gagal.",
          clientIp
        });
      }
      throw ApiError.unauthorized(GENERIC_LOGIN_ERROR);
    }
    clearIpAttempts(clientIp);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const updatedUser = await usersCol.update(user.id, {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: nowIso
    }) ?? user;
    const sessionBundle = await createUserSession(repo, user.id);
    setAuthCookies(
      req,
      res,
      sessionBundle.rawSessionToken,
      sessionBundle.csrfToken,
      sessionBundle.maxAgeSeconds
    );
    let displayName = updatedUser.username;
    let position = null;
    if (updatedUser.linkedTeacherId) {
      const teacher = await repo.collection("teachers" /* TEACHERS */).getById(updatedUser.linkedTeacherId);
      if (teacher) {
        displayName = teacher.fullName;
        position = teacher.position;
      }
    }
    await recordActivityLog(repo, {
      actorUserId: updatedUser.id,
      actorRole: updatedUser.role,
      action: "LOGIN_SUCCESS",
      entityType: "AUTH",
      entityId: sessionBundle.session.id,
      clientIp
    });
    const safeUser = toSafeUser(updatedUser);
    sendOk(res, {
      user: {
        id: safeUser.id,
        username: safeUser.username,
        role: safeUser.role,
        linkedTeacherId: safeUser.linkedTeacherId,
        displayName,
        position,
        mustChangePassword: safeUser.role === "TEACHER" /* TEACHER */ ? false : safeUser.mustChangePassword,
        isActive: safeUser.isActive
      },
      csrfToken: sessionBundle.csrfToken
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler5(req, res) {
  await handleLogin(req, res);
}

// backend/auth/logout.ts
async function handleLogout(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, {
      repo,
      allowMustChangePassword: true
    });
    await revokeSession(repo, auth.session.id);
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "LOGOUT",
      entityType: "AUTH",
      entityId: auth.session.id,
      clientIp: auth.clientIp
    });
    clearAuthCookies(req, res);
    sendOk(res, { loggedOut: true });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler6(req, res) {
  await handleLogout(req, res);
}

// backend/auth/me.ts
async function handleMe(req, res, repo = getRepository()) {
  try {
    if (req.method && req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus GET.");
    }
    const auth = await requireAuth(req, {
      repo,
      allowMustChangePassword: true
    });
    let displayName = auth.user.username;
    let position = null;
    if (auth.user.linkedTeacherId) {
      const teacher = await repo.collection("teachers" /* TEACHERS */).getById(auth.user.linkedTeacherId);
      if (teacher) {
        displayName = teacher.fullName;
        position = teacher.position;
      }
    }
    const cookies = parseCookies(getHeaderValue(req, "cookie"));
    sendOk(res, {
      user: {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
        linkedTeacherId: auth.user.linkedTeacherId,
        displayName,
        position,
        mustChangePassword: auth.user.role === "TEACHER" /* TEACHER */ ? false : auth.user.mustChangePassword,
        isActive: auth.user.isActive
      },
      csrfToken: cookies[CSRF_COOKIE_NAME] ?? null
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler7(req, res) {
  await handleMe(req, res);
}

// backend/auth/change-password.ts
import { z as z6 } from "zod";
var changePasswordSchema = z6.object({
  currentPassword: z6.string().min(1, "Kata sandi saat ini wajib diisi.").max(128),
  newPassword: z6.string().min(6, "Kata sandi baru minimal 6 karakter.").max(128, "Kata sandi baru maksimal 128 karakter.")
});
async function handleChangePassword(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, {
      repo,
      allowMustChangePassword: true
    });
    const parsed = changePasswordSchema.parse(req.body ?? {});
    if (parsed.currentPassword === parsed.newPassword) {
      throw ApiError.badRequest("Kata sandi baru harus berbeda dari kata sandi saat ini.");
    }
    const usersCol = repo.collection("users" /* USERS */);
    const fullUser = await usersCol.getById(auth.user.id);
    if (!fullUser) {
      throw ApiError.unauthorized("Akun tidak ditemukan.");
    }
    const validCurrent = await verifyPassword(parsed.currentPassword, fullUser.passwordHash);
    if (!validCurrent) {
      throw ApiError.badRequest("Kata sandi saat ini tidak sesuai.");
    }
    const newHash = await hashPassword(parsed.newPassword);
    await usersCol.update(fullUser.id, {
      passwordHash: newHash,
      passwordCipher: encryptPasswordForAdminView(parsed.newPassword),
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null
    });
    await revokeAllUserSessions(repo, fullUser.id, auth.session.id);
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "PASSWORD_CHANGED",
      entityType: "USER",
      entityId: auth.user.id,
      clientIp: auth.clientIp
    });
    sendOk(res, {
      changed: true,
      mustChangePassword: false
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler8(req, res) {
  await handleChangePassword(req, res);
}

// backend/auth/reset-password.ts
import { z as z7 } from "zod";
var resetPasswordSchema = z7.object({
  targetUserId: z7.string().trim().min(1, "ID pengguna wajib diisi."),
  customPassword: z7.string().min(6, "Kata sandi baru minimal 6 karakter.").max(72, "Kata sandi baru maksimal 72 karakter."),
  reason: z7.string().trim().max(250).optional().default(""),
  mustChangePassword: z7.boolean().optional()
});
async function handleResetPassword(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, {
      repo,
      allowedRoles: ["SUPER_ADMIN" /* SUPER_ADMIN */, "ADMIN" /* ADMIN */]
    });
    const parsed = resetPasswordSchema.parse(req.body ?? {});
    const usersCol = repo.collection("users" /* USERS */);
    const target = await usersCol.getById(parsed.targetUserId);
    if (!target) {
      throw ApiError.notFound("Akun pengguna tidak ditemukan.");
    }
    if (target.role === "SUPER_ADMIN" /* SUPER_ADMIN */ && auth.user.role !== "SUPER_ADMIN" /* SUPER_ADMIN */) {
      throw ApiError.forbidden("Hanya Super Admin yang dapat mengubah kata sandi akun Super Admin.");
    }
    if (auth.user.role === "PRINCIPAL" /* PRINCIPAL */ && (target.role === "SUPER_ADMIN" /* SUPER_ADMIN */ || target.role === "ADMIN" /* ADMIN */)) {
      throw ApiError.forbidden(
        "Kepala Sekolah tidak berwenang mengubah kata sandi akun SUPER_ADMIN atau ADMIN."
      );
    }
    const nextPassword = parsed.customPassword;
    const newHash = await hashPassword(nextPassword);
    const nextMustChange = target.role === "TEACHER" /* TEACHER */ ? false : parsed.mustChangePassword ?? false;
    await usersCol.update(target.id, {
      passwordHash: newHash,
      passwordCipher: encryptPasswordForAdminView(nextPassword),
      mustChangePassword: nextMustChange,
      failedLoginCount: 0,
      lockedUntil: null
    });
    if (target.id !== auth.user.id) {
      await revokeAllUserSessions(repo, target.id);
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "PASSWORD_RESET",
      entityType: "USER",
      entityId: target.id,
      reason: parsed.reason || "Penetapan kata sandi oleh admin",
      after: {
        mustChangePassword: nextMustChange,
        mode: "ADMIN_DEFINED"
      },
      clientIp: auth.clientIp
    });
    sendOk(res, {
      targetUserId: target.id,
      username: target.username,
      passwordUpdated: true,
      mustChangePassword: nextMustChange
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler9(req, res) {
  await handleResetPassword(req, res);
}

// src/lib/masterDataValidation.ts
import { z as z8 } from "zod";
var academicYearCreateSchema = z8.object({
  label: z8.string().trim().min(4, "Label tahun ajaran minimal 4 karakter (contoh: 2026/2027).").max(40),
  semester: z8.enum(["Ganjil", "Genap"]).default("Ganjil"),
  startDate: z8.string().min(8, "Tanggal mulai wajib diisi."),
  endDate: z8.string().min(8, "Tanggal selesai wajib diisi."),
  isActive: z8.boolean().default(false)
});
var academicYearUpdateSchema = academicYearCreateSchema.partial();
var schoolClassCreateSchema = z8.object({
  name: z8.string().trim().min(1, "Nama kelas wajib diisi.").max(20),
  gradeLevel: z8.string().trim().min(1, "Tingkat kelas wajib diisi.").max(10),
  homeroomTeacherId: z8.string().trim().nullable().optional().default(null),
  academicYearId: z8.string().trim().min(1, "Tahun ajaran wajib dipilih."),
  capacity: z8.coerce.number().int().min(1).max(100).nullable().optional().default(30),
  isActive: z8.boolean().default(true)
});
var schoolClassUpdateSchema = schoolClassCreateSchema.partial();
var subjectCreateSchema = z8.object({
  name: z8.string().trim().min(2, "Nama mata pelajaran minimal 2 karakter.").max(80),
  code: z8.string().trim().min(2, "Kode mata pelajaran minimal 2 karakter.").max(20).regex(/^[A-Za-z0-9_-]+$/, "Kode hanya boleh berisi huruf, angka, tanda hubung, atau garis bawah."),
  defaultToHomeroomTeacher: z8.boolean().optional().default(false),
  isActive: z8.boolean().default(true)
});
var subjectUpdateSchema = subjectCreateSchema.partial();
var subjectImportRowSchema = z8.object({
  code: z8.string().trim(),
  name: z8.string().trim(),
  defaultToHomeroomTeacher: z8.union([z8.boolean(), z8.string().trim()]).optional().default(false),
  isActive: z8.union([z8.boolean(), z8.string().trim()]).optional().default(true)
});
var subjectImportRequestSchema = z8.object({
  mode: z8.enum(["preview", "commit"]),
  rows: z8.array(subjectImportRowSchema).min(1, "Minimal 1 baris mata pelajaran untuk diimpor.").max(200)
});
var studentCreateSchema = z8.object({
  nis: nisSchema,
  fullName: z8.string().trim().min(2, "Nama lengkap siswa minimal 2 karakter.").max(120),
  classId: z8.string().trim().min(1, "Kelas wajib dipilih."),
  gender: z8.nativeEnum(Gender).nullable().optional().default(null),
  photoPath: z8.string().trim().max(500).nullable().optional().default(null),
  status: z8.enum([
    "ACTIVE" /* ACTIVE */,
    "DEMO_ACTIVE" /* DEMO_ACTIVE */,
    "GRADUATED" /* GRADUATED */,
    "TRANSFERRED" /* TRANSFERRED */,
    "INACTIVE" /* INACTIVE */
  ]).default("ACTIVE" /* ACTIVE */)
});
var studentUpdateSchema = studentCreateSchema.partial().extend({
  reason: z8.string().trim().max(250).optional()
});
var studentImportRowSchema = z8.object({
  nis: z8.string().trim(),
  fullName: z8.string().trim(),
  className: z8.string().trim(),
  gender: z8.string().trim().optional().default(""),
  status: z8.string().trim().optional().default("ACTIVE")
});
var studentImportRequestSchema = z8.object({
  mode: z8.enum(["preview", "commit"]),
  rows: z8.array(studentImportRowSchema).min(1, "Minimal 1 baris data untuk diimpor.").max(500)
});
var teacherWorkingDaysSchema = z8.array(z8.coerce.number().int().min(1).max(7)).min(1, "Minimal pilih 1 hari masuk guru dalam seminggu.").max(7, "Maksimal 7 hari dalam seminggu.").nullable().optional();
var teacherCreateSchema = z8.object({
  niyNip: niyNipSchema,
  fullName: z8.string().trim().min(2, "Nama lengkap guru minimal 2 karakter.").max(120),
  position: z8.string().trim().min(2, "Jabatan wajib diisi.").max(80),
  status: z8.enum(["ACTIVE" /* ACTIVE */, "INACTIVE" /* INACTIVE */]).default("ACTIVE" /* ACTIVE */),
  photoPath: z8.string().trim().max(500).nullable().optional().default(null),
  workingDays: teacherWorkingDaysSchema,
  createAccount: z8.boolean().optional().default(false),
  username: z8.string().trim().max(64).optional(),
  password: z8.string().min(6, "Kata sandi akun guru minimal 6 karakter.").max(72, "Kata sandi akun guru maksimal 72 karakter.").optional()
}).refine((val) => !val.createAccount || val.password && val.password.length >= 6, {
  message: "Kata sandi akun guru wajib diisi minimal 6 karakter.",
  path: ["password"]
});
var teacherUpdateSchema = z8.object({
  niyNip: niyNipSchema.optional(),
  fullName: z8.string().trim().min(2, "Nama lengkap guru minimal 2 karakter.").max(120).optional(),
  position: z8.string().trim().min(2, "Jabatan wajib diisi.").max(80).optional(),
  status: z8.enum(["ACTIVE" /* ACTIVE */, "INACTIVE" /* INACTIVE */]).optional(),
  photoPath: z8.string().trim().max(500).nullable().optional(),
  workingDays: teacherWorkingDaysSchema,
  createAccount: z8.boolean().optional(),
  username: z8.string().trim().max(64).optional(),
  password: z8.string().min(6, "Kata sandi akun guru minimal 6 karakter.").max(72, "Kata sandi akun guru maksimal 72 karakter.").optional()
});
var teacherImportRowSchema = z8.object({
  niyNip: z8.string().trim(),
  fullName: z8.string().trim(),
  position: z8.string().trim(),
  status: z8.string().trim().optional().default("ACTIVE")
});
var teacherImportRequestSchema = z8.object({
  mode: z8.enum(["preview", "commit"]),
  rows: z8.array(teacherImportRowSchema).min(1, "Minimal 1 baris data untuk diimpor.").max(200)
});
var bulkArchiveSchema = z8.object({
  ids: z8.array(z8.string().trim().min(1)).min(1, "Pilih minimal 1 data.").max(200),
  reason: z8.string().trim().max(250).optional()
});

// backend/_lib/masterDataRoles.ts
var MASTER_READ_ROLES = [
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "OPERATOR" /* OPERATOR */,
  "PRINCIPAL" /* PRINCIPAL */
];
var MASTER_WRITE_ROLES = [
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "OPERATOR" /* OPERATOR */
];
function getQueryString(req, key) {
  const val = req.query?.[key];
  if (Array.isArray(val)) return String(val[0] ?? "").trim();
  if (typeof val === "string") return val.trim();
  return "";
}
function getQueryInt(req, key, defaultValue, min = 1, max = 100) {
  const raw = getQueryString(req, key);
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}
function paginateArrayByCursor(items, cursor, limit) {
  const total = items.length;
  let startIndex = 0;
  if (cursor) {
    const foundIdx = items.findIndex((item) => item.id === cursor);
    if (foundIdx >= 0) {
      startIndex = foundIdx + 1;
    }
  }
  const pageItems = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + pageItems.length < total;
  const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;
  return {
    items: pageItems,
    total,
    nextCursor
  };
}

// backend/academic-years/index.ts
async function handleAcademicYears(req, res, repo = getRepository()) {
  try {
    const col = repo.collection("academicYears" /* ACADEMIC_YEARS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const result = await col.list({ sort: { field: "label", direction: "desc" } });
      sendOk(res, { items: result.items, total: result.total });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = academicYearCreateSchema.parse(req.body ?? {});
      if (new Date(parsed.endDate).getTime() <= new Date(parsed.startDate).getTime()) {
        throw ApiError.badRequest("Tanggal selesai harus setelah tanggal mulai.");
      }
      const duplicate = await col.findFirst([
        { field: "label", op: "==", value: parsed.label }
      ]);
      if (duplicate) {
        throw ApiError.conflict(`Tahun ajaran "${parsed.label}" sudah terdaftar.`);
      }
      if (parsed.isActive) {
        const activeList = await col.list({
          filters: [{ field: "isActive", op: "==", value: true }]
        });
        await Promise.all(
          activeList.items.map((ay) => col.update(ay.id, { isActive: false }))
        );
      }
      const created = await col.create({
        label: parsed.label,
        semester: parsed.semester,
        startDate: new Date(parsed.startDate).toISOString(),
        endDate: new Date(parsed.endDate).toISOString(),
        isActive: parsed.isActive,
        createdBy: auth.user.id
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "ACADEMIC_YEAR_CREATED",
        entityType: "ACADEMIC_YEAR",
        entityId: created.id,
        after: { label: created.label, isActive: created.isActive },
        clientIp: auth.clientIp
      });
      sendOk(res, created, 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler10(req, res) {
  await handleAcademicYears(req, res);
}

// backend/academic-years/[id].ts
async function handleAcademicYearById(req, res, idOverride, repo = getRepository()) {
  try {
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID tahun ajaran wajib diisi.");
    const col = repo.collection("academicYears" /* ACADEMIC_YEARS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const item = await col.getById(id);
      if (!item) throw ApiError.notFound("Tahun ajaran tidak ditemukan.");
      sendOk(res, item);
      return;
    }
    if (req.method === "PATCH") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound("Tahun ajaran tidak ditemukan.");
      const parsed = academicYearUpdateSchema.parse(req.body ?? {});
      if (parsed.label && parsed.label !== existing.label) {
        const dup = await col.findFirst([{ field: "label", op: "==", value: parsed.label }]);
        if (dup && dup.id !== id) {
          throw ApiError.conflict(`Tahun ajaran "${parsed.label}" sudah terdaftar.`);
        }
      }
      const nextStart = parsed.startDate ? new Date(parsed.startDate).toISOString() : existing.startDate;
      const nextEnd = parsed.endDate ? new Date(parsed.endDate).toISOString() : existing.endDate;
      if (new Date(nextEnd).getTime() <= new Date(nextStart).getTime()) {
        throw ApiError.badRequest("Tanggal selesai harus setelah tanggal mulai.");
      }
      if (parsed.isActive === true) {
        const activeList = await col.list({
          filters: [{ field: "isActive", op: "==", value: true }]
        });
        await Promise.all(
          activeList.items.filter((ay) => ay.id !== id).map((ay) => col.update(ay.id, { isActive: false }))
        );
      }
      const updated = await col.update(id, {
        ...parsed.label !== void 0 ? { label: parsed.label } : {},
        ...parsed.semester !== void 0 ? { semester: parsed.semester } : {},
        ...parsed.startDate !== void 0 ? { startDate: nextStart } : {},
        ...parsed.endDate !== void 0 ? { endDate: nextEnd } : {},
        ...parsed.isActive !== void 0 ? { isActive: parsed.isActive } : {}
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "ACADEMIC_YEAR_UPDATED",
        entityType: "ACADEMIC_YEAR",
        entityId: id,
        before: { label: existing.label, isActive: existing.isActive },
        after: { label: updated?.label, isActive: updated?.isActive },
        clientIp: auth.clientIp
      });
      sendOk(res, updated);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}

// backend/classes/index.ts
async function handleClasses(req, res, repo = getRepository()) {
  try {
    const classCol = repo.collection("classes" /* CLASSES */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const search = getQueryString(req, "search").toLowerCase();
      const academicYearId = getQueryString(req, "academicYearId");
      const activeParam = getQueryString(req, "isActive");
      const [classesRes, teachersRes, yearsRes, studentsRes] = await Promise.all([
        classCol.list({ sort: { field: "name", direction: "asc" } }),
        repo.collection("teachers" /* TEACHERS */).list(),
        repo.collection("academicYears" /* ACADEMIC_YEARS */).list(),
        repo.collection("students" /* STUDENTS */).list()
      ]);
      const teacherMap = new Map(teachersRes.items.map((t) => [t.id, t.fullName]));
      const yearMap = new Map(yearsRes.items.map((y) => [y.id, y.label]));
      const studentCountMap = /* @__PURE__ */ new Map();
      for (const s of studentsRes.items) {
        if (s.status === "ACTIVE" /* ACTIVE */ || s.status === "DEMO_ACTIVE" /* DEMO_ACTIVE */) {
          studentCountMap.set(s.classId, (studentCountMap.get(s.classId) ?? 0) + 1);
        }
      }
      const filtered = classesRes.items.filter((c) => {
        if (academicYearId && c.academicYearId !== academicYearId) return false;
        if (activeParam === "true" && !c.isActive) return false;
        if (activeParam === "false" && c.isActive) return false;
        if (search) {
          const teacherName = c.homeroomTeacherId ? (teacherMap.get(c.homeroomTeacherId) ?? "").toLowerCase() : "";
          if (!c.name.toLowerCase().includes(search) && !c.gradeLevel.toLowerCase().includes(search) && !teacherName.includes(search)) {
            return false;
          }
        }
        return true;
      }).map((c) => ({
        ...c,
        homeroomTeacherName: c.homeroomTeacherId ? teacherMap.get(c.homeroomTeacherId) ?? null : null,
        academicYearLabel: yearMap.get(c.academicYearId) ?? "-",
        studentCount: studentCountMap.get(c.id) ?? 0
      }));
      sendOk(res, { items: filtered, total: filtered.length });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = schoolClassCreateSchema.parse(req.body ?? {});
      const year = await repo.collection("academicYears" /* ACADEMIC_YEARS */).getById(parsed.academicYearId);
      if (!year) throw ApiError.badRequest("Tahun ajaran tidak ditemukan.");
      if (parsed.homeroomTeacherId) {
        const teacher = await repo.collection("teachers" /* TEACHERS */).getById(parsed.homeroomTeacherId);
        if (!teacher) throw ApiError.badRequest("Wali kelas tidak ditemukan.");
      }
      const duplicate = await classCol.findFirst([
        { field: "name", op: "==", value: parsed.name },
        { field: "academicYearId", op: "==", value: parsed.academicYearId }
      ]);
      if (duplicate) {
        throw ApiError.conflict(
          `Kelas "${parsed.name}" sudah terdaftar pada tahun ajaran ${year.label}.`
        );
      }
      const created = await classCol.create({
        name: parsed.name,
        gradeLevel: parsed.gradeLevel,
        homeroomTeacherId: parsed.homeroomTeacherId || null,
        academicYearId: parsed.academicYearId,
        capacity: parsed.capacity ?? 30,
        isActive: parsed.isActive,
        createdBy: auth.user.id
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "CLASS_CREATED",
        entityType: "CLASS",
        entityId: created.id,
        after: { name: created.name, gradeLevel: created.gradeLevel, academicYearId: created.academicYearId },
        clientIp: auth.clientIp
      });
      sendOk(res, created, 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler11(req, res) {
  await handleClasses(req, res);
}

// backend/classes/import.ts
function parseBooleanInput(raw, defaultValue) {
  if (typeof raw === "boolean") return raw;
  const val = String(raw ?? "").trim().toUpperCase();
  if (!val) return defaultValue;
  if (["YA", "Y", "TRUE", "1", "AKTIF"].includes(val)) return true;
  if (["TIDAK", "NO", "FALSE", "0", "NONAKTIF"].includes(val)) return false;
  return defaultValue;
}
async function handleClassesImport(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const body = req.body;
    const mode = body?.mode ?? "preview";
    const rawRows = body?.rows ?? [];
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      throw ApiError.badRequest("Minimal 1 baris data kelas untuk diimpor.");
    }
    const [classesRes, yearsRes, teachersRes] = await Promise.all([
      repo.collection("classes" /* CLASSES */).list(),
      repo.collection("academicYears" /* ACADEMIC_YEARS */).list(),
      repo.collection("teachers" /* TEACHERS */).list()
    ]);
    const existingClasses = classesRes.items;
    const yearMap = new Map(yearsRes.items.map((y) => [y.label.trim().toUpperCase(), y]));
    const defaultYear = yearsRes.items.find((y) => y.isActive) ?? yearsRes.items[0] ?? null;
    const teacherByName = new Map(
      teachersRes.items.map((t) => [t.fullName.trim().toUpperCase(), t])
    );
    const seenClassKeys = /* @__PURE__ */ new Set();
    const previewRows = [];
    rawRows.forEach((row, idx) => {
      const rowNumber = idx + 1;
      const errors = [];
      const name = String(row.name ?? "").trim();
      const gradeLevel = String(row.gradeLevel ?? "").trim();
      const academicYearLabelInput = String(row.academicYearLabel ?? "").trim();
      const homeroomTeacherName = String(row.homeroomTeacherName ?? "").trim();
      const capacityRaw = row.capacity !== void 0 && row.capacity !== "" ? Number(row.capacity) : 30;
      const capacity = Number.isInteger(capacityRaw) && capacityRaw > 0 ? capacityRaw : 30;
      const isActive = parseBooleanInput(row.isActive, true);
      if (!name || name.length > 20) {
        errors.push("Nama kelas wajib diisi (maksimal 20 karakter).");
      }
      if (!gradeLevel || !["1", "2", "3", "4", "5", "6"].includes(gradeLevel)) {
        errors.push("Tingkat kelas harus berupa angka antara 1 sampai 6.");
      }
      let academicYearId = defaultYear?.id ?? null;
      let academicYearLabel = defaultYear?.label ?? "\u2014";
      if (academicYearLabelInput) {
        const matchedYear = yearMap.get(academicYearLabelInput.toUpperCase());
        if (matchedYear) {
          academicYearId = matchedYear.id;
          academicYearLabel = matchedYear.label;
        } else {
          errors.push(`Tahun ajaran "${academicYearLabelInput}" tidak ditemukan di sistem.`);
        }
      } else if (!defaultYear) {
        errors.push("Belum ada tahun ajaran aktif di sistem. Tambahkan tahun ajaran terlebih dahulu.");
      }
      let homeroomTeacherId = null;
      if (homeroomTeacherName) {
        const matchedTeacher = teacherByName.get(homeroomTeacherName.toUpperCase());
        if (matchedTeacher) {
          homeroomTeacherId = matchedTeacher.id;
        } else {
          errors.push(`Wali kelas "${homeroomTeacherName}" tidak ditemukan di Data Guru.`);
        }
      }
      if (name && academicYearId) {
        const key = `${name.toUpperCase()}_${academicYearId}`;
        const isDuplicateInDb = existingClasses.some(
          (c) => c.name.trim().toUpperCase() === name.toUpperCase() && c.academicYearId === academicYearId
        );
        if (isDuplicateInDb) {
          errors.push(`Kelas "${name}" sudah terdaftar pada tahun ajaran tersebut.`);
        }
        if (seenClassKeys.has(key)) {
          errors.push(`Kelas "${name}" duplikat di dalam berkas impor.`);
        }
        seenClassKeys.add(key);
      }
      previewRows.push({
        rowNumber,
        name,
        gradeLevel,
        academicYearLabel,
        academicYearId,
        homeroomTeacherName: homeroomTeacherName || "Belum ditentukan",
        homeroomTeacherId,
        capacity,
        isActive,
        valid: errors.length === 0,
        errors
      });
    });
    const validCount = previewRows.filter((r) => r.valid).length;
    const invalidCount = previewRows.length - validCount;
    if (mode === "preview") {
      sendOk(res, {
        mode: "preview",
        total: previewRows.length,
        validCount,
        invalidCount,
        rows: previewRows
      });
      return;
    }
    if (invalidCount > 0) {
      throw ApiError.badRequest(
        `Impor dibatalkan karena masih terdapat ${invalidCount} baris data kelas tidak valid.`,
        { previewRows, invalidCount }
      );
    }
    const classCol = repo.collection("classes" /* CLASSES */);
    const createdItems = await Promise.all(
      previewRows.map(
        (row) => classCol.create({
          name: row.name,
          gradeLevel: row.gradeLevel,
          homeroomTeacherId: row.homeroomTeacherId,
          academicYearId: row.academicYearId,
          capacity: row.capacity,
          isActive: row.isActive,
          createdBy: auth.user.id
        })
      )
    );
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "CLASSES_IMPORTED",
      entityType: "CLASS",
      entityId: "bulk_import",
      after: { count: createdItems.length },
      clientIp: auth.clientIp
    });
    sendOk(
      res,
      {
        mode: "commit",
        importedCount: createdItems.length
      },
      201
    );
  } catch (err) {
    sendError(res, err);
  }
}
async function handler12(req, res) {
  await handleClassesImport(req, res);
}

// backend/classes/bulk-delete.ts
import { z as z9 } from "zod";
var classBulkDeleteSchema = z9.object({
  ids: z9.array(z9.string().trim().min(1)).min(1, "Pilih minimal 1 kelas untuk dihapus.")
});
async function handleClassesBulkDelete(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = classBulkDeleteSchema.parse(req.body ?? {});
    const classCol = repo.collection("classes" /* CLASSES */);
    const studentCol = repo.collection("students" /* STUDENTS */);
    const scheduleCol = repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */);
    const enrollmentCol = repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */);
    let deletedCount = 0;
    const deletedIds = [];
    const failedIds = [];
    for (const id of parsed.ids) {
      const cls = await classCol.getById(id);
      if (!cls) continue;
      const studentsInClass = await studentCol.list({
        filters: [{ field: "classId", op: "==", value: id }]
      });
      if (studentsInClass.items.length > 0) {
        failedIds.push({
          id,
          reason: `Kelas "${cls.name}" masih memiliki ${studentsInClass.items.length} siswa terdaftar.`
        });
        continue;
      }
      const [schedulesRes, enrollmentsRes] = await Promise.all([
        scheduleCol.list({ filters: [{ field: "classId", op: "==", value: id }] }),
        enrollmentCol.list({ filters: [{ field: "classId", op: "==", value: id }] })
      ]);
      await Promise.all([
        ...schedulesRes.items.map((s) => scheduleCol.delete(s.id)),
        ...enrollmentsRes.items.map((enr) => enrollmentCol.delete(enr.id))
      ]);
      await classCol.delete(id);
      deletedCount++;
      deletedIds.push(id);
    }
    if (deletedCount > 0) {
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "CLASSES_BULK_DELETED",
        entityType: "CLASS",
        entityId: "bulk_delete",
        after: { deletedCount, deletedIds },
        clientIp: auth.clientIp
      });
    }
    sendOk(res, {
      deletedCount,
      deletedIds,
      failedIds
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler13(req, res) {
  await handleClassesBulkDelete(req, res);
}

// backend/classes/[id].ts
async function handleClassById(req, res, idOverride, repo = getRepository()) {
  try {
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID kelas wajib diisi.");
    const classCol = repo.collection("classes" /* CLASSES */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const item = await classCol.getById(id);
      if (!item) throw ApiError.notFound("Kelas tidak ditemukan.");
      sendOk(res, item);
      return;
    }
    if (req.method === "PATCH") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await classCol.getById(id);
      if (!existing) throw ApiError.notFound("Kelas tidak ditemukan.");
      const parsed = schoolClassUpdateSchema.parse(req.body ?? {});
      const targetName = parsed.name ?? existing.name;
      const targetYearId = parsed.academicYearId ?? existing.academicYearId;
      if (targetName !== existing.name || targetYearId !== existing.academicYearId) {
        const dup = await classCol.findFirst([
          { field: "name", op: "==", value: targetName },
          { field: "academicYearId", op: "==", value: targetYearId }
        ]);
        if (dup && dup.id !== id) {
          throw ApiError.conflict(`Kelas "${targetName}" sudah terdaftar pada tahun ajaran ini.`);
        }
      }
      if (parsed.homeroomTeacherId) {
        const teacher = await repo.collection("teachers" /* TEACHERS */).getById(parsed.homeroomTeacherId);
        if (!teacher) throw ApiError.badRequest("Wali kelas tidak ditemukan.");
      }
      const updated = await classCol.update(id, {
        ...parsed.name !== void 0 ? { name: parsed.name } : {},
        ...parsed.gradeLevel !== void 0 ? { gradeLevel: parsed.gradeLevel } : {},
        ...parsed.homeroomTeacherId !== void 0 ? { homeroomTeacherId: parsed.homeroomTeacherId || null } : {},
        ...parsed.academicYearId !== void 0 ? { academicYearId: parsed.academicYearId } : {},
        ...parsed.capacity !== void 0 ? { capacity: parsed.capacity } : {},
        ...parsed.isActive !== void 0 ? { isActive: parsed.isActive } : {}
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "CLASS_UPDATED",
        entityType: "CLASS",
        entityId: id,
        before: { name: existing.name, isActive: existing.isActive },
        after: { name: updated?.name, isActive: updated?.isActive },
        clientIp: auth.clientIp
      });
      sendOk(res, updated);
      return;
    }
    if (req.method === "DELETE") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await classCol.getById(id);
      if (!existing) throw ApiError.notFound("Kelas tidak ditemukan.");
      const studentsInClass = await repo.collection("students" /* STUDENTS */).list({
        filters: [{ field: "classId", op: "==", value: id }]
      });
      if (studentsInClass.items.length > 0) {
        throw ApiError.conflict(
          `Kelas "${existing.name}" masih memiliki ${studentsInClass.items.length} siswa terdaftar. Pindahkan atau hapus siswa terlebih dahulu sebelum menghapus kelas.`
        );
      }
      const scheduleCol = repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */);
      const enrollmentCol = repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */);
      const [schedulesRes, enrollmentsRes] = await Promise.all([
        scheduleCol.list({ filters: [{ field: "classId", op: "==", value: id }] }),
        enrollmentCol.list({ filters: [{ field: "classId", op: "==", value: id }] })
      ]);
      await Promise.all([
        ...schedulesRes.items.map((s) => scheduleCol.delete(s.id)),
        ...enrollmentsRes.items.map((enr) => enrollmentCol.delete(enr.id))
      ]);
      await classCol.delete(id);
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "CLASS_DELETED",
        entityType: "CLASS",
        entityId: id,
        before: { name: existing.name, academicYearId: existing.academicYearId },
        reason: "Dihapus oleh admin.",
        clientIp: auth.clientIp
      });
      sendOk(res, { deleted: true, id });
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}

// backend/subjects/index.ts
async function handleSubjects(req, res, repo = getRepository()) {
  try {
    const col = repo.collection("subjects" /* SUBJECTS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const search = getQueryString(req, "search").toLowerCase();
      const activeParam = getQueryString(req, "isActive");
      const result = await col.list({ sort: { field: "name", direction: "asc" } });
      const filtered = result.items.filter((item) => {
        if (activeParam === "true" && !item.isActive) return false;
        if (activeParam === "false" && item.isActive) return false;
        if (search && !item.name.toLowerCase().includes(search) && !item.code.toLowerCase().includes(search)) {
          return false;
        }
        return true;
      });
      sendOk(res, { items: filtered, total: filtered.length });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = subjectCreateSchema.parse(req.body ?? {});
      const normalizedCode = parsed.code.toUpperCase();
      const duplicate = await col.findFirst([
        { field: "code", op: "==", value: normalizedCode }
      ]);
      if (duplicate) {
        throw ApiError.conflict(`Kode mata pelajaran "${normalizedCode}" sudah digunakan.`);
      }
      const created = await col.create({
        name: parsed.name,
        code: normalizedCode,
        defaultToHomeroomTeacher: Boolean(parsed.defaultToHomeroomTeacher),
        isActive: parsed.isActive,
        createdBy: auth.user.id
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SUBJECT_CREATED",
        entityType: "SUBJECT",
        entityId: created.id,
        after: {
          code: created.code,
          name: created.name,
          defaultToHomeroomTeacher: created.defaultToHomeroomTeacher ?? false
        },
        clientIp: auth.clientIp
      });
      sendOk(res, created, 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler14(req, res) {
  await handleSubjects(req, res);
}

// backend/subjects/import.ts
function parseBooleanInput2(raw, defaultValue) {
  if (typeof raw === "boolean") return raw;
  const val = String(raw ?? "").trim().toUpperCase();
  if (!val) return defaultValue;
  if (["YA", "Y", "TRUE", "1", "AKTIF", "WALI", "WALI KELAS"].includes(val)) return true;
  if (["TIDAK", "NO", "FALSE", "0", "NONAKTIF"].includes(val)) return false;
  return defaultValue;
}
async function handleSubjectsImport(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = subjectImportRequestSchema.parse(req.body ?? {});
    const subjectCol = repo.collection("subjects" /* SUBJECTS */);
    const existingSubjects = await subjectCol.list();
    const existingCodes = new Set(existingSubjects.items.map((s) => s.code.toUpperCase()));
    const seenCodesInFile = /* @__PURE__ */ new Set();
    const previewRows = parsed.rows.map((row, idx) => {
      const errors = [];
      const code = row.code.trim().toUpperCase();
      const name = row.name.trim();
      const defaultToHomeroomTeacher = parseBooleanInput2(row.defaultToHomeroomTeacher, false);
      const isActive = parseBooleanInput2(row.isActive, true);
      if (!code) {
        errors.push("Kode mata pelajaran wajib diisi.");
      } else if (code.length < 2 || code.length > 20 || !/^[A-Za-z0-9_-]+$/.test(code)) {
        errors.push('Kode harus 2\u201320 karakter (huruf, angka, "-" atau "_").');
      } else if (existingCodes.has(code)) {
        errors.push(`Kode "${code}" sudah terdaftar di sistem.`);
      } else if (seenCodesInFile.has(code)) {
        errors.push(`Kode "${code}" duplikat di dalam file impor.`);
      } else {
        seenCodesInFile.add(code);
      }
      if (!name || name.length < 2) {
        errors.push("Nama mata pelajaran minimal 2 karakter.");
      }
      return {
        rowNumber: idx + 1,
        code,
        name,
        defaultToHomeroomTeacher,
        isActive,
        valid: errors.length === 0,
        errors
      };
    });
    const validCount = previewRows.filter((r) => r.valid).length;
    const invalidCount = previewRows.length - validCount;
    if (parsed.mode === "preview") {
      sendOk(res, {
        mode: "preview",
        total: previewRows.length,
        validCount,
        invalidCount,
        rows: previewRows
      });
      return;
    }
    if (invalidCount > 0) {
      throw ApiError.badRequest(
        `Impor dibatalkan karena masih terdapat ${invalidCount} baris tidak valid.`,
        { previewRows, invalidCount }
      );
    }
    const createdSubjects = await Promise.all(
      previewRows.map(
        (row) => subjectCol.create({
          code: row.code,
          name: row.name,
          defaultToHomeroomTeacher: row.defaultToHomeroomTeacher,
          isActive: row.isActive,
          createdBy: auth.user.id
        })
      )
    );
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "SUBJECTS_IMPORTED",
      entityType: "SUBJECT",
      entityId: "bulk_import",
      after: { count: createdSubjects.length },
      clientIp: auth.clientIp
    });
    sendOk(
      res,
      {
        mode: "commit",
        importedCount: createdSubjects.length
      },
      201
    );
  } catch (err) {
    sendError(res, err);
  }
}
async function handler15(req, res) {
  await handleSubjectsImport(req, res);
}

// backend/subjects/bulk-delete.ts
import { z as z10 } from "zod";
var subjectBulkDeleteSchema = z10.object({
  ids: z10.array(z10.string().trim().min(1)).min(1, "Pilih minimal 1 mata pelajaran untuk dihapus.")
});
async function handleSubjectsBulkDelete(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = subjectBulkDeleteSchema.parse(req.body ?? {});
    const subjectCol = repo.collection("subjects" /* SUBJECTS */);
    const scheduleCol = repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */);
    const schedulesRes = await scheduleCol.list();
    const activeSubjectIds = new Set(
      schedulesRes.items.filter((s) => s.isActive).map((s) => s.subjectId)
    );
    let deletedCount = 0;
    const deletedIds = [];
    const failedIds = [];
    for (const id of parsed.ids) {
      const subject = await subjectCol.getById(id);
      if (!subject) {
        continue;
      }
      if (activeSubjectIds.has(id)) {
        failedIds.push({
          id,
          reason: `Mata pelajaran "${subject.name}" masih memiliki jadwal mengajar aktif dan tidak dapat dihapus.`
        });
        continue;
      }
      await subjectCol.delete(id);
      deletedCount++;
      deletedIds.push(id);
    }
    if (deletedCount > 0) {
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SUBJECTS_BULK_DELETED",
        entityType: "SUBJECT",
        entityId: "bulk_delete",
        after: { deletedCount, deletedIds },
        clientIp: auth.clientIp
      });
    }
    sendOk(res, {
      deletedCount,
      deletedIds,
      failedIds
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler16(req, res) {
  await handleSubjectsBulkDelete(req, res);
}

// backend/subjects/[id].ts
async function handleSubjectById(req, res, idOverride, repo = getRepository()) {
  try {
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID mata pelajaran wajib diisi.");
    const col = repo.collection("subjects" /* SUBJECTS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const item = await col.getById(id);
      if (!item) throw ApiError.notFound("Mata pelajaran tidak ditemukan.");
      sendOk(res, item);
      return;
    }
    if (req.method === "PATCH") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound("Mata pelajaran tidak ditemukan.");
      const parsed = subjectUpdateSchema.parse(req.body ?? {});
      const normalizedCode = parsed.code ? parsed.code.toUpperCase() : void 0;
      if (normalizedCode && normalizedCode !== existing.code) {
        const dup = await col.findFirst([{ field: "code", op: "==", value: normalizedCode }]);
        if (dup && dup.id !== id) {
          throw ApiError.conflict(`Kode mata pelajaran "${normalizedCode}" sudah digunakan.`);
        }
      }
      const updated = await col.update(id, {
        ...parsed.name !== void 0 ? { name: parsed.name } : {},
        ...normalizedCode !== void 0 ? { code: normalizedCode } : {},
        ...parsed.isActive !== void 0 ? { isActive: parsed.isActive } : {}
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SUBJECT_UPDATED",
        entityType: "SUBJECT",
        entityId: id,
        before: { code: existing.code, name: existing.name, isActive: existing.isActive },
        after: { code: updated?.code, name: updated?.name, isActive: updated?.isActive },
        clientIp: auth.clientIp
      });
      sendOk(res, updated);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}

// backend/students/index.ts
async function handleStudents(req, res, repo = getRepository()) {
  try {
    const studentCol = repo.collection("students" /* STUDENTS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const search = getQueryString(req, "search").toLowerCase();
      const classId = getQueryString(req, "classId");
      const status = getQueryString(req, "status");
      const isDemoParam = getQueryString(req, "isDemo");
      const cursor = getQueryString(req, "cursor");
      const limit = getQueryInt(req, "limit", 10, 1, 2e3);
      const [studentsRes, classesRes] = await Promise.all([
        studentCol.list({ sort: { field: "nis", direction: "asc" } }),
        repo.collection("classes" /* CLASSES */).list()
      ]);
      const classMap = new Map(classesRes.items.map((c) => [c.id, c.name]));
      const totalDemoStudents = studentsRes.items.filter(
        (s) => Boolean(s.isDemo) && s.status !== "INACTIVE" /* INACTIVE */
      ).length;
      const filtered = studentsRes.items.filter((s) => {
        if (classId && s.classId !== classId) return false;
        if (status && s.status !== status) return false;
        if (isDemoParam === "true" && !s.isDemo) return false;
        if (isDemoParam === "false" && s.isDemo) return false;
        if (search) {
          const clsName = (classMap.get(s.classId) ?? "").toLowerCase();
          if (!s.fullName.toLowerCase().includes(search) && !s.nis.toLowerCase().includes(search) && !clsName.includes(search)) {
            return false;
          }
        }
        return true;
      }).map((s) => ({
        ...s,
        className: classMap.get(s.classId) ?? "-",
        isDemo: Boolean(s.isDemo)
      }));
      const paginated = paginateArrayByCursor(filtered, cursor, limit);
      sendOk(res, {
        items: paginated.items,
        total: paginated.total,
        nextCursor: paginated.nextCursor,
        totalDemoStudents
      });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = studentCreateSchema.parse(req.body ?? {});
      const duplicate = await studentCol.findFirst([
        { field: "nis", op: "==", value: parsed.nis }
      ]);
      if (duplicate) {
        throw ApiError.conflict(`NIS "${parsed.nis}" sudah terdaftar pada siswa lain.`);
      }
      const schoolClass = await repo.collection("classes" /* CLASSES */).getById(parsed.classId);
      if (!schoolClass) {
        throw ApiError.badRequest("Kelas yang dipilih tidak ditemukan.");
      }
      const activeYear = await repo.collection("academicYears" /* ACADEMIC_YEARS */).findFirst([{ field: "isActive", op: "==", value: true }]);
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const created = await studentCol.create({
        nis: parsed.nis,
        fullName: parsed.fullName,
        classId: parsed.classId,
        gender: parsed.gender ?? null,
        photoPath: parsed.photoPath ?? null,
        status: parsed.status,
        qrTokenId: null,
        isDemo: false,
        createdBy: auth.user.id
      });
      await repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */).create({
        studentId: created.id,
        classId: created.classId,
        academicYearId: activeYear?.id ?? schoolClass.academicYearId,
        startDate: nowIso,
        endDate: null,
        status: "ACTIVE" /* ACTIVE */,
        createdBy: auth.user.id
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "STUDENT_CREATED",
        entityType: "STUDENT",
        entityId: created.id,
        after: {
          nis: created.nis,
          fullName: created.fullName,
          classId: created.classId,
          status: created.status
        },
        clientIp: auth.clientIp
      });
      sendOk(res, { ...created, className: schoolClass.name }, 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler17(req, res) {
  await handleStudents(req, res);
}

// backend/students/[id].ts
async function handleStudentById(req, res, idOverride, repo = getRepository()) {
  try {
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID siswa wajib diisi.");
    const studentCol = repo.collection("students" /* STUDENTS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const student = await studentCol.getById(id);
      if (!student) throw ApiError.notFound("Data siswa tidak ditemukan.");
      const [cls, enrollmentsRes, classesRes, yearsRes] = await Promise.all([
        repo.collection("classes" /* CLASSES */).getById(student.classId),
        repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */).list({
          filters: [{ field: "studentId", op: "==", value: student.id }],
          sort: { field: "startDate", direction: "desc" }
        }),
        repo.collection("classes" /* CLASSES */).list(),
        repo.collection("academicYears" /* ACADEMIC_YEARS */).list()
      ]);
      const classMap = new Map(classesRes.items.map((c) => [c.id, c.name]));
      const yearMap = new Map(yearsRes.items.map((y) => [y.id, y.label]));
      sendOk(res, {
        ...student,
        className: cls?.name ?? "-",
        enrollments: enrollmentsRes.items.map((enr) => ({
          ...enr,
          className: classMap.get(enr.classId) ?? "-",
          academicYearLabel: yearMap.get(enr.academicYearId) ?? "-"
        }))
      });
      return;
    }
    if (req.method === "PATCH") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await studentCol.getById(id);
      if (!existing) throw ApiError.notFound("Data siswa tidak ditemukan.");
      const parsed = studentUpdateSchema.parse(req.body ?? {});
      if (parsed.nis && parsed.nis !== existing.nis) {
        const dup = await studentCol.findFirst([{ field: "nis", op: "==", value: parsed.nis }]);
        if (dup && dup.id !== id) {
          throw ApiError.conflict(`NIS "${parsed.nis}" sudah terdaftar pada siswa lain.`);
        }
      }
      let targetClassName;
      let targetClassAcademicYearId;
      if (parsed.classId && parsed.classId !== existing.classId) {
        const nextClass = await repo.collection("classes" /* CLASSES */).getById(parsed.classId);
        if (!nextClass) {
          throw ApiError.badRequest("Kelas tujuan tidak ditemukan.");
        }
        targetClassName = nextClass.name;
        targetClassAcademicYearId = nextClass.academicYearId;
      }
      const updated = await studentCol.update(id, {
        ...parsed.nis !== void 0 ? { nis: parsed.nis } : {},
        ...parsed.fullName !== void 0 ? { fullName: parsed.fullName } : {},
        ...parsed.classId !== void 0 ? { classId: parsed.classId } : {},
        ...parsed.gender !== void 0 ? { gender: parsed.gender } : {},
        ...parsed.photoPath !== void 0 ? { photoPath: parsed.photoPath } : {},
        ...parsed.status !== void 0 ? { status: parsed.status } : {}
      });
      if (parsed.classId && parsed.classId !== existing.classId) {
        const enrCol = repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */);
        const nowIso = (/* @__PURE__ */ new Date()).toISOString();
        const activeEnrollments = await enrCol.list({
          filters: [
            { field: "studentId", op: "==", value: id },
            { field: "status", op: "==", value: "ACTIVE" /* ACTIVE */ }
          ]
        });
        await Promise.all(
          activeEnrollments.items.map(
            (enr) => enrCol.update(enr.id, {
              endDate: nowIso,
              status: "COMPLETED" /* COMPLETED */
            })
          )
        );
        const activeYear = await repo.collection("academicYears" /* ACADEMIC_YEARS */).findFirst([{ field: "isActive", op: "==", value: true }]);
        await enrCol.create({
          studentId: id,
          classId: parsed.classId,
          academicYearId: activeYear?.id ?? targetClassAcademicYearId ?? "ay_2026_2027",
          startDate: nowIso,
          endDate: null,
          status: "ACTIVE" /* ACTIVE */,
          createdBy: auth.user.id
        });
      }
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "STUDENT_UPDATED",
        entityType: "STUDENT",
        entityId: id,
        before: {
          nis: existing.nis,
          fullName: existing.fullName,
          classId: existing.classId,
          status: existing.status
        },
        after: {
          nis: updated?.nis,
          fullName: updated?.fullName,
          classId: updated?.classId,
          status: updated?.status
        },
        reason: parsed.reason ?? null,
        clientIp: auth.clientIp
      });
      sendOk(res, { ...updated, ...targetClassName ? { className: targetClassName } : {} });
      return;
    }
    if (req.method === "DELETE") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await studentCol.getById(id);
      if (!existing) throw ApiError.notFound("Data siswa tidak ditemukan.");
      const isPermanent = getQueryString(req, "permanent") === "true";
      if (isPermanent) {
        const enrollmentCol = repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */);
        const qrCol = repo.collection("qrTokens" /* QR_TOKENS */);
        const [enrollments, qrTokens] = await Promise.all([
          enrollmentCol.list({ filters: [{ field: "studentId", op: "==", value: id }] }),
          qrCol.list({
            filters: [
              { field: "ownerType", op: "==", value: "STUDENT" /* STUDENT */ },
              { field: "ownerId", op: "==", value: id }
            ]
          })
        ]);
        await Promise.all([
          ...enrollments.items.map((enr) => enrollmentCol.delete(enr.id)),
          ...qrTokens.items.map((qr) => qrCol.delete(qr.id))
        ]);
        await studentCol.delete(id);
        await recordActivityLog(repo, {
          actorUserId: auth.user.id,
          actorRole: auth.user.role,
          action: "STUDENT_DELETED",
          entityType: "STUDENT",
          entityId: id,
          before: { nis: existing.nis, fullName: existing.fullName, classId: existing.classId },
          reason: "Dihapus permanen oleh admin.",
          clientIp: auth.clientIp
        });
        sendOk(res, { deleted: true, id });
        return;
      }
      const archived = await studentCol.update(id, {
        status: "INACTIVE" /* INACTIVE */
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "STUDENT_ARCHIVED",
        entityType: "STUDENT",
        entityId: id,
        before: { status: existing.status },
        after: { status: "INACTIVE" /* INACTIVE */ },
        reason: "Diarsipkan oleh admin (tanpa penghapusan permanen).",
        clientIp: auth.clientIp
      });
      sendOk(res, { archived: true, student: archived });
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}

// backend/students/import.ts
function parseGender(raw) {
  const clean = raw.trim().toUpperCase();
  if (!clean) return { value: null };
  if (clean === "L" || clean === "LAKI-LAKI" || clean === "LAKI LAKI") return { value: "L" /* L */ };
  if (clean === "P" || clean === "PEREMPUAN") return { value: "P" /* P */ };
  return { value: null, error: "Jenis kelamin harus L atau P (atau dikosongkan)." };
}
function parseStudentStatus(raw) {
  const clean = raw.trim().toUpperCase();
  if (!clean || clean === "ACTIVE" || clean === "AKTIF") return { value: "ACTIVE" /* ACTIVE */ };
  if (clean === "GRADUATED" || clean === "LULUS") return { value: "GRADUATED" /* GRADUATED */ };
  if (clean === "TRANSFERRED" || clean === "PINDAH") return { value: "TRANSFERRED" /* TRANSFERRED */ };
  if (clean === "INACTIVE" || clean === "NONAKTIF") return { value: "INACTIVE" /* INACTIVE */ };
  return {
    value: "ACTIVE" /* ACTIVE */,
    error: `Status "${raw}" tidak dikenali (gunakan ACTIVE, GRADUATED, TRANSFERRED, atau INACTIVE).`
  };
}
async function handleStudentsImport(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = studentImportRequestSchema.parse(req.body ?? {});
    const [existingStudentsRes, classesRes, activeYear] = await Promise.all([
      repo.collection("students" /* STUDENTS */).list(),
      repo.collection("classes" /* CLASSES */).list(),
      repo.collection("academicYears" /* ACADEMIC_YEARS */).findFirst([{ field: "isActive", op: "==", value: true }])
    ]);
    const existingNisSet = new Set(existingStudentsRes.items.map((s) => s.nis));
    const classByName = new Map(
      classesRes.items.map((c) => [c.name.trim().toUpperCase(), c])
    );
    const seenInFile = /* @__PURE__ */ new Set();
    const validatedRows = [];
    parsed.rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const errors = [];
      const nis = String(row.nis ?? "").trim();
      const fullName = String(row.fullName ?? "").trim();
      const className = String(row.className ?? "").trim();
      if (!nis) {
        errors.push("Kolom NIS kosong.");
      } else {
        const nisCheck = nisSchema.safeParse(nis);
        if (!nisCheck.success) {
          errors.push(nisCheck.error.issues[0]?.message ?? "Format NIS tidak valid.");
        }
        if (existingNisSet.has(nis)) {
          errors.push(`NIS "${nis}" sudah terdaftar di sistem.`);
        }
        if (seenInFile.has(nis)) {
          errors.push(`NIS "${nis}" duplikat di dalam berkas impor.`);
        }
        seenInFile.add(nis);
      }
      if (!fullName || fullName.length < 2) {
        errors.push("Nama lengkap wajib diisi (minimal 2 karakter).");
      }
      let classId = null;
      if (!className) {
        errors.push("Kolom kelas kosong.");
      } else {
        const matchedClass = classByName.get(className.toUpperCase());
        if (!matchedClass) {
          errors.push(`Kelas "${className}" tidak ditemukan di master kelas.`);
        } else {
          classId = matchedClass.id;
        }
      }
      const genderParsed = parseGender(row.gender ?? "");
      if (genderParsed.error) errors.push(genderParsed.error);
      const statusParsed = parseStudentStatus(row.status ?? "");
      if (statusParsed.error) errors.push(statusParsed.error);
      validatedRows.push({
        rowNumber,
        nis,
        fullName,
        className,
        classId,
        gender: genderParsed.value,
        status: statusParsed.value,
        valid: errors.length === 0,
        errors
      });
    });
    const validCount = validatedRows.filter((r) => r.valid).length;
    const invalidCount = validatedRows.length - validCount;
    if (parsed.mode === "preview") {
      sendOk(res, {
        mode: "preview",
        totalRows: validatedRows.length,
        validCount,
        invalidCount,
        rows: validatedRows
      });
      return;
    }
    if (invalidCount > 0) {
      throw ApiError.badRequest(
        `Impor dibatalkan karena terdapat ${invalidCount} baris tidak valid. Perbaiki berkas dan pratinjau ulang.`,
        { rows: validatedRows.filter((r) => !r.valid) }
      );
    }
    const studentCol = repo.collection("students" /* STUDENTS */);
    const enrollmentCol = repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const createdIds = [];
    for (const row of validatedRows) {
      const created = await studentCol.create({
        nis: row.nis,
        fullName: row.fullName,
        classId: row.classId,
        gender: row.gender,
        photoPath: null,
        status: row.status,
        qrTokenId: null,
        isDemo: false,
        createdBy: auth.user.id
      });
      createdIds.push(created.id);
      await enrollmentCol.create({
        studentId: created.id,
        classId: created.classId,
        academicYearId: activeYear?.id ?? "ay_2026_2027",
        startDate: nowIso,
        endDate: null,
        status: "ACTIVE" /* ACTIVE */,
        createdBy: auth.user.id
      });
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "STUDENTS_IMPORTED",
      entityType: "STUDENT",
      entityId: "batch_import",
      after: { importedCount: createdIds.length },
      clientIp: auth.clientIp
    });
    sendOk(
      res,
      {
        mode: "commit",
        importedCount: createdIds.length,
        createdIds
      },
      201
    );
  } catch (err) {
    sendError(res, err);
  }
}
async function handler18(req, res) {
  await handleStudentsImport(req, res);
}

// backend/students/bulk-archive.ts
async function handleStudentsBulkArchive(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = bulkArchiveSchema.parse(req.body ?? {});
    const studentCol = repo.collection("students" /* STUDENTS */);
    let archivedCount = 0;
    for (const id of parsed.ids) {
      const existing = await studentCol.getById(id);
      if (existing && existing.status !== "INACTIVE" /* INACTIVE */) {
        await studentCol.update(id, { status: "INACTIVE" /* INACTIVE */ });
        archivedCount++;
      }
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "STUDENTS_BULK_ARCHIVED",
      entityType: "STUDENT",
      entityId: "bulk",
      after: { requestedCount: parsed.ids.length, archivedCount },
      reason: parsed.reason ?? "Pengarsipan massal siswa.",
      clientIp: auth.clientIp
    });
    sendOk(res, { archivedCount });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler19(req, res) {
  await handleStudentsBulkArchive(req, res);
}

// backend/students/bulk-delete.ts
async function runInChunks(items, chunkSize, worker) {
  for (let i = 0; i < items.length; i += chunkSize) {
    await Promise.all(items.slice(i, i + chunkSize).map(worker));
  }
}
async function handleStudentsBulkDelete(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = bulkArchiveSchema.parse(req.body ?? {});
    const targetIds = new Set(parsed.ids);
    const studentCol = repo.collection("students" /* STUDENTS */);
    const enrollmentCol = repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */);
    const qrCol = repo.collection("qrTokens" /* QR_TOKENS */);
    const [studentsRes, enrollmentsRes, qrTokensRes] = await Promise.all([
      studentCol.list(),
      enrollmentCol.list(),
      qrCol.list({ filters: [{ field: "ownerType", op: "==", value: "STUDENT" /* STUDENT */ }] })
    ]);
    const existingStudents = studentsRes.items.filter((s) => targetIds.has(s.id));
    const enrollmentsToDelete = enrollmentsRes.items.filter((e) => targetIds.has(e.studentId));
    const qrTokensToDelete = qrTokensRes.items.filter((q) => targetIds.has(q.ownerId));
    await Promise.all([
      runInChunks(enrollmentsToDelete, 25, (enr) => enrollmentCol.delete(enr.id)),
      runInChunks(qrTokensToDelete, 25, (qr) => qrCol.delete(qr.id)),
      runInChunks(existingStudents, 25, (student) => studentCol.delete(student.id))
    ]);
    const deletedCount = existingStudents.length;
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "STUDENTS_BULK_DELETED",
      entityType: "STUDENT",
      entityId: "bulk",
      after: { requestedCount: parsed.ids.length, deletedCount },
      reason: parsed.reason ?? "Penghapusan massal data siswa oleh admin.",
      clientIp: auth.clientIp
    });
    sendOk(res, { deletedCount });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler20(req, res) {
  await handleStudentsBulkDelete(req, res);
}

// backend/teachers/index.ts
import crypto8 from "node:crypto";
async function handleTeachers(req, res, repo = getRepository()) {
  try {
    const teacherCol = repo.collection("teachers" /* TEACHERS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const search = getQueryString(req, "search").toLowerCase();
      const status = getQueryString(req, "status");
      const cursor = getQueryString(req, "cursor");
      const limit = getQueryInt(req, "limit", 10, 1, 1e3);
      const [teachersRes, usersRes] = await Promise.all([
        teacherCol.list({ sort: { field: "fullName", direction: "asc" } }),
        repo.collection("users" /* USERS */).list()
      ]);
      const userById = new Map(
        usersRes.items.map((u) => [
          u.id,
          {
            id: u.id,
            username: u.username,
            role: u.role,
            isActive: u.isActive,
            mustChangePassword: u.mustChangePassword
          }
        ])
      );
      const filtered = teachersRes.items.filter((t) => {
        if (status && t.status !== status) return false;
        if (search) {
          const linked = t.userId ? userById.get(t.userId) : null;
          if (!t.fullName.toLowerCase().includes(search) && !t.niyNip.toLowerCase().includes(search) && !t.position.toLowerCase().includes(search) && !(linked?.username.toLowerCase().includes(search) ?? false)) {
            return false;
          }
        }
        return true;
      }).sort((a, b) => {
        const aIsPrincipal = a.position.toLowerCase().includes("kepala sekolah") ? 0 : 1;
        const bIsPrincipal = b.position.toLowerCase().includes("kepala sekolah") ? 0 : 1;
        if (aIsPrincipal !== bIsPrincipal) return aIsPrincipal - bIsPrincipal;
        return a.fullName.localeCompare(b.fullName, "id");
      }).map((t) => {
        const linked = t.userId ? userById.get(t.userId) ?? null : null;
        return {
          ...t,
          username: linked?.username ?? null,
          accountRole: linked?.role ?? null,
          accountActive: linked?.isActive ?? false,
          mustChangePassword: linked?.mustChangePassword ?? false
        };
      });
      const paginated = paginateArrayByCursor(filtered, cursor, limit);
      sendOk(res, paginated);
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = teacherCreateSchema.parse(req.body ?? {});
      const duplicate = await teacherCol.findFirst([
        { field: "niyNip", op: "==", value: parsed.niyNip }
      ]);
      if (duplicate) {
        throw ApiError.conflict(`NIY/NIP "${parsed.niyNip}" sudah terdaftar pada guru lain.`);
      }
      let createdUserId = null;
      let createdUsername = null;
      const teacherId = `tch_${crypto8.randomBytes(6).toString("hex")}`;
      if (parsed.createAccount) {
        if (!parsed.password || parsed.password.length < 6) {
          throw ApiError.badRequest("Kata sandi akun guru wajib diisi minimal 6 karakter.");
        }
        const userId = `usr_${crypto8.randomBytes(6).toString("hex")}`;
        const desiredBase = parsed.username && parsed.username.trim().length >= 3 ? parsed.username.trim() : await findAvailableUsername(repo, buildUsernameBaseFromName(parsed.fullName));
        const normalizedUsername = await reserveUniqueUsername(repo, desiredBase, userId);
        const passwordHash = await hashPassword(parsed.password);
        await repo.collection("users" /* USERS */).create({
          id: userId,
          username: normalizedUsername,
          normalizedUsername,
          passwordHash,
          passwordCipher: encryptPasswordForAdminView(parsed.password),
          role: "TEACHER" /* TEACHER */,
          linkedTeacherId: teacherId,
          isActive: true,
          mustChangePassword: false,
          lastLoginAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
          createdBy: auth.user.id
        });
        createdUserId = userId;
        createdUsername = normalizedUsername;
      }
      const normalizedWorkingDays = parsed.workingDays && parsed.workingDays.length > 0 ? Array.from(new Set(parsed.workingDays)).sort((a, b) => a - b) : null;
      const created = await teacherCol.create({
        id: teacherId,
        niyNip: parsed.niyNip,
        fullName: parsed.fullName,
        position: parsed.position,
        photoPath: parsed.photoPath ?? null,
        userId: createdUserId,
        qrTokenId: null,
        ...normalizedWorkingDays ? { workingDays: normalizedWorkingDays } : {},
        status: parsed.status,
        createdBy: auth.user.id
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "TEACHER_CREATED",
        entityType: "TEACHER",
        entityId: created.id,
        after: {
          niyNip: created.niyNip,
          fullName: created.fullName,
          position: created.position,
          hasAccount: Boolean(createdUserId)
        },
        clientIp: auth.clientIp
      });
      sendOk(
        res,
        {
          teacher: {
            ...created,
            username: createdUsername,
            accountActive: Boolean(createdUserId)
          },
          ...createdUsername ? {
            accountProvisioned: {
              username: createdUsername,
              mustChangePassword: false
            }
          } : {}
        },
        201
      );
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler21(req, res) {
  await handleTeachers(req, res);
}

// backend/teachers/[id].ts
import crypto9 from "node:crypto";
async function handleTeacherById(req, res, idOverride, repo = getRepository()) {
  try {
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID guru wajib diisi.");
    const teacherCol = repo.collection("teachers" /* TEACHERS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const teacher = await teacherCol.getById(id);
      if (!teacher) throw ApiError.notFound("Data guru tidak ditemukan.");
      let username = null;
      let accountActive = false;
      if (teacher.userId) {
        const linked = await repo.collection("users" /* USERS */).getById(teacher.userId);
        if (linked) {
          username = linked.username;
          accountActive = linked.isActive;
        }
      }
      sendOk(res, { ...teacher, username, accountActive });
      return;
    }
    if (req.method === "PATCH") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await teacherCol.getById(id);
      if (!existing) throw ApiError.notFound("Data guru tidak ditemukan.");
      const parsed = teacherUpdateSchema.parse(req.body ?? {});
      if (parsed.niyNip && parsed.niyNip !== existing.niyNip) {
        const dup = await teacherCol.findFirst([
          { field: "niyNip", op: "==", value: parsed.niyNip }
        ]);
        if (dup && dup.id !== id) {
          throw ApiError.conflict(`NIY/NIP "${parsed.niyNip}" sudah terdaftar pada guru lain.`);
        }
      }
      let linkedUserId = existing.userId;
      let accountProvisioned;
      if (parsed.createAccount && !existing.userId) {
        const userId = `usr_${crypto9.randomBytes(6).toString("hex")}`;
        const desiredBase = parsed.username && parsed.username.trim().length >= 3 ? parsed.username.trim() : await findAvailableUsername(
          repo,
          buildUsernameBaseFromName(parsed.fullName ?? existing.fullName)
        );
        const normalizedUsername = await reserveUniqueUsername(repo, desiredBase, userId);
        const temporaryPassword = generateTemporaryPassword(12);
        const passwordHash = await hashPassword(temporaryPassword);
        await repo.collection("users" /* USERS */).create({
          id: userId,
          username: normalizedUsername,
          normalizedUsername,
          passwordHash,
          passwordCipher: encryptPasswordForAdminView(temporaryPassword),
          role: "TEACHER" /* TEACHER */,
          linkedTeacherId: existing.id,
          isActive: true,
          mustChangePassword: false,
          lastLoginAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
          createdBy: auth.user.id
        });
        linkedUserId = userId;
        accountProvisioned = {
          username: normalizedUsername,
          temporaryPassword,
          mustChangePassword: false
        };
      }
      const normalizedWorkingDays = parsed.workingDays === void 0 ? void 0 : parsed.workingDays === null || parsed.workingDays.length === 0 ? null : Array.from(new Set(parsed.workingDays)).sort((a, b) => a - b);
      const updated = await teacherCol.update(id, {
        ...parsed.niyNip !== void 0 ? { niyNip: parsed.niyNip } : {},
        ...parsed.fullName !== void 0 ? { fullName: parsed.fullName } : {},
        ...parsed.position !== void 0 ? { position: parsed.position } : {},
        ...parsed.photoPath !== void 0 ? { photoPath: parsed.photoPath } : {},
        ...normalizedWorkingDays !== void 0 ? { workingDays: normalizedWorkingDays } : {},
        ...parsed.status !== void 0 ? { status: parsed.status } : {},
        ...linkedUserId !== existing.userId ? { userId: linkedUserId } : {}
      });
      if (parsed.status !== void 0 && linkedUserId) {
        const isActive = parsed.status === "ACTIVE" /* ACTIVE */;
        await repo.collection("users" /* USERS */).update(linkedUserId, { isActive });
        if (!isActive) {
          await revokeAllUserSessions(repo, linkedUserId);
        }
      }
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "TEACHER_UPDATED",
        entityType: "TEACHER",
        entityId: id,
        before: {
          niyNip: existing.niyNip,
          fullName: existing.fullName,
          position: existing.position,
          workingDays: existing.workingDays ?? null,
          status: existing.status
        },
        after: {
          niyNip: updated?.niyNip,
          fullName: updated?.fullName,
          position: updated?.position,
          workingDays: updated?.workingDays ?? null,
          status: updated?.status
        },
        clientIp: auth.clientIp
      });
      sendOk(res, {
        teacher: updated,
        ...accountProvisioned ? { accountProvisioned } : {}
      });
      return;
    }
    if (req.method === "DELETE") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await teacherCol.getById(id);
      if (!existing) throw ApiError.notFound("Data guru tidak ditemukan.");
      const isPermanent = getQueryString(req, "permanent") === "true";
      if (isPermanent) {
        if (existing.userId && existing.userId === auth.user.id) {
          throw ApiError.badRequest(
            "Tidak dapat menghapus data guru yang terhubung dengan akun yang sedang aktif login."
          );
        }
        const userCol = repo.collection("users" /* USERS */);
        const qrCol = repo.collection("qrTokens" /* QR_TOKENS */);
        const classCol = repo.collection("classes" /* CLASSES */);
        const scheduleCol = repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */);
        const [qrTokens, classesRes, schedulesRes] = await Promise.all([
          qrCol.list({
            filters: [
              { field: "ownerType", op: "==", value: "TEACHER" /* TEACHER */ },
              { field: "ownerId", op: "==", value: id }
            ]
          }),
          classCol.list({ filters: [{ field: "homeroomTeacherId", op: "==", value: id }] }),
          scheduleCol.list({ filters: [{ field: "teacherId", op: "==", value: id }] })
        ]);
        await Promise.all([
          ...qrTokens.items.map((qr) => qrCol.delete(qr.id)),
          ...classesRes.items.map((c) => classCol.update(c.id, { homeroomTeacherId: null })),
          ...schedulesRes.items.map((s) => scheduleCol.delete(s.id))
        ]);
        if (existing.userId) {
          await revokeAllUserSessions(repo, existing.userId);
          const linkedUser = await userCol.getById(existing.userId);
          if (linkedUser) {
            await releaseUniqueUsername(repo, linkedUser.normalizedUsername);
            await userCol.delete(linkedUser.id);
          }
        }
        await teacherCol.delete(id);
        await recordActivityLog(repo, {
          actorUserId: auth.user.id,
          actorRole: auth.user.role,
          action: "TEACHER_DELETED",
          entityType: "TEACHER",
          entityId: id,
          before: { niyNip: existing.niyNip, fullName: existing.fullName },
          reason: "Dihapus permanen oleh admin.",
          clientIp: auth.clientIp
        });
        sendOk(res, { deleted: true, id });
        return;
      }
      const archived = await teacherCol.update(id, { status: "INACTIVE" /* INACTIVE */ });
      if (existing.userId) {
        await repo.collection("users" /* USERS */).update(existing.userId, { isActive: false });
        await revokeAllUserSessions(repo, existing.userId);
      }
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "TEACHER_ARCHIVED",
        entityType: "TEACHER",
        entityId: id,
        before: { status: existing.status },
        after: { status: "INACTIVE" /* INACTIVE */ },
        reason: "Diarsipkan oleh admin (tanpa penghapusan permanen).",
        clientIp: auth.clientIp
      });
      sendOk(res, { archived: true, teacher: archived });
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}

// backend/teachers/import.ts
function parseTeacherStatus(raw) {
  const clean = raw.trim().toUpperCase();
  if (!clean || clean === "ACTIVE" || clean === "AKTIF") return { value: "ACTIVE" /* ACTIVE */ };
  if (clean === "INACTIVE" || clean === "NONAKTIF") return { value: "INACTIVE" /* INACTIVE */ };
  return {
    value: "ACTIVE" /* ACTIVE */,
    error: `Status "${raw}" tidak dikenali (gunakan ACTIVE atau INACTIVE).`
  };
}
async function handleTeachersImport(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = teacherImportRequestSchema.parse(req.body ?? {});
    const existingTeachersRes = await repo.collection("teachers" /* TEACHERS */).list();
    const existingNipSet = new Set(existingTeachersRes.items.map((t) => t.niyNip));
    const seenInFile = /* @__PURE__ */ new Set();
    const validatedRows = [];
    parsed.rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const errors = [];
      const niyNip = String(row.niyNip ?? "").trim();
      const fullName = String(row.fullName ?? "").trim();
      const position = String(row.position ?? "").trim();
      if (!niyNip) {
        errors.push("Kolom NIY/NIP kosong.");
      } else {
        const check = niyNipSchema.safeParse(niyNip);
        if (!check.success) {
          errors.push(check.error.issues[0]?.message ?? "Format NIY/NIP tidak valid.");
        }
        if (existingNipSet.has(niyNip)) {
          errors.push(`NIY/NIP "${niyNip}" sudah terdaftar di sistem.`);
        }
        if (seenInFile.has(niyNip)) {
          errors.push(`NIY/NIP "${niyNip}" duplikat di dalam berkas impor.`);
        }
        seenInFile.add(niyNip);
      }
      if (!fullName || fullName.length < 2) {
        errors.push("Nama lengkap guru wajib diisi (minimal 2 karakter).");
      }
      if (!position || position.length < 2) {
        errors.push("Jabatan wajib diisi.");
      }
      const statusParsed = parseTeacherStatus(row.status ?? "");
      if (statusParsed.error) errors.push(statusParsed.error);
      validatedRows.push({
        rowNumber,
        niyNip,
        fullName,
        position,
        status: statusParsed.value,
        valid: errors.length === 0,
        errors
      });
    });
    const validCount = validatedRows.filter((r) => r.valid).length;
    const invalidCount = validatedRows.length - validCount;
    if (parsed.mode === "preview") {
      sendOk(res, {
        mode: "preview",
        totalRows: validatedRows.length,
        validCount,
        invalidCount,
        rows: validatedRows
      });
      return;
    }
    if (invalidCount > 0) {
      throw ApiError.badRequest(
        `Impor dibatalkan karena terdapat ${invalidCount} baris tidak valid. Perbaiki berkas dan pratinjau ulang.`,
        { rows: validatedRows.filter((r) => !r.valid) }
      );
    }
    const teacherCol = repo.collection("teachers" /* TEACHERS */);
    const createdIds = [];
    for (const row of validatedRows) {
      const created = await teacherCol.create({
        niyNip: row.niyNip,
        fullName: row.fullName,
        position: row.position,
        photoPath: null,
        userId: null,
        qrTokenId: null,
        status: row.status,
        createdBy: auth.user.id
      });
      createdIds.push(created.id);
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "TEACHERS_IMPORTED",
      entityType: "TEACHER",
      entityId: "batch_import",
      after: { importedCount: createdIds.length },
      clientIp: auth.clientIp
    });
    sendOk(res, { mode: "commit", importedCount: createdIds.length, createdIds }, 201);
  } catch (err) {
    sendError(res, err);
  }
}
async function handler22(req, res) {
  await handleTeachersImport(req, res);
}

// backend/teachers/bulk-archive.ts
async function handleTeachersBulkArchive(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = bulkArchiveSchema.parse(req.body ?? {});
    const teacherCol = repo.collection("teachers" /* TEACHERS */);
    const userCol = repo.collection("users" /* USERS */);
    let archivedCount = 0;
    for (const id of parsed.ids) {
      const existing = await teacherCol.getById(id);
      if (existing && existing.status !== "INACTIVE" /* INACTIVE */) {
        await teacherCol.update(id, { status: "INACTIVE" /* INACTIVE */ });
        if (existing.userId) {
          await userCol.update(existing.userId, { isActive: false });
          await revokeAllUserSessions(repo, existing.userId);
        }
        archivedCount++;
      }
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "TEACHERS_BULK_ARCHIVED",
      entityType: "TEACHER",
      entityId: "bulk",
      after: { requestedCount: parsed.ids.length, archivedCount },
      reason: parsed.reason ?? "Pengarsipan massal guru.",
      clientIp: auth.clientIp
    });
    sendOk(res, { archivedCount });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler23(req, res) {
  await handleTeachersBulkArchive(req, res);
}

// backend/teachers/bulk-delete.ts
async function runInChunks2(items, chunkSize, worker) {
  for (let i = 0; i < items.length; i += chunkSize) {
    await Promise.all(items.slice(i, i + chunkSize).map(worker));
  }
}
async function handleTeachersBulkDelete(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = bulkArchiveSchema.parse(req.body ?? {});
    const targetIds = new Set(parsed.ids);
    const teacherCol = repo.collection("teachers" /* TEACHERS */);
    const userCol = repo.collection("users" /* USERS */);
    const qrCol = repo.collection("qrTokens" /* QR_TOKENS */);
    const classCol = repo.collection("classes" /* CLASSES */);
    const scheduleCol = repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */);
    const [teachersRes, usersRes, qrTokensRes, classesRes, schedulesRes] = await Promise.all([
      teacherCol.list(),
      userCol.list(),
      qrCol.list({ filters: [{ field: "ownerType", op: "==", value: "TEACHER" /* TEACHER */ }] }),
      classCol.list(),
      scheduleCol.list()
    ]);
    const existingTeachers = teachersRes.items.filter((t) => targetIds.has(t.id));
    for (const teacher of existingTeachers) {
      if (teacher.userId && teacher.userId === auth.user.id) {
        throw ApiError.badRequest(
          `Tidak dapat menghapus data guru "${teacher.fullName}" karena sedang digunakan akun yang aktif login.`
        );
      }
    }
    const userMap = new Map(usersRes.items.map((u) => [u.id, u]));
    const qrToDelete = qrTokensRes.items.filter((q) => targetIds.has(q.ownerId));
    const classesToUnlink = classesRes.items.filter(
      (c) => c.homeroomTeacherId && targetIds.has(c.homeroomTeacherId)
    );
    const schedulesToDelete = schedulesRes.items.filter((s) => targetIds.has(s.teacherId));
    const usersToDelete = existingTeachers.map((t) => t.userId ? userMap.get(t.userId) : void 0).filter((u) => Boolean(u));
    const deletedUserIds = new Set(usersToDelete.map((u) => u.id));
    const usersToUnlink = usersRes.items.filter(
      (u) => u.linkedTeacherId && targetIds.has(u.linkedTeacherId) && !deletedUserIds.has(u.id)
    );
    await Promise.all([
      runInChunks2(qrToDelete, 25, (qr) => qrCol.delete(qr.id)),
      runInChunks2(classesToUnlink, 25, (c) => classCol.update(c.id, { homeroomTeacherId: null })),
      runInChunks2(schedulesToDelete, 25, (s) => scheduleCol.delete(s.id)),
      runInChunks2(usersToUnlink, 25, (u) => userCol.update(u.id, { linkedTeacherId: null })),
      runInChunks2(usersToDelete, 15, async (linkedUser) => {
        await Promise.all([
          revokeAllUserSessions(repo, linkedUser.id),
          releaseUniqueUsername(repo, linkedUser.normalizedUsername)
        ]);
        await userCol.delete(linkedUser.id);
      }),
      runInChunks2(existingTeachers, 25, (teacher) => teacherCol.delete(teacher.id))
    ]);
    const deletedCount = existingTeachers.length;
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "TEACHERS_BULK_DELETED",
      entityType: "TEACHER",
      entityId: "bulk",
      after: { requestedCount: parsed.ids.length, deletedCount },
      reason: parsed.reason ?? "Penghapusan massal data guru oleh admin.",
      clientIp: auth.clientIp
    });
    sendOk(res, { deletedCount });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler24(req, res) {
  await handleTeachersBulkDelete(req, res);
}

// src/lib/teacherWorkingDays.ts
var DEFAULT_TEACHER_WORKING_DAYS = [1, 2, 3, 4, 5, 6];
function normalizeWorkingDays(days) {
  if (!Array.isArray(days)) return [];
  const valid = days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  return Array.from(new Set(valid)).sort((a, b) => a - b);
}
function getSchoolTeacherActiveDays(teacherRule) {
  const fromRule = normalizeWorkingDays(teacherRule?.daysOfWeek);
  return fromRule.length > 0 ? fromRule : [...DEFAULT_TEACHER_WORKING_DAYS];
}
function resolveTeacherWorkingDays(teacher, teacherRule) {
  const custom = normalizeWorkingDays(teacher?.workingDays);
  if (custom.length > 0) return custom;
  return getSchoolTeacherActiveDays(teacherRule);
}
function resolveTeacherHltDays(workingDays, teacherRule) {
  const workSet = new Set(normalizeWorkingDays(workingDays));
  const schoolActive = getSchoolTeacherActiveDays(teacherRule);
  return schoolActive.filter((d) => !workSet.has(d));
}

// backend/_lib/auth/resolvePrincipalTeacher.ts
async function resolveTeacherProfileForUser(repo, user) {
  const teacherCol = repo.collection("teachers" /* TEACHERS */);
  if (user.linkedTeacherId) {
    const direct = await teacherCol.getById(user.linkedTeacherId);
    if (direct && direct.status === "ACTIVE" /* ACTIVE */) {
      return direct;
    }
  }
  if (user.role === "PRINCIPAL" /* PRINCIPAL */) {
    const allTeachers = await teacherCol.list({
      filters: [{ field: "status", op: "==", value: "ACTIVE" /* ACTIVE */ }]
    });
    const matched = allTeachers.items.find((t) => {
      const pos = t.position.toLowerCase();
      return pos.includes("kepala sekolah") || pos.includes("kepala madrasah") || pos.includes("kepsek");
    }) ?? allTeachers.items.find((t) => t.userId === user.id) ?? null;
    if (matched) {
      try {
        await repo.collection("users" /* USERS */).update(user.id, {
          linkedTeacherId: matched.id
        });
      } catch {
      }
      return matched;
    }
  }
  return null;
}

// backend/teachers/me/schedule.ts
async function handleMyTeacherSchedule(req, res, repo = getRepository()) {
  try {
    if (req.method && req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus GET.");
    }
    const auth = await requireAuth(req, {
      repo,
      allowedRoles: ["TEACHER" /* TEACHER */, "PRINCIPAL" /* PRINCIPAL */]
    });
    const now = /* @__PURE__ */ new Date();
    const nowMs = now.getTime();
    const todayDate = getDateKeyJakarta(now);
    const todayDayOfWeek = getDayOfWeekJakarta(now);
    const [teacherProfile, rulesRes] = await Promise.all([
      resolveTeacherProfileForUser(repo, auth.user),
      repo.collection("attendanceRules" /* ATTENDANCE_RULES */).list({
        filters: [
          { field: "audience", op: "==", value: "TEACHER" /* TEACHER */ },
          { field: "isActive", op: "==", value: true }
        ]
      })
    ]);
    const teacherRule = rulesRes.items.sort((a, b) => {
      const timeCmp = (b.updatedAt ?? b.createdAt ?? "").localeCompare(
        a.updatedAt ?? a.createdAt ?? ""
      );
      if (timeCmp !== 0) return timeCmp;
      return (b.version ?? 1) - (a.version ?? 1);
    })[0] ?? null;
    const teacherWorkingDays = resolveTeacherWorkingDays(teacherProfile, teacherRule);
    const teacherHltDays = resolveTeacherHltDays(teacherWorkingDays, teacherRule);
    const isTodayHlt = teacherHltDays.includes(todayDayOfWeek);
    if (!teacherProfile) {
      sendOk(res, {
        todayDate,
        todayDayOfWeek,
        teacherWorkingDays,
        teacherHltDays,
        isTodayHlt,
        teacherRule,
        todaySchedules: [],
        upcomingSchedules: [],
        weeklySchedules: []
      });
      return;
    }
    const [schedulesRes, subjectsRes, classesRes] = await Promise.all([
      repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */).list({
        filters: [
          { field: "teacherId", op: "==", value: teacherProfile.id },
          { field: "isActive", op: "==", value: true }
        ]
      }),
      repo.collection("subjects" /* SUBJECTS */).list(),
      repo.collection("classes" /* CLASSES */).list()
    ]);
    const subjectMap = new Map(subjectsRes.items.map((s) => [s.id, { name: s.name, code: s.code }]));
    const classMap = new Map(classesRes.items.map((c) => [c.id, c.name]));
    const activeEffective = schedulesRes.items.filter((s) => {
      const fromMs = new Date(s.effectiveFrom).getTime();
      const untilMs = s.effectiveUntil ? new Date(s.effectiveUntil).getTime() : Number.POSITIVE_INFINITY;
      return fromMs <= nowMs && nowMs <= untilMs;
    }).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map((s) => ({
      ...s,
      subjectName: subjectMap.get(s.subjectId)?.name ?? "-",
      subjectCode: subjectMap.get(s.subjectId)?.code ?? "-",
      className: classMap.get(s.classId) ?? "-"
    }));
    const todaySchedules = activeEffective.filter((s) => s.dayOfWeek === todayDayOfWeek);
    const upcomingSchedules = activeEffective.filter((s) => s.dayOfWeek !== todayDayOfWeek).sort((a, b) => {
      const offsetA = (a.dayOfWeek - todayDayOfWeek + 7) % 7;
      const offsetB = (b.dayOfWeek - todayDayOfWeek + 7) % 7;
      return offsetA - offsetB || a.startTime.localeCompare(b.startTime);
    });
    sendOk(res, {
      todayDate,
      todayDayOfWeek,
      teacherWorkingDays,
      teacherHltDays,
      isTodayHlt,
      teacherRule,
      todaySchedules,
      upcomingSchedules,
      weeklySchedules: activeEffective
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler25(req, res) {
  await handleMyTeacherSchedule(req, res);
}

// src/lib/scheduleRulesValidation.ts
import { z as z11 } from "zod";
var DAY_OF_WEEK_OPTIONS = [
  { value: 1, label: "Senin", short: "Sen" },
  { value: 2, label: "Selasa", short: "Sel" },
  { value: 3, label: "Rabu", short: "Rab" },
  { value: 4, label: "Kamis", short: "Kam" },
  { value: 5, label: "Jumat", short: "Jum" },
  { value: 6, label: "Sabtu", short: "Sab" },
  { value: 7, label: "Minggu", short: "Min" }
];
var teachingScheduleCreateSchema = z11.object({
  teacherId: z11.string().trim().min(1, "Guru wajib dipilih."),
  subjectId: z11.string().trim().min(1, "Mata pelajaran wajib dipilih."),
  classId: z11.string().trim().min(1, "Kelas wajib dipilih."),
  dayOfWeek: z11.coerce.number().int().min(1, "Hari harus antara 1 (Senin) sampai 7 (Minggu).").max(7),
  startTime: timeHHMMSchema,
  endTime: timeHHMMSchema,
  room: z11.string().trim().max(60).nullable().optional().default(null),
  effectiveFrom: z11.string().min(8, "Tanggal mulai berlaku wajib diisi."),
  effectiveUntil: z11.string().nullable().optional().default(null),
  isActive: z11.boolean().default(true)
});
var teachingScheduleUpdateSchema = teachingScheduleCreateSchema.partial();
var teachingScheduleImportRowSchema = z11.object({
  className: z11.string().trim(),
  subjectCodeOrName: z11.string().trim(),
  dayOfWeek: z11.union([z11.coerce.number(), z11.string().trim()]),
  startTime: z11.string().trim(),
  endTime: z11.string().trim(),
  teacherNiyOrName: z11.string().trim().optional().default(""),
  useHomeroomTeacher: z11.union([z11.boolean(), z11.string().trim()]).optional().default(false),
  room: z11.string().trim().max(60).optional().default(""),
  isActive: z11.union([z11.boolean(), z11.string().trim()]).optional().default(true)
});
var teachingScheduleImportRequestSchema = z11.object({
  mode: z11.enum(["preview", "commit"]),
  effectiveFrom: z11.string().optional(),
  rows: z11.array(teachingScheduleImportRowSchema).min(1, "Minimal 1 baris jadwal untuk diimpor.").max(500)
});
var attendanceRuleCreateSchema = z11.object({
  name: z11.string().trim().min(2, "Nama aturan minimal 2 karakter.").max(100),
  audience: z11.enum(["STUDENT" /* STUDENT */, "TEACHER" /* TEACHER */]),
  classIds: z11.array(z11.string().trim().min(1)).default([]),
  daysOfWeek: z11.array(z11.coerce.number().int().min(1).max(7)).min(1, "Pilih minimal 1 hari aktif."),
  checkInStart: timeHHMMSchema,
  lateAfter: timeHHMMSchema,
  lateToleranceMinutes: z11.coerce.number().int().min(0).max(120).default(0),
  checkInDeadline: timeHHMMSchema,
  checkOutStart: timeHHMMSchema,
  checkOutDeadline: timeHHMMSchema,
  gpsRequired: z11.boolean().default(true),
  geofenceRequired: z11.boolean().default(false),
  effectiveFrom: z11.string().min(8, "Tanggal mulai berlaku wajib diisi."),
  isActive: z11.boolean().default(true)
});
var holidayCreateSchema = z11.object({
  date: dateYYYYMMDDSchema,
  name: z11.string().trim().min(2, "Nama hari libur/pengecualian minimal 2 karakter.").max(120),
  scope: z11.enum(["SCHOOL" /* SCHOOL */, "STUDENT" /* STUDENT */, "TEACHER" /* TEACHER */]).default("SCHOOL" /* SCHOOL */),
  isActive: z11.boolean().default(true)
});
var holidayUpdateSchema = holidayCreateSchema.partial();

// backend/schedules/index.ts
function effectiveRangesOverlap(fromA, untilA, fromB, untilB) {
  const startA = new Date(fromA).getTime();
  const endA = untilA ? new Date(untilA).getTime() : Number.POSITIVE_INFINITY;
  const startB = new Date(fromB).getTime();
  const endB = untilB ? new Date(untilB).getTime() : Number.POSITIVE_INFINITY;
  return startA <= endB && startB <= endA;
}
function checkScheduleConflicts(candidate, existingSchedules) {
  if (!candidate.isActive) return null;
  const candStart = parseTimeToMinutes(candidate.startTime);
  const candEnd = parseTimeToMinutes(candidate.endTime);
  for (const item of existingSchedules) {
    if (!item.isActive) continue;
    if (candidate.id && item.id === candidate.id) continue;
    if (item.dayOfWeek !== candidate.dayOfWeek) continue;
    if (!effectiveRangesOverlap(
      candidate.effectiveFrom,
      candidate.effectiveUntil,
      item.effectiveFrom,
      item.effectiveUntil
    )) {
      continue;
    }
    const itemStart = parseTimeToMinutes(item.startTime);
    const itemEnd = parseTimeToMinutes(item.endTime);
    const timeOverlaps = candStart < itemEnd && itemStart < candEnd;
    if (!timeOverlaps) continue;
    if (item.teacherId === candidate.teacherId) {
      return { conflictType: "TEACHER", conflictSchedule: item };
    }
    if (item.classId === candidate.classId) {
      return { conflictType: "CLASS", conflictSchedule: item };
    }
  }
  return null;
}
async function handleSchedules(req, res, repo = getRepository()) {
  try {
    const col = repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const teacherId = getQueryString(req, "teacherId");
      const classId = getQueryString(req, "classId");
      const dayParam = getQueryString(req, "dayOfWeek");
      const activeParam = getQueryString(req, "isActive");
      const [schedulesRes, teachersRes, subjectsRes, classesRes] = await Promise.all([
        col.list({ sort: { field: "startTime", direction: "asc" } }),
        repo.collection("teachers" /* TEACHERS */).list(),
        repo.collection("subjects" /* SUBJECTS */).list(),
        repo.collection("classes" /* CLASSES */).list()
      ]);
      const teacherMap = new Map(teachersRes.items.map((t) => [t.id, t.fullName]));
      const subjectMap = new Map(subjectsRes.items.map((s) => [s.id, { name: s.name, code: s.code }]));
      const classMap = new Map(classesRes.items.map((c) => [c.id, c.name]));
      const filtered = schedulesRes.items.filter((s) => {
        if (teacherId && s.teacherId !== teacherId) return false;
        if (classId && s.classId !== classId) return false;
        if (dayParam && String(s.dayOfWeek) !== dayParam) return false;
        if (activeParam === "true" && !s.isActive) return false;
        if (activeParam === "false" && s.isActive) return false;
        return true;
      }).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map((s) => ({
        ...s,
        teacherName: teacherMap.get(s.teacherId) ?? "-",
        subjectName: subjectMap.get(s.subjectId)?.name ?? "-",
        subjectCode: subjectMap.get(s.subjectId)?.code ?? "-",
        className: classMap.get(s.classId) ?? "-"
      }));
      sendOk(res, { items: filtered, total: filtered.length });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = teachingScheduleCreateSchema.parse(req.body ?? {});
      if (parseTimeToMinutes(parsed.endTime) <= parseTimeToMinutes(parsed.startTime)) {
        throw ApiError.badRequest("Jam selesai harus setelah jam mulai.");
      }
      const [teacher, subject, schoolClass, allSchedules] = await Promise.all([
        repo.collection("teachers" /* TEACHERS */).getById(parsed.teacherId),
        repo.collection("subjects" /* SUBJECTS */).getById(parsed.subjectId),
        repo.collection("classes" /* CLASSES */).getById(parsed.classId),
        col.list()
      ]);
      if (!teacher) throw ApiError.badRequest("Guru tidak ditemukan.");
      if (!subject) throw ApiError.badRequest("Mata pelajaran tidak ditemukan.");
      if (!schoolClass) throw ApiError.badRequest("Kelas tidak ditemukan.");
      const effectiveFromIso = new Date(parsed.effectiveFrom).toISOString();
      const effectiveUntilIso = parsed.effectiveUntil ? new Date(parsed.effectiveUntil).toISOString() : null;
      if (effectiveUntilIso && new Date(effectiveUntilIso).getTime() < new Date(effectiveFromIso).getTime()) {
        throw ApiError.badRequest("Tanggal berakhir tidak boleh sebelum tanggal mulai berlaku.");
      }
      const conflict = checkScheduleConflicts(
        {
          teacherId: parsed.teacherId,
          classId: parsed.classId,
          dayOfWeek: parsed.dayOfWeek,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          effectiveFrom: effectiveFromIso,
          effectiveUntil: effectiveUntilIso,
          isActive: parsed.isActive
        },
        allSchedules.items
      );
      if (conflict) {
        const msg = conflict.conflictType === "TEACHER" ? `Jadwal bentrok: guru ${teacher.fullName} sudah memiliki jadwal mengajar pada pukul ${conflict.conflictSchedule.startTime}\u2013${conflict.conflictSchedule.endTime} WIB.` : `Jadwal bentrok: kelas ${schoolClass.name} sudah memiliki pelajaran pada pukul ${conflict.conflictSchedule.startTime}\u2013${conflict.conflictSchedule.endTime} WIB.`;
        throw ApiError.conflict(msg, { conflictType: conflict.conflictType });
      }
      const created = await col.create({
        teacherId: parsed.teacherId,
        subjectId: parsed.subjectId,
        classId: parsed.classId,
        dayOfWeek: parsed.dayOfWeek,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        room: parsed.room ?? null,
        effectiveFrom: effectiveFromIso,
        effectiveUntil: effectiveUntilIso,
        isActive: parsed.isActive,
        createdBy: auth.user.id
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SCHEDULE_CREATED",
        entityType: "TEACHING_SCHEDULE",
        entityId: created.id,
        after: {
          teacherId: created.teacherId,
          classId: created.classId,
          dayOfWeek: created.dayOfWeek,
          startTime: created.startTime,
          endTime: created.endTime
        },
        clientIp: auth.clientIp
      });
      sendOk(res, created, 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler26(req, res) {
  await handleSchedules(req, res);
}

// backend/schedules/import.ts
function parseBooleanInput3(raw, defaultValue) {
  if (typeof raw === "boolean") return raw;
  const val = String(raw ?? "").trim().toUpperCase();
  if (!val) return defaultValue;
  if (["YA", "Y", "TRUE", "1", "AKTIF", "WALI", "WALI KELAS"].includes(val)) return true;
  if (["TIDAK", "NO", "FALSE", "0", "NONAKTIF"].includes(val)) return false;
  return defaultValue;
}
function parseDayOfWeek(raw) {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 7) {
    return raw;
  }
  const str = String(raw ?? "").trim();
  if (!str) return null;
  if (/^[1-7]$/.test(str)) {
    return Number.parseInt(str, 10);
  }
  const upper = str.toUpperCase();
  const map = {
    SENIN: 1,
    SEN: 1,
    MONDAY: 1,
    SELASA: 2,
    SEL: 2,
    TUESDAY: 2,
    RABU: 3,
    RAB: 3,
    WEDNESDAY: 3,
    KAMIS: 4,
    KAM: 4,
    THURSDAY: 4,
    JUMAT: 5,
    "JUM'AT": 5,
    JUM: 5,
    FRIDAY: 5,
    SABTU: 6,
    SAB: 6,
    SATURDAY: 6,
    MINGGU: 7,
    AHAD: 7,
    MIN: 7,
    SUNDAY: 7
  };
  return map[upper] ?? null;
}
function normalizeTimeHHMM(raw) {
  const cleaned = raw.trim().replace(/\./g, ":");
  const m = cleaned.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
async function handleSchedulesImport(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = teachingScheduleImportRequestSchema.parse(req.body ?? {});
    const [classesRes, subjectsRes, teachersRes, schedulesRes] = await Promise.all([
      repo.collection("classes" /* CLASSES */).list(),
      repo.collection("subjects" /* SUBJECTS */).list(),
      repo.collection("teachers" /* TEACHERS */).list(),
      repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */).list()
    ]);
    const classByName = new Map(classesRes.items.map((c) => [c.name.trim().toUpperCase(), c]));
    const subjectByCode = new Map(subjectsRes.items.map((s) => [s.code.trim().toUpperCase(), s]));
    const subjectByName = new Map(subjectsRes.items.map((s) => [s.name.trim().toUpperCase(), s]));
    const teacherById = new Map(teachersRes.items.map((t) => [t.id, t]));
    const teacherByNiy = new Map(teachersRes.items.map((t) => [t.niyNip.trim().toUpperCase(), t]));
    const teacherByName = new Map(teachersRes.items.map((t) => [t.fullName.trim().toUpperCase(), t]));
    const effectiveFromIso = parsed.effectiveFrom ? new Date(parsed.effectiveFrom).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
    const simulatedSchedules = [...schedulesRes.items];
    const previewRows = [];
    for (let idx = 0; idx < parsed.rows.length; idx++) {
      const row = parsed.rows[idx];
      const errors = [];
      const classKey = row.className.trim().toUpperCase();
      const matchedClass = classByName.get(classKey) ?? null;
      if (!matchedClass) {
        errors.push(`Kelas "${row.className}" tidak ditemukan.`);
      }
      const subjectKey = row.subjectCodeOrName.trim().toUpperCase();
      const matchedSubject = subjectByCode.get(subjectKey) ?? subjectByName.get(subjectKey) ?? null;
      if (!matchedSubject) {
        errors.push(`Mata pelajaran "${row.subjectCodeOrName}" tidak ditemukan.`);
      }
      const dayNum = parseDayOfWeek(row.dayOfWeek);
      const dayLabel = DAY_OF_WEEK_OPTIONS.find((d) => d.value === dayNum)?.label ?? String(row.dayOfWeek);
      if (!dayNum) {
        errors.push(`Hari "${row.dayOfWeek}" tidak valid (gunakan Senin\u2013Minggu atau 1\u20137).`);
      }
      const startTime = normalizeTimeHHMM(row.startTime);
      const endTime = normalizeTimeHHMM(row.endTime);
      if (!startTime) {
        errors.push(`Jam mulai "${row.startTime}" harus berformat HH:MM.`);
      }
      if (!endTime) {
        errors.push(`Jam selesai "${row.endTime}" harus berformat HH:MM.`);
      }
      if (startTime && endTime && parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
        errors.push("Jam selesai harus setelah jam mulai.");
      }
      const rawTeacher = (row.teacherNiyOrName ?? "").trim();
      const explicitHomeroom = parseBooleanInput3(row.useHomeroomTeacher, false);
      const isHomeroomKeyword = ["WALI", "WALI KELAS", "WALIKELAS"].includes(rawTeacher.toUpperCase());
      const useHomeroomTeacher = explicitHomeroom || isHomeroomKeyword || !rawTeacher && Boolean(matchedSubject?.defaultToHomeroomTeacher);
      let matchedTeacher = null;
      if (useHomeroomTeacher) {
        if (matchedClass?.homeroomTeacherId) {
          matchedTeacher = teacherById.get(matchedClass.homeroomTeacherId) ?? null;
          if (!matchedTeacher) {
            errors.push(`Data wali kelas untuk kelas ${matchedClass.name} tidak ditemukan.`);
          }
        } else if (matchedClass) {
          errors.push(
            `Kelas ${matchedClass.name} belum memiliki Wali Kelas yang ditetapkan di Data Kelas.`
          );
        }
      } else {
        const teacherKey = rawTeacher.toUpperCase();
        matchedTeacher = teacherByNiy.get(teacherKey) ?? teacherByName.get(teacherKey) ?? null;
        if (!matchedTeacher) {
          errors.push(
            rawTeacher ? `Guru "${rawTeacher}" tidak ditemukan (gunakan NIY/NIP, nama lengkap, atau aktifkan Wali Kelas).` : "Guru pengajar wajib diisi atau gunakan opsi Wali Kelas."
          );
        }
      }
      const isActive = parseBooleanInput3(row.isActive, true);
      const room = row.room?.trim() || null;
      if (errors.length === 0 && matchedTeacher && matchedSubject && matchedClass && dayNum && startTime && endTime) {
        const conflict = checkScheduleConflicts(
          {
            teacherId: matchedTeacher.id,
            classId: matchedClass.id,
            dayOfWeek: dayNum,
            startTime,
            endTime,
            effectiveFrom: effectiveFromIso,
            effectiveUntil: null,
            isActive
          },
          simulatedSchedules
        );
        if (conflict) {
          errors.push(
            conflict.conflictType === "TEACHER" ? `Bentrok jadwal guru ${matchedTeacher.fullName} pukul ${conflict.conflictSchedule.startTime}\u2013${conflict.conflictSchedule.endTime}.` : `Bentrok jadwal kelas ${matchedClass.name} pukul ${conflict.conflictSchedule.startTime}\u2013${conflict.conflictSchedule.endTime}.`
          );
        } else if (isActive) {
          simulatedSchedules.push({
            id: `sim_${idx}`,
            teacherId: matchedTeacher.id,
            subjectId: matchedSubject.id,
            classId: matchedClass.id,
            dayOfWeek: dayNum,
            startTime,
            endTime,
            room,
            effectiveFrom: effectiveFromIso,
            effectiveUntil: null,
            isActive: true
          });
        }
      }
      previewRows.push({
        rowNumber: idx + 1,
        className: matchedClass?.name ?? row.className,
        classId: matchedClass?.id ?? null,
        subjectLabel: matchedSubject ? `${matchedSubject.code} \u2014 ${matchedSubject.name}` : row.subjectCodeOrName,
        subjectId: matchedSubject?.id ?? null,
        teacherName: matchedTeacher?.fullName ?? (useHomeroomTeacher ? "Wali Kelas" : row.teacherNiyOrName || "-"),
        teacherId: matchedTeacher?.id ?? null,
        useHomeroomTeacher,
        dayOfWeek: dayNum,
        dayLabel,
        startTime: startTime ?? row.startTime,
        endTime: endTime ?? row.endTime,
        room,
        isActive,
        valid: errors.length === 0,
        errors
      });
    }
    const validCount = previewRows.filter((r) => r.valid).length;
    const invalidCount = previewRows.length - validCount;
    if (parsed.mode === "preview") {
      sendOk(res, {
        mode: "preview",
        total: previewRows.length,
        validCount,
        invalidCount,
        rows: previewRows
      });
      return;
    }
    if (invalidCount > 0) {
      throw ApiError.badRequest(
        `Impor dibatalkan karena masih terdapat ${invalidCount} baris jadwal tidak valid atau bentrok.`,
        { previewRows, invalidCount }
      );
    }
    const scheduleCol = repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */);
    const createdItems = await Promise.all(
      previewRows.map(
        (row) => scheduleCol.create({
          teacherId: row.teacherId,
          subjectId: row.subjectId,
          classId: row.classId,
          dayOfWeek: row.dayOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
          room: row.room,
          effectiveFrom: effectiveFromIso,
          effectiveUntil: null,
          isActive: row.isActive,
          createdBy: auth.user.id
        })
      )
    );
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "SCHEDULES_IMPORTED",
      entityType: "TEACHING_SCHEDULE",
      entityId: "bulk_import",
      after: { count: createdItems.length },
      clientIp: auth.clientIp
    });
    sendOk(
      res,
      {
        mode: "commit",
        importedCount: createdItems.length
      },
      201
    );
  } catch (err) {
    sendError(res, err);
  }
}
async function handler27(req, res) {
  await handleSchedulesImport(req, res);
}

// backend/schedules/bulk-delete.ts
import { z as z12 } from "zod";
var scheduleBulkDeleteSchema = z12.object({
  ids: z12.array(z12.string().trim().min(1)).min(1, "Pilih minimal 1 jadwal mengajar untuk dihapus.")
});
async function handleSchedulesBulkDelete(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = scheduleBulkDeleteSchema.parse(req.body ?? {});
    const scheduleCol = repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */);
    let deletedCount = 0;
    const deletedIds = [];
    for (const id of parsed.ids) {
      const existing = await scheduleCol.getById(id);
      if (existing) {
        await scheduleCol.delete(id);
        deletedCount++;
        deletedIds.push(id);
      }
    }
    if (deletedCount > 0) {
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SCHEDULES_BULK_DELETED",
        entityType: "TEACHING_SCHEDULE",
        entityId: "bulk_delete",
        after: { deletedCount, deletedIds },
        clientIp: auth.clientIp
      });
    }
    sendOk(res, {
      deletedCount,
      deletedIds
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler28(req, res) {
  await handleSchedulesBulkDelete(req, res);
}

// backend/schedules/[id].ts
async function handleScheduleById(req, res, idOverride, repo = getRepository()) {
  try {
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID jadwal wajib diisi.");
    const col = repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const item = await col.getById(id);
      if (!item) throw ApiError.notFound("Jadwal mengajar tidak ditemukan.");
      sendOk(res, item);
      return;
    }
    if (req.method === "PATCH") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound("Jadwal mengajar tidak ditemukan.");
      const parsed = teachingScheduleUpdateSchema.parse(req.body ?? {});
      const nextTeacherId = parsed.teacherId ?? existing.teacherId;
      const nextSubjectId = parsed.subjectId ?? existing.subjectId;
      const nextClassId = parsed.classId ?? existing.classId;
      const nextDay = parsed.dayOfWeek ?? existing.dayOfWeek;
      const nextStart = parsed.startTime ?? existing.startTime;
      const nextEnd = parsed.endTime ?? existing.endTime;
      const nextFrom = parsed.effectiveFrom ? new Date(parsed.effectiveFrom).toISOString() : existing.effectiveFrom;
      const nextUntil = parsed.effectiveUntil !== void 0 ? parsed.effectiveUntil ? new Date(parsed.effectiveUntil).toISOString() : null : existing.effectiveUntil;
      const nextActive = parsed.isActive ?? existing.isActive;
      if (parseTimeToMinutes(nextEnd) <= parseTimeToMinutes(nextStart)) {
        throw ApiError.badRequest("Jam selesai harus setelah jam mulai.");
      }
      const allSchedules = await col.list();
      const conflict = checkScheduleConflicts(
        {
          id,
          teacherId: nextTeacherId,
          classId: nextClassId,
          dayOfWeek: nextDay,
          startTime: nextStart,
          endTime: nextEnd,
          effectiveFrom: nextFrom,
          effectiveUntil: nextUntil,
          isActive: nextActive
        },
        allSchedules.items
      );
      if (conflict) {
        const msg = conflict.conflictType === "TEACHER" ? `Jadwal bentrok dengan jadwal mengajar guru lain pada pukul ${conflict.conflictSchedule.startTime}\u2013${conflict.conflictSchedule.endTime} WIB.` : `Jadwal bentrok dengan jadwal kelas pada pukul ${conflict.conflictSchedule.startTime}\u2013${conflict.conflictSchedule.endTime} WIB.`;
        throw ApiError.conflict(msg, { conflictType: conflict.conflictType });
      }
      const updated = await col.update(id, {
        teacherId: nextTeacherId,
        subjectId: nextSubjectId,
        classId: nextClassId,
        dayOfWeek: nextDay,
        startTime: nextStart,
        endTime: nextEnd,
        room: parsed.room !== void 0 ? parsed.room : existing.room,
        effectiveFrom: nextFrom,
        effectiveUntil: nextUntil,
        isActive: nextActive
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SCHEDULE_UPDATED",
        entityType: "TEACHING_SCHEDULE",
        entityId: id,
        before: {
          dayOfWeek: existing.dayOfWeek,
          startTime: existing.startTime,
          endTime: existing.endTime,
          isActive: existing.isActive
        },
        after: {
          dayOfWeek: updated?.dayOfWeek,
          startTime: updated?.startTime,
          endTime: updated?.endTime,
          isActive: updated?.isActive
        },
        clientIp: auth.clientIp
      });
      sendOk(res, updated);
      return;
    }
    if (req.method === "DELETE") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound("Jadwal mengajar tidak ditemukan.");
      const archived = await col.update(id, { isActive: false });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SCHEDULE_ARCHIVED",
        entityType: "TEACHING_SCHEDULE",
        entityId: id,
        before: { isActive: existing.isActive },
        after: { isActive: false },
        clientIp: auth.clientIp
      });
      sendOk(res, { archived: true, schedule: archived });
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}

// backend/attendance-rules/index.ts
function sameClassScope(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, idx) => v === sortedB[idx]);
}
async function handleAttendanceRules(req, res, repo = getRepository()) {
  try {
    const col = repo.collection("attendanceRules" /* ATTENDANCE_RULES */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const audience = getQueryString(req, "audience");
      const activeOnly = getQueryString(req, "activeOnly");
      const result = await col.list({ sort: { field: "createdAt", direction: "desc" } });
      const filtered = result.items.filter((r) => {
        if (audience && r.audience !== audience) return false;
        if (activeOnly === "true" && !r.isActive) return false;
        return true;
      }).sort((a, b) => {
        const timeCmp = (b.updatedAt ?? b.createdAt ?? "").localeCompare(
          a.updatedAt ?? a.createdAt ?? ""
        );
        if (timeCmp !== 0) return timeCmp;
        return (b.version ?? 1) - (a.version ?? 1);
      });
      sendOk(res, { items: filtered, total: filtered.length });
      return;
    }
    if (req.method === "POST") {
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
          "Urutan jam masuk harus valid: mulai masuk <= batas terlambat <= batas akhir masuk."
        );
      }
      if (outDeadline <= outStart) {
        throw ApiError.badRequest("Batas akhir pulang harus setelah jam mulai pulang.");
      }
      const existingSameAudience = await col.list({
        filters: [{ field: "audience", op: "==", value: parsed.audience }]
      });
      const matchingScopeRules = existingSameAudience.items.filter(
        (r) => sameClassScope(r.classIds ?? [], targetClassIds)
      );
      const nextVersion = matchingScopeRules.reduce((max, r) => Math.max(max, r.version ?? 1), 0) + 1;
      const effectiveFromIso = new Date(parsed.effectiveFrom).toISOString();
      if (parsed.isActive) {
        const activeSameAudience = existingSameAudience.items.filter((r) => r.isActive);
        if (targetClassIds.length === 0) {
          await Promise.all(
            activeSameAudience.map(
              (prev) => col.update(prev.id, {
                isActive: false,
                effectiveUntil: effectiveFromIso
              })
            )
          );
        } else {
          const targetSet = new Set(targetClassIds);
          await Promise.all(
            activeSameAudience.map((prev) => {
              const prevClassIds = prev.classIds ?? [];
              if (sameClassScope(prevClassIds, targetClassIds)) {
                return col.update(prev.id, {
                  isActive: false,
                  effectiveUntil: effectiveFromIso
                });
              }
              if (prevClassIds.length === 0) {
                return Promise.resolve(null);
              }
              const hasOverlap = prevClassIds.some((id) => targetSet.has(id));
              if (!hasOverlap) {
                return Promise.resolve(null);
              }
              const remainingClassIds = prevClassIds.filter((id) => !targetSet.has(id));
              if (remainingClassIds.length === 0) {
                return col.update(prev.id, {
                  isActive: false,
                  effectiveUntil: effectiveFromIso
                });
              }
              return col.update(prev.id, {
                classIds: remainingClassIds
              });
            })
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
        createdBy: auth.user.id
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "ATTENDANCE_RULE_VERSION_CREATED",
        entityType: "ATTENDANCE_RULE",
        entityId: created.id,
        after: {
          name: created.name,
          version: created.version,
          audience: created.audience,
          effectiveFrom: created.effectiveFrom
        },
        clientIp: auth.clientIp
      });
      sendOk(res, created, 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler29(req, res) {
  await handleAttendanceRules(req, res);
}

// backend/holidays/index.ts
async function handleHolidays(req, res, repo = getRepository()) {
  try {
    const col = repo.collection("holidays" /* HOLIDAYS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const result = await col.list({ sort: { field: "date", direction: "asc" } });
      sendOk(res, { items: result.items, total: result.total });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = holidayCreateSchema.parse(req.body ?? {});
      const dup = await col.findFirst([
        { field: "date", op: "==", value: parsed.date },
        { field: "scope", op: "==", value: parsed.scope }
      ]);
      if (dup && dup.isActive) {
        throw ApiError.conflict(
          `Tanggal libur ${parsed.date} untuk cakupan ini sudah terdaftar (${dup.name}).`
        );
      }
      const created = await col.create({
        date: parsed.date,
        name: parsed.name,
        scope: parsed.scope,
        isActive: parsed.isActive,
        createdBy: auth.user.id
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "HOLIDAY_CREATED",
        entityType: "HOLIDAY",
        entityId: created.id,
        after: { date: created.date, name: created.name, scope: created.scope },
        clientIp: auth.clientIp
      });
      sendOk(res, created, 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handleHolidayById(req, res, idOverride, repo = getRepository()) {
  try {
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID hari libur wajib diisi.");
    const col = repo.collection("holidays" /* HOLIDAYS */);
    if (req.method === "PATCH") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound("Hari libur tidak ditemukan.");
      const parsed = holidayUpdateSchema.parse(req.body ?? {});
      const updated = await col.update(id, {
        ...parsed.date !== void 0 ? { date: parsed.date } : {},
        ...parsed.name !== void 0 ? { name: parsed.name } : {},
        ...parsed.scope !== void 0 ? { scope: parsed.scope } : {},
        ...parsed.isActive !== void 0 ? { isActive: parsed.isActive } : {}
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "HOLIDAY_UPDATED",
        entityType: "HOLIDAY",
        entityId: id,
        before: { date: existing.date, name: existing.name, isActive: existing.isActive },
        after: { date: updated?.date, name: updated?.name, isActive: updated?.isActive },
        clientIp: auth.clientIp
      });
      sendOk(res, updated);
      return;
    }
    if (req.method === "DELETE") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound("Hari libur tidak ditemukan.");
      const archived = await col.update(id, { isActive: false });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "HOLIDAY_ARCHIVED",
        entityType: "HOLIDAY",
        entityId: id,
        before: { isActive: existing.isActive },
        after: { isActive: false },
        clientIp: auth.clientIp
      });
      sendOk(res, { archived: true, holiday: archived });
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler30(req, res) {
  await handleHolidays(req, res);
}

// src/lib/attendanceScanValidation.ts
import { z as z13 } from "zod";
var qrIssueSchema = z13.object({
  ownerType: z13.enum(["STUDENT" /* STUDENT */, "TEACHER" /* TEACHER */]),
  ownerId: z13.string().trim().min(1, "ID pemilik wajib diisi.")
});
var qrRevokeSchema = z13.object({
  qrTokenId: z13.string().trim().min(1).optional(),
  ownerType: z13.enum(["STUDENT" /* STUDENT */, "TEACHER" /* TEACHER */]).optional(),
  ownerId: z13.string().trim().min(1).optional(),
  reason: z13.string().trim().max(200).optional()
}).refine((data) => Boolean(data.qrTokenId || data.ownerType && data.ownerId), {
  message: "Sertakan qrTokenId atau pasangan ownerType dan ownerId."
});
var attendanceScanSchema = z13.object({
  token: z13.string().trim().min(2, "Kode QR / NIS / NIY tidak valid.").max(256),
  eventType: z13.enum(["CHECK_IN" /* CHECK_IN */, "CHECK_OUT" /* CHECK_OUT */, "AUTO"]).default("AUTO"),
  latitude: z13.number().min(-90).max(90).nullable().optional().default(null),
  longitude: z13.number().min(-180).max(180).nullable().optional().default(null),
  gpsAccuracyMeters: z13.number().min(0).max(1e5).nullable().optional().default(null),
  idempotencyKey: z13.string().trim().min(8, "Idempotency key minimal 8 karakter.").max(128),
  clientTimestamp: z13.string().nullable().optional().default(null),
  deviceInfo: z13.string().trim().max(200).nullable().optional().default(null),
  selfieFileId: z13.string().trim().min(4).max(120).nullable().optional().default(null)
});
var attendanceCorrectionSchema = z13.object({
  status: z13.enum([
    "PRESENT" /* PRESENT */,
    "LATE" /* LATE */,
    "SICK" /* SICK */,
    "EXCUSED" /* EXCUSED */,
    "ABSENT" /* ABSENT */
  ]),
  reason: z13.string().trim().min(5, "Alasan koreksi wajib diisi (minimal 5 karakter).").max(400)
});
var portalActivateSchema = z13.object({
  username: z13.string().trim().min(3, "Username wajib diisi.").max(64),
  password: z13.string().min(1, "Kata sandi wajib diisi.").max(128)
});
var portalExitSchema = z13.object({
  password: z13.string().min(1, "Kata sandi keluar portal wajib diisi.").max(128)
});

// backend/_lib/qr/tokenService.ts
import crypto10 from "node:crypto";
function generateHighEntropyQrToken() {
  const randomPart = crypto10.randomBytes(32).toString("base64url");
  return `QR1.${randomPart}`;
}
function hashQrToken(rawToken) {
  return crypto10.createHash("sha256").update(rawToken.trim()).digest("hex");
}
async function issueQrToken(repo, ownerType, ownerId, actor) {
  let ownerName = "";
  if (ownerType === "STUDENT" /* STUDENT */) {
    const student = await repo.collection("students" /* STUDENTS */).getById(ownerId);
    if (!student) throw ApiError.notFound("Siswa tidak ditemukan.");
    ownerName = student.fullName;
  } else {
    const teacher = await repo.collection("teachers" /* TEACHERS */).getById(ownerId);
    if (!teacher) throw ApiError.notFound("Guru tidak ditemukan.");
    ownerName = teacher.fullName;
  }
  const qrCol = repo.collection("qrTokens" /* QR_TOKENS */);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const existingActive = await qrCol.list({
    filters: [
      { field: "ownerType", op: "==", value: ownerType },
      { field: "ownerId", op: "==", value: ownerId },
      { field: "isActive", op: "==", value: true }
    ]
  });
  await Promise.all(
    existingActive.items.map(
      (old) => qrCol.update(old.id, {
        isActive: false,
        revokedAt: nowIso
      })
    )
  );
  const rawToken = generateHighEntropyQrToken();
  const tokenHash = hashQrToken(rawToken);
  const qrTokenId = `qr_${crypto10.randomBytes(8).toString("hex")}`;
  const created = await qrCol.create({
    id: qrTokenId,
    tokenHash,
    ownerType,
    ownerId,
    isActive: true,
    issuedAt: nowIso,
    revokedAt: null,
    createdBy: actor.userId
  });
  if (ownerType === "STUDENT" /* STUDENT */) {
    await repo.collection("students" /* STUDENTS */).update(ownerId, { qrTokenId: created.id });
  } else {
    await repo.collection("teachers" /* TEACHERS */).update(ownerId, { qrTokenId: created.id });
  }
  await recordActivityLog(repo, {
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: "QR_TOKEN_ISSUED",
    entityType: "QR_TOKEN",
    entityId: created.id,
    after: {
      ownerType,
      ownerId,
      revokedPreviousCount: existingActive.items.length
    },
    clientIp: actor.clientIp
  });
  return {
    qrTokenId: created.id,
    rawToken,
    ownerType,
    ownerId,
    ownerName,
    issuedAt: created.issuedAt
  };
}
async function revokeQrToken(repo, target, actor, reason) {
  const qrCol = repo.collection("qrTokens" /* QR_TOKENS */);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  let tokensToRevoke = [];
  if (target.qrTokenId) {
    const found = await qrCol.getById(target.qrTokenId);
    if (!found) throw ApiError.notFound("Token QR tidak ditemukan.");
    if (found.isActive) tokensToRevoke = [found];
  } else if (target.ownerType && target.ownerId) {
    const res = await qrCol.list({
      filters: [
        { field: "ownerType", op: "==", value: target.ownerType },
        { field: "ownerId", op: "==", value: target.ownerId },
        { field: "isActive", op: "==", value: true }
      ]
    });
    tokensToRevoke = res.items;
  }
  for (const token of tokensToRevoke) {
    await qrCol.update(token.id, {
      isActive: false,
      revokedAt: nowIso
    });
    if (token.ownerType === "STUDENT" /* STUDENT */) {
      const st = await repo.collection("students" /* STUDENTS */).getById(token.ownerId);
      if (st && st.qrTokenId === token.id) {
        await repo.collection("students" /* STUDENTS */).update(st.id, { qrTokenId: null });
      }
    } else {
      const tc = await repo.collection("teachers" /* TEACHERS */).getById(token.ownerId);
      if (tc && tc.qrTokenId === token.id) {
        await repo.collection("teachers" /* TEACHERS */).update(tc.id, { qrTokenId: null });
      }
    }
    await recordActivityLog(repo, {
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "QR_TOKEN_REVOKED",
      entityType: "QR_TOKEN",
      entityId: token.id,
      before: { isActive: true },
      after: { isActive: false, revokedAt: nowIso },
      reason: reason ?? null,
      clientIp: actor.clientIp
    });
  }
  return {
    revokedCount: tokensToRevoke.length,
    revokedIds: tokensToRevoke.map((t) => t.id)
  };
}
async function findActiveQrTokenByRaw(repo, rawToken) {
  const tokenHash = hashQrToken(rawToken);
  return repo.collection("qrTokens" /* QR_TOKENS */).findFirst([
    { field: "tokenHash", op: "==", value: tokenHash },
    { field: "isActive", op: "==", value: true }
  ]);
}

// backend/qr/tokens.ts
function toSafeQrTokenMeta(token) {
  return {
    id: token.id,
    ownerType: token.ownerType,
    ownerId: token.ownerId,
    isActive: token.isActive,
    issuedAt: token.issuedAt,
    revokedAt: token.revokedAt
  };
}
async function handleQrTokens(req, res, repo = getRepository()) {
  try {
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const ownerType = getQueryString(req, "ownerType");
      const ownerId = getQueryString(req, "ownerId");
      const activeOnly = getQueryString(req, "activeOnly");
      const result = await repo.collection("qrTokens" /* QR_TOKENS */).list({
        sort: { field: "issuedAt", direction: "desc" }
      });
      const filtered = result.items.filter((t) => {
        if (ownerType && t.ownerType !== ownerType) return false;
        if (ownerId && t.ownerId !== ownerId) return false;
        if (activeOnly === "true" && !t.isActive) return false;
        return true;
      }).map(toSafeQrTokenMeta);
      sendOk(res, { items: filtered, total: filtered.length });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = qrIssueSchema.parse(req.body ?? {});
      const issued = await issueQrToken(repo, parsed.ownerType, parsed.ownerId, {
        userId: auth.user.id,
        role: auth.user.role,
        clientIp: auth.clientIp
      });
      sendOk(res, issued, 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler31(req, res) {
  await handleQrTokens(req, res);
}

// backend/qr/revoke.ts
async function handleQrRevoke(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = qrRevokeSchema.parse(req.body ?? {});
    const result = await revokeQrToken(
      repo,
      {
        qrTokenId: parsed.qrTokenId,
        ownerType: parsed.ownerType,
        ownerId: parsed.ownerId
      },
      {
        userId: auth.user.id,
        role: auth.user.role,
        clientIp: auth.clientIp
      },
      parsed.reason
    );
    sendOk(res, result);
  } catch (err) {
    sendError(res, err);
  }
}
async function handler32(req, res) {
  await handleQrRevoke(req, res);
}

// backend/portal/status.ts
var PORTAL_AUTHORIZED_ROLES = /* @__PURE__ */ new Set([
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "OPERATOR" /* OPERATOR */
]);
async function handlePortalStatus(req, res, repo = getRepository()) {
  try {
    if (req.method && req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus GET.");
    }
    const cookies = parseCookies(getHeaderValue(req, "cookie"));
    const resolved = await resolveActiveSession(repo, cookies[SESSION_COOKIE_NAME]);
    const authorized = Boolean(
      resolved && !resolved.user.mustChangePassword && PORTAL_AUTHORIZED_ROLES.has(resolved.user.role)
    );
    const settings = await repo.collection("appSettings" /* APP_SETTINGS */).getById("default");
    sendOk(res, {
      authorized,
      operatorUsername: authorized ? resolved.user.username : null,
      serverTime: (/* @__PURE__ */ new Date()).toISOString(),
      schoolName: settings?.schoolName ?? "MI Miftahul Ulum Sumberwuluh",
      schoolAddress: settings?.schoolAddress ?? "Desa Sumberwuluh, Kecamatan Candipuro, Kabupaten Lumajang, Jawa Timur",
      appName: settings?.appName ?? "Absensi Digital",
      logoPath: settings?.logoPath ?? null,
      gpsEnabledForStudents: settings?.gpsEnabledForStudents ?? true,
      portalScanMethod: settings?.portalScanMethod ?? "CAMERA_AND_USB",
      bypassAttendanceTimeWindow: settings?.bypassAttendanceTimeWindow ?? false,
      hasExitPassword: Boolean(settings?.portalExitPasswordHash),
      voiceTemplates: {
        success: "ABSEN BERHASIL",
        failure: "ABSEN GAGAL",
        namedSuccess: "ABSEN ATAS NAMA {name} BERHASIL",
        late: "ABSEN BERHASIL, {name} TERCATAT TERLAMBAT",
        closed: "MAAF, WAKTU ABSENSI MASIH DITUTUP",
        alreadyRecorded: "ANDA SUDAH MELAKUKAN ABSENSI HARI INI",
        ...settings?.voiceTemplates ?? {}
      }
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler33(req, res) {
  await handlePortalStatus(req, res);
}

// backend/portal/activate.ts
var PORTAL_ACTIVATE_ROLES = /* @__PURE__ */ new Set([
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "OPERATOR" /* OPERATOR */
]);
var GENERIC_AUTH_ERROR = "Username atau kata sandi tidak valid, atau akun tidak berwenang mengaktifkan portal.";
async function handlePortalActivate(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const clientIp = extractClientIp(req);
    const rateCheck = checkIpRateLimit(clientIp);
    if (!rateCheck.allowed) {
      throw ApiError.tooManyRequests(
        `Terlalu banyak percobaan. Coba lagi dalam ${rateCheck.retryAfterSeconds} detik.`
      );
    }
    const parsed = portalActivateSchema.parse(req.body ?? {});
    const normalized = normalizeUsername(parsed.username);
    const user = await repo.collection("users" /* USERS */).findFirst([{ field: "normalizedUsername", op: "==", value: normalized }]);
    if (!user || !user.isActive || !PORTAL_ACTIVATE_ROLES.has(user.role)) {
      recordIpFailedAttempt(clientIp);
      throw ApiError.unauthorized(GENERIC_AUTH_ERROR);
    }
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      throw ApiError.tooManyRequests("Akun sementara terkunci. Silakan coba lagi beberapa menit lagi.");
    }
    const valid = await verifyPassword(parsed.password, user.passwordHash);
    if (!valid) {
      recordIpFailedAttempt(clientIp);
      throw ApiError.unauthorized(GENERIC_AUTH_ERROR);
    }
    clearIpAttempts(clientIp);
    const createdSession = await createUserSession(repo, user.id);
    setAuthCookies(req, res, createdSession.rawSessionToken, createdSession.csrfToken);
    await recordActivityLog(repo, {
      actorUserId: user.id,
      actorRole: user.role,
      action: "PORTAL_ACTIVATED",
      entityType: "PORTAL_SESSION",
      entityId: createdSession.session.id,
      clientIp
    });
    sendOk(res, {
      authorized: true,
      operatorUsername: user.username,
      expiresAt: createdSession.session.expiresAt
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler34(req, res) {
  await handlePortalActivate(req, res);
}

// backend/portal/exit.ts
async function handlePortalExit(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, {
      repo,
      allowedRoles: ["SUPER_ADMIN" /* SUPER_ADMIN */, "ADMIN" /* ADMIN */, "OPERATOR" /* OPERATOR */]
    });
    const parsed = portalExitSchema.parse(req.body ?? {});
    const settings = await repo.collection("appSettings" /* APP_SETTINGS */).getById("default");
    if (!settings?.portalExitPasswordHash) {
      throw ApiError.badRequest(
        "Kata sandi keluar portal belum dikonfigurasi pada pengaturan sistem."
      );
    }
    const matched = await verifyPassword(parsed.password, settings.portalExitPasswordHash);
    if (!matched) {
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "PORTAL_EXIT_FAILED",
        entityType: "PORTAL_SESSION",
        entityId: auth.session.id,
        clientIp: auth.clientIp
      });
      throw ApiError.unauthorized("Kata sandi keluar portal tidak sesuai.");
    }
    await revokeSession(repo, auth.session.id);
    clearAuthCookies(req, res);
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "PORTAL_EXITED",
      entityType: "PORTAL_SESSION",
      entityId: auth.session.id,
      clientIp: auth.clientIp
    });
    sendOk(res, { exited: true });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler35(req, res) {
  await handlePortalExit(req, res);
}

// src/lib/haversine.ts
var EARTH_RADIUS_METERS = 6371e3;
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}
function isValidCoordinate(point) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180;
}
function calculateHaversineDistanceMeters(a, b) {
  if (!isValidCoordinate(a) || !isValidCoordinate(b)) {
    throw new Error("Koordinat GPS tidak valid.");
  }
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLon = Math.sin(dLon / 2);
  const h = sinHalfLat * sinHalfLat + Math.cos(lat1) * Math.cos(lat2) * sinHalfLon * sinHalfLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return Math.round(EARTH_RADIUS_METERS * c * 100) / 100;
}
function validateGeofence(input) {
  if (!isValidCoordinate(input.school) || !isValidCoordinate(input.device)) {
    return {
      passed: false,
      distanceMeters: Number.POSITIVE_INFINITY,
      withinRadius: false,
      accuracyAcceptable: false,
      reason: "Koordinat lokasi tidak valid."
    };
  }
  const distanceMeters = calculateHaversineDistanceMeters(input.school, input.device);
  const withinRadius = distanceMeters <= input.radiusMeters;
  const accuracyAcceptable = input.accuracyMeters !== null && Number.isFinite(input.accuracyMeters) && input.accuracyMeters >= 0 && input.accuracyMeters <= input.maxAccuracyMeters;
  if (!accuracyAcceptable) {
    return {
      passed: false,
      distanceMeters,
      withinRadius,
      accuracyAcceptable: false,
      reason: `Akurasi GPS belum memenuhi syarat (maksimal ${input.maxAccuracyMeters} meter).`
    };
  }
  if (!withinRadius) {
    return {
      passed: false,
      distanceMeters,
      withinRadius: false,
      accuracyAcceptable: true,
      reason: `Lokasi berada di luar radius sekolah (${Math.round(distanceMeters)} m dari batas ${input.radiusMeters} m).`
    };
  }
  return {
    passed: true,
    distanceMeters,
    withinRadius: true,
    accuracyAcceptable: true,
    reason: null
  };
}

// src/lib/attendanceAnomaly.ts
function detectLocationAnomalies(input) {
  const flags = [];
  const { current, previousToday, maxAccuracyMeters } = input;
  if (current.accuracyMeters !== null) {
    if (current.accuracyMeters === 0) {
      flags.push("ACCURACY_ZERO_SUSPICIOUS");
    } else if (current.accuracyMeters < 1) {
      flags.push("ACCURACY_SUBMETER_SUSPICIOUS");
    } else if (maxAccuracyMeters > 0 && current.accuracyMeters >= maxAccuracyMeters * 0.85) {
      flags.push("ACCURACY_NEAR_THRESHOLD");
    }
  }
  if (previousToday) {
    const prevMs = new Date(previousToday.timestampIso).getTime();
    const currMs = new Date(current.timestampIso).getTime();
    const elapsedSeconds = Math.abs(currMs - prevMs) / 1e3;
    const distanceMeters = calculateHaversineDistanceMeters(
      { latitude: previousToday.latitude, longitude: previousToday.longitude },
      { latitude: current.latitude, longitude: current.longitude }
    );
    if (distanceMeters >= 500) {
      if (elapsedSeconds < 5) {
        flags.push("LOCATION_TELEPORT_JUMP");
      } else {
        const speedKmh = distanceMeters / 1e3 / (elapsedSeconds / 3600);
        if (speedKmh > 150) {
          flags.push("IMPLAUSIBLE_TRAVEL_SPEED");
        }
      }
    }
  }
  return flags;
}

// src/lib/attendanceEvaluator.ts
function holidayMatchesAudience(scope, audience) {
  if (scope === "SCHOOL" /* SCHOOL */) return true;
  if (scope === "STUDENT" /* STUDENT */ && audience === "STUDENT" /* STUDENT */) return true;
  if (scope === "TEACHER" /* TEACHER */ && audience === "TEACHER" /* TEACHER */) return true;
  return false;
}
function evaluateAttendanceStatus(rule, serverTime, eventType, options = {}) {
  const jakartaDate = getDateKeyJakarta(serverTime);
  const jakartaTime = getTimeHHMMJakarta(serverTime);
  const dayOfWeek = getDayOfWeekJakarta(serverTime);
  const base = { jakartaDate, jakartaTime, dayOfWeek };
  if (options.bypassTimeWindow) {
    return {
      ...base,
      status: "PRESENT" /* PRESENT */,
      lateMinutes: 0,
      reason: eventType === "CHECK_IN" /* CHECK_IN */ ? "Absen masuk berhasil dicatat (Bypass Waktu Absensi aktif)." : "Absen pulang berhasil dicatat (Bypass Waktu Absensi aktif)."
    };
  }
  const serverDateMs = serverTime instanceof Date ? serverTime.getTime() : new Date(serverTime).getTime();
  if (rule.effectiveFrom) {
    const fromMs = new Date(rule.effectiveFrom).getTime();
    if (Number.isFinite(fromMs) && serverDateMs < fromMs) {
      return {
        ...base,
        status: "REJECTED" /* REJECTED */,
        lateMinutes: 0,
        reason: "Aturan absensi belum mulai berlaku pada tanggal ini."
      };
    }
  }
  if (rule.effectiveUntil) {
    const untilMs = new Date(rule.effectiveUntil).getTime();
    if (Number.isFinite(untilMs) && serverDateMs > untilMs) {
      return {
        ...base,
        status: "REJECTED" /* REJECTED */,
        lateMinutes: 0,
        reason: "Aturan absensi sudah berakhir masa berlakunya."
      };
    }
  }
  if (options.holidays && options.holidays.length > 0) {
    const activeHoliday = options.holidays.find(
      (h) => h.isActive && h.date === jakartaDate && holidayMatchesAudience(h.scope, rule.audience)
    );
    if (activeHoliday) {
      return {
        ...base,
        status: "REJECTED" /* REJECTED */,
        lateMinutes: 0,
        reason: `Absensi tidak aktif karena hari libur: ${activeHoliday.name}.`
      };
    }
  }
  if (!rule.daysOfWeek.includes(dayOfWeek)) {
    const dayName = INDONESIAN_DAY_NAMES[dayOfWeek] ?? `Hari ${dayOfWeek}`;
    return {
      ...base,
      status: "REJECTED" /* REJECTED */,
      lateMinutes: 0,
      reason: `Hari ${dayName} bukan hari aktif absensi sesuai aturan yang berlaku.`
    };
  }
  const currentMin = parseTimeToMinutes(jakartaTime);
  if (eventType === "CHECK_IN" /* CHECK_IN */) {
    const startMin = parseTimeToMinutes(rule.checkInStart);
    const deadlineMin = parseTimeToMinutes(rule.checkInDeadline);
    const tolerance = Math.max(0, rule.lateToleranceMinutes ?? 0);
    const lateThresholdMin = parseTimeToMinutes(rule.lateAfter) + tolerance;
    if (currentMin < startMin) {
      return {
        ...base,
        status: "REJECTED" /* REJECTED */,
        lateMinutes: 0,
        reason: `Belum memasuki jam absen masuk (mulai pukul ${rule.checkInStart}).`
      };
    }
    if (currentMin > deadlineMin) {
      return {
        ...base,
        status: "REJECTED" /* REJECTED */,
        lateMinutes: 0,
        reason: `Batas akhir absen masuk (pukul ${rule.checkInDeadline}) telah terlewati.`
      };
    }
    if (currentMin > lateThresholdMin) {
      const lateMinutes = currentMin - lateThresholdMin;
      return {
        ...base,
        status: "LATE" /* LATE */,
        lateMinutes,
        reason: `Tercatat terlambat ${lateMinutes} menit dari batas pukul ${rule.lateAfter}${tolerance > 0 ? ` (+${tolerance} menit toleransi)` : ""}.`
      };
    }
    return {
      ...base,
      status: "PRESENT" /* PRESENT */,
      lateMinutes: 0,
      reason: "Hadir tepat waktu sesuai aturan absen masuk."
    };
  }
  const outStartMin = parseTimeToMinutes(rule.checkOutStart);
  const outDeadlineMin = parseTimeToMinutes(rule.checkOutDeadline);
  if (currentMin < outStartMin) {
    return {
      ...base,
      status: "REJECTED" /* REJECTED */,
      lateMinutes: 0,
      reason: `Belum memasuki jam absen pulang (mulai pukul ${rule.checkOutStart}).`
    };
  }
  if (currentMin > outDeadlineMin) {
    return {
      ...base,
      status: "REJECTED" /* REJECTED */,
      lateMinutes: 0,
      reason: `Batas akhir absen pulang (pukul ${rule.checkOutDeadline}) telah terlewati.`
    };
  }
  return {
    ...base,
    status: "PRESENT" /* PRESENT */,
    lateMinutes: 0,
    reason: "Absen pulang berhasil dicatat tepat waktu."
  };
}

// backend/attendance/scan.ts
var PORTAL_SCAN_ROLES = [
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "OPERATOR" /* OPERATOR */
];
function selectApplicableRule(rules, audience, classId, nowMs, bypassTimeWindow = false) {
  const activeForAudience = rules.filter((r) => r.isActive && r.audience === audience);
  const effectiveCandidates = activeForAudience.filter((r) => {
    if (!bypassTimeWindow) {
      if (r.effectiveFrom && new Date(r.effectiveFrom).getTime() > nowMs) return false;
      if (r.effectiveUntil && new Date(r.effectiveUntil).getTime() < nowMs) return false;
    }
    return true;
  });
  const candidates = effectiveCandidates.length > 0 ? effectiveCandidates : activeForAudience;
  const compareNewest = (a, b) => {
    const timeCmp = (b.updatedAt ?? b.createdAt ?? "").localeCompare(
      a.updatedAt ?? a.createdAt ?? ""
    );
    if (timeCmp !== 0) return timeCmp;
    return (b.version ?? 1) - (a.version ?? 1);
  };
  if (classId) {
    const classSpecific = candidates.filter((r) => r.classIds.includes(classId)).sort((a, b) => {
      if (a.classIds.length !== b.classIds.length) {
        return a.classIds.length - b.classIds.length;
      }
      return compareNewest(a, b);
    });
    if (classSpecific.length > 0) return classSpecific[0];
  }
  const schoolWide = candidates.filter((r) => r.classIds.length === 0).sort(compareNewest);
  return schoolWide[0] ?? null;
}
function resolveAutoEventType(rule, serverNow, hasCheckedInToday, bypassTimeWindow = false) {
  if (bypassTimeWindow) {
    return hasCheckedInToday ? "CHECK_OUT" /* CHECK_OUT */ : "CHECK_IN" /* CHECK_IN */;
  }
  const currentMin = parseTimeToMinutes(getTimeHHMMJakarta(serverNow));
  const outStart = parseTimeToMinutes(rule.checkOutStart);
  const outDeadline = parseTimeToMinutes(rule.checkOutDeadline);
  const inStart = parseTimeToMinutes(rule.checkInStart);
  const inDeadline = parseTimeToMinutes(rule.checkInDeadline);
  if (currentMin >= outStart && currentMin <= outDeadline) {
    return "CHECK_OUT" /* CHECK_OUT */;
  }
  if (currentMin >= inStart && currentMin <= inDeadline) {
    return "CHECK_IN" /* CHECK_IN */;
  }
  if (hasCheckedInToday && currentMin > inDeadline) {
    return "CHECK_OUT" /* CHECK_OUT */;
  }
  return currentMin >= outStart ? "CHECK_OUT" /* CHECK_OUT */ : "CHECK_IN" /* CHECK_IN */;
}
async function handleAttendanceScan(req, res, repo = getRepository(), options = {}) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: PORTAL_SCAN_ROLES });
    const parsed = attendanceScanSchema.parse(req.body ?? {});
    const serverNow = options.serverNow ?? /* @__PURE__ */ new Date();
    const serverTimestamp = serverNow.toISOString();
    const attendanceDate = getDateKeyJakarta(serverNow);
    const attendanceCol = repo.collection("attendanceRecords" /* ATTENDANCE_RECORDS */);
    const existingByIdempotency = await attendanceCol.findFirst([
      { field: "idempotencyKey", op: "==", value: parsed.idempotencyKey }
    ]);
    if (existingByIdempotency) {
      sendOk(res, {
        name: existingByIdempotency.personNameSnapshot,
        status: existingByIdempotency.status,
        eventType: existingByIdempotency.eventType,
        message: "Absensi sudah tercatat sebelumnya (idempotent).",
        attendanceDate: existingByIdempotency.attendanceDate,
        recordedAt: existingByIdempotency.serverTimestamp,
        idempotentReplay: true
      });
      return;
    }
    let resolvedOwnerType = null;
    let resolvedOwnerId = null;
    const normalizedToken = parsed.token.trim();
    const compactToken = normalizedToken.replace(/\s+/g, "");
    const studentByNis = await repo.collection("students" /* STUDENTS */).findFirst([{ field: "nis", op: "==", value: normalizedToken }]) ?? (compactToken !== normalizedToken ? await repo.collection("students" /* STUDENTS */).findFirst([{ field: "nis", op: "==", value: compactToken }]) : null);
    if (studentByNis) {
      resolvedOwnerType = "STUDENT" /* STUDENT */;
      resolvedOwnerId = studentByNis.id;
    } else {
      const teacherByNiy = await repo.collection("teachers" /* TEACHERS */).findFirst([{ field: "niyNip", op: "==", value: normalizedToken }]) ?? (compactToken !== normalizedToken ? await repo.collection("teachers" /* TEACHERS */).findFirst([{ field: "niyNip", op: "==", value: compactToken }]) : null);
      if (teacherByNiy) {
        resolvedOwnerType = "TEACHER" /* TEACHER */;
        resolvedOwnerId = teacherByNiy.id;
      } else {
        const qrToken = await findActiveQrTokenByRaw(repo, normalizedToken);
        if (qrToken) {
          resolvedOwnerType = qrToken.ownerType;
          resolvedOwnerId = qrToken.ownerId;
        }
      }
    }
    if (!resolvedOwnerType || !resolvedOwnerId) {
      throw ApiError.notFound("Kode QR / NIS / NIY tidak dikenali atau sudah dicabut.");
    }
    const qrOwner = { ownerType: resolvedOwnerType, ownerId: resolvedOwnerId };
    let personName = "";
    let nisSnapshot = null;
    let niyNipSnapshot = null;
    let classIdSnapshot = null;
    let classNameSnapshot = null;
    let audience;
    if (qrOwner.ownerType === "STUDENT" /* STUDENT */) {
      audience = "STUDENT" /* STUDENT */;
      const student = studentByNis ?? await repo.collection("students" /* STUDENTS */).getById(qrOwner.ownerId);
      if (!student) {
        throw ApiError.notFound("Data siswa pemilik QR tidak ditemukan.");
      }
      if (student.status !== "ACTIVE" /* ACTIVE */ && student.status !== "DEMO_ACTIVE" /* DEMO_ACTIVE */) {
        throw ApiError.badRequest(
          `Absensi ditolak: status siswa ${student.fullName} tidak aktif.`,
          { name: student.fullName }
        );
      }
      personName = student.fullName;
      nisSnapshot = student.nis;
      classIdSnapshot = student.classId;
      const cls = await repo.collection("classes" /* CLASSES */).getById(student.classId);
      classNameSnapshot = cls?.name ?? null;
    } else {
      audience = "TEACHER" /* TEACHER */;
      const teacher = await repo.collection("teachers" /* TEACHERS */).getById(qrOwner.ownerId);
      if (!teacher) {
        throw ApiError.notFound("Data guru pemilik QR tidak ditemukan.");
      }
      if (teacher.status !== "ACTIVE" /* ACTIVE */) {
        throw ApiError.badRequest(
          `Absensi ditolak: status guru ${teacher.fullName} tidak aktif.`,
          { name: teacher.fullName }
        );
      }
      personName = teacher.fullName;
      niyNipSnapshot = teacher.niyNip;
    }
    const [rulesRes, holidaysRes, settings, locationsRes] = await Promise.all([
      repo.collection("attendanceRules" /* ATTENDANCE_RULES */).list(),
      repo.collection("holidays" /* HOLIDAYS */).list(),
      repo.collection("appSettings" /* APP_SETTINGS */).getById("default"),
      repo.collection("schoolLocations" /* SCHOOL_LOCATIONS */).list({
        filters: [{ field: "isActive", op: "==", value: true }]
      })
    ]);
    const bypassTimeWindow = Boolean(settings?.bypassAttendanceTimeWindow);
    const activeRule = selectApplicableRule(
      rulesRes.items,
      audience,
      classIdSnapshot,
      serverNow.getTime(),
      bypassTimeWindow
    );
    if (!activeRule) {
      throw ApiError.badRequest(
        "Belum ada aturan jam absensi aktif untuk kategori ini.",
        { name: personName }
      );
    }
    const checkInDocId = `att_${qrOwner.ownerType}_${qrOwner.ownerId}_${attendanceDate}_${"CHECK_IN" /* CHECK_IN */}`;
    const existingCheckIn = await attendanceCol.getById(checkInDocId);
    let resolvedEventType;
    if (parsed.eventType === "AUTO") {
      resolvedEventType = resolveAutoEventType(
        activeRule,
        serverNow,
        Boolean(existingCheckIn),
        bypassTimeWindow
      );
    } else {
      resolvedEventType = parsed.eventType;
    }
    const evaluation = evaluateAttendanceStatus(activeRule, serverNow, resolvedEventType, {
      holidays: holidaysRes.items,
      bypassTimeWindow
    });
    if (evaluation.status === "REJECTED" /* REJECTED */) {
      throw ApiError.badRequest(evaluation.reason, {
        name: personName,
        status: "REJECTED" /* REJECTED */,
        eventType: resolvedEventType
      });
    }
    let selfieStoragePath = null;
    if (qrOwner.ownerType === "TEACHER" /* TEACHER */) {
      if (!parsed.selfieFileId) {
        throw new ApiError(
          428,
          "SELFIE_REQUIRED",
          `Ambil foto selfie untuk verifikasi absensi guru ${personName}.`,
          {
            requiresSelfie: true,
            ownerType: "TEACHER" /* TEACHER */,
            ownerId: qrOwner.ownerId,
            name: personName,
            eventType: resolvedEventType
          }
        );
      }
      const selfieMeta = await repo.collection("fileMetadata" /* FILE_METADATA */).getById(parsed.selfieFileId);
      if (!selfieMeta || selfieMeta.category !== "ATTENDANCE_SELFIE" /* ATTENDANCE_SELFIE */ || selfieMeta.ownerType !== "TEACHER" /* TEACHER */ || selfieMeta.ownerId !== qrOwner.ownerId && !selfieMeta.ownerId.startsWith("portal_")) {
        throw ApiError.badRequest(
          "Foto selfie verifikasi guru tidak ditemukan atau tidak valid. Ambil ulang selfie.",
          { name: personName, status: "REJECTED" /* REJECTED */ }
        );
      }
      selfieStoragePath = selfieMeta.storagePath;
    }
    const gpsEnabledBySettings = audience === "STUDENT" /* STUDENT */ ? settings?.gpsEnabledForStudents ?? true : settings?.gpsEnabledForTeachers ?? true;
    const requiresGps = activeRule.gpsRequired && gpsEnabledBySettings;
    const requiresGeofence = activeRule.geofenceRequired && gpsEnabledBySettings;
    const activeLocation = locationsRes.items[0] ?? null;
    let distanceFromSchoolMeters = null;
    let geofencePassed = null;
    const hasCoordinates = typeof parsed.latitude === "number" && typeof parsed.longitude === "number";
    if ((requiresGps || requiresGeofence) && !hasCoordinates) {
      throw ApiError.badRequest(
        "Lokasi GPS wajib aktif untuk melakukan absensi. Aktifkan izin lokasi pada perangkat portal.",
        { name: personName, status: "REJECTED" /* REJECTED */ }
      );
    }
    if (hasCoordinates && activeLocation) {
      const geoResult = validateGeofence({
        school: { latitude: activeLocation.latitude, longitude: activeLocation.longitude },
        device: { latitude: parsed.latitude, longitude: parsed.longitude },
        radiusMeters: activeLocation.radiusMeters,
        maxAccuracyMeters: activeLocation.maxGpsAccuracyMeters,
        accuracyMeters: parsed.gpsAccuracyMeters
      });
      distanceFromSchoolMeters = geoResult.distanceMeters;
      geofencePassed = geoResult.passed;
      if (requiresGeofence && !geoResult.passed) {
        throw ApiError.badRequest(
          geoResult.reason ?? "Lokasi perangkat berada di luar radius area sekolah.",
          { name: personName, status: "REJECTED" /* REJECTED */ }
        );
      }
      if (requiresGps && !requiresGeofence && parsed.gpsAccuracyMeters !== null && parsed.gpsAccuracyMeters > activeLocation.maxGpsAccuracyMeters) {
        throw ApiError.badRequest(
          `Akurasi GPS tidak memadai (${Math.round(parsed.gpsAccuracyMeters)} m, maksimal ${activeLocation.maxGpsAccuracyMeters} m).`,
          { name: personName, status: "REJECTED" /* REJECTED */ }
        );
      }
    }
    let anomalyFlags = [];
    if (hasCoordinates) {
      const prevSample = existingCheckIn && existingCheckIn.latitude !== null && existingCheckIn.longitude !== null ? {
        latitude: existingCheckIn.latitude,
        longitude: existingCheckIn.longitude,
        accuracyMeters: existingCheckIn.gpsAccuracyMeters,
        timestampIso: existingCheckIn.serverTimestamp
      } : null;
      anomalyFlags = detectLocationAnomalies({
        current: {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          accuracyMeters: parsed.gpsAccuracyMeters,
          timestampIso: serverTimestamp
        },
        previousToday: prevSample,
        maxAccuracyMeters: activeLocation?.maxGpsAccuracyMeters ?? 100
      });
    }
    const attendanceMethod = qrOwner.ownerType === "TEACHER" /* TEACHER */ ? "QR_SELFIE" /* QR_SELFIE */ : "QR" /* QR */;
    const deterministicId = `att_${qrOwner.ownerType}_${qrOwner.ownerId}_${attendanceDate}_${resolvedEventType}`;
    const createResult = await attendanceCol.createIfNotExists(deterministicId, {
      personType: qrOwner.ownerType,
      personId: qrOwner.ownerId,
      personNameSnapshot: personName,
      nisSnapshot,
      niyNipSnapshot,
      classIdSnapshot,
      classNameSnapshot,
      attendanceDate,
      eventType: resolvedEventType,
      status: evaluation.status,
      method: attendanceMethod,
      serverTimestamp,
      clientTimestamp: parsed.clientTimestamp,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      gpsAccuracyMeters: parsed.gpsAccuracyMeters,
      distanceFromSchoolMeters,
      geofencePassed,
      selfiePath: selfieStoragePath,
      deviceInfo: parsed.deviceInfo,
      idempotencyKey: parsed.idempotencyKey,
      corrected: false,
      correctionReason: null,
      anomalyFlags,
      createdBy: auth.user.id
    });
    if (!createResult.created) {
      if (createResult.doc.idempotencyKey === parsed.idempotencyKey) {
        sendOk(res, {
          name: createResult.doc.personNameSnapshot,
          status: createResult.doc.status,
          eventType: createResult.doc.eventType,
          message: "Absensi sudah tercatat sebelumnya (idempotent).",
          attendanceDate: createResult.doc.attendanceDate,
          recordedAt: createResult.doc.serverTimestamp,
          idempotentReplay: true
        });
        return;
      }
      const eventLabel = resolvedEventType === "CHECK_IN" /* CHECK_IN */ ? "absen masuk" : "absen pulang";
      throw ApiError.conflict(
        `${personName} sudah tercatat ${eventLabel} hari ini.`,
        {
          name: personName,
          status: "REJECTED" /* REJECTED */,
          eventType: resolvedEventType
        }
      );
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "ATTENDANCE_QR_SCANNED",
      entityType: "ATTENDANCE_RECORD",
      entityId: createResult.doc.id,
      after: {
        personType: qrOwner.ownerType,
        personId: qrOwner.ownerId,
        attendanceDate,
        eventType: resolvedEventType,
        status: evaluation.status
      },
      clientIp: auth.clientIp
    });
    sendOk(
      res,
      {
        name: personName,
        status: evaluation.status,
        eventType: resolvedEventType,
        message: evaluation.reason,
        attendanceDate,
        recordedAt: serverTimestamp,
        lateMinutes: evaluation.lateMinutes,
        idempotentReplay: false
      },
      201
    );
  } catch (err) {
    sendError(res, err);
  }
}
async function handler36(req, res) {
  await handleAttendanceScan(req, res);
}

// backend/attendance/index.ts
async function handleAttendanceList(req, res, repo = getRepository()) {
  try {
    if (req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus GET.");
    }
    await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
    const date = getQueryString(req, "date");
    const dateFrom = getQueryString(req, "dateFrom");
    const dateTo = getQueryString(req, "dateTo");
    const personType = getQueryString(req, "personType");
    const classId = getQueryString(req, "classId");
    const status = getQueryString(req, "status");
    const eventType = getQueryString(req, "eventType");
    const search = getQueryString(req, "search").toLowerCase();
    const cursor = getQueryString(req, "cursor");
    const limit = getQueryInt(req, "limit", 20, 1, 2e3);
    const allRes = await repo.collection("attendanceRecords" /* ATTENDANCE_RECORDS */).list({
      sort: { field: "serverTimestamp", direction: "desc" }
    });
    const filtered = allRes.items.filter((rec) => {
      if (date && rec.attendanceDate !== date) return false;
      if (dateFrom && rec.attendanceDate < dateFrom) return false;
      if (dateTo && rec.attendanceDate > dateTo) return false;
      if (personType && rec.personType !== personType) return false;
      if (classId && rec.classIdSnapshot !== classId) return false;
      if (status && rec.status !== status) return false;
      if (eventType && rec.eventType !== eventType) return false;
      if (search) {
        const hay = `${rec.personNameSnapshot} ${rec.nisSnapshot ?? ""} ${rec.niyNipSnapshot ?? ""} ${rec.classNameSnapshot ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
    const summary = {
      total: filtered.length,
      present: filtered.filter((r) => r.status === "PRESENT" /* PRESENT */).length,
      late: filtered.filter((r) => r.status === "LATE" /* LATE */).length,
      sick: filtered.filter((r) => r.status === "SICK" /* SICK */).length,
      excused: filtered.filter((r) => r.status === "EXCUSED" /* EXCUSED */).length,
      absent: filtered.filter((r) => r.status === "ABSENT" /* ABSENT */).length
    };
    let startIdx = 0;
    if (cursor) {
      const idx = filtered.findIndex((r) => r.id === cursor);
      if (idx >= 0) startIdx = idx + 1;
    }
    const pageItems = filtered.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + pageItems.length < filtered.length;
    const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;
    sendOk(res, {
      items: pageItems,
      total: filtered.length,
      nextCursor,
      summary
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler37(req, res) {
  await handleAttendanceList(req, res);
}

// backend/attendance/[id]/correction.ts
async function handleAttendanceCorrection(req, res, idOverride, repo = getRepository()) {
  try {
    if (req.method !== "PATCH") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus PATCH.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID catatan kehadiran wajib diisi.");
    const col = repo.collection("attendanceRecords" /* ATTENDANCE_RECORDS */);
    const existing = await col.getById(id);
    if (!existing) {
      throw ApiError.notFound("Catatan kehadiran tidak ditemukan.");
    }
    const parsed = attendanceCorrectionSchema.parse(req.body ?? {});
    const updated = await col.update(id, {
      status: parsed.status,
      corrected: true,
      correctionReason: parsed.reason
    });
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "ATTENDANCE_CORRECTED",
      entityType: "ATTENDANCE_RECORD",
      entityId: id,
      before: {
        status: existing.status,
        corrected: existing.corrected,
        correctionReason: existing.correctionReason
      },
      after: {
        status: updated?.status,
        corrected: true,
        correctionReason: parsed.reason
      },
      reason: parsed.reason,
      clientIp: auth.clientIp
    });
    sendOk(res, updated);
  } catch (err) {
    sendError(res, err);
  }
}

// backend/attendance/[id].ts
async function handleAttendanceById(req, res, idOverride, repo = getRepository()) {
  try {
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID catatan kehadiran wajib diisi.");
    const col = repo.collection("attendanceRecords" /* ATTENDANCE_RECORDS */);
    if (req.method === "DELETE") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) {
        throw ApiError.notFound("Catatan kehadiran tidak ditemukan.");
      }
      await col.delete(id);
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "ATTENDANCE_RECORD_DELETED",
        entityType: "ATTENDANCE_RECORD",
        entityId: id,
        before: {
          personName: existing.personNameSnapshot,
          attendanceDate: existing.attendanceDate,
          eventType: existing.eventType,
          status: existing.status
        },
        reason: "Dihapus oleh admin/super admin.",
        clientIp: auth.clientIp
      });
      sendOk(res, { deleted: true, id });
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}

// backend/attendance/teacher-self.ts
function selectActiveTeacherRule(rules, nowMs, bypassTimeWindow = false) {
  const activeTeacherRules = rules.filter(
    (r) => r.isActive && r.audience === "TEACHER" /* TEACHER */
  );
  const effective = activeTeacherRules.filter((r) => {
    if (!bypassTimeWindow) {
      if (r.effectiveFrom && new Date(r.effectiveFrom).getTime() > nowMs) return false;
      if (r.effectiveUntil && new Date(r.effectiveUntil).getTime() < nowMs) return false;
    }
    return true;
  });
  const pool = effective.length > 0 ? effective : activeTeacherRules;
  const candidates = pool.sort((a, b) => {
    const timeCmp = (b.updatedAt ?? b.createdAt ?? "").localeCompare(
      a.updatedAt ?? a.createdAt ?? ""
    );
    if (timeCmp !== 0) return timeCmp;
    return (b.version ?? 1) - (a.version ?? 1);
  });
  return candidates[0] ?? null;
}
function resolveTeacherAutoEventType(rule, serverNow, hasCheckedInToday, bypassTimeWindow = false) {
  if (bypassTimeWindow) {
    return hasCheckedInToday ? "CHECK_OUT" /* CHECK_OUT */ : "CHECK_IN" /* CHECK_IN */;
  }
  const currentMin = parseTimeToMinutes(getTimeHHMMJakarta(serverNow));
  const outStart = parseTimeToMinutes(rule.checkOutStart);
  const outDeadline = parseTimeToMinutes(rule.checkOutDeadline);
  const inStart = parseTimeToMinutes(rule.checkInStart);
  const inDeadline = parseTimeToMinutes(rule.checkInDeadline);
  if (currentMin >= outStart && currentMin <= outDeadline) {
    return "CHECK_OUT" /* CHECK_OUT */;
  }
  if (currentMin >= inStart && currentMin <= inDeadline) {
    return "CHECK_IN" /* CHECK_IN */;
  }
  if (hasCheckedInToday && currentMin > inDeadline) {
    return "CHECK_OUT" /* CHECK_OUT */;
  }
  return currentMin >= outStart ? "CHECK_OUT" /* CHECK_OUT */ : "CHECK_IN" /* CHECK_IN */;
}
async function handleTeacherSelfAttendance(req, res, repo = getRepository(), options = {}) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, {
      repo,
      allowedRoles: ["TEACHER" /* TEACHER */, "PRINCIPAL" /* PRINCIPAL */]
    });
    const resolvedTeacher = await resolveTeacherProfileForUser(repo, auth.user);
    if (!resolvedTeacher) {
      throw ApiError.forbidden(
        auth.user.role === "PRINCIPAL" /* PRINCIPAL */ ? "Akun Kepala Sekolah belum tertaut ke profil pendidik aktif. Hubungi Admin untuk menautkan akun di Manajemen Pengguna." : "Akun Anda belum tertaut ke profil guru aktif."
      );
    }
    const parsed = teacherSelfAttendanceSchema.parse(req.body ?? {});
    const serverNow = options.serverNow ?? /* @__PURE__ */ new Date();
    const serverTimestamp = serverNow.toISOString();
    const attendanceDate = getDateKeyJakarta(serverNow);
    const attendanceCol = repo.collection("attendanceRecords" /* ATTENDANCE_RECORDS */);
    const existingByIdem = await attendanceCol.findFirst([
      { field: "idempotencyKey", op: "==", value: parsed.idempotencyKey }
    ]);
    if (existingByIdem && existingByIdem.personId === resolvedTeacher.id) {
      sendOk(res, {
        record: existingByIdem,
        message: "Absensi Anda sudah tercatat sebelumnya (idempotent).",
        idempotentReplay: true
      });
      return;
    }
    const [settings, rulesRes, holidaysRes, locationsRes, selfieMeta] = await Promise.all([
      repo.collection("appSettings" /* APP_SETTINGS */).getById("default"),
      repo.collection("attendanceRules" /* ATTENDANCE_RULES */).list(),
      repo.collection("holidays" /* HOLIDAYS */).list(),
      repo.collection("schoolLocations" /* SCHOOL_LOCATIONS */).list({
        filters: [{ field: "isActive", op: "==", value: true }]
      }),
      repo.collection("fileMetadata" /* FILE_METADATA */).getById(parsed.selfieFileId)
    ]);
    const teacher = resolvedTeacher;
    if (teacher.status !== "ACTIVE" /* ACTIVE */) {
      throw ApiError.forbidden("Profil guru tidak aktif. Hubungi Admin Madrasah.");
    }
    if (settings && settings.teacherSelfServiceEnabled === false) {
      throw ApiError.forbidden(
        "Fitur absensi mandiri guru sedang dinonaktifkan oleh Admin Madrasah."
      );
    }
    if (!selfieMeta || selfieMeta.category !== "ATTENDANCE_SELFIE" /* ATTENDANCE_SELFIE */ || selfieMeta.ownerType !== "TEACHER" /* TEACHER */ || selfieMeta.ownerId !== teacher.id) {
      throw ApiError.badRequest(
        "Foto selfie belum terverifikasi atau bukan milik akun Anda. Ambil ulang foto selfie."
      );
    }
    if (selfieMeta.mimeType !== "image/jpeg") {
      throw ApiError.badRequest(
        "Absensi mandiri guru hanya menerima foto kamera langsung (JPEG), tidak mendukung gambar PNG."
      );
    }
    const bypassTimeWindow = Boolean(settings?.bypassAttendanceTimeWindow);
    const activeRule = selectActiveTeacherRule(
      rulesRes.items,
      serverNow.getTime(),
      bypassTimeWindow
    );
    if (!activeRule) {
      throw ApiError.badRequest("Belum ada aturan jam absensi aktif untuk guru.");
    }
    const checkInId = `att_${"TEACHER" /* TEACHER */}_${teacher.id}_${attendanceDate}_${"CHECK_IN" /* CHECK_IN */}`;
    const existingCheckIn = await attendanceCol.getById(checkInId);
    const resolvedEventType = parsed.eventType === "AUTO" ? resolveTeacherAutoEventType(
      activeRule,
      serverNow,
      Boolean(existingCheckIn),
      bypassTimeWindow
    ) : parsed.eventType;
    const evaluation = evaluateAttendanceStatus(activeRule, serverNow, resolvedEventType, {
      holidays: holidaysRes.items,
      bypassTimeWindow
    });
    if (evaluation.status === "REJECTED" /* REJECTED */) {
      throw ApiError.badRequest(evaluation.reason, {
        status: "REJECTED" /* REJECTED */,
        eventType: resolvedEventType
      });
    }
    const activeLocation = locationsRes.items[0] ?? null;
    const gpsEnabledForTeachers = settings?.gpsEnabledForTeachers ?? true;
    const requiresGps = activeRule.gpsRequired && gpsEnabledForTeachers;
    const requiresGeofence = activeRule.geofenceRequired && gpsEnabledForTeachers;
    const hasCoordinates = typeof parsed.latitude === "number" && typeof parsed.longitude === "number";
    const accuracyVal = typeof parsed.gpsAccuracyMeters === "number" ? parsed.gpsAccuracyMeters : 0;
    let distanceFromSchoolMeters = null;
    let geofencePassed = null;
    if ((requiresGps || requiresGeofence) && !hasCoordinates) {
      throw ApiError.badRequest(
        "Lokasi GPS wajib aktif untuk melakukan absensi mandiri. Aktifkan izin lokasi pada perangkat Anda atau hubungi Admin untuk pengecualian manual."
      );
    }
    if (hasCoordinates && activeLocation) {
      const geoResult = validateGeofence({
        school: { latitude: activeLocation.latitude, longitude: activeLocation.longitude },
        device: { latitude: parsed.latitude, longitude: parsed.longitude },
        radiusMeters: activeLocation.radiusMeters,
        maxAccuracyMeters: activeLocation.maxGpsAccuracyMeters,
        accuracyMeters: accuracyVal
      });
      distanceFromSchoolMeters = geoResult.distanceMeters;
      geofencePassed = geoResult.passed;
      if ((requiresGps || requiresGeofence) && !geoResult.accuracyAcceptable) {
        throw ApiError.badRequest(
          geoResult.reason ?? `Akurasi GPS terlalu rendah (${Math.round(accuracyVal)} m, maksimal ${activeLocation.maxGpsAccuracyMeters} m). Pindah ke area terbuka atau hubungi Admin untuk pengecualian manual.`,
          {
            code: "GPS_ACCURACY_POOR",
            distanceMeters: geoResult.distanceMeters,
            accuracyMeters: accuracyVal
          }
        );
      }
      if (requiresGeofence && !geoResult.withinRadius) {
        throw ApiError.badRequest(
          geoResult.reason ?? `Anda berada di luar radius area sekolah (${Math.round(geoResult.distanceMeters)} m dari batas ${activeLocation.radiusMeters} m).`,
          {
            code: "OUTSIDE_GEOFENCE",
            distanceMeters: geoResult.distanceMeters,
            radiusMeters: activeLocation.radiusMeters
          }
        );
      }
    } else if (requiresGeofence) {
      throw ApiError.badRequest(
        "Titik koordinat lokasi sekolah belum dikonfigurasi. Hubungi Admin Madrasah."
      );
    }
    const previousSample = existingCheckIn && existingCheckIn.latitude !== null && existingCheckIn.longitude !== null ? {
      latitude: existingCheckIn.latitude,
      longitude: existingCheckIn.longitude,
      accuracyMeters: existingCheckIn.gpsAccuracyMeters,
      timestampIso: existingCheckIn.serverTimestamp
    } : null;
    const anomalyFlags = hasCoordinates ? detectLocationAnomalies({
      current: {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        accuracyMeters: accuracyVal,
        timestampIso: serverTimestamp
      },
      previousToday: previousSample,
      maxAccuracyMeters: activeLocation?.maxGpsAccuracyMeters ?? 100
    }) : [];
    const deterministicId = `att_${"TEACHER" /* TEACHER */}_${teacher.id}_${attendanceDate}_${resolvedEventType}`;
    const createResult = await attendanceCol.createIfNotExists(deterministicId, {
      personType: "TEACHER" /* TEACHER */,
      personId: teacher.id,
      personNameSnapshot: teacher.fullName,
      nisSnapshot: null,
      niyNipSnapshot: teacher.niyNip,
      classIdSnapshot: null,
      classNameSnapshot: null,
      attendanceDate,
      eventType: resolvedEventType,
      status: evaluation.status,
      method: "SELF_SERVICE_SELFIE" /* SELF_SERVICE_SELFIE */,
      serverTimestamp,
      clientTimestamp: parsed.clientTimestamp,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      gpsAccuracyMeters: parsed.gpsAccuracyMeters,
      distanceFromSchoolMeters,
      geofencePassed,
      selfiePath: selfieMeta.storagePath,
      deviceInfo: parsed.deviceInfo,
      idempotencyKey: parsed.idempotencyKey,
      corrected: false,
      correctionReason: null,
      anomalyFlags,
      createdBy: auth.user.id
    });
    if (!createResult.created) {
      if (createResult.doc.idempotencyKey === parsed.idempotencyKey) {
        sendOk(res, {
          record: createResult.doc,
          message: "Absensi Anda sudah tercatat sebelumnya (idempotent).",
          idempotentReplay: true
        });
        return;
      }
      const label = resolvedEventType === "CHECK_IN" /* CHECK_IN */ ? "absen masuk" : "absen pulang";
      throw ApiError.conflict(`Anda sudah tercatat ${label} pada tanggal ${attendanceDate}.`);
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "TEACHER_SELF_ATTENDANCE",
      entityType: "ATTENDANCE_RECORD",
      entityId: createResult.doc.id,
      after: {
        teacherId: teacher.id,
        attendanceDate,
        eventType: resolvedEventType,
        status: evaluation.status,
        distanceFromSchoolMeters,
        geofencePassed,
        anomalyFlags
      },
      clientIp: auth.clientIp
    });
    sendOk(
      res,
      {
        record: createResult.doc,
        message: evaluation.reason,
        lateMinutes: evaluation.lateMinutes,
        idempotentReplay: false
      },
      201
    );
  } catch (err) {
    sendError(res, err);
  }
}
async function handler38(req, res) {
  await handleTeacherSelfAttendance(req, res);
}

// backend/attendance/me.ts
async function handleMyAttendance(req, res, repo = getRepository()) {
  try {
    if (req.method && req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus GET.");
    }
    const auth = await requireAuth(req, {
      repo,
      allowedRoles: ["TEACHER" /* TEACHER */, "PRINCIPAL" /* PRINCIPAL */]
    });
    const now = /* @__PURE__ */ new Date();
    const todayDate = getDateKeyJakarta(now);
    const todayDayOfWeek = getDayOfWeekJakarta(now);
    const teacherProfile = await resolveTeacherProfileForUser(repo, auth.user);
    const [locationsRes, rulesRes, settings] = await Promise.all([
      repo.collection("schoolLocations" /* SCHOOL_LOCATIONS */).list({
        filters: [{ field: "isActive", op: "==", value: true }]
      }),
      repo.collection("attendanceRules" /* ATTENDANCE_RULES */).list({
        filters: [
          { field: "audience", op: "==", value: "TEACHER" /* TEACHER */ },
          { field: "isActive", op: "==", value: true }
        ]
      }),
      repo.collection("appSettings" /* APP_SETTINGS */).getById("default")
    ]);
    const teacherRule = rulesRes.items.sort((a, b) => {
      const timeCmp = (b.updatedAt ?? b.createdAt ?? "").localeCompare(
        a.updatedAt ?? a.createdAt ?? ""
      );
      if (timeCmp !== 0) return timeCmp;
      return (b.version ?? 1) - (a.version ?? 1);
    })[0] ?? null;
    if (!teacherProfile) {
      sendOk(res, {
        todayDate,
        todayDayOfWeek,
        linkedTeacherId: null,
        teacherName: null,
        teacherPosition: null,
        teacherWorkingDays: resolveTeacherWorkingDays(null, teacherRule),
        teacherHltDays: [],
        isTodayHlt: false,
        todayCheckIn: null,
        todayCheckOut: null,
        activeLocation: locationsRes.items[0] ?? null,
        teacherRule,
        gpsEnabledForTeachers: settings?.gpsEnabledForTeachers ?? true,
        teacherSelfServiceEnabled: settings?.teacherSelfServiceEnabled ?? true,
        bypassAttendanceTimeWindow: settings?.bypassAttendanceTimeWindow ?? false,
        items: [],
        total: 0,
        nextCursor: null,
        summary: { total: 0, present: 0, late: 0, sick: 0, excused: 0, absent: 0 }
      });
      return;
    }
    const dateFrom = getQueryString(req, "dateFrom");
    const dateTo = getQueryString(req, "dateTo");
    const status = getQueryString(req, "status");
    const cursor = getQueryString(req, "cursor");
    const limit = getQueryInt(req, "limit", 20, 1, 1e3);
    const recordsRes = await repo.collection("attendanceRecords" /* ATTENDANCE_RECORDS */).list({
      filters: [
        { field: "personType", op: "==", value: "TEACHER" /* TEACHER */ },
        { field: "personId", op: "==", value: teacherProfile.id }
      ],
      sort: { field: "serverTimestamp", direction: "desc" }
    });
    const allMine = recordsRes.items;
    const todayCheckIn = allMine.find(
      (r) => r.attendanceDate === todayDate && r.eventType === "CHECK_IN" /* CHECK_IN */
    ) ?? null;
    const todayCheckOut = allMine.find(
      (r) => r.attendanceDate === todayDate && r.eventType === "CHECK_OUT" /* CHECK_OUT */
    ) ?? null;
    const filtered = allMine.filter((r) => {
      if (dateFrom && r.attendanceDate < dateFrom) return false;
      if (dateTo && r.attendanceDate > dateTo) return false;
      if (status && r.status !== status) return false;
      return true;
    });
    const summary = {
      total: filtered.length,
      present: filtered.filter((r) => r.status === "PRESENT" /* PRESENT */).length,
      late: filtered.filter((r) => r.status === "LATE" /* LATE */).length,
      sick: filtered.filter((r) => r.status === "SICK" /* SICK */).length,
      excused: filtered.filter((r) => r.status === "EXCUSED" /* EXCUSED */).length,
      absent: filtered.filter((r) => r.status === "ABSENT" /* ABSENT */).length
    };
    let startIdx = 0;
    if (cursor) {
      const idx = filtered.findIndex((r) => r.id === cursor);
      if (idx >= 0) startIdx = idx + 1;
    }
    const pageItems = filtered.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + pageItems.length < filtered.length;
    const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;
    const teacherWorkingDays = resolveTeacherWorkingDays(teacherProfile, teacherRule);
    const teacherHltDays = resolveTeacherHltDays(teacherWorkingDays, teacherRule);
    const isTodayHlt = teacherHltDays.includes(todayDayOfWeek);
    sendOk(res, {
      todayDate,
      todayDayOfWeek,
      linkedTeacherId: teacherProfile.id,
      teacherName: teacherProfile.fullName,
      teacherPosition: teacherProfile.position,
      teacherWorkingDays,
      teacherHltDays,
      isTodayHlt,
      todayCheckIn,
      todayCheckOut,
      activeLocation: locationsRes.items[0] ?? null,
      teacherRule,
      gpsEnabledForTeachers: settings?.gpsEnabledForTeachers ?? true,
      teacherSelfServiceEnabled: settings?.teacherSelfServiceEnabled ?? true,
      bypassAttendanceTimeWindow: settings?.bypassAttendanceTimeWindow ?? false,
      items: pageItems,
      total: filtered.length,
      nextCursor,
      summary
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler39(req, res) {
  await handleMyAttendance(req, res);
}

// backend/attendance/manual-exception.ts
import crypto11 from "node:crypto";
async function handleManualExceptionAttendance(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = manualExceptionAttendanceSchema.parse(req.body ?? {});
    let personNameSnapshot = "";
    let nisSnapshot = null;
    let niyNipSnapshot = null;
    let classIdSnapshot = null;
    let classNameSnapshot = null;
    if (parsed.personType === "TEACHER" /* TEACHER */) {
      const teacher = await repo.collection("teachers" /* TEACHERS */).getById(parsed.personId);
      if (!teacher) throw ApiError.notFound("Guru tidak ditemukan.");
      personNameSnapshot = teacher.fullName;
      niyNipSnapshot = teacher.niyNip;
    } else {
      const student = await repo.collection("students" /* STUDENTS */).getById(parsed.personId);
      if (!student) throw ApiError.notFound("Siswa tidak ditemukan.");
      personNameSnapshot = student.fullName;
      nisSnapshot = student.nis;
      classIdSnapshot = student.classId;
      const cls = await repo.collection("classes" /* CLASSES */).getById(student.classId);
      classNameSnapshot = cls?.name ?? null;
    }
    const serverTimestamp = (/* @__PURE__ */ new Date()).toISOString();
    const deterministicId = `att_${parsed.personType}_${parsed.personId}_${parsed.attendanceDate}_${parsed.eventType}`;
    const attendanceCol = repo.collection("attendanceRecords" /* ATTENDANCE_RECORDS */);
    const createdResult = await attendanceCol.createIfNotExists(deterministicId, {
      personType: parsed.personType,
      personId: parsed.personId,
      personNameSnapshot,
      nisSnapshot,
      niyNipSnapshot,
      classIdSnapshot,
      classNameSnapshot,
      attendanceDate: parsed.attendanceDate,
      eventType: parsed.eventType,
      status: parsed.status,
      method: "MANUAL_CORRECTION" /* MANUAL_CORRECTION */,
      serverTimestamp,
      clientTimestamp: null,
      latitude: null,
      longitude: null,
      gpsAccuracyMeters: null,
      distanceFromSchoolMeters: null,
      geofencePassed: null,
      selfiePath: null,
      deviceInfo: "Pengecualian Manual Admin",
      idempotencyKey: `manual_${crypto11.randomBytes(8).toString("hex")}`,
      corrected: true,
      correctionReason: parsed.reason,
      anomalyFlags: ["MANUAL_GPS_EXCEPTION"],
      createdBy: auth.user.id
    });
    if (!createdResult.created) {
      throw ApiError.conflict(
        `Catatan absensi untuk ${personNameSnapshot} pada ${parsed.attendanceDate} (${parsed.eventType}) sudah ada. Gunakan fitur Koreksi pada catatan tersebut.`
      );
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "ATTENDANCE_MANUAL_EXCEPTION",
      entityType: "ATTENDANCE_RECORD",
      entityId: createdResult.doc.id,
      after: {
        personType: parsed.personType,
        personId: parsed.personId,
        attendanceDate: parsed.attendanceDate,
        eventType: parsed.eventType,
        status: parsed.status
      },
      reason: parsed.reason,
      clientIp: auth.clientIp
    });
    sendOk(res, createdResult.doc, 201);
  } catch (err) {
    sendError(res, err);
  }
}
async function handler40(req, res) {
  await handleManualExceptionAttendance(req, res);
}

// backend/uploads/selfie.ts
import crypto12 from "node:crypto";
var UPLOAD_ALLOWED_ROLES = [
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "OPERATOR" /* OPERATOR */,
  "PRINCIPAL" /* PRINCIPAL */,
  "TEACHER" /* TEACHER */
];
async function handleUploadSelfie(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: UPLOAD_ALLOWED_ROLES });
    const parsed = selfieUploadSchema.parse(req.body ?? {});
    let resolvedOwnerType = parsed.ownerType;
    let resolvedOwnerId;
    if (auth.user.role === "TEACHER" /* TEACHER */) {
      if (!auth.user.linkedTeacherId) {
        throw ApiError.forbidden("Akun guru belum tertaut ke profil guru aktif.");
      }
      if (parsed.ownerId && parsed.ownerId !== auth.user.linkedTeacherId) {
        throw ApiError.forbidden("Anda tidak berhak mengunggah foto untuk akun lain.");
      }
      resolvedOwnerType = "TEACHER" /* TEACHER */;
      resolvedOwnerId = auth.user.linkedTeacherId;
    } else if (auth.user.role === "PRINCIPAL" /* PRINCIPAL */) {
      const principalProfile = await resolveTeacherProfileForUser(repo, auth.user);
      if (!principalProfile) {
        throw ApiError.forbidden(
          "Akun Kepala Sekolah belum tertaut ke profil pendidik aktif. Hubungi Admin untuk menautkan akun di Manajemen Pengguna."
        );
      }
      resolvedOwnerType = "TEACHER" /* TEACHER */;
      resolvedOwnerId = principalProfile.id;
    } else {
      resolvedOwnerId = parsed.ownerId ?? `portal_${auth.user.id}`;
    }
    if ((auth.user.role === "TEACHER" /* TEACHER */ || auth.user.role === "PRINCIPAL" /* PRINCIPAL */) && parsed.mimeType === "image/png") {
      throw ApiError.badRequest(
        "Absensi mandiri guru hanya menerima tangkapan kamera langsung (JPEG), tidak mendukung unggahan gambar PNG."
      );
    }
    const { buffer, mimeType } = parseAndValidateImageDataUrl(parsed.dataUrl, parsed.mimeType);
    const settings = await repo.collection("appSettings" /* APP_SETTINGS */).getById("default");
    const retentionDays = Math.max(1, settings?.photoRetentionDays ?? 90);
    const retentionUntil = new Date(
      Date.now() + retentionDays * 24 * 60 * 60 * 1e3
    ).toISOString();
    const fileId = `fil_${crypto12.randomBytes(8).toString("hex")}`;
    const storagePath = buildPrivateStoragePath(
      "ATTENDANCE_SELFIE" /* ATTENDANCE_SELFIE */,
      resolvedOwnerId,
      fileId,
      mimeType
    );
    putPrivateBlob(storagePath, buffer, mimeType);
    const dataBase64 = buffer.length <= 9e5 ? buffer.toString("base64") : null;
    const metadata = await repo.collection("fileMetadata" /* FILE_METADATA */).create({
      id: fileId,
      ownerType: resolvedOwnerType,
      ownerId: resolvedOwnerId,
      category: "ATTENDANCE_SELFIE" /* ATTENDANCE_SELFIE */,
      storagePath,
      mimeType,
      sizeBytes: buffer.length,
      retentionUntil,
      ...dataBase64 ? { dataBase64 } : {},
      createdBy: auth.user.id
    });
    const signed = createSignedFileUrl(metadata.id, 300);
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "SELFIE_UPLOADED",
      entityType: "FILE_METADATA",
      entityId: metadata.id,
      after: {
        ownerType: metadata.ownerType,
        ownerId: metadata.ownerId,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        retentionUntil: metadata.retentionUntil
      },
      clientIp: auth.clientIp
    });
    sendOk(
      res,
      {
        fileId: metadata.id,
        storagePath: metadata.storagePath,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        retentionUntil: metadata.retentionUntil,
        signedUrl: signed.url,
        signedUrlExpiresAt: signed.expiresAt
      },
      201
    );
  } catch (err) {
    sendError(res, err);
  }
}
async function handler41(req, res) {
  await handleUploadSelfie(req, res);
}

// backend/uploads/signed-url.ts
import { z as z14 } from "zod";
var signedUrlRequestSchema = z14.object({
  fileId: z14.string().trim().min(1).optional(),
  storagePath: z14.string().trim().min(1).optional()
}).refine((d) => Boolean(d.fileId || d.storagePath), {
  message: "Sertakan fileId atau storagePath."
});
async function handleSignedUrl(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo });
    const parsed = signedUrlRequestSchema.parse(req.body ?? {});
    const metaCol = repo.collection("fileMetadata" /* FILE_METADATA */);
    const meta = parsed.fileId ? await metaCol.getById(parsed.fileId) : await metaCol.findFirst([{ field: "storagePath", op: "==", value: parsed.storagePath }]);
    if (!meta) {
      throw ApiError.notFound("Berkas tidak ditemukan.");
    }
    if (!canUserAccessPrivateFile(auth.user, meta)) {
      throw ApiError.forbidden("Anda tidak berwenang mengakses foto bukti kehadiran ini.");
    }
    const signed = createSignedFileUrl(meta.id, 300);
    sendOk(res, {
      fileId: meta.id,
      mimeType: meta.mimeType,
      signedUrl: signed.url,
      expiresAt: signed.expiresAt
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler42(req, res) {
  await handleSignedUrl(req, res);
}

// backend/uploads/file.ts
async function handleServePrivateFile(req, res, repo = getRepository()) {
  try {
    if (req.method && req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus GET.");
    }
    const auth = await requireAuth(req, { repo });
    const fileId = getQueryString(req, "id");
    const exp = getQueryString(req, "exp");
    const sig = getQueryString(req, "sig");
    if (!fileId || !exp || !sig) {
      throw ApiError.badRequest("Parameter tautan sementara tidak lengkap.");
    }
    if (!verifySignedFileSignature(fileId, exp, sig)) {
      throw ApiError.forbidden("Tautan sementara tidak valid atau sudah kedaluwarsa.");
    }
    const meta = await repo.collection("fileMetadata" /* FILE_METADATA */).getById(fileId);
    if (!meta) {
      throw ApiError.notFound("Berkas tidak ditemukan.");
    }
    if (!canUserAccessPrivateFile(auth.user, meta)) {
      throw ApiError.forbidden("Anda tidak berwenang mengakses berkas ini.");
    }
    let blob = getPrivateBlob(meta.storagePath);
    if (!blob && meta.dataBase64) {
      blob = {
        buffer: Buffer.from(meta.dataBase64, "base64"),
        mimeType: meta.mimeType
      };
    }
    if (!blob) {
      throw ApiError.notFound("Isi berkas tidak lagi tersedia pada penyimpanan.");
    }
    res.setHeader?.("Content-Type", blob.mimeType);
    res.setHeader?.("Cache-Control", "private, no-store, max-age=0");
    res.setHeader?.("X-Content-Type-Options", "nosniff");
    res.status(200);
    if (res.send) {
      res.send(blob.buffer);
    } else if (res.end) {
      res.end(blob.buffer);
    } else {
      res.json({ ok: true, sizeBytes: blob.buffer.length });
    }
  } catch (err) {
    sendError(res, err);
  }
}
async function handler43(req, res) {
  await handleServePrivateFile(req, res);
}

// backend/locations/index.ts
async function handleSchoolLocations(req, res, repo = getRepository()) {
  try {
    const col = repo.collection("schoolLocations" /* SCHOOL_LOCATIONS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo });
      const [locRes, settings] = await Promise.all([
        col.list({ sort: { field: "createdAt", direction: "desc" } }),
        repo.collection("appSettings" /* APP_SETTINGS */).getById("default")
      ]);
      sendOk(res, {
        items: locRes.items,
        total: locRes.total,
        gpsSettings: {
          gpsEnabledForStudents: settings?.gpsEnabledForStudents ?? true,
          gpsEnabledForTeachers: settings?.gpsEnabledForTeachers ?? true,
          teacherSelfServiceEnabled: settings?.teacherSelfServiceEnabled ?? true
        }
      });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = schoolLocationCreateSchema.parse(req.body ?? {});
      if (parsed.isActive) {
        const existing = await col.list({
          filters: [{ field: "isActive", op: "==", value: true }]
        });
        await Promise.all(existing.items.map((loc) => col.update(loc.id, { isActive: false })));
      }
      const created = await col.create({
        name: parsed.name,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        radiusMeters: parsed.radiusMeters,
        maxGpsAccuracyMeters: parsed.maxGpsAccuracyMeters,
        isActive: parsed.isActive,
        createdBy: auth.user.id
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SCHOOL_LOCATION_CREATED",
        entityType: "SCHOOL_LOCATION",
        entityId: created.id,
        after: {
          name: created.name,
          latitude: created.latitude,
          longitude: created.longitude,
          radiusMeters: created.radiusMeters,
          maxGpsAccuracyMeters: created.maxGpsAccuracyMeters,
          isActive: created.isActive
        },
        clientIp: auth.clientIp
      });
      sendOk(res, created, 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler44(req, res) {
  await handleSchoolLocations(req, res);
}

// backend/locations/[id].ts
async function handleSchoolLocationById(req, res, idOverride, repo = getRepository()) {
  try {
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID lokasi sekolah wajib diisi.");
    const col = repo.collection("schoolLocations" /* SCHOOL_LOCATIONS */);
    if (req.method === "PATCH") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound("Lokasi sekolah tidak ditemukan.");
      const parsed = schoolLocationUpdateSchema.parse(req.body ?? {});
      if (parsed.isActive === true) {
        const others = await col.list({
          filters: [{ field: "isActive", op: "==", value: true }]
        });
        await Promise.all(
          others.items.filter((loc) => loc.id !== id).map((loc) => col.update(loc.id, { isActive: false }))
        );
      }
      const updated = await col.update(id, {
        ...parsed.name !== void 0 ? { name: parsed.name } : {},
        ...parsed.latitude !== void 0 ? { latitude: parsed.latitude } : {},
        ...parsed.longitude !== void 0 ? { longitude: parsed.longitude } : {},
        ...parsed.radiusMeters !== void 0 ? { radiusMeters: parsed.radiusMeters } : {},
        ...parsed.maxGpsAccuracyMeters !== void 0 ? { maxGpsAccuracyMeters: parsed.maxGpsAccuracyMeters } : {},
        ...parsed.isActive !== void 0 ? { isActive: parsed.isActive } : {}
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SCHOOL_LOCATION_UPDATED",
        entityType: "SCHOOL_LOCATION",
        entityId: id,
        before: {
          name: existing.name,
          latitude: existing.latitude,
          longitude: existing.longitude,
          radiusMeters: existing.radiusMeters,
          isActive: existing.isActive
        },
        after: {
          name: updated?.name,
          latitude: updated?.latitude,
          longitude: updated?.longitude,
          radiusMeters: updated?.radiusMeters,
          isActive: updated?.isActive
        },
        clientIp: auth.clientIp
      });
      sendOk(res, updated);
      return;
    }
    if (req.method === "DELETE") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound("Lokasi sekolah tidak ditemukan.");
      const archived = await col.update(id, { isActive: false });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SCHOOL_LOCATION_ARCHIVED",
        entityType: "SCHOOL_LOCATION",
        entityId: id,
        before: { isActive: existing.isActive },
        after: { isActive: false },
        clientIp: auth.clientIp
      });
      sendOk(res, { archived: true, location: archived });
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}

// backend/settings/gps.ts
async function handleGpsSettings(req, res, repo = getRepository()) {
  try {
    const col = repo.collection("appSettings" /* APP_SETTINGS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const settings = await col.getById("default");
      sendOk(res, {
        gpsEnabledForStudents: settings?.gpsEnabledForStudents ?? true,
        gpsEnabledForTeachers: settings?.gpsEnabledForTeachers ?? true,
        teacherSelfServiceEnabled: settings?.teacherSelfServiceEnabled ?? true,
        approvedPermissionAffectsRecap: settings?.approvedPermissionAffectsRecap ?? true
      });
      return;
    }
    if (req.method === "PATCH") {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById("default");
      if (!existing) throw ApiError.notFound("Pengaturan aplikasi belum tersedia.");
      const parsed = gpsSettingsUpdateSchema.parse(req.body ?? {});
      const updated = await col.update("default", {
        ...parsed.gpsEnabledForStudents !== void 0 ? { gpsEnabledForStudents: parsed.gpsEnabledForStudents } : {},
        ...parsed.gpsEnabledForTeachers !== void 0 ? { gpsEnabledForTeachers: parsed.gpsEnabledForTeachers } : {},
        ...parsed.teacherSelfServiceEnabled !== void 0 ? { teacherSelfServiceEnabled: parsed.teacherSelfServiceEnabled } : {},
        ...parsed.approvedPermissionAffectsRecap !== void 0 ? { approvedPermissionAffectsRecap: parsed.approvedPermissionAffectsRecap } : {}
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "GPS_SETTINGS_UPDATED",
        entityType: "APP_SETTINGS",
        entityId: "default",
        before: {
          gpsEnabledForStudents: existing.gpsEnabledForStudents,
          gpsEnabledForTeachers: existing.gpsEnabledForTeachers,
          teacherSelfServiceEnabled: existing.teacherSelfServiceEnabled,
          approvedPermissionAffectsRecap: existing.approvedPermissionAffectsRecap ?? true
        },
        after: {
          gpsEnabledForStudents: updated?.gpsEnabledForStudents,
          gpsEnabledForTeachers: updated?.gpsEnabledForTeachers,
          teacherSelfServiceEnabled: updated?.teacherSelfServiceEnabled,
          approvedPermissionAffectsRecap: updated?.approvedPermissionAffectsRecap ?? true
        },
        clientIp: auth.clientIp
      });
      sendOk(res, {
        gpsEnabledForStudents: updated?.gpsEnabledForStudents ?? true,
        gpsEnabledForTeachers: updated?.gpsEnabledForTeachers ?? true,
        teacherSelfServiceEnabled: updated?.teacherSelfServiceEnabled ?? true,
        approvedPermissionAffectsRecap: updated?.approvedPermissionAffectsRecap ?? true
      });
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler45(req, res) {
  await handleGpsSettings(req, res);
}

// backend/uploads/attachment.ts
import crypto13 from "node:crypto";
async function handleUploadPermissionAttachment(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, {
      repo,
      allowedRoles: ["TEACHER" /* TEACHER */, "PRINCIPAL" /* PRINCIPAL */]
    });
    if (!auth.user.linkedTeacherId) {
      throw ApiError.forbidden("Akun Anda belum tertaut ke profil guru aktif.");
    }
    const parsed = permissionAttachmentUploadSchema.parse(req.body ?? {});
    const { buffer, mimeType } = parseAndValidateAttachmentDataUrl(
      parsed.dataUrl,
      parsed.mimeType
    );
    const settings = await repo.collection("appSettings" /* APP_SETTINGS */).getById("default");
    const retentionDays = Math.max(30, settings?.photoRetentionDays ?? 90);
    const retentionUntil = new Date(
      Date.now() + retentionDays * 24 * 60 * 60 * 1e3
    ).toISOString();
    const fileId = `attf_${crypto13.randomBytes(8).toString("hex")}`;
    const storagePath = buildPrivateStoragePath(
      "PERMISSION_ATTACHMENT" /* PERMISSION_ATTACHMENT */,
      auth.user.linkedTeacherId,
      fileId,
      mimeType
    );
    putPrivateBlob(storagePath, buffer, mimeType);
    const metadata = await repo.collection("fileMetadata" /* FILE_METADATA */).create({
      id: fileId,
      ownerType: "TEACHER" /* TEACHER */,
      ownerId: auth.user.linkedTeacherId,
      category: "PERMISSION_ATTACHMENT" /* PERMISSION_ATTACHMENT */,
      storagePath,
      mimeType,
      sizeBytes: buffer.length,
      retentionUntil,
      createdBy: auth.user.id
    });
    const signed = createSignedFileUrl(metadata.id, 300);
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "PERMISSION_ATTACHMENT_UPLOADED",
      entityType: "FILE_METADATA",
      entityId: metadata.id,
      after: {
        ownerId: metadata.ownerId,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes
      },
      clientIp: auth.clientIp
    });
    sendOk(
      res,
      {
        fileId: metadata.id,
        storagePath: metadata.storagePath,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        signedUrl: signed.url,
        signedUrlExpiresAt: signed.expiresAt
      },
      201
    );
  } catch (err) {
    sendError(res, err);
  }
}
async function handler46(req, res) {
  await handleUploadPermissionAttachment(req, res);
}

// backend/permissions/index.ts
async function enrichPermissionsWithActors(repo, items) {
  if (items.length === 0) return [];
  const [usersRes, teachersRes] = await Promise.all([
    repo.collection("users" /* USERS */).list(),
    repo.collection("teachers" /* TEACHERS */).list()
  ]);
  const teacherNameMap = new Map(teachersRes.items.map((t) => [t.id, t.fullName]));
  const userNameMap = new Map(
    usersRes.items.map((u) => [
      u.id,
      (u.linkedTeacherId ? teacherNameMap.get(u.linkedTeacherId) : void 0) ?? u.username
    ])
  );
  return items.map((item) => ({
    ...item,
    adminReviewerName: item.adminReview.reviewerId ? userNameMap.get(item.adminReview.reviewerId) ?? "Admin Madrasah" : null,
    principalReviewerName: item.principalDecision.reviewerId ? userNameMap.get(item.principalDecision.reviewerId) ?? "Kepala Sekolah" : null
  }));
}
async function handlePermissions(req, res, repo = getRepository()) {
  try {
    const permCol = repo.collection("teacherPermissions" /* TEACHER_PERMISSIONS */);
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const status = getQueryString(req, "status");
      const leaveType = getQueryString(req, "leaveType");
      const teacherId = getQueryString(req, "teacherId");
      const search = getQueryString(req, "search").toLowerCase();
      const cursor = getQueryString(req, "cursor");
      const limit = getQueryInt(req, "limit", 20, 1, 1e3);
      const allRes = await permCol.list({ sort: { field: "createdAt", direction: "desc" } });
      const all = allRes.items;
      const counts = {
        total: all.length,
        pendingAdmin: all.filter((p) => p.status === "SUBMITTED" /* SUBMITTED */).length,
        pendingPrincipal: all.filter((p) => p.status === "ADMIN_REVIEWED" /* ADMIN_REVIEWED */).length,
        returned: all.filter((p) => p.status === "RETURNED" /* RETURNED */).length,
        approved: all.filter((p) => p.status === "APPROVED" /* APPROVED */).length,
        rejected: all.filter((p) => p.status === "REJECTED" /* REJECTED */).length,
        cancelled: all.filter((p) => p.status === "CANCELLED" /* CANCELLED */).length
      };
      const filtered = all.filter((p) => {
        if (status && p.status !== status) return false;
        if (leaveType && p.leaveType !== leaveType) return false;
        if (teacherId && p.teacherId !== teacherId) return false;
        if (search) {
          const hay = `${p.teacherNameSnapshot} ${p.reason} ${p.leaveType}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });
      let startIdx = 0;
      if (cursor) {
        const idx = filtered.findIndex((p) => p.id === cursor);
        if (idx >= 0) startIdx = idx + 1;
      }
      const pageItems = filtered.slice(startIdx, startIdx + limit);
      const hasMore = startIdx + pageItems.length < filtered.length;
      const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;
      const enriched = await enrichPermissionsWithActors(repo, pageItems);
      sendOk(res, {
        items: enriched,
        total: filtered.length,
        nextCursor,
        counts
      });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, {
        repo,
        allowedRoles: ["TEACHER" /* TEACHER */, "PRINCIPAL" /* PRINCIPAL */]
      });
      if (!auth.user.linkedTeacherId) {
        throw ApiError.forbidden("Akun Anda belum tertaut ke profil guru aktif.");
      }
      const teacher = await repo.collection("teachers" /* TEACHERS */).getById(auth.user.linkedTeacherId);
      if (!teacher || teacher.status !== "ACTIVE" /* ACTIVE */) {
        throw ApiError.forbidden("Profil guru tidak aktif. Hubungi Admin Madrasah.");
      }
      const parsed = permissionCreateSchema.parse(req.body ?? {});
      const attachmentPaths = [];
      if (parsed.attachmentFileIds.length > 0) {
        const fileCol = repo.collection("fileMetadata" /* FILE_METADATA */);
        for (const fileId of parsed.attachmentFileIds) {
          const meta = await fileCol.getById(fileId);
          if (!meta || meta.category !== "PERMISSION_ATTACHMENT" /* PERMISSION_ATTACHMENT */ || meta.ownerType !== "TEACHER" /* TEACHER */ || meta.ownerId !== teacher.id) {
            throw ApiError.forbidden(
              "Lampiran tidak ditemukan atau bukan milik akun Anda."
            );
          }
          attachmentPaths.push(meta.storagePath);
        }
      }
      const created = await permCol.create({
        teacherId: teacher.id,
        teacherNameSnapshot: teacher.fullName,
        leaveType: parsed.leaveType,
        startAt: new Date(parsed.startAt).toISOString(),
        endAt: new Date(parsed.endAt).toISOString(),
        reason: parsed.reason,
        attachmentPaths,
        status: "SUBMITTED" /* SUBMITTED */,
        adminReview: {
          reviewerId: null,
          decision: null,
          note: null,
          reviewedAt: null
        },
        principalDecision: {
          reviewerId: null,
          decision: null,
          note: null,
          decidedAt: null
        },
        createdBy: auth.user.id
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "PERMISSION_SUBMITTED",
        entityType: "TEACHER_PERMISSION",
        entityId: created.id,
        after: {
          teacherId: teacher.id,
          leaveType: created.leaveType,
          startAt: created.startAt,
          endAt: created.endAt,
          status: created.status,
          attachmentCount: attachmentPaths.length
        },
        clientIp: auth.clientIp
      });
      sendOk(res, created, 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler47(req, res) {
  await handlePermissions(req, res);
}

// backend/permissions/me.ts
async function handleMyPermissions(req, res, repo = getRepository()) {
  try {
    if (req.method && req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus GET.");
    }
    const auth = await requireAuth(req, {
      repo,
      allowedRoles: ["TEACHER" /* TEACHER */, "PRINCIPAL" /* PRINCIPAL */]
    });
    if (!auth.user.linkedTeacherId) {
      sendOk(res, {
        items: [],
        total: 0,
        nextCursor: null,
        counts: { total: 0, active: 0, approved: 0, rejected: 0, returned: 0 }
      });
      return;
    }
    const status = getQueryString(req, "status");
    const cursor = getQueryString(req, "cursor");
    const limit = getQueryInt(req, "limit", 20, 1, 1e3);
    const allMineRes = await repo.collection("teacherPermissions" /* TEACHER_PERMISSIONS */).list({
      filters: [{ field: "teacherId", op: "==", value: auth.user.linkedTeacherId }],
      sort: { field: "createdAt", direction: "desc" }
    });
    const allMine = allMineRes.items;
    const counts = {
      total: allMine.length,
      active: allMine.filter(
        (p) => p.status === "SUBMITTED" /* SUBMITTED */ || p.status === "ADMIN_REVIEWED" /* ADMIN_REVIEWED */ || p.status === "RETURNED" /* RETURNED */
      ).length,
      approved: allMine.filter((p) => p.status === "APPROVED" /* APPROVED */).length,
      rejected: allMine.filter((p) => p.status === "REJECTED" /* REJECTED */).length,
      returned: allMine.filter((p) => p.status === "RETURNED" /* RETURNED */).length
    };
    const filtered = status ? allMine.filter((p) => p.status === status) : allMine;
    let startIdx = 0;
    if (cursor) {
      const idx = filtered.findIndex((p) => p.id === cursor);
      if (idx >= 0) startIdx = idx + 1;
    }
    const pageItems = filtered.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + pageItems.length < filtered.length;
    const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;
    const enriched = await enrichPermissionsWithActors(repo, pageItems);
    sendOk(res, {
      items: enriched,
      total: filtered.length,
      nextCursor,
      counts
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler48(req, res) {
  await handleMyPermissions(req, res);
}

// backend/permissions/[id]/admin-review.ts
async function handlePermissionAdminReview(req, res, idOverride, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID pengajuan izin wajib diisi.");
    const col = repo.collection("teacherPermissions" /* TEACHER_PERMISSIONS */);
    const existing = await col.getById(id);
    if (!existing) {
      throw ApiError.notFound("Pengajuan izin tidak ditemukan.");
    }
    const parsed = permissionAdminReviewSchema.parse(req.body ?? {});
    const targetStatus = parsed.decision === "RECOMMEND_APPROVE" /* RECOMMEND_APPROVE */ ? "ADMIN_REVIEWED" /* ADMIN_REVIEWED */ : "RETURNED" /* RETURNED */;
    const transition = validatePermissionTransition(existing.status, targetStatus);
    if (!transition.allowed) {
      throw ApiError.conflict(transition.reason ?? "Transisi status izin tidak diizinkan.");
    }
    const reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
    const updated = await col.update(id, {
      status: targetStatus,
      adminReview: {
        reviewerId: auth.user.id,
        decision: parsed.decision,
        note: parsed.note || null,
        reviewedAt
      }
    });
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: targetStatus === "ADMIN_REVIEWED" /* ADMIN_REVIEWED */ ? "PERMISSION_ADMIN_RECOMMENDED" : "PERMISSION_ADMIN_RETURNED",
      entityType: "TEACHER_PERMISSION",
      entityId: id,
      before: { status: existing.status },
      after: {
        status: targetStatus,
        decision: parsed.decision,
        reviewedAt
      },
      reason: parsed.note || null,
      clientIp: auth.clientIp
    });
    sendOk(res, updated);
  } catch (err) {
    sendError(res, err);
  }
}

// backend/permissions/[id]/decision.ts
async function handlePermissionPrincipalDecision(req, res, idOverride, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: ["PRINCIPAL" /* PRINCIPAL */] });
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID pengajuan izin wajib diisi.");
    const col = repo.collection("teacherPermissions" /* TEACHER_PERMISSIONS */);
    const existing = await col.getById(id);
    if (!existing) {
      throw ApiError.notFound("Pengajuan izin tidak ditemukan.");
    }
    const parsed = permissionPrincipalDecisionSchema.parse(req.body ?? {});
    const targetStatus = parsed.decision === "APPROVE" /* APPROVE */ ? "APPROVED" /* APPROVED */ : "REJECTED" /* REJECTED */;
    const transition = validatePermissionTransition(existing.status, targetStatus);
    if (!transition.allowed) {
      throw new ApiError(
        409,
        "WORKFLOW_ORDER_VIOLATION",
        transition.reason ?? "Kepala Sekolah tidak dapat memutuskan sebelum pengajuan diverifikasi oleh Admin."
      );
    }
    const decidedAt = (/* @__PURE__ */ new Date()).toISOString();
    const updated = await col.update(id, {
      status: targetStatus,
      principalDecision: {
        reviewerId: auth.user.id,
        decision: parsed.decision,
        note: parsed.note || null,
        decidedAt
      }
    });
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: targetStatus === "APPROVED" /* APPROVED */ ? "PERMISSION_PRINCIPAL_APPROVED" : "PERMISSION_PRINCIPAL_REJECTED",
      entityType: "TEACHER_PERMISSION",
      entityId: id,
      before: { status: existing.status },
      after: {
        status: targetStatus,
        decision: parsed.decision,
        decidedAt
      },
      reason: parsed.note || null,
      clientIp: auth.clientIp
    });
    sendOk(res, updated);
  } catch (err) {
    sendError(res, err);
  }
}

// backend/permissions/[id]/cancel.ts
async function handlePermissionCancel(req, res, idOverride, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, {
      repo,
      allowedRoles: ["TEACHER" /* TEACHER */, "PRINCIPAL" /* PRINCIPAL */]
    });
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID pengajuan izin wajib diisi.");
    const col = repo.collection("teacherPermissions" /* TEACHER_PERMISSIONS */);
    const existing = await col.getById(id);
    if (!existing) {
      throw ApiError.notFound("Pengajuan izin tidak ditemukan.");
    }
    if (!auth.user.linkedTeacherId || existing.teacherId !== auth.user.linkedTeacherId) {
      throw ApiError.forbidden("Anda tidak berwenang membatalkan pengajuan izin milik guru lain.");
    }
    const parsed = permissionCancelSchema.parse(req.body ?? {});
    const transition = validatePermissionTransition(existing.status, "CANCELLED" /* CANCELLED */);
    if (!transition.allowed) {
      throw ApiError.conflict(transition.reason ?? "Pengajuan izin yang sudah diputuskan tidak dapat dibatalkan.");
    }
    const updated = await col.update(id, {
      status: "CANCELLED" /* CANCELLED */
    });
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "PERMISSION_CANCELLED",
      entityType: "TEACHER_PERMISSION",
      entityId: id,
      before: { status: existing.status },
      after: { status: "CANCELLED" /* CANCELLED */ },
      reason: parsed.reason || "Dibatalkan oleh guru pengaju",
      clientIp: auth.clientIp
    });
    sendOk(res, updated);
  } catch (err) {
    sendError(res, err);
  }
}
async function handlePermissionById(req, res, idOverride, repo = getRepository()) {
  try {
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID pengajuan izin wajib diisi.");
    const col = repo.collection("teacherPermissions" /* TEACHER_PERMISSIONS */);
    if (req.method === "GET") {
      const auth = await requireAuth(req, { repo });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound("Pengajuan izin tidak ditemukan.");
      if (auth.user.role === "TEACHER" /* TEACHER */ && existing.teacherId !== auth.user.linkedTeacherId) {
        throw ApiError.forbidden("Anda tidak berwenang melihat pengajuan izin guru lain.");
      }
      sendOk(res, existing);
      return;
    }
    if (req.method === "PATCH") {
      const auth = await requireAuth(req, {
        repo,
        allowedRoles: ["TEACHER" /* TEACHER */, "PRINCIPAL" /* PRINCIPAL */]
      });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound("Pengajuan izin tidak ditemukan.");
      if (!auth.user.linkedTeacherId || existing.teacherId !== auth.user.linkedTeacherId) {
        throw ApiError.forbidden("Anda tidak berwenang mengubah pengajuan izin guru lain.");
      }
      const transition = validatePermissionTransition(existing.status, "SUBMITTED" /* SUBMITTED */);
      if (!transition.allowed) {
        throw ApiError.conflict(
          "Hanya pengajuan izin yang dikembalikan Admin (RETURNED) yang dapat diperbaiki dan diajukan ulang."
        );
      }
      const parsed = permissionCreateSchema.parse(req.body ?? {});
      const attachmentPaths = [...existing.attachmentPaths];
      if (parsed.attachmentFileIds.length > 0) {
        const fileCol = repo.collection("fileMetadata" /* FILE_METADATA */);
        for (const fileId of parsed.attachmentFileIds) {
          const meta = await fileCol.getById(fileId);
          if (!meta || meta.category !== "PERMISSION_ATTACHMENT" /* PERMISSION_ATTACHMENT */ || meta.ownerType !== "TEACHER" /* TEACHER */ || meta.ownerId !== auth.user.linkedTeacherId) {
            throw ApiError.forbidden("Lampiran tidak ditemukan atau bukan milik akun Anda.");
          }
          if (!attachmentPaths.includes(meta.storagePath)) {
            attachmentPaths.push(meta.storagePath);
          }
        }
      }
      const updated = await col.update(id, {
        leaveType: parsed.leaveType,
        startAt: new Date(parsed.startAt).toISOString(),
        endAt: new Date(parsed.endAt).toISOString(),
        reason: parsed.reason,
        attachmentPaths,
        status: "SUBMITTED" /* SUBMITTED */
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "PERMISSION_RESUBMITTED",
        entityType: "TEACHER_PERMISSION",
        entityId: id,
        before: { status: existing.status },
        after: { status: "SUBMITTED" /* SUBMITTED */, leaveType: parsed.leaveType },
        clientIp: auth.clientIp
      });
      sendOk(res, updated);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}

// backend/_lib/reports/attendanceReportService.ts
function shiftDateKey(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function enumerateDateKeys(dateFrom, dateTo, maxDays = 370) {
  if (dateTo < dateFrom) return [];
  const result = [];
  let cursor = dateFrom;
  while (cursor <= dateTo && result.length < maxDays) {
    result.push(cursor);
    cursor = shiftDateKey(cursor, 1);
  }
  return result;
}
function resolveReportDateRange(params) {
  const todayKey = getDateKeyJakarta(params.now ?? /* @__PURE__ */ new Date());
  const ref = params.referenceDate ?? todayKey;
  if (params.period === "custom" && params.dateFrom && params.dateTo) {
    return params.dateFrom <= params.dateTo ? { dateFrom: params.dateFrom, dateTo: params.dateTo } : { dateFrom: params.dateTo, dateTo: params.dateFrom };
  }
  if (params.period === "daily") {
    return { dateFrom: ref, dateTo: ref };
  }
  if (params.period === "weekly") {
    const dow = getDayOfWeekJakarta(/* @__PURE__ */ new Date(`${ref}T12:00:00+07:00`));
    const monday = shiftDateKey(ref, -(dow - 1));
    const sunday = shiftDateKey(monday, 6);
    return { dateFrom: monday, dateTo: sunday > todayKey ? todayKey : sunday };
  }
  if (params.period === "yearly") {
    const year2 = ref.slice(0, 4);
    const start2 = `${year2}-01-01`;
    const end2 = `${year2}-12-31`;
    return { dateFrom: start2, dateTo: end2 > todayKey ? todayKey : end2 };
  }
  const [yStr, mStr] = ref.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const start = `${yStr}-${mStr}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}`;
  return { dateFrom: start, dateTo: end > todayKey ? todayKey : end };
}
function getActiveDaysOfWeek(rules, audience) {
  const active = rules.filter((r) => r.isActive && r.audience === audience && r.classIds.length === 0).sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0];
  if (active && active.daysOfWeek.length > 0) {
    return new Set(active.daysOfWeek);
  }
  return /* @__PURE__ */ new Set([1, 2, 3, 4, 5, 6]);
}
function isHolidayForAudience(dateKey, audience, holidays) {
  return holidays.some((h) => {
    if (!h.isActive || h.date !== dateKey) return false;
    if (h.scope === "SCHOOL" /* SCHOOL */) return true;
    if (audience === "STUDENT" /* STUDENT */ && h.scope === "STUDENT" /* STUDENT */) return true;
    if (audience === "TEACHER" /* TEACHER */ && h.scope === "TEACHER" /* TEACHER */) return true;
    return false;
  });
}
function getWorkingDatesForAudience(allDates, audience, rules, holidays) {
  const activeDays = getActiveDaysOfWeek(rules, audience);
  return allDates.filter((dateKey) => {
    const dow = getDayOfWeekJakarta(/* @__PURE__ */ new Date(`${dateKey}T12:00:00+07:00`));
    if (!activeDays.has(dow)) return false;
    if (isHolidayForAudience(dateKey, audience, holidays)) return false;
    return true;
  });
}
function findApprovedPermissionStatusForDate(teacherId, dateKey, approvedPermissions) {
  for (const perm of approvedPermissions) {
    if (perm.teacherId !== teacherId) continue;
    const startKey = getDateKeyJakarta(perm.startAt);
    const endKey = getDateKeyJakarta(perm.endAt);
    if (dateKey >= startKey && dateKey <= endKey) {
      return perm.leaveType === "SICK" /* SICK */ ? "SICK" /* SICK */ : "EXCUSED" /* EXCUSED */;
    }
  }
  return null;
}
async function buildAttendanceReport(repo, options) {
  const now = options.now ?? /* @__PURE__ */ new Date();
  const { dateFrom, dateTo } = resolveReportDateRange({
    period: options.period,
    referenceDate: options.referenceDate,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    now
  });
  const [
    settings,
    studentsRes,
    teachersRes,
    classesRes,
    rulesRes,
    holidaysRes,
    recordsRes,
    permissionsRes
  ] = await Promise.all([
    repo.collection("appSettings" /* APP_SETTINGS */).getById("default"),
    repo.collection("students" /* STUDENTS */).list(),
    repo.collection("teachers" /* TEACHERS */).list(),
    repo.collection("classes" /* CLASSES */).list(),
    repo.collection("attendanceRules" /* ATTENDANCE_RULES */).list(),
    repo.collection("holidays" /* HOLIDAYS */).list(),
    repo.collection("attendanceRecords" /* ATTENDANCE_RECORDS */).list(),
    repo.collection("teacherPermissions" /* TEACHER_PERMISSIONS */).list({
      filters: [{ field: "status", op: "==", value: "APPROVED" /* APPROVED */ }]
    })
  ]);
  const schoolName = settings?.schoolName ?? "MI Miftahul Ulum Sumberwuluh";
  const approvedPermissionAffectsRecap = settings?.approvedPermissionAffectsRecap !== false;
  const classMap = new Map(classesRes.items.map((c) => [c.id, c]));
  const allDates = enumerateDateKeys(dateFrom, dateTo);
  const studentWorkingDates = getWorkingDatesForAudience(
    allDates,
    "STUDENT" /* STUDENT */,
    rulesRes.items,
    holidaysRes.items
  );
  const teacherWorkingDates = getWorkingDatesForAudience(
    allDates,
    "TEACHER" /* TEACHER */,
    rulesRes.items,
    holidaysRes.items
  );
  const activeTeacherRule = rulesRes.items.filter((r) => r.isActive && r.audience === "TEACHER" /* TEACHER */ && r.classIds.length === 0).sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0] ?? rulesRes.items.filter((r) => r.isActive && r.audience === "TEACHER" /* TEACHER */).sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0] ?? null;
  const recordsInRange = recordsRes.items.filter(
    (r) => r.attendanceDate >= dateFrom && r.attendanceDate <= dateTo
  );
  const recordIndex = /* @__PURE__ */ new Map();
  for (const r of recordsInRange) {
    recordIndex.set(`${r.personType}:${r.personId}:${r.attendanceDate}:${r.eventType}`, r);
  }
  const effectiveDimension = options.restrictToTeacherId ? "TEACHER" : options.dimension;
  const activeStudents = effectiveDimension === "TEACHER" ? [] : studentsRes.items.filter((s) => {
    if (s.status !== "ACTIVE" /* ACTIVE */ && s.status !== "DEMO_ACTIVE" /* DEMO_ACTIVE */) {
      return false;
    }
    if (options.classId && s.classId !== options.classId) return false;
    return true;
  });
  const activeTeachers = effectiveDimension === "STUDENT" ? [] : teachersRes.items.filter((t) => {
    if (t.status !== "ACTIVE" /* ACTIVE */) return false;
    if (options.restrictToTeacherId && t.id !== options.restrictToTeacherId) return false;
    return true;
  });
  const trendMap = /* @__PURE__ */ new Map();
  for (const d of allDates) {
    trendMap.set(d, {
      date: d,
      label: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
      present: 0,
      late: 0,
      excusedSick: 0,
      absent: 0,
      totalExpected: 0
    });
  }
  const classBuckets = /* @__PURE__ */ new Map();
  for (const cls of classesRes.items.filter((c) => c.isActive)) {
    classBuckets.set(cls.id, {
      id: cls.id,
      classId: cls.id,
      className: cls.name,
      gradeLevel: Number(cls.gradeLevel) || 0,
      totalStudents: 0,
      present: 0,
      late: 0,
      excusedSick: 0,
      absent: 0,
      missingCheckIn: 0,
      missingCheckOut: 0,
      attendanceRate: 0
    });
  }
  const personRows = [];
  for (const student of activeStudents) {
    const cls = classMap.get(student.classId);
    const bucket = classBuckets.get(student.classId);
    if (bucket) bucket.totalStudents += 1;
    let present = 0;
    let late = 0;
    let sick = 0;
    let excused = 0;
    let absent = 0;
    let missingCheckIn = 0;
    let missingCheckOut = 0;
    for (const dateKey of studentWorkingDates) {
      const checkIn = recordIndex.get(
        `${"STUDENT" /* STUDENT */}:${student.id}:${dateKey}:${"CHECK_IN" /* CHECK_IN */}`
      );
      const checkOut = recordIndex.get(
        `${"STUDENT" /* STUDENT */}:${student.id}:${dateKey}:${"CHECK_OUT" /* CHECK_OUT */}`
      );
      const tPoint = trendMap.get(dateKey);
      if (tPoint) tPoint.totalExpected += 1;
      if (checkIn) {
        if (checkIn.status === "PRESENT" /* PRESENT */) {
          present += 1;
          if (tPoint) tPoint.present += 1;
          if (bucket) bucket.present += 1;
        } else if (checkIn.status === "LATE" /* LATE */) {
          late += 1;
          if (tPoint) tPoint.late += 1;
          if (bucket) bucket.late += 1;
        } else if (checkIn.status === "SICK" /* SICK */) {
          sick += 1;
          if (tPoint) tPoint.excusedSick += 1;
          if (bucket) bucket.excusedSick += 1;
        } else if (checkIn.status === "EXCUSED" /* EXCUSED */) {
          excused += 1;
          if (tPoint) tPoint.excusedSick += 1;
          if (bucket) bucket.excusedSick += 1;
        } else {
          absent += 1;
          if (tPoint) tPoint.absent += 1;
          if (bucket) bucket.absent += 1;
        }
        if ((checkIn.status === "PRESENT" /* PRESENT */ || checkIn.status === "LATE" /* LATE */) && !checkOut) {
          missingCheckOut += 1;
          if (bucket) bucket.missingCheckOut += 1;
        }
      } else {
        missingCheckIn += 1;
        absent += 1;
        if (tPoint) tPoint.absent += 1;
        if (bucket) {
          bucket.missingCheckIn += 1;
          bucket.absent += 1;
        }
      }
    }
    const wd = studentWorkingDates.length;
    const attended = present + late;
    const rate = wd > 0 ? Math.round(attended / wd * 100) : 0;
    personRows.push({
      id: `STUDENT_${student.id}`,
      personType: "STUDENT" /* STUDENT */,
      personId: student.id,
      fullName: student.fullName,
      identifier: student.nis,
      classId: student.classId,
      className: cls?.name ?? null,
      workingDays: wd,
      present,
      late,
      sick,
      excused,
      absent,
      hlt: 0,
      missingCheckIn,
      missingCheckOut,
      attendanceRate: rate
    });
  }
  for (const teacher of activeTeachers) {
    const teacherWorkingSet = new Set(resolveTeacherWorkingDays(teacher, activeTeacherRule));
    let teacherExpectedDays = 0;
    let present = 0;
    let late = 0;
    let sick = 0;
    let excused = 0;
    let absent = 0;
    let hlt = 0;
    let missingCheckIn = 0;
    let missingCheckOut = 0;
    for (const dateKey of teacherWorkingDates) {
      const dow = getDayOfWeekJakarta(/* @__PURE__ */ new Date(`${dateKey}T12:00:00+07:00`));
      const isRequiredDay = teacherWorkingSet.has(dow);
      const checkIn = recordIndex.get(
        `${"TEACHER" /* TEACHER */}:${teacher.id}:${dateKey}:${"CHECK_IN" /* CHECK_IN */}`
      );
      const checkOut = recordIndex.get(
        `${"TEACHER" /* TEACHER */}:${teacher.id}:${dateKey}:${"CHECK_OUT" /* CHECK_OUT */}`
      );
      const tPoint = trendMap.get(dateKey);
      if (!isRequiredDay) {
        if (!checkIn) {
          hlt += 1;
          continue;
        }
        teacherExpectedDays += 1;
        if (tPoint) tPoint.totalExpected += 1;
      } else {
        teacherExpectedDays += 1;
        if (tPoint) tPoint.totalExpected += 1;
      }
      if (checkIn) {
        if (checkIn.status === "PRESENT" /* PRESENT */) {
          present += 1;
          if (tPoint) tPoint.present += 1;
        } else if (checkIn.status === "LATE" /* LATE */) {
          late += 1;
          if (tPoint) tPoint.late += 1;
        } else if (checkIn.status === "SICK" /* SICK */) {
          sick += 1;
          if (tPoint) tPoint.excusedSick += 1;
        } else if (checkIn.status === "EXCUSED" /* EXCUSED */) {
          excused += 1;
          if (tPoint) tPoint.excusedSick += 1;
        } else {
          absent += 1;
          if (tPoint) tPoint.absent += 1;
        }
        if ((checkIn.status === "PRESENT" /* PRESENT */ || checkIn.status === "LATE" /* LATE */) && !checkOut) {
          missingCheckOut += 1;
        }
      } else {
        const permStatus = approvedPermissionAffectsRecap ? findApprovedPermissionStatusForDate(teacher.id, dateKey, permissionsRes.items) : null;
        if (permStatus === "SICK" /* SICK */) {
          sick += 1;
          if (tPoint) tPoint.excusedSick += 1;
        } else if (permStatus === "EXCUSED" /* EXCUSED */) {
          excused += 1;
          if (tPoint) tPoint.excusedSick += 1;
        } else {
          missingCheckIn += 1;
          absent += 1;
          if (tPoint) tPoint.absent += 1;
        }
      }
    }
    const wd = teacherExpectedDays;
    const attended = present + late;
    const rate = wd > 0 ? Math.round(attended / wd * 100) : 0;
    personRows.push({
      id: `TEACHER_${teacher.id}`,
      personType: "TEACHER" /* TEACHER */,
      personId: teacher.id,
      fullName: teacher.fullName,
      identifier: teacher.niyNip,
      classId: null,
      className: teacher.position,
      workingDays: wd,
      present,
      late,
      sick,
      excused,
      absent,
      hlt,
      missingCheckIn,
      missingCheckOut,
      attendanceRate: rate
    });
  }
  const q = (options.search ?? "").trim().toLowerCase();
  const statusFilter = options.status ?? "";
  const filteredRows = personRows.filter((row) => {
    if (q) {
      const hay = `${row.fullName} ${row.identifier} ${row.className ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statusFilter === "PRESENT" /* PRESENT */ && row.present === 0) return false;
    if (statusFilter === "LATE" /* LATE */ && row.late === 0) return false;
    if (statusFilter === "SICK" /* SICK */ && row.sick === 0) return false;
    if (statusFilter === "EXCUSED" /* EXCUSED */ && row.excused === 0) return false;
    if (statusFilter === "ABSENT" /* ABSENT */ && row.absent === 0) return false;
    if (statusFilter === "MISSING_CHECK_IN" && row.missingCheckIn === 0) return false;
    if (statusFilter === "MISSING_CHECK_OUT" && row.missingCheckOut === 0) return false;
    return true;
  }).sort((a, b) => a.fullName.localeCompare(b.fullName, "id"));
  const summary = filteredRows.reduce(
    (acc, r) => {
      acc.totalPeople += 1;
      acc.totalWorkingPersonDays += r.workingDays;
      acc.present += r.present;
      acc.late += r.late;
      acc.sick += r.sick;
      acc.excused += r.excused;
      acc.absent += r.absent;
      acc.hlt += r.hlt;
      acc.missingCheckIn += r.missingCheckIn;
      acc.missingCheckOut += r.missingCheckOut;
      return acc;
    },
    {
      totalPeople: 0,
      totalWorkingPersonDays: 0,
      present: 0,
      late: 0,
      sick: 0,
      excused: 0,
      absent: 0,
      hlt: 0,
      missingCheckIn: 0,
      missingCheckOut: 0,
      attendanceRate: 0
    }
  );
  summary.attendanceRate = summary.totalWorkingPersonDays > 0 ? Math.round((summary.present + summary.late) / summary.totalWorkingPersonDays * 100) : 0;
  const classBreakdown = Array.from(classBuckets.values()).filter((c) => !options.classId || c.classId === options.classId).map((c) => {
    const denom = c.totalStudents * studentWorkingDates.length;
    return {
      ...c,
      attendanceRate: denom > 0 ? Math.round((c.present + c.late) / denom * 100) : 0
    };
  }).sort((a, b) => a.gradeLevel - b.gradeLevel || a.className.localeCompare(b.className, "id"));
  let pageItems = filteredRows;
  let nextCursor = null;
  if (!options.unbounded) {
    const limit = options.limit ?? 25;
    let startIdx = 0;
    if (options.cursor) {
      const idx = filteredRows.findIndex((r) => r.id === options.cursor);
      if (idx >= 0) startIdx = idx + 1;
    }
    pageItems = filteredRows.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + pageItems.length < filteredRows.length;
    nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;
  }
  const trend = Array.from(trendMap.values()).filter((p) => p.totalExpected > 0 || allDates.length <= 14);
  const workingDaysCount = effectiveDimension === "TEACHER" ? teacherWorkingDates.length : studentWorkingDates.length;
  return {
    schoolName,
    generatedAt: now.toISOString(),
    period: options.period,
    dateFrom,
    dateTo,
    dimension: effectiveDimension,
    workingDaysCount,
    approvedPermissionAffectsRecap,
    appliedFilters: {
      period: options.period,
      dateFrom,
      dateTo,
      dimension: effectiveDimension,
      classId: options.classId || null,
      status: statusFilter || null,
      search: options.search || null
    },
    summary,
    trend,
    classBreakdown,
    items: pageItems,
    total: filteredRows.length,
    nextCursor
  };
}

// backend/dashboard/summary.ts
async function handleDashboardSummary(req, res, repo = getRepository(), options = {}) {
  try {
    if (req.method && req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus GET.");
    }
    await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
    const now = options.now ?? /* @__PURE__ */ new Date();
    const selectedDate = getQueryString(req, "date") || getDateKeyJakarta(now);
    const classId = getQueryString(req, "classId") || void 0;
    const dimensionParam = getQueryString(req, "dimension") || "ALL";
    const dimension = dimensionParam === "STUDENT" || dimensionParam === "TEACHER" ? dimensionParam : "ALL";
    const status = getQueryString(req, "status") || "";
    const [
      settings,
      studentsRes,
      teachersRes,
      classesRes,
      permissionsRes,
      logsRes,
      usersRes,
      dailyReport,
      trendReport
    ] = await Promise.all([
      repo.collection("appSettings" /* APP_SETTINGS */).getById("default"),
      repo.collection("students" /* STUDENTS */).list(),
      repo.collection("teachers" /* TEACHERS */).list(),
      repo.collection("classes" /* CLASSES */).list(),
      repo.collection("teacherPermissions" /* TEACHER_PERMISSIONS */).list({
        sort: { field: "createdAt", direction: "desc" }
      }),
      repo.collection("activityLogs" /* ACTIVITY_LOGS */).list({
        sort: { field: "createdAt", direction: "desc" },
        limit: 12
      }),
      repo.collection("users" /* USERS */).list(),
      buildAttendanceReport(repo, {
        period: "daily",
        referenceDate: selectedDate,
        dimension,
        classId,
        status,
        unbounded: true,
        now
      }),
      buildAttendanceReport(repo, {
        period: "custom",
        dateFrom: shiftDateKey(selectedDate, -6),
        dateTo: selectedDate,
        dimension,
        classId,
        unbounded: true,
        now
      })
    ]);
    const activeStudents = studentsRes.items.filter(
      (s) => s.status === "ACTIVE" /* ACTIVE */ || s.status === "DEMO_ACTIVE" /* DEMO_ACTIVE */
    );
    const activeTeachers = teachersRes.items.filter((t) => t.status === "ACTIVE" /* ACTIVE */);
    const activeClasses = classesRes.items.filter((c) => c.isActive);
    const allPermissions = permissionsRes.items;
    const pendingAdminPermissions = allPermissions.filter(
      (p) => p.status === "SUBMITTED" /* SUBMITTED */
    );
    const pendingPrincipalPermissions = allPermissions.filter(
      (p) => p.status === "ADMIN_REVIEWED" /* ADMIN_REVIEWED */
    );
    const decidedPermissions = allPermissions.filter(
      (p) => p.status === "APPROVED" /* APPROVED */ || p.status === "REJECTED" /* REJECTED */
    ).slice(0, 6);
    const [enrichedPendingPrincipal, enrichedRecentDecisions] = await Promise.all([
      enrichPermissionsWithActors(repo, pendingPrincipalPermissions.slice(0, 6)),
      enrichPermissionsWithActors(repo, decidedPermissions)
    ]);
    const teacherNameMap = new Map(teachersRes.items.map((t) => [t.id, t.fullName]));
    const userMap = new Map(
      usersRes.items.map((u) => [
        u.id,
        (u.linkedTeacherId ? teacherNameMap.get(u.linkedTeacherId) : void 0) ?? u.username
      ])
    );
    const recentActivities = logsRes.items.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actorName: userMap.get(log.actorUserId) ?? log.actorRole,
      actorRole: log.actorRole,
      reason: log.reason,
      createdAt: log.createdAt
    }));
    sendOk(res, {
      schoolName: settings?.schoolName ?? "MI Miftahul Ulum Sumberwuluh",
      selectedDate,
      dimension,
      kpis: {
        activeStudents: activeStudents.length,
        demoStudents: activeStudents.filter((s) => s.isDemo).length,
        activeTeachers: activeTeachers.length,
        activeClasses: activeClasses.length,
        presentToday: dailyReport.summary.present,
        lateToday: dailyReport.summary.late,
        excusedSickToday: dailyReport.summary.sick + dailyReport.summary.excused,
        absentToday: dailyReport.summary.absent,
        missingCheckInToday: dailyReport.summary.missingCheckIn,
        missingCheckOutToday: dailyReport.summary.missingCheckOut,
        attendanceRateToday: dailyReport.summary.attendanceRate,
        pendingAdminPermissions: pendingAdminPermissions.length,
        pendingPrincipalPermissions: pendingPrincipalPermissions.length
      },
      trend: trendReport.trend,
      classBreakdown: dailyReport.classBreakdown,
      pendingPrincipalList: enrichedPendingPrincipal,
      recentDecisions: enrichedRecentDecisions,
      recentActivities,
      classes: activeClasses.map((c) => ({ id: c.id, name: c.name, gradeLevel: c.gradeLevel }))
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler49(req, res) {
  await handleDashboardSummary(req, res);
}

// src/lib/reportValidation.ts
import { z as z15 } from "zod";
var REPORT_PERIODS = ["daily", "weekly", "monthly", "yearly", "custom"];
var REPORT_DIMENSIONS = ["STUDENT", "TEACHER", "ALL"];
var reportQuerySchema = z15.object({
  period: z15.enum(REPORT_PERIODS).default("monthly"),
  referenceDate: z15.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.").optional(),
  dateFrom: z15.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal awal harus YYYY-MM-DD.").optional(),
  dateTo: z15.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal akhir harus YYYY-MM-DD.").optional(),
  dimension: z15.enum(REPORT_DIMENSIONS).default("STUDENT"),
  classId: z15.string().trim().optional(),
  status: z15.enum([
    "",
    "PRESENT" /* PRESENT */,
    "LATE" /* LATE */,
    "SICK" /* SICK */,
    "EXCUSED" /* EXCUSED */,
    "ABSENT" /* ABSENT */,
    "MISSING_CHECK_IN",
    "MISSING_CHECK_OUT"
  ]).optional().default(""),
  search: z15.string().trim().max(120).optional().default(""),
  cursor: z15.string().trim().optional(),
  limit: z15.coerce.number().int().min(1).max(2e3).optional().default(25)
});
var reportExportSchema = reportQuerySchema.extend({
  format: z15.enum(["XLSX", "PDF", "PRINT"])
});

// backend/reports/attendance.ts
async function handleAttendanceReport(req, res, repo = getRepository(), options = {}) {
  try {
    if (req.method && req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus GET.");
    }
    const auth = await requireAuth(req, { repo });
    const parsed = reportQuerySchema.parse({
      period: getQueryString(req, "period") || "monthly",
      referenceDate: getQueryString(req, "referenceDate") || void 0,
      dateFrom: getQueryString(req, "dateFrom") || void 0,
      dateTo: getQueryString(req, "dateTo") || void 0,
      dimension: getQueryString(req, "dimension") || "STUDENT",
      classId: getQueryString(req, "classId") || void 0,
      status: getQueryString(req, "status") || "",
      search: getQueryString(req, "search") || "",
      cursor: getQueryString(req, "cursor") || void 0,
      limit: getQueryString(req, "limit") || 25
    });
    const isTeacherOnly = auth.user.role === "TEACHER" /* TEACHER */;
    if (isTeacherOnly && !auth.user.linkedTeacherId) {
      throw ApiError.forbidden("Akun guru belum tertaut ke profil pendidik.");
    }
    const report = await buildAttendanceReport(repo, {
      ...parsed,
      dimension: isTeacherOnly ? "TEACHER" : parsed.dimension,
      classId: isTeacherOnly ? void 0 : parsed.classId,
      restrictToTeacherId: isTeacherOnly ? auth.user.linkedTeacherId : void 0,
      now: options.now
    });
    sendOk(res, report);
  } catch (err) {
    sendError(res, err);
  }
}
async function handler50(req, res) {
  await handleAttendanceReport(req, res);
}

// backend/reports/matrix.ts
import { z as z16 } from "zod";
var matrixQuerySchema = z16.object({
  period: z16.enum(["weekly", "monthly", "custom"]).default("weekly"),
  referenceDate: z16.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom: z16.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z16.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dimension: z16.enum(["STUDENT", "TEACHER"]).default("STUDENT"),
  classId: z16.string().trim().optional(),
  search: z16.string().trim().max(120).optional().default("")
});
var DAY_LABELS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
function resolveMatrixDateRange(period, referenceDate, dateFromInput, dateToInput, todayKey) {
  const ref = referenceDate || todayKey;
  if (period === "custom") {
    const start = dateFromInput || ref;
    const end = dateToInput || start;
    return { dateFrom: start, dateTo: end };
  }
  const refDt = /* @__PURE__ */ new Date(`${ref}T12:00:00+07:00`);
  if (period === "weekly") {
    const dow = refDt.getUTCDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(refDt.getTime());
    mon.setUTCDate(mon.getUTCDate() + diffToMon);
    const sun = new Date(mon.getTime());
    sun.setUTCDate(sun.getUTCDate() + 6);
    return { dateFrom: getDateKeyJakarta(mon), dateTo: getDateKeyJakarta(sun) };
  }
  const [yStr, mStr] = ref.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const firstDay = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const lastDt = new Date(Date.UTC(year, month, 0, 5, 0, 0));
  const lastDay = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
    lastDt.getUTCDate()
  ).padStart(2, "0")}`;
  return { dateFrom: firstDay, dateTo: lastDay };
}
function enumerateDates(dateFrom, dateTo) {
  const start = /* @__PURE__ */ new Date(`${dateFrom}T12:00:00+07:00`);
  const end = /* @__PURE__ */ new Date(`${dateTo}T12:00:00+07:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }
  const list = [];
  const cur = new Date(start.getTime());
  while (cur <= end && list.length < 62) {
    list.push(getDateKeyJakarta(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return list;
}
function getIsoDayOfWeek(dateKey) {
  const dt = /* @__PURE__ */ new Date(`${dateKey}T12:00:00+07:00`);
  return dt.getUTCDay();
}
function holidayApplies(holiday, dimension) {
  if (!holiday.isActive) return false;
  if (holiday.scope === "SCHOOL" /* SCHOOL */) return true;
  if (dimension === "STUDENT" && holiday.scope === "STUDENT" /* STUDENT */) return true;
  if (dimension === "TEACHER" && holiday.scope === "TEACHER" /* TEACHER */) return true;
  return false;
}
function findApprovedPermissionOnDate(permissions, teacherId, dateKey) {
  for (const p of permissions) {
    if (p.teacherId !== teacherId || p.status !== "APPROVED" /* APPROVED */) continue;
    const pStart = getDateKeyJakarta(new Date(p.startAt));
    const pEnd = getDateKeyJakarta(new Date(p.endAt));
    if (dateKey >= pStart && dateKey <= pEnd) return p;
  }
  return null;
}
function pickDayCodeFromRecords(records) {
  if (records.length === 0) return null;
  const checkIn = records.find((r) => r.eventType === "CHECK_IN" /* CHECK_IN */);
  const chosen = checkIn ?? records[0];
  switch (chosen.status) {
    case "PRESENT" /* PRESENT */:
      return "H";
    case "LATE" /* LATE */:
      return "T";
    case "SICK" /* SICK */:
      return "S";
    case "EXCUSED" /* EXCUSED */:
      return "I";
    case "ABSENT" /* ABSENT */:
      return "A";
    default:
      return null;
  }
}
async function handleAttendanceMatrix(req, res, repo = getRepository(), options = {}) {
  try {
    if (req.method && req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus GET.");
    }
    const auth = await requireAuth(req, { repo });
    const parsed = matrixQuerySchema.parse({
      period: getQueryString(req, "period") || "weekly",
      referenceDate: getQueryString(req, "referenceDate") || void 0,
      dateFrom: getQueryString(req, "dateFrom") || void 0,
      dateTo: getQueryString(req, "dateTo") || void 0,
      dimension: getQueryString(req, "dimension") || "STUDENT",
      classId: getQueryString(req, "classId") || void 0,
      search: getQueryString(req, "search") || ""
    });
    const isTeacherOnly = auth.user.role === "TEACHER" /* TEACHER */;
    if (isTeacherOnly && !auth.user.linkedTeacherId) {
      throw ApiError.forbidden("Akun guru belum tertaut ke profil pendidik.");
    }
    const effectiveDimension = isTeacherOnly ? "TEACHER" : parsed.dimension;
    const effectiveClassId = effectiveDimension === "TEACHER" ? null : parsed.classId || null;
    const now = options.now ?? /* @__PURE__ */ new Date();
    const todayKey = getDateKeyJakarta(now);
    const { dateFrom, dateTo } = resolveMatrixDateRange(
      parsed.period,
      parsed.referenceDate,
      parsed.dateFrom,
      parsed.dateTo,
      todayKey
    );
    const dateKeys = enumerateDates(dateFrom, dateTo);
    if (dateKeys.length === 0) {
      throw ApiError.badRequest("Rentang tanggal tidak valid. Pastikan tanggal awal <= tanggal akhir.");
    }
    const [
      settings,
      holidaysRes,
      recordsRes,
      permissionsRes,
      classesRes,
      rulesRes,
      studentsRes,
      teachersRes
    ] = await Promise.all([
      repo.collection("appSettings" /* APP_SETTINGS */).getById("default"),
      repo.collection("holidays" /* HOLIDAYS */).list(),
      repo.collection("attendanceRecords" /* ATTENDANCE_RECORDS */).list(),
      repo.collection("teacherPermissions" /* TEACHER_PERMISSIONS */).list(),
      repo.collection("classes" /* CLASSES */).list(),
      repo.collection("attendanceRules" /* ATTENDANCE_RULES */).list(),
      effectiveDimension === "STUDENT" ? repo.collection("students" /* STUDENTS */).list({ sort: { field: "fullName", direction: "asc" } }) : Promise.resolve({ items: [] }),
      effectiveDimension === "TEACHER" ? repo.collection("teachers" /* TEACHERS */).list({ sort: { field: "fullName", direction: "asc" } }) : Promise.resolve({ items: [] })
    ]);
    const activeTeacherRule = rulesRes.items.filter((r) => r.isActive && r.audience === "TEACHER" /* TEACHER */ && r.classIds.length === 0).sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0] ?? rulesRes.items.filter((r) => r.isActive && r.audience === "TEACHER" /* TEACHER */).sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0] ?? null;
    const approvedPermissionAffectsRecap = settings?.approvedPermissionAffectsRecap ?? true;
    const holidayByDate = /* @__PURE__ */ new Map();
    for (const h of holidaysRes.items) {
      if (holidayApplies(h, effectiveDimension)) {
        holidayByDate.set(h.date, h.name);
      }
    }
    const dates = dateKeys.map((date) => {
      const dow = getIsoDayOfWeek(date);
      const isWeekend = dow === 0;
      const holidayName = holidayByDate.get(date) ?? null;
      return {
        date,
        dayLabel: DAY_LABELS_ID[dow] ?? "",
        dayNum: date.slice(8, 10),
        isWeekend,
        isHoliday: Boolean(holidayName),
        holidayName
      };
    });
    const recordsByPersonDate = /* @__PURE__ */ new Map();
    const targetPersonType = effectiveDimension === "STUDENT" ? "STUDENT" /* STUDENT */ : "TEACHER" /* TEACHER */;
    for (const r of recordsRes.items) {
      if (r.personType !== targetPersonType) continue;
      if (r.attendanceDate < dateFrom || r.attendanceDate > dateTo) continue;
      const key = `${r.personId}|${r.attendanceDate}`;
      const arr = recordsByPersonDate.get(key) ?? [];
      arr.push(r);
      recordsByPersonDate.set(key, arr);
    }
    const classNameById = new Map(classesRes.items.map((c) => [c.id, c.name]));
    const searchLower = parsed.search.toLowerCase();
    const people = [];
    if (effectiveDimension === "STUDENT") {
      const sortedStudents = studentsRes.items.filter((s) => s.status === "ACTIVE" /* ACTIVE */ || s.status === "DEMO_ACTIVE" /* DEMO_ACTIVE */).filter((s) => !effectiveClassId || s.classId === effectiveClassId).filter((s) => {
        if (!searchLower) return true;
        return s.fullName.toLowerCase().includes(searchLower) || s.nis.toLowerCase().includes(searchLower);
      }).sort((a, b) => {
        const ca = classNameById.get(a.classId) ?? "";
        const cb = classNameById.get(b.classId) ?? "";
        const cmpClass = ca.localeCompare(cb, "id");
        if (cmpClass !== 0) return cmpClass;
        return a.fullName.localeCompare(b.fullName, "id");
      });
      for (const s of sortedStudents) {
        people.push({
          id: s.id,
          personType: "STUDENT" /* STUDENT */,
          identifier: s.nis,
          fullName: s.fullName,
          groupLabel: `Kelas ${classNameById.get(s.classId) ?? "-"}`
        });
      }
    } else {
      const sortedTeachers = teachersRes.items.filter((t) => t.status === "ACTIVE" /* ACTIVE */).filter((t) => !isTeacherOnly || t.id === auth.user.linkedTeacherId).filter((t) => {
        if (!searchLower) return true;
        return t.fullName.toLowerCase().includes(searchLower) || t.niyNip.toLowerCase().includes(searchLower) || t.position.toLowerCase().includes(searchLower);
      }).sort((a, b) => {
        const ap = a.position.toLowerCase().includes("kepala sekolah") ? 0 : 1;
        const bp = b.position.toLowerCase().includes("kepala sekolah") ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return a.fullName.localeCompare(b.fullName, "id");
      });
      for (const t of sortedTeachers) {
        people.push({
          id: t.id,
          personType: "TEACHER" /* TEACHER */,
          identifier: t.niyNip,
          fullName: t.fullName,
          groupLabel: t.position,
          workingDays: t.workingDays ?? null
        });
      }
    }
    const rows = people.map((person) => {
      const cells = {};
      let present = 0;
      let late = 0;
      let sick = 0;
      let excused = 0;
      let absent = 0;
      let hlt = 0;
      let workingDays = 0;
      const teacherWorkingSet = person.personType === "TEACHER" /* TEACHER */ ? new Set(resolveTeacherWorkingDays({ workingDays: person.workingDays }, activeTeacherRule)) : null;
      for (const col of dates) {
        if (col.isWeekend || col.isHoliday) {
          cells[col.date] = "L";
          continue;
        }
        if (col.date > todayKey) {
          cells[col.date] = "-";
          continue;
        }
        const recs = recordsByPersonDate.get(`${person.id}|${col.date}`) ?? [];
        let code = pickDayCodeFromRecords(recs);
        if (teacherWorkingSet) {
          const jsDow = getIsoDayOfWeek(col.date);
          const isoDow = jsDow === 0 ? 7 : jsDow;
          if (!teacherWorkingSet.has(isoDow)) {
            if (!code) {
              cells[col.date] = "HLT";
              hlt += 1;
              continue;
            }
          }
        }
        workingDays += 1;
        if (!code && person.personType === "TEACHER" /* TEACHER */ && approvedPermissionAffectsRecap) {
          const perm = findApprovedPermissionOnDate(permissionsRes.items, person.id, col.date);
          if (perm) {
            code = perm.leaveType === "SICK" /* SICK */ ? "S" : "I";
          }
        }
        if (!code) {
          code = "A";
        }
        cells[col.date] = code;
        if (code === "H") present += 1;
        else if (code === "T") late += 1;
        else if (code === "S") sick += 1;
        else if (code === "I") excused += 1;
        else if (code === "A") absent += 1;
      }
      const attended = present + late;
      const ratePercent = workingDays > 0 ? Math.round(attended / workingDays * 100) : 0;
      return {
        id: person.id,
        personType: person.personType,
        identifier: person.identifier,
        fullName: person.fullName,
        groupLabel: person.groupLabel,
        cells,
        summary: {
          present,
          late,
          sick,
          excused,
          absent,
          hlt,
          workingDays,
          ratePercent
        }
      };
    });
    const payload = {
      schoolName: settings?.schoolName ?? "MI Miftahul Ulum Sumberwuluh",
      generatedAt: now.toISOString(),
      period: parsed.period,
      dateFrom,
      dateTo,
      dimension: effectiveDimension,
      classId: effectiveClassId,
      dates,
      rows
    };
    sendOk(res, payload);
  } catch (err) {
    sendError(res, err);
  }
}
async function handler51(req, res) {
  await handleAttendanceMatrix(req, res);
}

// backend/reports/export.ts
async function handleReportExport(req, res, repo = getRepository(), options = {}) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo });
    const parsed = reportExportSchema.parse(req.body ?? {});
    const isTeacherOnly = auth.user.role === "TEACHER" /* TEACHER */;
    if (isTeacherOnly && !auth.user.linkedTeacherId) {
      throw ApiError.forbidden("Akun guru belum tertaut ke profil pendidik.");
    }
    const report = await buildAttendanceReport(repo, {
      ...parsed,
      dimension: isTeacherOnly ? "TEACHER" : parsed.dimension,
      classId: isTeacherOnly ? void 0 : parsed.classId,
      restrictToTeacherId: isTeacherOnly ? auth.user.linkedTeacherId : void 0,
      unbounded: true,
      now: options.now
    });
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "REPORT_EXPORTED",
      entityType: "ATTENDANCE_REPORT",
      entityId: `${report.dimension}_${report.dateFrom}_${report.dateTo}`,
      after: {
        format: parsed.format,
        period: report.period,
        dimension: report.dimension,
        dateFrom: report.dateFrom,
        dateTo: report.dateTo,
        classId: report.appliedFilters.classId,
        rowCount: report.items.length
      },
      clientIp: auth.clientIp
    });
    let generatedBy = auth.user.username;
    if (auth.user.linkedTeacherId) {
      const teacher = await repo.collection("teachers" /* TEACHERS */).getById(auth.user.linkedTeacherId);
      if (teacher?.fullName) {
        generatedBy = teacher.fullName;
      }
    }
    sendOk(res, {
      format: parsed.format,
      generatedBy,
      generatedByRole: auth.user.role,
      ...report
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler52(req, res) {
  await handleReportExport(req, res);
}

// src/lib/adminSettingsValidation.ts
import { z as z17 } from "zod";
var ALLOWED_BRANDING_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp"
];
var MAX_BRANDING_BYTES = 2 * 1024 * 1024;
var MAX_LOGIN_BACKGROUND_BYTES = 10 * 1024 * 1024;
var BRANDING_SLOTS = [
  "logo",
  "favicon",
  "pwaIcon192",
  "pwaIcon512",
  "loginBackground"
];
function getMaxBrandingBytes(slot) {
  return slot === "loginBackground" ? MAX_LOGIN_BACKGROUND_BYTES : MAX_BRANDING_BYTES;
}
var hexColorSchema = z17.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Warna harus berformat heksadesimal #RRGGBB.");
var PORTAL_SCAN_METHODS = [
  "CAMERA_AND_USB",
  "CAMERA_ONLY",
  "USB_SCANNER_ONLY",
  "MANUAL_AND_SCANNER"
];
var appSettingsUpdateSchema = z17.object({
  appName: z17.string().trim().min(2, "Nama aplikasi minimal 2 karakter.").max(60).optional(),
  pwaAppName: z17.string().trim().min(2, "Nama aplikasi PWA minimal 2 karakter.").max(25, "Nama aplikasi PWA maksimal 25 karakter.").optional(),
  schoolName: z17.string().trim().min(3, "Nama sekolah minimal 3 karakter.").max(140).optional(),
  schoolAddress: z17.string().trim().min(5, "Alamat sekolah minimal 5 karakter.").max(300).optional(),
  schoolBio: z17.string().trim().max(500).optional(),
  timezone: z17.string().trim().min(3).max(60).optional(),
  theme: z17.object({
    primary: hexColorSchema,
    accent: hexColorSchema,
    background: hexColorSchema
  }).optional(),
  gpsEnabledForStudents: z17.boolean().optional(),
  gpsEnabledForTeachers: z17.boolean().optional(),
  teacherSelfServiceEnabled: z17.boolean().optional(),
  portalScanMethod: z17.enum(PORTAL_SCAN_METHODS).optional(),
  approvedPermissionAffectsRecap: z17.boolean().optional(),
  quickLoginEnabled: z17.boolean().optional(),
  bypassAttendanceTimeWindow: z17.boolean().optional(),
  requireUserLinkedToTeacher: z17.boolean().optional(),
  photoRetentionDays: z17.coerce.number().int().min(7, "Retensi foto minimal 7 hari.").max(730, "Retensi foto maksimal 730 hari.").optional(),
  voiceTemplates: z17.object({
    success: z17.string().trim().min(2).max(120),
    failure: z17.string().trim().min(2).max(120),
    namedSuccess: z17.string().trim().min(2).max(160),
    late: z17.string().trim().min(2).max(160).optional(),
    closed: z17.string().trim().min(2).max(160).optional(),
    alreadyRecorded: z17.string().trim().min(2).max(160).optional()
  }).optional(),
  portalExitPassword: z17.string().min(3, "Kata sandi keluar portal minimal 3 karakter.").max(72).optional()
});
var brandingUploadSchema = z17.object({
  slot: z17.enum(BRANDING_SLOTS),
  dataUrl: z17.string().min(30, "Data gambar branding tidak valid."),
  mimeType: z17.enum(ALLOWED_BRANDING_MIME_TYPES, {
    message: "Format aset branding hanya mendukung PNG, JPEG, atau WebP."
  }),
  fileName: z17.string().trim().max(160).optional()
});
var qrBulkIssueSchema = z17.object({
  ownerType: z17.enum(["STUDENT" /* STUDENT */, "TEACHER" /* TEACHER */]),
  ownerIds: z17.array(z17.string().trim().min(1)).min(1, "Pilih minimal 1 siswa atau guru.").max(100, "Maksimal 100 kartu QR per permintaan massal.")
});
var userCreateSchema = z17.object({
  username: z17.string().trim().min(3, "Username minimal 3 karakter.").max(40, "Username maksimal 40 karakter.").regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, atau strip."),
  password: z17.string().min(6, "Kata sandi minimal 6 karakter.").max(72, "Kata sandi maksimal 72 karakter."),
  role: z17.enum([
    "SUPER_ADMIN" /* SUPER_ADMIN */,
    "ADMIN" /* ADMIN */,
    "PRINCIPAL" /* PRINCIPAL */,
    "OPERATOR" /* OPERATOR */,
    "TEACHER" /* TEACHER */
  ]),
  linkedTeacherId: z17.string().trim().nullable().optional().default(null),
  isActive: z17.boolean().optional().default(true),
  mustChangePassword: z17.boolean().optional().default(false)
});
var userUpdateSchema = z17.object({
  username: z17.string().trim().min(3, "Username minimal 3 karakter.").max(40, "Username maksimal 40 karakter.").regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, atau strip.").optional(),
  role: z17.enum([
    "SUPER_ADMIN" /* SUPER_ADMIN */,
    "ADMIN" /* ADMIN */,
    "PRINCIPAL" /* PRINCIPAL */,
    "OPERATOR" /* OPERATOR */,
    "TEACHER" /* TEACHER */
  ]).optional(),
  isActive: z17.boolean().optional(),
  linkedTeacherId: z17.string().trim().nullable().optional(),
  mustChangePassword: z17.boolean().optional(),
  password: z17.string().min(6, "Kata sandi baru minimal 6 karakter.").max(72, "Kata sandi baru maksimal 72 karakter.").optional()
});
var generateUsersFromTeachersSchema = z17.object({
  items: z17.array(
    z17.object({
      teacherId: z17.string().trim().min(1, "ID guru wajib diisi."),
      role: z17.enum(["PRINCIPAL" /* PRINCIPAL */, "TEACHER" /* TEACHER */]).optional()
    })
  ).min(1, "Pilih minimal 1 data guru untuk dibuatkan akun.").max(200, "Maksimal 200 guru per proses generate.")
});
var auditLogQuerySchema = z17.object({
  actorUserId: z17.string().trim().optional(),
  action: z17.string().trim().optional(),
  entityType: z17.string().trim().optional(),
  dateFrom: z17.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal awal harus YYYY-MM-DD.").optional(),
  dateTo: z17.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal akhir harus YYYY-MM-DD.").optional(),
  search: z17.string().trim().max(120).optional().default(""),
  cursor: z17.string().trim().optional(),
  limit: z17.coerce.number().int().min(1).max(2e3).optional().default(25)
});

// backend/qr/bulk.ts
async function handleQrBulkIssue(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = qrBulkIssueSchema.parse(req.body ?? {});
    const uniqueOwnerIds = Array.from(new Set(parsed.ownerIds));
    const issuedItems = [];
    for (const ownerId of uniqueOwnerIds) {
      const issued = await issueQrToken(repo, parsed.ownerType, ownerId, {
        userId: auth.user.id,
        role: auth.user.role,
        clientIp: auth.clientIp
      });
      issuedItems.push(issued);
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "QR_TOKENS_BULK_ISSUED",
      entityType: "QR_TOKEN",
      entityId: `${parsed.ownerType}_${uniqueOwnerIds.length}`,
      after: {
        ownerType: parsed.ownerType,
        count: issuedItems.length
      },
      clientIp: auth.clientIp
    });
    sendOk(res, { items: issuedItems, count: issuedItems.length }, 201);
  } catch (err) {
    sendError(res, err);
  }
}
async function handler53(req, res) {
  await handleQrBulkIssue(req, res);
}

// backend/settings/index.ts
var SETTINGS_READ_ROLES = [
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "PRINCIPAL" /* PRINCIPAL */
];
var SETTINGS_WRITE_ROLES = ["SUPER_ADMIN" /* SUPER_ADMIN */, "ADMIN" /* ADMIN */];
var DEFAULT_VOICE_TEMPLATES = {
  success: "ABSEN BERHASIL",
  failure: "ABSEN GAGAL",
  namedSuccess: "ABSEN ATAS NAMA {name} BERHASIL",
  late: "ABSEN BERHASIL, {name} TERCATAT TERLAMBAT",
  closed: "MAAF, WAKTU ABSENSI MASIH DITUTUP",
  alreadyRecorded: "ANDA SUDAH MELAKUKAN ABSENSI HARI INI"
};
function stripSensitiveSettings(raw) {
  const { portalExitPasswordHash, ...rest } = raw;
  const existingVoice = rest.voiceTemplates ?? {};
  return {
    ...rest,
    pwaAppName: typeof rest.pwaAppName === "string" && rest.pwaAppName.trim() ? rest.pwaAppName.trim() : "MiFUL",
    approvedPermissionAffectsRecap: typeof rest.approvedPermissionAffectsRecap === "boolean" ? rest.approvedPermissionAffectsRecap : true,
    requireUserLinkedToTeacher: typeof rest.requireUserLinkedToTeacher === "boolean" ? rest.requireUserLinkedToTeacher : true,
    voiceTemplates: {
      ...DEFAULT_VOICE_TEMPLATES,
      ...existingVoice
    },
    hasPortalExitPassword: typeof portalExitPasswordHash === "string" && portalExitPasswordHash.length > 0
  };
}
async function handleAppSettings(req, res, repo = getRepository()) {
  try {
    const col = repo.collection("appSettings" /* APP_SETTINGS */);
    if (req.method === "GET") {
      const auth = await requireAuth(req, { repo, allowedRoles: SETTINGS_READ_ROLES });
      const existing = await col.getById("default");
      if (!existing) {
        throw ApiError.notFound("Dokumen pengaturan sekolah belum tersedia.");
      }
      sendOk(res, {
        settings: stripSensitiveSettings(existing),
        canEdit: SETTINGS_WRITE_ROLES.includes(auth.user.role)
      });
      return;
    }
    if (req.method === "PATCH") {
      const auth = await requireAuth(req, { repo, allowedRoles: SETTINGS_WRITE_ROLES });
      const existing = await col.getById("default");
      if (!existing) {
        throw ApiError.notFound("Dokumen pengaturan sekolah belum tersedia.");
      }
      const parsed = appSettingsUpdateSchema.parse(req.body ?? {});
      const patch = {};
      if (parsed.appName !== void 0) patch.appName = parsed.appName;
      if (parsed.pwaAppName !== void 0) patch.pwaAppName = parsed.pwaAppName;
      if (parsed.schoolName !== void 0) patch.schoolName = parsed.schoolName;
      if (parsed.schoolAddress !== void 0) patch.schoolAddress = parsed.schoolAddress;
      if (parsed.schoolBio !== void 0) patch.schoolBio = parsed.schoolBio;
      if (parsed.timezone !== void 0) patch.timezone = parsed.timezone;
      if (parsed.theme !== void 0) patch.theme = parsed.theme;
      if (parsed.gpsEnabledForStudents !== void 0) {
        patch.gpsEnabledForStudents = parsed.gpsEnabledForStudents;
      }
      if (parsed.gpsEnabledForTeachers !== void 0) {
        patch.gpsEnabledForTeachers = parsed.gpsEnabledForTeachers;
      }
      if (parsed.teacherSelfServiceEnabled !== void 0) {
        patch.teacherSelfServiceEnabled = parsed.teacherSelfServiceEnabled;
      }
      if (parsed.portalScanMethod !== void 0) {
        patch.portalScanMethod = parsed.portalScanMethod;
      }
      if (parsed.approvedPermissionAffectsRecap !== void 0) {
        patch.approvedPermissionAffectsRecap = parsed.approvedPermissionAffectsRecap;
      }
      if (parsed.quickLoginEnabled !== void 0) {
        patch.quickLoginEnabled = parsed.quickLoginEnabled;
      }
      if (parsed.bypassAttendanceTimeWindow !== void 0) {
        patch.bypassAttendanceTimeWindow = parsed.bypassAttendanceTimeWindow;
      }
      if (parsed.requireUserLinkedToTeacher !== void 0) {
        patch.requireUserLinkedToTeacher = parsed.requireUserLinkedToTeacher;
      }
      if (parsed.photoRetentionDays !== void 0) {
        patch.photoRetentionDays = parsed.photoRetentionDays;
      }
      if (parsed.voiceTemplates !== void 0) {
        patch.voiceTemplates = {
          ...DEFAULT_VOICE_TEMPLATES,
          ...existing.voiceTemplates ?? {},
          ...parsed.voiceTemplates
        };
      }
      let portalPasswordChanged = false;
      if (parsed.portalExitPassword) {
        patch.portalExitPasswordHash = await hashPassword(parsed.portalExitPassword);
        portalPasswordChanged = true;
      }
      const updated = await col.update("default", patch);
      if (!updated) {
        throw ApiError.notFound("Gagal memperbarui pengaturan sekolah.");
      }
      await syncPublicSettingsMirror(repo, updated);
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "APP_SETTINGS_UPDATED",
        entityType: "APP_SETTINGS",
        entityId: "default",
        before: {
          schoolName: existing.schoolName,
          appName: existing.appName,
          pwaAppName: existing.pwaAppName ?? "MiFUL",
          theme: existing.theme,
          timezone: existing.timezone,
          gpsEnabledForStudents: existing.gpsEnabledForStudents,
          gpsEnabledForTeachers: existing.gpsEnabledForTeachers,
          portalScanMethod: existing.portalScanMethod ?? "CAMERA_AND_USB",
          approvedPermissionAffectsRecap: existing.approvedPermissionAffectsRecap ?? true,
          quickLoginEnabled: existing.quickLoginEnabled ?? false,
          bypassAttendanceTimeWindow: existing.bypassAttendanceTimeWindow ?? false,
          requireUserLinkedToTeacher: existing.requireUserLinkedToTeacher ?? true,
          photoRetentionDays: existing.photoRetentionDays ?? 90
        },
        after: {
          schoolName: updated.schoolName,
          appName: updated.appName,
          pwaAppName: updated.pwaAppName ?? "MiFUL",
          theme: updated.theme,
          timezone: updated.timezone,
          gpsEnabledForStudents: updated.gpsEnabledForStudents,
          gpsEnabledForTeachers: updated.gpsEnabledForTeachers,
          portalScanMethod: updated.portalScanMethod ?? "CAMERA_AND_USB",
          approvedPermissionAffectsRecap: updated.approvedPermissionAffectsRecap ?? true,
          quickLoginEnabled: updated.quickLoginEnabled ?? true,
          bypassAttendanceTimeWindow: updated.bypassAttendanceTimeWindow ?? false,
          requireUserLinkedToTeacher: updated.requireUserLinkedToTeacher ?? true,
          photoRetentionDays: updated.photoRetentionDays ?? 90,
          portalPasswordChanged
        },
        clientIp: auth.clientIp
      });
      sendOk(res, {
        settings: stripSensitiveSettings(updated),
        canEdit: true
      });
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler54(req, res) {
  await handleAppSettings(req, res);
}

// backend/settings/branding.ts
import crypto14 from "node:crypto";
var BRANDING_WRITE_ROLES = ["SUPER_ADMIN" /* SUPER_ADMIN */, "ADMIN" /* ADMIN */];
var MAX_FIRESTORE_INLINE_BRANDING_BYTES = 700 * 1024;
function validateImageMagicBytes(buffer, mimeType) {
  if (buffer.length < 12) return false;
  if (mimeType === "image/jpeg") {
    return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  }
  if (mimeType === "image/png") {
    return buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71 && buffer[4] === 13 && buffer[5] === 10 && buffer[6] === 26 && buffer[7] === 10;
  }
  return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}
var SLOT_TO_SETTINGS_FIELD = {
  logo: "logoPath",
  favicon: "faviconPath",
  pwaIcon192: "pwaIcon192Path",
  pwaIcon512: "pwaIcon512Path",
  loginBackground: "loginBackgroundPath"
};
async function handleBrandingUpload(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: BRANDING_WRITE_ROLES });
    const parsed = brandingUploadSchema.parse(req.body ?? {});
    const prefix = `data:${parsed.mimeType};base64,`;
    if (!parsed.dataUrl.startsWith(prefix)) {
      throw ApiError.badRequest(
        "Header data URL tidak sesuai dengan jenis berkas gambar yang dipilih."
      );
    }
    const base64 = parsed.dataUrl.slice(prefix.length).replace(/\s+/g, "");
    const buffer = Buffer.from(base64, "base64");
    const maxBytes = getMaxBrandingBytes(parsed.slot);
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    if (buffer.length === 0 || buffer.length > maxBytes) {
      throw ApiError.badRequest(
        parsed.slot === "loginBackground" ? `Ukuran berkas gambar background maksimal ${maxMb} MB.` : `Ukuran berkas gambar branding maksimal ${maxMb} MB.`
      );
    }
    if (!validateImageMagicBytes(buffer, parsed.mimeType)) {
      throw ApiError.badRequest(
        "Isi berkas tidak valid atau bukan gambar PNG/JPEG/WebP yang sah."
      );
    }
    const ext = parsed.mimeType === "image/png" ? "png" : parsed.mimeType === "image/webp" ? "webp" : "jpg";
    const fileId = `brand_${parsed.slot}_${crypto14.randomBytes(6).toString("hex")}`;
    const storagePath = `branding/${parsed.slot}/${fileId}.${ext}`;
    putPrivateBlob(storagePath, buffer, parsed.mimeType);
    await repo.collection("fileMetadata" /* FILE_METADATA */).create({
      id: fileId,
      ownerType: "SCHOOL",
      ownerId: "default",
      category: "BRANDING" /* BRANDING */,
      storagePath,
      mimeType: parsed.mimeType,
      sizeBytes: buffer.length,
      retentionUntil: null,
      createdBy: auth.user.id,
      ...buffer.length <= MAX_FIRESTORE_INLINE_BRANDING_BYTES ? { dataBase64: base64 } : {}
    });
    if (buffer.length <= MAX_FIRESTORE_INLINE_BRANDING_BYTES) {
      await repo.collection("publicBrandingAssets" /* PUBLIC_BRANDING_ASSETS */).createIfNotExists(fileId, {
        slot: parsed.slot,
        mimeType: parsed.mimeType,
        sizeBytes: buffer.length,
        storagePath,
        dataBase64: base64,
        createdBy: auth.user.id
      });
    }
    const publicUrl = `/api/branding/asset?id=${encodeURIComponent(fileId)}`;
    const fieldName = SLOT_TO_SETTINGS_FIELD[parsed.slot];
    const settingsPatch = parsed.slot === "logo" ? {
      logoPath: publicUrl,
      faviconPath: publicUrl,
      pwaIcon192Path: publicUrl,
      pwaIcon512Path: publicUrl
    } : { [fieldName]: publicUrl };
    const updatedSettings = await repo.collection("appSettings" /* APP_SETTINGS */).update("default", settingsPatch);
    if (updatedSettings) {
      await syncPublicSettingsMirror(repo, updatedSettings);
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "BRANDING_ASSET_UPLOADED",
      entityType: "APP_SETTINGS",
      entityId: "default",
      after: {
        slot: parsed.slot,
        fileId,
        mimeType: parsed.mimeType,
        sizeBytes: buffer.length
      },
      clientIp: auth.clientIp
    });
    sendOk(
      res,
      {
        slot: parsed.slot,
        fileId,
        url: publicUrl,
        mimeType: parsed.mimeType,
        sizeBytes: buffer.length
      },
      201
    );
  } catch (err) {
    sendError(res, err);
  }
}
async function handler55(req, res) {
  await handleBrandingUpload(req, res);
}

// backend/branding/asset.ts
async function handleBrandingAsset(req, res, repo = getRepository()) {
  try {
    if (req.method !== "GET") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus GET.");
    }
    const fileId = getQueryString(req, "id");
    if (!fileId) {
      throw ApiError.badRequest("Parameter id aset branding wajib diisi.");
    }
    let blob = null;
    try {
      const publicAsset = await repo.collection("publicBrandingAssets" /* PUBLIC_BRANDING_ASSETS */).getById(fileId);
      if (publicAsset && publicAsset.dataBase64) {
        const buffer = Buffer.from(publicAsset.dataBase64, "base64");
        if (publicAsset.storagePath) {
          putPrivateBlob(publicAsset.storagePath, buffer, publicAsset.mimeType);
        }
        blob = { buffer, mimeType: publicAsset.mimeType };
      }
    } catch {
      blob = null;
    }
    if (!blob) {
      const meta = await repo.collection("fileMetadata" /* FILE_METADATA */).getById(fileId);
      if (!meta || meta.category !== "BRANDING" /* BRANDING */) {
        throw ApiError.notFound("Aset branding tidak ditemukan.");
      }
      blob = getPrivateBlob(meta.storagePath) ?? null;
      if (!blob && typeof meta.dataBase64 === "string" && meta.dataBase64.length > 0) {
        const restoredBuffer = Buffer.from(meta.dataBase64, "base64");
        putPrivateBlob(meta.storagePath, restoredBuffer, meta.mimeType);
        blob = { buffer: restoredBuffer, mimeType: meta.mimeType };
      }
    }
    if (!blob) {
      throw ApiError.notFound("Konten aset branding tidak tersedia.");
    }
    res.setHeader?.("Content-Type", blob.mimeType);
    res.setHeader?.("Cache-Control", "public, max-age=3600");
    res.setHeader?.("X-Content-Type-Options", "nosniff");
    res.status(200);
    if (typeof res.send === "function") {
      res.send(blob.buffer);
    } else if (typeof res.end === "function") {
      res.end(blob.buffer);
    }
  } catch (err) {
    sendError(res, err);
  }
}
async function handler56(req, res) {
  await handleBrandingAsset(req, res);
}

// backend/settings/backup.ts
var BACKUP_ALLOWED_ROLES = ["SUPER_ADMIN" /* SUPER_ADMIN */, "ADMIN" /* ADMIN */];
async function handleSettingsBackup(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: BACKUP_ALLOWED_ROLES });
    const [
      settingsRes,
      academicYearsRes,
      classesRes,
      subjectsRes,
      studentsRes,
      teachersRes,
      enrollmentsRes,
      schedulesRes,
      rulesRes,
      locationsRes,
      holidaysRes,
      attendanceRes,
      permissionsRes,
      usersRes
    ] = await Promise.all([
      repo.collection("appSettings" /* APP_SETTINGS */).list(),
      repo.collection("academicYears" /* ACADEMIC_YEARS */).list(),
      repo.collection("classes" /* CLASSES */).list(),
      repo.collection("subjects" /* SUBJECTS */).list(),
      repo.collection("students" /* STUDENTS */).list(),
      repo.collection("teachers" /* TEACHERS */).list(),
      repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */).list(),
      repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */).list(),
      repo.collection("attendanceRules" /* ATTENDANCE_RULES */).list(),
      repo.collection("schoolLocations" /* SCHOOL_LOCATIONS */).list(),
      repo.collection("holidays" /* HOLIDAYS */).list(),
      repo.collection("attendanceRecords" /* ATTENDANCE_RECORDS */).list(),
      repo.collection("teacherPermissions" /* TEACHER_PERMISSIONS */).list(),
      repo.collection("users" /* USERS */).list()
    ]);
    const safeSettings = settingsRes.items.map(({ portalExitPasswordHash: _o, ...rest }) => rest);
    const safeUsers = usersRes.items.map(
      ({ passwordHash: _p, passwordCipher: _pc, ...rest }) => rest
    );
    const exportedAt = (/* @__PURE__ */ new Date()).toISOString();
    const counts = {
      academicYears: academicYearsRes.items.length,
      classes: classesRes.items.length,
      subjects: subjectsRes.items.length,
      students: studentsRes.items.length,
      teachers: teachersRes.items.length,
      enrollments: enrollmentsRes.items.length,
      teachingSchedules: schedulesRes.items.length,
      attendanceRules: rulesRes.items.length,
      schoolLocations: locationsRes.items.length,
      holidays: holidaysRes.items.length,
      attendanceRecords: attendanceRes.items.length,
      teacherPermissions: permissionsRes.items.length,
      users: safeUsers.length
    };
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "SYSTEM_BACKUP_EXPORTED",
      entityType: "SYSTEM_BACKUP",
      entityId: exportedAt,
      after: { counts },
      clientIp: auth.clientIp
    });
    sendOk(res, {
      schemaVersion: "1.0.0",
      exportedAt,
      exportedBy: auth.user.username,
      counts,
      collections: {
        appSettings: safeSettings,
        academicYears: academicYearsRes.items,
        classes: classesRes.items,
        subjects: subjectsRes.items,
        students: studentsRes.items,
        teachers: teachersRes.items,
        studentEnrollments: enrollmentsRes.items,
        teachingSchedules: schedulesRes.items,
        attendanceRules: rulesRes.items,
        schoolLocations: locationsRes.items,
        holidays: holidaysRes.items,
        attendanceRecords: attendanceRes.items,
        teacherPermissions: permissionsRes.items,
        users: safeUsers
      }
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler57(req, res) {
  await handleSettingsBackup(req, res);
}

// backend/settings/restore.ts
import { z as z18 } from "zod";
var RESTORE_ALLOWED_ROLES = ["SUPER_ADMIN" /* SUPER_ADMIN */, "ADMIN" /* ADMIN */];
var restoreDocSchema = z18.object({
  id: z18.string().trim().min(1)
}).passthrough();
var restorePayloadSchema = z18.object({
  schemaVersion: z18.string().optional(),
  exportedAt: z18.string().optional(),
  collections: z18.object({
    appSettings: z18.array(restoreDocSchema).optional(),
    academicYears: z18.array(restoreDocSchema).optional(),
    classes: z18.array(restoreDocSchema).optional(),
    subjects: z18.array(restoreDocSchema).optional(),
    students: z18.array(restoreDocSchema).optional(),
    teachers: z18.array(restoreDocSchema).optional(),
    studentEnrollments: z18.array(restoreDocSchema).optional(),
    teachingSchedules: z18.array(restoreDocSchema).optional(),
    attendanceRules: z18.array(restoreDocSchema).optional(),
    schoolLocations: z18.array(restoreDocSchema).optional(),
    holidays: z18.array(restoreDocSchema).optional(),
    attendanceRecords: z18.array(restoreDocSchema).optional(),
    teacherPermissions: z18.array(restoreDocSchema).optional(),
    users: z18.array(restoreDocSchema).optional()
  })
});
async function runInChunks3(items, chunkSize, worker) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map(worker));
  }
}
async function replaceCollectionFromBackup(col, docs) {
  const existing = await col.list();
  const incomingIds = new Set(docs.map((d) => d.id));
  const toDelete = existing.items.filter((item) => !incomingIds.has(item.id));
  await runInChunks3(toDelete, 20, (item) => col.delete(item.id));
  const existingIds = new Set(existing.items.map((item) => item.id));
  await runInChunks3(docs, 20, async (doc) => {
    const { id, ...rest } = doc;
    if (existingIds.has(id)) {
      await col.update(id, rest);
    } else {
      await col.create(doc);
    }
  });
  return docs.length;
}
async function applyBackupSnapshotRestore(repo, parsed, auth, options) {
  const collections = parsed.collections;
  const restoredCounts = {};
  const collectionMappings = [
    { key: "academicYears", collectionName: "academicYears" /* ACADEMIC_YEARS */ },
    { key: "classes", collectionName: "classes" /* CLASSES */ },
    { key: "subjects", collectionName: "subjects" /* SUBJECTS */ },
    { key: "students", collectionName: "students" /* STUDENTS */ },
    { key: "teachers", collectionName: "teachers" /* TEACHERS */ },
    { key: "studentEnrollments", collectionName: "studentEnrollments" /* STUDENT_ENROLLMENTS */ },
    { key: "teachingSchedules", collectionName: "teachingSchedules" /* TEACHING_SCHEDULES */ },
    { key: "attendanceRules", collectionName: "attendanceRules" /* ATTENDANCE_RULES */ },
    { key: "schoolLocations", collectionName: "schoolLocations" /* SCHOOL_LOCATIONS */ },
    { key: "holidays", collectionName: "holidays" /* HOLIDAYS */ },
    { key: "attendanceRecords", collectionName: "attendanceRecords" /* ATTENDANCE_RECORDS */ },
    { key: "teacherPermissions", collectionName: "teacherPermissions" /* TEACHER_PERMISSIONS */ }
  ];
  for (const mapping of collectionMappings) {
    const docs = collections[mapping.key];
    if (!docs) continue;
    const col = repo.collection(mapping.collectionName);
    restoredCounts[mapping.key] = await replaceCollectionFromBackup(
      col,
      docs
    );
  }
  if (collections.appSettings && collections.appSettings.length > 0) {
    const settingsCol = repo.collection("appSettings" /* APP_SETTINGS */);
    const source = collections.appSettings.find((s) => s.id === "default") ?? collections.appSettings[0];
    const existing = await settingsCol.getById("default");
    const {
      id: _omitId,
      portalExitPasswordHash: _omitSecret,
      ...safeSettingsFields
    } = source;
    let updatedSettings = null;
    if (existing) {
      updatedSettings = await settingsCol.update("default", {
        ...safeSettingsFields,
        initialSeedCompleted: true
      });
    } else {
      updatedSettings = await settingsCol.create({
        ...safeSettingsFields,
        id: "default",
        initialSeedCompleted: true,
        portalExitPasswordHash: ""
      });
    }
    if (updatedSettings) {
      await syncPublicSettingsMirror(repo, updatedSettings);
    }
    restoredCounts.appSettings = 1;
  }
  if (collections.users && collections.users.length > 0) {
    const userCol = repo.collection("users" /* USERS */);
    const existingUsers = await userCol.list();
    const existingMap = new Map(existingUsers.items.map((u) => [u.id, u]));
    let updatedUserCount = 0;
    await runInChunks3(collections.users, 20, async (backupUser) => {
      const current = existingMap.get(backupUser.id);
      if (!current) return;
      if (current.id === auth.user.id) return;
      const patch = {};
      if (typeof backupUser.isActive === "boolean") patch.isActive = backupUser.isActive;
      if ("linkedTeacherId" in backupUser) {
        patch.linkedTeacherId = backupUser.linkedTeacherId ?? null;
      }
      if (typeof backupUser.role === "string" && (auth.user.role === "SUPER_ADMIN" /* SUPER_ADMIN */ || backupUser.role !== "SUPER_ADMIN" /* SUPER_ADMIN */)) {
        patch.role = backupUser.role;
      }
      if (Object.keys(patch).length > 0) {
        await userCol.update(current.id, patch);
        updatedUserCount++;
      }
    });
    restoredCounts.users = updatedUserCount;
  }
  const restoredAt = (/* @__PURE__ */ new Date()).toISOString();
  await recordActivityLog(repo, {
    actorUserId: auth.user.id,
    actorRole: auth.user.role,
    action: options?.auditAction ?? "SYSTEM_BACKUP_RESTORED",
    entityType: options?.entityType ?? "SYSTEM_BACKUP",
    entityId: options?.entityId ?? restoredAt,
    after: {
      sourceExportedAt: parsed.exportedAt ?? null,
      restoredCounts,
      ...options?.extraAudit ?? {}
    },
    clientIp: auth.clientIp
  });
  return { restoredCounts, restoredAt };
}
async function handleSettingsRestore(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_ALLOWED_ROLES });
    const parsed = restorePayloadSchema.parse(req.body ?? {});
    const result = await applyBackupSnapshotRestore(repo, parsed, auth);
    sendOk(res, {
      restored: true,
      restoredCounts: result.restoredCounts,
      restoredAt: result.restoredAt
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler58(req, res) {
  await handleSettingsRestore(req, res);
}

// backend/settings/restore-points.ts
import crypto15 from "node:crypto";
import { z as z19 } from "zod";
var FACTORY_BASELINE_ID = "sys_factory_baseline";
var RESTORE_POINT_VIEW_ROLES = [
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "PRINCIPAL" /* PRINCIPAL */
];
var RESTORE_POINT_WRITE_ROLES = ["SUPER_ADMIN" /* SUPER_ADMIN */, "ADMIN" /* ADMIN */];
var createRestorePointSchema = z19.object({
  name: z19.string().trim().min(3, "Nama Restore Point minimal 3 karakter.").max(100, "Nama Restore Point maksimal 100 karakter."),
  note: z19.string().trim().max(250, "Catatan maksimal 250 karakter.").optional()
});
function sanitizeRestorePointSummary(rp) {
  return {
    id: rp.id,
    name: rp.name,
    note: rp.note ?? null,
    createdAt: rp.createdAt ?? "",
    createdBy: rp.createdBy ?? null,
    createdByName: rp.createdByName,
    counts: rp.counts ?? {}
  };
}
async function buildSanitizedSnapshot(repo) {
  const [
    settingsRes,
    academicYearsRes,
    classesRes,
    subjectsRes,
    studentsRes,
    teachersRes,
    enrollmentsRes,
    schedulesRes,
    rulesRes,
    locationsRes,
    holidaysRes,
    attendanceRes,
    permissionsRes,
    usersRes
  ] = await Promise.all([
    repo.collection("appSettings" /* APP_SETTINGS */).list(),
    repo.collection("academicYears" /* ACADEMIC_YEARS */).list(),
    repo.collection("classes" /* CLASSES */).list(),
    repo.collection("subjects" /* SUBJECTS */).list(),
    repo.collection("students" /* STUDENTS */).list(),
    repo.collection("teachers" /* TEACHERS */).list(),
    repo.collection("studentEnrollments" /* STUDENT_ENROLLMENTS */).list(),
    repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */).list(),
    repo.collection("attendanceRules" /* ATTENDANCE_RULES */).list(),
    repo.collection("schoolLocations" /* SCHOOL_LOCATIONS */).list(),
    repo.collection("holidays" /* HOLIDAYS */).list(),
    repo.collection("attendanceRecords" /* ATTENDANCE_RECORDS */).list(),
    repo.collection("teacherPermissions" /* TEACHER_PERMISSIONS */).list(),
    repo.collection("users" /* USERS */).list()
  ]);
  const safeSettings = settingsRes.items.map(({ portalExitPasswordHash: _o, ...rest }) => rest);
  const safeUsers = usersRes.items.map(
    ({ passwordHash: _p, passwordCipher: _pc, ...rest }) => rest
  );
  const exportedAt = (/* @__PURE__ */ new Date()).toISOString();
  const counts = {
    academicYears: academicYearsRes.items.length,
    classes: classesRes.items.length,
    subjects: subjectsRes.items.length,
    students: studentsRes.items.length,
    teachers: teachersRes.items.length,
    enrollments: enrollmentsRes.items.length,
    teachingSchedules: schedulesRes.items.length,
    attendanceRules: rulesRes.items.length,
    schoolLocations: locationsRes.items.length,
    holidays: holidaysRes.items.length,
    attendanceRecords: attendanceRes.items.length,
    teacherPermissions: permissionsRes.items.length,
    users: safeUsers.length
  };
  return {
    counts,
    snapshot: {
      schemaVersion: "1.0.0",
      exportedAt,
      collections: {
        appSettings: safeSettings,
        academicYears: academicYearsRes.items,
        classes: classesRes.items,
        subjects: subjectsRes.items,
        students: studentsRes.items,
        teachers: teachersRes.items,
        studentEnrollments: enrollmentsRes.items,
        teachingSchedules: schedulesRes.items,
        attendanceRules: rulesRes.items,
        schoolLocations: locationsRes.items,
        holidays: holidaysRes.items,
        attendanceRecords: attendanceRes.items,
        teacherPermissions: permissionsRes.items,
        users: safeUsers
      }
    }
  };
}
async function handleRestorePoints(req, res, repo = getRepository()) {
  try {
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_VIEW_ROLES });
      const list = await repo.collection("restorePoints" /* RESTORE_POINTS */).list({
        sort: { field: "createdAt", direction: "desc" }
      });
      const items = list.items.filter((rp) => rp.id !== FACTORY_BASELINE_ID && rp.id !== "__factory_baseline__").map(sanitizeRestorePointSummary);
      sendOk(res, { items, total: items.length });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_WRITE_ROLES });
      const parsed = createRestorePointSchema.parse(req.body ?? {});
      const { counts, snapshot } = await buildSanitizedSnapshot(repo);
      const id = `rp_${crypto15.randomBytes(6).toString("hex")}`;
      const created = await repo.collection("restorePoints" /* RESTORE_POINTS */).create({
        id,
        name: parsed.name,
        note: parsed.note && parsed.note.length > 0 ? parsed.note : null,
        createdBy: auth.user.id,
        createdByName: auth.user.username,
        counts,
        snapshot
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SYSTEM_RESTORE_POINT_CREATED",
        entityType: "RESTORE_POINT",
        entityId: created.id,
        after: { name: created.name, counts },
        clientIp: auth.clientIp
      });
      sendOk(res, sanitizeRestorePointSummary(created), 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak didukung.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handleRestorePointApply(req, res, id, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_WRITE_ROLES });
    if (id === FACTORY_BASELINE_ID) {
      throw ApiError.notFound("Restore Point tidak ditemukan.");
    }
    const rp = await repo.collection("restorePoints" /* RESTORE_POINTS */).getById(id);
    if (!rp) {
      throw ApiError.notFound("Restore Point tidak ditemukan.");
    }
    const validatedSnapshot = restorePayloadSchema.parse(rp.snapshot);
    const result = await applyBackupSnapshotRestore(repo, validatedSnapshot, auth, {
      auditAction: "SYSTEM_RESTORE_POINT_APPLIED",
      entityType: "RESTORE_POINT",
      entityId: rp.id,
      extraAudit: { restorePointName: rp.name }
    });
    sendOk(res, {
      restored: true,
      restorePointId: rp.id,
      restorePointName: rp.name,
      restoredCounts: result.restoredCounts,
      restoredAt: result.restoredAt
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handleRestorePointById(req, res, id, repo = getRepository()) {
  try {
    if (req.method !== "DELETE") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus DELETE.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_WRITE_ROLES });
    if (id === FACTORY_BASELINE_ID) {
      throw ApiError.notFound("Restore Point tidak ditemukan.");
    }
    const col = repo.collection("restorePoints" /* RESTORE_POINTS */);
    const existing = await col.getById(id);
    if (!existing) {
      throw ApiError.notFound("Restore Point tidak ditemukan.");
    }
    await col.delete(id);
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "SYSTEM_RESTORE_POINT_DELETED",
      entityType: "RESTORE_POINT",
      entityId: id,
      before: { name: existing.name, createdAt: existing.createdAt ?? null },
      clientIp: auth.clientIp
    });
    sendOk(res, { deleted: true, id });
  } catch (err) {
    sendError(res, err);
  }
}
async function handleFactoryBaseline(req, res, repo = getRepository()) {
  try {
    if (req.method === "GET") {
      await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_VIEW_ROLES });
      const doc = await repo.collection("restorePoints" /* RESTORE_POINTS */).getById(FACTORY_BASELINE_ID);
      sendOk(res, {
        configured: Boolean(doc),
        baseline: doc ? sanitizeRestorePointSummary(doc) : null
      });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_WRITE_ROLES });
      const { counts, snapshot } = await buildSanitizedSnapshot(repo);
      const col = repo.collection("restorePoints" /* RESTORE_POINTS */);
      const existing = await col.getById(FACTORY_BASELINE_ID);
      const payload = {
        name: "Setelan & Database Pabrik Kustom",
        note: "Baseline setelan aplikasi dan database sekolah yang dijadikan acuan Format Factory.",
        createdBy: auth.user.id,
        createdByName: auth.user.username,
        counts,
        snapshot
      };
      const saved = existing ? await col.update(FACTORY_BASELINE_ID, payload) : await col.create({
        id: FACTORY_BASELINE_ID,
        ...payload
      });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SYSTEM_FACTORY_BASELINE_SAVED",
        entityType: "SYSTEM_SETTINGS",
        entityId: FACTORY_BASELINE_ID,
        after: { counts },
        clientIp: auth.clientIp
      });
      sendOk(res, {
        configured: true,
        baseline: saved ? sanitizeRestorePointSummary(saved) : null
      });
      return;
    }
    if (req.method === "DELETE") {
      const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_WRITE_ROLES });
      const col = repo.collection("restorePoints" /* RESTORE_POINTS */);
      const existing = await col.getById(FACTORY_BASELINE_ID);
      if (existing) {
        await col.delete(FACTORY_BASELINE_ID);
        await recordActivityLog(repo, {
          actorUserId: auth.user.id,
          actorRole: auth.user.role,
          action: "SYSTEM_FACTORY_BASELINE_CLEARED",
          entityType: "SYSTEM_SETTINGS",
          entityId: FACTORY_BASELINE_ID,
          before: { counts: existing.counts ?? {} },
          clientIp: auth.clientIp
        });
      }
      sendOk(res, { configured: false, baseline: null });
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak didukung.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler59(req, res) {
  await handleRestorePoints(req, res);
}

// backend/settings/factory-reset.ts
import { z as z20 } from "zod";
var FACTORY_RESET_ALLOWED_ROLES = ["SUPER_ADMIN" /* SUPER_ADMIN */, "ADMIN" /* ADMIN */];
var factoryResetSchema = z20.object({
  confirmationText: z20.string().trim()
});
async function runInChunks4(items, chunkSize, worker) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map(worker));
  }
}
async function clearCollection(col, preserveIds) {
  const existing = await col.list();
  const toDelete = preserveIds ? existing.items.filter((item) => !preserveIds.has(item.id)) : existing.items;
  if (toDelete.length === 0) return 0;
  await runInChunks4(toDelete, 20, (item) => col.delete(item.id));
  return toDelete.length;
}
function extractBrandingAssetIds(settingsDoc) {
  const ids = /* @__PURE__ */ new Set();
  if (!settingsDoc) return ids;
  for (const field of [
    "logoPath",
    "faviconPath",
    "pwaIcon192Path",
    "pwaIcon512Path",
    "loginBackgroundPath"
  ]) {
    const val = settingsDoc[field];
    if (typeof val !== "string") continue;
    const match = val.match(/[?&]id=([^&]+)/);
    if (match?.[1]) {
      ids.add(decodeURIComponent(match[1]));
    }
  }
  return ids;
}
async function handleFactoryReset(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: FACTORY_RESET_ALLOWED_ROLES });
    const parsed = factoryResetSchema.parse(req.body ?? {});
    if (parsed.confirmationText !== "RESET PABRIK") {
      throw ApiError.badRequest(
        "Konfirmasi tidak cocok. Ketik tepat RESET PABRIK untuk melanjutkan format pabrik."
      );
    }
    const customBaseline = await repo.collection("restorePoints" /* RESTORE_POINTS */).getById(FACTORY_BASELINE_ID);
    const validatedCustomSnapshot = customBaseline ? restorePayloadSchema.parse(customBaseline.snapshot) : null;
    const preservedBrandingIds = validatedCustomSnapshot ? extractBrandingAssetIds(validatedCustomSnapshot.collections.appSettings?.[0]) : /* @__PURE__ */ new Set();
    const collectionsToClear = [
      { key: "students", name: "students" /* STUDENTS */ },
      { key: "teachers", name: "teachers" /* TEACHERS */ },
      { key: "classes", name: "classes" /* CLASSES */ },
      { key: "subjects", name: "subjects" /* SUBJECTS */ },
      { key: "academicYears", name: "academicYears" /* ACADEMIC_YEARS */ },
      { key: "studentEnrollments", name: "studentEnrollments" /* STUDENT_ENROLLMENTS */ },
      { key: "teachingSchedules", name: "teachingSchedules" /* TEACHING_SCHEDULES */ },
      { key: "attendanceRules", name: "attendanceRules" /* ATTENDANCE_RULES */ },
      { key: "schoolLocations", name: "schoolLocations" /* SCHOOL_LOCATIONS */ },
      { key: "holidays", name: "holidays" /* HOLIDAYS */ },
      { key: "qrTokens", name: "qrTokens" /* QR_TOKENS */ },
      { key: "attendanceRecords", name: "attendanceRecords" /* ATTENDANCE_RECORDS */ },
      { key: "teacherPermissions", name: "teacherPermissions" /* TEACHER_PERMISSIONS */ },
      {
        key: "fileMetadata",
        name: "fileMetadata" /* FILE_METADATA */,
        preserveIds: preservedBrandingIds
      },
      {
        key: "publicBrandingAssets",
        name: "publicBrandingAssets" /* PUBLIC_BRANDING_ASSETS */,
        preserveIds: preservedBrandingIds
      }
    ];
    const clearedCounts = {};
    for (const item of collectionsToClear) {
      const col = repo.collection(item.name);
      clearedCounts[item.key] = await clearCollection(
        col,
        item.preserveIds
      );
    }
    let restoredTeacherIds;
    if (validatedCustomSnapshot) {
      const result = await applyBackupSnapshotRestore(repo, validatedCustomSnapshot, auth, {
        auditAction: "SYSTEM_FACTORY_RESET",
        entityType: "SYSTEM_SETTINGS",
        entityId: "default",
        extraAudit: { usedCustomBaseline: true, clearedCounts }
      });
      restoredTeacherIds = new Set(
        (validatedCustomSnapshot.collections.teachers ?? []).map((t) => t.id)
      );
      const defaultPortalExitHash = await hashPassword(
        process.env.PORTAL_DEFAULT_EXIT_PASSWORD || "123"
      );
      const updatedSettings = await repo.collection("appSettings" /* APP_SETTINGS */).update("default", {
        portalExitPasswordHash: defaultPortalExitHash,
        initialSeedCompleted: true
      });
      if (updatedSettings) {
        await syncPublicSettingsMirror(repo, updatedSettings);
      }
      clearedCounts.restoredCollections = Object.keys(result.restoredCounts).length;
    } else {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await Promise.all([
        ...FACTORY_ACADEMIC_YEARS.map((item) => {
          const { id, ...rest } = item;
          return repo.collection("academicYears" /* ACADEMIC_YEARS */).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now
          });
        }),
        ...FACTORY_TEACHERS.map((item) => {
          const { id, ...rest } = item;
          return repo.collection("teachers" /* TEACHERS */).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now
          });
        }),
        ...FACTORY_CLASSES.map((item) => {
          const { id, ...rest } = item;
          return repo.collection("classes" /* CLASSES */).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now
          });
        }),
        ...FACTORY_SUBJECTS.map((item) => {
          const { id, ...rest } = item;
          return repo.collection("subjects" /* SUBJECTS */).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now
          });
        }),
        ...FACTORY_TEACHING_SCHEDULES.map((item) => {
          const { id, ...rest } = item;
          return repo.collection("teachingSchedules" /* TEACHING_SCHEDULES */).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now
          });
        }),
        ...FACTORY_ATTENDANCE_RULES.map((item) => {
          const { id, ...rest } = item;
          return repo.collection("attendanceRules" /* ATTENDANCE_RULES */).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now
          });
        }),
        ...FACTORY_SCHOOL_LOCATIONS.map((item) => {
          const { id, ...rest } = item;
          return repo.collection("schoolLocations" /* SCHOOL_LOCATIONS */).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now
          });
        }),
        ...FACTORY_HOLIDAYS.map((item) => {
          const { id, ...rest } = item;
          return repo.collection("holidays" /* HOLIDAYS */).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now
          });
        })
      ]);
      restoredTeacherIds = new Set(FACTORY_TEACHERS.map((t) => t.id));
      const settingsCol = repo.collection("appSettings" /* APP_SETTINGS */);
      const defaultPortalExitHash = await hashPassword(
        process.env.PORTAL_DEFAULT_EXIT_PASSWORD || "123"
      );
      const { id: _omitId, ...factorySettingsRest } = FACTORY_APP_SETTINGS;
      const existingSettings = await settingsCol.getById("default");
      const updatedSettings = existingSettings ? await settingsCol.update("default", {
        ...factorySettingsRest,
        portalExitPasswordHash: defaultPortalExitHash,
        initialSeedCompleted: true
      }) : await settingsCol.create({
        ...factorySettingsRest,
        id: "default",
        portalExitPasswordHash: defaultPortalExitHash,
        initialSeedCompleted: true
      });
      if (updatedSettings) {
        await syncPublicSettingsMirror(repo, updatedSettings);
      }
    }
    const usersCol = repo.collection("users" /* USERS */);
    const uniqueUsernamesCol = repo.collection("uniqueUsernames" /* UNIQUE_USERNAMES */);
    const allUsers = await usersCol.list();
    let removedTeacherUsers = 0;
    await runInChunks4(allUsers.items, 20, async (u) => {
      if (u.id === auth.user.id || u.role === "SUPER_ADMIN" /* SUPER_ADMIN */) {
        if (u.linkedTeacherId && !restoredTeacherIds.has(u.linkedTeacherId)) {
          await usersCol.update(u.id, { linkedTeacherId: null });
        }
        return;
      }
      if (u.role === "ADMIN" /* ADMIN */ || u.role === "OPERATOR" /* OPERATOR */ || u.role === "TEACHER" /* TEACHER */ || u.role === "PRINCIPAL" /* PRINCIPAL */) {
        const hasValidRestoredTeacher = (u.role === "TEACHER" /* TEACHER */ || u.role === "PRINCIPAL" /* PRINCIPAL */) && Boolean(u.linkedTeacherId && restoredTeacherIds.has(u.linkedTeacherId));
        if (!hasValidRestoredTeacher) {
          await usersCol.delete(u.id);
          await uniqueUsernamesCol.delete(u.normalizedUsername).catch(() => void 0);
          removedTeacherUsers++;
        }
        return;
      }
    });
    clearedCounts.teacherUsers = removedTeacherUsers;
    const resetAt = (/* @__PURE__ */ new Date()).toISOString();
    if (!validatedCustomSnapshot) {
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "SYSTEM_FACTORY_RESET",
        entityType: "SYSTEM_SETTINGS",
        entityId: "default",
        after: { usedCustomBaseline: false, clearedCounts, resetAt },
        clientIp: auth.clientIp
      });
    }
    sendOk(res, {
      reset: true,
      usedCustomBaseline: Boolean(validatedCustomSnapshot),
      clearedCounts,
      resetAt
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler60(req, res) {
  await handleFactoryReset(req, res);
}

// backend/users/index.ts
var USER_READ_ROLES = [
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "PRINCIPAL" /* PRINCIPAL */
];
var USER_MANAGE_ROLES = [
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "PRINCIPAL" /* PRINCIPAL */
];
function canViewOrManageTarget(actorRole, targetRole) {
  if (actorRole === "SUPER_ADMIN" /* SUPER_ADMIN */) return true;
  if (actorRole === "ADMIN" /* ADMIN */) return targetRole !== "SUPER_ADMIN" /* SUPER_ADMIN */;
  if (actorRole === "PRINCIPAL" /* PRINCIPAL */) {
    return targetRole !== "SUPER_ADMIN" /* SUPER_ADMIN */ && targetRole !== "ADMIN" /* ADMIN */;
  }
  return false;
}
function getUserRoleSortOrder(role) {
  switch (role) {
    case "SUPER_ADMIN" /* SUPER_ADMIN */:
      return 0;
    case "PRINCIPAL" /* PRINCIPAL */:
      return 1;
    case "ADMIN" /* ADMIN */:
    case "OPERATOR" /* OPERATOR */:
      return 2;
    case "TEACHER" /* TEACHER */:
    default:
      return 3;
  }
}
async function handleUsers(req, res, repo = getRepository()) {
  try {
    const userCol = repo.collection("users" /* USERS */);
    if (req.method === "GET") {
      const auth = await requireAuth(req, { repo, allowedRoles: USER_READ_ROLES });
      const roleFilter = getQueryString(req, "role");
      const statusFilter = getQueryString(req, "isActive");
      const search = (getQueryString(req, "search") ?? "").toLowerCase();
      const [usersRes, teachersRes] = await Promise.all([
        userCol.list({ sort: { field: "createdAt", direction: "desc" } }),
        repo.collection("teachers" /* TEACHERS */).list()
      ]);
      const teacherMap = new Map(teachersRes.items.map((t) => [t.id, t]));
      const items = usersRes.items.map(({ passwordHash: _omitHash, passwordCipher, ...safe }) => {
        const teacher = safe.linkedTeacherId ? teacherMap.get(safe.linkedTeacherId) : void 0;
        const canViewPw = canViewOrManageTarget(auth.user.role, safe.role);
        return {
          ...safe,
          linkedTeacherName: teacher?.fullName ?? null,
          linkedTeacherPosition: teacher?.position ?? null,
          currentPassword: canViewPw ? decryptPasswordForAdminView(passwordCipher) : null
        };
      }).filter((u) => {
        if (roleFilter && u.role !== roleFilter) return false;
        if (statusFilter === "true" && !u.isActive) return false;
        if (statusFilter === "false" && u.isActive) return false;
        if (search) {
          const hay = `${u.username} ${u.linkedTeacherName ?? ""} ${u.linkedTeacherPosition ?? ""} ${u.role}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      }).sort((a, b) => {
        const rankDiff = getUserRoleSortOrder(a.role) - getUserRoleSortOrder(b.role);
        if (rankDiff !== 0) return rankDiff;
        const aLabel = a.linkedTeacherName ?? a.username;
        const bLabel = b.linkedTeacherName ?? b.username;
        return aLabel.localeCompare(bLabel, "id");
      });
      sendOk(res, {
        items,
        total: items.length,
        actorRole: auth.user.role
      });
      return;
    }
    if (req.method === "POST") {
      const auth = await requireAuth(req, { repo, allowedRoles: USER_MANAGE_ROLES });
      const parsed = userCreateSchema.parse(req.body ?? {});
      if (parsed.role === "SUPER_ADMIN" /* SUPER_ADMIN */ && auth.user.role !== "SUPER_ADMIN" /* SUPER_ADMIN */) {
        throw ApiError.forbidden("Hanya Super Admin yang berwenang membuat akun SUPER_ADMIN.");
      }
      if (auth.user.role === "PRINCIPAL" /* PRINCIPAL */ && (parsed.role === "SUPER_ADMIN" /* SUPER_ADMIN */ || parsed.role === "ADMIN" /* ADMIN */)) {
        throw ApiError.forbidden(
          "Kepala Sekolah tidak berwenang mengelola akun SUPER_ADMIN atau ADMIN."
        );
      }
      const appSettings = await repo.collection("appSettings" /* APP_SETTINGS */).getById("default");
      const requireLinkedTeacher = appSettings?.requireUserLinkedToTeacher ?? true;
      if (requireLinkedTeacher && parsed.role !== "SUPER_ADMIN" /* SUPER_ADMIN */ && !parsed.linkedTeacherId) {
        throw ApiError.badRequest(
          "Pengaturan mewajibkan akun peran ini ditautkan ke profil guru aktif."
        );
      }
      if (parsed.linkedTeacherId) {
        const teacher = await repo.collection("teachers" /* TEACHERS */).getById(parsed.linkedTeacherId);
        if (!teacher) {
          throw ApiError.badRequest("Profil guru yang ditautkan tidak ditemukan.");
        }
        if (teacher.userId) {
          const existingOwner = await userCol.getById(teacher.userId);
          if (existingOwner) {
            throw ApiError.conflict(
              `Profil guru "${teacher.fullName}" sudah tertaut ke akun "${existingOwner.username}".`
            );
          }
        }
      }
      const normalizedUsername = parsed.username.trim().toLowerCase();
      const passwordHash = await hashPassword(parsed.password);
      const mustChangePassword = parsed.role === "TEACHER" /* TEACHER */ ? false : parsed.mustChangePassword;
      const created = await userCol.create({
        username: parsed.username.trim(),
        normalizedUsername,
        passwordHash,
        passwordCipher: encryptPasswordForAdminView(parsed.password),
        role: parsed.role,
        linkedTeacherId: parsed.linkedTeacherId ?? null,
        isActive: parsed.isActive,
        mustChangePassword,
        lastLoginAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        createdBy: auth.user.id
      });
      try {
        await reserveUniqueUsername(repo, parsed.username.trim(), created.id);
      } catch (err) {
        await userCol.delete(created.id);
        throw err;
      }
      if (parsed.linkedTeacherId) {
        await repo.collection("teachers" /* TEACHERS */).update(parsed.linkedTeacherId, { userId: created.id });
      }
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "USER_CREATED",
        entityType: "USER",
        entityId: created.id,
        after: {
          username: created.username,
          role: created.role,
          isActive: created.isActive,
          linkedTeacherId: created.linkedTeacherId
        },
        clientIp: auth.clientIp
      });
      const { passwordHash: _omitHash, passwordCipher: _omitCipher, ...safeCreated } = created;
      sendOk(res, safeCreated, 201);
      return;
    }
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  } catch (err) {
    sendError(res, err);
  }
}
async function handler61(req, res) {
  await handleUsers(req, res);
}

// backend/users/generate.ts
import crypto16 from "node:crypto";
var GENERATE_ALLOWED_ROLES = [
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "PRINCIPAL" /* PRINCIPAL */
];
async function handleGenerateUsersFromTeachers(req, res, repo = getRepository()) {
  try {
    if (req.method !== "POST") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus POST.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: GENERATE_ALLOWED_ROLES });
    const parsed = generateUsersFromTeachersSchema.parse(req.body ?? {});
    const teacherCol = repo.collection("teachers" /* TEACHERS */);
    const userCol = repo.collection("users" /* USERS */);
    const [teachersRes, usersRes] = await Promise.all([teacherCol.list(), userCol.list()]);
    const teacherMap = new Map(teachersRes.items.map((t) => [t.id, t]));
    const existingUserById = new Map(usersRes.items.map((u) => [u.id, u]));
    const existingLinkedTeacherIds = new Set(
      usersRes.items.map((u) => u.linkedTeacherId).filter((id) => Boolean(id))
    );
    const seenTeacherIds = /* @__PURE__ */ new Set();
    const created = [];
    const skipped = [];
    for (const item of parsed.items) {
      if (seenTeacherIds.has(item.teacherId)) continue;
      seenTeacherIds.add(item.teacherId);
      const teacher = teacherMap.get(item.teacherId);
      if (!teacher) {
        skipped.push({
          teacherId: item.teacherId,
          fullName: item.teacherId,
          reason: "Profil guru tidak ditemukan."
        });
        continue;
      }
      if (teacher.status !== "ACTIVE" /* ACTIVE */) {
        skipped.push({
          teacherId: teacher.id,
          fullName: teacher.fullName,
          reason: "Profil guru berstatus nonaktif/arsip."
        });
        continue;
      }
      const alreadyLinked = existingLinkedTeacherIds.has(teacher.id) || Boolean(teacher.userId && existingUserById.has(teacher.userId));
      if (alreadyLinked) {
        skipped.push({
          teacherId: teacher.id,
          fullName: teacher.fullName,
          reason: "Guru ini sudah memiliki akun pengguna tertaut."
        });
        continue;
      }
      const targetRole = item.role ?? (teacher.position.toLowerCase().includes("kepala sekolah") ? "PRINCIPAL" /* PRINCIPAL */ : "TEACHER" /* TEACHER */);
      if (auth.user.role === "PRINCIPAL" /* PRINCIPAL */ && targetRole === "PRINCIPAL" /* PRINCIPAL */) {
        throw ApiError.forbidden(
          "Kepala Sekolah hanya dapat men-generate akun Guru, bukan akun Kepala Sekolah."
        );
      }
      const base = buildFirstNameUsernameBase(teacher.fullName);
      const availableUsername = await findAvailableUsername(repo, base);
      const userId = `usr_${crypto16.randomBytes(6).toString("hex")}`;
      const normalizedUsername = await reserveUniqueUsername(repo, availableUsername, userId);
      const generatedPassword = `${normalizedUsername}123`;
      const passwordHash = await hashPassword(generatedPassword);
      const passwordCipher = encryptPasswordForAdminView(generatedPassword);
      await userCol.create({
        id: userId,
        username: normalizedUsername,
        normalizedUsername,
        passwordHash,
        passwordCipher,
        role: targetRole,
        linkedTeacherId: teacher.id,
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        createdBy: auth.user.id
      });
      await teacherCol.update(teacher.id, { userId });
      existingLinkedTeacherIds.add(teacher.id);
      created.push({
        userId,
        teacherId: teacher.id,
        fullName: teacher.fullName,
        niyNip: teacher.niyNip,
        position: teacher.position,
        role: targetRole,
        username: normalizedUsername,
        generatedPassword
      });
    }
    if (created.length === 0) {
      throw ApiError.badRequest(
        skipped[0]?.reason ?? "Tidak ada akun baru yang dapat dibuat dari data guru terpilih."
      );
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "USERS_GENERATED_FROM_TEACHERS",
      entityType: "USER",
      entityId: "batch-generate",
      after: {
        createdCount: created.length,
        skippedCount: skipped.length,
        usernames: created.map((c) => c.username)
      },
      clientIp: auth.clientIp
    });
    sendOk(
      res,
      {
        created,
        skipped,
        createdCount: created.length
      },
      201
    );
  } catch (err) {
    sendError(res, err);
  }
}
async function handler62(req, res) {
  await handleGenerateUsersFromTeachers(req, res);
}

// backend/users/[id].ts
var USER_MANAGE_ROLES2 = [
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "PRINCIPAL" /* PRINCIPAL */
];
async function handleUserById(req, res, idOverride, repo = getRepository()) {
  try {
    if (req.method !== "PATCH" && req.method !== "DELETE") {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Metode harus PATCH atau DELETE.");
    }
    const auth = await requireAuth(req, { repo, allowedRoles: USER_MANAGE_ROLES2 });
    const id = idOverride ?? getQueryString(req, "id");
    if (!id) throw ApiError.badRequest("ID pengguna wajib diisi.");
    const col = repo.collection("users" /* USERS */);
    const target = await col.getById(id);
    if (!target) {
      throw ApiError.notFound("Akun pengguna tidak ditemukan.");
    }
    if (target.role === "SUPER_ADMIN" /* SUPER_ADMIN */ && auth.user.role !== "SUPER_ADMIN" /* SUPER_ADMIN */) {
      throw ApiError.forbidden("Anda tidak berwenang mengelola akun SUPER_ADMIN.");
    }
    if (auth.user.role === "PRINCIPAL" /* PRINCIPAL */ && (target.role === "SUPER_ADMIN" /* SUPER_ADMIN */ || target.role === "ADMIN" /* ADMIN */)) {
      throw ApiError.forbidden(
        "Kepala Sekolah tidak berwenang mengubah akun SUPER_ADMIN atau ADMIN."
      );
    }
    const teacherCol = repo.collection("teachers" /* TEACHERS */);
    if (req.method === "DELETE") {
      if (target.id === auth.user.id) {
        throw ApiError.badRequest("Anda tidak dapat menghapus akun yang sedang Anda gunakan.");
      }
      if (target.role === "SUPER_ADMIN" /* SUPER_ADMIN */) {
        const superAdmins = await col.list({
          filters: [{ field: "role", op: "==", value: "SUPER_ADMIN" /* SUPER_ADMIN */ }]
        });
        if (superAdmins.items.length <= 1) {
          throw ApiError.badRequest("Minimal harus ada 1 akun Super Admin yang aktif di sistem.");
        }
      }
      const teacherIdsToUnlink = /* @__PURE__ */ new Set();
      if (target.linkedTeacherId) {
        teacherIdsToUnlink.add(target.linkedTeacherId);
      }
      const linkedTeachers = await teacherCol.list({
        filters: [{ field: "userId", op: "==", value: target.id }]
      });
      for (const teacher of linkedTeachers.items) {
        teacherIdsToUnlink.add(teacher.id);
      }
      for (const teacherId of teacherIdsToUnlink) {
        await teacherCol.update(teacherId, { userId: null }).catch(() => void 0);
      }
      await revokeAllUserSessions(repo, target.id);
      await releaseUniqueUsername(repo, target.normalizedUsername).catch(() => void 0);
      await col.delete(target.id);
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: "USER_DELETED",
        entityType: "USER",
        entityId: target.id,
        before: {
          username: target.username,
          role: target.role,
          linkedTeacherId: target.linkedTeacherId
        },
        after: {
          deleted: true,
          returnedToTeacherIds: Array.from(teacherIdsToUnlink)
        },
        clientIp: auth.clientIp
      });
      sendOk(res, {
        deleted: true,
        id: target.id,
        username: target.username,
        unlinkedTeacherId: target.linkedTeacherId ?? null
      });
      return;
    }
    const parsed = userUpdateSchema.parse(req.body ?? {});
    if (parsed.role === "SUPER_ADMIN" /* SUPER_ADMIN */ && auth.user.role !== "SUPER_ADMIN" /* SUPER_ADMIN */) {
      throw ApiError.forbidden("Hanya Super Admin yang dapat menetapkan peran SUPER_ADMIN.");
    }
    if (auth.user.role === "PRINCIPAL" /* PRINCIPAL */ && parsed.role && (parsed.role === "SUPER_ADMIN" /* SUPER_ADMIN */ || parsed.role === "ADMIN" /* ADMIN */)) {
      throw ApiError.forbidden(
        "Kepala Sekolah tidak berwenang menaikkan peran menjadi SUPER_ADMIN atau ADMIN."
      );
    }
    if (target.id === auth.user.id && parsed.isActive === false) {
      throw ApiError.badRequest("Anda tidak dapat menonaktifkan akun Anda sendiri.");
    }
    if (target.id === auth.user.id && parsed.role !== void 0 && parsed.role !== target.role) {
      throw ApiError.badRequest("Anda tidak dapat mengubah peran akun Anda sendiri.");
    }
    const effectiveRole = parsed.role ?? target.role;
    const effectiveLinkedTeacherId = parsed.linkedTeacherId !== void 0 ? parsed.linkedTeacherId : target.linkedTeacherId;
    const appSettings = await repo.collection("appSettings" /* APP_SETTINGS */).getById("default");
    const requireLinkedTeacher = appSettings?.requireUserLinkedToTeacher ?? true;
    const isModifyingRoleOrTeacherLink = parsed.role !== void 0 || parsed.linkedTeacherId !== void 0;
    if (isModifyingRoleOrTeacherLink && requireLinkedTeacher && effectiveRole !== "SUPER_ADMIN" /* SUPER_ADMIN */ && !effectiveLinkedTeacherId) {
      throw ApiError.badRequest(
        "Pengaturan mewajibkan akun peran ini ditautkan ke profil guru aktif."
      );
    }
    if (effectiveLinkedTeacherId && parsed.linkedTeacherId !== void 0) {
      const nextTeacher = await teacherCol.getById(effectiveLinkedTeacherId);
      if (!nextTeacher) {
        throw ApiError.badRequest("Profil guru yang ditautkan tidak ditemukan.");
      }
      if (nextTeacher.userId && nextTeacher.userId !== target.id) {
        const existingOwner = await col.getById(nextTeacher.userId);
        if (existingOwner) {
          throw ApiError.conflict(
            `Profil guru "${nextTeacher.fullName}" sudah tertaut ke akun "${existingOwner.username}".`
          );
        }
      }
    }
    let usernamePatch = {};
    let reservedNewNormalizedUsername = null;
    if (parsed.username !== void 0) {
      const nextTrimmed = parsed.username.trim();
      const nextNormalized = normalizeUsername(nextTrimmed);
      if (nextNormalized.length < 3) {
        throw ApiError.badRequest("Username minimal 3 karakter.");
      }
      if (nextNormalized !== target.normalizedUsername) {
        reservedNewNormalizedUsername = await reserveUniqueUsername(repo, nextTrimmed, target.id);
        usernamePatch = {
          username: nextTrimmed,
          normalizedUsername: reservedNewNormalizedUsername
        };
      } else if (nextTrimmed !== target.username) {
        usernamePatch = {
          username: nextTrimmed
        };
      }
    }
    let passwordPatch = {};
    const passwordChanged = Boolean(parsed.password && parsed.password.length >= 6);
    if (passwordChanged && parsed.password) {
      const nextHash = await hashPassword(parsed.password);
      passwordPatch = {
        passwordHash: nextHash,
        passwordCipher: encryptPasswordForAdminView(parsed.password),
        failedLoginCount: 0,
        lockedUntil: null
      };
    }
    const nextMustChange = parsed.mustChangePassword !== void 0 ? effectiveRole === "TEACHER" /* TEACHER */ ? false : parsed.mustChangePassword : void 0;
    let updated;
    try {
      updated = await col.update(id, {
        ...usernamePatch,
        ...parsed.role !== void 0 ? { role: parsed.role } : {},
        ...parsed.isActive !== void 0 ? { isActive: parsed.isActive } : {},
        ...parsed.linkedTeacherId !== void 0 ? { linkedTeacherId: parsed.linkedTeacherId } : {},
        ...nextMustChange !== void 0 ? { mustChangePassword: nextMustChange } : {},
        ...passwordPatch
      });
    } catch (err) {
      if (reservedNewNormalizedUsername) {
        await releaseUniqueUsername(repo, reservedNewNormalizedUsername).catch(() => void 0);
      }
      throw err;
    }
    if (!updated) {
      if (reservedNewNormalizedUsername) {
        await releaseUniqueUsername(repo, reservedNewNormalizedUsername).catch(() => void 0);
      }
      throw ApiError.notFound("Akun pengguna tidak ditemukan.");
    }
    if (reservedNewNormalizedUsername && target.normalizedUsername !== reservedNewNormalizedUsername) {
      await releaseUniqueUsername(repo, target.normalizedUsername).catch(() => void 0);
    }
    if (parsed.linkedTeacherId !== void 0 && parsed.linkedTeacherId !== target.linkedTeacherId) {
      if (target.linkedTeacherId) {
        await teacherCol.update(target.linkedTeacherId, { userId: null }).catch(() => void 0);
      }
      if (parsed.linkedTeacherId) {
        await teacherCol.update(parsed.linkedTeacherId, { userId: target.id });
      }
    }
    if (parsed.isActive === false || parsed.role && parsed.role !== target.role || (passwordChanged || Boolean(reservedNewNormalizedUsername)) && target.id !== auth.user.id) {
      await revokeAllUserSessions(repo, target.id);
    }
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: "USER_UPDATED",
      entityType: "USER",
      entityId: target.id,
      before: {
        username: target.username,
        role: target.role,
        isActive: target.isActive,
        linkedTeacherId: target.linkedTeacherId
      },
      after: {
        username: updated.username,
        role: updated.role,
        isActive: updated.isActive,
        linkedTeacherId: updated.linkedTeacherId,
        ...passwordChanged ? { passwordChangedDirectly: true } : {}
      },
      clientIp: auth.clientIp
    });
    const { passwordHash: _omitHash, passwordCipher: _omitCipher, ...safeUpdated } = updated;
    sendOk(res, safeUpdated);
  } catch (err) {
    sendError(res, err);
  }
}

// backend/audit-logs/index.ts
var AUDIT_READ_ROLES = [
  "SUPER_ADMIN" /* SUPER_ADMIN */,
  "ADMIN" /* ADMIN */,
  "PRINCIPAL" /* PRINCIPAL */
];
var PRINCIPAL_VISIBLE_ENTITY_TYPES = /* @__PURE__ */ new Set([
  "ATTENDANCE_RECORD",
  "TEACHER_PERMISSION",
  "ATTENDANCE_REPORT",
  "STUDENT",
  "TEACHER",
  "CLASS",
  "TEACHING_SCHEDULE",
  "ATTENDANCE_RULE",
  "HOLIDAY"
]);
async function handleAuditLogs(req, res, repo = getRepository()) {
  try {
    if (req.method !== "GET") {
      throw new ApiError(
        405,
        "METHOD_NOT_ALLOWED",
        "Log aktivitas bersifat append-only dan hanya dapat dibaca melalui GET."
      );
    }
    const auth = await requireAuth(req, { repo, allowedRoles: AUDIT_READ_ROLES });
    const parsed = auditLogQuerySchema.parse(req.query ?? {});
    const [logsRes, usersRes, teachersRes] = await Promise.all([
      repo.collection("activityLogs" /* ACTIVITY_LOGS */).list({
        sort: { field: "createdAt", direction: "desc" }
      }),
      repo.collection("users" /* USERS */).list(),
      repo.collection("teachers" /* TEACHERS */).list()
    ]);
    const teacherNameMap = new Map(teachersRes.items.map((t) => [t.id, t.fullName]));
    const actorNameMap = new Map(
      usersRes.items.map((u) => [
        u.id,
        (u.linkedTeacherId ? teacherNameMap.get(u.linkedTeacherId) : void 0) ?? u.username
      ])
    );
    const isPrincipal = auth.user.role === "PRINCIPAL" /* PRINCIPAL */;
    const searchLower = parsed.search.toLowerCase();
    const filtered = logsRes.items.filter((log) => {
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
        const logDate = getDateKeyJakarta(log.createdAt ?? (/* @__PURE__ */ new Date()).toISOString());
        if (parsed.dateFrom && logDate < parsed.dateFrom) return false;
        if (parsed.dateTo && logDate > parsed.dateTo) return false;
      }
      if (searchLower) {
        const actorName = actorNameMap.get(log.actorUserId) ?? log.actorUserId;
        const hay = `${log.action} ${log.entityType} ${log.entityId} ${actorName} ${log.reason ?? ""}`.toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }
      return true;
    }).map((log) => ({
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
      createdAt: log.createdAt ?? ""
    }));
    const total = filtered.length;
    let startIdx = 0;
    if (parsed.cursor) {
      const idx = filtered.findIndex((item) => item.id === parsed.cursor);
      if (idx >= 0) startIdx = idx + 1;
    }
    const pageItems = filtered.slice(startIdx, startIdx + parsed.limit);
    const nextCursor = startIdx + parsed.limit < total && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;
    const availableActions = Array.from(new Set(logsRes.items.map((l) => l.action))).sort();
    const actors = usersRes.items.map((u) => ({
      id: u.id,
      label: `${(u.linkedTeacherId ? teacherNameMap.get(u.linkedTeacherId) : void 0) ?? u.username} (${u.role})`
    }));
    sendOk(res, {
      items: pageItems,
      total,
      nextCursor,
      availableActions,
      actors,
      scope: isPrincipal ? "LIMITED_PRINCIPAL" : "FULL_ADMIN"
    });
  } catch (err) {
    sendError(res, err);
  }
}
async function handler63(req, res) {
  await handleAuditLogs(req, res);
}

// backend/manifest.ts
async function resolveBrandingMimeType(repo, assetUrl) {
  const lower = assetUrl.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  const idMatch = assetUrl.match(/[?&]id=([^&]+)/);
  const fileId = idMatch ? decodeURIComponent(idMatch[1]) : null;
  if (fileId) {
    try {
      const publicAsset = await repo.collection("publicBrandingAssets" /* PUBLIC_BRANDING_ASSETS */).getById(fileId);
      if (publicAsset?.mimeType) return publicAsset.mimeType;
    } catch {
    }
    try {
      const meta = await repo.collection("fileMetadata" /* FILE_METADATA */).getById(fileId);
      if (meta?.mimeType) return meta.mimeType;
    } catch {
    }
  }
  return "image/png";
}
async function handleWebManifest(_req, res, repo = getRepository()) {
  let appName = "Absensi Digital";
  let pwaAppName = "MiFUL";
  let schoolName = "MI MIFTAHUL ULUM";
  let themePrimary = "#10264D";
  let themeBackground = "#FFFFFF";
  let icon192 = "/icons/pwa-192x192.png";
  let icon512 = "/icons/pwa-512x512.png";
  let hasCustomLogo = false;
  try {
    const settings = await repo.collection("publicSettings" /* PUBLIC_SETTINGS */).getById("default") ?? (repo.mode === "mock" ? await repo.collection("appSettings" /* APP_SETTINGS */).getById("default") : null);
    if (settings) {
      appName = settings.appName || appName;
      pwaAppName = settings.pwaAppName?.trim() || pwaAppName;
      schoolName = settings.schoolName || schoolName;
      themePrimary = settings.theme?.primary || themePrimary;
      themeBackground = settings.theme?.background || themeBackground;
      const isDefaultLogo = !settings.logoPath || settings.logoPath === "/images/school-logo.jpg" || settings.logoPath === "/images/school-logo.png";
      const customLogoUrl = !isDefaultLogo ? settings.logoPath : null;
      const isDefault192 = !settings.pwaIcon192Path || settings.pwaIcon192Path === "/icons/pwa-192x192.png";
      const isDefault512 = !settings.pwaIcon512Path || settings.pwaIcon512Path === "/icons/pwa-512x512.png";
      const resolved192 = (!isDefault192 ? settings.pwaIcon192Path : null) || customLogoUrl;
      const resolved512 = (!isDefault512 ? settings.pwaIcon512Path : null) || customLogoUrl;
      hasCustomLogo = Boolean(resolved192 || resolved512);
      if (resolved192) icon192 = resolved192;
      if (resolved512) icon512 = resolved512;
    }
  } catch {
  }
  const [icon192Mime, icon512Mime] = await Promise.all([
    resolveBrandingMimeType(repo, icon192),
    resolveBrandingMimeType(repo, icon512)
  ]);
  const manifest = {
    id: "/",
    name: `${pwaAppName} \u2014 ${schoolName}`,
    short_name: pwaAppName,
    description: `${appName} \u2014 Sistem informasi kehadiran siswa dan guru, jadwal mengajar, perizinan, dan laporan resmi ${schoolName}.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "id-ID",
    theme_color: themePrimary,
    background_color: themeBackground,
    icons: [
      {
        src: icon192,
        sizes: "192x192",
        type: icon192Mime,
        purpose: "any"
      },
      {
        src: icon512,
        sizes: "512x512",
        type: icon512Mime,
        purpose: "any"
      },
      {
        src: hasCustomLogo ? icon512 : "/icons/pwa-maskable-512x512.png",
        sizes: "512x512",
        type: hasCustomLogo ? icon512Mime : "image/png",
        purpose: "maskable"
      }
    ]
  };
  res.setHeader?.("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader?.("Cache-Control", "no-cache, must-revalidate");
  res.status(200).json(manifest);
}
async function handler64(req, res) {
  await handleWebManifest(req, res);
}

// backend/createApiApp.ts
var previewInitPromise = null;
function ensureInitializedOnce() {
  if (!previewInitPromise) {
    previewInitPromise = ensurePreviewAccountsInitialized(getRepository()).catch((err) => {
      previewInitPromise = null;
      console.error("Gagal menginisialisasi akun pratinjau:", err);
    });
  }
  return previewInitPromise;
}
function createApiApp() {
  const app2 = express();
  const jsonParser = express.json({ limit: "16mb" });
  app2.set("trust proxy", 1);
  app2.use((req, res, next) => {
    const hasPreParsedBody = req.body !== void 0 && req.body !== null && (typeof req.body !== "object" || Object.keys(req.body).length > 0);
    if (hasPreParsedBody || req.readableEnded) {
      next();
      return;
    }
    jsonParser(req, res, next);
  });
  app2.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), geolocation=(self), bluetooth=(self), microphone=()"
    );
    if (req.path.startsWith("/api/") && req.path !== "/api/branding/asset") {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    }
    next();
  });
  app2.use((req, _res, next) => {
    if (req.path !== "/api/health" && (req.path.startsWith("/api/") || req.path === "/manifest.webmanifest")) {
      void ensureInitializedOnce().then(() => next(), next);
      return;
    }
    next();
  });
  app2.get("/manifest.webmanifest", (req, res) => void handler64(req, res));
  app2.all("/api/manifest", (req, res) => void handler64(req, res));
  const ICON_SLOT_FIELD = {
    "/icons/pwa-192x192.png": "pwaIcon192Path",
    "/icons/apple-touch-icon.png": "pwaIcon192Path",
    "/apple-touch-icon.png": "pwaIcon192Path",
    "/icons/pwa-512x512.png": "pwaIcon512Path",
    "/icons/pwa-maskable-512x512.png": "pwaIcon512Path",
    "/favicon.png": "faviconPath"
  };
  app2.get(
    [
      "/icons/pwa-192x192.png",
      "/icons/pwa-512x512.png",
      "/icons/pwa-maskable-512x512.png",
      "/icons/apple-touch-icon.png",
      "/apple-touch-icon.png",
      "/favicon.png"
    ],
    async (req, res, next) => {
      try {
        const repo = getRepository();
        const settings = await repo.collection("publicSettings" /* PUBLIC_SETTINGS */).getById("default") ?? (repo.mode === "mock" ? await repo.collection("appSettings" /* APP_SETTINGS */).getById("default") : null);
        const field = ICON_SLOT_FIELD[req.path];
        if (!settings || !field) {
          next();
          return;
        }
        const configuredUrl = settings[field];
        const fallbackLogoUrl = settings.logoPath;
        const candidateUrl = configuredUrl && configuredUrl.startsWith("/api/branding/asset") ? configuredUrl : fallbackLogoUrl && fallbackLogoUrl.startsWith("/api/branding/asset") ? fallbackLogoUrl : null;
        if (!candidateUrl) {
          next();
          return;
        }
        const match = candidateUrl.match(/[?&]id=([^&]+)/);
        const fileId = match?.[1] ? decodeURIComponent(match[1]) : null;
        if (!fileId) {
          next();
          return;
        }
        let blob = null;
        const publicAsset = await repo.collection("publicBrandingAssets" /* PUBLIC_BRANDING_ASSETS */).getById(fileId).catch(() => null);
        if (publicAsset?.dataBase64) {
          const buffer = Buffer.from(publicAsset.dataBase64, "base64");
          if (publicAsset.storagePath) {
            putPrivateBlob(publicAsset.storagePath, buffer, publicAsset.mimeType);
          }
          blob = { buffer, mimeType: publicAsset.mimeType };
        }
        if (!blob) {
          const meta = await repo.collection("fileMetadata" /* FILE_METADATA */).getById(fileId).catch(() => null);
          if (meta) {
            blob = getPrivateBlob(meta.storagePath) ?? null;
            if (!blob && typeof meta.dataBase64 === "string" && meta.dataBase64.length > 0) {
              const buffer = Buffer.from(meta.dataBase64, "base64");
              putPrivateBlob(meta.storagePath, buffer, meta.mimeType);
              blob = { buffer, mimeType: meta.mimeType };
            }
          }
        }
        if (!blob) {
          next();
          return;
        }
        res.setHeader("Content-Type", blob.mimeType);
        res.setHeader("Cache-Control", "public, max-age=300");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.status(200).send(blob.buffer);
      } catch {
        next();
      }
    }
  );
  app2.all("/api/health", (req, res) => void handler(req, res));
  app2.all("/api/settings/public", (req, res) => void handler2(req, res));
  app2.all("/api/foundation/overview", (req, res) => void handler3(req, res));
  app2.all("/api/auth/bootstrap", (req, res) => void handler4(req, res));
  app2.all("/api/auth/login", (req, res) => void handler5(req, res));
  app2.all("/api/auth/logout", (req, res) => void handler6(req, res));
  app2.all("/api/auth/me", (req, res) => void handler7(req, res));
  app2.all("/api/auth/change-password", (req, res) => void handler8(req, res));
  app2.all("/api/auth/reset-password", (req, res) => void handler9(req, res));
  app2.all("/api/academic-years", (req, res) => void handler10(req, res));
  app2.all("/api/academic-years/:id", (req, res) => void handleAcademicYearById(req, res, req.params.id));
  app2.all("/api/classes/import", (req, res) => void handler12(req, res));
  app2.all("/api/classes/bulk-delete", (req, res) => void handler13(req, res));
  app2.all("/api/classes", (req, res) => void handler11(req, res));
  app2.all("/api/classes/:id", (req, res) => void handleClassById(req, res, req.params.id));
  app2.all("/api/subjects/import", (req, res) => void handler15(req, res));
  app2.all("/api/subjects/bulk-delete", (req, res) => void handler16(req, res));
  app2.all("/api/subjects", (req, res) => void handler14(req, res));
  app2.all("/api/subjects/:id", (req, res) => void handleSubjectById(req, res, req.params.id));
  app2.all("/api/students/import", (req, res) => void handler18(req, res));
  app2.all("/api/students/bulk-archive", (req, res) => void handler19(req, res));
  app2.all("/api/students/bulk-delete", (req, res) => void handler20(req, res));
  app2.all("/api/students", (req, res) => void handler17(req, res));
  app2.all("/api/students/:id", (req, res) => void handleStudentById(req, res, req.params.id));
  app2.all("/api/teachers/me/schedule", (req, res) => void handler25(req, res));
  app2.all("/api/teachers/import", (req, res) => void handler22(req, res));
  app2.all("/api/teachers/bulk-archive", (req, res) => void handler23(req, res));
  app2.all("/api/teachers/bulk-delete", (req, res) => void handler24(req, res));
  app2.all("/api/teachers", (req, res) => void handler21(req, res));
  app2.all("/api/teachers/:id", (req, res) => void handleTeacherById(req, res, req.params.id));
  app2.all("/api/schedules/import", (req, res) => void handler27(req, res));
  app2.all("/api/schedules/bulk-delete", (req, res) => void handler28(req, res));
  app2.all("/api/schedules", (req, res) => void handler26(req, res));
  app2.all("/api/schedules/:id", (req, res) => void handleScheduleById(req, res, req.params.id));
  app2.all("/api/attendance-rules", (req, res) => void handler29(req, res));
  app2.all("/api/holidays", (req, res) => void handler30(req, res));
  app2.all("/api/holidays/:id", (req, res) => void handleHolidayById(req, res, req.params.id));
  app2.all("/api/qr/tokens", (req, res) => void handler31(req, res));
  app2.all("/api/qr/revoke", (req, res) => void handler32(req, res));
  app2.all("/api/qr/bulk", (req, res) => void handler53(req, res));
  app2.all("/api/portal/status", (req, res) => void handler33(req, res));
  app2.all("/api/portal/activate", (req, res) => void handler34(req, res));
  app2.all("/api/portal/exit", (req, res) => void handler35(req, res));
  app2.all("/api/attendance/scan", (req, res) => void handler36(req, res));
  app2.all("/api/attendance/teacher-self", (req, res) => void handler38(req, res));
  app2.all("/api/attendance/me", (req, res) => void handler39(req, res));
  app2.all("/api/attendance/manual-exception", (req, res) => void handler40(req, res));
  app2.all("/api/attendance/:id/correction", (req, res) => void handleAttendanceCorrection(req, res, req.params.id));
  app2.all("/api/attendance/:id", (req, res) => void handleAttendanceById(req, res, req.params.id));
  app2.all("/api/attendance", (req, res) => void handler37(req, res));
  app2.all("/api/uploads/selfie", (req, res) => void handler41(req, res));
  app2.all("/api/uploads/attachment", (req, res) => void handler46(req, res));
  app2.all("/api/uploads/signed-url", (req, res) => void handler42(req, res));
  app2.all("/api/uploads/file", (req, res) => void handler43(req, res));
  app2.all("/api/locations", (req, res) => void handler44(req, res));
  app2.all("/api/locations/:id", (req, res) => void handleSchoolLocationById(req, res, req.params.id));
  app2.all("/api/settings/gps", (req, res) => void handler45(req, res));
  app2.all("/api/permissions/me", (req, res) => void handler48(req, res));
  app2.all("/api/permissions/:id/admin-review", (req, res) => void handlePermissionAdminReview(req, res, req.params.id));
  app2.all("/api/permissions/:id/decision", (req, res) => void handlePermissionPrincipalDecision(req, res, req.params.id));
  app2.all("/api/permissions/:id/cancel", (req, res) => void handlePermissionCancel(req, res, req.params.id));
  app2.all("/api/permissions/:id", (req, res) => void handlePermissionById(req, res, req.params.id));
  app2.all("/api/permissions", (req, res) => void handler47(req, res));
  app2.all("/api/dashboard/summary", (req, res) => void handler49(req, res));
  app2.all("/api/reports/attendance", (req, res) => void handler50(req, res));
  app2.all("/api/reports/matrix", (req, res) => void handler51(req, res));
  app2.all("/api/reports/export", (req, res) => void handler52(req, res));
  app2.all("/api/settings/branding", (req, res) => void handler55(req, res));
  app2.all("/api/settings/backup", (req, res) => void handler57(req, res));
  app2.all(
    "/api/settings/restore-points/:id/restore",
    (req, res) => void handleRestorePointApply(req, res, req.params.id)
  );
  app2.all(
    "/api/settings/restore-points/:id",
    (req, res) => void handleRestorePointById(req, res, req.params.id)
  );
  app2.all("/api/settings/restore-points", (req, res) => void handler59(req, res));
  app2.all("/api/settings/factory-baseline", (req, res) => void handleFactoryBaseline(req, res));
  app2.all("/api/settings/factory-reset", (req, res) => void handler60(req, res));
  app2.all("/api/settings/restore", (req, res) => void handler58(req, res));
  app2.all("/api/settings", (req, res) => void handler54(req, res));
  app2.all("/api/branding/asset", (req, res) => void handler56(req, res));
  app2.all(
    "/api/users/generate-from-teachers",
    (req, res) => void handler62(req, res)
  );
  app2.all("/api/users/:id", (req, res) => void handleUserById(req, res, req.params.id));
  app2.all("/api/users", (req, res) => void handler61(req, res));
  app2.all("/api/audit-logs", (req, res) => void handler63(req, res));
  return app2;
}

// backend/vercelEntry.ts
var app = createApiApp();
app.use("/api", (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Endpoint API tidak ditemukan."
    }
  });
});
var vercelEntry_default = app;
export {
  vercelEntry_default as default
};

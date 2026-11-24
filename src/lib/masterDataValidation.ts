import { z } from 'zod';
import { Gender, StudentStatus, TeacherStatus } from '../types/enums';
import { nisSchema, niyNipSchema } from './validation';

export const academicYearCreateSchema = z.object({
  label: z
    .string()
    .trim()
    .min(4, 'Label tahun ajaran minimal 4 karakter (contoh: 2026/2027).')
    .max(40),
  semester: z.enum(['Ganjil', 'Genap']).default('Ganjil'),
  startDate: z.string().min(8, 'Tanggal mulai wajib diisi.'),
  endDate: z.string().min(8, 'Tanggal selesai wajib diisi.'),
  isActive: z.boolean().default(false),
});

export const academicYearUpdateSchema = academicYearCreateSchema.partial();

export const schoolClassCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama kelas wajib diisi.').max(20),
  gradeLevel: z.string().trim().min(1, 'Tingkat kelas wajib diisi.').max(10),
  homeroomTeacherId: z.string().trim().nullable().optional().default(null),
  academicYearId: z.string().trim().min(1, 'Tahun ajaran wajib dipilih.'),
  capacity: z.coerce.number().int().min(1).max(100).nullable().optional().default(30),
  isActive: z.boolean().default(true),
});

export const schoolClassUpdateSchema = schoolClassCreateSchema.partial();

export const subjectCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nama mata pelajaran minimal 2 karakter.').max(80),
  code: z
    .string()
    .trim()
    .min(2, 'Kode mata pelajaran minimal 2 karakter.')
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, 'Kode hanya boleh berisi huruf, angka, tanda hubung, atau garis bawah.'),
  defaultToHomeroomTeacher: z.boolean().optional().default(false),
  isActive: z.boolean().default(true),
});

export const subjectUpdateSchema = subjectCreateSchema.partial();

export const subjectImportRowSchema = z.object({
  code: z.string().trim(),
  name: z.string().trim(),
  defaultToHomeroomTeacher: z.union([z.boolean(), z.string().trim()]).optional().default(false),
  isActive: z.union([z.boolean(), z.string().trim()]).optional().default(true),
});

export const subjectImportRequestSchema = z.object({
  mode: z.enum(['preview', 'commit']),
  rows: z.array(subjectImportRowSchema).min(1, 'Minimal 1 baris mata pelajaran untuk diimpor.').max(200),
});

export const studentCreateSchema = z.object({
  nis: nisSchema,
  fullName: z.string().trim().min(2, 'Nama lengkap siswa minimal 2 karakter.').max(120),
  classId: z.string().trim().min(1, 'Kelas wajib dipilih.'),
  gender: z.nativeEnum(Gender).nullable().optional().default(null),
  photoPath: z.string().trim().max(500).nullable().optional().default(null),
  status: z
    .enum([
      StudentStatus.ACTIVE,
      StudentStatus.DEMO_ACTIVE,
      StudentStatus.GRADUATED,
      StudentStatus.TRANSFERRED,
      StudentStatus.INACTIVE,
    ])
    .default(StudentStatus.ACTIVE),
});

export const studentUpdateSchema = studentCreateSchema.partial().extend({
  reason: z.string().trim().max(250).optional(),
});

export const studentImportRowSchema = z.object({
  nis: z.string().trim(),
  fullName: z.string().trim(),
  className: z.string().trim(),
  gender: z.string().trim().optional().default(''),
  status: z.string().trim().optional().default('ACTIVE'),
});

export const studentImportRequestSchema = z.object({
  mode: z.enum(['preview', 'commit']),
  rows: z.array(studentImportRowSchema).min(1, 'Minimal 1 baris data untuk diimpor.').max(500),
});

const teacherWorkingDaysSchema = z
  .array(z.coerce.number().int().min(1).max(7))
  .min(1, 'Minimal pilih 1 hari masuk guru dalam seminggu.')
  .max(7, 'Maksimal 7 hari dalam seminggu.')
  .nullable()
  .optional();

export const teacherCreateSchema = z
  .object({
    niyNip: niyNipSchema,
    fullName: z.string().trim().min(2, 'Nama lengkap guru minimal 2 karakter.').max(120),
    position: z.string().trim().min(2, 'Jabatan wajib diisi.').max(80),
    status: z.enum([TeacherStatus.ACTIVE, TeacherStatus.INACTIVE]).default(TeacherStatus.ACTIVE),
    photoPath: z.string().trim().max(500).nullable().optional().default(null),
    workingDays: teacherWorkingDaysSchema,
    createAccount: z.boolean().optional().default(false),
    username: z.string().trim().max(64).optional(),
    password: z
      .string()
      .min(6, 'Kata sandi akun guru minimal 6 karakter.')
      .max(72, 'Kata sandi akun guru maksimal 72 karakter.')
      .optional(),
  })
  .refine((val) => !val.createAccount || (val.password && val.password.length >= 6), {
    message: 'Kata sandi akun guru wajib diisi minimal 6 karakter.',
    path: ['password'],
  });

export const teacherUpdateSchema = z.object({
  niyNip: niyNipSchema.optional(),
  fullName: z.string().trim().min(2, 'Nama lengkap guru minimal 2 karakter.').max(120).optional(),
  position: z.string().trim().min(2, 'Jabatan wajib diisi.').max(80).optional(),
  status: z.enum([TeacherStatus.ACTIVE, TeacherStatus.INACTIVE]).optional(),
  photoPath: z.string().trim().max(500).nullable().optional(),
  workingDays: teacherWorkingDaysSchema,
  createAccount: z.boolean().optional(),
  username: z.string().trim().max(64).optional(),
  password: z
    .string()
    .min(6, 'Kata sandi akun guru minimal 6 karakter.')
    .max(72, 'Kata sandi akun guru maksimal 72 karakter.')
    .optional(),
});

export const teacherImportRowSchema = z.object({
  niyNip: z.string().trim(),
  fullName: z.string().trim(),
  position: z.string().trim(),
  status: z.string().trim().optional().default('ACTIVE'),
});

export const teacherImportRequestSchema = z.object({
  mode: z.enum(['preview', 'commit']),
  rows: z.array(teacherImportRowSchema).min(1, 'Minimal 1 baris data untuk diimpor.').max(200),
});

export const bulkArchiveSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, 'Pilih minimal 1 data.').max(200),
  reason: z.string().trim().max(250).optional(),
});

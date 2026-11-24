import type {
  AcademicYear,
  Gender,
  SchoolClass,
  Student,
  StudentEnrollment,
  StudentStatus,
  Subject,
  Teacher,
  TeacherStatus,
  UserRole,
} from '../types';
import { apiRequest } from './apiClient';

export interface EnrichedClass extends SchoolClass {
  homeroomTeacherName: string | null;
  academicYearLabel: string;
  studentCount: number;
}

export interface EnrichedStudent extends Student {
  className: string;
  isDemo: boolean;
}

export interface StudentDetailResponse extends EnrichedStudent {
  enrollments: Array<
    StudentEnrollment & {
      className: string;
      academicYearLabel: string;
    }
  >;
}

export interface StudentListResponse {
  items: EnrichedStudent[];
  total: number;
  nextCursor: string | null;
  totalDemoStudents: number;
}

export interface EnrichedTeacher extends Teacher {
  username: string | null;
  accountRole: UserRole | null;
  accountActive: boolean;
  mustChangePassword: boolean;
}

export interface TeacherListResponse {
  items: EnrichedTeacher[];
  total: number;
  nextCursor: string | null;
}

export interface StudentImportRowInput {
  nis: string;
  fullName: string;
  className: string;
  gender?: string;
  status?: string;
}

export interface StudentImportPreviewResponse {
  mode: 'preview';
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: Array<{
    rowNumber: number;
    nis: string;
    fullName: string;
    className: string;
    classId: string | null;
    gender: Gender | null;
    status: StudentStatus;
    valid: boolean;
    errors: string[];
  }>;
}

export interface TeacherImportRowInput {
  niyNip: string;
  fullName: string;
  position: string;
  status?: string;
}

export interface TeacherImportPreviewResponse {
  mode: 'preview';
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: Array<{
    rowNumber: number;
    niyNip: string;
    fullName: string;
    position: string;
    status: TeacherStatus;
    valid: boolean;
    errors: string[];
  }>;
}

export interface SubjectImportRowInput {
  code: string;
  name: string;
  defaultToHomeroomTeacher?: boolean | string;
  isActive?: boolean | string;
}

export interface SubjectImportPreviewResponse {
  mode: 'preview';
  total: number;
  validCount: number;
  invalidCount: number;
  rows: Array<{
    rowNumber: number;
    code: string;
    name: string;
    defaultToHomeroomTeacher: boolean;
    isActive: boolean;
    valid: boolean;
    errors: string[];
  }>;
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

export const masterDataService = {
  // Academic Years
  listAcademicYears() {
    return apiRequest<{ items: AcademicYear[]; total: number }>('/api/academic-years');
  },
  createAcademicYear(payload: {
    label: string;
    semester: 'Ganjil' | 'Genap';
    startDate: string;
    endDate: string;
    isActive: boolean;
  }) {
    return apiRequest<AcademicYear>('/api/academic-years', {
      method: 'POST',
      body: payload,
    });
  },
  updateAcademicYear(
    id: string,
    payload: Partial<{
      label: string;
      semester: 'Ganjil' | 'Genap';
      startDate: string;
      endDate: string;
      isActive: boolean;
    }>,
  ) {
    return apiRequest<AcademicYear>(`/api/academic-years/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  // Classes
  listClasses(params?: { search?: string; academicYearId?: string; isActive?: string }) {
    return apiRequest<{ items: EnrichedClass[]; total: number }>(
      `/api/classes${buildQuery(params ?? {})}`,
    );
  },
  createClass(payload: {
    name: string;
    gradeLevel: string;
    homeroomTeacherId: string | null;
    academicYearId: string;
    capacity: number | null;
    isActive: boolean;
  }) {
    return apiRequest<SchoolClass>('/api/classes', {
      method: 'POST',
      body: payload,
    });
  },
  updateClass(
    id: string,
    payload: Partial<{
      name: string;
      gradeLevel: string;
      homeroomTeacherId: string | null;
      academicYearId: string;
      capacity: number | null;
      isActive: boolean;
    }>,
  ) {
    return apiRequest<SchoolClass>(`/api/classes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },
  deleteClass(id: string) {
    return apiRequest<{ deleted: boolean; id: string }>(
      `/api/classes/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },
  bulkDeleteClasses(ids: string[]) {
    return apiRequest<{ deletedCount: number; deletedIds: string[]; failedIds: Array<{ id: string; reason: string }> }>(
      '/api/classes/bulk-delete',
      {
        method: 'POST',
        body: { ids },
      },
    );
  },
  previewClassesImport(rows: Array<Record<string, unknown>>) {
    return apiRequest<{
      mode: 'preview';
      total: number;
      validCount: number;
      invalidCount: number;
      rows: Array<{
        rowNumber: number;
        name: string;
        gradeLevel: string;
        academicYearLabel: string;
        homeroomTeacherName: string;
        capacity: number;
        isActive: boolean;
        valid: boolean;
        errors: string[];
      }>;
    }>('/api/classes/import', {
      method: 'POST',
      body: { mode: 'preview', rows },
    });
  },
  commitClassesImport(rows: Array<Record<string, unknown>>) {
    return apiRequest<{ mode: 'commit'; importedCount: number }>('/api/classes/import', {
      method: 'POST',
      body: { mode: 'commit', rows },
    });
  },

  // Subjects
  listSubjects(params?: { search?: string; isActive?: string }) {
    return apiRequest<{ items: Subject[]; total: number }>(
      `/api/subjects${buildQuery(params ?? {})}`,
    );
  },
  createSubject(payload: {
    name: string;
    code: string;
    defaultToHomeroomTeacher?: boolean;
    isActive: boolean;
  }) {
    return apiRequest<Subject>('/api/subjects', {
      method: 'POST',
      body: payload,
    });
  },
  updateSubject(
    id: string,
    payload: Partial<{
      name: string;
      code: string;
      defaultToHomeroomTeacher: boolean;
      isActive: boolean;
    }>,
  ) {
    return apiRequest<Subject>(`/api/subjects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },
  previewSubjectsImport(rows: SubjectImportRowInput[]) {
    return apiRequest<SubjectImportPreviewResponse>('/api/subjects/import', {
      method: 'POST',
      body: { mode: 'preview', rows },
    });
  },
  commitSubjectsImport(rows: SubjectImportRowInput[]) {
    return apiRequest<{ mode: 'commit'; importedCount: number }>('/api/subjects/import', {
      method: 'POST',
      body: { mode: 'commit', rows },
    });
  },
  bulkDeleteSubjects(ids: string[]) {
    return apiRequest<{ deletedCount: number; deletedIds: string[]; failedIds: Array<{ id: string; reason: string }> }>(
      '/api/subjects/bulk-delete',
      {
        method: 'POST',
        body: { ids },
      },
    );
  },

  // Students
  listStudents(params?: {
    search?: string;
    classId?: string;
    status?: string;
    isDemo?: string;
    cursor?: string;
    limit?: number;
  }) {
    return apiRequest<StudentListResponse>(`/api/students${buildQuery(params ?? {})}`);
  },
  getStudent(id: string) {
    return apiRequest<StudentDetailResponse>(`/api/students/${encodeURIComponent(id)}`);
  },
  createStudent(payload: {
    nis: string;
    fullName: string;
    classId: string;
    gender: Gender | null;
    photoPath?: string | null;
    status: StudentStatus;
  }) {
    return apiRequest<EnrichedStudent>('/api/students', {
      method: 'POST',
      body: payload,
    });
  },
  updateStudent(
    id: string,
    payload: Partial<{
      nis: string;
      fullName: string;
      classId: string;
      gender: Gender | null;
      photoPath: string | null;
      status: StudentStatus;
      reason: string;
    }>,
  ) {
    return apiRequest<EnrichedStudent>(`/api/students/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },
  archiveStudent(id: string) {
    return apiRequest<{ archived: boolean; student: Student }>(
      `/api/students/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },
  deleteStudent(id: string) {
    return apiRequest<{ deleted: boolean; id: string }>(
      `/api/students/${encodeURIComponent(id)}?permanent=true`,
      { method: 'DELETE' },
    );
  },
  bulkArchiveStudents(ids: string[], reason?: string) {
    return apiRequest<{ archivedCount: number }>('/api/students/bulk-archive', {
      method: 'POST',
      body: { ids, reason },
    });
  },
  bulkDeleteStudents(ids: string[], reason?: string) {
    return apiRequest<{ deletedCount: number }>('/api/students/bulk-delete', {
      method: 'POST',
      body: { ids, reason },
    });
  },
  previewStudentsImport(rows: StudentImportRowInput[]) {
    return apiRequest<StudentImportPreviewResponse>('/api/students/import', {
      method: 'POST',
      body: { mode: 'preview', rows },
    });
  },
  commitStudentsImport(rows: StudentImportRowInput[]) {
    return apiRequest<{ mode: 'commit'; importedCount: number; createdIds: string[] }>(
      '/api/students/import',
      {
        method: 'POST',
        body: { mode: 'commit', rows },
      },
    );
  },

  // Teachers
  listTeachers(params?: {
    search?: string;
    status?: string;
    cursor?: string;
    limit?: number;
  }) {
    return apiRequest<TeacherListResponse>(`/api/teachers${buildQuery(params ?? {})}`);
  },
  createTeacher(payload: {
    niyNip: string;
    fullName: string;
    position: string;
    status: TeacherStatus;
    photoPath?: string | null;
    workingDays?: number[] | null;
    createAccount?: boolean;
    username?: string;
    password?: string;
  }) {
    return apiRequest<{
      teacher: EnrichedTeacher;
      accountProvisioned?: {
        username: string;
        mustChangePassword: boolean;
      };
    }>('/api/teachers', {
      method: 'POST',
      body: payload,
    });
  },
  updateTeacher(
    id: string,
    payload: Partial<{
      niyNip: string;
      fullName: string;
      position: string;
      status: TeacherStatus;
      photoPath: string | null;
      workingDays: number[] | null;
      createAccount: boolean;
      username: string;
      password: string;
    }>,
  ) {
    return apiRequest<{
      teacher: Teacher;
      accountProvisioned?: {
        username: string;
        mustChangePassword: boolean;
      };
    }>(`/api/teachers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },
  archiveTeacher(id: string) {
    return apiRequest<{ archived: boolean; teacher: Teacher }>(
      `/api/teachers/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },
  deleteTeacher(id: string) {
    return apiRequest<{ deleted: boolean; id: string }>(
      `/api/teachers/${encodeURIComponent(id)}?permanent=true`,
      { method: 'DELETE' },
    );
  },
  bulkArchiveTeachers(ids: string[], reason?: string) {
    return apiRequest<{ archivedCount: number }>('/api/teachers/bulk-archive', {
      method: 'POST',
      body: { ids, reason },
    });
  },
  bulkDeleteTeachers(ids: string[], reason?: string) {
    return apiRequest<{ deletedCount: number }>('/api/teachers/bulk-delete', {
      method: 'POST',
      body: { ids, reason },
    });
  },
  previewTeachersImport(rows: TeacherImportRowInput[]) {
    return apiRequest<TeacherImportPreviewResponse>('/api/teachers/import', {
      method: 'POST',
      body: { mode: 'preview', rows },
    });
  },
  commitTeachersImport(rows: TeacherImportRowInput[]) {
    return apiRequest<{ mode: 'commit'; importedCount: number; createdIds: string[] }>(
      '/api/teachers/import',
      {
        method: 'POST',
        body: { mode: 'commit', rows },
      },
    );
  },
};

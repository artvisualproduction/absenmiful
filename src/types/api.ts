export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, string[]> | unknown;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  serverTime: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
  serverTime: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  nextCursor?: string | null;
}

export interface FoundationOverviewData {
  dataMode: 'mock' | 'real' | 'mysql';
  schoolName: string;
  appName: string;
  timezone: string;
  activeAcademicYear: string;
  counts: {
    teachers: number;
    students: number;
    demoStudents: number;
    classes: number;
    subjects: number;
  };
  teachers: Array<{
    id: string;
    niyNip: string;
    fullName: string;
    position: string;
    status: string;
  }>;
  students: Array<{
    id: string;
    nis: string;
    fullName: string;
    className: string;
    status: string;
    isDemo: boolean;
  }>;
  classes: Array<{
    id: string;
    name: string;
    gradeLevel: string;
    studentCount: number;
  }>;
}

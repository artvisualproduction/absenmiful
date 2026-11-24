import type { ReportDimension, ReportPeriod } from '../lib/reportValidation';
import type { QrOwnerType, UserRole } from '../types';
import { apiRequest } from './apiClient';
import type { EnrichedPermission } from './permissionService';

export interface AttendanceReportPersonRow {
  id: string;
  personType: QrOwnerType;
  personId: string;
  fullName: string;
  identifier: string;
  classId: string | null;
  className: string | null;
  workingDays: number;
  present: number;
  late: number;
  sick: number;
  excused: number;
  absent: number;
  hlt?: number;
  missingCheckIn: number;
  missingCheckOut: number;
  attendanceRate: number;
}

export interface AttendanceTrendPoint {
  date: string;
  label: string;
  present: number;
  late: number;
  excusedSick: number;
  absent: number;
  totalExpected: number;
}

export interface ClassRecapRow {
  id: string;
  classId: string;
  className: string;
  gradeLevel: number;
  totalStudents: number;
  present: number;
  late: number;
  excusedSick: number;
  absent: number;
  missingCheckIn: number;
  missingCheckOut: number;
  attendanceRate: number;
}

export interface AttendanceReportResponse {
  schoolName: string;
  generatedAt: string;
  period: ReportPeriod;
  dateFrom: string;
  dateTo: string;
  dimension: ReportDimension;
  workingDaysCount: number;
  approvedPermissionAffectsRecap: boolean;
  appliedFilters: {
    period: ReportPeriod;
    dateFrom: string;
    dateTo: string;
    dimension: ReportDimension;
    classId: string | null;
    status: string | null;
    search: string | null;
  };
  summary: {
    totalPeople: number;
    totalWorkingPersonDays: number;
    present: number;
    late: number;
    sick: number;
    excused: number;
    absent: number;
    hlt?: number;
    missingCheckIn: number;
    missingCheckOut: number;
    attendanceRate: number;
  };
  trend: AttendanceTrendPoint[];
  classBreakdown: ClassRecapRow[];
  items: AttendanceReportPersonRow[];
  total: number;
  nextCursor: string | null;
}

export interface ReportExportResponse extends AttendanceReportResponse {
  format: 'XLSX' | 'PDF' | 'PRINT';
  generatedBy: string;
  generatedByRole: UserRole;
}

export interface DashboardActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  actorRole: UserRole;
  reason: string | null;
  createdAt: string;
}

export interface DashboardSummaryResponse {
  schoolName: string;
  selectedDate: string;
  dimension: ReportDimension;
  kpis: {
    activeStudents: number;
    demoStudents: number;
    activeTeachers: number;
    activeClasses: number;
    presentToday: number;
    lateToday: number;
    excusedSickToday: number;
    absentToday: number;
    missingCheckInToday: number;
    missingCheckOutToday: number;
    attendanceRateToday: number;
    pendingAdminPermissions: number;
    pendingPrincipalPermissions: number;
  };
  trend: AttendanceTrendPoint[];
  classBreakdown: ClassRecapRow[];
  pendingPrincipalList: EnrichedPermission[];
  recentDecisions: EnrichedPermission[];
  recentActivities: DashboardActivityItem[];
  classes: Array<{ id: string; name: string; gradeLevel: number }>;
}

export type MatrixCellCode = 'H' | 'T' | 'S' | 'I' | 'A' | 'L' | 'HLT' | '-';

export interface MatrixDateColumn {
  date: string;
  dayLabel: string;
  dayNum: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName: string | null;
}

export interface MatrixPersonRow {
  id: string;
  personType: QrOwnerType;
  identifier: string;
  fullName: string;
  groupLabel: string;
  cells: Record<string, MatrixCellCode>;
  summary: {
    present: number;
    late: number;
    sick: number;
    excused: number;
    absent: number;
    hlt?: number;
    workingDays: number;
    ratePercent: number;
  };
}

export interface AttendanceMatrixResponse {
  schoolName: string;
  generatedAt: string;
  period: 'weekly' | 'monthly' | 'custom';
  dateFrom: string;
  dateTo: string;
  dimension: 'STUDENT' | 'TEACHER';
  classId: string | null;
  dates: MatrixDateColumn[];
  rows: MatrixPersonRow[];
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

export const reportService = {
  getDashboardSummary(params?: {
    date?: string;
    classId?: string;
    dimension?: ReportDimension;
    status?: string;
  }) {
    return apiRequest<DashboardSummaryResponse>(
      `/api/dashboard/summary${buildQuery(params ?? {})}`,
    );
  },

  getAttendanceReport(params: {
    period: ReportPeriod;
    referenceDate?: string;
    dateFrom?: string;
    dateTo?: string;
    dimension: ReportDimension;
    classId?: string;
    status?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }) {
    return apiRequest<AttendanceReportResponse>(
      `/api/reports/attendance${buildQuery(params)}`,
    );
  },

  getAttendanceMatrix(params: {
    period: 'weekly' | 'monthly' | 'custom';
    referenceDate?: string;
    dateFrom?: string;
    dateTo?: string;
    dimension: 'STUDENT' | 'TEACHER';
    classId?: string;
    search?: string;
  }) {
    return apiRequest<AttendanceMatrixResponse>(
      `/api/reports/matrix${buildQuery(params)}`,
    );
  },

  exportAttendanceReport(payload: {
    format: 'XLSX' | 'PDF' | 'PRINT';
    period: ReportPeriod;
    referenceDate?: string;
    dateFrom?: string;
    dateTo?: string;
    dimension: ReportDimension;
    classId?: string;
    status?: string;
    search?: string;
  }) {
    return apiRequest<ReportExportResponse>('/api/reports/export', {
      method: 'POST',
      body: payload,
    });
  },
};

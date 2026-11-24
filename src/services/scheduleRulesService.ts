import type {
  AttendanceAudience,
  AttendanceRule,
  Holiday,
  HolidayScope,
  TeachingSchedule,
} from '../types';
import { apiRequest } from './apiClient';

export interface EnrichedTeachingSchedule extends TeachingSchedule {
  teacherName: string;
  subjectName: string;
  subjectCode: string;
  className: string;
}

export interface MyTeacherScheduleItem extends TeachingSchedule {
  subjectName: string;
  subjectCode: string;
  className: string;
}

export interface MyTeacherScheduleResponse {
  todayDate: string;
  todayDayOfWeek: number;
  teacherWorkingDays?: number[];
  teacherHltDays?: number[];
  isTodayHlt?: boolean;
  teacherRule?: AttendanceRule | null;
  todaySchedules: MyTeacherScheduleItem[];
  upcomingSchedules: MyTeacherScheduleItem[];
  weeklySchedules: MyTeacherScheduleItem[];
}

export interface CreateSchedulePayload {
  teacherId: string;
  subjectId: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
}

export interface CreateAttendanceRulePayload {
  name: string;
  audience: AttendanceAudience;
  classIds: string[];
  daysOfWeek: number[];
  checkInStart: string;
  lateAfter: string;
  lateToleranceMinutes: number;
  checkInDeadline: string;
  checkOutStart: string;
  checkOutDeadline: string;
  gpsRequired: boolean;
  geofenceRequired: boolean;
  effectiveFrom: string;
  isActive: boolean;
}

export interface CreateHolidayPayload {
  date: string;
  name: string;
  scope: HolidayScope;
  isActive: boolean;
}

export interface ScheduleImportRowInput {
  className: string;
  subjectCodeOrName: string;
  dayOfWeek: number | string;
  startTime: string;
  endTime: string;
  teacherNiyOrName?: string;
  useHomeroomTeacher?: boolean | string;
  room?: string;
  isActive?: boolean | string;
}

export interface ScheduleImportPreviewResponse {
  mode: 'preview';
  total: number;
  validCount: number;
  invalidCount: number;
  rows: Array<{
    rowNumber: number;
    className: string;
    classId: string | null;
    subjectLabel: string;
    subjectId: string | null;
    teacherName: string;
    teacherId: string | null;
    useHomeroomTeacher: boolean;
    dayOfWeek: number | null;
    dayLabel: string;
    startTime: string;
    endTime: string;
    room: string | null;
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

export const scheduleRulesService = {
  // Schedules (Admin / Principal)
  listSchedules(params?: {
    teacherId?: string;
    classId?: string;
    dayOfWeek?: string;
    isActive?: string;
  }) {
    return apiRequest<{ items: EnrichedTeachingSchedule[]; total: number }>(
      `/api/schedules${buildQuery(params ?? {})}`,
    );
  },

  createSchedule(payload: CreateSchedulePayload) {
    return apiRequest<TeachingSchedule>('/api/schedules', {
      method: 'POST',
      body: payload,
    });
  },

  updateSchedule(id: string, payload: Partial<CreateSchedulePayload>) {
    return apiRequest<TeachingSchedule>(`/api/schedules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  archiveSchedule(id: string) {
    return apiRequest<{ archived: boolean; schedule: TeachingSchedule }>(
      `/api/schedules/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },

  previewSchedulesImport(rows: ScheduleImportRowInput[], effectiveFrom?: string) {
    return apiRequest<ScheduleImportPreviewResponse>('/api/schedules/import', {
      method: 'POST',
      body: { mode: 'preview', rows, ...(effectiveFrom ? { effectiveFrom } : {}) },
    });
  },

  commitSchedulesImport(rows: ScheduleImportRowInput[], effectiveFrom?: string) {
    return apiRequest<{ mode: 'commit'; importedCount: number }>('/api/schedules/import', {
      method: 'POST',
      body: { mode: 'commit', rows, ...(effectiveFrom ? { effectiveFrom } : {}) },
    });
  },

  bulkDeleteSchedules(ids: string[]) {
    return apiRequest<{ deletedCount: number; deletedIds: string[] }>('/api/schedules/bulk-delete', {
      method: 'POST',
      body: { ids },
    });
  },

  // Teacher's own schedule (strictly scoped on server)
  getMyTeacherSchedule() {
    return apiRequest<MyTeacherScheduleResponse>('/api/teachers/me/schedule');
  },

  // Versioned Attendance Rules
  listAttendanceRules(params?: { audience?: AttendanceAudience; activeOnly?: string }) {
    return apiRequest<{ items: AttendanceRule[]; total: number }>(
      `/api/attendance-rules${buildQuery(params ?? {})}`,
    );
  },

  createAttendanceRuleVersion(payload: CreateAttendanceRulePayload) {
    return apiRequest<AttendanceRule>('/api/attendance-rules', {
      method: 'POST',
      body: payload,
    });
  },

  // Holidays & Exceptions
  listHolidays() {
    return apiRequest<{ items: Holiday[]; total: number }>('/api/holidays');
  },

  createHoliday(payload: CreateHolidayPayload) {
    return apiRequest<Holiday>('/api/holidays', {
      method: 'POST',
      body: payload,
    });
  },

  updateHoliday(id: string, payload: Partial<CreateHolidayPayload>) {
    return apiRequest<Holiday>(`/api/holidays/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  archiveHoliday(id: string) {
    return apiRequest<{ archived: boolean; holiday: Holiday }>(
      `/api/holidays/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },

  previewHolidaysImport(rows: Array<Record<string, unknown>>) {
    return apiRequest<{
      total: number;
      validCount: number;
      invalidCount: number;
      rows: Array<{
        rowNumber: number;
        date: string;
        name: string;
        scope: HolidayScope;
        scopeLabel: string;
        isActive: boolean;
        valid: boolean;
        errors: string[];
      }>;
    }>('/api/holidays/import', {
      method: 'POST',
      body: { mode: 'preview', rows },
    });
  },

  commitHolidaysImport(rows: Array<Record<string, unknown>>) {
    return apiRequest<{
      success: boolean;
      importedCount: number;
      items: Array<{ id: string; date: string; name: string; scope: string }>;
    }>('/api/holidays/import', {
      method: 'POST',
      body: { mode: 'commit', rows },
    });
  },
};

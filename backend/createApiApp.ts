import express, { type Express } from 'express';
import { CollectionName } from '../src/types';
import { ensurePreviewAccountsInitialized } from './_lib/auth/bootstrapService';
import { getRepository } from './_lib/repository';
import { getPrivateBlob, putPrivateBlob } from './_lib/storage/privateStorage';
import healthHandler from './health';
import publicSettingsHandler from './settings/public';
import foundationOverviewHandler from './foundation/overview';
import bootstrapHandler from './auth/bootstrap';
import loginHandler from './auth/login';
import logoutHandler from './auth/logout';
import meHandler from './auth/me';
import changePasswordHandler from './auth/change-password';
import resetPasswordHandler from './auth/reset-password';
import academicYearsHandler from './academic-years/index';
import { handleAcademicYearById } from './academic-years/[id]';
import classesHandler from './classes/index';
import classesImportHandler from './classes/import';
import classesBulkDeleteHandler from './classes/bulk-delete';
import { handleClassById } from './classes/[id]';
import subjectsHandler from './subjects/index';
import subjectsImportHandler from './subjects/import';
import subjectsBulkDeleteHandler from './subjects/bulk-delete';
import { handleSubjectById } from './subjects/[id]';
import studentsHandler from './students/index';
import { handleStudentById } from './students/[id]';
import studentsImportHandler from './students/import';
import studentsBulkArchiveHandler from './students/bulk-archive';
import studentsBulkDeleteHandler from './students/bulk-delete';
import teachersHandler from './teachers/index';
import { handleTeacherById } from './teachers/[id]';
import teachersImportHandler from './teachers/import';
import teachersBulkArchiveHandler from './teachers/bulk-archive';
import teachersBulkDeleteHandler from './teachers/bulk-delete';
import myTeacherScheduleHandler from './teachers/me/schedule';
import schedulesHandler from './schedules/index';
import schedulesImportHandler from './schedules/import';
import schedulesBulkDeleteHandler from './schedules/bulk-delete';
import { handleScheduleById } from './schedules/[id]';
import attendanceRulesHandler from './attendance-rules/index';
import holidaysHandler, { handleHolidayById } from './holidays/index';
import qrTokensHandler from './qr/tokens';
import qrRevokeHandler from './qr/revoke';
import portalStatusHandler from './portal/status';
import portalActivateHandler from './portal/activate';
import portalExitHandler from './portal/exit';
import attendanceScanHandler from './attendance/scan';
import attendanceListHandler from './attendance/index';
import { handleAttendanceCorrection } from './attendance/[id]/correction';
import { handleAttendanceById } from './attendance/[id]';
import teacherSelfAttendanceHandler from './attendance/teacher-self';
import myAttendanceHandler from './attendance/me';
import manualExceptionHandler from './attendance/manual-exception';
import uploadSelfieHandler from './uploads/selfie';
import signedUrlHandler from './uploads/signed-url';
import servePrivateFileHandler from './uploads/file';
import schoolLocationsHandler from './locations/index';
import { handleSchoolLocationById } from './locations/[id]';
import gpsSettingsHandler from './settings/gps';
import uploadAttachmentHandler from './uploads/attachment';
import permissionsHandler from './permissions/index';
import myPermissionsHandler from './permissions/me';
import { handlePermissionAdminReview } from './permissions/[id]/admin-review';
import { handlePermissionPrincipalDecision } from './permissions/[id]/decision';
import { handlePermissionById, handlePermissionCancel } from './permissions/[id]/cancel';
import dashboardSummaryHandler from './dashboard/summary';
import attendanceReportHandler from './reports/attendance';
import attendanceMatrixHandler from './reports/matrix';
import reportExportHandler from './reports/export';
import qrBulkHandler from './qr/bulk';
import appSettingsHandler from './settings/index';
import brandingUploadHandler from './settings/branding';
import brandingAssetHandler from './branding/asset';
import settingsBackupHandler from './settings/backup';
import settingsRestoreHandler from './settings/restore';
import restorePointsHandler, {
  handleFactoryBaseline,
  handleRestorePointApply,
  handleRestorePointById,
} from './settings/restore-points';
import factoryResetHandler from './settings/factory-reset';
import usersHandler from './users/index';
import generateUsersFromTeachersHandler from './users/generate';
import { handleUserById } from './users/[id]';
import auditLogsHandler from './audit-logs/index';
import manifestHandler from './manifest';

let previewInitPromise: Promise<void> | null = null;

function ensureInitializedOnce(): Promise<void> {
  if (!previewInitPromise) {
    previewInitPromise = ensurePreviewAccountsInitialized(getRepository()).catch((err) => {
      previewInitPromise = null;
      console.error('Gagal menginisialisasi akun pratinjau:', err);
    });
  }
  return previewInitPromise;
}

export function createApiApp(): Express {
  const app = express();
  const jsonParser = express.json({ limit: '16mb' });

  app.set('trust proxy', 1);

  // Safely parse JSON bodies in both standalone Express and Vercel Serverless (which may pre-parse req.body)
  app.use((req, res, next) => {
    const hasPreParsedBody =
      req.body !== undefined &&
      req.body !== null &&
      (typeof req.body !== 'object' || Object.keys(req.body as Record<string, unknown>).length > 0);
    if (hasPreParsedBody || req.readableEnded) {
      next();
      return;
    }
    jsonParser(req, res, next);
  });

  // Baseline security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), geolocation=(self), bluetooth=(self), microphone=()',
    );
    if (req.path.startsWith('/api/') && req.path !== '/api/branding/asset') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
  });

  // Ensure baseline collections & default accounts exist on first API request (idempotent; skips /api/health for fast probes).
  app.use((req, _res, next) => {
    if (
      req.path !== '/api/health' &&
      (req.path.startsWith('/api/') || req.path === '/manifest.webmanifest')
    ) {
      void ensureInitializedOnce().then(() => next(), next);
      return;
    }
    next();
  });

  // Dynamic Web App Manifest & PWA Icons synced with AppSettings
  app.get('/manifest.webmanifest', (req, res) => void manifestHandler(req, res));
  app.all('/api/manifest', (req, res) => void manifestHandler(req, res));

  const ICON_SLOT_FIELD: Record<string, 'pwaIcon192Path' | 'pwaIcon512Path' | 'faviconPath'> = {
    '/icons/pwa-192x192.png': 'pwaIcon192Path',
    '/icons/apple-touch-icon.png': 'pwaIcon192Path',
    '/apple-touch-icon.png': 'pwaIcon192Path',
    '/icons/pwa-512x512.png': 'pwaIcon512Path',
    '/icons/pwa-maskable-512x512.png': 'pwaIcon512Path',
    '/favicon.png': 'faviconPath',
  };

  app.get(
    [
      '/icons/pwa-192x192.png',
      '/icons/pwa-512x512.png',
      '/icons/pwa-maskable-512x512.png',
      '/icons/apple-touch-icon.png',
      '/apple-touch-icon.png',
      '/favicon.png',
    ],
    async (req, res, next) => {
      try {
        const repo = getRepository();
        const settings =
          (await repo.collection(CollectionName.PUBLIC_SETTINGS).getById('default')) ??
          (repo.mode === 'mock'
            ? await repo.collection(CollectionName.APP_SETTINGS).getById('default')
            : null);
        const field = ICON_SLOT_FIELD[req.path];
        if (!settings || !field) {
          next();
          return;
        }
        const configuredUrl = settings[field];
        const fallbackLogoUrl = settings.logoPath;
        const candidateUrl =
          configuredUrl && configuredUrl.startsWith('/api/branding/asset')
            ? configuredUrl
            : fallbackLogoUrl && fallbackLogoUrl.startsWith('/api/branding/asset')
              ? fallbackLogoUrl
              : null;
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

        let blob: { buffer: Buffer; mimeType: string } | null = null;
        const publicAsset = await repo
          .collection(CollectionName.PUBLIC_BRANDING_ASSETS)
          .getById(fileId)
          .catch(() => null);
        if (publicAsset?.dataBase64) {
          const buffer = Buffer.from(publicAsset.dataBase64, 'base64');
          if (publicAsset.storagePath) {
            putPrivateBlob(publicAsset.storagePath, buffer, publicAsset.mimeType);
          }
          blob = { buffer, mimeType: publicAsset.mimeType };
        }
        if (!blob) {
          const meta = await repo
            .collection(CollectionName.FILE_METADATA)
            .getById(fileId)
            .catch(() => null);
          if (meta) {
            blob = getPrivateBlob(meta.storagePath) ?? null;
            if (!blob && typeof meta.dataBase64 === 'string' && meta.dataBase64.length > 0) {
              const buffer = Buffer.from(meta.dataBase64, 'base64');
              putPrivateBlob(meta.storagePath, buffer, meta.mimeType);
              blob = { buffer, mimeType: meta.mimeType };
            }
          }
        }
        if (!blob) {
          next();
          return;
        }
        res.setHeader('Content-Type', blob.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(200).send(blob.buffer);
      } catch {
        next();
      }
    },
  );

  // Foundation
  app.all('/api/health', (req, res) => void healthHandler(req, res));
  app.all('/api/settings/public', (req, res) => void publicSettingsHandler(req, res));
  app.all('/api/foundation/overview', (req, res) => void foundationOverviewHandler(req, res));

  // Auth
  app.all('/api/auth/bootstrap', (req, res) => void bootstrapHandler(req, res));
  app.all('/api/auth/login', (req, res) => void loginHandler(req, res));
  app.all('/api/auth/logout', (req, res) => void logoutHandler(req, res));
  app.all('/api/auth/me', (req, res) => void meHandler(req, res));
  app.all('/api/auth/change-password', (req, res) => void changePasswordHandler(req, res));
  app.all('/api/auth/reset-password', (req, res) => void resetPasswordHandler(req, res));

  // Master Data
  app.all('/api/academic-years', (req, res) => void academicYearsHandler(req, res));
  app.all('/api/academic-years/:id', (req, res) => void handleAcademicYearById(req, res, req.params.id));

  app.all('/api/classes/import', (req, res) => void classesImportHandler(req, res));
  app.all('/api/classes/bulk-delete', (req, res) => void classesBulkDeleteHandler(req, res));
  app.all('/api/classes', (req, res) => void classesHandler(req, res));
  app.all('/api/classes/:id', (req, res) => void handleClassById(req, res, req.params.id));

  app.all('/api/subjects/import', (req, res) => void subjectsImportHandler(req, res));
  app.all('/api/subjects/bulk-delete', (req, res) => void subjectsBulkDeleteHandler(req, res));
  app.all('/api/subjects', (req, res) => void subjectsHandler(req, res));
  app.all('/api/subjects/:id', (req, res) => void handleSubjectById(req, res, req.params.id));

  app.all('/api/students/import', (req, res) => void studentsImportHandler(req, res));
  app.all('/api/students/bulk-archive', (req, res) => void studentsBulkArchiveHandler(req, res));
  app.all('/api/students/bulk-delete', (req, res) => void studentsBulkDeleteHandler(req, res));
  app.all('/api/students', (req, res) => void studentsHandler(req, res));
  app.all('/api/students/:id', (req, res) => void handleStudentById(req, res, req.params.id));

  app.all('/api/teachers/me/schedule', (req, res) => void myTeacherScheduleHandler(req, res));
  app.all('/api/teachers/import', (req, res) => void teachersImportHandler(req, res));
  app.all('/api/teachers/bulk-archive', (req, res) => void teachersBulkArchiveHandler(req, res));
  app.all('/api/teachers/bulk-delete', (req, res) => void teachersBulkDeleteHandler(req, res));
  app.all('/api/teachers', (req, res) => void teachersHandler(req, res));
  app.all('/api/teachers/:id', (req, res) => void handleTeacherById(req, res, req.params.id));

  // Jadwal & Aturan
  app.all('/api/schedules/import', (req, res) => void schedulesImportHandler(req, res));
  app.all('/api/schedules/bulk-delete', (req, res) => void schedulesBulkDeleteHandler(req, res));
  app.all('/api/schedules', (req, res) => void schedulesHandler(req, res));
  app.all('/api/schedules/:id', (req, res) => void handleScheduleById(req, res, req.params.id));

  app.all('/api/attendance-rules', (req, res) => void attendanceRulesHandler(req, res));

  app.all('/api/holidays', (req, res) => void holidaysHandler(req, res));
  app.all('/api/holidays/:id', (req, res) => void handleHolidayById(req, res, req.params.id));

  // Portal Absensi, QR Token & Absensi
  app.all('/api/qr/tokens', (req, res) => void qrTokensHandler(req, res));
  app.all('/api/qr/revoke', (req, res) => void qrRevokeHandler(req, res));
  app.all('/api/qr/bulk', (req, res) => void qrBulkHandler(req, res));

  app.all('/api/portal/status', (req, res) => void portalStatusHandler(req, res));
  app.all('/api/portal/activate', (req, res) => void portalActivateHandler(req, res));
  app.all('/api/portal/exit', (req, res) => void portalExitHandler(req, res));

  app.all('/api/attendance/scan', (req, res) => void attendanceScanHandler(req, res));
  app.all('/api/attendance/teacher-self', (req, res) => void teacherSelfAttendanceHandler(req, res));
  app.all('/api/attendance/me', (req, res) => void myAttendanceHandler(req, res));
  app.all('/api/attendance/manual-exception', (req, res) => void manualExceptionHandler(req, res));
  app.all('/api/attendance/:id/correction', (req, res) => void handleAttendanceCorrection(req, res, req.params.id));
  app.all('/api/attendance/:id', (req, res) => void handleAttendanceById(req, res, req.params.id));
  app.all('/api/attendance', (req, res) => void attendanceListHandler(req, res));

  // Uploads, Lokasi Sekolah & GPS
  app.all('/api/uploads/selfie', (req, res) => void uploadSelfieHandler(req, res));
  app.all('/api/uploads/attachment', (req, res) => void uploadAttachmentHandler(req, res));
  app.all('/api/uploads/signed-url', (req, res) => void signedUrlHandler(req, res));
  app.all('/api/uploads/file', (req, res) => void servePrivateFileHandler(req, res));

  app.all('/api/locations', (req, res) => void schoolLocationsHandler(req, res));
  app.all('/api/locations/:id', (req, res) => void handleSchoolLocationById(req, res, req.params.id));

  app.all('/api/settings/gps', (req, res) => void gpsSettingsHandler(req, res));

  // Perizinan Guru
  app.all('/api/permissions/me', (req, res) => void myPermissionsHandler(req, res));
  app.all('/api/permissions/:id/admin-review', (req, res) => void handlePermissionAdminReview(req, res, req.params.id));
  app.all('/api/permissions/:id/decision', (req, res) => void handlePermissionPrincipalDecision(req, res, req.params.id));
  app.all('/api/permissions/:id/cancel', (req, res) => void handlePermissionCancel(req, res, req.params.id));
  app.all('/api/permissions/:id', (req, res) => void handlePermissionById(req, res, req.params.id));
  app.all('/api/permissions', (req, res) => void permissionsHandler(req, res));

  // Dashboard & Laporan
  app.all('/api/dashboard/summary', (req, res) => void dashboardSummaryHandler(req, res));
  app.all('/api/reports/attendance', (req, res) => void attendanceReportHandler(req, res));
  app.all('/api/reports/matrix', (req, res) => void attendanceMatrixHandler(req, res));
  app.all('/api/reports/export', (req, res) => void reportExportHandler(req, res));

  // Pengaturan, Branding, Pengguna & Audit Logs
  app.all('/api/settings/branding', (req, res) => void brandingUploadHandler(req, res));
  app.all('/api/settings/backup', (req, res) => void settingsBackupHandler(req, res));
  app.all('/api/settings/restore-points/:id/restore', (req, res) =>
    void handleRestorePointApply(req, res, req.params.id),
  );
  app.all('/api/settings/restore-points/:id', (req, res) =>
    void handleRestorePointById(req, res, req.params.id),
  );
  app.all('/api/settings/restore-points', (req, res) => void restorePointsHandler(req, res));
  app.all('/api/settings/factory-baseline', (req, res) => void handleFactoryBaseline(req, res));
  app.all('/api/settings/factory-reset', (req, res) => void factoryResetHandler(req, res));
  app.all('/api/settings/restore', (req, res) => void settingsRestoreHandler(req, res));
  app.all('/api/settings', (req, res) => void appSettingsHandler(req, res));
  app.all('/api/branding/asset', (req, res) => void brandingAssetHandler(req, res));
  app.all('/api/users/generate-from-teachers', (req, res) =>
    void generateUsersFromTeachersHandler(req, res),
  );
  app.all('/api/users/:id', (req, res) => void handleUserById(req, res, req.params.id));
  app.all('/api/users', (req, res) => void usersHandler(req, res));
  app.all('/api/audit-logs', (req, res) => void auditLogsHandler(req, res));

  return app;
}

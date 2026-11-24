import { Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_MANAGEMENT_ROLES, ADMIN_ROLES } from '../../components/layout/navigation';
import { LoadingSpinner } from '../../components/ui/Skeleton';
import { AcademicYearsPage } from '../../features/academic-years/AcademicYearsPage';
import { AboutPage } from '../../features/about/AboutPage';
import { AdminDashboardPage } from '../../features/admin-dashboard/AdminDashboardPage';
import { AttendanceDataPage } from '../../features/attendance/AttendanceDataPage';
import { AttendanceRulesPage } from '../../features/attendance/AttendanceRulesPage';
import { TeacherHistoryPage } from '../../features/attendance/TeacherHistoryPage';
import { TeacherSelfAttendancePage } from '../../features/attendance/TeacherSelfAttendancePage';
import { AuditLogsPage } from '../../features/audit-logs/AuditLogsPage';
import { ChangePasswordPage } from '../../features/auth/ChangePasswordPage';
import { ForbiddenPage } from '../../features/auth/ForbiddenPage';
import { LoginPage } from '../../features/auth/LoginPage';
import { NotFoundPage } from '../../features/auth/NotFoundPage';
import { ClassesPage } from '../../features/classes/ClassesPage';
import { GeofencingPage } from '../../features/geofencing/GeofencingPage';
import { AdminPermissionsPage } from '../../features/permissions/AdminPermissionsPage';
import { PrincipalPermissionsPage } from '../../features/permissions/PrincipalPermissionsPage';
import { TeacherPermissionsPage } from '../../features/permissions/TeacherPermissionsPage';
import { PortalAbsensiPage } from '../../features/portal/PortalAbsensiPage';
import { PrincipalDashboardPage } from '../../features/principal-dashboard/PrincipalDashboardPage';
import { QrCardsPage } from '../../features/qr-cards/QrCardsPage';
import { ReportsPage } from '../../features/reports/ReportsPage';
import { AdminSchedulesPage } from '../../features/schedules/AdminSchedulesPage';
import { TeacherSchedulePage } from '../../features/schedules/TeacherSchedulePage';
import { BackupRestorePage } from '../../features/settings/BackupRestorePage';
import { SettingsPage } from '../../features/settings/SettingsPage';
import { StudentsPage } from '../../features/students/StudentsPage';
import { SubjectsPage } from '../../features/subjects/SubjectsPage';
import { TeacherDashboardPage } from '../../features/teacher-dashboard/TeacherDashboardPage';
import { TeachersPage } from '../../features/teachers/TeachersPage';
import { UsersPage } from '../../features/users/UsersPage';
import { UserRole } from '../../types';
import { RoleGuard } from '../guards/RoleGuard';
import { getDashboardHomePath, useAuth } from '../providers/AuthProvider';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-dvh overflow-x-clip flex items-center justify-center bg-[#F6F8FB]">
        <LoadingSpinner label="Menyiapkan aplikasi..." />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.mustChangePassword && user.role !== UserRole.TEACHER) {
    return <Navigate to="/change-password" replace />;
  }
  return <Navigate to={getDashboardHomePath(user.role)} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/portal" element={<PortalAbsensiPage />} />
      <Route path="/403" element={<ForbiddenPage />} />

      {/* Ganti kata sandi (wajib atau sukarela) */}
      <Route
        path="/change-password"
        element={
          <RoleGuard allowWhenMustChangePassword>
            <ChangePasswordPage />
          </RoleGuard>
        }
      />

      {/* ==================== DASHBOARD ADMIN (Blueprint 3.1) ==================== */}
      <Route
        path="/admin"
        element={
          <RoleGuard allowedRoles={ADMIN_ROLES}>
            <AdminDashboardPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/students"
        element={
          <RoleGuard allowedRoles={[...ADMIN_ROLES, UserRole.PRINCIPAL]}>
            <StudentsPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/teachers"
        element={
          <RoleGuard allowedRoles={[...ADMIN_ROLES, UserRole.PRINCIPAL]}>
            <TeachersPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/classes"
        element={
          <RoleGuard allowedRoles={[...ADMIN_ROLES, UserRole.PRINCIPAL]}>
            <ClassesPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/subjects"
        element={
          <RoleGuard allowedRoles={[...ADMIN_ROLES, UserRole.PRINCIPAL]}>
            <SubjectsPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/academic-years"
        element={
          <RoleGuard allowedRoles={[...ADMIN_ROLES, UserRole.PRINCIPAL]}>
            <AcademicYearsPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/attendance"
        element={
          <RoleGuard allowedRoles={[...ADMIN_ROLES, UserRole.PRINCIPAL]}>
            <AttendanceDataPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/attendance-rules"
        element={
          <RoleGuard allowedRoles={[...ADMIN_ROLES, UserRole.PRINCIPAL]}>
            <AttendanceRulesPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/geofencing"
        element={
          <RoleGuard allowedRoles={[...ADMIN_ROLES, UserRole.PRINCIPAL]}>
            <GeofencingPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/schedules"
        element={
          <RoleGuard allowedRoles={[...ADMIN_ROLES, UserRole.PRINCIPAL]}>
            <AdminSchedulesPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/qr-cards"
        element={
          <RoleGuard allowedRoles={ADMIN_ROLES}>
            <QrCardsPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/permissions"
        element={
          <RoleGuard allowedRoles={ADMIN_ROLES}>
            <AdminPermissionsPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <RoleGuard allowedRoles={ADMIN_ROLES}>
            <ReportsPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RoleGuard allowedRoles={[...ADMIN_MANAGEMENT_ROLES, UserRole.PRINCIPAL]}>
            <UsersPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/backup"
        element={
          <RoleGuard allowedRoles={ADMIN_MANAGEMENT_ROLES}>
            <BackupRestorePage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <RoleGuard allowedRoles={[...ADMIN_MANAGEMENT_ROLES, UserRole.PRINCIPAL]}>
            <AuditLogsPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <RoleGuard allowedRoles={[...ADMIN_MANAGEMENT_ROLES, UserRole.PRINCIPAL]}>
            <SettingsPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/about"
        element={
          <RoleGuard allowedRoles={[...ADMIN_ROLES, UserRole.PRINCIPAL]}>
            <AboutPage />
          </RoleGuard>
        }
      />

      {/* ==================== DASHBOARD KEPALA SEKOLAH (Blueprint 3.2) ==================== */}
      <Route
        path="/principal"
        element={
          <RoleGuard allowedRoles={[UserRole.PRINCIPAL]}>
            <PrincipalDashboardPage />
          </RoleGuard>
        }
      />
      <Route
        path="/principal/attendance"
        element={
          <RoleGuard allowedRoles={[UserRole.PRINCIPAL]}>
            <TeacherSelfAttendancePage />
          </RoleGuard>
        }
      />
      <Route
        path="/principal/history"
        element={
          <RoleGuard allowedRoles={[UserRole.PRINCIPAL]}>
            <TeacherHistoryPage />
          </RoleGuard>
        }
      />
      <Route
        path="/principal/monitoring"
        element={
          <RoleGuard allowedRoles={[UserRole.PRINCIPAL]}>
            <AttendanceDataPage />
          </RoleGuard>
        }
      />
      <Route
        path="/principal/recap-students"
        element={
          <RoleGuard allowedRoles={[UserRole.PRINCIPAL]}>
            <ReportsPage
              defaultDimension="STUDENT"
              titleOverride="Rekap Kehadiran Siswa"
              subtitleOverride="Ringkasan kehadiran siswa per kelas dan periode pada tahun ajaran aktif."
            />
          </RoleGuard>
        }
      />
      <Route
        path="/principal/recap-teachers"
        element={
          <RoleGuard allowedRoles={[UserRole.PRINCIPAL]}>
            <ReportsPage
              defaultDimension="TEACHER"
              titleOverride="Rekap Kehadiran Guru"
              subtitleOverride="Ringkasan kehadiran, keterlambatan, dan izin disetujui pendidik madrasah."
            />
          </RoleGuard>
        }
      />
      <Route
        path="/principal/permissions"
        element={
          <RoleGuard allowedRoles={[UserRole.PRINCIPAL]}>
            <PrincipalPermissionsPage defaultTab="pending" />
          </RoleGuard>
        }
      />
      <Route
        path="/principal/reports"
        element={
          <RoleGuard allowedRoles={[UserRole.PRINCIPAL]}>
            <ReportsPage
              defaultDimension="ALL"
              titleOverride="Laporan Resmi Madrasah"
              subtitleOverride="Unduh laporan kehadiran siswa dan guru dalam format XLSX, PDF, atau cetak."
            />
          </RoleGuard>
        }
      />
      <Route
        path="/principal/approval-history"
        element={
          <RoleGuard allowedRoles={[UserRole.PRINCIPAL]}>
            <PrincipalPermissionsPage defaultTab="history" />
          </RoleGuard>
        }
      />
      <Route
        path="/principal/profile"
        element={
          <RoleGuard allowedRoles={[UserRole.PRINCIPAL]}>
            <ChangePasswordPage />
          </RoleGuard>
        }
      />
      <Route
        path="/principal/about"
        element={
          <RoleGuard allowedRoles={[UserRole.PRINCIPAL]}>
            <AboutPage />
          </RoleGuard>
        }
      />

      {/* ==================== DASHBOARD GURU (Blueprint 3.3) ==================== */}
      <Route
        path="/teacher"
        element={
          <RoleGuard allowedRoles={[UserRole.TEACHER]}>
            <TeacherDashboardPage />
          </RoleGuard>
        }
      />
      <Route
        path="/teacher/attendance"
        element={
          <RoleGuard allowedRoles={[UserRole.TEACHER]}>
            <TeacherSelfAttendancePage />
          </RoleGuard>
        }
      />
      <Route
        path="/teacher/schedules"
        element={
          <RoleGuard allowedRoles={[UserRole.TEACHER]}>
            <TeacherSchedulePage />
          </RoleGuard>
        }
      />
      <Route
        path="/teacher/history"
        element={
          <RoleGuard allowedRoles={[UserRole.TEACHER]}>
            <TeacherHistoryPage />
          </RoleGuard>
        }
      />
      <Route
        path="/teacher/permissions"
        element={
          <RoleGuard allowedRoles={[UserRole.TEACHER]}>
            <TeacherPermissionsPage />
          </RoleGuard>
        }
      />
      <Route
        path="/teacher/profile"
        element={
          <RoleGuard allowedRoles={[UserRole.TEACHER]}>
            <ChangePasswordPage />
          </RoleGuard>
        }
      />
      <Route
        path="/teacher/about"
        element={
          <RoleGuard allowedRoles={[UserRole.TEACHER]}>
            <Navigate to="/teacher" replace />
          </RoleGuard>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

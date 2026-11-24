import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '../../components/ui/Skeleton';
import { ForbiddenPage } from '../../features/auth/ForbiddenPage';
import { UserRole } from '../../types';
import { useAuth } from '../providers/AuthProvider';

export interface RoleGuardProps {
  allowedRoles?: UserRole[];
  allowWhenMustChangePassword?: boolean;
  children: ReactNode;
}

export function RoleGuard({
  allowedRoles,
  allowWhenMustChangePassword = false,
  children,
}: RoleGuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-dvh overflow-x-clip flex items-center justify-center bg-[#F6F8FB]">
        <LoadingSpinner label="Memverifikasi sesi Anda..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (
    user.mustChangePassword &&
    user.role !== UserRole.TEACHER &&
    !allowWhenMustChangePassword
  ) {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}

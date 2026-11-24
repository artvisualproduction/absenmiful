import type { PublicAppSettings, UserRole } from '../types';
import { apiRequest, setClientCsrfToken } from './apiClient';

export interface AuthUserProfile {
  id: string;
  username: string;
  role: UserRole;
  linkedTeacherId: string | null;
  displayName: string;
  position: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
}

export interface PublicSettingsResponse {
  settings: PublicAppSettings;
  needsBootstrap: boolean;
  dataMode: 'mock' | 'real';
}

export interface LoginResponse {
  user: AuthUserProfile;
  csrfToken: string;
}

export interface MeResponse {
  user: AuthUserProfile;
  csrfToken: string | null;
}

export interface BootstrapResponse {
  accounts: Array<{
    userId: string;
    username: string;
    role: UserRole;
    fullName: string;
    linkedTeacherId: string | null;
    mustChangePassword: boolean;
    temporaryPassword?: string;
  }>;
}

export const authService = {
  fetchPublicSettings() {
    return apiRequest<PublicSettingsResponse>('/api/settings/public', {
      suppressUnauthorizedEvent: true,
    });
  },

  bootstrapAccounts(payload: {
    superAdminPassword: string;
    adminPassword?: string;
    principalPassword?: string;
  }) {
    return apiRequest<BootstrapResponse>('/api/auth/bootstrap', {
      method: 'POST',
      body: payload,
      suppressUnauthorizedEvent: true,
    });
  },

  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
      suppressUnauthorizedEvent: true,
    });
    if (res.csrfToken) {
      setClientCsrfToken(res.csrfToken);
    }
    return res;
  },

  async fetchMe(): Promise<MeResponse> {
    const res = await apiRequest<MeResponse>('/api/auth/me', {
      suppressUnauthorizedEvent: true,
    });
    if (res.csrfToken) {
      setClientCsrfToken(res.csrfToken);
    }
    return res;
  },

  async logout(): Promise<void> {
    await apiRequest<{ loggedOut: boolean }>('/api/auth/logout', {
      method: 'POST',
      suppressUnauthorizedEvent: true,
    });
    setClientCsrfToken(null);
  },

  changePassword(currentPassword: string, newPassword: string) {
    return apiRequest<{ changed: boolean; mustChangePassword: boolean }>(
      '/api/auth/change-password',
      {
        method: 'POST',
        body: { currentPassword, newPassword },
      },
    );
  },

  resetPassword(targetUserId: string, customPassword: string, reason = '') {
    return apiRequest<{
      targetUserId: string;
      username: string;
      passwordUpdated: boolean;
      mustChangePassword: boolean;
    }>('/api/auth/reset-password', {
      method: 'POST',
      body: { targetUserId, customPassword, reason },
    });
  },
};

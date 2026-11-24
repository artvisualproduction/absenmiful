import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onSessionExpired } from '../../services/apiClient';
import { authService, type AuthUserProfile } from '../../services/authService';
import { UserRole, type PublicAppSettings } from '../../types';

export function getDashboardHomePath(role: UserRole): string {
  switch (role) {
    case UserRole.SUPER_ADMIN:
    case UserRole.ADMIN:
    case UserRole.OPERATOR:
      return '/admin';
    case UserRole.PRINCIPAL:
      return '/principal';
    case UserRole.TEACHER:
      return '/teacher';
  }
}

export function getRoleLabelIndonesian(role: UserRole): string {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return 'Super Admin';
    case UserRole.ADMIN:
      return 'Admin Sekolah';
    case UserRole.OPERATOR:
      return 'Operator';
    case UserRole.PRINCIPAL:
      return 'Kepala Sekolah';
    case UserRole.TEACHER:
      return 'Guru';
  }
}

interface AuthContextValue {
  user: AuthUserProfile | null;
  publicSettings: PublicAppSettings | null;
  needsBootstrap: boolean;
  dataMode: 'mock' | 'real';
  loading: boolean;
  sessionExpired: boolean;
  clearSessionExpiredFlag: () => void;
  login: (username: string, password: string) => Promise<AuthUserProfile>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthUserProfile | null>;
  refreshPublicSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [publicSettings, setPublicSettings] = useState<PublicAppSettings | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [dataMode, setDataMode] = useState<'mock' | 'real'>('real');
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const refreshPublicSettings = useCallback(async () => {
    try {
      const res = await authService.fetchPublicSettings();
      setPublicSettings(res.settings);
      setNeedsBootstrap(res.needsBootstrap);
      setDataMode(res.dataMode);
    } catch {
      // Retain existing settings or fallbacks if transient error occurs
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<AuthUserProfile | null> => {
    try {
      const res = await authService.fetchMe();
      setUser(res.user);
      setSessionExpired(false);
      return res.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      await Promise.all([refreshPublicSettings(), refreshSession()]);
      if (active) {
        setLoading(false);
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, [refreshPublicSettings, refreshSession]);

  useEffect(() => {
    return onSessionExpired(() => {
      setUser(null);
      setSessionExpired(true);
    });
  }, []);

  useEffect(() => {
    if (!publicSettings || typeof document === 'undefined') return;
    const root = document.documentElement;
    if (publicSettings.theme?.primary) {
      root.style.setProperty('--brand-primary', publicSettings.theme.primary);
      const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (themeMeta) themeMeta.content = publicSettings.theme.primary;
    }
    if (publicSettings.theme?.accent) {
      root.style.setProperty('--brand-accent', publicSettings.theme.accent);
    }
    if (publicSettings.theme?.background) {
      root.style.setProperty('--brand-bg', publicSettings.theme.background);
    }
    const isCustomAsset = (val: string | null | undefined) =>
      Boolean(
        val &&
          val !== '/images/school-logo.jpg' &&
          val !== '/images/school-logo.png' &&
          val !== '/favicon.png' &&
          !val.startsWith('/icons/'),
      );
    const customLogo = isCustomAsset(publicSettings.logoPath) ? publicSettings.logoPath : null;
    const dedicated192 =
      publicSettings.pwaIcon192Path &&
      publicSettings.pwaIcon192Path !== publicSettings.logoPath &&
      !publicSettings.pwaIcon192Path.startsWith('/icons/')
        ? publicSettings.pwaIcon192Path
        : null;

    const resolvedFavicon =
      (isCustomAsset(publicSettings.faviconPath) ? publicSettings.faviconPath : null) ||
      customLogo ||
      '/favicon.png';
    let iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      document.head.appendChild(iconLink);
    }
    iconLink.href = resolvedFavicon;

    const resolvedAppleIcon = dedicated192 || '/icons/apple-touch-icon.png';
    const appleLinks = document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleLinks.length > 0) {
      appleLinks.forEach((link) => {
        link.href = resolvedAppleIcon;
      });
    } else {
      const appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.href = resolvedAppleIcon;
      document.head.appendChild(appleLink);
    }

    const resolvedPwaName = publicSettings.pwaAppName?.trim() || 'MiFUL';
    const appleTitleMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    );
    if (appleTitleMeta) {
      appleTitleMeta.content = resolvedPwaName;
    }
    const manifestVersion = [
      resolvedPwaName,
      publicSettings.pwaIcon512Path || publicSettings.pwaIcon192Path || publicSettings.logoPath || '',
      publicSettings.updatedAt || '',
    ]
      .filter(Boolean)
      .join('|');
    if (manifestVersion) {
      const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (manifestLink) {
        manifestLink.href = `/manifest.webmanifest?v=${encodeURIComponent(manifestVersion)}`;
      }
    }
  }, [publicSettings]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authService.login(username, password);
    setUser(res.user);
    setSessionExpired(false);
    setNeedsBootstrap(false);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setSessionExpired(false);
    }
  }, []);

  const clearSessionExpiredFlag = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      publicSettings,
      needsBootstrap,
      dataMode,
      loading,
      sessionExpired,
      clearSessionExpiredFlag,
      login,
      logout,
      refreshSession,
      refreshPublicSettings,
    }),
    [
      user,
      publicSettings,
      needsBootstrap,
      dataMode,
      loading,
      sessionExpired,
      clearSessionExpiredFlag,
      login,
      logout,
      refreshSession,
      refreshPublicSettings,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }
  return ctx;
}

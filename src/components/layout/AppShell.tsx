import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  KeyRound,
  LogOut,
  Menu,
  ShieldCheck,
  UserCog,
  X,
} from 'lucide-react';
import { getRoleLabelIndonesian, useAuth } from '../../app/providers/AuthProvider';
import { cn } from '../../lib/cn';
import { UserRole } from '../../types';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { ConnectivityStatus } from './ConnectivityStatus';
import {
  getMobileBottomNavForRole,
  getNavIconForPath,
  getNavigationForRole,
} from './navigation';

export interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  hideActionsOnMobile?: boolean;
  children: ReactNode;
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'US';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getRoleIcon(role: UserRole) {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return ShieldCheck;
    case UserRole.ADMIN:
    case UserRole.OPERATOR:
      return UserCog;
    case UserRole.PRINCIPAL:
      return Award;
    default:
      return GraduationCap;
  }
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Persist sidebar scroll & group collapse state across route unmounts/remounts
let persistedSidebarScrollTop = 0;
let persistedCollapsedGroups: Record<string, boolean> = {};

export function AppShell({
  title,
  subtitle,
  actions,
  hideActionsOnMobile = false,
  children,
}: AppShellProps) {
  const { user, publicSettings, logout } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [portalConfirmOpen, setPortalConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    () => persistedCollapsedGroups,
  );
  const desktopUserMenuRef = useRef<HTMLDivElement>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    if (desktopNavRef.current && persistedSidebarScrollTop > 0) {
      desktopNavRef.current.scrollTop = persistedSidebarScrollTop;
    }
  }, [location.pathname, user?.id]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inDesktop = desktopUserMenuRef.current?.contains(target) ?? false;
      const inMobile = mobileUserMenuRef.current?.contains(target) ?? false;
      if (!inDesktop && !inMobile) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  if (!user) return null;

  const navGroups = getNavigationForRole(user.role);
  const mobileQuickItems = getMobileBottomNavForRole(user.role);
  const ActivePageIcon = getNavIconForPath(location.pathname, user.role);
  const RoleIcon = getRoleIcon(user.role);
  const schoolName = publicSettings?.schoolName ?? 'MI MIFTAHUL ULUM';
  const appName = publicSettings?.appName ?? 'Absensi Digital';
  const logoSrc = publicSettings?.logoPath ?? '/images/school-logo.png';
  const userInitials = getInitials(user.displayName || user.username);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      persistedCollapsedGroups = next;
      return next;
    });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      persistedSidebarScrollTop = 0;
      persistedCollapsedGroups = {};
      showToast({
        variant: 'info',
        title: 'Berhasil keluar',
        message: 'Sesi Anda telah diakhiri dengan aman.',
      });
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setLogoutConfirmOpen(false);
    }
  };

  const renderUserMenu = (variant: 'desktop' | 'mobile') => {
    const isDesktop = variant === 'desktop';
    return (
      <div
        ref={isDesktop ? desktopUserMenuRef : mobileUserMenuRef}
        className="relative"
      >
        <button
          type="button"
          onClick={() => setUserMenuOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          aria-label={`Menu akun ${user.displayName}`}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7D4A3] cursor-pointer',
            isDesktop
              ? 'h-10 px-2.5 py-1 border-[#E2E8F0] bg-white hover:border-[#C69B3C] hover:bg-[#FCF9F1]/60 shadow-2xs'
              : 'h-9 px-1.5 sm:px-2 border-white/15 bg-white/10 text-white hover:bg-white/15',
          )}
        >
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#DFBA62] to-[#B0862A] font-bold tracking-tight text-[#09162E] shadow-2xs',
              isDesktop ? 'h-7 w-7 text-[11px]' : 'h-6 w-6 text-[10px]',
            )}
            aria-hidden="true"
          >
            {userInitials}
          </span>
          <span className={cn('min-w-0', isDesktop ? 'block max-w-[150px]' : 'hidden sm:block max-w-[110px]')}>
            <span
              className={cn(
                'block text-xs font-bold truncate leading-tight',
                isDesktop ? 'text-[#10264D]' : 'text-white',
              )}
            >
              {user.displayName}
            </span>
            <span
              className={cn(
                'flex items-center gap-1 text-[10.5px] font-medium truncate leading-tight mt-0.5',
                isDesktop ? 'text-slate-500' : 'text-[#E7D4A3]',
              )}
            >
              <RoleIcon className="h-3 w-3 shrink-0 text-[#C69B3C]" aria-hidden="true" />
              <span className="truncate">{getRoleLabelIndonesian(user.role)}</span>
            </span>
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform',
              isDesktop ? 'text-slate-400' : 'text-white/75',
              userMenuOpen && (isDesktop ? 'rotate-180 text-[#10264D]' : 'rotate-180 text-white'),
            )}
            aria-hidden="true"
          />
        </button>

        {userMenuOpen && (
          <div
            role="menu"
            aria-label="Menu pengguna masuk"
            className="absolute right-0 top-full mt-2 z-50 w-60 rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_45px_-16px_rgba(16,38,77,0.28)] overflow-hidden animate-fade-in"
          >
            <div className="border-b border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3 flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#DFBA62] to-[#B0862A] text-xs font-bold text-[#09162E]"
                aria-hidden="true"
              >
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#10264D] truncate">{user.displayName}</p>
                <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500 truncate mt-0.5">
                  <RoleIcon className="h-3 w-3 shrink-0 text-[#C69B3C]" aria-hidden="true" />
                  <span className="truncate">
                    {getRoleLabelIndonesian(user.role)}
                    {user.position ? ` · ${user.position}` : ''}
                  </span>
                </p>
              </div>
            </div>

            <div className="p-2 space-y-1">
              <Link
                to="/change-password"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  setMobileOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
                  location.pathname === '/change-password'
                    ? 'bg-[#EEF3FA] text-[#10264D]'
                    : 'text-slate-700 hover:bg-[#F8FAFC] hover:text-[#10264D]',
                )}
              >
                <KeyRound className="h-4 w-4 text-[#C69B3C]" aria-hidden="true" />
                <span>Ubah Kata Sandi</span>
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  setLogoutConfirmOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSidebarContent = (variant: 'desktop' | 'mobile') => (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0A1A36] via-[#0F244A] to-[#091730] text-white border-r border-white/[0.08]">
      {/* Brand Header — generous top breathing room + clean emblem frame */}
      <div className="flex items-center justify-between gap-2.5 border-b border-white/[0.08] px-4 pb-4 pt-safe-sidebar">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={logoSrc}
            alt={`Logo ${schoolName}`}
            referrerPolicy="no-referrer"
            className="h-11 w-11 shrink-0 object-contain bg-transparent"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="min-w-0">
            <p className="text-[14px] font-bold tracking-tight text-white truncate leading-snug">
              {appName}
            </p>
            <p className="text-[11px] font-medium text-[#E7D4A3]/95 truncate leading-snug">
              {schoolName}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu navigasi"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/75 hover:bg-white/10 hover:text-white cursor-pointer shrink-0"
        >
          <X className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      </div>

      {/* Compact, Icon-Rich Navigation */}
      <nav
        ref={variant === 'desktop' ? desktopNavRef : undefined}
        onScroll={
          variant === 'desktop'
            ? (e) => {
                persistedSidebarScrollTop = e.currentTarget.scrollTop;
              }
            : undefined
        }
        aria-label="Navigasi utama"
        className="sidebar-scroll flex-1 overflow-y-auto overscroll-contain px-3 py-3.5 space-y-3.5"
      >
        {navGroups.map((group) => {
          const isCollapsed = Boolean(group.label && collapsedGroups[group.id]);
          const GroupIcon = group.icon;
          return (
            <div key={group.id} className="space-y-1">
              {group.label && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-[#9FB4D6]/85 hover:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {GroupIcon && (
                      <GroupIcon className="h-3 w-3 shrink-0 text-[#C69B3C]/85" aria-hidden="true" />
                    )}
                    <span className="truncate">{group.label}</span>
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                  )}
                </button>
              )}

              {!isCollapsed && (
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const exactRoot =
                      item.to === '/admin' ||
                      item.to === '/principal' ||
                      item.to === '/teacher';
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={exactRoot}
                          onClick={(e) => {
                            if (variant === 'desktop' && desktopNavRef.current) {
                              persistedSidebarScrollTop = desktopNavRef.current.scrollTop;
                            }
                            if (item.to === '/portal') {
                              e.preventDefault();
                              setMobileOpen(false);
                              setPortalConfirmOpen(true);
                              return;
                            }
                            setMobileOpen(false);
                          }}
                          className={({ isActive }) =>
                            cn(
                              'group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-all active:scale-[0.99]',
                              isActive
                                ? 'bg-gradient-to-r from-[#D5AC4E] to-[#C69B3C] text-[#09162E] font-semibold shadow-[0_6px_16px_-6px_rgba(198,155,60,0.55)]'
                                : 'text-slate-200/90 hover:bg-white/[0.08] hover:text-white',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <span
                                className={cn(
                                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                                  isActive
                                    ? 'bg-[#09162E]/12 text-[#09162E]'
                                    : 'bg-white/[0.05] text-[#9FB4D6] group-hover:bg-white/[0.1] group-hover:text-[#E7D4A3]',
                                )}
                              >
                                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              </span>
                              <span className="truncate">{item.label}</span>
                            </>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-dvh bg-[#F4F7FB] flex overflow-x-clip">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64">
        {renderSidebarContent('desktop')}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#09162E]/55 backdrop-blur-[2px] animate-fade-in"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-[82vw] max-w-[292px] h-full shadow-2xl animate-slide-in-left">
            {renderSidebarContent('mobile')}
          </aside>
        </div>
      )}

      {/* Main Content Wrapper */}
      <div className="flex flex-1 flex-col min-w-0 lg:pl-64 overflow-x-clip">
        {/* Mobile-only compact header bar seamlessly merged with device status bar */}
        <div className="lg:hidden sticky top-0 z-20 flex min-h-[54px] items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-[#0A1A36] via-[#0F244A] to-[#10264D] text-white px-3.5 pt-safe-header pb-2.5 shadow-sm print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu navigasi"
              className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white hover:bg-white/15 active:scale-95 cursor-pointer shrink-0"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-normal text-[#E7D4A3]/90 truncate leading-tight">
                {appName}
              </p>
              <p className="text-sm font-bold tracking-tight text-white truncate leading-tight mt-0.5">
                {schoolName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallButton compact />
            <ConnectivityStatus />
            {renderUserMenu('mobile')}
          </div>
        </div>

        {/* Main Viewport with In-Page Title Header */}
        <main className="flex-1 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-6 lg:px-8 lg:py-7 max-w-[1440px] w-full mx-auto">
          <div key={location.pathname} className="animate-fade-up space-y-5 sm:space-y-6">
            {/* In-Page Title & Actions Header */}
            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between border-b border-[#E2E8F0]/90 pb-4">
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#10264D] text-[#E7D4A3] shadow-xs ring-1 ring-[#10264D]/10 mt-0.5"
                  aria-hidden="true"
                >
                  <ActivePageIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#10264D] leading-[1.12]">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="mt-0.5 text-xs sm:text-sm text-slate-500 leading-snug max-w-2xl">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  'flex-wrap items-center justify-end gap-2 shrink-0 sm:pt-0.5',
                  hideActionsOnMobile ? 'hidden sm:flex' : 'flex',
                )}
              >
                {actions}
                <div className="hidden lg:flex items-center gap-2 shrink-0 print:hidden">
                  <PWAInstallButton compact />
                  <ConnectivityStatus />
                  {renderUserMenu('desktop')}
                </div>
              </div>
            </div>

            {children}
          </div>
        </main>
      </div>

      {/* Role-aware Fixed Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi cepat mobile"
        className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-[#E2E8F0]/90 bg-white/95 backdrop-blur-md pt-1 pb-safe-nav shadow-[0_-6px_24px_-12px_rgba(16,38,77,0.14)]"
      >
        <div className="grid grid-cols-5 min-h-[58px] max-w-lg mx-auto px-1">
          {mobileQuickItems.map((item) => {
            const Icon = item.icon;
            const exactRoot =
              item.to === '/admin' || item.to === '/principal' || item.to === '/teacher';
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={exactRoot}
                onClick={(e) => {
                  if (item.to === '/portal') {
                    e.preventDefault();
                    setPortalConfirmOpen(true);
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-medium transition-all active:scale-95',
                    isActive
                      ? 'text-[#10264D] font-semibold'
                      : 'text-slate-500 hover:text-[#10264D]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'inline-flex h-7 w-10 items-center justify-center rounded-xl transition-colors',
                        isActive ? 'bg-[#10264D] text-[#E7D4A3]' : 'bg-transparent',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="truncate max-w-full leading-none">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka semua menu"
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-medium text-slate-500 hover:text-[#10264D] active:scale-95 cursor-pointer"
          >
            <span className="inline-flex h-7 w-10 items-center justify-center rounded-xl">
              <Menu className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="leading-none">Menu</span>
          </button>
        </div>
      </nav>

      <ConfirmDialog
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Keluar dari Aplikasi"
        message="Anda yakin ingin mengakhiri sesi saat ini? Anda perlu masuk kembali untuk mengakses dashboard."
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        variant="danger"
        loading={loggingOut}
      />

      <ConfirmDialog
        open={portalConfirmOpen}
        onClose={() => setPortalConfirmOpen(false)}
        onConfirm={() => {
          setPortalConfirmOpen(false);
          navigate('/portal');
        }}
        title="Masuk ke Portal Absensi QR?"
        message="Saat berada di mode Portal Absensi QR, untuk keluar kembali ke dashboard admin Anda diwajibkan memasukkan kata sandi keluar portal."
        confirmLabel="Ya, Buka Portal"
        cancelLabel="Batal"
      />
    </div>
  );
}

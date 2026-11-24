import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  LogIn,
  QrCode,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { getDashboardHomePath, useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { PWAInstallButton } from '../../components/pwa/PWAInstallButton';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ApiClientError } from '../../services/apiClient';
import { authService, type BootstrapResponse } from '../../services/authService';
import { UserRole } from '../../types';

function isPathCompatibleWithRole(path: string | undefined, role: UserRole): boolean {
  if (!path || !path.startsWith('/')) return false;
  if (path === '/portal' || path === '/change-password') return true;
  if (
    path.startsWith('/admin/users') ||
    path.startsWith('/admin/audit-logs') ||
    path.startsWith('/admin/settings')
  ) {
    return (
      role === UserRole.SUPER_ADMIN ||
      role === UserRole.ADMIN ||
      role === UserRole.PRINCIPAL
    );
  }
  if (path.startsWith('/admin')) {
    return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN || role === UserRole.OPERATOR;
  }
  if (path.startsWith('/principal')) {
    return role === UserRole.PRINCIPAL;
  }
  if (path.startsWith('/teacher')) {
    return role === UserRole.TEACHER;
  }
  return false;
}

export function LoginPage() {
  useDocumentTitle('Masuk');
  const {
    user,
    publicSettings,
    needsBootstrap,
    sessionExpired,
    clearSessionExpiredFlag,
    login,
    refreshPublicSettings,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quickLoadingUser, setQuickLoadingUser] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // One-time initial bootstrap modal state (only active when 0 users exist)
  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  const [superAdminPw, setSuperAdminPw] = useState('superadmin123');
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapResult, setBootstrapResult] = useState<BootstrapResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [portalConfirmOpen, setPortalConfirmOpen] = useState(false);

  if (user) {
    if (user.mustChangePassword && user.role !== UserRole.TEACHER) {
      return <Navigate to="/change-password" replace />;
    }
    const redirectState = location.state as { from?: string } | null;
    const candidate = redirectState?.from;
    const target = isPathCompatibleWithRole(candidate, user.role)
      ? candidate!
      : getDashboardHomePath(user.role);
    return <Navigate to={target} replace />;
  }

  const appName = publicSettings?.appName ?? 'Absensi Digital';
  const schoolName = publicSettings?.schoolName ?? 'MI MIFTAHUL ULUM';
  const schoolAddress =
    publicSettings?.schoolAddress ?? 'Sumberwuluh - Candipuro - Lumajang';
  const logoSrc = publicSettings?.logoPath ?? '/images/school-logo.png';
  const backdropSrc = publicSettings?.loginBackgroundPath ?? '/images/school-backdrop.jpg';
  const quickLoginEnabled = publicSettings?.quickLoginEnabled ?? false;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    clearSessionExpiredFlag();

    if (!username.trim() || !password) {
      setErrorMessage('Username dan kata sandi wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedInUser = await login(username.trim(), password);
      showToast({
        variant: 'success',
        title: 'Berhasil masuk',
        message: `Selamat datang, ${loggedInUser.displayName}.`,
      });
      if (loggedInUser.mustChangePassword && loggedInUser.role !== UserRole.TEACHER) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(getDashboardHomePath(loggedInUser.role), { replace: true });
      }
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Gagal memproses login. Silakan coba lagi.';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (quickUsername: string, quickPassword: string) => {
    setErrorMessage(null);
    clearSessionExpiredFlag();

    setUsername(quickUsername);
    setPassword(quickPassword);
    setSubmitting(true);
    setQuickLoadingUser(quickUsername);
    try {
      const loggedInUser = await login(quickUsername, quickPassword);
      showToast({
        variant: 'success',
        title: 'Berhasil masuk',
        message: `Selamat datang, ${loggedInUser.displayName}.`,
      });
      if (loggedInUser.mustChangePassword && loggedInUser.role !== UserRole.TEACHER) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(getDashboardHomePath(loggedInUser.role), { replace: true });
      }
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Gagal memproses login cepat. Silakan coba lagi.';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
      setQuickLoadingUser(null);
    }
  };

  const handleBootstrapSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBootstrapError(null);
    setBootstrapping(true);
    try {
      const res = await authService.bootstrapAccounts({
        superAdminPassword: superAdminPw,
      });
      setBootstrapResult(res);
      await refreshPublicSettings();
      showToast({
        variant: 'success',
        title: 'Inisialisasi Super Admin berhasil',
        message: 'Akun Super Admin siap digunakan untuk masuk dan mengelola data guru.',
      });
    } catch (err) {
      setBootstrapError(
        err instanceof ApiClientError ? err.message : 'Gagal menginisialisasi akun awal.',
      );
    } finally {
      setBootstrapping(false);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  const busy = submitting;

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between overflow-hidden bg-[#0B1C3A] px-4 pt-[calc(2rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:py-10">
      {/* Full-bleed School Background Photo */}
      <img
        src={backdropSrc}
        alt={`Gedung ${schoolName}`}
        referrerPolicy="no-referrer"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />

      {/* Deep Navy Ambient Scrim for Crisp Contrast */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#071329]/90 via-[#10264D]/82 to-[#091834]/92"
      />

      <div aria-hidden="true" className="hidden sm:block" />

      {/* Centered Login Container */}
      <main className="relative z-10 my-auto w-full max-w-[560px] flex flex-col items-center space-y-6 animate-fade-up">
        {/* Enlarged, Frameless & Backgroundless School Identity Header */}
        <div className="flex flex-col items-center text-center space-y-3.5 px-2">
          <img
            src={logoSrc}
            alt={`Logo ${schoolName}`}
            referrerPolicy="no-referrer"
            className="h-28 w-28 sm:h-36 sm:w-36 object-contain bg-transparent drop-shadow-[0_10px_28px_rgba(0,0,0,0.42)] transition-transform duration-200 hover:scale-[1.03]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="space-y-1.5">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.22em] text-[#E7D4A3]">
              {appName}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[0.025em] text-white leading-[1.2] drop-shadow-[0_2px_12px_rgba(7,18,38,0.45)]">
              {schoolName}
            </h1>
            {schoolAddress && (
              <p className="text-xs sm:text-[13px] text-slate-200/90 max-w-[460px] pt-1 leading-relaxed mx-auto">
                {schoolAddress}
              </p>
            )}
          </div>
        </div>

        {/* Centered Interactive Login Card */}
        <section className="w-full max-w-[436px] rounded-2xl border border-white/15 bg-white/95 backdrop-blur-xl p-5 sm:p-8 shadow-[0_24px_64px_-16px_rgba(7,18,38,0.62)] space-y-5">
          <div className="text-center pt-0.5 pb-1">
            <h2 className="font-display text-2xl sm:text-[26px] font-extrabold tracking-tight text-[#10264D]">
              Selamat Datang !
            </h2>
          </div>

          {sessionExpired && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#92400E]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.</span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {needsBootstrap && (
            <div className="rounded-xl border border-[#E7D4A3] bg-[#FCF9F1] p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-5 w-5 text-[#8D6B22] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#10264D]">
                    Inisialisasi Akun Super Admin Diperlukan
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Belum ada akun pengguna terdaftar. Buat akun dasar Super Admin sekarang. Akun
                    Kepala Sekolah dan Guru dapat dibuat/ditautkan dari profil guru.
                  </p>
                </div>
              </div>
              <Button
                variant="gold"
                size="sm"
                fullWidth
                onClick={() => setBootstrapOpen(true)}
                leftIcon={<KeyRound className="h-4 w-4" />}
              >
                Inisialisasi Akun Awal
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Username"
              name="username"
              autoComplete="username"
              placeholder="Masukkan username Anda"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <PasswordInput
              label="Kata Sandi"
              name="password"
              autoComplete="current-password"
              placeholder="Masukkan kata sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting && !quickLoadingUser}
              disabled={busy}
              leftIcon={<LogIn className="h-4 w-4" />}
            >
              Masuk
            </Button>
          </form>

          {quickLoginEnabled && !needsBootstrap && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#10264D] inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-[#C69B3C]" aria-hidden="true" />
                  <span>Akses Cepat</span>
                </p>
                <span className="text-[11px] text-slate-500">Akun dasar sistem</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                loading={quickLoadingUser === 'superadmin'}
                disabled={busy}
                onClick={() => void handleQuickLogin('superadmin', 'superadmin123')}
              >
                Masuk sebagai Super Admin
              </Button>
            </div>
          )}

          <div className="space-y-2.5 pt-2 border-t border-[#E2E8F0]">
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => setPortalConfirmOpen(true)}
              leftIcon={<QrCode className="h-4 w-4 text-[#C69B3C]" />}
            >
              Buka Portal Absensi QR
            </Button>
            <PWAInstallButton fullWidth />
          </div>
        </section>
      </main>

      <footer className="relative z-10 pt-10 pb-10 sm:pb-14 text-center space-y-1 select-none">
        <p className="font-display text-sm sm:text-base font-bold tracking-wide text-white">
          ArtVisual Production
        </p>
        <p className="text-[11px] sm:text-xs font-light tracking-[0.12em] text-[#E7D4A3]/90">
          Application and Website Developer
        </p>
      </footer>

      {/* One-time Initial Account Bootstrap Modal */}
      <Modal
        open={bootstrapOpen}
        onClose={() => {
          if (!bootstrapping) {
            setBootstrapOpen(false);
          }
        }}
        title={
          bootstrapResult
            ? 'Akun Awal Berhasil Dibuat'
            : 'Inisialisasi Akun Awal Sekolah'
        }
        description={
          bootstrapResult
            ? 'Akun Super Admin telah aktif. Anda dapat menambahkan Data Guru dan men-generate akun Kepala Sekolah maupun Guru dari Manajemen Pengguna.'
            : 'Tentukan kata sandi awal untuk akun dasar Super Admin (minimal 8 karakter). Akun Kepala Sekolah dan Guru ditautkan dari Data Guru.'
        }
        size={bootstrapResult ? 'lg' : 'md'}
      >
        {!bootstrapResult ? (
          <form onSubmit={handleBootstrapSubmit} className="space-y-4">
            {bootstrapError && (
              <div
                role="alert"
                className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
              >
                {bootstrapError}
              </div>
            )}

            <PasswordInput
              label="Kata Sandi Super Admin (username: superadmin)"
              value={superAdminPw}
              onChange={(e) => setSuperAdminPw(e.target.value)}
              placeholder="Minimal 8 karakter"
              required
            />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2 [&>button]:w-full sm:[&>button]:w-auto">
              <Button
                variant="outline"
                onClick={() => setBootstrapOpen(false)}
                disabled={bootstrapping}
              >
                Batal
              </Button>
              <Button type="submit" variant="primary" loading={bootstrapping}>
                Buat Akun Super Admin
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-xs text-[#15803D]">
              Akun <strong className="font-mono">superadmin</strong> aktif menggunakan kata sandi
              yang baru Anda tetapkan.
            </div>

            {bootstrapResult.accounts.some((a) => Boolean(a.temporaryPassword)) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#10264D]">
                  Daftar Akun &amp; Kata Sandi Awal Guru (Langsung Siap Dipakai):
                </p>
              <div className="divide-y divide-slate-100 rounded-lg border border-[#E2E8F0]">
                {bootstrapResult.accounts
                  .filter((a) => Boolean(a.temporaryPassword))
                  .map((acc) => (
                    <div
                      key={acc.userId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#10264D]">{acc.fullName}</p>
                        <p className="font-mono text-slate-600">
                          username: {acc.username}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-[#F2F5FA] px-2.5 py-1 font-mono text-xs font-semibold text-[#10264D]">
                          {acc.temporaryPassword}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopy(
                              acc.userId,
                              `${acc.username} / ${acc.temporaryPassword ?? ''}`,
                            )
                          }
                          aria-label={`Salin kredensial ${acc.username}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          {copiedId === acc.userId ? (
                            <Check className="h-3.5 w-3.5 text-[#15803D]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <StatusBadge label="Siap Digunakan" tone="success" />
              <Button
                variant="primary"
                onClick={() => {
                  setBootstrapResult(null);
                  setBootstrapOpen(false);
                }}
              >
                Selesai &amp; Lanjut Login
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={portalConfirmOpen}
        onClose={() => setPortalConfirmOpen(false)}
        onConfirm={() => {
          setPortalConfirmOpen(false);
          navigate('/portal');
        }}
        title="Masuk ke Portal Absensi QR?"
        message="Setelah masuk ke mode Portal Absensi QR, untuk keluar kembali ke halaman login atau dashboard Anda diwajibkan memasukkan kata sandi keluar portal."
        confirmLabel="Ya, Buka Portal"
        cancelLabel="Batal"
      />
    </div>
  );
}

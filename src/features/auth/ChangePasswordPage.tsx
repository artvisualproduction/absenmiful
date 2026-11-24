import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, KeyRound, LogOut, ShieldAlert } from 'lucide-react';
import { getDashboardHomePath, useAuth } from '../../app/providers/AuthProvider';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ApiClientError } from '../../services/apiClient';
import { authService } from '../../services/authService';

export function ChangePasswordPage() {
  useDocumentTitle('Ganti Kata Sandi');
  const { user, refreshSession, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const isMandatory = user.mustChangePassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Kata sandi baru harus berbeda dari kata sandi saat ini.');
      return;
    }

    setSubmitting(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      await refreshSession();
      showToast({
        variant: 'success',
        title: 'Kata sandi diperbarui',
        message: 'Kata sandi Anda telah berhasil diganti dengan aman.',
      });
      navigate(getDashboardHomePath(user.role), { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Gagal mengganti kata sandi. Silakan coba lagi.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formCard = (
    <div className="max-w-lg w-full rounded-xl border border-[#E2E8F0] bg-white p-6 sm:p-8 space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5 text-[#10264D]">
          <KeyRound className="h-5 w-5 text-[#C69B3C]" aria-hidden="true" />
          <h2 className="text-lg font-bold">Ganti Kata Sandi Akun</h2>
        </div>
        <p className="text-sm text-slate-600">
          Akun: <span className="font-semibold text-[#10264D]">{user.displayName}</span> (
          <span className="font-mono text-xs">{user.username}</span>)
        </p>
      </div>

      {isMandatory && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-[#E7D4A3] bg-[#FCF9F1] px-4 py-3 text-xs text-[#8D6B22]"
        >
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Anda masuk menggunakan kata sandi sementara. Demi keamanan, Anda wajib mengganti
            kata sandi sebelum dapat mengakses dashboard.
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#B91C1C]"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          label="Kata Sandi Saat Ini"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <PasswordInput
          label="Kata Sandi Baru"
          autoComplete="new-password"
          helperText="Minimal 8 karakter, disarankan kombinasi huruf besar, kecil, dan angka."
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <PasswordInput
          label="Konfirmasi Kata Sandi Baru"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          {isMandatory ? (
            <Button
              variant="outline"
              onClick={() => void logout().then(() => navigate('/login', { replace: true }))}
              leftIcon={<LogOut className="h-4 w-4" />}
            >
              Keluar
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate(-1)}>
              Kembali
            </Button>
          )}
          <Button type="submit" variant="primary" loading={submitting}>
            Simpan Kata Sandi Baru
          </Button>
        </div>
      </form>
    </div>
  );

  if (isMandatory) {
    return (
      <div className="min-h-dvh overflow-x-clip bg-[#F6F8FB] flex items-center justify-center p-4">
        {formCard}
      </div>
    );
  }

  return (
    <AppShell
      title="Ganti Kata Sandi"
      subtitle="Perbarui kata sandi akun Anda secara berkala untuk menjaga keamanan data."
    >
      {formCard}
    </AppShell>
  );
}

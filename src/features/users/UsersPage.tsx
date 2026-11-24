import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { getRoleLabelIndonesian, useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTimeJakarta } from '../../lib/date';
import { adminService, type ManagedUserAccount } from '../../services/adminService';
import { ApiClientError } from '../../services/apiClient';
import { masterDataService, type EnrichedTeacher } from '../../services/masterDataService';
import { TeacherStatus, UserRole } from '../../types';

const ROLE_ACCESS_GUIDE: Array<{
  role: string;
  tone: 'gold' | 'info' | 'success' | 'neutral';
  summary: string;
  permissions: string[];
}> = [
  {
    role: 'Super Admin',
    tone: 'gold',
    summary: 'Satu-satunya akun dasar sistem dengan otoritas tertinggi pada seluruh aplikasi.',
    permissions: [
      'Akses penuh ke seluruh master data, jadwal, geofencing, dan aturan absensi.',
      'Kelola semua akun (termasuk Kepala Sekolah & Guru), Backup, Restore Point, dan Reset Pabrik.',
      'Mengubah pengaturan lembaga, branding, portal absensi, dan log aktivitas penuh.',
    ],
  },
  {
    role: 'Kepala Sekolah',
    tone: 'success',
    summary: 'Diambil/ditautkan dari profil guru berjabatan Kepala Sekolah untuk persetujuan & pemantauan.',
    permissions: [
      'Menyetujui atau menolak pengajuan izin guru yang telah diverifikasi.',
      'Memantau ringkasan kehadiran, rekap siswa & guru, laporan resmi, serta log audit.',
      'Dapat meninjau pengguna serta mengelola akun Guru tanpa mengubah Super Admin.',
    ],
  },
  {
    role: 'Guru',
    tone: 'neutral',
    summary: 'Diambil/ditautkan dari profil Data Guru untuk absensi mandiri, jadwal pribadi, dan izin.',
    permissions: [
      'Melakukan absensi mandiri berbasis lokasi GPS radius sekolah dan kamera selfie langsung.',
      'Melihat jadwal mengajar pribadi dan riwayat kehadiran sendiri.',
      'Mengajukan izin/sakit/cuti serta memantau status persetujuan.',
    ],
  },
];

function buildFirstNamePreviewBase(fullName: string): string {
  const words = fullName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
  if (words.length === 0) return 'guru';
  let candidate = words[0]!;
  let idx = 1;
  while (candidate.length < 3 && idx < words.length) {
    candidate += words[idx]!;
    idx++;
  }
  if (candidate.length < 3) {
    candidate = `${candidate}guru`.slice(0, 8);
  }
  return candidate.slice(0, 32);
}

function getDefaultRoleForTeacher(position: string): UserRole.PRINCIPAL | UserRole.TEACHER {
  return position.toLowerCase().includes('kepala sekolah')
    ? UserRole.PRINCIPAL
    : UserRole.TEACHER;
}

function canManageTarget(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === UserRole.SUPER_ADMIN) return true;
  if (actorRole === UserRole.ADMIN) return targetRole !== UserRole.SUPER_ADMIN;
  if (actorRole === UserRole.PRINCIPAL) {
    return targetRole !== UserRole.SUPER_ADMIN && targetRole !== UserRole.ADMIN;
  }
  return false;
}

function getAssignableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === UserRole.SUPER_ADMIN) {
    return [UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER];
  }
  if (actorRole === UserRole.ADMIN) {
    return [UserRole.PRINCIPAL, UserRole.TEACHER];
  }
  return [UserRole.TEACHER];
}

function getUserRoleSortOrder(role: UserRole): number {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return 0;
    case UserRole.PRINCIPAL:
      return 1;
    case UserRole.ADMIN:
    case UserRole.OPERATOR:
      return 2;
    case UserRole.TEACHER:
    default:
      return 3;
  }
}

export function UsersPage() {
  useDocumentTitle('Manajemen Pengguna');
  const { user: currentUser, publicSettings, refreshSession } = useAuth();
  const { showToast } = useToast();
  const [roleInfoOpen, setRoleInfoOpen] = useState(false);

  const [users, setUsers] = useState<ManagedUserAccount[]>([]);
  const [teachers, setTeachers] = useState<EnrichedTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState('');

  // Revealed password row state & copy indicator
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.TEACHER);
  const [newLinkedTeacherId, setNewLinkedTeacherId] = useState('');
  const [creating, setCreating] = useState(false);

  // Generate User dari Guru modal
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateSearch, setGenerateSearch] = useState('');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [generateRoleOverrides, setGenerateRoleOverrides] = useState<
    Record<string, UserRole.PRINCIPAL | UserRole.TEACHER>
  >({});
  const [customUsernames, setCustomUsernames] = useState<Record<string, string>>({});
  const [customPasswords, setCustomPasswords] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<Array<{
    userId: string;
    teacherId: string;
    fullName: string;
    niyNip: string;
    position: string;
    role: UserRole.PRINCIPAL | UserRole.TEACHER;
    username: string;
    generatedPassword: string;
  }> | null>(null);

  // Edit modal (includes direct username & password change)
  const [editTarget, setEditTarget] = useState<ManagedUserAccount | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<UserRole>(UserRole.TEACHER);
  const [editActive, setEditActive] = useState(true);
  const [editLinkedTeacherId, setEditLinkedTeacherId] = useState('');
  const [editDirectPassword, setEditDirectPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Set Password modal (strictly admin-defined)
  const [resetTarget, setResetTarget] = useState<ManagedUserAccount | null>(null);
  const [customResetPassword, setCustomResetPassword] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [resetting, setResetting] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ManagedUserAccount | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const actorRole = currentUser?.role ?? UserRole.SUPER_ADMIN;
  const assignableRoles = getAssignableRoles(actorRole);
  const requireLinkedTeacher = publicSettings?.requireUserLinkedToTeacher ?? true;
  const canManagePasswords =
    actorRole === UserRole.SUPER_ADMIN ||
    actorRole === UserRole.ADMIN ||
    actorRole === UserRole.PRINCIPAL;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, teachersRes] = await Promise.all([
        adminService.listUsers({
          role: roleFilter,
          isActive: statusFilter,
          search,
        }),
        masterDataService.listTeachers({ limit: 1000 }),
      ]);
      setUsers(usersRes.items);
      setTeachers(teachersRes.items);
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal memuat daftar akun',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, search, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const rankDiff = getUserRoleSortOrder(a.role) - getUserRoleSortOrder(b.role);
      if (rankDiff !== 0) return rankDiff;
      const aLabel = a.linkedTeacherName ?? a.username;
      const bLabel = b.linkedTeacherName ?? b.username;
      return aLabel.localeCompare(bLabel, 'id');
    });
  }, [users]);

  const superAdminCount = useMemo(
    () => users.filter((u) => u.role === UserRole.SUPER_ADMIN).length,
    [users],
  );

  const takenUsernames = useMemo(() => {
    return new Set(users.map((u) => u.normalizedUsername.toLowerCase()));
  }, [users]);

  const linkedUserByTeacherId = useMemo(() => {
    const map = new Map<string, ManagedUserAccount>();
    for (const u of users) {
      if (u.linkedTeacherId) {
        map.set(u.linkedTeacherId, u);
      }
    }
    return map;
  }, [users]);

  const findNextPreviewUsername = useCallback(
    (fullName: string, extraTaken?: Set<string>) => {
      const base = buildFirstNamePreviewBase(fullName);
      const isTaken = (candidate: string) =>
        takenUsernames.has(candidate) || Boolean(extraTaken?.has(candidate));
      if (!isTaken(base)) return base;
      for (let suffix = 2; suffix <= 999; suffix++) {
        const next = `${base}${suffix}`;
        if (!isTaken(next)) return next;
      }
      return `${base}1`;
    },
    [takenUsernames],
  );

  // Compute live preview rows for "Generate User dari Guru" modal
  const teacherGenerateRows = useMemo(() => {
    const reserved = new Set<string>();
    const selectedSet = new Set(selectedTeacherIds);
    const q = generateSearch.trim().toLowerCase();

    return teachers
      .map((t) => {
        const existingAccount = linkedUserByTeacherId.get(t.id) ?? null;
        const hasAccount = Boolean(existingAccount || t.userId);
        const isActiveTeacher = t.status === TeacherStatus.ACTIVE;
        const eligible = !hasAccount && isActiveTeacher;
        const defaultRole = getDefaultRoleForTeacher(t.position);
        const resolvedRole =
          actorRole === UserRole.PRINCIPAL
            ? UserRole.TEACHER
            : generateRoleOverrides[t.id] ?? defaultRole;

        let previewUsername = t.username ?? '';
        let previewPassword = '';
        if (!hasAccount) {
          const candidate = findNextPreviewUsername(t.fullName, reserved);
          if (selectedSet.has(t.id) || eligible) {
            reserved.add(candidate);
          }
          previewUsername = candidate;
          previewPassword = `${candidate}123`;
        }

        return {
          teacher: t,
          existingAccount,
          hasAccount,
          isActiveTeacher,
          eligible,
          role: resolvedRole,
          previewUsername,
          previewPassword,
        };
      })
      .filter((row) => {
        if (!q) return true;
        return (
          row.teacher.fullName.toLowerCase().includes(q) ||
          row.teacher.niyNip.toLowerCase().includes(q) ||
          row.teacher.position.toLowerCase().includes(q)
        );
      });
  }, [
    teachers,
    linkedUserByTeacherId,
    selectedTeacherIds,
    generateSearch,
    generateRoleOverrides,
    actorRole,
    findNextPreviewUsername,
  ]);

  const eligibleTeachersCount = useMemo(
    () => teacherGenerateRows.filter((r) => r.eligible).length,
    [teacherGenerateRows],
  );

  const openGenerateModal = () => {
    setGenerateResult(null);
    setGenerateSearch('');
    setCustomUsernames({});
    setCustomPasswords({});
    const autoIds = teachers
      .filter((t) => {
        const hasAccount = Boolean(linkedUserByTeacherId.get(t.id) || t.userId);
        return !hasAccount && t.status === TeacherStatus.ACTIVE;
      })
      .map((t) => t.id);
    setSelectedTeacherIds(autoIds);
    setGenerateRoleOverrides({});
    setGenerateOpen(true);
  };

  const toggleSelectTeacher = (teacherId: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId],
    );
  };

  const handleSelectAllEligible = () => {
    const eligibleIds = teacherGenerateRows.filter((r) => r.eligible).map((r) => r.teacher.id);
    const allSelected =
      eligibleIds.length > 0 && eligibleIds.every((id) => selectedTeacherIds.includes(id));
    if (allSelected) {
      setSelectedTeacherIds((prev) => prev.filter((id) => !eligibleIds.includes(id)));
    } else {
      setSelectedTeacherIds((prev) => Array.from(new Set([...prev, ...eligibleIds])));
    }
  };

  const handleGenerateSubmit = async () => {
    if (selectedTeacherIds.length === 0) {
      showToast({
        variant: 'error',
        title: 'Pilih minimal 1 guru',
        message: 'Centang data guru yang ingin dibuatkan akun pengguna.',
      });
      return;
    }

    for (const teacherId of selectedTeacherIds) {
      const row = teacherGenerateRows.find((r) => r.teacher.id === teacherId);
      const username = customUsernames[teacherId]?.trim() || row?.previewUsername || '';
      const password = customPasswords[teacherId]?.trim() || row?.previewPassword || '';
      if (username.length < 3) {
        showToast({
          variant: 'error',
          title: 'Username terlalu pendek',
          message: `Username untuk ${row?.teacher.fullName || teacherId} minimal 3 karakter.`,
        });
        return;
      }
      if (password.length < 6) {
        showToast({
          variant: 'error',
          title: 'Kata sandi terlalu pendek',
          message: `Kata sandi untuk ${row?.teacher.fullName || teacherId} minimal 6 karakter.`,
        });
        return;
      }
    }

    setGenerating(true);
    try {
      const items = selectedTeacherIds.map((teacherId) => {
        const row = teacherGenerateRows.find((r) => r.teacher.id === teacherId);
        return {
          teacherId,
          role: row?.role,
          customUsername: customUsernames[teacherId]?.trim() || row?.previewUsername,
          customPassword: customPasswords[teacherId]?.trim() || row?.previewPassword,
        };
      });
      const res = await adminService.generateUsersFromTeachers(items);
      setGenerateResult(res.created);
      showToast({
        variant: 'success',
        title: `${res.createdCount} akun berhasil digenerate`,
        message: 'Username diambil dari nama awal guru dengan kata sandi <username>123.',
      });
      void loadData();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal generate akun dari guru',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const toggleRevealPassword = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyRowCredential = async (row: ManagedUserAccount) => {
    if (!row.currentPassword) return;
    try {
      await navigator.clipboard.writeText(row.currentPassword);
      setCopiedRowId(row.id);
      setTimeout(() => setCopiedRowId(null), 1800);
      showToast({
        variant: 'info',
        title: 'Kata sandi disalin',
        message: `Kata sandi akun ${row.username} berhasil disalin ke papan klip.`,
      });
    } catch {
      // Clipboard unavailable
    }
  };

  const handleCopyGeneratedCredential = async (id: string, username: string, password: string) => {
    try {
      await navigator.clipboard.writeText(`${username} / ${password}`);
      setCopiedRowId(id);
      setTimeout(() => setCopiedRowId(null), 1800);
      showToast({
        variant: 'info',
        title: 'Kredensial disalin',
        message: `Username ${username} dan kata sandi disalin ke papan klip.`,
      });
    } catch {
      // Clipboard unavailable
    }
  };

  const handleSelectTeacherOnCreate = (teacherId: string) => {
    setNewLinkedTeacherId(teacherId);
    if (!teacherId) return;
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return;

    const suggestedRole = getDefaultRoleForTeacher(teacher.position);
    if (assignableRoles.includes(suggestedRole)) {
      setNewRole(suggestedRole);
    }

    const suggestedUsername = findNextPreviewUsername(teacher.fullName);
    setNewUsername(suggestedUsername);
    setNewPassword(`${suggestedUsername}123`);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (requireLinkedTeacher && newRole !== UserRole.SUPER_ADMIN && !newLinkedTeacherId) {
      showToast({
        variant: 'error',
        title: 'Profil guru wajib dipilih',
        message:
          'Pengaturan mewajibkan akun peran Kepala Sekolah/Guru ditautkan dari profil guru.',
      });
      return;
    }

    setCreating(true);
    try {
      await adminService.createUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
        linkedTeacherId: newLinkedTeacherId || null,
        isActive: true,
        mustChangePassword: false,
      });
      showToast({
        variant: 'success',
        title: 'Akun berhasil dibuat',
        message: `Akun ${newUsername.trim()} langsung aktif tanpa wajib ganti sandi.`,
      });
      setCreateOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewLinkedTeacherId('');
      void loadData();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal membuat akun',
        message: err instanceof ApiClientError ? err.message : 'Periksa kembali isian formulir.',
      });
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (account: ManagedUserAccount) => {
    setEditTarget(account);
    setEditUsername(account.username);
    setEditRole(account.role);
    setEditActive(account.isActive);
    setEditLinkedTeacherId(account.linkedTeacherId ?? '');
    setEditDirectPassword('');
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    const trimmedUsername = editUsername.trim();
    if (trimmedUsername.length < 3 || !/^[a-zA-Z0-9._-]+$/.test(trimmedUsername)) {
      showToast({
        variant: 'error',
        title: 'Username tidak valid',
        message: 'Username minimal 3 karakter dan hanya boleh huruf, angka, titik, garis bawah, atau strip.',
      });
      return;
    }

    if (requireLinkedTeacher && editRole !== UserRole.SUPER_ADMIN && !editLinkedTeacherId) {
      showToast({
        variant: 'error',
        title: 'Profil guru wajib dipilih',
        message:
          'Pengaturan mewajibkan akun peran Kepala Sekolah/Guru ditautkan dari profil guru.',
      });
      return;
    }
    if (editDirectPassword.trim() && editDirectPassword.trim().length < 6) {
      showToast({
        variant: 'error',
        title: 'Kata sandi terlalu pendek',
        message: 'Kata sandi baru minimal 6 karakter.',
      });
      return;
    }

    const isSelf = editTarget.id === currentUser?.id;

    setSavingEdit(true);
    try {
      await adminService.updateUser(editTarget.id, {
        username: trimmedUsername,
        ...(isSelf
          ? {}
          : {
              role: editRole,
              isActive: editActive,
            }),
        linkedTeacherId: editRole === UserRole.SUPER_ADMIN ? null : editLinkedTeacherId || null,
        ...(editDirectPassword.trim() ? { password: editDirectPassword.trim() } : {}),
      });
      showToast({
        variant: 'success',
        title: 'Akun diperbarui',
        message: `Perubahan akun ${trimmedUsername} telah disimpan.`,
      });
      if (isSelf) {
        void refreshSession();
      }
      setEditTarget(null);
      setEditDirectPassword('');
      void loadData();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal memperbarui akun',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeletingUser(true);
    try {
      const res = await adminService.deleteUser(deleteTarget.id);
      showToast({
        variant: 'success',
        title: `Akun ${res.username} dihapus`,
        message: deleteTarget.linkedTeacherName
          ? `Data guru "${deleteTarget.linkedTeacherName}" tetap aman dan dikembalikan ke daftar guru.`
          : 'Akun pengguna berhasil dihapus dari sistem.',
      });
      setDeleteTarget(null);
      void loadData();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menghapus akun',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setDeletingUser(false);
    }
  };

  const openResetModal = (account: ManagedUserAccount) => {
    setResetTarget(account);
    setCustomResetPassword('');
    setResetReason('');
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;

    if (customResetPassword.trim().length < 6) {
      showToast({
        variant: 'error',
        title: 'Kata sandi minimal 6 karakter',
        message: 'Masukkan kata sandi baru minimal 6 karakter yang Anda tentukan.',
      });
      return;
    }

    setResetting(true);
    try {
      const res = await adminService.resetUserPassword(resetTarget.id, {
        customPassword: customResetPassword.trim(),
        reason: resetReason.trim(),
        mustChangePassword: false,
      });
      setResetTarget(null);
      setResetReason('');
      setCustomResetPassword('');
      showToast({
        variant: 'success',
        title: 'Kata sandi berhasil diperbarui',
        message: `Akun ${res.username} langsung dapat masuk menggunakan kata sandi baru.`,
      });
      void loadData();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengatur kata sandi',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setResetting(false);
    }
  };

  const columns: Array<TableColumn<ManagedUserAccount>> = [
    {
      key: 'name',
      header: 'Nama',
      render: (row) =>
        row.linkedTeacherName ? (
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#10264D] truncate max-w-[220px]">
              {row.linkedTeacherName}
            </p>
            {row.linkedTeacherPosition && (
              <p className="text-[11px] text-slate-500 truncate max-w-[220px]">
                {row.linkedTeacherPosition}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs font-medium text-slate-400">
            {row.role === UserRole.SUPER_ADMIN ? 'Super Admin' : '—'}
          </span>
        ),
    },
    {
      key: 'username',
      header: 'Username',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-[#10264D] whitespace-nowrap">
          {row.username}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Peran',
      render: (row) => (
        <StatusBadge
          label={getRoleLabelIndonesian(row.role)}
          tone={
            row.role === UserRole.SUPER_ADMIN
              ? 'gold'
              : row.role === UserRole.PRINCIPAL
                ? 'success'
                : 'neutral'
          }
          showIcon={false}
        />
      ),
    },
    {
      key: 'currentPassword',
      header: 'Kata Sandi Saat Ini',
      render: (row) => {
        const manageable = canManageTarget(actorRole, row.role);
        if (!manageable) {
          return <span className="text-xs text-slate-400">Terlindungi</span>;
        }
        if (!row.currentPassword) {
          return (
            <button
              type="button"
              onClick={() => openResetModal(row)}
              className="text-xs text-[#8D6B22] hover:underline cursor-pointer whitespace-nowrap"
            >
              Atur sandi untuk melihat
            </button>
          );
        }
        const revealed = Boolean(revealedIds[row.id]);
        return (
          <div className="inline-flex items-center gap-1.5">
            <code className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 font-mono text-xs font-semibold text-[#10264D] select-all">
              {revealed ? row.currentPassword : '••••••••'}
            </code>
            <button
              type="button"
              onClick={() => toggleRevealPassword(row.id)}
              aria-label={revealed ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
              title={revealed ? 'Sembunyikan' : 'Lihat kata sandi'}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#10264D] cursor-pointer"
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => void handleCopyRowCredential(row)}
              aria-label={`Salin kata sandi ${row.username}`}
              title="Salin kata sandi"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#10264D] cursor-pointer"
            >
              {copiedRowId === row.id ? (
                <Check className="h-3.5 w-3.5 text-[#15803D]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge
          label={row.isActive ? 'Aktif' : 'Nonaktif'}
          tone={row.isActive ? 'success' : 'danger'}
        />
      ),
    },
    {
      key: 'lastLogin',
      header: 'Login Terakhir',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
          {row.lastLoginAt ? formatDateTimeJakarta(row.lastLoginAt) : 'Belum pernah'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (row) => {
        const manageable = canManageTarget(actorRole, row.role);
        const isSelf = row.id === currentUser?.id;
        const isOnlySuperAdmin = row.role === UserRole.SUPER_ADMIN && superAdminCount <= 1;
        const canDelete = manageable && !isSelf && !isOnlySuperAdmin;
        return (
          <div className="inline-flex items-center justify-end gap-1">
            <button
              type="button"
              disabled={!manageable}
              onClick={() => openEditModal(row)}
              title={`Edit username, sandi & peran ${row.username}`}
              aria-label={`Edit akun ${row.username}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:border-[#10264D] hover:bg-[#EEF3FA] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {canManagePasswords && (
              <button
                type="button"
                disabled={!manageable}
                onClick={() => openResetModal(row)}
                title={`Atur kata sandi ${row.username}`}
                aria-label={`Atur kata sandi ${row.username}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#8D6B22] hover:border-[#C69B3C] hover:bg-[#FCF9F1] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              disabled={!canDelete}
              onClick={() => setDeleteTarget(row)}
              title={
                isSelf
                  ? 'Tidak dapat menghapus akun yang sedang aktif'
                  : isOnlySuperAdmin
                    ? 'Minimal harus ada 1 akun Super Admin'
                    : `Hapus akun ${row.username} (data guru tetap aman)`
              }
              aria-label={`Hapus akun ${row.username}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#FECACA] bg-white text-[#B91C1C] hover:border-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <AppShell
      title="Manajemen Pengguna"
      subtitle="Akun dasar hanya Super Admin; akun Kepala Sekolah dan Guru diambil/ditautkan dari Data Guru."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRoleInfoOpen(true)}
            title="Informasi Hak Akses Role"
            aria-label="Informasi Hak Akses Role"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#10264D] hover:border-[#10264D] hover:bg-[#F2F5FA] transition-colors cursor-pointer"
          >
            <Info className="h-4 w-4 text-[#C69B3C]" aria-hidden="true" />
            <span>Info Role</span>
          </button>
          <Button
            variant="gold"
            size="sm"
            onClick={openGenerateModal}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Generate User dari Guru
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setNewRole(assignableRoles[assignableRoles.length - 1] ?? UserRole.TEACHER);
              setNewLinkedTeacherId('');
              setNewUsername('');
              setNewPassword('');
              setCreateOpen(true);
            }}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Tambah Akun
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {actorRole === UserRole.PRINCIPAL && (
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5 text-xs text-[#92400E]">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Mode Tata Kelola Kepala Sekolah: Anda dapat meninjau seluruh akun dan mengelola akun
              Guru, namun tidak dapat mengubah akun <strong>Super Admin</strong>.
            </span>
          </div>
        )}

        <DataTable
          columns={columns}
          data={sortedUsers}
          loading={loading}
          emptyTitle="Tidak ada akun pengguna"
          emptyDescription="Ubah filter pencarian, tambah akun, atau generate akun dari Data Guru."
          toolbar={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                placeholder="Cari username atau nama guru..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                options={[
                  { value: '', label: 'Semua Peran' },
                  { value: UserRole.SUPER_ADMIN, label: 'Super Admin' },
                  { value: UserRole.PRINCIPAL, label: 'Kepala Sekolah' },
                  { value: UserRole.TEACHER, label: 'Guru' },
                ]}
              />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'Semua Status' },
                  { value: 'true', label: 'Aktif' },
                  { value: 'false', label: 'Nonaktif' },
                ]}
              />
            </div>
          }
        />
      </div>

      {/* Generate User dari Guru Popup Modal */}
      <Modal
        open={generateOpen}
        onClose={() => !generating && setGenerateOpen(false)}
        title={
          generateResult
            ? 'Akun Guru Berhasil Digenerate'
            : 'Generate User dari Data Guru'
        }
        description={
          generateResult
            ? 'Semua akun terpilih langsung aktif dan tertaut ke profil guru masing-masing.'
            : 'Pilih data guru untuk membuat akun otomatis: username diambil dari nama awal guru dan kata sandi berpola <username>123.'
        }
        size="xl"
      >
        {generateResult ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-xs text-[#15803D]">
              Berhasil membuat <strong>{generateResult.length} akun</strong> pengguna dari Data
              Guru.
            </div>

            <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 rounded-xl border border-[#E2E8F0]">
              {generateResult.map((acc) => (
                <div
                  key={acc.userId}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#10264D]">{acc.fullName}</p>
                      <StatusBadge
                        label={getRoleLabelIndonesian(acc.role)}
                        tone={acc.role === UserRole.PRINCIPAL ? 'success' : 'neutral'}
                        showIcon={false}
                      />
                    </div>
                    <p className="text-slate-500">
                      NIY/NIP: <span className="font-mono">{acc.niyNip}</span> · {acc.position}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 font-mono text-xs">
                      <span className="text-slate-500">user:</span>{' '}
                      <strong className="text-[#10264D]">{acc.username}</strong>{' '}
                      <span className="text-slate-400">·</span>{' '}
                      <span className="text-slate-500">pass:</span>{' '}
                      <strong className="text-[#8D6B22]">{acc.generatedPassword}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopyGeneratedCredential(
                          acc.userId,
                          acc.username,
                          acc.generatedPassword,
                        )
                      }
                      aria-label={`Salin kredensial ${acc.username}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      {copiedRowId === acc.userId ? (
                        <Check className="h-3.5 w-3.5 text-[#15803D]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#F1F5F9]">
              <Button
                variant="primary"
                onClick={() => {
                  setGenerateResult(null);
                  setGenerateOpen(false);
                }}
              >
                Selesai
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={generateSearch}
                  onChange={(e) => setGenerateSearch(e.target.value)}
                  placeholder="Cari nama guru, NIY/NIP, atau jabatan..."
                  className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white pl-9 pr-3 text-xs text-[#10264D] focus:border-[#10264D] focus:outline-none"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllEligible}
                disabled={eligibleTeachersCount === 0}
              >
                {eligibleTeachersCount > 0 &&
                teacherGenerateRows
                  .filter((r) => r.eligible)
                  .every((r) => selectedTeacherIds.includes(r.teacher.id))
                  ? 'Batal Pilih Semua'
                  : `Pilih Semua Belum Ada Akun (${eligibleTeachersCount})`}
              </Button>
            </div>

            {teachers.length === 0 ? (
              <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-5 text-center space-y-1.5">
                <p className="text-sm font-bold text-[#10264D]">Data Guru Masih Kosong</p>
                <p className="text-xs text-[#92400E]">
                  Tambahkan data guru terlebih dahulu di menu Master Data → Data Guru sebelum
                  men-generate akun Kepala Sekolah maupun Guru.
                </p>
              </div>
            ) : (
              <div className="max-h-[340px] overflow-auto rounded-xl border border-[#E2E8F0]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-10 px-3 py-2.5 text-center">Pilih</th>
                      <th className="px-3 py-2.5">Data Guru</th>
                      <th className="px-3 py-2.5">Peran</th>
                      <th className="px-3 py-2.5">Username</th>
                      <th className="px-3 py-2.5">Kata Sandi</th>
                      <th className="px-3 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {teacherGenerateRows.map((row) => {
                      const checked = selectedTeacherIds.includes(row.teacher.id);
                      return (
                        <tr
                          key={row.teacher.id}
                          className={checked ? 'bg-[#FCF9F1]/70' : undefined}
                        >
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!row.eligible || generating}
                              onChange={() => toggleSelectTeacher(row.teacher.id)}
                              aria-label={`Pilih ${row.teacher.fullName}`}
                              className="h-4 w-4 rounded border-slate-300 text-[#10264D] cursor-pointer disabled:opacity-40"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="font-semibold text-[#10264D]">{row.teacher.fullName}</p>
                            <p className="text-[11px] text-slate-500">
                              <span className="font-mono">{row.teacher.niyNip}</span> ·{' '}
                              {row.teacher.position}
                            </p>
                          </td>
                          <td className="px-3 py-2.5">
                            {row.hasAccount ? (
                              <span className="text-slate-500">
                                {row.existingAccount
                                  ? getRoleLabelIndonesian(row.existingAccount.role)
                                  : 'Sudah Tertaut'}
                              </span>
                            ) : actorRole === UserRole.PRINCIPAL ? (
                              <StatusBadge label="Guru" tone="neutral" showIcon={false} />
                            ) : (
                              <select
                                value={row.role}
                                disabled={!row.eligible || generating}
                                onChange={(e) =>
                                  setGenerateRoleOverrides((prev) => ({
                                    ...prev,
                                    [row.teacher.id]: e.target.value as
                                      | UserRole.PRINCIPAL
                                      | UserRole.TEACHER,
                                  }))
                                }
                                className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-semibold text-[#10264D] focus:border-[#10264D] focus:outline-none"
                              >
                                <option value={UserRole.PRINCIPAL}>Kepala Sekolah</option>
                                <option value={UserRole.TEACHER}>Guru</option>
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono">
                            {row.hasAccount ? (
                              <span className="text-slate-500">
                                {row.existingAccount?.username ?? row.teacher.username ?? '—'}
                              </span>
                            ) : (
                              <input
                                type="text"
                                disabled={!row.eligible || generating}
                                value={customUsernames[row.teacher.id] ?? row.previewUsername}
                                onChange={(e) =>
                                  setCustomUsernames((prev) => ({
                                    ...prev,
                                    [row.teacher.id]: e.target.value
                                      .toLowerCase()
                                      .replace(/[^a-z0-9_.-]/g, ''),
                                  }))
                                }
                                placeholder={row.previewUsername}
                                aria-label={`Username untuk ${row.teacher.fullName}`}
                                className="w-28 rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-mono font-semibold text-[#10264D] focus:border-[#10264D] focus:outline-none"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono">
                            {row.hasAccount ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <input
                                type="text"
                                disabled={!row.eligible || generating}
                                value={customPasswords[row.teacher.id] ?? row.previewPassword}
                                onChange={(e) =>
                                  setCustomPasswords((prev) => ({
                                    ...prev,
                                    [row.teacher.id]: e.target.value,
                                  }))
                                }
                                placeholder={row.previewPassword}
                                aria-label={`Kata sandi untuk ${row.teacher.fullName}`}
                                className="w-32 rounded-md border border-[#E7D4A3] bg-[#FCF9F1] px-2 py-1 text-xs font-mono font-semibold text-[#8D6B22] focus:border-[#8D6B22] focus:outline-none"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            {row.hasAccount ? (
                              <StatusBadge label="Sudah Ada Akun" tone="success" showIcon={false} />
                            ) : !row.isActiveTeacher ? (
                              <StatusBadge label="Nonaktif" tone="danger" showIcon={false} />
                            ) : (
                              <StatusBadge label="Belum Ada Akun" tone="gold" showIcon={false} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2 border-t border-[#F1F5F9]">
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#C69B3C]" aria-hidden="true" />
                <span>
                  Terpilih <strong>{selectedTeacherIds.length}</strong> guru untuk dibuatkan akun.
                </span>
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 [&>button]:w-full sm:[&>button]:w-auto">
                <Button
                  variant="outline"
                  onClick={() => setGenerateOpen(false)}
                  disabled={generating}
                >
                  Batal
                </Button>
                <Button
                  variant="gold"
                  loading={generating}
                  disabled={selectedTeacherIds.length === 0}
                  onClick={() => void handleGenerateSubmit()}
                  leftIcon={<UserPlus className="h-4 w-4" />}
                >
                  Generate Akun ({selectedTeacherIds.length})
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create User Modal */}
      <Modal
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="Tambah Akun Pengguna Baru"
        description={
          requireLinkedTeacher
            ? 'Untuk peran Kepala Sekolah dan Guru, wajib mengambil/menautkan dari profil Data Guru aktif.'
            : 'Akun langsung aktif dan siap digunakan tanpa kewajiban ganti sandi saat login pertama.'
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Select
            label="Peran Hak Akses"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            options={assignableRoles.map((r) => ({
              value: r,
              label: getRoleLabelIndonesian(r),
            }))}
          />
          {newRole !== UserRole.SUPER_ADMIN && (
            <Select
              label={
                requireLinkedTeacher
                  ? 'Ambil / Tautkan dari Profil Guru (Wajib)'
                  : 'Tautkan ke Profil Guru (Opsional)'
              }
              value={newLinkedTeacherId}
              onChange={(e) => handleSelectTeacherOnCreate(e.target.value)}
              options={[
                {
                  value: '',
                  label: requireLinkedTeacher ? '-- Pilih Profil Guru --' : 'Tidak ditautkan',
                },
                ...teachers.map((t) => {
                  const usedBy = linkedUserByTeacherId.get(t.id);
                  return {
                    value: t.id,
                    label: usedBy
                      ? `${t.fullName} (${t.niyNip}) — sudah punya @${usedBy.username}`
                      : `${t.fullName} (${t.niyNip}) · ${t.position}`,
                  };
                }),
              ]}
            />
          )}
          <Input
            label="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="misal: imam"
            helperText="Otomatis terisi nama awal saat memilih guru, tetap dapat disesuaikan (min. 3 karakter)."
            required
          />
          <PasswordInput
            label="Kata Sandi"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimal 6 karakter (misal: imam123)"
            required
          />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2 [&>button]:w-full sm:[&>button]:w-auto">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              Simpan Akun
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal — includes direct username & password change */}
      <Modal
        open={Boolean(editTarget)}
        onClose={() => !savingEdit && setEditTarget(null)}
        title={`Edit Akun — ${editTarget?.username ?? ''}`}
        description="Ubah username, kata sandi, peran, status aktif, atau tautan guru secara langsung."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editTarget?.currentPassword && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-600">Kata sandi saat ini:</span>
              <code className="font-mono font-bold text-[#10264D] select-all">
                {editTarget.currentPassword}
              </code>
            </div>
          )}

          <Input
            label="Username"
            value={editUsername}
            onChange={(e) => setEditUsername(e.target.value)}
            placeholder="misal: imam"
            helperText="Huruf, angka, titik, garis bawah, atau strip (minimal 3 karakter)."
            required
          />

          <Select
            label="Peran"
            value={editRole}
            disabled={editTarget?.id === currentUser?.id}
            onChange={(e) => setEditRole(e.target.value as UserRole)}
            options={assignableRoles.map((r) => ({
              value: r,
              label: getRoleLabelIndonesian(r),
            }))}
            helperText={
              editTarget?.id === currentUser?.id
                ? 'Peran akun yang sedang digunakan tidak dapat diubah.'
                : undefined
            }
          />
          <Select
            label="Status Akun"
            value={editActive ? 'true' : 'false'}
            disabled={editTarget?.id === currentUser?.id}
            onChange={(e) => setEditActive(e.target.value === 'true')}
            options={[
              { value: 'true', label: 'Aktif (Dapat Login)' },
              { value: 'false', label: 'Nonaktif (Sesi Dicabut)' },
            ]}
          />
          {editRole !== UserRole.SUPER_ADMIN && (
            <Select
              label={
                requireLinkedTeacher
                  ? 'Tautan Profil Guru (Wajib)'
                  : 'Tautan Profil Guru (Opsional)'
              }
              value={editLinkedTeacherId}
              onChange={(e) => setEditLinkedTeacherId(e.target.value)}
              options={[
                {
                  value: '',
                  label: requireLinkedTeacher ? '-- Pilih Profil Guru --' : 'Tidak ditautkan',
                },
                ...teachers.map((t) => ({
                  value: t.id,
                  label: `${t.fullName} (${t.niyNip}) · ${t.position}`,
                })),
              ]}
            />
          )}
          <div className="border-t border-[#E2E8F0] pt-3 space-y-1.5">
            <PasswordInput
              label="Ganti Kata Sandi Baru (Opsional)"
              value={editDirectPassword}
              onChange={(e) => setEditDirectPassword(e.target.value)}
              placeholder="Kosongkan jika tidak ingin mengganti sandi"
              helperText="Minimal 6 karakter. Pengguna langsung bisa login memakai kata sandi baru."
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2 [&>button]:w-full sm:[&>button]:w-auto">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={savingEdit}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={savingEdit}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Admin-Defined Password Modal */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => !resetting && setResetTarget(null)}
        title={`Atur Kata Sandi — ${resetTarget?.username ?? ''}`}
        description="Tentukan kata sandi baru secara langsung untuk akun ini. Semua sesi aktif pengguna akan dicabut."
      >
        <form onSubmit={handleResetSubmit} className="space-y-4">
          {resetTarget?.currentPassword && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-600">Kata sandi sekarang:</span>
              <code className="font-mono font-bold text-[#10264D] select-all">
                {resetTarget.currentPassword}
              </code>
            </div>
          )}

          <PasswordInput
            label="Kata Sandi Baru"
            value={customResetPassword}
            onChange={(e) => setCustomResetPassword(e.target.value)}
            placeholder="Minimal 6 karakter"
            helperText="Kata sandi murni ditentukan oleh admin dan langsung aktif digunakan untuk login."
            required
          />

          <Input
            label="Catatan Audit (Opsional)"
            value={resetReason}
            onChange={(e) => setResetReason(e.target.value)}
            placeholder="Contoh: Penetapan ulang kata sandi oleh admin"
          />

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2 [&>button]:w-full sm:[&>button]:w-auto">
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetting}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={resetting}>
              Simpan Kata Sandi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Role Access Info Modal */}
      <Modal
        open={roleInfoOpen}
        onClose={() => setRoleInfoOpen(false)}
        title="Informasi Hak Akses Role"
        description="Ringkasan pembagian wewenang setiap peran pengguna di dalam aplikasi."
        size="lg"
      >
        <div className="space-y-3">
          {ROLE_ACCESS_GUIDE.map((item) => (
            <div
              key={item.role}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#10264D]" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-[#10264D]">{item.role}</h3>
                </div>
                <StatusBadge label={item.role} tone={item.tone} showIcon={false} />
              </div>
              <p className="text-xs text-slate-600">{item.summary}</p>
              <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">
                {item.permissions.map((perm) => (
                  <li key={perm}>{perm}</li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex justify-end pt-2 border-t border-[#F1F5F9]">
            <Button variant="primary" size="sm" onClick={() => setRoleInfoOpen(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => !deletingUser && setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDeleteUser()}
        title={`Hapus Akun "${deleteTarget?.username ?? ''}"?`}
        message={
          deleteTarget?.linkedTeacherName
            ? `Akun login "${deleteTarget.username}" akan dihapus permanen. Data guru "${deleteTarget.linkedTeacherName}" tetap aman tidak ikut terhapus, dan akunnya dikembalikan ke daftar Data Guru agar bisa dibuat/digenerate kembali.`
            : `Akun login "${deleteTarget?.username ?? ''}" akan dihapus permanen dari sistem.`
        }
        confirmLabel="Ya, Hapus Akun"
        cancelLabel="Batal"
        variant="danger"
        loading={deletingUser}
      />
    </AppShell>
  );
}

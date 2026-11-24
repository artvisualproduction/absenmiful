import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarClock,
  CheckSquare,
  ClipboardCheck,
  Clock,
  Database,
  DatabaseBackup,
  FileCheck2,
  FileText,
  GraduationCap,
  History,
  IdCard,
  Info,
  KeyRound,
  LayoutDashboard,
  MapPin,
  QrCode,
  ScanLine,
  School,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle2,
  Users,
} from 'lucide-react';
import { UserRole } from '../../types';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  allowedRoles?: UserRole[];
}

export interface NavGroup {
  id: string;
  label?: string;
  icon?: LucideIcon;
  items: NavItem[];
}

export const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATOR,
];

export const ADMIN_MANAGEMENT_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

/** Navigasi Dashboard Admin */
const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    id: 'main',
    items: [{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard }],
  },
  {
    id: 'master',
    label: 'MASTER DATA',
    icon: Database,
    items: [
      { label: 'Data Siswa', to: '/admin/students', icon: GraduationCap },
      { label: 'Data Guru', to: '/admin/teachers', icon: Users },
      { label: 'Data Kelas', to: '/admin/classes', icon: School },
      { label: 'Mata Pelajaran', to: '/admin/subjects', icon: BookOpen },
      { label: 'Tahun Ajaran', to: '/admin/academic-years', icon: Calendar },
    ],
  },
  {
    id: 'attendance',
    label: 'MANAJEMEN ABSENSI',
    icon: ScanLine,
    items: [
      { label: 'Portal Absensi', to: '/portal', icon: QrCode },
      { label: 'Data Kehadiran', to: '/admin/attendance', icon: ClipboardCheck },
      { label: 'Aturan Jam Absensi', to: '/admin/attendance-rules', icon: Clock },
      { label: 'Lokasi & Geofencing', to: '/admin/geofencing', icon: MapPin },
    ],
  },
  {
    id: 'academic',
    label: 'AKADEMIK & OPERASIONAL',
    icon: Briefcase,
    items: [
      { label: 'Jadwal Mengajar', to: '/admin/schedules', icon: CalendarClock },
      { label: 'Kartu & QR Code', to: '/admin/qr-cards', icon: IdCard },
      { label: 'Perizinan', to: '/admin/permissions', icon: FileCheck2 },
      { label: 'Rekap & Laporan', to: '/admin/reports', icon: BarChart3 },
    ],
  },
  {
    id: 'system',
    label: 'ADMINISTRASI SISTEM',
    icon: SlidersHorizontal,
    items: [
      {
        label: 'Manajemen Pengguna',
        to: '/admin/users',
        icon: ShieldCheck,
        allowedRoles: ADMIN_MANAGEMENT_ROLES,
      },
      {
        label: 'Backup & Restore',
        to: '/admin/backup',
        icon: DatabaseBackup,
        allowedRoles: ADMIN_MANAGEMENT_ROLES,
      },
      {
        label: 'Log Aktivitas',
        to: '/admin/audit-logs',
        icon: Activity,
        allowedRoles: ADMIN_MANAGEMENT_ROLES,
      },
      {
        label: 'Pengaturan',
        to: '/admin/settings',
        icon: Settings,
        allowedRoles: ADMIN_MANAGEMENT_ROLES,
      },
      {
        label: 'Tentang Aplikasi',
        to: '/admin/about',
        icon: Info,
      },
    ],
  },
];

/** Navigasi Dashboard Kepala Sekolah */
const PRINCIPAL_NAV_GROUPS: NavGroup[] = [
  {
    id: 'principal-main',
    label: 'PEMANTAUAN UTAMA',
    items: [
      { label: 'Dashboard', to: '/principal', icon: LayoutDashboard },
      { label: 'Absensi Saya', to: '/principal/attendance', icon: ClipboardCheck },
      { label: 'Riwayat Absensi Saya', to: '/principal/history', icon: History },
      { label: 'Monitoring Kehadiran', to: '/principal/monitoring', icon: ScanLine },
      { label: 'Rekap Siswa', to: '/principal/recap-students', icon: GraduationCap },
      { label: 'Rekap Guru', to: '/principal/recap-teachers', icon: Users },
      { label: 'Persetujuan Perizinan', to: '/principal/permissions', icon: CheckSquare },
      { label: 'Laporan', to: '/principal/reports', icon: FileText },
      { label: 'Riwayat Persetujuan', to: '/principal/approval-history', icon: FileCheck2 },
      { label: 'Profil', to: '/principal/profile', icon: UserCircle2 },
    ],
  },
  {
    id: 'principal-governance',
    label: 'TATA KELOLA',
    icon: ShieldCheck,
    items: [
      { label: 'Manajemen Pengguna', to: '/admin/users', icon: ShieldCheck },
      { label: 'Log Aktivitas', to: '/admin/audit-logs', icon: Activity },
      { label: 'Pengaturan', to: '/admin/settings', icon: Settings },
      { label: 'Tentang Aplikasi', to: '/principal/about', icon: Info },
    ],
  },
];

/** Navigasi Dashboard Guru */
const TEACHER_NAV_GROUPS: NavGroup[] = [
  {
    id: 'teacher-main',
    label: 'MENU GURU',
    items: [
      { label: 'Dashboard', to: '/teacher', icon: LayoutDashboard },
      { label: 'Absensi Saya', to: '/teacher/attendance', icon: ClipboardCheck },
      { label: 'Jadwal Mengajar', to: '/teacher/schedules', icon: CalendarClock },
      { label: 'Riwayat Absensi', to: '/teacher/history', icon: History },
      { label: 'Pengajuan Izin', to: '/teacher/permissions', icon: FileCheck2 },
      { label: 'Profil & Password', to: '/teacher/profile', icon: UserCircle2 },
    ],
  },
];

export function getNavigationForRole(role: UserRole): NavGroup[] {
  let groups: NavGroup[];
  if (role === UserRole.PRINCIPAL) {
    groups = PRINCIPAL_NAV_GROUPS;
  } else if (role === UserRole.TEACHER) {
    groups = TEACHER_NAV_GROUPS;
  } else {
    groups = ADMIN_NAV_GROUPS;
  }

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.allowedRoles || item.allowedRoles.includes(role),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

/** Resolves the matching icon for the currently active route */
export function getNavIconForPath(pathname: string, role: UserRole): LucideIcon {
  if (pathname === '/change-password') return KeyRound;
  if (pathname.endsWith('/about')) return Info;
  const groups = getNavigationForRole(role);
  const allItems = groups.flatMap((g) => g.items);

  const exact = allItems.find((item) => item.to === pathname);
  if (exact) return exact.icon;

  // Prefer the longest matching prefix
  const sorted = [...allItems].sort((a, b) => b.to.length - a.to.length);
  const partial = sorted.find(
    (item) => item.to !== '/admin' && item.to !== '/principal' && item.to !== '/teacher' && pathname.startsWith(item.to),
  );
  return partial?.icon ?? LayoutDashboard;
}

/** 4 pintasan utama untuk bilah navigasi bawah di perangkat mobile */
export function getMobileBottomNavForRole(role: UserRole): NavItem[] {
  if (role === UserRole.PRINCIPAL) {
    return [
      { label: 'Beranda', to: '/principal', icon: LayoutDashboard },
      { label: 'Absensi', to: '/principal/attendance', icon: ClipboardCheck },
      { label: 'Izin', to: '/principal/permissions', icon: CheckSquare },
      { label: 'Laporan', to: '/principal/reports', icon: FileText },
    ];
  }
  if (role === UserRole.TEACHER) {
    return [
      { label: 'Beranda', to: '/teacher', icon: LayoutDashboard },
      { label: 'Absensi', to: '/teacher/attendance', icon: ClipboardCheck },
      { label: 'Jadwal', to: '/teacher/schedules', icon: CalendarClock },
      { label: 'Izin', to: '/teacher/permissions', icon: FileCheck2 },
    ];
  }
  return [
    { label: 'Beranda', to: '/admin', icon: LayoutDashboard },
    { label: 'Portal', to: '/portal', icon: QrCode },
    { label: 'Hadir', to: '/admin/attendance', icon: ClipboardCheck },
    { label: 'Kartu QR', to: '/admin/qr-cards', icon: IdCard },
  ];
}

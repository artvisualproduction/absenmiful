import {
  Award,
  CheckCircle2,
  Code2,
  DatabaseBackup,
  FileSpreadsheet,
  MapPin,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { AppShell } from '../../components/layout/AppShell';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const CORE_CAPABILITIES = [
  {
    icon: QrCode,
    title: 'Portal Absensi Otomatis',
    description:
      'Pemindaian kartu QR dan alat scanner USB secara otomatis mendeteksi status hadir masuk maupun pulang tanpa klik manual.',
  },
  {
    icon: MapPin,
    title: 'Absensi Mandiri & Geofencing',
    description:
      'Validasi lokasi radius sekolah dengan peta interaktif dan verifikasi bukti foto selfie khusus guru dan tenaga pendidik.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Impor & Laporan Lengkap',
    description:
      'Impor massal data siswa, guru, mata pelajaran, serta jadwal mengajar dari Excel dan ekspor rekap resmi XLSX maupun PDF.',
  },
  {
    icon: DatabaseBackup,
    title: 'Backup & Restore Point',
    description:
      'Perlindungan data sekolah melalui cadangan JSON, titik pemulihan sistem instan, dan opsi reset setelan pabrik.',
  },
];

export function AboutContent() {
  const { publicSettings } = useAuth();

  const appName = publicSettings?.appName ?? 'Absensi Digital';
  const schoolName = publicSettings?.schoolName ?? 'MI MIFTAHUL ULUM';
  const schoolAddress =
    publicSettings?.schoolAddress ?? 'Sumberwuluh - Candipuro - Lumajang';
  const logoSrc = publicSettings?.logoPath ?? '/images/school-logo.png';

  return (
    <div className="space-y-6 max-w-5xl">
        {/* Hero Institutional Banner */}
        <section className="relative overflow-hidden rounded-2xl border border-[#173466] bg-gradient-to-br from-[#0B1C3A] via-[#10264D] to-[#173466] p-6 sm:p-8 text-white shadow-sm">
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#C69B3C]/12 blur-2xl"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <img
                src={logoSrc}
                alt={`Logo ${schoolName}`}
                referrerPolicy="no-referrer"
                className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl bg-white/95 p-1.5 object-contain shadow-md ring-2 ring-[#C69B3C]/60"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E7D4A3]">
                  Sistem Informasi Kehadiran Madrasah
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {appName}
                </h2>
                <p className="text-sm font-medium text-slate-200">{schoolName}</p>
                <p className="text-xs text-slate-300/85">{schoolAddress}</p>
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-[#C69B3C]/40 bg-[#09162E]/70 px-4 py-3 text-left sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#E7D4A3]">
                Biaya Langganan
              </p>
              <div className="mt-1 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#4ADE80]" />
                <span className="font-display text-xl font-bold text-white">Rp0/bulan</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Biaya langganan dibebaskan untuk lembaga ini
              </p>
            </div>
          </div>
        </section>

        {/* Developer & Subscription Details */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF3FA] text-[#10264D]">
                <Code2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Dikembangkan Oleh
                </p>
                <h3 className="font-display text-lg font-bold text-[#10264D]">
                  ArtVisual Production
                </h3>
                <p className="text-xs font-light text-slate-500">
                  Application and Website Developer
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1 border-t border-[#F1F5F9]">
              Aplikasi ini dikembangkan secara khusus oleh{' '}
              <strong className="text-[#10264D]">ArtVisual Production</strong> untuk mendukung
              kedisiplinan, efisiensi administrasi, dan transparansi data kehadiran siswa serta guru
              di lingkungan madrasah.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#FCF9F1] text-[#8D6B22] ring-1 ring-[#E7D4A3]">
                <Award className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Biaya Langganan
                </p>
                <h3 className="font-display text-lg font-bold text-[#10264D]">Rp0/bulan</h3>
                <p className="text-xs text-[#15803D] font-medium">
                  Biaya langganan dibebaskan untuk lembaga ini
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-[#F1F5F9] grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-400">Format Jam</p>
                <p className="font-mono font-semibold text-[#10264D]">24 Jam (HH:mm)</p>
              </div>
              <div>
                <p className="text-slate-400">Keamanan Sesi</p>
                <p className="font-semibold text-[#10264D] inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#15803D]" />
                  Aktif &amp; Terenkripsi
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core System Capabilities */}
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-[#10264D]">
              Kemampuan Utama Sistem
            </h3>
            <p className="text-xs text-slate-500">
              Modul terpadu yang tersedia di dalam {appName}.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CORE_CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="flex items-start gap-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#10264D] text-[#E7D4A3]">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-[#10264D]">{cap.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{cap.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
  );
}

export function AboutPage() {
  useDocumentTitle('Tentang Aplikasi');
  return (
    <AppShell
      title="Tentang Aplikasi"
      subtitle="Informasi pengembang, status berlangganan, dan ringkasan sistem aplikasi."
    >
      <AboutContent />
    </AppShell>
  );
}

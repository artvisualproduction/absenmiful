import { AlertCircle, CheckCircle2, Clock, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';

export interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
  showIcon?: boolean;
  className?: string;
}

const TONE_STYLES: Record<BadgeTone, string> = {
  success: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
  warning: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  danger: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
  info: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  gold: 'bg-[#FCF9F1] text-[#8D6B22] border-[#E7D4A3]',
  neutral: 'bg-slate-50 text-slate-700 border-slate-200',
};

function ToneIcon({ tone }: { tone: BadgeTone }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  switch (tone) {
    case 'success':
      return <CheckCircle2 className={cls} aria-hidden="true" />;
    case 'warning':
      return <Clock className={cls} aria-hidden="true" />;
    case 'danger':
      return <XCircle className={cls} aria-hidden="true" />;
    case 'info':
      return <Info className={cls} aria-hidden="true" />;
    default:
      return <AlertCircle className={cls} aria-hidden="true" />;
  }
}

/**
 * Restrained rectangular status indicator paired with explicit Indonesian text
 * (never conveys semantic state by color alone).
 */
export function StatusBadge({
  label,
  tone = 'neutral',
  showIcon = true,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0',
        TONE_STYLES[tone],
        className,
      )}
    >
      {showIcon && <ToneIcon tone={tone} />}
      <span>{label}</span>
    </span>
  );
}

/** Helper mapping common domain status codes to Indonesian labels & tones */
export function mapStatusToBadge(status: string): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'ACTIVE':
    case 'DEMO_ACTIVE':
      return { label: 'Aktif', tone: 'success' };
    case 'INACTIVE':
      return { label: 'Nonaktif', tone: 'neutral' };
    case 'GRADUATED':
      return { label: 'Lulus', tone: 'info' };
    case 'TRANSFERRED':
      return { label: 'Pindah', tone: 'neutral' };
    case 'PRESENT':
      return { label: 'Hadir', tone: 'success' };
    case 'LATE':
      return { label: 'Terlambat', tone: 'warning' };
    case 'SICK':
      return { label: 'Sakit', tone: 'info' };
    case 'EXCUSED':
      return { label: 'Izin', tone: 'info' };
    case 'ABSENT':
      return { label: 'Alfa', tone: 'danger' };
    case 'REJECTED':
      return { label: 'Ditolak', tone: 'danger' };
    case 'SUBMITTED':
      return { label: 'Diajukan', tone: 'warning' };
    case 'ADMIN_REVIEWED':
      return { label: 'Diverifikasi Admin', tone: 'info' };
    case 'RETURNED':
      return { label: 'Dikembalikan', tone: 'warning' };
    case 'APPROVED':
      return { label: 'Disetujui', tone: 'success' };
    case 'CANCELLED':
      return { label: 'Dibatalkan', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

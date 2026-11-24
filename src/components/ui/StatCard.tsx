import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  accent?: 'navy' | 'gold' | 'success' | 'warning' | 'danger';
  className?: string;
}

const ICON_BG: Record<NonNullable<StatCardProps['accent']>, string> = {
  navy: 'bg-[#EEF3FA] text-[#10264D] ring-1 ring-[#10264D]/10',
  gold: 'bg-[#FDF8EC] text-[#9A711D] ring-1 ring-[#C69B3C]/22',
  success: 'bg-[#ECFDF5] text-[#15803D] ring-1 ring-[#15803D]/15',
  warning: 'bg-[#FFFBEB] text-[#B45309] ring-1 ring-[#D97706]/20',
  danger: 'bg-[#FEF2F2] text-[#B91C1C] ring-1 ring-[#DC2626]/15',
};

const VALUE_TINT: Record<NonNullable<StatCardProps['accent']>, string> = {
  navy: 'text-[#10264D]',
  gold: 'text-[#10264D]',
  success: 'text-[#14532D]',
  warning: 'text-[#92400E]',
  danger: 'text-[#991B1B]',
};

export function StatCard({
  label,
  value,
  subtext,
  icon,
  accent = 'navy',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'group rounded-2xl border border-[#E2E8F0]/90 bg-white p-3.5 sm:p-4 flex items-start justify-between gap-3',
        'shadow-[0_1px_2px_rgba(16,38,77,0.03)] hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-[0_12px_24px_-14px_rgba(16,38,77,0.16)] transition-all',
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-[11.5px] font-semibold text-slate-500 truncate">{label}</p>
        <p
          className={cn(
            'text-2xl sm:text-[26px] leading-tight font-bold tracking-tight tabular-nums',
            VALUE_TINT[accent],
          )}
        >
          {value}
        </p>
        {subtext && (
          <p className="text-[11.5px] text-slate-500/95 truncate pt-0.5">{subtext}</p>
        )}
      </div>
      {icon && (
        <div
          className={cn(
            'h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105',
            ICON_BG[accent],
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
    </div>
  );
}

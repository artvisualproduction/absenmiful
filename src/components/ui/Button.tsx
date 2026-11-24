import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'gold' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#10264D] text-white hover:bg-[#193A73] active:scale-[0.98] border border-[#10264D] shadow-xs hover:shadow-sm focus-visible:ring-[#10264D]',
  gold:
    'bg-[#C69B3C] text-[#09162E] font-semibold hover:bg-[#B48A2E] hover:text-white active:scale-[0.98] border border-[#C69B3C] shadow-xs focus-visible:ring-[#C69B3C]',
  secondary:
    'bg-[#EEF3FA] text-[#10264D] hover:bg-[#E1EAF6] active:scale-[0.98] border border-[#D4E0F0] focus-visible:ring-[#10264D]',
  outline:
    'bg-white text-[#10264D] hover:bg-[#F8FAFC] hover:border-[#94A3B8] active:scale-[0.98] border border-[#CBD5E1] focus-visible:ring-[#10264D]',
  ghost:
    'bg-transparent text-[#334155] hover:bg-[#F1F5F9] hover:text-[#10264D] active:scale-[0.98] border border-transparent focus-visible:ring-[#10264D]',
  danger:
    'bg-[#B91C1C] text-white hover:bg-[#991B1B] active:scale-[0.98] border border-[#B91C1C] shadow-xs focus-visible:ring-[#B91C1C]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-xs gap-1.5 rounded-xl',
  md: 'min-h-[40px] px-4 py-2 text-[13px] gap-2 rounded-xl',
  lg: 'min-h-[44px] px-5 py-2.5 text-sm gap-2 rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium max-w-full text-center leading-tight sm:whitespace-nowrap shrink-0 cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-55 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" /> : leftIcon}
      <span className="min-w-0">{children}</span>
      {!loading && rightIcon}
    </button>
  );
}

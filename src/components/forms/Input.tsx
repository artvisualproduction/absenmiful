import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, leftAddon, rightAddon, id, required, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  return (
    <div className="w-full space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-[#10264D]"
        >
          {label}
          {required && (
            <span className="ml-1 text-[#B91C1C]" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative flex items-center">
        {leftAddon && (
          <span className="pointer-events-none absolute left-3 text-slate-400 flex items-center">
            {leftAddon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            'w-full min-h-[38px] rounded-xl border bg-white px-3 py-1.5 text-[13px] text-[#10264D] placeholder:text-slate-400',
            'hover:border-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#10264D]/15 focus:border-[#10264D]',
            'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
            error ? 'border-[#B91C1C] focus:border-[#B91C1C] focus:ring-[#B91C1C]/20' : 'border-[#CBD5E1]',
            Boolean(leftAddon) && 'pl-9',
            Boolean(rightAddon) && 'pr-9',
            className,
          )}
          {...props}
        />

        {rightAddon && (
          <span className="absolute right-2.5 flex items-center">{rightAddon}</span>
        )}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-[#B91C1C]">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

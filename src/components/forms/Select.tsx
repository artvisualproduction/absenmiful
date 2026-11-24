import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  placeholder?: string;
  leftAddon?: ReactNode;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helperText, error, placeholder, leftAddon, options, id, required, className, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-[#10264D]">
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

        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            'w-full min-h-[38px] appearance-none rounded-xl border bg-white pl-3 pr-9 py-1.5 text-[13px] text-[#10264D]',
            'hover:border-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#10264D]/15 focus:border-[#10264D]',
            'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
            error ? 'border-[#B91C1C]' : 'border-[#CBD5E1]',
            Boolean(leftAddon) && 'pl-9',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled={required}>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"
          aria-hidden="true"
        />
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

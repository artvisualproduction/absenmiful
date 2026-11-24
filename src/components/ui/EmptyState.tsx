import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-white px-6 py-12 text-center',
        className,
      )}
    >
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F2F5FA] text-[#10264D]"
        aria-hidden="true"
      >
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-[#10264D]">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-slate-600 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

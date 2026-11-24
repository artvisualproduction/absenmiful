import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-slate-200/80', className)}
    />
  );
}

export function LoadingSpinner({ label = 'Memuat data...' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2.5 py-8 text-sm text-slate-600">
      <Loader2 className="h-5 w-5 animate-spin text-[#10264D]" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Memuat tabel" className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="grid gap-4 px-4 py-3.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, cIdx) => (
            <Skeleton key={cIdx} className="h-4 w-full max-w-[180px]" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Memuat halaman" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <TableSkeleton rows={5} columns={4} />
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { EmptyState } from '../ui/EmptyState';
import { TableSkeleton } from '../ui/Skeleton';

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render: (row: T) => ReactNode;
}

export interface CursorPaginationConfig {
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export interface DataTableProps<T extends { id: string }> {
  columns: Array<TableColumn<T>>;
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  page?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (nextPage: number) => void;
  cursorPagination?: CursorPaginationConfig;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  toolbar?: ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  emptyTitle = 'Belum ada data',
  emptyDescription = 'Data akan tampil di sini setelah ditambahkan atau disesuaikan dengan filter.',
  emptyAction,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  toolbar,
}: DataTableProps<T>) {
  const allVisibleSelected =
    data.length > 0 && data.every((row) => selectedIds.includes(row.id));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allVisibleSelected) {
      const visibleSet = new Set(data.map((r) => r.id));
      onSelectionChange(selectedIds.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...data.map((r) => r.id)]);
      onSelectionChange(Array.from(merged));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E2E8F0]/95 bg-white overflow-hidden shadow-[0_1px_2px_rgba(16,38,77,0.03)]">
      {toolbar && (
        <div className="border-b border-[#E2E8F0] px-3.5 sm:px-4 py-3.5 bg-white">{toolbar}</div>
      )}

      {loading ? (
        <TableSkeleton rows={6} columns={columns.length + (selectable ? 1 : 0)} />
      ) : data.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
            className="border-none py-8"
          />
        </div>
      ) : (
        <div className="overflow-x-auto touch-scroll-x">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11.5px] font-semibold text-slate-500">
                {selectable && (
                  <th className="w-11 px-3.5 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua baris pada halaman ini"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-slate-300 text-[#10264D] focus:ring-[#10264D] cursor-pointer"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-3.5 py-2.5 whitespace-nowrap',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {data.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'transition-colors hover:bg-[#F8FAFC]/90',
                      isSelected && 'bg-[#EEF3FA]/60',
                    )}
                  >
                    {selectable && (
                      <td className="px-3.5 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Pilih baris ${row.id}`}
                          checked={isSelected}
                          onChange={() => toggleOne(row.id)}
                          className="h-4 w-4 rounded border-slate-300 text-[#10264D] focus:ring-[#10264D] cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3.5 py-2.5 text-[#1E293B] align-middle',
                          col.align === 'right' && 'text-right tabular-nums',
                          col.align === 'center' && 'text-center',
                          col.className,
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

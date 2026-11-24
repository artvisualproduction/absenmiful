import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AttendanceTrendPoint } from '../../services/reportService';
import { cn } from '../../lib/cn';

export interface AttendanceTrendChartProps {
  title: string;
  subtitle?: string;
  data: AttendanceTrendPoint[];
  variant?: 'overview' | 'lateness';
  height?: number;
}

/**
 * Lightweight Recharts visualization paired with a 1-click accessible table view
 * so screen-reader and keyboard users can inspect exact tabular values.
 */
export function AttendanceTrendChart({
  title,
  subtitle,
  data,
  variant = 'overview',
  height = 260,
}: AttendanceTrendChartProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-3.5">
        <div>
          <h3 className="text-sm font-semibold text-[#10264D]">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div
          role="group"
          aria-label="Pilih tampilan grafik atau tabel"
          className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5"
        >
          <button
            type="button"
            onClick={() => setViewMode('chart')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
              viewMode === 'chart'
                ? 'bg-[#10264D] text-white'
                : 'text-slate-600 hover:text-[#10264D]',
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Grafik</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
              viewMode === 'table'
                ? 'bg-[#10264D] text-white'
                : 'text-slate-600 hover:text-[#10264D]',
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span>Tabel</span>
          </button>
        </div>
      </div>

      <div className="p-5">
        {data.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">
            Belum ada data hari kerja aktif pada rentang tanggal yang dipilih.
          </p>
        ) : viewMode === 'chart' ? (
          <div style={{ width: '100%', height }} aria-label={title}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#475569', fontSize: 11 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#475569', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                {variant === 'overview' && (
                  <Bar
                    dataKey="present"
                    name="Hadir"
                    fill="#10264D"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                )}
                <Bar
                  dataKey="late"
                  name="Terlambat"
                  fill="#C69B3C"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="excusedSick"
                  name="Izin / Sakit"
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="absent"
                  name="Alfa / Belum Absen"
                  fill="#DC2626"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">Tanggal</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Hadir</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Terlambat</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Izin / Sakit</th>
                  <th className="pb-2 text-right font-semibold">Alfa / Belum Absen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] tabular-nums">
                {data.map((row) => (
                  <tr key={row.date} className="hover:bg-[#F8FAFC]">
                    <td className="py-2 pr-3 font-mono text-[#10264D]">{row.date}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-[#15803D]">
                      {row.present}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold text-[#B45309]">
                      {row.late}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold text-[#1D4ED8]">
                      {row.excusedSick}
                    </td>
                    <td className="py-2 text-right font-semibold text-[#B91C1C]">{row.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

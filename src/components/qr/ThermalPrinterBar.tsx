import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  CheckCircle2,
  Printer,
  ReceiptText,
  Unplug,
} from 'lucide-react';
import QRCode from 'qrcode';
import { cn } from '../../lib/cn';
import {
  printThermalReceiptsViaBrowser,
  thermalPrinterManager,
  type ThermalPaperWidth,
  type ThermalPrinterSnapshot,
  type ThermalQrRenderMode,
  type ThermalQrTicketItem,
} from '../../lib/thermalPrinter';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

export function useThermalPrinter(): ThermalPrinterSnapshot & {
  pairPrinter: () => Promise<string>;
  disconnectPrinter: (forgetSaved?: boolean) => void;
  setPaperWidth: (width: ThermalPaperWidth) => void;
  setQrMode: (mode: ThermalQrRenderMode) => void;
  printTickets: (items: ThermalQrTicketItem[]) => Promise<void>;
} {
  const snapshot = useSyncExternalStore(
    thermalPrinterManager.subscribe,
    thermalPrinterManager.getSnapshot,
    thermalPrinterManager.getSnapshot,
  );

  return {
    ...snapshot,
    pairPrinter: () => thermalPrinterManager.pairPrinter(),
    disconnectPrinter: (forgetSaved = false) => thermalPrinterManager.disconnect(forgetSaved),
    setPaperWidth: (width) => thermalPrinterManager.setPaperWidth(width),
    setQrMode: (mode) => thermalPrinterManager.setQrMode(mode),
    printTickets: (items) => thermalPrinterManager.printTickets(items),
  };
}

export interface ThermalPrinterBarProps {
  className?: string;
}

/**
 * Compact Bluetooth Thermal Printer bar allowing 1-time pairing and paper/mode toggles.
 */
export function ThermalPrinterBar({ className }: ThermalPrinterBarProps) {
  const printer = useThermalPrinter();
  const { showToast } = useToast();

  const isConnected = printer.status === 'connected' || printer.status === 'printing';
  const isBusy = printer.status === 'connecting' || printer.status === 'printing';

  const handlePair = async () => {
    try {
      const name = await printer.pairPrinter();
      showToast({
        variant: 'success',
        title: 'Printer Thermal Terhubung',
        message: `${name} tersimpan. Cetak berikutnya langsung jalan tanpa pairing ulang.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghubungkan printer.';
      if (!msg.toLowerCase().includes('cancel')) {
        showToast({
          variant: 'error',
          title: 'Gagal Pairing Bluetooth',
          message: msg,
        });
      }
    }
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between',
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div
          className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
            isConnected
              ? 'bg-[#ECFDF5] text-[#15803D]'
              : 'bg-[#EEF3FA] text-[#10264D]',
          )}
        >
          {isConnected ? (
            <BluetoothConnected className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Bluetooth className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-sm font-semibold text-[#10264D]">
              Cetak Nota Thermal Bluetooth
            </p>
            <span className="text-xs text-slate-400" aria-hidden="true">
              ·
            </span>
            <span
              className={cn(
                'text-xs font-medium',
                isConnected ? 'text-[#15803D]' : 'text-slate-500',
              )}
            >
              {isConnected
                ? `Terhubung: ${printer.deviceName || 'Printer Thermal'}`
                : printer.deviceName
                  ? `Tersimpan: ${printer.deviceName} (siap sambung otomatis)`
                  : 'Pairing 1x saja untuk cetak cepat'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {printer.isBluetoothSupported
              ? 'Mendukung printer thermal Bluetooth 58mm & 80mm (ESC/POS) serta cetak nota via dialog sistem.'
              : 'Browser ini belum mendukung Web Bluetooth — gunakan Chrome/Edge atau cetak nota via dialog browser.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Paper Width Switcher */}
        <div
          className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5"
          role="group"
          aria-label="Ukuran kertas thermal"
        >
          {(['58mm', '80mm'] as ThermalPaperWidth[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => printer.setPaperWidth(w)}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap',
                printer.paperWidth === w
                  ? 'bg-[#10264D] text-white'
                  : 'text-slate-600 hover:text-[#10264D]',
              )}
            >
              {w}
            </button>
          ))}
        </div>

        {/* QR ESC/POS Mode Toggle */}
        <div
          className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5"
          role="group"
          aria-label="Mode cetak QR"
        >
          {(
            [
              { value: 'native', label: 'QR Native' },
              { value: 'raster', label: 'QR Raster' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => printer.setQrMode(mode.value)}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap',
                printer.qrMode === mode.value
                  ? 'bg-[#C69B3C] text-[#09162E]'
                  : 'text-slate-600 hover:text-[#10264D]',
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {printer.isBluetoothSupported ? (
          isConnected ? (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handlePair()}
                disabled={isBusy}
                leftIcon={<Bluetooth className="h-3.5 w-3.5" />}
              >
                Ganti Printer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  printer.disconnectPrinter(false);
                  showToast({ variant: 'info', title: 'Koneksi printer diputus sementara' });
                }}
                disabled={isBusy}
                aria-label="Putuskan printer"
              >
                <Unplug className="h-3.5 w-3.5 text-slate-500" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="primary"
              loading={printer.status === 'connecting'}
              onClick={() => void handlePair()}
              leftIcon={<Bluetooth className="h-3.5 w-3.5" />}
            >
              {printer.deviceName ? 'Sambungkan Printer' : 'Pairing Bluetooth (1x)'}
            </Button>
          )
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 px-2">
            <BluetoothOff className="h-3.5 w-3.5" aria-hidden="true" />
            Mode Cetak Browser
          </span>
        )}
      </div>
    </div>
  );
}

export interface ThermalReceiptPreviewModalProps {
  items: ThermalQrTicketItem[] | null;
  onClose: () => void;
}

export function ThermalReceiptPreviewModal({
  items,
  onClose,
}: ThermalReceiptPreviewModalProps) {
  const printer = useThermalPrinter();
  const { showToast } = useToast();
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [browserPrinting, setBrowserPrinting] = useState(false);

  useEffect(() => {
    if (!items || items.length === 0) {
      setQrMap({});
      return;
    }
    let active = true;
    void Promise.all(
      items.map(async (item) => {
        const url = await QRCode.toDataURL(item.rawToken, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#FFFFFF' },
        });
        return [item.id, url] as const;
      }),
    ).then((entries) => {
      if (active) {
        setQrMap(Object.fromEntries(entries));
      }
    });
    return () => {
      active = false;
    };
  }, [items]);

  const handleBluetoothPrint = async () => {
    if (!items || items.length === 0) return;
    try {
      await printer.printTickets(items);
      showToast({
        variant: 'success',
        title: 'Nota QR Thermal Tercetak',
        message: `${items.length} nota QR berhasil dikirim ke ${printer.deviceName || 'printer Bluetooth'}.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mencetak ke printer Bluetooth.';
      if (!msg.toLowerCase().includes('cancel')) {
        showToast({
          variant: 'error',
          title: 'Cetak Bluetooth Gagal',
          message: msg,
        });
      }
    }
  };

  const handleBrowserPrint = async () => {
    if (!items || items.length === 0) return;
    setBrowserPrinting(true);
    try {
      await printThermalReceiptsViaBrowser(items, printer.paperWidth);
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal membuka dialog cetak',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setBrowserPrinting(false);
    }
  };

  const isConnected = printer.status === 'connected' || printer.status === 'printing';
  const count = items?.length ?? 0;
  const isSingle = count <= 1;

  return (
    <Modal
      open={Boolean(items && items.length > 0)}
      onClose={() => printer.status !== 'printing' && onClose()}
      title={`Pratinjau Nota Thermal QR (${count} Nota)`}
      description={`Format struk ${printer.paperWidth}. Pairing Bluetooth hanya 1x dan otomatis diingat.`}
      size={isSingle ? 'md' : 'lg'}
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            loading={browserPrinting}
            disabled={printer.status === 'printing'}
            onClick={() => void handleBrowserPrint()}
            leftIcon={<Printer className="h-4 w-4" />}
          >
            Cetak Dialog / USB
          </Button>
          {printer.isBluetoothSupported && (
            <Button
              variant="primary"
              size="sm"
              loading={printer.status === 'printing' || printer.status === 'connecting'}
              onClick={() => void handleBluetoothPrint()}
              leftIcon={<Bluetooth className="h-4 w-4" />}
            >
              {isConnected ? 'Cetak via Bluetooth' : 'Pairing & Cetak Bluetooth'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Compact Status & Paper/Mode Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0">
            {isConnected ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-[#15803D] shrink-0" />
                <span className="truncate">
                  Terhubung: <strong>{printer.deviceName}</strong>
                </span>
              </>
            ) : (
              <>
                <ReceiptText className="h-4 w-4 text-[#10264D] shrink-0" />
                <span className="truncate">Siap cetak nota thermal</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-0.5 text-[11px]"
              role="group"
              aria-label="Lebar kertas thermal"
            >
              {(['58mm', '80mm'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => printer.setPaperWidth(w)}
                  className={cn(
                    'rounded-md px-2 py-0.5 font-medium transition-colors cursor-pointer',
                    printer.paperWidth === w
                      ? 'bg-[#10264D] text-white'
                      : 'text-slate-600 hover:text-[#10264D]',
                  )}
                >
                  {w}
                </button>
              ))}
            </div>

            <div
              className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-0.5 text-[11px]"
              role="group"
              aria-label="Mode QR thermal"
            >
              {(['native', 'raster'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => printer.setQrMode(m)}
                  className={cn(
                    'rounded-md px-2 py-0.5 font-medium transition-colors cursor-pointer',
                    printer.qrMode === m
                      ? 'bg-[#C69B3C] text-[#09162E]'
                      : 'text-slate-600 hover:text-[#10264D]',
                  )}
                >
                  {m === 'native' ? 'Native' : 'Raster'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Centered Receipt Paper Preview Tray */}
        <div
          className={cn(
            'rounded-xl bg-[#F1F5F9]/85 border border-[#E2E8F0]/80 p-4',
            isSingle
              ? 'flex justify-center'
              : 'grid grid-cols-1 sm:grid-cols-2 gap-4 justify-items-center',
          )}
        >
          {items?.map((item) => (
            <div
              key={item.id}
              className={cn(
                'w-full rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3.5 font-mono text-slate-900 shadow-sm',
                printer.paperWidth === '58mm' ? 'max-w-[232px]' : 'max-w-[280px]',
              )}
            >
              <div className="text-center space-y-0.5 leading-tight">
                <p className="text-[11px] font-bold uppercase tracking-wide">
                  {item.appName || 'Absensi Digital'}
                </p>
                <p className="text-[11px] font-bold uppercase">{item.schoolName}</p>
                <p className="text-[10px] text-slate-600">
                  {item.ownerType === 'STUDENT' ? 'KARTU QR SISWA' : 'KARTU QR GURU'}
                </p>
              </div>

              <div className="my-2 border-t border-dashed border-slate-400" />

              <div className="flex justify-center py-0.5">
                {qrMap[item.id] ? (
                  <img
                    src={qrMap[item.id]}
                    alt={`QR ${item.fullName}`}
                    className={cn(
                      'object-contain',
                      printer.paperWidth === '58mm' ? 'h-32 w-32' : 'h-40 w-40',
                    )}
                  />
                ) : (
                  <div className="h-32 w-32 rounded bg-slate-100 animate-pulse" />
                )}
              </div>

              <p className="mt-1.5 text-center text-xs font-bold leading-snug break-words">
                {item.fullName}
              </p>

              <div className="my-2 border-t border-dashed border-slate-400" />

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">{item.identifierLabel}</span>
                  <span className="font-bold tabular-nums">{item.identifierValue}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">{item.secondaryLabel}</span>
                  <span className="font-bold text-right">{item.secondaryValue}</span>
                </div>
              </div>

              <div className="my-2 border-t border-dashed border-slate-400" />

              <p className="text-center text-[10px] text-slate-600">
                {item.ownerType === 'STUDENT'
                  ? 'Scan QR ini di Portal Absensi'
                  : 'Scan QR + Selfie di Portal Absensi'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

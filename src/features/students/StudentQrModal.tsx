import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, ReceiptText } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  ThermalReceiptPreviewModal,
  useThermalPrinter,
} from '../../components/qr/ThermalPrinterBar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { downloadSingleQrCardPng } from '../../lib/qrCardRenderer';
import type { ThermalQrTicketItem } from '../../lib/thermalPrinter';
import type { EnrichedStudent } from '../../services/masterDataService';

export interface StudentQrModalProps {
  student: EnrichedStudent | null;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}

export function StudentQrModal({ student, onClose }: StudentQrModalProps) {
  const { publicSettings } = useAuth();
  const { showToast } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [thermalPrinting, setThermalPrinting] = useState(false);
  const [thermalItems, setThermalItems] = useState<ThermalQrTicketItem[] | null>(null);
  const [copied, setCopied] = useState(false);
  const thermalPrinter = useThermalPrinter();

  useEffect(() => {
    setCopied(false);
    if (!student) {
      setQrDataUrl(null);
      return;
    }
    let active = true;
    void QRCode.toDataURL(student.nis, {
      width: 260,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#10264D', light: '#FFFFFF' },
    }).then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [student]);

  const handleCopy = async () => {
    if (!student) return;
    try {
      await navigator.clipboard.writeText(student.nis);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be restricted
    }
  };

  const handleDownloadCard = async () => {
    if (!student) return;
    setDownloading(true);
    try {
      await downloadSingleQrCardPng({
        ownerType: 'STUDENT',
        fullName: student.fullName,
        identifierLabel: 'NIS',
        identifierValue: student.nis,
        secondaryLabel: 'Kelas',
        secondaryValue: student.className,
        rawToken: student.nis,
        schoolName: publicSettings?.schoolName ?? 'MI Miftahul Ulum Sumberwuluh',
        schoolAddress: publicSettings?.schoolAddress ?? '',
        logoUrl: publicSettings?.logoPath ?? '/images/school-logo.jpg',
        primaryColor: publicSettings?.theme.primary ?? '#10264D',
        accentColor: publicSettings?.theme.accent ?? '#C69B3C',
      });
      showToast({
        variant: 'success',
        title: 'Kartu QR berhasil diunduh',
        message: `Kartu QR ${student.fullName} (NIS: ${student.nis}) telah disimpan.`,
      });
    } catch {
      showToast({
        variant: 'error',
        title: 'Gagal mengunduh kartu QR',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintThermal = async () => {
    if (!student) return;
    const ticket: ThermalQrTicketItem = {
      id: student.id,
      ownerType: 'STUDENT',
      appName: publicSettings?.appName ?? 'Absensi Digital',
      schoolName: publicSettings?.schoolName ?? 'MI Miftahul Ulum Sumberwuluh',
      fullName: student.fullName,
      identifierLabel: 'NIS',
      identifierValue: student.nis,
      secondaryLabel: 'Kelas',
      secondaryValue: student.className,
      rawToken: student.nis,
    };

    if (thermalPrinter.status === 'connected') {
      setThermalPrinting(true);
      try {
        await thermalPrinter.printTickets([ticket]);
        showToast({
          variant: 'success',
          title: 'Nota QR Thermal Tercetak',
          message: `QR ${student.fullName} dicetak ke ${thermalPrinter.deviceName || 'printer Bluetooth'}.`,
        });
      } catch (err) {
        showToast({
          variant: 'error',
          title: 'Gagal mencetak via Bluetooth',
          message: err instanceof Error ? err.message : 'Silakan coba melalui pratinjau thermal.',
        });
        setThermalItems([ticket]);
      } finally {
        setThermalPrinting(false);
      }
      return;
    }

    setThermalItems([ticket]);
  };

  return (
    <Modal
      open={Boolean(student)}
      onClose={() => !downloading && onClose()}
      title="QR Code Absensi Siswa"
      size="md"
      footer={
        student ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={downloading || thermalPrinting}
            >
              Tutup
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handlePrintThermal()}
              loading={thermalPrinting}
              disabled={downloading}
              leftIcon={<ReceiptText className="h-4 w-4" />}
            >
              Cetak Nota Thermal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleDownloadCard()}
              loading={downloading}
              disabled={thermalPrinting}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Unduh PNG
            </Button>
          </>
        ) : undefined
      }
    >
      {student && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-sm">
            <p className="font-bold text-[#10264D]">{student.fullName}</p>
            <p className="text-xs text-slate-600 mt-0.5">
              NIS <span className="font-mono font-semibold text-[#10264D]">{student.nis}</span> ·
              Kelas {student.className}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-5">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={`Kode QR ${student.fullName}`}
                className="h-52 w-52 rounded-lg border border-[#E2E8F0]"
              />
            )}
            <div className="w-full space-y-1.5">
              <p className="text-[11px] font-medium text-slate-500">
                Isi QR Code (NIS Siswa — langsung siap dipindai di Portal Absensi):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 font-mono text-xs font-semibold text-[#10264D]">
                  {student.nis}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopy()}
                  leftIcon={
                    copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />
                  }
                >
                  {copied ? 'Disalin' : 'Salin NIS'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ThermalReceiptPreviewModal
        items={thermalItems}
        onClose={() => setThermalItems(null)}
      />
    </Modal>
  );
}

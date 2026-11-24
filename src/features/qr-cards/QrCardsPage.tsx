import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  FolderArchive,
  GraduationCap,
  Loader2,
  Printer,
  ReceiptText,
  ShieldAlert,
  Users,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { Select } from '../../components/forms/Select';
import { AppShell } from '../../components/layout/AppShell';
import {
  ThermalPrinterBar,
  ThermalReceiptPreviewModal,
  useThermalPrinter,
} from '../../components/qr/ThermalPrinterBar';
import { DataTable, type TableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  downloadBulkQrCardsZip,
  downloadSingleQrCardPng,
  type QrCardRenderInput,
} from '../../lib/qrCardRenderer';
import type { ThermalQrTicketItem } from '../../lib/thermalPrinter';
import { ApiClientError } from '../../services/apiClient';
import {
  masterDataService,
  type EnrichedClass,
  type EnrichedStudent,
  type EnrichedTeacher,
} from '../../services/masterDataService';
import { StudentStatus, TeacherStatus } from '../../types';

interface PrintableCardItem {
  id: string;
  ownerType: 'STUDENT' | 'TEACHER';
  fullName: string;
  identifierLabel: string;
  identifierValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  qrDataUrl: string;
}

export function QrCardsPage() {
  useDocumentTitle('Kartu & QR Code');
  const { publicSettings } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState<EnrichedClass[]>([]);
  const [students, setStudents] = useState<EnrichedStudent[]>([]);
  const [teachers, setTeachers] = useState<EnrichedTeacher[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkWorking, setBulkWorking] = useState<'zip' | 'print' | 'thermal' | null>(null);
  const [printPreviewCards, setPrintPreviewCards] = useState<PrintableCardItem[] | null>(null);
  const [thermalPreviewItems, setThermalPreviewItems] = useState<ThermalQrTicketItem[] | null>(
    null,
  );
  const thermalPrinter = useThermalPrinter();

  const appName = publicSettings?.appName ?? 'Absensi Digital';
  const schoolName = publicSettings?.schoolName ?? 'MI Miftahul Ulum Sumberwuluh';
  const schoolAddress = publicSettings?.schoolAddress ?? '';
  const logoSrc = publicSettings?.logoPath ?? '/images/school-logo.jpg';
  const primaryColor = publicSettings?.theme.primary ?? '#10264D';
  const accentColor = publicSettings?.theme.accent ?? '#C69B3C';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [classRes, studentRes, teacherRes] = await Promise.all([
        masterDataService.listClasses(),
        masterDataService.listStudents({ status: StudentStatus.ACTIVE, limit: 2000 }),
        masterDataService.listTeachers({ status: TeacherStatus.ACTIVE, limit: 1000 }),
      ]);
      setClasses(classRes.items);
      setStudents(studentRes.items);
      setTeachers(teacherRes.items);
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal memuat data peserta',
        message: err instanceof ApiClientError ? err.message : 'Silakan coba beberapa saat lagi.',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setSelectedIds([]);
  }, [tab]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter && s.classId !== classFilter) return false;
      if (q) {
        const hay = `${s.fullName} ${s.nis} ${s.className}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [students, classFilter, search]);

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => {
      if (q) {
        const hay = `${t.fullName} ${t.niyNip} ${t.position}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [teachers, search]);

  /**
   * QR Code langsung berisi NIS (untuk siswa) atau NIY/NIP (untuk guru)
   */
  const buildRenderInput = useCallback(
    (ownerType: 'STUDENT' | 'TEACHER', ownerId: string): QrCardRenderInput | null => {
      if (ownerType === 'STUDENT') {
        const s = students.find((item) => item.id === ownerId);
        if (!s) return null;
        return {
          ownerType: 'STUDENT',
          fullName: s.fullName,
          identifierLabel: 'NIS',
          identifierValue: s.nis,
          secondaryLabel: 'Kelas',
          secondaryValue: s.className,
          rawToken: s.nis,
          schoolName,
          schoolAddress,
          logoUrl: logoSrc,
          primaryColor,
          accentColor,
        };
      }
      const t = teachers.find((item) => item.id === ownerId);
      if (!t) return null;
      return {
        ownerType: 'TEACHER',
        fullName: t.fullName,
        identifierLabel: 'NIY / NIP',
        identifierValue: t.niyNip,
        secondaryLabel: 'Jabatan',
        secondaryValue: t.position,
        rawToken: t.niyNip,
        schoolName,
        schoolAddress,
        logoUrl: logoSrc,
        primaryColor,
        accentColor,
      };
    },
    [students, teachers, schoolName, schoolAddress, logoSrc, primaryColor, accentColor],
  );

  const handleSingleDownload = async (ownerId: string, fullName: string) => {
    setBusyId(ownerId);
    try {
      const cardInput = buildRenderInput(tab, ownerId);
      if (!cardInput) throw new Error('Data peserta tidak ditemukan.');
      await downloadSingleQrCardPng(cardInput);
      showToast({
        variant: 'success',
        title: 'Kartu QR berhasil diunduh',
        message: `Kartu QR ${fullName} (${cardInput.identifierLabel}: ${cardInput.identifierValue}) telah disimpan.`,
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengunduh kartu QR',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat kartu QR.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkZip = async () => {
    if (selectedIds.length === 0) return;
    setBulkWorking('zip');
    try {
      const cards: QrCardRenderInput[] = [];
      for (const ownerId of selectedIds) {
        const card = buildRenderInput(tab, ownerId);
        if (card) cards.push(card);
      }
      const dateStamp = new Date().toISOString().slice(0, 10);
      await downloadBulkQrCardsZip(
        cards,
        `kartu-qr-${tab === 'STUDENT' ? 'siswa' : 'guru'}-${dateStamp}.zip`,
      );
      showToast({
        variant: 'success',
        title: 'Arsip ZIP berhasil dibuat',
        message: `${cards.length} kartu QR portrait (${tab === 'STUDENT' ? 'berbasis NIS' : 'berbasis NIY/NIP'}) berhasil diunduh.`,
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal membuat arsip ZIP',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan saat proses massal.',
      });
    } finally {
      setBulkWorking(null);
    }
  };

  const handlePreparePrint = async (ownerIds: string[]) => {
    if (ownerIds.length === 0) return;
    setBulkWorking('print');
    try {
      const printable: PrintableCardItem[] = [];
      for (const ownerId of ownerIds) {
        const card = buildRenderInput(tab, ownerId);
        if (!card) continue;
        const qrDataUrl = await QRCode.toDataURL(card.rawToken, {
          width: 260,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#0B1B38', light: '#FFFFFF' },
        });
        printable.push({
          id: ownerId,
          ownerType: tab,
          fullName: card.fullName,
          identifierLabel: card.identifierLabel,
          identifierValue: card.identifierValue,
          secondaryLabel: card.secondaryLabel,
          secondaryValue: card.secondaryValue,
          qrDataUrl,
        });
      }
      setPrintPreviewCards(printable);
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menyiapkan halaman cetak',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setBulkWorking(null);
    }
  };

  const buildThermalItems = useCallback(
    (ownerIds: string[]): ThermalQrTicketItem[] => {
      const items: ThermalQrTicketItem[] = [];
      for (const ownerId of ownerIds) {
        const card = buildRenderInput(tab, ownerId);
        if (!card) continue;
        items.push({
          id: ownerId,
          ownerType: tab,
          appName,
          schoolName: card.schoolName,
          fullName: card.fullName,
          identifierLabel: card.identifierLabel,
          identifierValue: card.identifierValue,
          secondaryLabel: card.secondaryLabel,
          secondaryValue: card.secondaryValue,
          rawToken: card.rawToken,
        });
      }
      return items;
    },
    [appName, buildRenderInput, tab],
  );

  /**
   * If Bluetooth printer is already connected (1x paired), prints directly with 1 tap!
   * Otherwise opens the Thermal Receipt Preview modal where user can pair once or print via browser dialog.
   */
  const handleThermalPrint = async (ownerIds: string[], forcePreview = false) => {
    const items = buildThermalItems(ownerIds);
    if (items.length === 0) return;

    if (!forcePreview && thermalPrinter.status === 'connected') {
      setBulkWorking('thermal');
      try {
        await thermalPrinter.printTickets(items);
        showToast({
          variant: 'success',
          title: 'Nota QR Thermal Tercetak',
          message: `${items.length} nota QR langsung dicetak ke ${thermalPrinter.deviceName || 'printer Bluetooth'}.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal mencetak ke printer thermal.';
        showToast({
          variant: 'error',
          title: 'Cetak Thermal Gagal',
          message: msg,
        });
        setThermalPreviewItems(items);
      } finally {
        setBulkWorking(null);
      }
      return;
    }

    setThermalPreviewItems(items);
  };

  const studentColumns: Array<TableColumn<EnrichedStudent>> = [
    {
      key: 'nis',
      header: 'NIS (Isi QR)',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#10264D] tabular-nums">
          {row.nis}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Nama Siswa',
      render: (row) => <span className="font-semibold text-[#10264D]">{row.fullName}</span>,
    },
    {
      key: 'class',
      header: 'Kelas',
      render: (row) => <span className="text-slate-700">Kelas {row.className}</span>,
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center justify-end gap-1">
          <button
            type="button"
            disabled={busyId === row.id || bulkWorking !== null}
            onClick={() => void handleThermalPrint([row.id])}
            title={`Cetak nota thermal ${row.fullName}`}
            aria-label={`Cetak nota thermal ${row.fullName}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FCF9F1] text-[#8D6B22] hover:bg-[#FAF2DE] hover:border-[#C69B3C] transition-colors cursor-pointer disabled:opacity-50"
          >
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={busyId === row.id}
            onClick={() => void handleSingleDownload(row.id, row.fullName)}
            title={`Unduh kartu PNG ${row.fullName}`}
            aria-label={`Unduh kartu PNG ${row.fullName}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#10264D] bg-[#10264D] text-white hover:bg-[#19386B] transition-colors cursor-pointer disabled:opacity-50"
          >
            {busyId === row.id ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            disabled={busyId === row.id}
            onClick={() => void handlePreparePrint([row.id])}
            title={`Pratinjau cetak ${row.fullName}`}
            aria-label={`Pratinjau cetak ${row.fullName}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] hover:border-[#10264D] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  const teacherColumns: Array<TableColumn<EnrichedTeacher>> = [
    {
      key: 'niy',
      header: 'NIY / NIP (Isi QR)',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#10264D] tabular-nums">
          {row.niyNip}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Nama Guru',
      render: (row) => <span className="font-semibold text-[#10264D]">{row.fullName}</span>,
    },
    {
      key: 'position',
      header: 'Jabatan',
      render: (row) => <span className="text-slate-700">{row.position}</span>,
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center justify-end gap-1">
          <button
            type="button"
            disabled={busyId === row.id || bulkWorking !== null}
            onClick={() => void handleThermalPrint([row.id])}
            title={`Cetak nota thermal ${row.fullName}`}
            aria-label={`Cetak nota thermal ${row.fullName}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FCF9F1] text-[#8D6B22] hover:bg-[#FAF2DE] hover:border-[#C69B3C] transition-colors cursor-pointer disabled:opacity-50"
          >
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={busyId === row.id}
            onClick={() => void handleSingleDownload(row.id, row.fullName)}
            title={`Unduh kartu PNG ${row.fullName}`}
            aria-label={`Unduh kartu PNG ${row.fullName}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#10264D] bg-[#10264D] text-white hover:bg-[#19386B] transition-colors cursor-pointer disabled:opacity-50"
          >
            {busyId === row.id ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            disabled={busyId === row.id}
            onClick={() => void handlePreparePrint([row.id])}
            title={`Pratinjau cetak ${row.fullName}`}
            aria-label={`Pratinjau cetak ${row.fullName}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] hover:border-[#10264D] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppShell
      title="Kartu & QR Code"
      subtitle="QR Code siswa diambil langsung dari NIS dan QR Code guru diambil langsung dari NIY/NIP. Siap unduh PNG, ZIP massal, atau cetak portrait."
    >
      <div className="space-y-5">
        {/* Bluetooth Thermal Printer 1x Pairing Bar */}
        <ThermalPrinterBar />

        {/* Category Tabs + Bulk Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-white p-1 self-start">
            <button
              type="button"
              onClick={() => setTab('STUDENT')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'STUDENT'
                  ? 'bg-[#10264D] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              Kartu Siswa ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('TEACHER')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'TEACHER'
                  ? 'bg-[#10264D] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Kartu Guru ({teachers.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 && (
              <span className="text-xs font-semibold text-[#10264D] px-1.5 tabular-nums">
                {selectedIds.length} dipilih
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedIds.length === 0 || bulkWorking !== null}
              loading={bulkWorking === 'thermal'}
              onClick={() => void handleThermalPrint(selectedIds)}
              leftIcon={<ReceiptText className="h-4 w-4" />}
            >
              Cetak Nota Thermal
            </Button>
            <Button
              variant="gold"
              size="sm"
              disabled={selectedIds.length === 0 || bulkWorking !== null}
              loading={bulkWorking === 'zip'}
              onClick={() => void handleBulkZip()}
              leftIcon={<FolderArchive className="h-4 w-4" />}
            >
              Unduh ZIP
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={selectedIds.length === 0 || bulkWorking !== null}
              loading={bulkWorking === 'print'}
              onClick={() => void handlePreparePrint(selectedIds)}
              leftIcon={<Printer className="h-4 w-4" />}
            >
              Cetak Portrait
            </Button>
          </div>
        </div>

        {/* Data Table */}
        {tab === 'STUDENT' ? (
          <DataTable
            columns={studentColumns}
            data={filteredStudents}
            loading={loading}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            emptyTitle="Tidak ada siswa aktif"
            emptyDescription="Pastikan data siswa aktif telah tersedia atau ubah filter pencarian."
            toolbar={
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  placeholder="Cari nama atau NIS siswa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  options={[
                    { value: '', label: 'Semua Kelas' },
                    ...classes.map((c) => ({ value: c.id, label: `Kelas ${c.name}` })),
                  ]}
                />
                <div className="flex items-center justify-end text-xs text-slate-500">
                  Centang baris untuk unduh ZIP atau cetak massal.
                </div>
              </div>
            }
          />
        ) : (
          <DataTable
            columns={teacherColumns}
            data={filteredTeachers}
            loading={loading}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            emptyTitle="Tidak ada guru aktif"
            emptyDescription="Tambahkan guru aktif pada menu Data Guru terlebih dahulu."
            toolbar={
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Cari nama, NIY/NIP, atau jabatan guru..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="flex items-center justify-end text-xs text-slate-500">
                  Kartu QR guru juga memerlukan verifikasi selfie di Portal Absensi.
                </div>
              </div>
            }
          />
        )}
      </div>

      {/* Print Portrait Cards Preview Modal */}
      <Modal
        open={Boolean(printPreviewCards)}
        onClose={() => setPrintPreviewCards(null)}
        title={`Pratinjau Cetak Kartu Portrait (${printPreviewCards?.length ?? 0} Kartu)`}
        description="QR Code memuat NIS siswa / NIY-NIP guru dan siap dicetak dalam tata letak kartu portrait."
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-xs text-slate-700 print:hidden">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[#C69B3C] shrink-0" aria-hidden="true" />
              <span>
                Gunakan kertas A4 portrait dengan opsi Background Graphics aktif saat mencetak.
              </span>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.print()}
              leftIcon={<Printer className="h-4 w-4" />}
            >
              Cetak Sekarang
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[65vh] overflow-y-auto p-1 print:max-h-none print:overflow-visible print:grid-cols-2">
            {printPreviewCards?.map((card) => (
              <article
                key={card.id}
                className="rounded-xl border-2 border-[#CBD5E1] bg-white overflow-hidden flex flex-col break-inside-avoid shadow-xs"
              >
                <div
                  className="px-4 py-3.5 text-center text-white border-b-4"
                  style={{ backgroundColor: primaryColor, borderBottomColor: accentColor }}
                >
                  <img
                    src={logoSrc}
                    alt={schoolName}
                    className="mx-auto mb-2 h-11 w-11 object-contain bg-transparent"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <p className="text-[11px] font-bold tracking-wide uppercase truncate">
                    {schoolName}
                  </p>
                  <p className="text-[10px] text-[#E7D4A3] font-semibold mt-0.5">
                    {card.ownerType === 'STUDENT'
                      ? 'KARTU ABSENSI RESMI SISWA'
                      : 'KARTU ABSENSI RESMI GURU'}
                  </p>
                </div>

                <div className="p-4 flex-1 flex flex-col items-center text-center space-y-3">
                  <div className="rounded-xl border border-[#E2E8F0] p-2 bg-white">
                    <img
                      src={card.qrDataUrl}
                      alt={`QR ${card.fullName}`}
                      className="h-40 w-40 object-contain"
                    />
                  </div>

                  <div className="space-y-1 w-full">
                    <h3 className="text-sm font-bold text-[#10264D] leading-snug">
                      {card.fullName}
                    </h3>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 text-left">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">
                        {card.identifierLabel}
                      </p>
                      <p className="font-mono text-xs font-bold text-[#10264D] truncate">
                        {card.identifierValue}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">
                        {card.secondaryLabel}
                      </p>
                      <p className="text-xs font-bold text-[#10264D] truncate">
                        {card.secondaryValue}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="px-3 py-2 text-center text-[10px] text-slate-200"
                  style={{ backgroundColor: primaryColor }}
                >
                  {card.ownerType === 'STUDENT'
                    ? 'Pindai QR NIS pada Portal Absensi'
                    : 'Pindai QR NIY/NIP pada Portal Absensi'}
                </div>
              </article>
            ))}
          </div>
        </div>
      </Modal>

      <ThermalReceiptPreviewModal
        items={thermalPreviewItems}
        onClose={() => setThermalPreviewItems(null)}
      />
    </AppShell>
  );
}

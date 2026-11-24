import QRCode from 'qrcode';

export type ThermalPaperWidth = '58mm' | '80mm';
export type ThermalQrRenderMode = 'native' | 'raster';
export type ThermalConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'printing';

export interface ThermalQrTicketItem {
  id: string;
  ownerType: 'STUDENT' | 'TEACHER';
  schoolName: string;
  appName?: string;
  fullName: string;
  identifierLabel: string;
  identifierValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  rawToken: string;
}

export interface SavedThermalPrinterConfig {
  deviceId: string | null;
  deviceName: string | null;
  paperWidth: ThermalPaperWidth;
  qrMode: ThermalQrRenderMode;
  pairedAt: string | null;
}

export interface ThermalPrinterSnapshot {
  status: ThermalConnectionStatus;
  deviceName: string | null;
  deviceId: string | null;
  paperWidth: ThermalPaperWidth;
  qrMode: ThermalQrRenderMode;
  isBluetoothSupported: boolean;
  lastError: string | null;
}

// Minimal Web Bluetooth ambient types so TypeScript compiles without extra @types packages
interface BluetoothRemoteGATTCharacteristicLike {
  properties: {
    write?: boolean;
    writeWithoutResponse?: boolean;
  };
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
  writeValue?: (value: BufferSource) => Promise<void>;
}

interface BluetoothRemoteGATTServiceLike {
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristicLike[]>;
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServerLike>;
  disconnect(): void;
  getPrimaryServices(): Promise<BluetoothRemoteGATTServiceLike[]>;
}

interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServerLike;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

interface NavigatorBluetoothLike {
  requestDevice(options: Record<string, unknown>): Promise<BluetoothDeviceLike>;
  getDevices?: () => Promise<BluetoothDeviceLike[]>;
}

const STORAGE_KEY = 'absensi_digital_thermal_printer_v1';

// Common BLE GATT service UUIDs used by 58mm & 80mm thermal receipt printers
// (Eppos, Xprinter, Panda, VSC, Iware, RPP02N, MPT-II, Goojprt, SiliconLabs, Nordic UART, ISSC)
const THERMAL_PRINTER_SERVICES: string[] = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

function getBluetoothApi(): NavigatorBluetoothLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & { bluetooth?: NavigatorBluetoothLike };
  return nav.bluetooth ?? null;
}

function loadSavedConfig(): SavedThermalPrinterConfig {
  const defaults: SavedThermalPrinterConfig = {
    deviceId: null,
    deviceName: null,
    paperWidth: '58mm',
    qrMode: 'native',
    pairedAt: null,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SavedThermalPrinterConfig>;
    return {
      deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : null,
      deviceName: typeof parsed.deviceName === 'string' ? parsed.deviceName : null,
      paperWidth: parsed.paperWidth === '80mm' ? '80mm' : '58mm',
      qrMode: parsed.qrMode === 'raster' ? 'raster' : 'native',
      pairedAt: typeof parsed.pairedAt === 'string' ? parsed.pairedAt : null,
    };
  } catch {
    return defaults;
  }
}

function saveConfig(config: SavedThermalPrinterConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage quota or privacy mode — ignore gracefully
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, arr) => sum + arr.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of chunks) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

function encodeAsciiText(text: string): Uint8Array {
  // Normalize Indonesian/diacritic characters into clean printable ASCII for thermal printers
  const cleaned = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, ' ');
  const bytes = new Uint8Array(cleaned.length);
  for (let i = 0; i < cleaned.length; i++) {
    bytes[i] = cleaned.charCodeAt(i);
  }
  return bytes;
}

function wrapLines(text: string, maxCols: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word.slice(0, maxCols);
    } else if (current.length + 1 + word.length <= maxCols) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word.slice(0, maxCols);
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildNativeEscPosQr(data: string, moduleSize: number): Uint8Array {
  const payload = encodeAsciiText(data);
  const storeLen = payload.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;

  return concatBytes([
    // Select QR Model 2
    new Uint8Array([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    // Set module size (dots per module, 1..16)
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize]),
    // Set error correction level M (49 = 0x31)
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),
    // Store QR data in symbol storage area
    new Uint8Array([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
    payload,
    // Print QR symbol
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
  ]);
}

async function buildRasterEscPosQr(data: string, targetPx: number): Promise<Uint8Array> {
  const width = Math.ceil(targetPx / 8) * 8;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = width;
  await QRCode.toCanvas(canvas, data, {
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return buildNativeEscPosQr(data, 6);
  }
  const imgData = ctx.getImageData(0, 0, width, width).data;
  const bytesPerRow = width / 8;
  const bitmap = new Uint8Array(bytesPerRow * width);

  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const lum =
        0.299 * imgData[idx]! + 0.587 * imgData[idx + 1]! + 0.114 * imgData[idx + 2]!;
      if (lum < 140) {
        bitmap[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = width & 0xff;
  const yH = (width >> 8) & 0xff;

  // GS v 0 m xL xH yL yH d1...dk
  const header = new Uint8Array([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  return concatBytes([header, bitmap]);
}

export async function buildThermalQrEscPosPayload(
  item: ThermalQrTicketItem,
  paperWidth: ThermalPaperWidth,
  qrMode: ThermalQrRenderMode,
): Promise<Uint8Array> {
  const cols = paperWidth === '80mm' ? 46 : 32;
  const divider = '-'.repeat(cols);
  const appTitle = (item.appName || 'Absensi Digital').toUpperCase();
  const roleLabel = item.ownerType === 'STUDENT' ? 'KARTU QR SISWA' : 'KARTU QR GURU';

  const parts: Uint8Array[] = [];

  // Initialize printer
  parts.push(new Uint8Array([0x1b, 0x40]));
  // Center align
  parts.push(new Uint8Array([0x1b, 0x61, 0x01]));
  // Bold ON
  parts.push(new Uint8Array([0x1b, 0x45, 0x01]));
  parts.push(encodeAsciiText(`${appTitle}\n`));
  for (const line of wrapLines(item.schoolName.toUpperCase(), cols)) {
    parts.push(encodeAsciiText(`${line}\n`));
  }
  // Bold OFF
  parts.push(new Uint8Array([0x1b, 0x45, 0x00]));
  parts.push(encodeAsciiText(`${roleLabel}\n`));
  parts.push(encodeAsciiText(`${divider}\n\n`));

  // QR Code (centered)
  if (qrMode === 'raster') {
    const rasterPx = paperWidth === '80mm' ? 240 : 192;
    parts.push(await buildRasterEscPosQr(item.rawToken, rasterPx));
  } else {
    const moduleSize = paperWidth === '80mm' ? 8 : 6;
    parts.push(buildNativeEscPosQr(item.rawToken, moduleSize));
  }

  parts.push(encodeAsciiText('\n'));

  // Name in Bold + slightly taller (double-height mode ESC ! 0x18)
  parts.push(new Uint8Array([0x1b, 0x21, 0x18]));
  for (const line of wrapLines(item.fullName, Math.floor(cols))) {
    parts.push(encodeAsciiText(`${line}\n`));
  }
  // Reset text style
  parts.push(new Uint8Array([0x1b, 0x21, 0x00]));
  parts.push(encodeAsciiText(`${divider}\n`));

  // Left-aligned structured metadata
  parts.push(new Uint8Array([0x1b, 0x61, 0x00]));
  parts.push(encodeAsciiText(`${item.identifierLabel.padEnd(10)}: ${item.identifierValue}\n`));
  parts.push(encodeAsciiText(`${item.secondaryLabel.padEnd(10)}: ${item.secondaryValue}\n`));
  parts.push(encodeAsciiText(`${divider}\n`));

  // Footer centered
  parts.push(new Uint8Array([0x1b, 0x61, 0x01]));
  parts.push(
    encodeAsciiText(
      item.ownerType === 'STUDENT'
        ? 'Scan QR ini di Portal Absensi\n'
        : 'Scan QR + Selfie di Portal\n',
    ),
  );
  // Feed 4 lines + partial cut (ignored safely on tear-bar printers)
  parts.push(new Uint8Array([0x1b, 0x64, 0x04]));
  parts.push(new Uint8Array([0x1d, 0x56, 0x42, 0x00]));

  return concatBytes(parts);
}

/**
 * Module-level singleton managing a 1-time paired Bluetooth thermal printer.
 * Persists across route changes and attempts silent auto-reconnect via
 * navigator.bluetooth.getDevices() after page reload.
 */
class ThermalPrinterManager {
  private config: SavedThermalPrinterConfig = loadSavedConfig();
  private device: BluetoothDeviceLike | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristicLike | null = null;
  private status: ThermalConnectionStatus = 'disconnected';
  private lastError: string | null = null;
  private listeners = new Set<() => void>();
  private autoReconnectAttempted = false;
  private cachedSnapshot: ThermalPrinterSnapshot;

  constructor() {
    this.cachedSnapshot = this.buildSnapshot();
  }

  private readonly onDisconnected = () => {
    this.characteristic = null;
    this.status = 'disconnected';
    this.emit();
  };

  private buildSnapshot(): ThermalPrinterSnapshot {
    return {
      status: this.status,
      deviceName: this.device?.name ?? this.config.deviceName,
      deviceId: this.device?.id ?? this.config.deviceId,
      paperWidth: this.config.paperWidth,
      qrMode: this.config.qrMode,
      isBluetoothSupported: Boolean(getBluetoothApi()),
      lastError: this.lastError,
    };
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (!this.autoReconnectAttempted) {
      this.autoReconnectAttempted = true;
      queueMicrotask(() => {
        void this.trySilentReconnect();
      });
    }
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(): void {
    this.cachedSnapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }

  readonly getSnapshot = (): ThermalPrinterSnapshot => {
    return this.cachedSnapshot;
  };

  setPaperWidth(width: ThermalPaperWidth): void {
    this.config = { ...this.config, paperWidth: width };
    saveConfig(this.config);
    this.emit();
  }

  setQrMode(mode: ThermalQrRenderMode): void {
    this.config = { ...this.config, qrMode: mode };
    saveConfig(this.config);
    this.emit();
  }

  private async resolveWritableCharacteristic(
    device: BluetoothDeviceLike,
  ): Promise<BluetoothRemoteGATTCharacteristicLike> {
    if (!device.gatt) {
      throw new Error('Perangkat Bluetooth tidak mendukung layanan GATT.');
    }
    const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
    const services = await server.getPrimaryServices();
    for (const svc of services) {
      try {
        const chars = await svc.getCharacteristics();
        const writable = chars.find(
          (c) => c.properties.writeWithoutResponse || c.properties.write,
        );
        if (writable) return writable;
      } catch {
        // Some protected GATT services are unreadable; continue scanning
      }
    }
    throw new Error(
      'Layanan cetak ESC/POS tidak ditemukan pada printer ini. Pastikan printer menyala dalam mode BLE.',
    );
  }

  /** Attempts silent 0-click reconnection to previously paired printer if browser supports getDevices() */
  async trySilentReconnect(): Promise<boolean> {
    if (this.device?.gatt?.connected && this.characteristic) {
      this.status = 'connected';
      this.emit();
      return true;
    }

    const bt = getBluetoothApi();
    if (!bt?.getDevices || !this.config.deviceId) return false;

    try {
      const grantedDevices = await bt.getDevices();
      const matched = grantedDevices.find(
        (d) => d.id === this.config.deviceId || (this.config.deviceName && d.name === this.config.deviceName),
      );
      if (!matched) return false;

      this.status = 'connecting';
      this.emit();

      const char = await this.resolveWritableCharacteristic(matched);
      this.attachDevice(matched, char);
      return true;
    } catch {
      this.status = 'disconnected';
      this.emit();
      return false;
    }
  }

  private attachDevice(
    device: BluetoothDeviceLike,
    characteristic: BluetoothRemoteGATTCharacteristicLike,
  ): void {
    if (this.device && this.device !== device) {
      this.device.removeEventListener?.('gattserverdisconnected', this.onDisconnected);
    }
    this.device = device;
    this.characteristic = characteristic;
    device.addEventListener?.('gattserverdisconnected', this.onDisconnected);

    this.config = {
      ...this.config,
      deviceId: device.id,
      deviceName: device.name || 'Printer Thermal Bluetooth',
      pairedAt: new Date().toISOString(),
    };
    saveConfig(this.config);
    this.status = 'connected';
    this.lastError = null;
    this.emit();
  }

  /** One-time pairing flow — remembers the printer so subsequent prints need zero pairing */
  async pairPrinter(): Promise<string> {
    const bt = getBluetoothApi();
    if (!bt) {
      const msg =
        'Browser ini belum mendukung Web Bluetooth. Gunakan Chrome/Edge di Android/Desktop atau gunakan tombol Cetak Nota Browser.';
      this.lastError = msg;
      this.emit();
      throw new Error(msg);
    }

    this.status = 'connecting';
    this.lastError = null;
    this.emit();

    try {
      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: THERMAL_PRINTER_SERVICES,
      });

      const char = await this.resolveWritableCharacteristic(device);
      this.attachDevice(device, char);
      return this.config.deviceName || 'Printer Thermal';
    } catch (err) {
      this.status = 'disconnected';
      const rawMsg = err instanceof Error ? err.message : 'Gagal menghubungkan printer Bluetooth.';
      // Ignore noisy error message when user cancels picker
      this.lastError = rawMsg.toLowerCase().includes('cancel')
        ? null
        : rawMsg;
      this.emit();
      throw err;
    }
  }

  disconnect(forgetSaved = false): void {
    if (this.device) {
      this.device.removeEventListener?.('gattserverdisconnected', this.onDisconnected);
      try {
        if (this.device.gatt?.connected) {
          this.device.gatt.disconnect();
        }
      } catch {
        // Ignore disconnect errors
      }
    }
    this.device = null;
    this.characteristic = null;
    this.status = 'disconnected';
    if (forgetSaved) {
      this.config = {
        ...this.config,
        deviceId: null,
        deviceName: null,
        pairedAt: null,
      };
      saveConfig(this.config);
    }
    this.emit();
  }

  private async ensureConnected(): Promise<BluetoothRemoteGATTCharacteristicLike> {
    if (this.device?.gatt?.connected && this.characteristic) {
      return this.characteristic;
    }
    if (this.device?.gatt) {
      this.status = 'connecting';
      this.emit();
      const char = await this.resolveWritableCharacteristic(this.device);
      this.characteristic = char;
      this.status = 'connected';
      this.emit();
      return char;
    }
    const silentlyReconnected = await this.trySilentReconnect();
    if (silentlyReconnected && this.characteristic) {
      return this.characteristic;
    }
    // First time pairing (1x only)
    await this.pairPrinter();
    if (!this.characteristic) {
      throw new Error('Printer Bluetooth belum terhubung.');
    }
    return this.characteristic;
  }

  private async writeChunked(
    char: BluetoothRemoteGATTCharacteristicLike,
    data: Uint8Array,
  ): Promise<void> {
    // 96-byte chunks work smoothly across BLE 4.2/5.0 thermal printers; fallback to 20 bytes on MTU error
    let chunkSize = 96;
    let offset = 0;

    while (offset < data.length) {
      const slice = data.slice(offset, offset + chunkSize);
      try {
        if (char.properties.writeWithoutResponse && char.writeValueWithoutResponse) {
          await char.writeValueWithoutResponse(slice);
        } else if (char.writeValueWithResponse) {
          await char.writeValueWithResponse(slice);
        } else if (char.writeValue) {
          await char.writeValue(slice);
        } else {
          throw new Error('Karakteristik Bluetooth tidak mendukung penulisan data.');
        }
        offset += slice.length;
        // Brief pacing delay so printer thermal buffer never overflows
        await new Promise((resolve) => setTimeout(resolve, 22));
      } catch (err) {
        if (chunkSize > 20) {
          chunkSize = 20;
          continue;
        }
        throw err;
      }
    }
  }

  async printTickets(items: ThermalQrTicketItem[]): Promise<void> {
    if (items.length === 0) return;

    const char = await this.ensureConnected();
    this.status = 'printing';
    this.lastError = null;
    this.emit();

    try {
      for (let i = 0; i < items.length; i++) {
        const payload = await buildThermalQrEscPosPayload(
          items[i]!,
          this.config.paperWidth,
          this.config.qrMode,
        );
        await this.writeChunked(char, payload);
        if (i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      this.status = 'connected';
      this.emit();
    } catch (err) {
      this.status = this.device?.gatt?.connected ? 'connected' : 'disconnected';
      this.lastError =
        err instanceof Error ? err.message : 'Gagal mengirim data ke printer thermal.';
      this.emit();
      throw err;
    }
  }
}

export const thermalPrinterManager = new ThermalPrinterManager();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Zero-popup browser thermal receipt printer (works with USB thermal printers,
 * Android RawBT print service, or desktop OS print dialogs without window.open).
 */
export async function printThermalReceiptsViaBrowser(
  items: ThermalQrTicketItem[],
  paperWidth: ThermalPaperWidth = '58mm',
): Promise<void> {
  if (items.length === 0) return;
  const qrSize = paperWidth === '80mm' ? 190 : 150;
  const pageWidthMm = paperWidth === '80mm' ? '80mm' : '58mm';

  const renderedTickets: string[] = [];
  for (const item of items) {
    const qrDataUrl = await QRCode.toDataURL(item.rawToken, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    renderedTickets.push(`
      <section class="ticket">
        <div class="header">
          <div class="app">${escapeHtml((item.appName || 'Absensi Digital').toUpperCase())}</div>
          <div class="school">${escapeHtml(item.schoolName.toUpperCase())}</div>
          <div class="role">${item.ownerType === 'STUDENT' ? 'KARTU QR SISWA' : 'KARTU QR GURU'}</div>
        </div>
        <div class="dash"></div>
        <div class="qr-wrap">
          <img src="${qrDataUrl}" alt="QR ${escapeHtml(item.fullName)}" width="${qrSize}" height="${qrSize}" />
        </div>
        <div class="name">${escapeHtml(item.fullName)}</div>
        <div class="dash"></div>
        <div class="meta">
          <div><span>${escapeHtml(item.identifierLabel)}</span><strong>${escapeHtml(item.identifierValue)}</strong></div>
          <div><span>${escapeHtml(item.secondaryLabel)}</span><strong>${escapeHtml(item.secondaryValue)}</strong></div>
        </div>
        <div class="dash"></div>
        <div class="footer">${
          item.ownerType === 'STUDENT'
            ? 'Scan QR ini di Portal Absensi'
            : 'Scan QR + Selfie di Portal Absensi'
        }</div>
      </section>
    `);
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    throw new Error('Gagal menyiapkan dokumen cetak thermal.');
  }

  doc.open();
  doc.write(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Cetak Nota Thermal QR</title>
<style>
  @page { size: ${pageWidthMm} auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    width: ${pageWidthMm};
    font-family: "Courier New", Courier, monospace;
    color: #000;
    background: #fff;
    font-size: ${paperWidth === '80mm' ? '12px' : '11px'};
  }
  .ticket {
    padding: 4mm 2mm 6mm;
    page-break-after: always;
    break-after: page;
  }
  .ticket:last-child { page-break-after: auto; break-after: auto; }
  .header { text-align: center; line-height: 1.3; }
  .app { font-weight: 700; font-size: ${paperWidth === '80mm' ? '13px' : '11px'}; }
  .school { font-weight: 700; font-size: ${paperWidth === '80mm' ? '12px' : '10.5px'}; margin-top: 2px; }
  .role { font-size: 10px; margin-top: 2px; }
  .dash { border-top: 1px dashed #000; margin: 6px 0; }
  .qr-wrap { text-align: center; margin: 6px 0; }
  .qr-wrap img { display: inline-block; image-rendering: pixelated; }
  .name { text-align: center; font-weight: 700; font-size: ${paperWidth === '80mm' ? '14px' : '12.5px'}; margin: 4px 0; word-break: break-word; }
  .meta div { display: flex; justify-content: space-between; gap: 6px; margin: 2px 0; }
  .footer { text-align: center; font-size: 9.5px; margin-top: 4px; }
</style>
</head>
<body>${renderedTickets.join('')}</body>
</html>`);
  doc.close();

  await new Promise<void>((resolve) => {
    const win = iframe.contentWindow!;
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          resolve();
        }, 600);
      }
    }, 250);
  });
}

import JSZip from 'jszip';
import QRCode from 'qrcode';

export interface QrCardRenderInput {
  ownerType: 'STUDENT' | 'TEACHER';
  fullName: string;
  identifierLabel: string; // 'NIS' or 'NIY / NIP'
  identifierValue: string;
  secondaryLabel: string; // 'Kelas' or 'Jabatan'
  secondaryValue: string;
  rawToken: string;
  schoolName: string;
  schoolAddress?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
}

function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCenteredWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
): number {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const visible = lines.slice(0, maxLines);
  visible.forEach((line, idx) => {
    ctx.fillText(line, centerX, startY + idx * lineHeight);
  });
  return startY + visible.length * lineHeight;
}

/**
 * Renders a crisp high-DPI portrait ID & QR card (640x1020px) onto an HTML Canvas
 * and returns a PNG Blob. The QR code encodes the official identifier
 * (NIS for students or NIY/NIP for teachers).
 */
export async function renderQrCardPngBlob(input: QrCardRenderInput): Promise<Blob> {
  const width = 640;
  const height = 1020;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser tidak mendukung rendering kanvas kartu QR.');
  }

  const primary = input.primaryColor || '#10264D';
  const accent = input.accentColor || '#C69B3C';

  // Card background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Subtle border frame
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  // Institutional Navy Header Banner
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, width, 210);

  // Gold bottom accent rule
  ctx.fillStyle = accent;
  ctx.fillRect(0, 210, width, 10);

  // School Emblem (frameless & backgroundless)
  if (input.logoUrl) {
    const logo = await loadImageSafe(input.logoUrl);
    if (logo) {
      ctx.drawImage(logo, width / 2 - 42, 24, 84, 84);
    }
  }

  // School Name
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(input.schoolName.toUpperCase(), width / 2, 146, width - 64);

  ctx.fillStyle = '#E7D4A3';
  ctx.font = '600 16px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    input.ownerType === 'STUDENT' ? 'KARTU ABSENSI RESMI SISWA' : 'KARTU ABSENSI RESMI GURU',
    width / 2,
    182,
  );

  // QR Code container (encodes NIS for students or NIY/NIP for teachers)
  const qrDataUrl = await QRCode.toDataURL(input.rawToken, {
    width: 380,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0B1B38', light: '#FFFFFF' },
  });
  const qrImg = await loadImageSafe(qrDataUrl);
  if (qrImg) {
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 205, 252, 410, 410, 20);
    ctx.fill();
    ctx.stroke();
    ctx.drawImage(qrImg, width / 2 - 190, 267, 380, 380);
  }

  // Identity Details (minimal, non-sensitive)
  ctx.fillStyle = primary;
  ctx.font = '700 30px "Plus Jakarta Sans", system-ui, sans-serif';
  const nextY = drawCenteredWrappedText(ctx, input.fullName, width / 2, 724, width - 80, 38, 2);

  // Divider
  ctx.fillStyle = accent;
  ctx.fillRect(width / 2 - 60, nextY + 6, 120, 4);

  // Identifier & Class/Position boxes
  const boxY = nextY + 34;
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(56, boxY, width - 112, 118, 14);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748B';
  ctx.font = '600 15px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(input.identifierLabel.toUpperCase(), 84, boxY + 36);
  ctx.fillText(input.secondaryLabel.toUpperCase(), width / 2 + 16, boxY + 36);

  ctx.fillStyle = primary;
  ctx.font = '700 22px "Geist Mono", monospace';
  ctx.fillText(input.identifierValue, 84, boxY + 78, width / 2 - 108);

  ctx.font = '700 21px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(input.secondaryValue, width / 2 + 16, boxY + 78, width / 2 - 100);

  // Footer strip
  ctx.fillStyle = primary;
  ctx.fillRect(0, height - 64, width, 64);
  ctx.fillStyle = '#CBD5E1';
  ctx.textAlign = 'center';
  ctx.font = '500 14px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    input.ownerType === 'STUDENT'
      ? 'Pindai kode QR NIS pada Portal Absensi Digital'
      : 'Pindai kode QR NIY/NIP pada Portal Absensi Digital',
    width / 2,
    height - 26,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal membuat gambar PNG kartu QR.'));
    }, 'image/png');
  });
}

function sanitizeFileSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadSingleQrCardPng(input: QrCardRenderInput): Promise<void> {
  const blob = await renderQrCardPngBlob(input);
  const safeName = sanitizeFileSegment(`${input.identifierValue}-${input.fullName}`);
  triggerBlobDownload(blob, `kartu-qr-${safeName || 'peserta'}.png`);
}

export async function downloadBulkQrCardsZip(
  cards: QrCardRenderInput[],
  zipFilename: string,
): Promise<void> {
  const zip = new JSZip();
  for (const card of cards) {
    const pngBlob = await renderQrCardPngBlob(card);
    const safeName = sanitizeFileSegment(`${card.identifierValue}-${card.fullName}`);
    zip.file(`kartu-qr-${safeName || 'peserta'}.png`, pngBlob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(zipBlob, zipFilename);
}

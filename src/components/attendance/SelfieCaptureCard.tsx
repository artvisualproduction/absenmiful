import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/cn';
import { MAX_SELFIE_BYTES } from '../../lib/teacherAttendanceValidation';
import { Button } from '../ui/Button';

export interface CapturedSelfie {
  dataUrl: string;
  mimeType: 'image/jpeg';
  sizeBytes: number;
}

export interface SelfieCaptureCardProps {
  value: CapturedSelfie | null;
  onChange: (next: CapturedSelfie | null) => void;
  dark?: boolean;
  disabled?: boolean;
  autoStart?: boolean;
  helperText?: string;
}

export function SelfieCaptureCard({
  value,
  onChange,
  dark = false,
  disabled = false,
  autoStart = false,
  helperText = 'Ambil foto wajah langsung melalui kamera depan. Foto disimpan privat sesuai kebijakan retensi sekolah.',
}: SelfieCaptureCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Browser atau perangkat tidak mendukung akses kamera langsung. Gunakan perangkat dengan kamera aktif.',
      );
      return;
    }

    setCameraStarting(true);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // Attach stream once video element mounts/updates
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCameraError(
        'Izin kamera ditolak atau kamera tidak terdeteksi. Aktifkan izin kamera pada browser lalu coba lagi.',
      );
      stopCamera();
    } finally {
      setCameraStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (autoStart && !value) {
      void startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [autoStart, startCamera, stopCamera]);

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Kamera belum siap. Tunggu sebentar lalu coba ambil foto lagi.');
      return;
    }

    const maxDim = 800;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror horizontally for natural selfie orientation
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const approxBytes = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
    if (approxBytes > MAX_SELFIE_BYTES) {
      setCameraError('Ukuran foto hasil tangkapan melebihi 2 MB. Coba ambil ulang.');
      return;
    }

    stopCamera();
    onChange({
      dataUrl,
      mimeType: 'image/jpeg',
      sizeBytes: approxBytes,
    });
  };

  const handleRetake = () => {
    onChange(null);
    setCameraError(null);
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'relative flex min-h-[240px] flex-col items-center justify-center overflow-hidden rounded-xl border',
          dark
            ? 'border-white/15 bg-[#071226]'
            : 'border-[#CBD5E1] bg-[#F8FAFC]',
        )}
      >
        {value ? (
          <div className="relative w-full">
            <img
              src={value.dataUrl}
              alt="Pratinjau foto selfie kehadiran"
              className="mx-auto max-h-[300px] w-full object-cover"
            />
            <div className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#10264D]/90 px-2.5 py-1 text-xs font-medium text-white">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="tabular-nums">
                Selfie siap ({Math.max(1, Math.round(value.sizeBytes / 1024))} KB)
              </span>
            </div>
          </div>
        ) : cameraOpen ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-[300px] w-full scale-x-[-1] object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-2.5">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl border',
                dark
                  ? 'border-[#C69B3C]/40 bg-[#10264D] text-[#E7D4A3]'
                  : 'border-[#E7D4A3] bg-[#FCF9F1] text-[#8D6B22]',
              )}
            >
              <Camera className="h-6 w-6" />
            </div>
            <p className={cn('text-sm font-semibold', dark ? 'text-white' : 'text-[#10264D]')}>
              Kamera Selfie Belum Aktif
            </p>
            <p
              className={cn(
                'max-w-xs text-xs leading-relaxed',
                dark ? 'text-slate-300' : 'text-slate-500',
              )}
            >
              {helperText}
            </p>
          </div>
        )}
      </div>

      {cameraError && (
        <div
          role="alert"
          className={cn(
            'rounded-lg border px-3 py-2 text-xs font-medium',
            dark
              ? 'border-amber-400/35 bg-amber-500/15 text-amber-100'
              : 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]',
          )}
        >
          {cameraError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {value ? (
          <Button
            type="button"
            variant={dark ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleRetake}
            disabled={disabled}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Ambil Ulang Selfie
          </Button>
        ) : cameraOpen ? (
          <>
            <Button
              type="button"
              variant="gold"
              size="sm"
              onClick={handleCaptureFrame}
              disabled={disabled}
              leftIcon={<Camera className="h-3.5 w-3.5" />}
            >
              Ambil Foto Selfie
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={stopCamera}
              disabled={disabled}
              leftIcon={<CameraOff className="h-3.5 w-3.5" />}
            >
              Tutup Kamera
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant={dark ? 'gold' : 'primary'}
            size="sm"
            loading={cameraStarting}
            disabled={disabled}
            onClick={() => void startCamera()}
            leftIcon={<Camera className="h-3.5 w-3.5" />}
          >
            Buka Kamera Depan
          </Button>
        )}
      </div>
    </div>
  );
}

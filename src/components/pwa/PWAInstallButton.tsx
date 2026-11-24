import { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export interface PWAInstallButtonProps {
  compact?: boolean;
  fullWidth?: boolean;
}

export function PWAInstallButton({ compact = false, fullWidth = false }: PWAInstallButtonProps) {
  const { publicSettings } = useAuth();
  const { canInstall, isInstalled, isIOS, installApp } = usePWAInstall();
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const pwaName = publicSettings?.pwaAppName?.trim() || 'MiFUL';

  if (isInstalled) return null;
  if (!canInstall && !isIOS) return null;

  const handleClick = async () => {
    if (canInstall) {
      await installApp();
    } else if (isIOS) {
      setIosGuideOpen(true);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size={compact ? 'sm' : 'md'}
        fullWidth={fullWidth}
        onClick={() => void handleClick()}
        leftIcon={
          isIOS && !canInstall ? (
            <Share className="h-3.5 w-3.5 text-[#C69B3C]" />
          ) : (
            <Download className="h-3.5 w-3.5 text-[#C69B3C]" />
          )
        }
      >
        {compact ? 'Instal Aplikasi' : 'Instal Aplikasi di Perangkat'}
      </Button>

      <Modal
        open={iosGuideOpen}
        onClose={() => setIosGuideOpen(false)}
        title="Pasang di Layar Utama iOS"
        description="Safari iOS mendukung pemasangan aplikasi langsung melalui menu Bagikan."
      >
        <ol className="space-y-3 text-sm text-slate-700 list-decimal pl-5">
          <li>
            Ketuk ikon <strong>Bagikan (Share)</strong> di bilah navigasi Safari.
          </li>
          <li>
            Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
          </li>
          <li>
            Ketuk <strong>Tambah (Add)</strong> untuk memasang ikon <strong>{pwaName}</strong>.
          </li>
        </ol>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" onClick={() => setIosGuideOpen(false)}>
            Mengerti
          </Button>
        </div>
      </Modal>
    </>
  );
}

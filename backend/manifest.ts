import { CollectionName } from '../src/types';
import { type MinimalApiResponse } from './_lib/apiError';
import type { ApiRequestLike } from './_lib/auth/middleware';
import { getRepository } from './_lib/repository';
import type { IDataRepository } from './_lib/repository/types';

/**
 * GET /api/manifest (rewritten from /manifest.webmanifest)
 * Dynamically reflects school name, app name, theme color, and custom uploaded PWA icons
 * immediately after Admin saves AppSettings.
 */
async function resolveBrandingMimeType(
  repo: IDataRepository,
  assetUrl: string,
): Promise<string> {
  const lower = assetUrl.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';

  const idMatch = assetUrl.match(/[?&]id=([^&]+)/);
  const fileId = idMatch ? decodeURIComponent(idMatch[1]) : null;
  if (fileId) {
    try {
      const publicAsset = await repo
        .collection(CollectionName.PUBLIC_BRANDING_ASSETS)
        .getById(fileId);
      if (publicAsset?.mimeType) return publicAsset.mimeType;
    } catch {
      // Fallback to fileMetadata
    }
    try {
      const meta = await repo.collection(CollectionName.FILE_METADATA).getById(fileId);
      if (meta?.mimeType) return meta.mimeType;
    } catch {
      // Fallback to PNG
    }
  }
  return 'image/png';
}

export async function handleWebManifest(
  _req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  let appName = 'Absensi Digital';
  let pwaAppName = 'MiFUL';
  let schoolName = 'MI MIFTAHUL ULUM';
  let themePrimary = '#10264D';
  let themeBackground = '#FFFFFF';
  let icon192 = '/icons/pwa-192x192.png';
  let icon512 = '/icons/pwa-512x512.png';
  let hasCustomLogo = false;

  try {
    const settings =
      (await repo.collection(CollectionName.PUBLIC_SETTINGS).getById('default')) ??
      (repo.mode === 'mock'
        ? await repo.collection(CollectionName.APP_SETTINGS).getById('default')
        : null);
    if (settings) {
      appName = settings.appName || appName;
      pwaAppName = settings.pwaAppName?.trim() || pwaAppName;
      schoolName = settings.schoolName || schoolName;
      themePrimary = settings.theme?.primary || themePrimary;
      themeBackground = settings.theme?.background || themeBackground;
      const isDefaultLogo =
        !settings.logoPath ||
        settings.logoPath === '/images/school-logo.jpg' ||
        settings.logoPath === '/images/school-logo.png';
      const customLogoUrl = !isDefaultLogo ? settings.logoPath : null;
      const isDefault192 =
        !settings.pwaIcon192Path || settings.pwaIcon192Path === '/icons/pwa-192x192.png';
      const isDefault512 =
        !settings.pwaIcon512Path || settings.pwaIcon512Path === '/icons/pwa-512x512.png';
      const resolved192 = (!isDefault192 ? settings.pwaIcon192Path : null) || customLogoUrl;
      const resolved512 = (!isDefault512 ? settings.pwaIcon512Path : null) || customLogoUrl;
      hasCustomLogo = Boolean(resolved192 || resolved512);
      if (resolved192) icon192 = resolved192;
      if (resolved512) icon512 = resolved512;
    }
  } catch {
    // Fallback cleanly to institutional defaults if repository is temporarily unavailable
  }

  const [icon192Mime, icon512Mime] = await Promise.all([
    resolveBrandingMimeType(repo, icon192),
    resolveBrandingMimeType(repo, icon512),
  ]);

  const manifest = {
    id: '/',
    name: `${pwaAppName} — ${schoolName}`,
    short_name: pwaAppName,
    description: `${appName} — Sistem informasi kehadiran siswa dan guru, jadwal mengajar, perizinan, dan laporan resmi ${schoolName}.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    lang: 'id-ID',
    theme_color: themePrimary,
    background_color: themeBackground,
    icons: [
      {
        src: icon192,
        sizes: '192x192',
        type: icon192Mime,
        purpose: 'any',
      },
      {
        src: icon512,
        sizes: '512x512',
        type: icon512Mime,
        purpose: 'any',
      },
      {
        src: hasCustomLogo ? icon512 : '/icons/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: hasCustomLogo ? icon512Mime : 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  res.setHeader?.('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader?.('Cache-Control', 'no-cache, must-revalidate');
  res.status(200).json(manifest);
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleWebManifest(req, res);
}

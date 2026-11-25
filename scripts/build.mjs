import { build as buildVite } from 'vite';
import esbuild from 'esbuild';

async function main() {
  console.log('[build] Building Vite frontend...');
  await buildVite();

  console.log('[build] Bundling backend for Vercel with esbuild...');
  await esbuild.build({
    entryPoints: ['backend/vercelEntry.ts'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    packages: 'external',
    outfile: 'api/_bundle.mjs',
  });

  console.log('[build] Build completed successfully.');
}

main().catch((err) => {
  console.error('[build] Build failed:', err);
  process.exit(1);
});

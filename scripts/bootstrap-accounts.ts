import 'dotenv/config';
import { bootstrapInitialAccounts } from '../backend/_lib/auth/bootstrapService';
import { getRepository } from '../backend/_lib/repository';

/**
 * Skrip CLI Bootstrap Akun Awal — MI Miftahul Ulum Sumberwuluh
 *
 * Cara pakai:
 *   BOOTSTRAP_SUPERADMIN_PASSWORD="..." \
 *   BOOTSTRAP_ADMIN_PASSWORD="..." \
 *   BOOTSTRAP_PRINCIPAL_PASSWORD="..." \
 *   npx tsx scripts/bootstrap-accounts.ts
 *
 * Atau via argumen CLI:
 *   npx tsx scripts/bootstrap-accounts.ts \
 *     --superadmin-password="..." \
 *     --admin-password="..." \
 *     --principal-password="..."
 *
 * Password TIDAK pernah ditulis di kode sumber.
 * Password sementara 7 akun guru dibuat ACAK (bukan dari NIP) dan dicetak SEKALI ke konsol.
 */

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`;
  const matched = process.argv.find((arg) => arg.startsWith(prefix));
  return matched ? matched.slice(prefix.length) : undefined;
}

async function main() {
  const superAdminPassword =
    parseArg('--superadmin-password') ?? process.env.BOOTSTRAP_SUPERADMIN_PASSWORD ?? '';
  const adminPassword =
    parseArg('--admin-password') ?? process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
  const principalPassword =
    parseArg('--principal-password') ?? process.env.BOOTSTRAP_PRINCIPAL_PASSWORD ?? '';

  if (!superAdminPassword || !adminPassword || !principalPassword) {
    console.error('Gagal: Password bootstrap wajib diberikan melalui environment variable atau argumen CLI.');
    console.error(
      'Setel BOOTSTRAP_SUPERADMIN_PASSWORD, BOOTSTRAP_ADMIN_PASSWORD, dan BOOTSTRAP_PRINCIPAL_PASSWORD (minimal 8 karakter).',
    );
    process.exit(1);
  }

  const repo = getRepository();
  const result = await bootstrapInitialAccounts(repo, {
    superAdminPassword,
    adminPassword,
    principalPassword,
  });

  console.log('=== BOOTSTRAP AKUN AWAL BERHASIL ===');
  console.log(`Mode repository: ${repo.mode}`);
  console.log('');
  console.log('Akun Inti (menggunakan password yang Anda berikan):');
  for (const acc of result.accounts.filter((a) => !a.temporaryPassword)) {
    console.log(`- [${acc.role}] username: ${acc.username} (${acc.fullName})`);
  }

  console.log('');
  console.log('Akun Guru (SIMPAN SEKARANG — password sementara ACAK ini hanya dicetak sekali dan wajib diganti saat login pertama):');
  for (const acc of result.accounts.filter((a) => Boolean(a.temporaryPassword))) {
    console.log(
      `- [${acc.role}] username: ${acc.username} | nama: ${acc.fullName} | password sementara: ${acc.temporaryPassword}`,
    );
  }
}

main().catch((err) => {
  console.error('Bootstrap gagal:', err instanceof Error ? err.message : err);
  process.exit(1);
});

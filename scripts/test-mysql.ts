import 'dotenv/config';
import { MysqlRepository } from '../backend/_lib/repository/mysqlRepository';
import { CollectionName } from '../src/types';

async function main() {
  console.log('Testing MysqlRepository...');
  const repo = new MysqlRepository({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'absen_miful',
  });

  const settingsCol = repo.collection(CollectionName.APP_SETTINGS);
  const result = await settingsCol.createIfNotExists('default', {
    appName: 'Absensi Digital MI Miftahul Ulum',
    schoolName: 'MI Miftahul Ulum Sumberwuluh',
    timezone: 'Asia/Jakarta',
  } as any);

  console.log('Created or fetched appSettings:', result.created, result.doc?.appName);

  const doc = await settingsCol.getById('default');
  console.log('Read back appSettings from MySQL:', doc?.schoolName);

  await repo.close();
  console.log('Test completed successfully!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

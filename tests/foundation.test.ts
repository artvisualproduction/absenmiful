import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fromFirestoreDocument,
  toFirestoreFields,
  type FirestoreRestDocument,
} from '../backend/_lib/repository/firestoreConverter';
import { MockRepository } from '../backend/_lib/repository/mockRepository';
import {
  getDateKeyJakarta,
  getDayOfWeekJakarta,
  getTimeHHMMJakarta,
  isTimeWithinWindow,
} from '../src/lib/date';
import { CollectionName, StudentStatus } from '../src/types';

test('Asia/Jakarta timezone utilities convert UTC timestamp accurately', () => {
  // 2026-11-19T00:15:00Z = 2026-11-19 07:15 WIB (Thursday = 4)
  const sample = '2026-11-19T00:15:00.000Z';
  assert.equal(getDateKeyJakarta(sample), '2026-11-19');
  assert.equal(getTimeHHMMJakarta(sample), '07:15');
  assert.equal(getDayOfWeekJakarta(sample), 4);
  assert.equal(isTimeWithinWindow('07:00', '06:00', '07:15'), true);
  assert.equal(isTimeWithinWindow('07:16', '06:00', '07:15'), false);
});

test('Firestore REST converter round-trips nested objects, arrays, numbers, timestamps, and nulls', () => {
  const input = {
    id: 'doc_123',
    nis: '00012345',
    fullName: 'AHMAD FAQIH',
    isDemo: true,
    distanceMeters: 32.5,
    retryCount: 2,
    photoPath: null,
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    theme: { primary: '#10264D', accent: '#C69B3C' },
    createdAt: '2026-11-19T00:00:00.000Z',
  };

  const fields = toFirestoreFields(input);
  assert.deepEqual(fields.nis, { stringValue: '00012345' });
  assert.deepEqual(fields.retryCount, { integerValue: '2' });
  assert.deepEqual(fields.distanceMeters, { doubleValue: 32.5 });
  assert.deepEqual(fields.createdAt, { timestampValue: '2026-11-19T00:00:00.000Z' });

  const restDoc: FirestoreRestDocument = {
    name: 'projects/mimiftahululum-20e51/databases/(default)/documents/students/doc_123',
    fields,
  };

  const restored = fromFirestoreDocument<typeof input>(restDoc);
  assert.deepEqual(restored, input);
});

test('MockRepository seeds exact initial teachers (Kepala Sekolah first), active students, and 6 classes with zero user credentials', async () => {
  const repo = new MockRepository();

  const teachers = await repo.collection(CollectionName.TEACHERS).list();
  const students = await repo.collection(CollectionName.STUDENTS).list();
  const classes = await repo.collection(CollectionName.CLASSES).list();
  const users = await repo.collection(CollectionName.USERS).list();

  assert.equal(teachers.total, 7);
  assert.equal(students.total, 24);
  assert.equal(classes.total, 6);
  assert.equal(users.total, 0);

  assert.equal(teachers.items[0]?.fullName, 'IMAM MUSTHOFA');
  assert.equal(teachers.items[0]?.position, 'Kepala Sekolah');

  const principal = teachers.items.find((t) => t.niyNip === '20521133191001');
  assert.ok(principal);
  assert.equal(principal.fullName, 'IMAM MUSTHOFA');
  assert.equal(principal.position, 'Kepala Sekolah');

  for (const s of students.items) {
    assert.equal(typeof s.nis, 'string');
    assert.equal(s.isDemo, false);
    assert.equal(s.status, StudentStatus.ACTIVE);
  }
});

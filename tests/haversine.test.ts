import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateHaversineDistanceMeters,
  isValidCoordinate,
  validateGeofence,
} from '../src/lib/haversine';

test('calculateHaversineDistanceMeters returns 0 for identical coordinates', () => {
  const point = { latitude: -8.2134, longitude: 113.0792 };
  assert.equal(calculateHaversineDistanceMeters(point, point), 0);
});

test('calculateHaversineDistanceMeters calculates known ~111 km per degree of latitude', () => {
  const a = { latitude: 0, longitude: 113.0 };
  const b = { latitude: 1, longitude: 113.0 };
  const distance = calculateHaversineDistanceMeters(a, b);
  assert.ok(distance > 111_000 && distance < 111_400, `Unexpected distance: ${distance}`);
});

test('calculateHaversineDistanceMeters measures short distance within school campus accurately', () => {
  const school = { latitude: -8.2134, longitude: 113.0792 };
  const gate = { latitude: -8.21385, longitude: 113.0792 }; // ~50 m south
  const distance = calculateHaversineDistanceMeters(school, gate);
  assert.ok(distance >= 45 && distance <= 55, `Expected ~50m, got ${distance}m`);
});

test('calculateHaversineDistanceMeters throws on out-of-range coordinates', () => {
  assert.throws(() =>
    calculateHaversineDistanceMeters(
      { latitude: 95, longitude: 113 },
      { latitude: -8.2, longitude: 113 },
    ),
  );
  assert.equal(isValidCoordinate({ latitude: -91, longitude: 0 }), false);
  assert.equal(isValidCoordinate({ latitude: -8.2, longitude: 181 }), false);
});

test('validateGeofence passes when within radius and GPS accuracy is acceptable', () => {
  const result = validateGeofence({
    school: { latitude: -8.2134, longitude: 113.0792 },
    device: { latitude: -8.2137, longitude: 113.0792 },
    radiusMeters: 100,
    maxAccuracyMeters: 50,
    accuracyMeters: 18,
  });

  assert.equal(result.passed, true);
  assert.equal(result.withinRadius, true);
  assert.equal(result.accuracyAcceptable, true);
  assert.equal(result.reason, null);
});

test('validateGeofence fails when device is outside school radius', () => {
  const result = validateGeofence({
    school: { latitude: -8.2134, longitude: 113.0792 },
    device: { latitude: -8.216, longitude: 113.0792 }, // ~289m
    radiusMeters: 100,
    maxAccuracyMeters: 50,
    accuracyMeters: 15,
  });

  assert.equal(result.passed, false);
  assert.equal(result.withinRadius, false);
  assert.equal(result.accuracyAcceptable, true);
  assert.ok(result.reason?.includes('luar radius'));
});

test('validateGeofence fails when GPS accuracy exceeds threshold', () => {
  const result = validateGeofence({
    school: { latitude: -8.2134, longitude: 113.0792 },
    device: { latitude: -8.2134, longitude: 113.0792 },
    radiusMeters: 100,
    maxAccuracyMeters: 50,
    accuracyMeters: 85,
  });

  assert.equal(result.passed, false);
  assert.equal(result.accuracyAcceptable, false);
  assert.ok(result.reason?.includes('Akurasi GPS'));
});

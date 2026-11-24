const EARTH_RADIUS_METERS = 6_371_000;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeofenceValidationInput {
  school: GeoPoint;
  device: GeoPoint;
  radiusMeters: number;
  maxAccuracyMeters: number;
  accuracyMeters: number | null;
}

export interface GeofenceValidationResult {
  passed: boolean;
  distanceMeters: number;
  withinRadius: boolean;
  accuracyAcceptable: boolean;
  reason: string | null;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function isValidCoordinate(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

/**
 * Calculates great-circle distance in meters between two WGS84 coordinates
 * using the Haversine formula.
 */
export function calculateHaversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  if (!isValidCoordinate(a) || !isValidCoordinate(b)) {
    throw new Error('Koordinat GPS tidak valid.');
  }

  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLon = Math.sin(dLon / 2);

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfLon * sinHalfLon;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return Math.round(EARTH_RADIUS_METERS * c * 100) / 100;
}

/**
 * Evaluates device coordinates against configured school geofence & GPS accuracy limits.
 */
export function validateGeofence(input: GeofenceValidationInput): GeofenceValidationResult {
  if (!isValidCoordinate(input.school) || !isValidCoordinate(input.device)) {
    return {
      passed: false,
      distanceMeters: Number.POSITIVE_INFINITY,
      withinRadius: false,
      accuracyAcceptable: false,
      reason: 'Koordinat lokasi tidak valid.',
    };
  }

  const distanceMeters = calculateHaversineDistanceMeters(input.school, input.device);
  const withinRadius = distanceMeters <= input.radiusMeters;
  const accuracyAcceptable =
    input.accuracyMeters !== null &&
    Number.isFinite(input.accuracyMeters) &&
    input.accuracyMeters >= 0 &&
    input.accuracyMeters <= input.maxAccuracyMeters;

  if (!accuracyAcceptable) {
    return {
      passed: false,
      distanceMeters,
      withinRadius,
      accuracyAcceptable: false,
      reason: `Akurasi GPS belum memenuhi syarat (maksimal ${input.maxAccuracyMeters} meter).`,
    };
  }

  if (!withinRadius) {
    return {
      passed: false,
      distanceMeters,
      withinRadius: false,
      accuracyAcceptable: true,
      reason: `Lokasi berada di luar radius sekolah (${Math.round(distanceMeters)} m dari batas ${input.radiusMeters} m).`,
    };
  }

  return {
    passed: true,
    distanceMeters,
    withinRadius: true,
    accuracyAcceptable: true,
    reason: null,
  };
}

import { calculateHaversineDistanceMeters } from './haversine';

export interface LocationSample {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  timestampIso: string;
}

export interface AnomalyCheckInput {
  current: LocationSample;
  previousToday?: LocationSample | null;
  maxAccuracyMeters: number;
}

/**
 * Heuristic anomaly indicators for teacher GPS telemetry.
 * IMPORTANT: These are diagnostic flags for administrative review ONLY —
 * browser geolocation cannot guarantee perfect anti-spoofing.
 */
export function detectLocationAnomalies(input: AnomalyCheckInput): string[] {
  const flags: string[] = [];
  const { current, previousToday, maxAccuracyMeters } = input;

  // 1. Suspiciously exact zero or sub-meter accuracy (often produced by mock GPS providers)
  if (current.accuracyMeters !== null) {
    if (current.accuracyMeters === 0) {
      flags.push('ACCURACY_ZERO_SUSPICIOUS');
    } else if (current.accuracyMeters < 1) {
      flags.push('ACCURACY_SUBMETER_SUSPICIOUS');
    } else if (maxAccuracyMeters > 0 && current.accuracyMeters >= maxAccuracyMeters * 0.85) {
      flags.push('ACCURACY_NEAR_THRESHOLD');
    }
  }

  // 2. Implausible location jump compared to an earlier scan today
  if (previousToday) {
    const prevMs = new Date(previousToday.timestampIso).getTime();
    const currMs = new Date(current.timestampIso).getTime();
    const elapsedSeconds = Math.abs(currMs - prevMs) / 1000;

    const distanceMeters = calculateHaversineDistanceMeters(
      { latitude: previousToday.latitude, longitude: previousToday.longitude },
      { latitude: current.latitude, longitude: current.longitude },
    );

    if (distanceMeters >= 500) {
      if (elapsedSeconds < 5) {
        flags.push('LOCATION_TELEPORT_JUMP');
      } else {
        const speedKmh = (distanceMeters / 1000) / (elapsedSeconds / 3600);
        if (speedKmh > 150) {
          flags.push('IMPLAUSIBLE_TRAVEL_SPEED');
        }
      }
    }
  }

  return flags;
}

export const ANOMALY_FLAG_LABELS: Record<string, string> = {
  ACCURACY_ZERO_SUSPICIOUS: 'Akurasi GPS tepat 0 m (perlu verifikasi)',
  ACCURACY_SUBMETER_SUSPICIOUS: 'Akurasi GPS di bawah 1 m (tidak lazim di perangkat mobile)',
  ACCURACY_NEAR_THRESHOLD: 'Akurasi GPS mendekati ambang batas toleransi',
  LOCATION_TELEPORT_JUMP: 'Lompatan lokasi drastis dalam waktu sangat singkat',
  IMPLAUSIBLE_TRAVEL_SPEED: 'Perpindahan lokasi melebihi kecepatan wajar (>150 km/jam)',
};

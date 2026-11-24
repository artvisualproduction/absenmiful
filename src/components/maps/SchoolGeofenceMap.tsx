import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '../../lib/cn';

export interface SchoolGeofenceMapProps {
  schoolLat: number;
  schoolLng: number;
  radiusMeters: number;
  schoolName?: string;
  userLat?: number | null;
  userLng?: number | null;
  userAccuracyMeters?: number | null;
  editable?: boolean;
  onPickCoordinates?: (lat: number, lng: number) => void;
  className?: string;
  heightClassName?: string;
}

function createSchoolMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: 'custom-school-pin',
    html: `<div style="width:28px;height:28px;border-radius:9999px;background:#10264D;border:3px solid #C69B3C;box-shadow:0 3px 10px rgba(16,38,77,0.35);display:flex;align-items:center;justify-content:center;">
      <div style="width:8px;height:8px;border-radius:9999px;background:#FFFFFF;"></div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createUserMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: 'custom-user-pin',
    html: `<div style="width:20px;height:20px;border-radius:9999px;background:#16A34A;border:3px solid #FFFFFF;box-shadow:0 2px 8px rgba(22,163,74,0.45);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export function SchoolGeofenceMap({
  schoolLat,
  schoolLng,
  radiusMeters,
  schoolName = 'Lokasi Sekolah',
  userLat = null,
  userLng = null,
  userAccuracyMeters = null,
  editable = false,
  onPickCoordinates,
  className,
  heightClassName = 'h-[340px]',
}: SchoolGeofenceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const schoolMarkerRef = useRef<L.Marker | null>(null);
  const geofenceCircleRef = useRef<L.Circle | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const onPickRef = useRef(onPickCoordinates);

  useEffect(() => {
    onPickRef.current = onPickCoordinates;
  }, [onPickCoordinates]);

  // Initialize Leaflet map once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [schoolLat, schoolLng],
      zoom: 17,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const schoolMarker = L.marker([schoolLat, schoolLng], {
      icon: createSchoolMarkerIcon(),
      draggable: editable,
    })
      .addTo(map)
      .bindPopup(schoolName);

    const geofenceCircle = L.circle([schoolLat, schoolLng], {
      radius: Math.max(10, radiusMeters),
      color: '#C69B3C',
      weight: 2,
      fillColor: '#10264D',
      fillOpacity: 0.14,
    }).addTo(map);

    if (editable) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onPickRef.current?.(
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        );
      });

      schoolMarker.on('dragend', () => {
        const pos = schoolMarker.getLatLng();
        onPickRef.current?.(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
      });
    }

    mapRef.current = map;
    schoolMarkerRef.current = schoolMarker;
    geofenceCircleRef.current = geofenceCircle;

    // Ensure proper container size calculation after layout paint
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      schoolMarkerRef.current = null;
      geofenceCircleRef.current = null;
      userMarkerRef.current = null;
      userAccuracyCircleRef.current = null;
    };
  }, [editable]);

  // Update school coordinates, popup, and radius smoothly
  useEffect(() => {
    const map = mapRef.current;
    const marker = schoolMarkerRef.current;
    const circle = geofenceCircleRef.current;
    if (!map || !marker || !circle) return;

    if (Number.isFinite(schoolLat) && Number.isFinite(schoolLng)) {
      marker.setLatLng([schoolLat, schoolLng]);
      marker.bindPopup(schoolName);
      circle.setLatLng([schoolLat, schoolLng]);
      circle.setRadius(Math.max(10, radiusMeters));
      map.panTo([schoolLat, schoolLng], { animate: true });
    }
  }, [schoolLat, schoolLng, radiusMeters, schoolName]);

  // Update optional user GPS position + accuracy ring
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const hasUserCoords =
      typeof userLat === 'number' &&
      typeof userLng === 'number' &&
      Number.isFinite(userLat) &&
      Number.isFinite(userLng);

    if (!hasUserCoords) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      userAccuracyCircleRef.current?.remove();
      userAccuracyCircleRef.current = null;
      return;
    }

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([userLat, userLng], {
        icon: createUserMarkerIcon(),
      })
        .addTo(map)
        .bindPopup('Posisi Perangkat Anda');
    } else {
      userMarkerRef.current.setLatLng([userLat, userLng]);
    }

    if (typeof userAccuracyMeters === 'number' && userAccuracyMeters > 0) {
      if (!userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current = L.circle([userLat, userLng], {
          radius: userAccuracyMeters,
          color: '#16A34A',
          weight: 1,
          dashArray: '4 4',
          fillColor: '#16A34A',
          fillOpacity: 0.12,
        }).addTo(map);
      } else {
        userAccuracyCircleRef.current.setLatLng([userLat, userLng]);
        userAccuracyCircleRef.current.setRadius(userAccuracyMeters);
      }
    }
  }, [userLat, userLng, userAccuracyMeters]);

  return (
    <div
      className={cn(
        'relative isolate w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F1F5F9]',
        heightClassName,
        className,
      )}
    >
      <div ref={containerRef} className="h-full w-full z-0" />
      {editable && (
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[400] rounded-lg border border-[#10264D]/15 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[#10264D] shadow-sm">
          Klik peta atau seret penanda untuk mengatur titik koordinat sekolah
        </div>
      )}
    </div>
  );
}

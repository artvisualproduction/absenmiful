import { useEffect, useState, type FormEvent } from 'react';
import type { z } from 'zod';
import {
  AlertCircle,
  Archive,
  Crosshair,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Input } from '../../components/forms/Input';
import { AppShell } from '../../components/layout/AppShell';
import { SchoolGeofenceMap } from '../../components/maps/SchoolGeofenceMap';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { schoolLocationCreateSchema } from '../../lib/teacherAttendanceValidation';
import { ApiClientError } from '../../services/apiClient';
import { attendanceService, type GpsSettingsConfig } from '../../services/attendanceService';
import { UserRole, type SchoolLocation } from '../../types';

type SchoolLocationCreateInput = z.infer<typeof schoolLocationCreateSchema>;

interface LocationFormState {
  name: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
  maxGpsAccuracyMeters: string;
  isActive: boolean;
}

const DEFAULT_FORM: LocationFormState = {
  name: 'MI Miftahul Ulum Sumberwuluh',
  latitude: '-8.15165',
  longitude: '113.11124',
  radiusMeters: '100',
  maxGpsAccuracyMeters: '75',
  isActive: true,
};

export function GeofencingPage() {
  useDocumentTitle('Lokasi & Geofencing');
  const { user } = useAuth();
  const { showToast } = useToast();
  const canWrite = user
    ? user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.OPERATOR
    : false;

  const [locations, setLocations] = useState<SchoolLocation[]>([]);
  const [gpsSettings, setGpsSettings] = useState<GpsSettingsConfig>({
    gpsEnabledForStudents: true,
    gpsEnabledForTeachers: true,
    teacherSelfServiceEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Selected location for map preview
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolLocation | null>(null);
  const [form, setForm] = useState<LocationFormState>(DEFAULT_FORM);
  const [initialForm, setInitialForm] = useState<LocationFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [locating, setLocating] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [validatedDataToSave, setValidatedDataToSave] = useState<SchoolLocationCreateInput | null>(null);

  // Archive Confirmation
  const [archiving, setArchiving] = useState<SchoolLocation | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendanceService.listSchoolLocations();
      setLocations(res.items);
      setGpsSettings(res.gpsSettings);
      const active = res.items.find((l) => l.isActive) ?? res.items[0] ?? null;
      setSelectedId((prev) => (prev && res.items.some((l) => l.id === prev) ? prev : active?.id ?? null));
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Gagal memuat konfigurasi lokasi dan geofencing.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const previewLocation =
    locations.find((l) => l.id === selectedId) ??
    locations.find((l) => l.isActive) ??
    locations[0] ??
    null;

  const openCreateModal = () => {
    setEditing(null);
    const initial: LocationFormState = {
      ...DEFAULT_FORM,
      latitude: previewLocation ? String(previewLocation.latitude) : DEFAULT_FORM.latitude,
      longitude: previewLocation ? String(previewLocation.longitude) : DEFAULT_FORM.longitude,
      name: '',
    };
    setForm(initial);
    setInitialForm(initial);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (loc: SchoolLocation) => {
    setEditing(loc);
    const initial: LocationFormState = {
      name: loc.name,
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      radiusMeters: String(loc.radiusMeters),
      maxGpsAccuracyMeters: String(loc.maxGpsAccuracyMeters),
      isActive: loc.isActive,
    };
    setForm(initial);
    setInitialForm(initial);
    setFormError(null);
    setModalOpen(true);
  };

  const isFormDirty =
    form.name !== initialForm.name ||
    form.latitude !== initialForm.latitude ||
    form.longitude !== initialForm.longitude ||
    form.radiusMeters !== initialForm.radiusMeters ||
    form.maxGpsAccuracyMeters !== initialForm.maxGpsAccuracyMeters ||
    form.isActive !== initialForm.isActive;

  const handleRequestClose = () => {
    if (savingForm) return;
    if (isFormDirty) {
      setConfirmCloseOpen(true);
    } else {
      setModalOpen(false);
      setFormError(null);
    }
  };

  const handleForceClose = () => {
    setConfirmCloseOpen(false);
    setModalOpen(false);
    setFormError(null);
  };

  const handleUseDeviceLocation = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setFormError('Browser perangkat ini tidak mendukung Geolocation.');
      return;
    }
    setLocating(true);
    setFormError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
        showToast({
          variant: 'success',
          title: 'Koordinat perangkat diambil',
          message: `Akurasi GPS saat ini ±${Math.round(pos.coords.accuracy)} meter.`,
        });
      },
      () => {
        setLocating(false);
        setFormError('Gagal membaca GPS perangkat. Pastikan izin lokasi browser diaktifkan.');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const handlePromptSaveLocation = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = schoolLocationCreateSchema.safeParse({
      name: form.name,
      latitude: form.latitude,
      longitude: form.longitude,
      radiusMeters: form.radiusMeters,
      maxGpsAccuracyMeters: form.maxGpsAccuracyMeters,
      isActive: form.isActive,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Data lokasi tidak valid.');
      return;
    }

    setValidatedDataToSave(parsed.data);
    setConfirmSaveOpen(true);
  };

  const handleExecuteSaveLocation = async () => {
    if (!validatedDataToSave) return;
    setSavingForm(true);
    try {
      if (editing) {
        await attendanceService.updateSchoolLocation(editing.id, validatedDataToSave);
        showToast({
          variant: 'success',
          title: 'Lokasi diperbarui',
          message: `Titik geofence "${validatedDataToSave.name}" telah disimpan.`,
        });
      } else {
        await attendanceService.createSchoolLocation(validatedDataToSave);
        showToast({
          variant: 'success',
          title: 'Lokasi ditambahkan',
          message: `Titik geofence "${validatedDataToSave.name}" berhasil dibuat.`,
        });
      }
      setConfirmSaveOpen(false);
      setValidatedDataToSave(null);
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setConfirmSaveOpen(false);
      setFormError(
        err instanceof ApiClientError ? err.message : 'Gagal menyimpan titik lokasi sekolah.',
      );
    } finally {
      setSavingForm(false);
    }
  };

  const handleArchiveLocation = async () => {
    if (!archiving) return;
    setArchiveBusy(true);
    try {
      await attendanceService.archiveSchoolLocation(archiving.id);
      showToast({
        variant: 'info',
        title: 'Lokasi dinonaktifkan',
        message: `"${archiving.name}" telah diarsipkan.`,
      });
      setArchiving(null);
      await loadData();
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal mengarsipkan lokasi',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan server.',
      });
    } finally {
      setArchiveBusy(false);
    }
  };

  const handleToggleSetting = async (key: keyof GpsSettingsConfig) => {
    if (!canWrite) return;
    const nextValue = !gpsSettings[key];
    setSavingSettings(true);
    try {
      const updated = await attendanceService.updateGpsSettings({ [key]: nextValue });
      setGpsSettings(updated);
      showToast({
        variant: 'success',
        title: 'Pengaturan GPS disimpan',
        message: 'Perubahan kebijakan GPS/geofencing langsung berlaku di server.',
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Gagal menyimpan pengaturan',
        message: err instanceof ApiClientError ? err.message : 'Terjadi kesalahan server.',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const modalLat = Number.parseFloat(form.latitude);
  const modalLng = Number.parseFloat(form.longitude);
  const modalRadius = Number.parseInt(form.radiusMeters, 10) || 100;

  return (
    <AppShell
      title="Lokasi & Geofencing"
      subtitle="Atur titik koordinat madrasah, radius Haversine, ambang akurasi GPS, dan kebijakan per jenis pengguna."
      actions={
        canWrite ? (
          <div className="flex flex-wrap items-center gap-2 [&>button]:whitespace-nowrap [&>button]:shrink-0">
            <Button
              variant="gold"
              size="sm"
              onClick={openCreateModal}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Tambah Titik Lokasi
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Map + Policy Controls */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Interactive Map Preview */}
          <section className="lg:col-span-7 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
              <div className="space-y-1 min-w-0">
                <h2 className="text-sm font-semibold text-[#10264D]">
                  Peta Radius Geofence Sekolah (OpenStreetMap)
                </h2>
                {previewLocation ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="font-semibold text-[#10264D]">{previewLocation.name}</span>
                    <span className="font-mono tabular-nums text-[11px] text-slate-500">
                      {previewLocation.latitude.toFixed(6)}, {previewLocation.longitude.toFixed(6)}
                    </span>
                    <span className="font-mono tabular-nums rounded bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 py-0.5 text-[11px] font-medium text-[#10264D]">
                      Radius {previewLocation.radiusMeters} m · Akurasi ≤
                      {previewLocation.maxGpsAccuracyMeters} m
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Belum ada titik lokasi sekolah</p>
                )}
              </div>
              {previewLocation && canWrite && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(previewLocation)}
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                >
                  Ubah Titik Ini
                </Button>
              )}
            </div>

            <div className="p-4 flex-1">
              {loading ? (
                <Skeleton className="h-[340px] w-full rounded-xl" />
              ) : previewLocation ? (
                <SchoolGeofenceMap
                  schoolLat={previewLocation.latitude}
                  schoolLng={previewLocation.longitude}
                  radiusMeters={previewLocation.radiusMeters}
                  schoolName={previewLocation.name}
                  heightClassName="h-[340px]"
                />
              ) : (
                <EmptyState
                  icon={<MapPin className="h-5 w-5" />}
                  title="Belum ada lokasi sekolah"
                  description="Tambahkan titik koordinat sekolah untuk mengaktifkan validasi radius geofencing."
                />
              )}
            </div>
          </section>

          {/* GPS Policy Toggles */}
          <section className="lg:col-span-5 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden flex flex-col">
            <div className="border-b border-[#E2E8F0] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-[#10264D]">
                Kebijakan GPS &amp; Absensi Mandiri
              </h2>
              <p className="text-xs text-slate-500">
                Aktifkan atau nonaktifkan validasi GPS per kategori pengguna.
              </p>
            </div>

            <div className="divide-y divide-[#E2E8F0] px-5 py-2 flex-1">
              {(
                [
                  {
                    key: 'gpsEnabledForTeachers',
                    title: 'Validasi GPS & Geofence untuk Guru',
                    desc: 'Memeriksa akurasi GPS dan jarak Haversine terhadap radius sekolah saat guru absen.',
                  },
                  {
                    key: 'gpsEnabledForStudents',
                    title: 'Validasi GPS untuk Portal Absensi Siswa',
                    desc: 'Meminta koordinat lokasi perangkat portal saat pemindaian QR siswa bila aturan mewajibkan.',
                  },
                  {
                    key: 'teacherSelfServiceEnabled',
                    title: 'Absensi Mandiri Guru (Selfie + GPS)',
                    desc: 'Izinkan guru melakukan absensi masuk dan pulang langsung dari Dashboard Guru.',
                  },
                ] as const
              ).map((item) => {
                const enabled = gpsSettings[item.key];
                return (
                  <div
                    key={item.key}
                    className="flex items-start justify-between gap-4 py-4"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-[#10264D]">{item.title}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      disabled={!canWrite || savingSettings}
                      onClick={() => void handleToggleSetting(item.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10264D] disabled:cursor-not-allowed disabled:opacity-50 ${
                        enabled ? 'bg-[#10264D]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                          enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#E2E8F0] bg-[#FCF9F1] px-5 py-3.5">
              <div className="flex items-start gap-2.5 text-xs text-[#8D6B22]">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Catatan Teknis:</strong> Validasi Haversine dilakukan penuh di server.
                  GPS browser tetap dapat dipengaruhi kondisi perangkat; sistem mencatat akurasi
                  serta indikator anomali untuk tinjauan administratif, bukan klaim anti-spoofing
                  mutlak.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Saved Locations List */}
        <section className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-[#10264D]">Daftar Titik Lokasi Sekolah</h2>
            <p className="text-xs text-slate-500">
              Hanya satu titik lokasi yang aktif digunakan untuk perhitungan geofencing pada satu
              waktu.
            </p>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
            ) : locations.length === 0 ? (
              <EmptyState
                icon={<MapPin className="h-5 w-5" />}
                title="Belum ada titik lokasi tersimpan"
                description="Klik Tambah Titik Lokasi untuk menetapkan koordinat MI Miftahul Ulum Sumberwuluh."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-slate-500">
                      <th className="pb-3 pr-4">Nama Lokasi</th>
                      <th className="pb-3 pr-4">Koordinat (Lat, Lng)</th>
                      <th className="pb-3 pr-4">Radius</th>
                      <th className="pb-3 pr-4">Ambang Akurasi</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {locations.map((loc) => (
                      <tr
                        key={loc.id}
                        onClick={() => setSelectedId(loc.id)}
                        className={`cursor-pointer transition-colors hover:bg-[#F8FAFC] ${
                          selectedId === loc.id ? 'bg-[#FCF9F1]/70' : ''
                        }`}
                      >
                        <td className="py-3.5 pr-4 font-semibold text-[#10264D]">{loc.name}</td>
                        <td className="py-3.5 pr-4 font-mono text-xs text-slate-600 tabular-nums">
                          {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                        </td>
                        <td className="py-3.5 pr-4 font-mono text-xs font-medium text-[#10264D] tabular-nums">
                          {loc.radiusMeters} m
                        </td>
                        <td className="py-3.5 pr-4 font-mono text-xs text-slate-600 tabular-nums">
                          &le; {loc.maxGpsAccuracyMeters} m
                        </td>
                        <td className="py-3.5 pr-4">
                          <StatusBadge
                            label={loc.isActive ? 'Aktif' : 'Nonaktif'}
                            tone={loc.isActive ? 'success' : 'neutral'}
                          />
                        </td>
                        <td
                          className="py-3.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1">
                            {canWrite && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(loc)}
                                  title={`Ubah ${loc.name}`}
                                  aria-label={`Ubah ${loc.name}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#10264D] hover:bg-[#F8FAFC] hover:border-[#10264D] transition-colors cursor-pointer"
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                </button>
                                {loc.isActive && (
                                  <button
                                    type="button"
                                    onClick={() => setArchiving(loc)}
                                    title={`Nonaktifkan ${loc.name}`}
                                    aria-label={`Nonaktifkan ${loc.name}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#B45309] hover:bg-[#FFFBEB] hover:border-[#FDE68A] transition-colors cursor-pointer"
                                  >
                                    <Archive className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modal Tambah / Ubah Lokasi Sekolah */}
      <Modal
        open={modalOpen}
        onClose={handleRequestClose}
        closeOnBackdrop={false}
        title={editing ? 'Ubah Titik Lokasi Sekolah' : 'Tambah Titik Lokasi Sekolah'}
        size="lg"
      >
        <form onSubmit={handlePromptSaveLocation} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              {formError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              Pilih titik pada peta di bawah atau gunakan tombol ambil posisi GPS perangkat.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={locating}
              onClick={handleUseDeviceLocation}
              leftIcon={<Crosshair className="h-3.5 w-3.5" />}
            >
              Ambil Lokasi Saya Sekarang
            </Button>
          </div>

          <SchoolGeofenceMap
            schoolLat={Number.isFinite(modalLat) ? modalLat : -8.15165}
            schoolLng={Number.isFinite(modalLng) ? modalLng : 113.11124}
            radiusMeters={modalRadius}
            schoolName={form.name || 'Titik Baru'}
            editable
            onPickCoordinates={(lat, lng) =>
              setForm((prev) => ({
                ...prev,
                latitude: String(lat),
                longitude: String(lng),
              }))
            }
            heightClassName="h-[240px]"
          />

          <Input
            label="Nama Lokasi / Kampus"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Contoh: Gedung Utama MI Miftahul Ulum Sumberwuluh"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Latitude"
              type="number"
              step="any"
              required
              value={form.latitude}
              onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              required
              value={form.longitude}
              onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Radius Geofence (meter)"
              type="number"
              min={10}
              max={5000}
              required
              value={form.radiusMeters}
              onChange={(e) => setForm((p) => ({ ...p, radiusMeters: e.target.value }))}
              helperText="Disarankan 50–150 meter sesuai luas halaman madrasah"
            />
            <Input
              label="Ambang Maksimal Akurasi GPS (meter)"
              type="number"
              min={5}
              max={1000}
              required
              value={form.maxGpsAccuracyMeters}
              onChange={(e) => setForm((p) => ({ ...p, maxGpsAccuracyMeters: e.target.value }))}
              helperText="GPS dengan akurasi lebih buruk dari batas ini akan ditolak"
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-[#10264D] cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-[#10264D] focus:ring-[#10264D]"
            />
            <span>Jadikan titik lokasi aktif utama untuk validasi geofencing</span>
          </label>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleRequestClose}
              disabled={savingForm}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={savingForm}>
              Simpan Lokasi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Konfirmasi Simpan Lokasi */}
      <ConfirmDialog
        open={confirmSaveOpen}
        onClose={() => !savingForm && setConfirmSaveOpen(false)}
        onConfirm={() => void handleExecuteSaveLocation()}
        title={editing ? 'Simpan Perubahan Titik Lokasi?' : 'Simpan Titik Lokasi Baru?'}
        message={`Apakah Anda yakin ingin menyimpan titik lokasi "${validatedDataToSave?.name ?? form.name}" dengan radius ${validatedDataToSave?.radiusMeters ?? form.radiusMeters} meter dan akurasi GPS maksimal ${validatedDataToSave?.maxGpsAccuracyMeters ?? form.maxGpsAccuracyMeters} meter?`}
        confirmLabel="Ya, Simpan Lokasi"
        cancelLabel="Periksa Kembali"
        variant="primary"
        loading={savingForm}
      />

      {/* Konfirmasi Tutup / Batal Tanpa Simpan */}
      <ConfirmDialog
        open={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        onConfirm={handleForceClose}
        title="Batalkan Perubahan Lokasi?"
        message="Perubahan koordinat atau pengaturan titik lokasi belum disimpan. Apakah Anda yakin ingin membatalkan dan keluar tanpa menyimpan?"
        confirmLabel="Ya, Keluar Tanpa Simpan"
        cancelLabel="Lanjutkan Mengedit"
        variant="danger"
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => !archiveBusy && setArchiving(null)}
        onConfirm={() => void handleArchiveLocation()}
        title="Nonaktifkan Titik Lokasi?"
        message={`Lokasi "${archiving?.name ?? ''}" akan dinonaktifkan dari validasi geofencing aktif.`}
        confirmLabel="Nonaktifkan"
        variant="danger"
        loading={archiveBusy}
      />
    </AppShell>
  );
}

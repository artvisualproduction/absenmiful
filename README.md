# Absensi Sekolah — MI Miftahul Ulum Sumberwuluh

Sistem Informasi Kehadiran Siswa & Guru berbasis web **Progressive Web App (PWA)** untuk **MI Miftahul Ulum Sumberwuluh** (Desa Sumberwuluh, Kec. Candipuro, Kab. Lumajang, Jawa Timur).

---

## Ringkasan Fitur

- **Autentikasi & RBAC Ketat**: Login internal (`username` + `password` bcrypt), sesi `HttpOnly; Secure; SameSite=Lax`, lockout otomatis, wajib ganti kata sandi pertama kali, serta 5 peran (`SUPER_ADMIN`, `ADMIN`, `OPERATOR`, `PRINCIPAL`, `TEACHER`).
- **Master Data & Impor/Ekspor Excel**: Tahun Ajaran, Kelas, Mata Pelajaran, Siswa (dengan riwayat `studentEnrollments`, arsip non-destruktif, serta penanda `DEMO`), dan Guru. Impor Excel dilengkapi pratinjau validasi per baris dan pembacaan NIS/NIY sebagai teks agar nol di depan tidak hilang.
- **Jadwal Mengajar & Aturan Jam Absensi**: Jadwal mengajar dengan deteksi bentrok guru & kelas, aturan jam absensi berversi untuk Siswa & Guru (`Asia/Jakarta`), kalender libur, serta fungsi murni `evaluateAttendanceStatus`.
- **Portal Absensi Layar Khusus (`/portal`)**: Tema gelap, jam real-time, kamera depan/belakang, dukungan scanner USB keyboard, pengumuman suara Web Speech API dari template `appSettings`, keluar portal dilindungi kata sandi hash server.
- **Absensi Mandiri Guru & Geofencing**: Selfie kamera depan ke penyimpanan privat, validasi GPS (Haversine radius sekolah & ambang akurasi), deteksi indikator anomali, serta jalur pengecualian manual teraudit oleh Admin.
- **Perizinan Guru Berjenjang**: Alur wajib `SUBMITTED -> ADMIN_REVIEWED / RETURNED -> APPROVED / REJECTED` (Kepala Sekolah tidak dapat memutus sebelum verifikasi Admin), terhubung ke rekap kehadiran.
- **Dashboard & Laporan Resmi**: Dashboard khusus Admin, Kepala Sekolah, dan Guru; grafik tren 14 hari; ekspor Excel (`.xlsx`), PDF (`.pdf`), dan tampilan cetak.
- **Kartu QR, Pengaturan & Audit Append-Only**: Kartu QR portrait (PNG satuan, ZIP massal, cetak) berisi **hanya token acak berentropi tinggi**, unggah logo/favicon/ikon PWA/latar login, backup JSON tersanitasi, manajemen akun dengan proteksi `SUPER_ADMIN`, serta log aktivitas `append-only`.
- **PWA Siap Pasang**: `manifest.webmanifest` dinamis, ikon 192/512/maskable, `apple-touch-icon`, Service Worker khusus aset statis & `/offline.html` (**tidak pernah meng-cache `/api/*`, selfie, token QR, maupun data pribadi**).

---

## Arsitektur Teknis

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 (`src/`)
- **Backend API**: Vercel Serverless Functions (`api/**`), dijalankan lokal melalui Express pada `server.ts` (port `3000`)
- **Database**: Google Cloud Firestore diakses **eksklusif dari sisi server** via **Cloud Firestore REST API** (`api/_lib/repository/firestoreRestRepository.ts`) menggunakan OAuth2 JWT Service Account — **tanpa Firebase Admin SDK** dan **tanpa Firebase Auth**.
- **Aturan Firestore (`firestore.rules`)**: Menolak seluruh akses baca/tulis langsung dari klien (`allow read, write: if false;`).

---

## Persiapan & Pengembangan Lokal

1. **Instalasi dependensi**:
   ```bash
   npm install
   ```
2. **Salin konfigurasi environment**:
   ```bash
   cp .env.example .env
   ```
   Untuk pengujian lokal tanpa kredensial Firestore, gunakan `DATA_MODE=mock`. Untuk produksi, gunakan `DATA_MODE=real` beserta variabel kredensial Service Account.
3. **Jalankan server pengembangan (port 3000)**:
   ```bash
   npm run dev
   ```
4. **Jalankan seluruh pengujian otomatis**:
   ```bash
   npm test
   ```
5. **Verifikasi tipe, lint, dan build produksi**:
   ```bash
   npm run lint
   npm run build
   ```

---

## Konfigurasi Environment Produksi (`.env.example`)

| Variabel | Sifat | Keterangan |
| --- | --- | --- |
| `DATA_MODE` | Server | `real` untuk produksi Firestore REST API (`mock` hanya untuk pengujian lokal). |
| `FIREBASE_PROJECT_ID` | Server | ID Project Google Cloud / Firebase (mis. `mi-miftahul-ulum-absensi`). |
| `FIREBASE_CLIENT_EMAIL` | Server | Email Service Account least-privilege (`...@...iam.gserviceaccount.com`). |
| `FIREBASE_PRIVATE_KEY` | Server (Rahasia) | Private key PEM dari Service Account (pertahankan `\n`). **Jangan pernah diawali `VITE_`.** |
| `SESSION_SECRET` | Server (Rahasia) | String acak kuat minimal 32 byte untuk penandatanganan & HMAC sesi. |
| `PORTAL_DEFAULT_EXIT_PASSWORD` | Server (Rahasia) | Kata sandi keluar portal awal saat bootstrap pertama (langsung di-hash bcrypt). |
| `APP_URL` | Server | URL HTTPS produksi (mis. `https://absensi.mimiftahululum.sch.id`). |
| `APP_TIMEZONE` | Server | `Asia/Jakarta` |

---

## Panduan Deployment Langkah demi Langkah (Firebase + Vercel)

### 1. Siapkan Firebase & Cloud Firestore
1. Buka **Firebase Console**, buat project baru, lalu aktifkan **Cloud Firestore** (pilih region terdekat, misalnya `asia-southeast2` Jakarta).
2. Terapkan aturan keamanan penolakan klien dari file `firestore.rules`:
   ```bash
   firebase deploy --only firestore:rules
   ```
   Pastikan aturan berisi `allow read, write: if false;` sehingga seluruh akses database hanya melewati API server.
3. Terapkan 7 indeks komposit dari `firestore.indexes.json`:
   ```bash
   firebase deploy --only firestore:indexes
   ```

### 2. Buat Service Account Least-Privilege
1. Buka **Google Cloud Console → IAM & Admin → Service Accounts**.
2. Buat Service Account khusus aplikasi (mis. `absensi-api-server`).
3. Berikan peran minimum **Cloud Datastore User** (`roles/datastore.user`) untuk baca/tulis Firestore REST API.
4. Buat kunci JSON baru, salin `project_id`, `client_email`, dan `private_key`. Simpan file JSON secara aman dan jangan pernah di-commit ke repositori.

### 3. Konfigurasi Variabel Environment di Vercel
1. Hubungkan repositori ke **Vercel** (Framework Preset: Vite, Output Directory: `dist`).
2. Masuk ke **Project Settings → Environment Variables**, tambahkan seluruh variabel server (`DATA_MODE=real`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SESSION_SECRET`, `APP_URL`, `APP_TIMEZONE`).
3. **Audit keamanan**: Pastikan tidak ada satu pun variabel rahasia yang diawali `VITE_`.

### 4. Preview Deploy & Bootstrap Seed Awal
1. Lakukan **Preview Deployment** di Vercel dan pastikan build sukses tanpa galat.
2. Jalankan inisialisasi akun awal (hanya dapat dilakukan sekali ketika database pengguna masih kosong):
   - Via CLI:
     ```bash
     npm run seed:bootstrap
     ```
   - Atau melalui tombol **"Inisialisasi Akun Awal"** pada halaman `/login` (otomatis nonaktif segera setelah akun pertama terbentuk).
3. Catat kata sandi sementara 7 akun guru yang ditampilkan satu kali, lalu distribusikan secara privat.

### 5. Pengujian Peran & Keamanan Pra-Produksi
- Uji login sebagai `SUPER_ADMIN`, `ADMIN`, `PRINCIPAL`, dan `TEACHER`.
- Pastikan guru mendapat `403` saat mengakses endpoint master data dan tidak bisa melihat izin guru lain (IDOR).
- Pastikan Kepala Sekolah tidak dapat memutus izin sebelum review Admin dan tidak bisa mengubah akun `SUPER_ADMIN`.
- Pastikan seluruh header keamanan (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`) aktif di `vercel.json`.

### 6. Production HTTPS Deploy & Uji Instalasi PWA
1. Promosikan ke **Production Deployment** dengan domain HTTPS aktif.
2. **Desktop (Chrome / Edge)**: Buka URL produksi → klik ikon **Instal Aplikasi** di address bar atau tombol **Instal Aplikasi** di header aplikasi.
3. **Android (Google Chrome)**: Buka URL produksi → ketuk menu Chrome → **Instal aplikasi / Tambahkan ke layar utama**.
   > **Catatan Penting Mengenai WebAPK**: Paket **WebAPK** pada Android dihasilkan secara otomatis oleh **Google Chrome** di perangkat pengguna (melalui layanan WebAPK Chrome) ketika situs memenuhi kriteria HTTPS, `manifest.webmanifest`, ikon 192/512/maskable, dan Service Worker — **bukan dihasilkan atau dibuild oleh Vercel**.
4. **iOS (Safari)**: Ketuk tombol **Bagikan (Share)** → **Tambahkan ke Layar Utama (Add to Home Screen)**.

---

## Kebijakan Keamanan & Privasi Service Worker

Service Worker (`public/service-worker.js`) hanya meng-cache aset statis build (`/assets/*`, `/icons/*`, `/favicon.png`, `/icon.svg`) dan halaman `/offline.html`. Seluruh rute berikut **dikecualikan secara ketat dari cache**:
- `/api/*`
- Foto selfie kehadiran & lampiran perizinan
- Token QR dan hasil pemindaian absensi
- Data pribadi siswa, guru, log audit, dan backup

---

## Dokumentasi Operasional

Lihat panduan lengkap pengguna, prosedur backup & pemulihan, serta daftar periksa penggantian data demo siswa pada:
- [`docs/PANDUAN_PENGGUNA.md`](./docs/PANDUAN_PENGGUNA.md)

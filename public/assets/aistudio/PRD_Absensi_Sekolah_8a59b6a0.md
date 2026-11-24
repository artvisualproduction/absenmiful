# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# ABSENSI SEKOLAH
## MI Miftahul Ulum Sumberwuluh

**Versi:** 1.0  
**Status:** Draft spesifikasi dasar  
**Platform:** Web responsif, PWA installable, Android WebAPK (bila didukung browser/perangkat)  
**Tanggal:** 19 November 2026

---

## 1. Ringkasan Produk

Absensi Sekolah adalah sistem informasi kehadiran khusus MI Miftahul Ulum Sumberwuluh. Sistem mengelola absensi siswa dan guru, data akademik dasar, jadwal mengajar, perizinan guru, lokasi absensi, kartu QR, dan laporan.

Sistem mempunyai tiga dashboard terpisah:
1. Admin
2. Kepala Sekolah
3. Guru

Portal Absensi merupakan layar operasional khusus untuk pemindaian QR dan tidak disamakan dengan dashboard pengguna.

## 2. Tujuan

- Mengganti pencatatan kehadiran manual dengan pencatatan digital.
- Mempercepat absensi masuk dan pulang.
- Memvalidasi absensi siswa dengan QR Code dan GPS.
- Memvalidasi absensi guru dengan QR Code, selfie, GPS, dan geofencing.
- Menyediakan jadwal mengajar yang tampil sesuai akun guru.
- Menyediakan alur pengajuan dan persetujuan izin.
- Menyajikan rekap harian, mingguan, bulanan, dan tahunan.
- Memudahkan ekspor laporan Excel dan PDF.
- Menyediakan aplikasi yang dapat dipasang melalui PWA.

## 3. Ruang Lingkup

### Termasuk
- Identitas sekolah, logo, favicon, ikon PWA, dan foto latar login.
- Login aplikasi dengan username dan password aplikasi.
- Dashboard berbasis role.
- Master data siswa, guru, kelas/rombongan belajar, mata pelajaran, dan tahun ajaran.
- Jadwal mengajar guru.
- Aturan jam masuk dan pulang.
- Portal absensi QR.
- GPS dan geofencing.
- Selfie guru.
- Pengajuan izin guru dan persetujuan Admin/Kepala Sekolah.
- Kartu identitas QR dan unduhan massal.
- Rekap dan ekspor laporan.
- Pengaturan aplikasi dan log aktivitas.
- PWA dengan mode tampilan standalone.

### Tidak termasuk pada versi awal
- Penggajian guru.
- Pembayaran sekolah.
- E-learning/LMS.
- Integrasi Dapodik/EMIS otomatis.
- Pengenalan wajah biometrik otomatis.
- Aplikasi native iOS/Android yang diterbitkan melalui store.

## 4. Pengguna dan Hak Akses

### 4.1 Admin
Admin mengelola operasional aplikasi:
- Dashboard operasional.
- Data siswa, guru, kelas, mata pelajaran, dan tahun ajaran.
- Jadwal mengajar dan aturan absensi.
- Portal absensi dan perangkat pemindai.
- Lokasi sekolah dan geofencing.
- QR dan kartu identitas.
- Data kehadiran dan koreksi dengan alasan.
- Perizinan sesuai kewenangan.
- Laporan.
- Pengguna dan hak akses.
- Pengaturan aplikasi.
- Log aktivitas.

### 4.2 Kepala Sekolah
- Dashboard ringkasan kehadiran.
- Monitoring kehadiran siswa dan guru.
- Melihat rekap dan laporan.
- Meninjau dan memberi keputusan akhir atas pengajuan izin.
- Melihat riwayat persetujuan.
- Melihat catatan koreksi dan aktivitas yang relevan.
- Tidak dapat mengubah konfigurasi teknis atau mengelola akun super-admin, kecuali diberi izin eksplisit.

### 4.3 Guru
- Dashboard pribadi.
- Melihat profil dan jadwal mengajar sendiri.
- Melakukan absensi masuk dan pulang dengan selfie dan GPS.
- Melihat riwayat absensi sendiri.
- Mengajukan izin dengan alasan dan lampiran opsional.
- Melihat status pengajuan izin.
- Mengubah password sendiri.
- Tidak dapat melihat data pribadi atau absensi guru lain.

### 4.4 Super Admin
Untuk instalasi satu sekolah, Super Admin dapat menjadi akun teknis/penanggung jawab utama dengan akses penuh, terpisah dari role Admin operasional. Jika tidak diperlukan, role ini dapat digabung dengan Admin melalui konfigurasi.

## 5. Modul dan Kebutuhan Fungsional

### 5.1 Login
Halaman login menampilkan:
- Logo yang dapat diunggah.
- Nama aplikasi.
- Nama lembaga.
- Alamat lembaga.
- Bio opsional.
- Foto latar gedung/sekolah.
- Username.
- Password dengan tombol tampil/sembunyikan.
- Tombol Login.
- Tombol menuju Portal Absensi.

Ketentuan:
- Pesan gagal login tidak membocorkan apakah username atau password yang salah.
- Terapkan pembatasan percobaan login, jeda/cooldown, dan pencatatan audit.
- Sediakan proses reset password oleh Admin melalui prosedur verifikasi.
- Jangan menyimpan password dalam bentuk plaintext.

### 5.2 Dashboard Admin
Kartu ringkasan:
- Total siswa aktif.
- Total guru aktif.
- Hadir hari ini.
- Terlambat.
- Izin/sakit.
- Belum melakukan absensi masuk/pulang.
- Pengajuan izin menunggu.
- Grafik tren kehadiran.
- Aktivitas terbaru.

Filter berdasarkan tanggal, kelas, status, dan jenis pengguna.

### 5.3 Dashboard Kepala Sekolah
- Ringkasan kehadiran sekolah.
- Statistik siswa dan guru.
- Tren keterlambatan dan ketidakhadiran.
- Daftar pengajuan izin yang menunggu keputusan.
- Rekap kelas.
- Laporan yang dapat dilihat/diunduh.
- Riwayat keputusan izin.

### 5.4 Dashboard Guru
- Salam dan identitas guru.
- Jadwal mengajar hari ini dan mendatang.
- Status absensi masuk/pulang hari ini.
- Tombol absensi mandiri.
- Riwayat absensi.
- Form pengajuan izin.
- Status pengajuan izin.

### 5.5 Master Data Siswa
Field minimum:
- Nama lengkap.
- NIS unik.
- Kelas/rombongan belajar.
- Jenis kelamin (opsional sesuai kebijakan sekolah).
- Foto (opsional).
- Status aktif/lulus/pindah/nonaktif.
- Tahun ajaran/riwayat kelas.

Fitur:
- Tambah, lihat, ubah, arsipkan.
- Impor Excel dengan pratinjau dan validasi.
- Ekspor Excel.
- Pencarian dan filter.
- Checkbox pilihan massal.
- Generate dan unduh QR satuan/massal.
- Cetak kartu siswa.

### 5.6 Master Data Guru
Field minimum:
- Nama lengkap.
- NIY/NIP unik.
- Jabatan.
- Username.
- Status aktif/nonaktif.
- Foto.
- Data jadwal mengajar.
- Kredensial akun disimpan secara aman, tidak pernah diekspor sebagai password.

Fitur:
- CRUD/arsip.
- Impor/ekspor.
- Checkbox massal.
- Generate QR guru.
- Aktivasi akun mandiri.
- Reset password oleh Admin melalui alur aman.

Username awal dapat dibentuk dari nama guru, tetapi harus dinormalisasi dan diperiksa keunikannya. Password awal berbasis NIY/NIP hanya boleh menjadi mekanisme aktivasi sementara dan wajib diganti saat login pertama; lebih aman Admin membuat kata sandi sementara acak dan menyampaikannya secara privat.

### 5.7 Master Kelas dan Tahun Ajaran
- Kelola tingkat/jenjang, nama kelas, wali kelas, kapasitas opsional.
- Kelola tahun ajaran dan semester.
- Tentukan tahun ajaran aktif.
- Simpan riwayat penempatan siswa agar laporan tahun lalu tidak berubah saat siswa naik kelas.

### 5.8 Jadwal Mengajar
- Pilih guru.
- Pilih mata pelajaran.
- Pilih kelas.
- Hari.
- Jam mulai dan selesai.
- Ruang/lokasi (opsional).
- Tanggal berlaku.
- Status aktif.
- Validasi bentrok jadwal guru dan kelas.
- Jadwal ditampilkan pada dashboard guru yang sesuai.

### 5.9 Aturan Jam Absensi
- Jam masuk dan pulang siswa.
- Jam masuk dan pulang guru.
- Hari aktif.
- Batas awal dan akhir jendela absensi.
- Toleransi keterlambatan.
- Pengaturan berbeda menurut kelompok/kelas bila dibutuhkan.
- Kalender libur dan pengecualian.
- Semua aturan menggunakan zona waktu Asia/Jakarta secara konsisten.

### 5.10 Portal Absensi
- Tema gelap.
- Jam dan tanggal realtime.
- Mode standby dan fullscreen.
- Scanner kamera perangkat.
- Dukungan QR scanner USB yang bertindak sebagai keyboard.
- Pilihan kamera depan/belakang.
- Status GPS.
- Pesan hasil scan.
- Voice announcement dengan teks yang dapat dikustomisasi.
- Tombol keluar portal yang meminta password portal.
- Setelah keluar, kembali ke halaman login.

Catatan: browser tidak selalu mengizinkan pemaksaan fullscreen atau mencegah pengguna keluar dari halaman. Fullscreen memerlukan interaksi pengguna dan dapat dibatasi sistem operasi. Password keluar adalah penghalang aplikasi, bukan kiosk lock tingkat perangkat.

### 5.11 Absensi Siswa
- QR siswa terhubung ke token identitas acak.
- Scan untuk masuk atau pulang sesuai mode portal/jadwal.
- Ambil lokasi GPS jika diaktifkan.
- Validasi izin lokasi dan akurasi.
- Cegah duplikasi absensi untuk jenis dan tanggal yang sama.
- Terapkan aturan jam masuk/pulang.
- Catat metode, waktu server, koordinat, akurasi, perangkat, dan hasil validasi.
- Jika GPS tidak tersedia, tampilkan kegagalan atau jalur pengecualian yang hanya dapat diproses petugas berwenang.

### 5.12 Absensi Guru
Metode:
- QR di Portal Absensi; dan/atau
- Absensi mandiri melalui Dashboard Guru dengan selfie.

Validasi:
- Akun guru aktif.
- Waktu absensi sesuai aturan.
- GPS tersedia dan akurasinya memenuhi ambang.
- Koordinat berada dalam radius geofence untuk absensi yang mensyaratkannya.
- Foto selfie berhasil diunggah.
- Tidak ada transaksi duplikat.
- Waktu server menjadi acuan utama.

Simpan bukti selfie dengan akses privat dan masa retensi yang ditentukan sekolah. GPS browser bukan bukti anti-pemalsuan yang mutlak; sistem perlu mencatat akurasi dan indikator anomali, bukan menjanjikan anti-spoofing sempurna.

### 5.13 Lokasi dan Geofencing
- Titik koordinat sekolah.
- Radius dalam meter.
- Ambang akurasi GPS.
- Aktif/nonaktif per jenis pengguna.
- Peta OpenStreetMap.
- Penanda lokasi sekolah dan posisi perangkat.
- Catat hasil perhitungan jarak.
- Peta hanya sebagai visualisasi; keputusan validasi dihitung di server.

### 5.14 QR dan Kartu
- Token QR acak, tidak menampilkan NIS/NIY secara langsung.
- QR unik dan dapat dinonaktifkan/regenerasi.
- Unduh PNG satuan.
- Pilih banyak data dengan checkbox.
- Unduh ZIP massal.
- Cetak kartu portrait.
- Kartu menampilkan logo, nama sekolah, nama, NIS/NIY, kelas/jabatan, dan QR.
- Hindari menampilkan data sensitif berlebihan.

### 5.15 Perizinan Guru
- Guru mengisi jenis izin, tanggal/waktu, alasan, dan lampiran opsional.
- Admin memeriksa kelengkapan dan memberi rekomendasi/verifikasi.
- Kepala Sekolah memberikan keputusan akhir.
- Status: diajukan, diverifikasi admin, menunggu kepala sekolah, disetujui, ditolak, dibatalkan.
- Simpan catatan, aktor, dan timestamp setiap perubahan.
- Izin yang disetujui memengaruhi rekap sesuai kebijakan sekolah.
- Guru dapat melihat status dan catatan yang boleh ditampilkan.

### 5.16 Rekap dan Laporan
Periode:
- Harian.
- Mingguan.
- Bulanan.
- Tahunan.

Dimensi:
- Siswa.
- Guru.
- Kelas.
- Status kehadiran.
- Terlambat.
- Belum masuk/pulang.
- Izin/sakit/alfa.

Ekspor:
- XLSX.
- PDF.
- Cetak.

Laporan harus memakai filter yang terlihat dan mencantumkan waktu pembuatan serta parameter laporan.

### 5.17 Pengaturan
- Identitas sekolah.
- Logo dan icon.
- Favicon dan PWA icon.
- Foto latar login.
- Tema navy/gold/white.
- GPS.
- Geofence.
- Jam absensi.
- Voice over.
- Akun guru.
- Password portal.
- Kebijakan retensi foto.
- Zona waktu.
- Backup/ekspor.
- Pengaturan notifikasi.

### 5.18 Log Aktivitas
Catat:
- Login berhasil/gagal.
- Pembuatan/perubahan/pengarsipan data.
- Koreksi absensi.
- Persetujuan/penolakan izin.
- Perubahan role dan hak akses.
- Perubahan konfigurasi.
- Aksi ekspor dan backup.

Log tidak boleh dapat diedit oleh role biasa.

## 6. Aturan Bisnis

1. Setiap siswa memiliki NIS unik.
2. Setiap guru memiliki NIY/NIP unik.
3. Setiap QR berisi token acak yang dapat dicabut.
4. Satu orang hanya memiliki satu catatan masuk dan satu catatan pulang per tanggal kerja, kecuali kebijakan shift khusus diaktifkan.
5. Waktu server menjadi sumber waktu resmi.
6. Zona waktu default Asia/Jakarta.
7. Absensi terlambat dihitung berdasarkan aturan yang berlaku pada tanggal absensi.
8. Data historis menyimpan snapshot kelas/jabatan dan aturan yang digunakan.
9. Koreksi manual wajib memiliki alasan dan tercatat dalam audit log.
10. Persetujuan izin harus mengikuti urutan Admin lalu Kepala Sekolah.
11. Guru hanya dapat membaca data miliknya.
12. Kepala Sekolah dapat melihat data sekolah sesuai kewenangannya.
13. Semua endpoint memverifikasi role dan izin di server, bukan hanya menyembunyikan menu di frontend.
14. Foto selfie dan data lokasi diperlakukan sebagai data pribadi dengan akses terbatas dan retensi yang ditetapkan.

## 7. Kebutuhan Nonfungsional

- Responsif untuk desktop, tablet, dan ponsel.
- Aksesibilitas dasar: kontras, label, navigasi keyboard.
- Paginasi untuk tabel besar.
- Pencarian dan filter server-side.
- Validasi input di frontend dan server.
- Penanganan error dan loading state.
- Audit log.
- Backup berkala dan prosedur pemulihan teruji.
- Keamanan HTTPS.
- Secret tidak boleh masuk repository atau bundle frontend.
- Uji beban dasar pada proses scan serentak.
- Pemantauan error aplikasi.

## 8. Teknologi dan Arsitektur

- Frontend: React + TypeScript + Vite.
- UI: komponen reusable dan desain navy/gold/white.
- Database: Firebase Cloud Firestore.
- File: Firebase Storage atau penyimpanan objek yang diakses melalui API server.
- Hosting: Vercel.
- Backend: Vercel Serverless Functions.
- Peta: OpenStreetMap melalui library peta seperti Leaflet.
- QR: library generator dan scanner yang kompatibel browser.
- Ekspor: library XLSX dan PDF.
- PWA: manifest, service worker, ikon multiukuran, display standalone.

### Batasan autentikasi yang disepakati
Tidak menggunakan Firebase Authentication dan tidak menggunakan Firebase Admin SDK. Karena Firestore Security Rules tidak menerima identitas login buatan aplikasi sebagai `request.auth`, jangan membuka akses database langsung dari browser.

Semua operasi data sensitif harus melalui API Vercel. API memverifikasi password hash, sesi, role, dan izin. Untuk akses Firestore server-side, gunakan Firestore REST API dengan kredensial service account yang disimpan sebagai environment secret Vercel, tanpa Admin SDK. Kredensial tidak pernah dikirim ke browser. Ini tetap membutuhkan pengelolaan kredensial backend yang sangat hati-hati.

## 9. PWA dan WebAPK

- Manifest dengan `name`, `short_name`, `start_url`, `scope`, `display: standalone`.
- Ikon PNG 192x192 dan 512x512.
- Ikon maskable.
- Service worker untuk aset statis dan fallback offline.
- Jangan menyimpan data absensi sensitif dalam cache offline.
- HTTPS wajib.
- Uji installability pada Android Chrome.

Istilah WebAPK: pada perangkat Android yang didukung, Chrome dapat membungkus PWA terpasang menjadi WebAPK. Website/Vercel tidak menghasilkan atau menjamin paket WebAPK secara langsung. Hasilnya tetap bergantung pada browser dan perangkat.

## 10. Kriteria Penerimaan

- Admin dapat mengelola master data.
- Kepala Sekolah hanya mendapat akses sesuai role.
- Guru hanya melihat dashboard dan data pribadinya.
- QR siswa menghasilkan absensi masuk/pulang yang valid.
- QR guru dan selfie/GPS tervalidasi sesuai kebijakan.
- Absensi di luar radius ditolak atau masuk alur pengecualian.
- Duplikasi absensi dicegah.
- Pengajuan izin mengikuti persetujuan Admin dan Kepala Sekolah.
- Jadwal mengajar muncul sesuai guru.
- Laporan dapat difilter dan diekspor.
- Pengaturan logo, foto latar, suara, GPS, dan jam dapat diubah.
- Aplikasi dapat dipasang sebagai PWA dan berjalan dalam mode standalone pada perangkat yang mendukung.
- Tidak ada secret service account pada source frontend.

## 11. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| GPS tidak akurat/tidak tersedia | Simpan akurasi, kebijakan toleransi, prosedur pengecualian |
| QR disalin | Token acak, pencabutan QR, validasi status |
| Akun dibagikan | Rate limit, sesi, audit, perubahan password |
| Koneksi internet terputus | Tampilkan status offline; jangan mengklaim absensi berhasil sebelum server mengonfirmasi |
| Foto sensitif bocor | Storage privat, URL sementara, retensi, pembatasan akses |
| Tanpa Firebase Auth | Semua data privat lewat API server; jangan membuka Firestore client |
| Browser keluar dari fullscreen | Gunakan mode kiosk perangkat bila dibutuhkan |
| Data ganda | Idempotency key dan constraint logis di server |

## 12. Tahapan Pengembangan

1. Fondasi, desain sistem, konfigurasi Vercel dan Firebase.
2. Login, sesi, role, dan keamanan API.
3. Master data siswa, guru, kelas, tahun ajaran.
4. Jadwal mengajar dan aturan absensi.
5. Portal QR dan absensi siswa.
6. Absensi guru dengan selfie, GPS, geofence.
7. Perizinan dan persetujuan.
8. Dashboard, rekap, laporan, ekspor.
9. QR card, pengaturan, audit log.
10. PWA, pengujian, deployment, dokumentasi.

---
**Akhir PRD**

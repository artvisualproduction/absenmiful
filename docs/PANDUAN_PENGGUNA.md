# Panduan Operasional — Absensi Sekolah (MI Miftahul Ulum Sumberwuluh)

Dokumen ini merupakan panduan resmi bagi **Admin Sekolah**, **Guru**, dan **Operator Portal**, dilengkapi **Prosedur Backup & Pemulihan** serta **Daftar Periksa Penggantian Data Demo Siswa**.

---

## 1. Panduan Admin Sekolah

### A. Pengelolaan Master Data
1. **Tahun Ajaran (`/admin/academic-years`)**: Pastikan selalu ada tepat **satu** tahun ajaran berstatus aktif.
2. **Data Kelas (`/admin/classes`)**: Tetapkan nama kelas, tingkat, tahun ajaran, serta wali kelas.
3. **Mata Pelajaran (`/admin/subjects`)**: Kelola daftar mata pelajaran aktif beserta kode uniknya.
4. **Data Siswa (`/admin/students`)**:
   - Gunakan fitur **Impor Excel** untuk memasukkan data massal. Format kolom **NIS** sebagai **Teks** agar angka nol di depan tidak hilang.
   - Selalu periksa hasil **Pratinjau Validasi** sebelum menekan konfirmasi simpan.
   - Jangan menghapus permanen siswa yang lulus/pindah; gunakan aksi **Arsipkan** agar riwayat kehadiran dan `studentEnrollments` tetap terjaga.
5. **Data Guru (`/admin/teachers`)**:
   - Tambahkan profil guru dengan NIY/NIP unik dan tautkan ke akun login.
   - Bila guru lupa kata sandi, gunakan menu **Pengguna & Hak Akses (`/admin/users`) → Reset Sandi**, wajib mengisi alasan untuk log audit, lalu serahkan kata sandi sementara secara privat.

### B. Jadwal, Aturan Jam & Geofencing
1. **Jadwal Mengajar (`/admin/schedules`)**: Tambah jadwal pada tampilan tabel atau kalender mingguan. Sistem otomatis menolak jadwal bentrok untuk guru atau kelas yang sama.
2. **Aturan Jam Absensi (`/admin/attendance-rules`)**: Atur jendela Masuk, batas Terlambat, batas akhir Masuk, dan jendela Pulang secara terpisah untuk Siswa dan Guru (`Asia/Jakarta`). Simpan sebagai versi baru dengan tanggal berlaku agar aturan historis tidak tertimpa.
3. **Lokasi & Geofencing (`/admin/geofencing`)**: Tetapkan koordinat gedung MI Miftahul Ulum Sumberwuluh, radius meter yang diizinkan, serta ambang akurasi GPS maksimum.

### C. Kartu QR, Perizinan, Laporan & Pengaturan
1. **Kartu & QR Code (`/admin/qr-cards`)**:
   - Klik **Unduh PNG** untuk satuan, atau centang beberapa baris lalu pilih **Unduh ZIP Massal** / **Cetak Kartu Portrait**.
   - Jika kartu hilang, segera klik **Cabut** atau terbitkan ulang (penerbitan ulang otomatis menonaktifkan token QR lama).
2. **Verifikasi Perizinan (`/admin/permissions`)**: Periksa kelengkapan pengajuan izin guru, lalu pilih **Teruskan ke Kepala Sekolah** atau **Kembalikan untuk Perbaikan**. Kepala Sekolah hanya dapat memutus izin yang telah diverifikasi Admin.
3. **Koreksi Kehadiran (`/admin/attendance`)**: Bila terjadi kendala GPS atau pemindaian, lakukan koreksi manual dengan **alasan wajib** (otomatis tercatat di Log Aktivitas).
4. **Pengaturan (`/admin/settings`)**: Perbarui identitas lembaga, logo, latar login, ikon PWA, tema warna, template suara portal, retensi foto, serta kata sandi keluar portal.

---

## 2. Panduan Guru

1. **Login Pertama Kali**: Masuk menggunakan username dan kata sandi sementara dari Admin. Sistem akan mengarahkan langsung ke halaman **Ganti Kata Sandi**.
2. **Absensi Mandiri (`/teacher/attendance`)**:
   - Pastikan berada di dalam radius sekolah dan izin **Kamera** serta **Lokasi (GPS)** aktif di browser.
   - Pilih **Absen Masuk** atau **Absen Pulang**, ambil foto selfie dengan kamera depan, periksa pratinjau, lalu klik **Kirim Absensi**.
   - Jika GPS bermasalah di perangkat, hubungi Admin Sekolah untuk pencatatan pengecualian manual yang teraudit.
3. **Jadwal Mengajar (`/teacher/schedules`)**: Pantau jadwal mengajar hari ini dan mingguan Anda.
4. **Pengajuan Izin (`/teacher/permissions`)**:
   - Ajukan izin sakit, dinas, atau keperluan pribadi beserta rentang tanggal, alasan, dan lampiran opsional (JPG/PNG/PDF).
   - Pantau status alur: `Diajukan -> Diverifikasi Admin -> Disetujui/Ditolak Kepala Sekolah`. Anda dapat membatalkan pengajuan selama belum diputus.
5. **Riwayat Kehadiran (`/teacher/history`)**: Periksa catatan jam masuk, jam pulang, dan status keterlambatan pribadi Anda.

---

## 3. Panduan Operator Portal Absensi (`/portal`)

1. **Membuka Portal**: Masuk sebagai Admin/Operator, lalu klik menu **Portal Absensi** (atau langsung dari tombol di halaman Login).
2. **Mode Layar Penuh**: Klik tombol **Layar Penuh (Fullscreen)** agar layar tampak rapi saat digunakan di meja piket.
   > *Catatan keamanan*: Mode layar penuh browser bukan kunci kios tingkat sistem operasi (device kiosk lock). Gunakan fitur pin layar perangkat Android/Windows bila diperlukan.
3. **Memilih Mode & Perangkat Pindai**:
   - Pilih mode **Otomatis**, **Masuk**, atau **Pulang**.
   - Gunakan **Kamera Depan/Belakang** atau hubungkan **USB Barcode/QR Scanner** (mode keyboard; cukup pindai kartu dan scanner otomatis mengirim Enter).
4. **Pengumuman Suara**: Aktifkan tombol suara agar nama siswa/guru yang berhasil absen diumumkan otomatis menggunakan template suara dari Pengaturan.
5. **Absensi Guru via Portal**: Saat kartu QR guru dipindai, portal meminta langkah verifikasi selfie singkat sebelum mencatat kehadiran.
6. **Keluar dari Portal**: Klik **Keluar Portal**, masukkan **Kata Sandi Keluar Portal** yang ditetapkan di Pengaturan, lalu sistem kembali ke halaman Login.
7. **Saat Koneksi Terputus**: Portal menampilkan indikator **Offline**. Jangan melakukan pemindaian saat offline karena waktu absensi harus tervalidasi secara real-time oleh server.

---

## 4. Prosedur Backup & Pemulihan (Backup & Recovery)

### A. Backup Berkala dari Aplikasi (Disarankan Mingguan)
1. Masuk sebagai **Admin / Super Admin**.
2. Buka **Pengaturan (`/admin/settings`)** → gulir ke bagian **Backup & Ekspor Data Sistem**.
3. Klik **Unduh Backup JSON**. File `backup-absensi-sekolah-YYYY-MM-DD.json` berisi seluruh master data, jadwal, aturan, catatan kehadiran, perizinan, dan log audit (tanpa hash kata sandi maupun token rahasia).
4. Simpan arsip JSON ke penyimpanan terenkripsi lembaga (Google Drive resmi madrasah / media eksternal terpisah).

### B. Backup Terkelola Cloud Firestore (Disarankan Harian di Produksi)
Aktifkan **Firestore Scheduled Backups / Export** menuju Cloud Storage Bucket privat menggunakan `gcloud firestore export gs://<bucket-backup-privat>` pada project Google Cloud.

### C. Prosedur Pemulihan (Recovery)
1. **Pemulihan Snapshot Cloud Firestore**: Jalankan `gcloud firestore import gs://<bucket-backup-privat>/<prefix-tanggal>` ke database tujuan, lalu verifikasi jumlah dokumen pada koleksi inti (`users`, `students`, `teachers`, `attendanceRecords`).
2. **Pemulihan dari Backup JSON Aplikasi**: Impor ulang master data (siswa/guru) menggunakan fitur Impor Excel atau skrip migrasi sisi server, lalu terbitkan ulang kartu QR jika diperlukan.
3. **Verifikasi Pasca-Pemulihan**: Uji login akun inti, cek integritas rekap bulan berjalan, dan catat kejadian pemulihan pada berita acara operasional.

---

## 5. Daftar Periksa Penggantian Data Demo Siswa dengan Data Resmi

Sebelum sistem digunakan secara resmi untuk operasional madrasah, pastikan seluruh langkah berikut diselesaikan:

- [ ] **Verifikasi Data Guru & Kepala Sekolah**: Pastikan seluruh nama, NIY/NIP, jabatan, dan akun guru resmi telah diverifikasi dan seluruh guru telah mengganti kata sandi sementara.
- [ ] **Arsipkan Siswa Demo**: Buka **Data Siswa (`/admin/students`)**, gunakan filter atau identifikasi baris berlencana **`DEMO`**, centang seluruh siswa demo, lalu klik **Arsipkan Massal** (atau hapus dari database staging sebelum masuk produksi).
- [ ] **Siapkan File Excel Siswa Resmi**: Pastikan kolom wajib (`NIS`, `Nama Lengkap`, `Kelas`, `Jenis Kelamin`, `Status`) terisi benar dan kolom **NIS diformat sebagai Teks** agar angka nol di depan tidak hilang.
- [ ] **Impor Siswa Resmi & Cek Pratinjau**: Unggah melalui **Impor Excel**, pastikan `0 baris error`, lalu klik **Konfirmasi Simpan**.
- [ ] **Verifikasi Banner Demo Hilang**: Muat ulang halaman **Data Siswa** dan **Dashboard Admin**; pastikan banner peringatan data fiktif dan lencana `DEMO` tidak lagi muncul pada data siswa aktif.
- [ ] **Terbitkan Kartu QR Resmi**: Buka **Kartu & QR Code (`/admin/qr-cards`)**, pilih seluruh siswa resmi per kelas, unduh arsip **ZIP Massal** atau **Cetak Kartu Portrait**, lalu bagikan ke siswa.
- [ ] **Uji Coba Pemindaian 1 Kartu Per Kelas**: Lakukan uji pindai di `/portal`, verifikasi nama tampil benar, lalu arsipkan/koreksi data uji jika perlu sebelum hari efektif dimulai.
- [ ] **Perbarui Kata Sandi Keluar Portal & Identitas Lembaga**: Pastikan alamat, logo resmi, foto gedung, radius geofencing, dan kata sandi keluar portal sudah menggunakan nilai produksi final.

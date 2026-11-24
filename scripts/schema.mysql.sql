-- ==========================================================
-- Skema Database MySQL untuk Aplikasi Absensi MI Miftahul Ulum
-- Kompatibel dengan MySQL 5.7+ / 8.0+ dan MariaDB (Laragon / XAMPP)
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `absen_miful` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `absen_miful`;

-- Tabel utama penyimpanan koleksi dokumen
CREATE TABLE IF NOT EXISTS `app_collections` (
  `collection` VARCHAR(64) NOT NULL COMMENT 'Nama koleksi (students, teachers, attendanceRecords, dll)',
  `id` VARCHAR(128) NOT NULL COMMENT 'Primary key dokumen unik',
  `data` LONGTEXT NOT NULL COMMENT 'Data isi dokumen dalam format JSON',
  `created_at` VARCHAR(64) NULL COMMENT 'Waktu pembuatan ISO-8601 UTC',
  `updated_at` VARCHAR(64) NULL COMMENT 'Waktu pembaruan terakhir ISO-8601 UTC',
  PRIMARY KEY (`collection`, `id`),
  INDEX `idx_coll_created` (`collection`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

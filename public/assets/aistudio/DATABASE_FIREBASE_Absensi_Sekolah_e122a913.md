# DESAIN DATABASE FIREBASE
# ABSENSI SEKOLAH — MI MIFTAHUL ULUM SUMBERWULUH

**Database:** Cloud Firestore  
**Pola:** Satu sekolah, dokumen memiliki referensi ID, akses melalui API Vercel.

---

## 1. Prinsip Database

- Gunakan ID dokumen acak/Firestore auto ID.
- NIS dan NIY/NIP diberi unique check di server.
- Simpan tanggal sebagai timestamp Firestore.
- Simpan zona waktu bisnis sebagai `Asia/Jakarta`.
- Simpan `createdAt`, `updatedAt`, dan `createdBy` pada data yang relevan.
- Jangan menyimpan password plaintext.
- Jangan menyimpan NIS/NIY/NIP langsung di QR; gunakan token acak.
- Semua query privat dilakukan dari server API.
- Hindari menyimpan foto binary dalam dokumen Firestore; simpan file di Storage dan metadata/path di Firestore.

## 2. Koleksi Utama

```text
appSettings/{settingsId}
users/{userId}
students/{studentId}
teachers/{teacherId}
classes/{classId}
subjects/{subjectId}
academicYears/{academicYearId}
studentEnrollments/{enrollmentId}
teachingSchedules/{scheduleId}
attendanceRules/{ruleId}
schoolLocations/{locationId}
qrTokens/{qrTokenId}
attendanceRecords/{attendanceId}
teacherPermissions/{permissionId}
fileMetadata/{fileId}
userSessions/{sessionId}
activityLogs/{logId}
holidays/{holidayId}
```

## 3. Skema Dokumen

### 3.1 `appSettings/{settingsId}`

```json
{
  "appName": "Absensi Sekolah",
  "schoolName": "MI Miftahul Ulum Sumberwuluh",
  "schoolAddress": "",
  "schoolBio": "",
  "logoPath": "branding/logo.png",
  "faviconPath": "branding/favicon.ico",
  "pwaIcon192Path": "branding/icon-192.png",
  "pwaIcon512Path": "branding/icon-512.png",
  "loginBackgroundPath": "branding/login-background.jpg",
  "theme": {
    "primary": "#10264D",
    "accent": "#C69B3C",
    "background": "#FFFFFF"
  },
  "timezone": "Asia/Jakarta",
  "gpsEnabledForStudents": true,
  "gpsEnabledForTeachers": true,
  "teacherSelfServiceEnabled": true,
  "portalExitPasswordHash": "<hash>",
  "voiceTemplates": {
    "success": "ABSEN BERHASIL",
    "failure": "ABSEN GAGAL",
    "namedSuccess": "ABSEN ATAS NAMA {name} BERHASIL"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 3.2 `users/{userId}`

```json
{
  "username": "operator",
  "normalizedUsername": "operator",
  "passwordHash": "<argon2id-or-bcrypt-hash>",
  "role": "ADMIN",
  "linkedTeacherId": null,
  "isActive": true,
  "mustChangePassword": false,
  "lastLoginAt": "timestamp",
  "failedLoginCount": 0,
  "lockedUntil": null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Role enum: `SUPER_ADMIN`, `ADMIN`, `PRINCIPAL`, `OPERATOR`, `TEACHER`.

Jangan mengembalikan `passwordHash` melalui API. Username harus unik melalui transaksi/strategi unique index di server, misalnya koleksi `uniqueUsernames/{normalizedUsername}`.

### 3.3 `students/{studentId}`

```json
{
  "nis": "00012345",
  "fullName": "Nama Siswa",
  "classId": "class_id",
  "photoPath": null,
  "gender": null,
  "status": "ACTIVE",
  "qrTokenId": "qr_token_id",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 3.4 `teachers/{teacherId}`

```json
{
  "niyNip": "19870001",
  "fullName": "Nama Guru",
  "position": "Guru Kelas",
  "photoPath": null,
  "userId": "user_id",
  "qrTokenId": "qr_token_id",
  "status": "ACTIVE",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 3.5 `classes/{classId}`

```json
{
  "name": "1A",
  "gradeLevel": "1",
  "homeroomTeacherId": "teacher_id",
  "academicYearId": "academic_year_id",
  "isActive": true,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 3.6 `subjects/{subjectId}`

```json
{
  "name": "Matematika",
  "code": "MTK",
  "isActive": true
}
```

### 3.7 `academicYears/{academicYearId}`

```json
{
  "label": "2026/2027",
  "startDate": "timestamp",
  "endDate": "timestamp",
  "isActive": true
}
```

Hanya satu tahun ajaran yang menjadi aktif, kecuali sistem kelak mendukung periode paralel.

### 3.8 `studentEnrollments/{enrollmentId}`

Menyimpan riwayat penempatan siswa per tahun ajaran agar laporan lama tidak berubah.

```json
{
  "studentId": "student_id",
  "classId": "class_id",
  "academicYearId": "academic_year_id",
  "startDate": "timestamp",
  "endDate": null,
  "status": "ACTIVE"
}
```

### 3.9 `teachingSchedules/{scheduleId}`

```json
{
  "teacherId": "teacher_id",
  "subjectId": "subject_id",
  "classId": "class_id",
  "dayOfWeek": 1,
  "startTime": "07:00",
  "endTime": "08:10",
  "room": null,
  "effectiveFrom": "timestamp",
  "effectiveUntil": null,
  "isActive": true,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

`dayOfWeek`: 1=Senin sampai 7=Minggu.

### 3.10 `attendanceRules/{ruleId}`

```json
{
  "audience": "STUDENT",
  "classIds": [],
  "daysOfWeek": [1, 2, 3, 4, 5, 6],
  "checkInStart": "06:00",
  "checkInDeadline": "07:15",
  "lateAfter": "07:00",
  "checkOutStart": "12:00",
  "checkOutDeadline": "16:00",
  "timezone": "Asia/Jakarta",
  "gpsRequired": true,
  "geofenceRequired": false,
  "isActive": true
}
```

Aturan guru dapat menggunakan `audience: "TEACHER"` dan pengaturan berbeda. Jika aturan memiliki beberapa versi, jangan menimpa aturan historis; buat versi baru dengan tanggal berlaku.

### 3.11 `schoolLocations/{locationId}`

```json
{
  "name": "Kampus Utama",
  "latitude": -8.0,
  "longitude": 113.0,
  "radiusMeters": 100,
  "maxGpsAccuracyMeters": 50,
  "isActive": true,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Koordinat di atas hanya contoh format, bukan koordinat sekolah sebenarnya.

### 3.12 `qrTokens/{qrTokenId}`

```json
{
  "tokenHash": "<hash-of-random-token>",
  "ownerType": "STUDENT",
  "ownerId": "student_id",
  "isActive": true,
  "issuedAt": "timestamp",
  "revokedAt": null
}
```

QR berisi token acak berentropi tinggi. Simpan hash token di database dan lakukan pencarian berdasarkan hash. Token dapat dicabut dan diterbitkan ulang.

### 3.13 `attendanceRecords/{attendanceId}`

```json
{
  "personType": "STUDENT",
  "personId": "student_id",
  "personNameSnapshot": "Nama Siswa",
  "nisSnapshot": "00012345",
  "classIdSnapshot": "class_id",
  "classNameSnapshot": "1A",
  "attendanceDate": "2026-11-19",
  "eventType": "CHECK_IN",
  "status": "PRESENT",
  "method": "QR",
  "serverTimestamp": "timestamp",
  "clientTimestamp": null,
  "latitude": -8.0,
  "longitude": 113.0,
  "gpsAccuracyMeters": 18,
  "distanceFromSchoolMeters": 32,
  "geofencePassed": true,
  "selfiePath": null,
  "deviceInfo": "browser/device summary",
  "idempotencyKey": "random-unique-key",
  "corrected": false,
  "correctionReason": null,
  "createdAt": "timestamp"
}
```

Guru:
- `personType: "TEACHER"`
- `method: "QR_SELFIE"` atau `"SELF_SERVICE_SELFIE"`
- `selfiePath` mengarah ke file privat.

Status yang disarankan: `PRESENT`, `LATE`, `EXCUSED`, `SICK`, `ABSENT`, `REJECTED`.

Gunakan transaksi server untuk mencegah dua request bersamaan membuat absensi masuk yang sama.

### 3.14 `teacherPermissions/{permissionId}`

```json
{
  "teacherId": "teacher_id",
  "teacherNameSnapshot": "Nama Guru",
  "leaveType": "SICK",
  "startAt": "timestamp",
  "endAt": "timestamp",
  "reason": "Alasan pengajuan",
  "attachmentPaths": [],
  "status": "SUBMITTED",
  "adminReview": {
    "reviewerId": null,
    "decision": null,
    "note": null,
    "reviewedAt": null
  },
  "principalDecision": {
    "reviewerId": null,
    "decision": null,
    "note": null,
    "decidedAt": null
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 3.15 `userSessions/{sessionId}`

```json
{
  "userId": "user_id",
  "sessionTokenHash": "<hash>",
  "createdAt": "timestamp",
  "expiresAt": "timestamp",
  "revokedAt": null,
  "lastSeenAt": "timestamp"
}
```

Cookie berisi token acak; database menyimpan hash token. Gunakan cookie HttpOnly, Secure, SameSite dan proteksi CSRF sesuai pola API.

### 3.16 `fileMetadata/{fileId}`

```json
{
  "ownerType": "TEACHER",
  "ownerId": "teacher_id",
  "category": "ATTENDANCE_SELFIE",
  "storagePath": "private/attendance/2026/11/file.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 123456,
  "createdAt": "timestamp",
  "retentionUntil": "timestamp"
}
```

### 3.17 `activityLogs/{logId}`

```json
{
  "actorUserId": "user_id",
  "actorRole": "ADMIN",
  "action": "ATTENDANCE_CORRECTED",
  "entityType": "ATTENDANCE",
  "entityId": "attendance_id",
  "before": {},
  "after": {},
  "reason": "Alasan koreksi",
  "ipHash": "<optional-hash>",
  "createdAt": "timestamp"
}
```

Log bersifat append-only melalui API. Batasi data sensitif yang direkam pada before/after.

### 3.18 `holidays/{holidayId}`

```json
{
  "date": "2026-12-25",
  "name": "Libur",
  "scope": "SCHOOL",
  "isActive": true
}
```

## 4. Indeks Firestore yang Diperkirakan

Buat composite index berdasarkan query aktual, antara lain:
- `attendanceRecords`: `attendanceDate + personType + classIdSnapshot`
- `attendanceRecords`: `attendanceDate + personType + status`
- `attendanceRecords`: `personId + attendanceDate`
- `teachingSchedules`: `teacherId + dayOfWeek + isActive`
- `teacherPermissions`: `status + createdAt`
- `students`: `classId + status`
- `activityLogs`: `actorUserId + createdAt`

Firestore akan memberikan tautan pembuatan indeks jika query memerlukan indeks tambahan. Jangan membuat semua indeks secara membabi buta.

## 5. Keamanan Database

Karena tidak memakai Firebase Authentication:
- Jangan mengakses data privat langsung dari browser.
- Firestore Rules harus menolak akses client yang tidak terautentikasi (`request.auth == null`).
- API Vercel memverifikasi sesi dan role.
- API mengakses Firestore REST API dengan service account yang disimpan sebagai secret server.
- Gunakan service account dengan hak minimum yang memungkinkan.
- Pisahkan credential development dan production.
- Rotasi credential jika terindikasi bocor.
- Jangan pernah menaruh private key pada `VITE_*` environment variable.
- Validasi setiap ID agar mencegah IDOR.
- Batasi ukuran, tipe MIME, dan jumlah file upload.

**Catatan:** penggunaan service account melalui REST API bukan Firebase Admin SDK, tetapi tetap merupakan akses backend berprivilege. Lindungi endpoint dan secret dengan serius.

## 6. Backup dan Retensi

- Backup terjadwal sesuai kemampuan dan biaya proyek.
- Uji pemulihan backup.
- Tentukan retensi selfie dan lampiran izin bersama pihak sekolah.
- Sediakan proses penghapusan/arsip sesuai kebijakan.
- Jangan menghapus log audit yang diperlukan untuk pertanggungjawaban.

---
**Akhir Desain Database**

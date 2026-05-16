# Mesin Kasir Starducks

Aplikasi POS kasir yang dapat dideploy ke Vercel dengan backend Neon DB untuk menyimpan order, otentikasi, dan user management.

## Struktur
- `index.html` – halaman frontend
- `app.js` – logika frontend dan auth
- `Menu.js` – data menu statis
- `styles.css` – gaya tampilan
- `api/orders.js` – serverless API untuk order ke Neon
- `api/auth.js` – login endpoint JWT
- `api/users.js` – endpoint manajemen password
- `api/_auth-utils.js` – helper Neon + auth
- `package.json` – dependency Vercel/Neon/JWT

## Langkah siapkan Neon + Vercel

### 1. Buat database Neon
1. Buka https://neon.tech/ dan daftar/login.
2. Buat project baru.
3. Buat database baru di project tersebut.
4. Salin connection string (database URL) dari Neon.

### 2. Siapkan environment variables di Vercel
1. Buka dashboard Vercel.
2. Pilih project Anda atau buat project baru dari repository GitHub.
3. Buka `Settings > Environment Variables`.
4. Tambahkan variabel berikut:
   - `NEON_DATABASE_URL` = connection string Neon Anda
   - `JWT_SECRET` = kata rahasia untuk membuat token JWT (contoh: `super-secret-key`)
   - `DEFAULT_ADMIN_PASSWORD` = password awal admin jika database kosong (opsional, default `admin123`)

> Gunakan nilai yang kuat untuk `JWT_SECRET`.

### 3. Pastikan `package.json` dan `api` berada di root
Project ini sudah dikonfigurasi untuk Vercel dengan `type: commonjs`.

## Deploy ke Vercel
1. Push repository ke GitHub atau Git provider lain:
   - `git add .`
   - `git commit -m "Deploy setup"
`
   - `git push origin main`
2. Hubungkan repository ke Vercel.
3. Jalankan deploy di Vercel.
4. Vercel akan otomatis menggunakan `package.json` dari root.

## Verifikasi setelah deploy
1. Buka URL aplikasi yang diberikan Vercel.
2. Halaman login akan muncul dulu.
3. Login pakai username `admin` dan password `admin123` (atau `DEFAULT_ADMIN_PASSWORD` jika Anda set).
4. Jika login berhasil, aplikasi akan membuka POS.

## Koneksi database Neon
- `api/orders.js` sekarang menggunakan `NEON_DATABASE_URL` untuk menyimpan order.
- `api/auth.js` dan `api/users.js` menggunakan tabel `users` di Neon.
- Tabel `orders` dan `users` dibuat otomatis saat endpoint pertama kali dipanggil.

## Endpoint API penting
- `POST /api/auth` — login, mengembalikan JWT
- `GET /api/orders` — baca order (dilindungi JWT)
- `POST /api/orders` — simpan order baru (dilindungi JWT)
- `GET /api/users` — daftar user (admin saja)
- `PUT /api/users` — ganti password sendiri / reset user

## Catatan tambahan
- Setelah deploy, buka halaman dan login untuk memicu pembuatan tabel Neon otomatis.
- Pastikan `JWT_SECRET` di Vercel sama persis dengan yang Anda gunakan di sistem produksi.
- Untuk keamanan, ganti password admin setelah login pertama.

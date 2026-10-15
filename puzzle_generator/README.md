# Puzzle Studio — Generator & Jigsaw

Aplikasi lokal Python dengan UI HTML, CSS, dan JavaScript. Pemrosesan citra dilakukan oleh Python menggunakan Pillow. Server menggunakan pustaka standar Python sehingga tidak membutuhkan Flask, Node.js, atau internet saat digunakan setelah dependensi terpasang.

## Menjalankan di Windows / VS Code
1. Instal Python 3.10 atau lebih baru. Saat instalasi, centang **Add Python to PATH**.
2. Ekstrak ZIP ini. Buka folder `puzzle_generator` di VS Code.
3. Buka Terminal → New Terminal, lalu jalankan:

   ```sh
   python -m pip install -r requirements.txt
   python app.py
   ```

4. Browser terbuka di **http://127.0.0.1:8000**. Jika tidak terbuka otomatis, masukkan alamat itu sendiri.
5. Pilih gambar → klik **Buat puzzle** → **Unduh hasil ZIP**.
6. Hentikan server menggunakan **Ctrl+C** di terminal.

Jika perintah `python` tidak ditemukan di Windows, gunakan `py` sebagai penggantinya. Setelah dependensi terpasang, bisa juga klik dua kali `JALANKAN_WINDOWS.bat`. HTML harus dibuka melalui alamat server, bukan dengan klik langsung file HTML. Jika port 8000 sedang digunakan, hentikan aplikasi lain yang memakai port tersebut atau ganti angka port di bagian bawah `app.py`.

## Arti grid 5×5 dan puzzle 3×3
M adalah jumlah baris/kolom **potongan tengah**. Grid seluruh gambar = (M+2)×(M+2), karena ada satu lapis pinggir sebagai bingkai.

Untuk M = 3:
- Seluruh gambar: 5×5 = 25 sel.
- Bingkai: 16 sel pinggir dipertahankan menyatu dalam satu gambar.
- Puzzle: 9 sel tengah dipotong menjadi 9 file PNG.
- `frame.png`: ukuran sama dengan gambar asli, bagian pinggir tetap bergambar, tengah kosong dengan garis kontur.

Grid tetap 3×3 dengan bingkai 5×5. Bagian pinggir tidak diekspor menjadi potongan terpisah.

## Isi ZIP hasil
- `frame.png`: satu bingkai.
- `pieces/piece_01_01.png`, dst.: M² potongan, urut baris dan kolom mulai dari 1.
- `metadata.json`: ukuran, koordinat asal, posisi, dan rotasi setiap potongan.

Tanpa rotasi, potongan bisa ditempel langsung pada koordinat `box` untuk membentuk gambar asli bersama pinggir bingkai. Rotasi opsional memakai arah berlawanan jarum jam; untuk mengembalikan gunakan negatif nilai `rotation_ccw`. Potongan persegi panjang yang diputar 90°/270° akan bertukar lebar dan tingginya.

## Alur program
1. Browser membaca gambar dan mengirim data ke `/api/generate`.
2. Python membaca citra RGB/grayscale, menyesuaikan orientasi EXIF, dan mempertahankan dimensi tanpa resize.
3. Batas sel dihitung dengan `i * ukuran // (M+2)`, sehingga dimensi yang tidak habis dibagi tetap tercakup seluruhnya. Ukuran antarpotongan bisa berbeda satu piksel.
4. Area tengah pada salinan gambar diisi warna netral dan diberi kontur.
5. Potongan tengah disimpan sebagai PNG; ZIP disusun di memori dan dikirim ke browser.

Input maksimal 15 MB dan 25 juta piksel. Citra transparan dikonversi menjadi RGB; animasi/multipage hanya memakai frame pertama. Server hanya mendengarkan komputer lokal (127.0.0.1). File masukan dan hasil tidak disimpan otomatis di server; gunakan unduhan browser untuk menyimpan hasil. Mode Main adalah permainan jigsaw interaktif; aplikasi tidak menyertakan solver otomatis.

## Susunan kode
- `app.py`: server HTTP, validasi, pemotongan, bingkai, ZIP.
- `static/index.html`: struktur UI.
- `static/fallback.css`: tampilan responsif dan permainan.
- `static/app.js`: unggah, pratinjau, API, unduh.
- `requirements.txt`: dependensi.

## Contoh pembagian 3 anggota
1. Pemrosesan citra dan pembuatan bingkai.
2. UI HTML/CSS dan interaksi JavaScript.
3. Integrasi server, pengujian hasil, dan dokumentasi.

## Bermain puzzle

1. Unggah gambar, lalu klik **Buat puzzle**. Grid tengah selalu 3×3.
2. Tab **Main** terbuka dengan kepingan jigsaw acak dan bingkai gambar.
3. Geser kepingan ke tempatnya, atau klik/sentuh kepingan lalu klik/sentuh tempat di papan. Posisi atau rotasi yang salah tidak akan terkunci.
4. Rotasi acak selalu aktif. Pilih kepingan lalu gunakan **Putar kiri/kanan** atau tombol **Q/E** ketika fokus berada di area permainan.
5. **Lihat gambar** menampilkan petunjuk; **Acak** mengacak kepingan tersisa; **Ulang** mengulang permainan.
6. Progres tetap tersimpan saat berpindah tab. Mengubah gambar membatalkan puzzle lama.

Bentuk jigsaw dibuat di browser dari citra hasil generator. Ekspor ZIP tetap berisi bingkai dan potongan persegi PNG beserta metadata. Tekstur permainan dibatasi 1200 px untuk efisiensi; ekspor mempertahankan resolusi asli. Tailwind Play CDN memiliki stylesheet cadangan lokal saat koneksi tidak tersedia.


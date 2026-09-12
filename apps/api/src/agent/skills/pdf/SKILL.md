---
name: pdf
description: Membaca PDF melalui ekstraksi teks atau vision per halaman, dengan pelaporan batas cuplikan dan halaman yang sudah diperiksa.
---

# Membaca PDF

Gunakan `general:read_attachment` untuk PDF di chat. Jangan mengimpor hanya untuk membaca. Untuk PDF yang sudah ada di workspace, gunakan `general:read_file` sesuai skema tool yang tersedia.

- Ekstraksi teks memakai `unpdf` melalui `services/file-extract/pdf.ts`. Cuplikan dibatasi sekitar 40.000 karakter dan maksimal 100 halaman. Teks disertai penanda halaman; urutan ekstraksi tidak selalu menggambarkan tata letak visual.
- Pembaca mengembalikan potongan teks maksimal 6.000 karakter. Ikuti `nextOffset` bila masih ada; `nextOffset: null` hanya berarti cuplikan itu habis, bukan bukti bahwa seluruh PDF panjang telah terbaca. Perhatikan penanda cuplikan terpotong.
- Jika pembaca vision tersedia, PDF dirender menjadi PNG per halaman melalui `pdf-pages.ts`, lalu dikirim ke `describeImage`. Gunakan `page` mulai dari 1 dan ikuti `nextPage`; `totalPages` menunjukkan jumlah halaman dokumen.
- PDF hasil pindai, diagram, atau tabel yang tata letaknya penting memerlukan pembacaan visual. Jangan menganggap ekstraksi teks kosong sebagai dokumen kosong.
- Tanpa pembaca vision, jalur ekstraksi teks tidak memilih halaman lewat `page`. Jika cuplikan tidak mencukupi atau render/vision gagal, jelaskan batas pembacaan dan kebutuhan provider vision; jangan mengulang halaman yang sama atau mengarang bagian yang hilang.

Jawab dengan temuan yang relevan dan nomor halaman sebagai bukti. Pertahankan angka, unit, serta hubungan dalam tabel; tandai bagian yang tidak terbaca dan bedakan teks dokumen dari interpretasi.

Kapabilitas PDF saat ini hanya membaca. Belum ada tool khusus untuk membuat atau mengedit PDF; jangan mengklaim telah menghasilkan atau mengubah PDF dengan tool pembacaan.

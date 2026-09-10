# AGENTS.md — Aturan main untuk AI yang nulis kode di repo ini

## 1. Batas 150 baris per file (WAJIB)

- Setiap file sumber **maksimal 150 baris** (dihitung tanpa baris kosong berlebih).
- Berlaku untuk: `apps/*/src`, `packages/*/src`, `tooling/*`, `bin/*`.
- **Dikecualikan**: `*.test.ts`, `*.d.ts`, dan `apps/web/src/components/ui/*`
  (kode vendored shadcn — jangan refactor kecuali perlu).
- Kalau perubahan membuat file lewat 150 baris: **pecah dulu, baru lanjut**.
  Satu file = satu tanggung jawab (komponen, hook, service, atau route).

## 2. Cara memecah file

- Komponen React besar → ekstrak sub-komponen ke file `NamaBagian.tsx`
  di folder yang sama (contoh: `ManageTable.tsx`, `PopularCards.tsx`).
- Konstanta + tipe → `nama-fitur-data.ts` / `types.ts`.
- Logic stateful → custom hook `use-nama.ts`.
- Handler API panjang → pisah per route/service (`routes/chat/runs-*.ts`).
- Fungsi murni (skor, normalisasi, validasi) → modul `*-utils.ts` + unit test.
- Jangan bikin file < 15 baris hanya demi formalitas — gabungkan yang se-topik.

## 3. Sebelum selesai kerja

Wajib hijau semua (di root):

```sh
bun run typecheck
bun run lint
bun run --cwd apps/api test
bun run build
```

## 4. Cek batas baris

```powershell
Get-ChildItem -Recurse -Include *.ts,*.tsx -Path apps,packages,tooling,bin -Exclude *.test.ts,*.d.ts |
  Where-Object { $_.FullName -notmatch "node_modules|dist|components.ui" } |
  ForEach-Object { $c = (Get-Content $_.FullName | Measure-Object -Line).Lines; if ($c -gt 150) { "$c $($_.FullName)" } }
```

Output harus kosong. Kalau ada, refactor sebelum commit.

## 5. Gaya kode repo ini

- Bahasa UI dan pesan error: **Bahasa Indonesia**.
- Pesan commit ringkas. Jangan commit rahasia (`.env` sudah di `.gitignore`).
- Backend: Hono + Bun, validasi Zod di route, kredensial via `KeyRing`
  (AES-256-GCM) — tidak pernah kembalikan secret ke browser.
- Izin connector dicek tiap eksekusi (`assertAllowed`), bukan sekali di awal.
- Jangan tambah dependensi tanpa alasan kuat.

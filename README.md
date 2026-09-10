# YATT Agent

AI agent lokal yang serba bisa, berjalan dengan Bun. Satu akun lokal dibuat otomatis (seed) dan mengakses satu workspace melalui session cookie. Web dan API berjalan bersama dalam satu proses; data tersimpan sebagai file lokal di komputer Anda.

YATT Agent bukan lagi sekadar agent MikroTik — MikroTik kini hanya salah satu connector. Agent bisa coding, mengelola file, riset web, bekerja dengan Google Drive / Gmail / Telegram, memonitor jaringan, dan mengelola router RouterOS dengan proteksi Safe Mode — semuanya dari satu chat.

## Fitur

- **Chat AI general** dengan tool calling: tulis kode, olah file, cari informasi, atau beri tugas aplikasi.
- **Connectors**: MikroTik Server, Coding & Files, Google Account (Drive+Gmail+Calendar satu login), Telegram — masing-masing dengan izin sendiri.
- **MikroTik**: register router, uji SSH sebelum kredensial disimpan (terenkripsi key lokal), connect/reconnect lewat chat, network map, monitoring, backup & diff, terminal RouterOS.
- **Network Map**: peta topologi jaringan (interface, bridge, VLAN, ARP) dengan export PNG/PDF/SVG.
- **Monitoring Dashboard**: resource router, interface, dan alert ambang.
- **Backup & Diff**: snapshot `/export` ter-redaksi + diff antar backup atau live.
- **Terminal**: sesi terminal RouterOS dengan klasifikasi perintah dan safe guard.
- **Provider AI**: Gemini, OpenRouter, atau endpoint OpenAI-compatible — diatur via UI, tanpa file kredensial.
- **Rate limiter terpusat** untuk provider AI + fallback model + checkpoint run.
- **Safe Mode backend**: perubahan write router dieksekusi dalam transaksi yang bisa di-rollback; policy dispatcher menolak tool berisiko pada mode Read-Only.

## Instalasi

Setelah paket dipublikasikan ke registry npm:

```sh
bun add -g yatt-agent
yatt-agent run
```

Buka **http://localhost:3000**. CLI membuat database SQLite, key enkripsi, dan folder lampiran otomatis pada run pertama. Dokumentasi RouterOS (corpus Rosetta, ~340 MB) diunduh sekali saat run pertama — memerlukan internet. Tidak perlu Docker, database server, atau `.env`.

**Paket belum dipublikasikan.** Sebelum publikasi, gunakan paket lokal:

```sh
bun install
bun run build
bun pm pack --ignore-scripts --filename yatt-agent-0.1.0.tgz
bun add -g ./yatt-agent-0.1.0.tgz
yatt-agent run
```

Atau langsung dari source setelah build: `bun run start`. Bun >= 1.3.3 harus tersedia di PATH. Instalasi global mengikuti [dokumentasi Bun](https://bun.com/docs/pm/cli/add#global).

Pada Windows, pastikan `bun.exe` tersedia di PATH; shim CLI global tidak dapat memakai wrapper PowerShell/npm saja.

> Kompatibilitas: perintah lama `mikrotik-agent` tetap tersedia sebagai alias dan folder data lama (`~/.mikrotik-agent`) tetap dibaca bila `~/.yatt-agent` belum ada.

## Pemakaian

Login dengan username **yatt-agent** (alias literal: **yattagent**) dan password awal **yatt123**. Password default **wajib diganti setelah login pertama** melalui **Pengaturan → Keamanan → Ubah password**. Akun dibuat idempotent; restart tidak mereset password. Pada instalasi lama, akun `mikrotik-agent` otomatis dimigrasi ke `yatt-agent` saat startup (password lama tetap berlaku).

1. Isi provider, API key, dan model melalui **Pengaturan → Model & vision** (Gemini, OpenRouter, atau endpoint OpenAI-compatible).
2. Hubungkan kemampuan lewat **Connectors**: aktifkan MikroTik Server / Coding & Files / Drive / Gmail / Telegram dan atur izinnya.
3. Tambahkan router melalui **Connectors → MikroTik Server** bila perlu mengelola jaringan. SSH diuji sebelum kredensial disimpan.
4. Buat chat dan kerjakan apa saja: kode, file, riset, email, pesan Telegram, atau perintah router. Mode router awal Read-Only; mode Write lewat pengaman backend dan Safe Mode.
5. Ctrl+C menghentikan aplikasi.

Tanpa provider AI, respons memakai mock berlabel — bukan AI nyata.

## Struktur Proyek

```
apps/
  api/     — API server (Hono + Bun) : agent loop, policy dispatcher, MCP supervisor, transaksi
  web/     — Web UI (React + Vite + Tailwind + shadcn)
packages/
  mikrotik-tools/  — custom tool manifests & executor untuk RouterOS
  shared/           — skema & tipe DTO bersama (zod)
bin/yatt-agent.js  — CLI entrypoint produksi
tooling/
  build.ts   — bundling API + web ke dist/
  corpus/    — corpus dokumentasi RouterOS (ros-help.db, diunduh otomatis)
```

## Development

```sh
bun install        # install seluruh workspace
bun run dev        # API (3001, hot) + web (3000, proxy /api) bersamaan
bun run typecheck  # tsc -b seluruh workspace
bun run lint       # eslint
bun run build      # build web lalu bundle API ke dist/
bun run start      # jalankan CLI produksi dari source build
```

Konfigurasi opsional via `.env` (lihat `.env.example`). CLI produksi tidak membutuhkan `.env` — semua kredensial diatur melalui UI dan disimpan terenkripsi di folder data (`~/.yatt-agent` secara default, atau `--data-dir`).

Opsi CLI:

```
yatt-agent run [--port 3000] [--data-dir <folder>]
yatt-agent --version
```

## Arsitektur Singkat

- **Agent loop** (`apps/api/src/agent/`): memanggil provider AI, mengeksekusi tool, mem-batch event ke UI via SSE, dengan checkpoint untuk resume dan guard anti-loop.
- **Policy dispatcher** (`apps/api/src/policies/`): mengklasifikasikan tool (read/write/destructive/unknown) dan menolak yang tidak sesuai mode/izin; katalog tool live dari child process MCP upstream (@usex/mikrotik-mcp) + Rosetta + integrasi aplikasi.
- **MCP supervisor** (`apps/api/src/mcp/`): mengelola child process MCP per user/connection, recycle saat wedged, dengan timeout & idle management.
- **Transaksi & Safe Mode** (`apps/api/src/transactions/`): perubahan write router dibungkus safe-mode RouterOS; commit/rollback tervalidasi state machine; failure injection membuat state `unknown` yang harus direkonsiliasi, tidak pernah diklaim sukses.
- **DB**: SQLite via Drizzle ORM (`agent.sqlite` di folder data), schema & migrasi idempotent.

## Lisensi

Properti dari pemilik repositori. Tidak untuk distribusi tanpa izin.

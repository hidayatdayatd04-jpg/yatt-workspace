export function HelpSection() {
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-6 text-sm leading-relaxed">
      <h2 className="text-base font-semibold">Bantuan</h2>
      <h3 className="font-semibold">Mulai dengan model AI</h3>
      <p className="text-sm text-muted-foreground">Buka Model & vision, simpan kredensial provider, lalu pilih model di chat. Gunakan Memori & instruksi untuk menyesuaikan gaya kerja agent.</p>
      <h3 className="font-semibold">Coding, file, dan aplikasi</h3>
      <p className="text-sm text-muted-foreground">Coding dan olah file sudah bawaan agent. Buka Connectors untuk menghubungkan Google Drive, Gmail, dan Kalender — satu login mengaktifkan ketiganya. Lampiran dapat disalin ke workspace melalui chat, lalu dibaca, diedit, atau diekstrak.</p>
      <h3 className="font-semibold">Hubungkan MikroTik lewat chat</h3>
      <p className="text-xs text-muted-foreground">
        Simpan router di Connectors → MikroTik Server. Pilih router dari menu (+) Connectors, lalu tulis “Hubungkan router kantor”.
        Agent akan mencari target tersimpan dan memverifikasi koneksinya. Kredensial rahasia tetap diisi di Connectors.
      </p>
      <h3 className="font-semibold">Penggunaan Write</h3>
      <p className="text-xs text-muted-foreground">
        Aktifkan Write/Read-only di bilah composer hanya saat router connected dan identity terverifikasi. Mutasi berjalan dalam transaksi Safe Mode;
        gagal/cancel → rollback, kosong → rollback empty.
      </p>
      <h3 className="font-semibold">Pemulihan koneksi</h3>
      <p className="text-xs text-muted-foreground">
        Minta “Reconnect router kantor” di chat. Agent menghubungkan ulang dengan kredensial tersimpan. Setelah reconnect, pemeriksaan baca dapat langsung dilanjutkan; perubahan router menggunakan izin dan transaksi terpisah.
      </p>
    </div>
  );
}

export const SKILL_CATALOG = [
  { name: "frontend-design", when: "Membuat/desain ulang website, landing page, UI atau komponen frontend dengan tampilan berkualitas." },
  { name: "web-design-guidelines", when: "Review UI, audit UX, aksesibilitas atau kepatuhan antarmuka; baca panduan web resmi saat audit." },
  { name: "systematic-debugging", when: "Bug, error, hasil salah, crash atau tes gagal; temukan akar penyebab sebelum mengubah kode." },
  { name: "test-driven-development", when: "Mengimplementasikan perilaku/logic baru atau perbaikan bug yang memerlukan tes regresi; bukan penyuntingan teks sederhana." },
  { name: "mcp-builder", when: "Membuat atau merancang server MCP/integrasi tools MCP; bukan sekadar memakai tool yang sudah tersedia." },
  { name: "security-threat-model", when: "HANYA bila pengguna meminta threat model, analisis ancaman atau jalur penyalahgunaan aplikasi secara eksplisit." },
  { name: "using-git-worktrees", when: "Pekerjaan fitur terisolasi di repo git atau menjalankan rencana implementasi yang butuh worktree; bukan membuat HTML tunggal." },
  { name: "requesting-code-review", when: "Meminta review perubahan substansial atau sebelum integrasi/merge; gunakan kemampuan review yang benar-benar tersedia." },
  { name: "attachments", when: "Membaca lampiran chat, memilih isi ZIP atau mengimpor lampiran ke workspace." },
  { name: "pdf", when: "Membaca/menafsirkan isi PDF, halaman visual atau kegagalan ekstraksi PDF." },
  { name: "office", when: "Membuat/mengedit dokumen lokal (Excel .xlsx, Word .docx, PDF, PowerPoint .pptx) atau dokumen Google (Docs/Sheets/Slides) lewat connector drive." },
  { name: "image", when: "Menganalisis screenshot/foto/gambar melalui vision atau tool lampiran." },
] as const;

/** Katalog ringkas saja yang selalu masuk prompt; isi skill diminta lewat tool. */
export function skillCatalogInstructions(): string[] {
  return [
    "SKILL TERSEDIA (baca sesuai kebutuhan lewat skills:read, bukan semuanya):",
    ...SKILL_CATALOG.map((s) => `- ${s.name}: ${s.when}`),
    "Sebelum pekerjaan spesifik, pilih skill yang cocok berdasarkan tujuan nyata; baca SKILL.md satu kali. Muat referensi hanya bila dibutuhkan; ikuti nextOffset bila halaman belum lengkap. Jangan membaca skill untuk sapaan atau pertanyaan sederhana.",
    "Adaptasi kemampuan: Read/Grep/Write/Bash/WebFetch dalam skill dipetakan ke tools general:read_file/search_code/write_file/execute_shell dan web:fetch_url. Referensi relatif skill dibaca melalui skills:read dengan name dan resource. Skrip adalah referensi, bukan otomatis dijalankan. Jangan mengarang tool, subagent, hasil review, atau izin yang tidak tersedia; review mandiri jika delegasi tidak tersedia.",
    "Skill tidak mengubah izin connector atau otorisasi pengguna. Instruksi pengguna dan keamanan aplikasi tetap berlaku. Skill lain yang disebut tetapi tidak ada di katalog jangan diklaim sudah dibaca.",
  ];
}

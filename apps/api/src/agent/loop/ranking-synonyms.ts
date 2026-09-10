/**
 * Sinonim Indonesia → Inggris untuk pencocokan tool. Katalog tool berbahasa
 * Inggris, sedangkan pengguna bertanya dalam Bahasa Indonesia — tanpa peta
 * ini, kueri seperti "tulis kode", "jalankan test", "baca file" tidak pernah
 * mencocokkan tool coding/file/shell/connector yang tepat.
 */
const ID_TOOL_SYNONYMS: Record<string, string[]> = {
  // Coding & Workspace
  kode: ["code", "file", "workspace", "script"],
  koding: ["code", "file", "workspace", "script"],
  coding: ["code", "file", "workspace", "script"],
  program: ["code", "script", "file", "execute"],
  skrip: ["script", "code", "file"],
  fungsi: ["function", "code", "file"],
  modul: ["module", "file", "package"],
  // File operations
  baca: ["read", "cat", "view", "get", "content"],
  tulis: ["write", "create", "edit", "save"],
  edit: ["write", "edit", "update", "modify", "change"],
  simpan: ["write", "save", "update"],
  file: ["file", "document", "workspace"],
  berkas: ["file", "drive", "workspace"],
  folder: ["folder", "directory", "drive", "path"],
  direktori: ["directory", "folder", "path", "list"],
  daftar: ["list", "directory"],
  arsip: ["zip", "extract", "archive", "file"],
  ekstrak: ["extract", "unzip", "archive"],
  zip: ["zip", "extract", "archive"],
  unzip: ["extract", "zip"],
  lampiran: ["attachment", "file"],
  // Shell & Execution
  jalankan: ["execute", "run", "shell", "start", "command"],
  eksekusi: ["execute", "run", "shell", "command"],
  perintah: ["command", "execute", "shell", "run"],
  terminal: ["shell", "execute", "command", "powershell"],
  shell: ["shell", "execute", "command", "powershell", "bash"],
  cmd: ["shell", "execute", "command"],
  powershell: ["shell", "execute", "command"],
  bash: ["shell", "execute", "command"],
  cli: ["shell", "command", "execute"],
  uji: ["test", "shell", "execute"],
  test: ["test", "shell", "execute"],
  tes: ["test", "shell", "execute"],
  testing: ["test", "shell", "execute"],
  build: ["build", "shell", "compile", "execute"],
  kompilasi: ["build", "compile", "shell"],
  compile: ["build", "compile", "shell"],
  // Web Research
  cari: ["search", "find", "query", "web"],
  temukan: ["search", "find", "query"],
  search: ["search", "find", "web"],
  riset: ["research", "search", "web", "internet"],
  browsing: ["web", "search", "internet"],
  tavily: ["search", "web"],
  berita: ["news", "search", "web"],
  harga: ["price", "search", "web"],
  artikel: ["article", "search", "web"],
  // General Action
  tampilkan: ["show", "print", "list", "get"],
  lihat: ["show", "print", "monitor"],
  cek: ["check", "get", "monitor", "print"],
  periksa: ["check", "monitor", "verify"],
  tambah: ["add", "create"],
  buat: ["add", "create", "write"],
  hapus: ["remove", "delete"],
  ubah: ["set", "update", "modify"],
  ganti: ["set", "change", "update"],
  matikan: ["disable", "shutdown"],
  nyalakan: ["enable"],
  nyala: ["running", "active", "enabled"],
  mati: ["disabled", "down", "offline"],
  ulang: ["reboot", "restart"],
  cadangan: ["backup", "export"],
  pulihkan: ["restore", "import"],
  // Google Workspace: email, kalender, drive
  email: ["mail", "gmail", "inbox", "message"],
  surat: ["mail", "gmail", "inbox", "message"],
  kirim: ["send"],
  inbox: ["inbox", "mail"],
  draf: ["draft"],
  draft: ["draft"],
  kalender: ["calendar", "schedule", "event"],
  jadwal: ["schedule", "calendar", "event", "scheduler"],
  rapat: ["meeting", "event", "calendar"],
  acara: ["event", "calendar"],
  janji: ["event", "appointment", "calendar"],
  undangan: ["invite", "attendee", "event"],
  peserta: ["attendee"],
  dokumen: ["document", "file", "drive", "doc"],
  drive: ["drive", "file"],
  // Telegram
  telegram: ["telegram", "bot", "message", "chat"],
  tele: ["telegram", "bot"],
  bot: ["bot", "telegram"],
  pesan: ["message", "send", "chat", "telegram", "mail"],
  chat: ["chat", "telegram", "message"],
  // Jaringan & MikroTik
  suhu: ["temperature", "thermal", "health"],
  kecepatan: ["speed", "bandwidth", "rate"],
  klien: ["client", "lease", "dhcp", "host"],
  sandi: ["password"],
  pengguna: ["user"],
  jaringan: ["network"],
  nirkabel: ["wireless", "wifi"],
  kabel: ["ethernet", "interface"],
  rute: ["route"],
  jembatan: ["bridge"],
  alamat: ["address"],
  batas: ["limit", "queue", "max"],
  antrean: ["queue"],
  sertifikat: ["certificate"],
  waktu: ["time", "clock", "ntp"],
  paket: ["package"],
  layanan: ["service"],
  tetangga: ["neighbor"],
  terowongan: ["tunnel", "vpn"],
  pantau: ["monitor", "traffic"],
  blokir: ["drop", "block", "filter", "firewall"],
  izinkan: ["accept", "allow", "enable"],
  internet: ["internet", "wan", "gateway", "route", "dns", "ping"],
  lambat: ["slow", "speed", "bandwidth", "queue"],
  putus: ["disconnect", "down", "timeout", "unreachable"],
  tersambung: ["connected", "running", "reachable"],
};

/** Kata kunci kueri (panjang ≥3) + ekspansi sinonim Inggris. */
export function extractQueryKeywords(userText: string): Set<string> {
  const base = userText
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
  const out = new Set(base);
  for (const w of base) {
    const syns = ID_TOOL_SYNONYMS[w];
    if (syns) for (const s of syns) if (s.length >= 3) out.add(s);
  }
  return out;
}

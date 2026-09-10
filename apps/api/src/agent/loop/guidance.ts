/**
 * Translate policy denials and execution failures into clear, actionable guidance.
 * Helps the AI model self-correct on the next step instead of stalling or hallucinating.
 */

export function policyDenialGuidance(code: string, toolName: string): string {
  switch (code) {
    case "SAFE_MODE_UNAVAILABLE":
      return (
        `PERINTAH WAJIB: Tool "${toolName}" DITOLAK oleh sistem karena transaksi Safe Mode tidak aktif. ` +
        `JANGAN coba ulang tool ini — hasilnya akan sama. ` +
        `Laporkan ke pengguna: "Tool tulis ditolak karena transaksi Safe Mode tidak berhasil dibuka. ` +
        `Pastikan mode Write aktif di panel connector dan router tersambung, lalu coba lagi."`
      );
    case "WRITE_DISABLED":
      return (
        `PERINTAH WAJIB: Tool "${toolName}" DITOLAK karena mode saat ini Read-Only. ` +
        `JANGAN coba ulang. Beritahu pengguna untuk mengaktifkan mode Write di panel connector.`
      );
    case "POLICY_CHANGED":
      return "Mode connector berubah saat run berlangsung. Beritahu pengguna bahwa sesi perlu dimulai ulang.";
    case "FORBIDDEN":
      return `Akses tool "${toolName}" ditolak oleh kebijakan keamanan. Beritahu pengguna untuk memeriksa izin connector (Write/Send/Shell) di halaman Connectors.`;
    case "VALIDATION_FAILED":
      return `Argumen untuk "${toolName}" tidak sesuai skema parameter. Periksa kembali tipe data dan parameter wajib (required fields) tool ini.`;
    case "TOOL_UNSUPPORTED":
      return `Tool tidak tersedia dengan nama itu di katalog run ini. Jangan coba memanggil nama yang sama lagi — pilih nama persis dari daftar tools yang tersedia.`;
    default:
      return `Tool "${toolName}" ditolak dengan kode ${code}. Laporkan kode dan pesan error ke pengguna apa adanya.`;
  }
}

export function toolFailGuidance(errorCode: string, toolName: string): string {
  if (errorCode === "FILE_CHANGED") {
    return "File berubah sejak terakhir dibaca (hash tidak cocok). WAJIB general:read_file ulang file tersebut, lalu ulangi operasi dengan expectedHash dari pembacaan terbaru. Jangan menimpa — perubahan eksternal akan hilang.";
  }
  if (errorCode === "FILE_NOT_FOUND") {
    return "File tidak ditemukan. Panggil general:search_files atau general:list_files untuk mencari path yang benar di workspace.";
  }
  if (errorCode === "PATH_OUTSIDE_WORKSPACE") {
    return "Path berada di luar workspace atau menembus symlink. Gunakan path relatif di dalam workspace agent.";
  }
  if (errorCode === "COMMAND_NOT_FOUND") {
    return "Command/program tidak tersedia di host. Cek ketersediaan lewat system:environment_capabilities, gunakan alternatif yang tersedia, atau beri tahu pengguna program perlu diinstal.";
  }
  if (errorCode === "PROCESS_NOT_FOUND") {
    return "processId tidak ditemukan (proses mungkin sudah selesai atau dihentikan). Panggil general:process_status untuk melihat daftar proses aktif.";
  }
  if (errorCode === "DEPENDENCY_MISSING") {
    return "Runtime/dependensi yang dibutuhkan tidak tersedia di host. Laporkan ke pengguna program mana yang perlu diinstal; jangan ulangi tool ini sebelum tersedia.";
  }
  if (errorCode === "USER_APPROVAL_REQUIRED") {
    return "Operasi berisiko memerlukan konfirmasi eksplisit pengguna. Tanyakan dulu di chat (jelaskan command/dampaknya), lalu ulangi dengan argumen confirm=\"ya\" setelah pengguna menyetujui.";
  }
  if (errorCode === "TOOL_NOT_ALLOWED") {
    return "Izin connector untuk tool ini tidak aktif. Arahkan pengguna mengaktifkannya di halaman Connectors. Jangan ulangi tool ini.";
  }
  if (errorCode === "HTTP_ERROR" || errorCode === "NETWORK_ERROR") {
    return "Permintaan jaringan gagal. Periksa URL/host, lalu ulangi hanya bila error bersifat sementara.";
  }
  if (toolName.startsWith("general:write_file")) {
    return (
      "Operasi tulis berkas gagal. Bila berkas sudah ada di workspace atau hash berubah, Anda WAJIB memanggil " +
      "general:read_file terlebih dahulu untuk membaca isi terkini dan memperoleh sha256 terbaru, lalu panggil kembali " +
      "general:write_file dengan expectedHash=<sha256 tersebut>."
    );
  }
  if (toolName.startsWith("general:read_file")) {
    return (
      "Pembacaan berkas gagal (mungkin berkas tidak ditemukan). Panggil general:list_files terlebih dahulu " +
      "untuk memeriksa path relatif dan struktur folder yang benar di workspace."
    );
  }
  if (toolName.startsWith("general:execute_shell")) {
    return (
      "Perintah shell gagal dieksekusi atau menghasilkan exit code bukan 0. Periksa output error stderr/stdout di atas, " +
      "perbaiki kesalahan kode/sintaks perintah, dan ulangi kembali bila diperlukan."
    );
  }
  if (toolName.startsWith("calendar:create_event")) {
    return (
      "Pembuatan event kalender gagal. Pastikan format waktu adalah RFC3339 dengan zona waktu " +
      "(contoh: 2026-09-12T09:00:00+07:00) atau format tanggal YYYY-MM-DD untuk event sepanjang hari (all-day)."
    );
  }
  if (toolName.startsWith("gmail:")) {
    return "Operasi Gmail gagal. Pastikan format email penerima valid dan izin connector Gmail aktif.";
  }
  if (toolName.startsWith("drive:")) {
    return "Operasi Google Drive gagal. Pastikan fileId valid atau izin tulis connector Google Drive aktif.";
  }
  if (toolName.startsWith("telegram:")) {
    return "Operasi Telegram gagal. Pastikan bot Telegram terhubung dan chatId atau @username tujuan valid.";
  }
  if (errorCode === "WEB_SEARCH_NOT_CONFIGURED") {
    return (
      "Pencarian web belum dikonfigurasi (API key Tavily belum diisi). Beritahu pengguna untuk membuka Pengaturan → Deep Research " +
      "dan menambahkan API key. JANGAN mencoba tool ini lagi pada giliran yang sama."
    );
  }
  if (errorCode === "WEB_SEARCH_UNAUTHORIZED") {
    return (
      "API key Tavily ditolak sistem. Beritahu pengguna bahwa API key kemungkinan tidak valid/kedaluwarsa " +
      "dan arahkan memperbaruinya di Pengaturan → Deep Research."
    );
  }
  if (errorCode === "WEB_SEARCH_RATE_LIMITED") {
    return "Pencarian web sedang dibatasi (rate limit). Beritahu pengguna untuk menunggu sebentar. Jangan mengulang berkali-kali.";
  }
  if (errorCode === "TOOL_TIMEOUT") {
    return `Eksekusi tool "${toolName}" melebihi batas waktu (timeout). Periksa apakah proses membutuhkan waktu terlalu lama.`;
  }
  if (errorCode === "TOOL_UNSUPPORTED") {
    return `Tool "${toolName}" tidak tersedia dengan nama itu. Pilih nama tool persis dari daftar tools yang tersedia.`;
  }
  if (errorCode === "TOOL_FAILED") {
    return (
      `Tool "${toolName}" gagal dieksekusi. Periksa output error di atas dan koreksi argumen Anda sebelum mencoba lagi. ` +
      "Jangan mengklaim operasi berhasil tanpa bukti dari tool."
    );
  }
  return `Tool "${toolName}" error (${errorCode}). Laporkan ke pengguna apa adanya, jangan mengarang hasil.`;
}

// ════════════════════════════════════════════════════════
//  KLIKPRO RME — KONFIGURASI UTAMA
//  ⚠️  Ganti APP_URL dengan URL Google Apps Script Anda
// ════════════════════════════════════════════════════════

const APP_URL = 'https://script.google.com/macros/s/AKfycbxHcyvfQm9KeJYt0Be3d_wo8_OZO9uOyGYf1ELFg0IFZmFG8HHiKM7ulNO4oiS2eycA/exec';

// Nama klinik / praktek (ditampilkan di header)
const KLINIK_NAMA   = 'Praktek Dokter Reza Ariandes';
const KLINIK_TITLE  = 'Klikpro RME';

// Jabatan yang boleh mengakses halaman Rekam Medis (pageMedis)
// Paramedis ditambahkan agar bisa masuk untuk input TTV
const JABATAN_MEDIS = ['Dokter', 'Admin', 'Paramedis'];
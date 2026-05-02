// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL PASIEN
//  Pendaftaran, pencarian, auto-fill, scan KTP
//  OCR: Claude Vision API (menggantikan Tesseract)
// ════════════════════════════════════════════════════════

let allPatients     = [];
let currentPasienId = null;
let currentRiwayat  = [];

// ── AUTO-FILL DATA PASIEN DARI LIST ──
async function autoFillPasien() {
    const namaVal = $('nama') ? $('nama').value : '';
    const p = allPatients.find(x => x.nama === namaVal);
    if (!p) return;

    if ($('nik'))       $('nik').value       = p.nik    || '';
    if ($('jk'))        $('jk').value        = p.jk     || 'L';
    if ($('alamat'))    $('alamat').value    = p.alamat || '';
    if ($('tgl_lahir')) $('tgl_lahir').value = formatTglIndo(p.tgl) || '';
    currentPasienId = p.id;

    const riwayatEl = $('riwayatDaftarContainer');
    if (riwayatEl) {
        riwayatEl.innerHTML =
            `<div style="text-align:center;color:var(--primary);padding:10px;font-size:13px;">⏳ Mencari riwayat...</div>`;
    }

    try {
        const res  = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "checkAndUpsertPasien", nama: p.nama, nik: p.nik })
        });
        const data = await res.json();
        currentPasienId = data.pasien.id;
        currentRiwayat  = data.riwayat || [];
        renderRiwayatList(currentRiwayat, 'riwayatDaftarContainer');
    } catch (e) {
        if (riwayatEl) riwayatEl.innerHTML = '';
    }
}

// ── SIMPAN DATA PASIEN (TANPA KUNJUNGAN) ──
async function simpanDataPasienOnly() {
    const nama      = $('nama')      ? $('nama').value.trim()      : '';
    const tgl_lahir = $('tgl_lahir') ? $('tgl_lahir').value.trim() : '';
    const alamat    = $('alamat')    ? $('alamat').value.trim()    : '';

    if (!nama) return showToast("⚠️ Nama wajib diisi!", "warning");
    if (!tgl_lahir && !alamat) return showToast("⚠️ Isi minimal Tgl Lahir atau Alamat!", "warning");

    const btn = $('btnSimpanPasien');
    if (btn) { btn.disabled = true; btn.innerHTML = 'Menyimpan...'; }

    try {
        const payload = {
            action: "savePasienOnly",
            pasienId: currentPasienId,
            nik: $('nik') ? $('nik').value : '',
            nama, tgl_lahir,
            jk:     $('jk')     ? $('jk').value     : 'L',
            alamat
        };
        const res    = await fetch(APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if (result.status === "Sukses") currentPasienId = result.pasienId;
        showToast("✅ Profil pasien disimpan", "success");
    } catch (e) {
        showToast("❌ Gagal menyimpan", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '💾 Simpan Data'; }
    }
}

// ── LANJUT KE PEMERIKSAAN MEDIS ──
async function lanjutPemeriksaan() {
    if (!canAccessMedis()) return;

    const namaPasien = $('nama') ? $('nama').value.trim() : '';
    if (!namaPasien) return showToast("⚠️ Nama wajib diisi!", "error");

    const btn = $('btnNext');
    if (btn) { btn.disabled = true; btn.innerHTML = 'Memproses...'; }

    const today        = new Date();
    const tzOffset     = today.getTimezoneOffset() * 60000;
    const localDateStr = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);
    const localTimeStr = String(today.getHours()).padStart(2, '0') + ':' + String(today.getMinutes()).padStart(2, '0');
    const parts        = localDateStr.split('-');
    const tglIndoFull  = `${parts[2]}/${parts[1]}/${parts[0]}`;

    const umur = hitungUmur($('tgl_lahir') ? $('tgl_lahir').value : '');

    if ($('infoPasienNama'))     $('infoPasienNama').innerText     = namaPasien;
    if ($('infoPasienNik'))      $('infoPasienNik').innerText      = "NIK: " + ($('nik') ? $('nik').value : '-');
    if ($('infoPasienUmur'))     $('infoPasienUmur').innerText     = "Umur: " + umur;
    if ($('infoTglPemeriksaan')) {
        $('infoTglPemeriksaan').innerText     = "Tgl: " + tglIndoFull;
        $('infoTglPemeriksaan').style.display = 'block';
    }

    const tanggalRekamLabel = "Tgl: " + tglIndoFull;
    localStorage.setItem('activePage', 'pageMedis');
    localStorage.setItem('cP_nama',   namaPasien);
    localStorage.setItem('cP_nik',    "NIK: " + ($('nik') ? $('nik').value : '-'));
    localStorage.setItem('cP_umur',   "Umur: " + umur);
    localStorage.setItem('cTglEdit',  tanggalRekamLabel);

    if ($('historyListMedis')) {
        $('historyListMedis').innerHTML =
            `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat riwayat...</div>`;
    }

    switchPage('pageMedis', null);
    if (btn) { btn.disabled = false; btn.innerHTML = 'Lanjut Periksa ›'; }

    try {
        const payload = {
            action: "checkAndUpsertPasien",
            createVisitToday: true,
            localDate: localDateStr, localTime: localTimeStr,
            nama: namaPasien,
            nik:       $('nik')       ? $('nik').value       : '',
            tgl_lahir: $('tgl_lahir') ? $('tgl_lahir').value : '',
            jk:        $('jk')        ? $('jk').value        : 'L',
            alamat:    $('alamat')    ? $('alamat').value     : ''
        };
        const res  = await fetch(APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data || !data.pasien) throw new Error('Respons server tidak valid');

        currentPasienId = data.pasien.id;
        currentRiwayat  = data.riwayat || [];

        const tglIndoNorm  = `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;
        const visitHariIni = currentRiwayat.find(r => {
            const t = String(r.tgl || '').trim();
            return t === tglIndoFull || t === tglIndoNorm || t === localDateStr;
        });

        if (visitHariIni) {
            currentKunjunganId = visitHariIni.id;
            _isiFormDariKunjungan(visitHariIni);
            document.querySelectorAll('[data-save="true"]').forEach(el => localStorage.setItem('rme_' + el.id, el.value));
            calculateIMT(); checkTensi();
            showToast("ℹ️ Melanjutkan data pemeriksaan hari ini", "info");
        } else {
            currentKunjunganId = currentRiwayat.length > 0 ? currentRiwayat[0].id : null;
            showToast("✅ Siap periksa: " + namaPasien, "success");
        }

        renderRiwayatList(currentRiwayat, 'historyListMedis');
        localStorage.setItem('cP_id',      currentPasienId);
        localStorage.setItem('cK_id',      currentKunjunganId);
        localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));

    } catch (e) {
        showToast("⚠️ Data belum sinkron: " + (e.message || 'Cek koneksi'), "warning");
        if ($('historyListMedis')) {
            $('historyListMedis').innerHTML =
                `<div class="empty-state"><div class="empty-icon">⚠️</div>Gagal memuat riwayat. Bisa tetap input data.</div>`;
        }
    }
}

// ── HELPER: Isi form dari data kunjungan ──
function _isiFormDariKunjungan(h) {
    let tdLama = String(h.td || '');
    if ($('sistol'))  $('sistol').value  = tdLama.includes('/') ? tdLama.split('/')[0] : tdLama;
    if ($('diastol')) $('diastol').value = tdLama.includes('/') ? tdLama.split('/')[1] : '';
    if ($('nadi'))    $('nadi').value    = h.nadi    || '';
    if ($('suhu'))    $('suhu').value    = h.suhu    || '';
    if ($('rr'))      $('rr').value      = h.rr      || '';
    if ($('bb'))      $('bb').value      = h.bb      || '';
    if ($('tb'))      $('tb').value      = h.tb      || '';
    if ($('keluhan')) $('keluhan').value = h.keluhan || '';
    if ($('fisik'))   $('fisik').value   = h.fisik   || '';

    let diagLama = String(h.diag || '');
    if (diagLama.includes(" | ")) {
        if ($('diagnosa'))  $('diagnosa').value  = diagLama.split(" | ")[0];
        if ($('diagnosa2')) $('diagnosa2').value = diagLama.split(" | ")[1];
    } else {
        if ($('diagnosa'))  $('diagnosa').value  = diagLama;
        if ($('diagnosa2')) $('diagnosa2').value = '';
    }
    if ($('terapi')) $('terapi').value = h.terapi || '';
}

// ── RESET SESI PENDAFTARAN ──
function resetSession() {
    clearSession();
    currentPasienId    = null;
    currentKunjunganId = null;
    currentRiwayat     = [];
    ['nama', 'nik', 'alamat', 'tgl_lahir'].forEach(id => { if ($(id)) $(id).value = ''; });
    if ($('jk')) $('jk').value = 'L';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    const firstNav = document.querySelector('.nav-item');
    if (firstNav) firstNav.classList.add('active-nav');
    switchPage('pageDaftar', null);
    fetchByDate();
}


// ════════════════════════════════════════════════════════
//  SCAN KTP — OCR.space API
//
//  Menggunakan OCR.space untuk membaca teks dari foto KTP,
//  lalu parsing manual untuk ekstrak field yang dibutuhkan.
//
//  Cara kerja:
//  1. Foto KTP dikirim ke OCR.space (multipart/form-data)
//  2. Teks hasil OCR di-parse dengan regex KTP Indonesia
//  3. Field NIK, Nama, Tgl Lahir, JK, Alamat diisi ke form
//
//  API Key gratis: https://ocr.space/ocrapi (daftar gratis)
//  Ganti OCR_SPACE_API_KEY di bawah dengan key Anda.
//  Key demo "K88888888888888" bisa dipakai untuk testing.
// ════════════════════════════════════════════════════════

const OCR_SPACE_API_KEY = 'K88888888888888'; // Ganti dengan API key Anda dari ocr.space

// ── Resize gambar jika terlalu besar (hemat kuota API) ──
function resizeImageForAPI(file, maxWidth = 1200) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.onload  = () => {
            URL.revokeObjectURL(url);

            if (img.width <= maxWidth) { resolve(file); return; }

            const ratio  = maxWidth / img.width;
            const canvas = document.createElement('canvas');
            canvas.width  = maxWidth;
            canvas.height = Math.round(img.height * ratio);

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
                blob => resolve(blob || file),
                'image/jpeg',
                0.92
            );
        };
        img.src = url;
    });
}

// ── Kirim gambar ke OCR.space, dapatkan teks mentah ──
async function ocrSpaceRequest(file) {
    const formData = new FormData();
    formData.append('file', file, 'ktp.jpg');
    formData.append('apikey', OCR_SPACE_API_KEY);
    formData.append('language', 'ind');        // Bahasa Indonesia
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');          // Tingkatkan akurasi gambar kecil
    formData.append('OCREngine', '2');         // Engine 2 lebih akurat untuk dokumen

    const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('OCR.space HTTP error: ' + response.status);

    const result = await response.json();

    if (result.IsErroredOnProcessing) {
        throw new Error('OCR gagal: ' + (result.ErrorMessage?.[0] || 'Unknown error'));
    }

    // Gabungkan semua teks dari semua halaman/blok
    const allText = (result.ParsedResults || [])
        .map(r => r.ParsedText || '')
        .join('\n');

    return allText;
}

// ── Konversi teks Title Case ──
function toTitleCase(str) {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Normalisasi tanggal dari berbagai format ke DD/MM/YYYY ──
function normalisasiTanggal(raw) {
    if (!raw) return null;
    // Format: 01-01-1990, 01/01/1990, 01 01 1990
    const m = raw.match(/(\d{1,2})[-\/\s](\d{1,2})[-\/\s](\d{4})/);
    if (m) {
        return m[1].padStart(2,'0') + '/' + m[2].padStart(2,'0') + '/' + m[3];
    }
    // Format: 01 Januari 1990
    const bulanMap = {
        januari:'01',februari:'02',maret:'03',april:'04',mei:'05',juni:'06',
        juli:'07',agustus:'08',september:'09',oktober:'10',november:'11',desember:'12'
    };
    const m2 = raw.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (m2 && bulanMap[m2[2]]) {
        return m2[1].padStart(2,'0') + '/' + bulanMap[m2[2]] + '/' + m2[3];
    }
    return null;
}

// ── Parse teks OCR menjadi data KTP terstruktur ──
function parseKtpDariTeks(teks) {
    const lines = teks.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const upper = teks.toUpperCase();

    const result = { nik: null, nama: null, tgl_lahir: null, jk: null, alamat: null };

    // ── NIK: 16 digit angka berurutan ──
    const nikMatch = teks.match(/\b(\d{16})\b/);
    if (nikMatch) result.nik = nikMatch[1];

    // ── Nama: baris setelah label NAMA ──
    const namaLineIdx = lines.findIndex(l => /^nama\b/i.test(l));
    if (namaLineIdx !== -1) {
        // Ambil nilai di baris yang sama setelah ":" atau baris berikutnya
        const namaLine = lines[namaLineIdx];
        const afterColon = namaLine.replace(/^nama\s*[:\-]?\s*/i, '').trim();
        if (afterColon.length > 2) {
            result.nama = toTitleCase(afterColon);
        } else if (lines[namaLineIdx + 1]) {
            // Nilai ada di baris berikutnya (format KTP umumnya begini)
            const nextLine = lines[namaLineIdx + 1];
            if (!/^(nik|tempat|tanggal|jenis|gol|agama|status|pekerjaan|kewarganegaraan|alamat|rt|rw|kel|kec|kota|kab|provinsi)/i.test(nextLine)) {
                result.nama = toTitleCase(nextLine.replace(/[^a-zA-Z\s]/g, '').trim());
            }
        }
    }
    // Fallback: cari baris teks kapital panjang yang bukan label
    if (!result.nama) {
        for (const line of lines) {
            if (/^[A-Z\s]{5,40}$/.test(line) && !/^(NAMA|TEMPAT|TANGGAL|JENIS|AGAMA|GOLONGAN|STATUS|PEKERJAAN|ALAMAT|PROVINSI|KOTA|KABUPATEN|KECAMATAN|KELURAHAN|DESA|REPUBLIK|INDONESIA|KARTU|TANDA|PENDUDUK|NIK)/.test(line)) {
                result.nama = toTitleCase(line.trim());
                break;
            }
        }
    }

    // ── Tanggal Lahir ──
    // Cari di baris yang mengandung label Tempat/Tanggal Lahir
    for (const line of lines) {
        if (/tempat.*lahir|tgl.*lahir|tanggal.*lahir/i.test(line) || /lahir/i.test(line)) {
            const tglRaw = line.match(/(\d{1,2}[-\/\s]\d{1,2}[-\/\s]\d{4}|\d{1,2}\s+\w+\s+\d{4})/)?.[0];
            if (tglRaw) { result.tgl_lahir = normalisasiTanggal(tglRaw); break; }
        }
    }
    // Fallback: cari pola tanggal di seluruh teks
    if (!result.tgl_lahir) {
        const tglMatch = teks.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
        if (tglMatch) result.tgl_lahir = normalisasiTanggal(tglMatch[1]);
    }

    // ── Jenis Kelamin ──
    if (/LAKI-LAKI|LAKI LAKI|LELAKI/i.test(upper)) result.jk = 'L';
    else if (/PEREMPUAN|WANITA/i.test(upper))       result.jk = 'P';
    // Fallback dari NIK: digit ke-7 ≥ 40 → perempuan
    if (!result.jk && result.nik && result.nik.length === 16) {
        result.jk = parseInt(result.nik[6]) >= 4 ? 'P' : 'L';
    }

    // ── Alamat ──
    const alamatLineIdx = lines.findIndex(l => /^alamat\b/i.test(l));
    if (alamatLineIdx !== -1) {
        const bagianAlamat = [];
        const alamatLine   = lines[alamatLineIdx].replace(/^alamat\s*[:\-]?\s*/i, '').trim();
        if (alamatLine) bagianAlamat.push(alamatLine);

        // Ambil 2-3 baris berikutnya yang masih bagian alamat (bukan label baru)
        for (let i = alamatLineIdx + 1; i < Math.min(alamatLineIdx + 4, lines.length); i++) {
            const l = lines[i];
            if (/^(rt|rw|kel|kec|kota|kab|provinsi|gol|agama|status|pekerjaan|kewarganegaraan|jenis|nama|nik|tempat|tanggal|berlaku)/i.test(l)) break;
            bagianAlamat.push(l);
        }

        if (bagianAlamat.length > 0) {
            result.alamat = bagianAlamat.join(', ').trim();
        }
    }

    return result;
}

// ── Fungsi utama: scan KTP dengan OCR.space ──
async function scanKtpDenganOcrSpace(file) {
    const resized = await resizeImageForAPI(file, 1400);
    const teksOcr = await ocrSpaceRequest(resized);

    if (!teksOcr || teksOcr.trim().length < 10) {
        throw new Error('Teks tidak terbaca dari gambar. Pastikan foto KTP jelas.');
    }

    return parseKtpDariTeks(teksOcr);
}

// ── INISIALISASI SCAN KTP (UTAMA) ──
function initScanKtp() {
    const camInput = $('camInput');
    if (!camInput) return;

    camInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validasi tipe file
        if (!file.type.startsWith('image/')) {
            showToast("❌ File harus berupa gambar (JPG/PNG)", "error");
            camInput.value = '';
            return;
        }

        // Tampilkan loading state di tombol scan
        const scanBox   = document.querySelector('.scan-ktp');
        const scanLabel = document.querySelector('.scan-ktp-label');
        const scanIcon  = document.querySelector('.scan-ktp-icon');
        if (scanLabel) scanLabel.textContent = 'Membaca KTP...';
        if (scanIcon)  scanIcon.textContent  = '⏳';
        if (scanBox)   scanBox.style.opacity = '0.7';

        showToast("🔍 Membaca KTP dengan OCR.space...", "info");

        try {
            // Kirim ke OCR.space
            const ktpData = await scanKtpDenganOcrSpace(file);

            const filled = [];

            // Isi form dari data yang diekstrak
            if (ktpData.nik && $('nik')) {
                // Pastikan hanya angka, max 16 digit
                const nikClean = String(ktpData.nik).replace(/\D/g, '').slice(0, 16);
                if (nikClean.length >= 14) {
                    $('nik').value = nikClean;
                    filled.push('NIK');
                }
            }

            if (ktpData.nama && $('nama')) {
                $('nama').value = ktpData.nama.trim();
                filled.push('Nama');
            }

            if (ktpData.tgl_lahir && $('tgl_lahir')) {
                $('tgl_lahir').value = ktpData.tgl_lahir;
                filled.push('Tgl Lahir');
            }

            if (ktpData.jk && $('jk')) {
                const jkVal = String(ktpData.jk).toUpperCase().trim();
                if (jkVal === 'L' || jkVal === 'P') {
                    $('jk').value = jkVal;
                    filled.push('Jenis Kelamin');
                }
            }

            if (ktpData.alamat && $('alamat') && !$('alamat').value) {
                $('alamat').value = ktpData.alamat.trim();
                filled.push('Alamat');
            }

            // Feedback hasil
            if (filled.length > 0) {
                showToast('✅ KTP terbaca: ' + filled.join(', '), 'success');
            } else {
                showToast('⚠️ KTP tidak terbaca. Pastikan foto jelas & KTP penuh.', 'warning');
            }

        } catch (err) {
            console.error('[KTP OCR.space Error]', err);

            if (err.message.includes('401') || err.message.includes('403')) {
                showToast('❌ API Key OCR.space tidak valid. Cek konfigurasi.', 'error');
            } else if (err.message.includes('429') || err.message.includes('limit')) {
                showToast('⚠️ Kuota OCR.space habis. Coba lagi nanti atau upgrade plan.', 'warning');
            } else if (err.message.includes('tidak terbaca')) {
                showToast('⚠️ ' + err.message, 'warning');
            } else {
                showToast('❌ Gagal baca KTP. Pastikan foto jelas & coba lagi.', 'error');
            }
        } finally {
            // Kembalikan tampilan tombol scan
            if (scanLabel) scanLabel.textContent = 'Ketuk untuk Scan KTP Otomatis';
            if (scanIcon)  scanIcon.textContent  = '📷';
            if (scanBox)   scanBox.style.opacity  = '1';
            camInput.value = '';
        }
    });
}

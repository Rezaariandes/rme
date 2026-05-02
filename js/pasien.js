// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL PASIEN
//  Pendaftaran, pencarian, auto-fill, scan KTP
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
            nik:      $('nik')      ? $('nik').value      : '',
            tgl_lahir: $('tgl_lahir') ? $('tgl_lahir').value : '',
            jk:       $('jk')       ? $('jk').value       : 'L',
            alamat:   $('alamat')   ? $('alamat').value   : ''
        };
        const res  = await fetch(APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data || !data.pasien) throw new Error('Respons server tidak valid');

        currentPasienId = data.pasien.id;
        currentRiwayat  = data.riwayat || [];

        const tglIndoNorm = `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;
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
        localStorage.setItem('cP_id',       currentPasienId);
        localStorage.setItem('cK_id',       currentKunjunganId);
        localStorage.setItem('cP_riwayat',  JSON.stringify(currentRiwayat));

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
//  SCAN KTP — PERBAIKAN LENGKAP
//  Masalah sebelumnya:
//  1. Regex NIK \b\d{16}\b gagal jika ada spasi antar digit
//  2. Parser nama tidak menangani variasi format KTP daerah
//  3. Tidak ada preprocessing gambar (kontras, grayscale)
//  4. Tidak ada fallback strategi pencarian
// ════════════════════════════════════════════════════════

// ── PREPROCESSING: Tingkatkan kontras & sharpness gambar ──
function preprocessKtpImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // Perbesar gambar 2x agar OCR lebih akurat
            const scale  = Math.min(2, 2000 / Math.max(img.width, img.height));
            canvas.width  = img.width  * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');

            // Gambar asli
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Ambil pixel data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data      = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                // Konversi ke grayscale (luminance weighted)
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

                // Tingkatkan kontras (faktor 1.8)
                const contrast = 1.8;
                const factor   = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
                const val      = Math.min(255, Math.max(0, factor * (gray - 128) + 128));

                data[i]     = val; // R
                data[i + 1] = val; // G
                data[i + 2] = val; // B
                // Alpha tidak diubah
            }

            ctx.putImageData(imageData, 0, 0);
            URL.revokeObjectURL(url);
            canvas.toBlob(resolve, 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

// ── EKSTRAK NIK: Cari 16 digit berurutan (toleran spasi & OCR noise) ──
function extractNIK(text) {
    // Strategi 1: 16 digit mepet (paling ideal)
    let m = text.match(/\b(\d{16})\b/);
    if (m) return m[1];

    // Strategi 2: Baris yang mengandung kata NIK / nomor, ambil semua digit
    const lines = text.split('\n');
    for (const line of lines) {
        const upper = line.toUpperCase();
        if (upper.includes('NIK') || upper.includes('NO.') || upper.includes('NOMOR')) {
            const digits = line.replace(/\D/g, '');
            if (digits.length === 16) return digits;
            // Toleransi: 15–17 digit (OCR kadang salah baca 1 digit)
            if (digits.length >= 15 && digits.length <= 17) return digits.substring(0, 16);
        }
    }

    // Strategi 3: Cari sekuens digit 16 karakter di seluruh teks (termasuk ada spasi)
    const allDigits = text.replace(/[^\d\s]/g, '');
    const sequences = allDigits.match(/\d[\d\s]{14,18}\d/g) || [];
    for (const seq of sequences) {
        const digits = seq.replace(/\s/g, '');
        if (digits.length === 16) return digits;
    }

    return null;
}

// ── EKSTRAK NAMA: Multi-strategi parsing KTP Indonesia ──
function extractNama(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // ── Keyword label yang ada di KTP ──
    const labelNama  = /^(NAMA\s*[:.]?|Nama\s*[:.]?)/i;
    const skipWords  = /^(NIK|PROVINSI|KABUPATEN|KOTA|KECAMATAN|KELURAHAN|DESA|DUSUN|RT|RW|ALAMAT|TEMPAT|TGL|JENIS|GOL|STATUS|PEKERJAAN|KEWARGANEGARAAN|BERLAKU|AGAMA|DARAH|LAHIR|SCAN|KTP|INDONESIA)/i;
    const validNama  = /^[A-Z][A-Za-z .'\-]{2,50}$/;  // nama valid: huruf, spasi, titik, strip

    // Strategi 1: Baris yang DIAWALI kata "NAMA"
    for (let i = 0; i < lines.length; i++) {
        if (labelNama.test(lines[i])) {
            // Nama bisa di baris yang sama setelah label
            let nama = lines[i].replace(labelNama, '').replace(/^[\s:.]+/, '').trim();
            // Bersihkan karakter aneh di awal/akhir
            nama = nama.replace(/^[^A-Za-z]+/, '').replace(/[^A-Za-z\s.']+$/, '').trim();
            if (nama.length >= 3 && validNama.test(nama)) return toTitleCase(nama);

            // Nama ada di baris berikutnya
            if (i + 1 < lines.length) {
                let namaNext = lines[i + 1].replace(/^[\s:.]+/, '').trim();
                namaNext = namaNext.replace(/^[^A-Za-z]+/, '').replace(/[^A-Za-z\s.']+$/, '').trim();
                if (namaNext.length >= 3 && !skipWords.test(namaNext)) return toTitleCase(namaNext);
            }
        }
    }

    // Strategi 2: Cari baris ALL CAPS tanpa digit yang bukan keyword KTP
    //             (nama di KTP biasanya kapital semua)
    const capsLines = lines.filter(l => {
        const onlyCaps = /^[A-Z][A-Z\s.']{2,50}$/.test(l);
        const notKw    = !skipWords.test(l);
        const noDigit  = !/\d/.test(l);
        return onlyCaps && notKw && noDigit;
    });

    // Pilih baris ALL CAPS paling panjang (kemungkinan nama)
    if (capsLines.length > 0) {
        const best = capsLines.reduce((a, b) => a.length >= b.length ? a : b);
        return toTitleCase(best.trim());
    }

    // Strategi 3: Fallback — baris setelah NIK yang terlihat seperti nama
    for (let i = 0; i < lines.length; i++) {
        if (/\d{16}/.test(lines[i].replace(/\s/g, ''))) {
            // Cek 1–3 baris setelah NIK
            for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
                let candidate = lines[j].replace(/^[^A-Za-z]+/, '').trim();
                if (candidate.length >= 3 && !skipWords.test(candidate) && !/\d{4}/.test(candidate)) {
                    return toTitleCase(candidate);
                }
            }
        }
    }

    return null;
}

// ── TITLE CASE helper ──
function toTitleCase(str) {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── EKSTRAK TANGGAL LAHIR dari teks OCR ──
function extractTglLahir(text) {
    // Format: DD-MM-YYYY atau DD/MM/YYYY atau DD MM YYYY
    const patterns = [
        /(\d{2})[-\/\s](\d{2})[-\/\s](\d{4})/,  // DD-MM-YYYY
        /LAHIR\s*[:.]?\s*(\d{2})[-\/\s](\d{2})[-\/\s](\d{4})/i,
        /TGL\.?\s*LAHIR\s*[:.]?\s*(\d{2})[-\/\s](\d{2})[-\/\s](\d{4})/i,
    ];
    for (const pat of patterns) {
        const m = text.match(pat);
        if (m) {
            // Validasi: bulan 01-12, hari 01-31
            const d = parseInt(m[m.length - 3]);
            const mo = parseInt(m[m.length - 2]);
            const y  = parseInt(m[m.length - 1]);
            if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 1900 && y <= new Date().getFullYear()) {
                return String(d).padStart(2,'0') + '/' + String(mo).padStart(2,'0') + '/' + y;
            }
        }
    }
    return null;
}

// ── EKSTRAK JENIS KELAMIN ──
function extractJK(text) {
    const upper = text.toUpperCase();
    if (upper.includes('PEREMPUAN') || upper.includes('P ') || upper.includes(' P\n')) return 'P';
    if (upper.includes('LAKI-LAKI') || upper.includes('LAKI LAKI')) return 'L';
    return null;
}

// ── EKSTRAK ALAMAT ──
function extractAlamat(text) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const upper = lines[i].toUpperCase();
        if (upper.includes('ALAMAT')) {
            let alamat = lines[i].replace(/ALAMAT\s*[:.]?/i, '').trim();
            // Ambil 1-2 baris berikutnya jika masih bagian alamat
            if (i + 1 < lines.length && !/^(RT|RW|KEL|KEC|KAB|KOTA|PROV|AGAMA|GOL|STATUS|PEKERJAAN)/i.test(lines[i+1])) {
                alamat += ' ' + lines[i+1].trim();
            }
            alamat = alamat.replace(/^[^A-Za-z0-9]+/, '').trim();
            if (alamat.length >= 3) return alamat;
        }
    }
    return null;
}

// ── INISIALISASI SCAN KTP (UTAMA) ──
function initScanKtp() {
    const camInput = $('camInput');
    if (!camInput) return;

    camInput.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        showToast("⏳ Memproses gambar KTP...", "info");

        try {
            // 1. Preprocessing: tingkatkan kualitas gambar
            const processedBlob = await preprocessKtpImage(file);

            showToast("🔍 Membaca teks KTP...", "info");

            // 2. OCR dengan konfigurasi optimal untuk KTP
            const result = await Tesseract.recognize(processedBlob, 'ind', {
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/.() ',
                preserve_interword_spaces: '1',
            });

            const text = result.data.text;
            console.log('[KTP OCR Raw]', text); // Untuk debugging

            let foundNIK  = false;
            let foundNama = false;
            let summary   = [];

            // 3. Ekstrak NIK
            const nik = extractNIK(text);
            if (nik && $('nik')) {
                $('nik').value = nik;
                foundNIK = true;
                summary.push('NIK ✓');
            }

            // 4. Ekstrak Nama
            const nama = extractNama(text);
            if (nama && $('nama')) {
                $('nama').value = nama;
                foundNama = true;
                summary.push('Nama ✓');
            }

            // 5. Ekstrak Tanggal Lahir (bonus)
            const tgl = extractTglLahir(text);
            if (tgl && $('tgl_lahir') && !$('tgl_lahir').value) {
                $('tgl_lahir').value = tgl;
                summary.push('Tgl Lahir ✓');
            }

            // 6. Ekstrak Jenis Kelamin (bonus)
            const jk = extractJK(text);
            if (jk && $('jk')) {
                $('jk').value = jk;
                summary.push('JK ✓');
            }

            // 7. Ekstrak Alamat (bonus)
            const alamat = extractAlamat(text);
            if (alamat && $('alamat') && !$('alamat').value) {
                $('alamat').value = alamat;
                summary.push('Alamat ✓');
            }

            // 8. Tampilkan hasil
            if (foundNIK || foundNama) {
                showToast("✅ KTP terbaca: " + summary.join(', '), "success");
            } else {
                showToast("⚠️ KTP kurang jelas. Coba foto lebih dekat & terang.", "warning");
                console.warn('[KTP OCR] Tidak bisa ekstrak data. Raw text:', text);
            }

        } catch (err) {
            console.error('[KTP OCR Error]', err);
            showToast("❌ Gagal membaca KTP. Pastikan gambar jelas & pencahayaan cukup.", "error");
        }

        // Reset agar bisa scan ulang file yang sama
        camInput.value = '';
    });
}

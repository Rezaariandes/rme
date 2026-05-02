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
//  SCAN KTP — Claude Vision API
//
//  Menggantikan Tesseract.js yang tidak reliable.
//  Claude Vision memahami konteks KTP Indonesia secara
//  semantik, bukan hanya pattern matching karakter.
//
//  Cara kerja:
//  1. Foto KTP dikonversi ke base64
//  2. Dikirim ke Anthropic /v1/messages dengan instruksi
//     ekstrak NIK, Nama, Tgl Lahir, JK, Alamat
//  3. Response JSON di-parse dan langsung isi form
//
//  Biaya: ~0.001 USD per scan (sangat murah)
//  Akurasi: Sangat tinggi, mengerti konteks Indonesia
// ════════════════════════════════════════════════════════

// ── Konversi File/Blob ke base64 string ──
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => {
            // result: "data:image/jpeg;base64,XXXX..." → ambil setelah koma
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
        reader.readAsDataURL(file);
    });
}

// ── Resize gambar jika terlalu besar (hemat token API) ──
function resizeImageForAPI(file, maxWidth = 1200) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.onload  = () => {
            URL.revokeObjectURL(url);

            // Jika sudah kecil, tidak perlu resize
            if (img.width <= maxWidth) { resolve(file); return; }

            const ratio  = maxWidth / img.width;
            const canvas = document.createElement('canvas');
            canvas.width  = maxWidth;
            canvas.height = Math.round(img.height * ratio);

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
                blob => resolve(blob || file),
                file.type || 'image/jpeg',
                0.92  // kualitas 92%
            );
        };
        img.src = url;
    });
}

// ── Deteksi media type dari file ──
function getMediaType(file) {
    const type = file.type || '';
    if (type.includes('png'))  return 'image/png';
    if (type.includes('webp')) return 'image/webp';
    if (type.includes('gif'))  return 'image/gif';
    return 'image/jpeg'; // default
}

// ── Kirim gambar ke Claude Vision, dapatkan data KTP ──
async function scanKtpDenganClaude(file) {
    // 1. Resize gambar agar tidak melebihi batas token
    const resized  = await resizeImageForAPI(file, 1200);
    const base64   = await fileToBase64(resized);
    const mimeType = getMediaType(file);

    // 2. Prompt yang sangat spesifik untuk KTP Indonesia
    const prompt = `Ini adalah foto KTP (Kartu Tanda Penduduk) Indonesia.

Ekstrak data berikut secara AKURAT dan kembalikan HANYA dalam format JSON valid, tanpa teks lain apapun:

{
  "nik": "16 digit angka NIK, atau null jika tidak terbaca",
  "nama": "Nama lengkap sesuai KTP dalam format Title Case, atau null",
  "tgl_lahir": "Tanggal lahir format DD/MM/YYYY, atau null",
  "jk": "L untuk Laki-laki, P untuk Perempuan, atau null",
  "alamat": "Alamat lengkap satu baris, atau null"
}

ATURAN PENTING:
- NIK selalu 16 digit angka, biasanya di bagian atas KTP
- Nama ditulis KAPITAL di KTP, konversi ke Title Case (contoh: BUDI SANTOSO → Budi Santoso)
- Jika ada field yang tidak terbaca jelas, isi dengan null (bukan string kosong)
- Kembalikan HANYA JSON, tidak ada penjelasan atau teks lain`;

    // 3. Panggil Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type':         'application/json',
            'anthropic-version':    '2023-06-01',
            'anthropic-dangerous-direct-browser-calls': 'true'
        },
        body: JSON.stringify({
            model:      'claude-haiku-4-5-20251001', // Haiku: cepat & murah, cukup untuk OCR
            max_tokens: 300,
            messages: [{
                role: 'user',
                content: [
                    {
                        type:   'image',
                        source: {
                            type:       'base64',
                            media_type: mimeType,
                            data:       base64
                        }
                    },
                    {
                        type: 'text',
                        text: prompt
                    }
                ]
            }]
        })
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error('API error ' + response.status + ': ' + errBody);
    }

    const data    = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // 4. Parse JSON dari response
    // Claude kadang wrap JSON dalam ```json ... ``` — bersihkan dulu
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Respons tidak mengandung JSON valid');

    return JSON.parse(jsonMatch[0]);
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

        showToast("🔍 Membaca KTP dengan AI...", "info");

        try {
            // Kirim ke Claude Vision
            const ktpData = await scanKtpDenganClaude(file);

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
            console.error('[KTP Claude Vision Error]', err);

            // Error spesifik jika API key tidak ada
            if (err.message.includes('401') || err.message.includes('403')) {
                showToast('❌ API Key tidak valid. Hubungi admin.', 'error');
            } else if (err.message.includes('429')) {
                showToast('⚠️ Terlalu banyak request. Tunggu sebentar.', 'warning');
            } else {
                showToast('❌ Gagal baca KTP. Coba lagi atau isi manual.', 'error');
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

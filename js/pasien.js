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

// ── SCAN KTP (OCR via Tesseract) ──
function initScanKtp() {
    const camInput = $('camInput');
    if (!camInput) return;
    camInput.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;
        showToast("⏳ Sedang membaca KTP...", "info");
        try {
            const result   = await Tesseract.recognize(file, 'ind');
            const text     = result.data.text;
            const nikMatch = text.match(/\b\d{16}\b/);
            if (nikMatch && $('nik')) $('nik').value = nikMatch[0];
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].toUpperCase().includes('NAMA')) {
                    let nama = lines[i].replace(/NAMA|:|Nama/gi, '').trim();
                    if (!nama && i + 1 < lines.length) nama = lines[i + 1].replace(/:/g, '').trim();
                    if (nama && $('nama')) $('nama').value = nama;
                    break;
                }
            }
            showToast("✅ KTP berhasil dipindai", "success");
        } catch (err) {
            showToast("❌ Gagal membaca KTP", "error");
        }
        // Reset input agar bisa scan ulang file yang sama
        camInput.value = '';
    });
}

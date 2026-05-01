// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL PASIEN
//  Pendaftaran, pencarian, auto-fill, scan KTP
// ════════════════════════════════════════════════════════

let allPatients     = [];
let currentPasienId = null;
let currentRiwayat  = [];

// ── AUTO-FILL DATA PASIEN DARI LIST ──
async function autoFillPasien() {
    const p = allPatients.find(x => x.nama === $('nama').value);
    if (!p) return;

    $('nik').value      = p.nik || '';
    $('jk').value       = p.jk || 'L';
    $('alamat').value   = p.alamat || '';
    $('tgl_lahir').value = formatTglIndo(p.tgl) || '';
    currentPasienId     = p.id;

    $('riwayatDaftarContainer').innerHTML =
        `<div style="text-align:center;color:var(--primary);padding:10px;font-size:13px;">⏳ Mencari riwayat...</div>`;

    try {
        const res = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "checkAndUpsertPasien", nama: p.nama, nik: p.nik })
        });
        const data = await res.json();
        currentPasienId = data.pasien.id;
        currentRiwayat  = data.riwayat || [];
        renderRiwayatList(currentRiwayat, 'riwayatDaftarContainer');
    } catch (e) {
        $('riwayatDaftarContainer').innerHTML = '';
    }
}

// ── SIMPAN DATA PASIEN SAJA (TANPA KUNJUNGAN) ──
async function simpanDataPasienOnly() {
    const nama      = $('nama').value.trim();
    const tgl_lahir = $('tgl_lahir').value.trim();
    const alamat    = $('alamat').value.trim();

    if (!nama) return showToast("⚠️ Nama wajib diisi!", "warning");
    if (!tgl_lahir && !alamat) return showToast("⚠️ Isi minimal Tgl Lahir atau Alamat!", "warning");

    const btn = $('btnSimpanPasien');
    btn.disabled = true;
    btn.innerHTML = 'Menyimpan...';

    try {
        const payload = {
            action: "savePasienOnly",
            pasienId: currentPasienId,
            nik: $('nik').value, nama, tgl_lahir,
            jk: $('jk').value, alamat
        };
        const res    = await fetch(APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if (result.status === "Sukses") currentPasienId = result.pasienId;
        showToast("✅ Profil pasien disimpan", "success");
    } catch (e) {
        showToast("❌ Gagal menyimpan", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '💾 Simpan Data';
    }
}

// ── LANJUT KE HALAMAN PEMERIKSAAN MEDIS ──
async function lanjutPemeriksaan() {
    // Cek hak akses jabatan terlebih dahulu
    if (!canAccessMedis()) return;

    const namaPasien = $('nama').value.trim();
    if (!namaPasien) return showToast("⚠️ Nama wajib diisi!", "error");

    const btn = $('btnNext');
    btn.disabled = true;
    btn.innerHTML = 'Memproses...';

    const today        = new Date();
    const tzOffset     = today.getTimezoneOffset() * 60000;
    const localDateStr = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);
    const localTimeStr = String(today.getHours()).padStart(2, '0') + ':' + String(today.getMinutes()).padStart(2, '0');
    const parts        = localDateStr.split('-');
    const tglIndoFull  = `${parts[2]}/${parts[1]}/${parts[0]}`;

    const umur = hitungUmur($('tgl_lahir').value);
    $('infoPasienNama').innerText     = namaPasien;
    $('infoPasienNik').innerText      = "NIK: " + ($('nik').value || '-');
    $('infoPasienUmur').innerText     = "Umur: " + umur;
    $('infoTglPemeriksaan').innerText = "Tgl: " + tglIndoFull;
    $('infoTglPemeriksaan').style.display = 'block';

    if (!currentPasienId || $('nama').value.trim() !== ($('infoPasienNama').innerText)) {
        document.querySelectorAll('[data-save="true"]').forEach(el => {
            el.value = '';
            localStorage.removeItem('rme_' + el.id);
        });
        $('imtCalc').innerText = "";
        $('sistol').classList.remove('is-high');
        $('diastol').classList.remove('is-high');
    }

    $('historyListMedis').innerHTML =
        `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat riwayat...</div>`;
    const tanggalRekamLabel = "Tgl: " + tglIndoFull;
    localStorage.setItem('activePage', 'pageMedis');
    localStorage.setItem('cP_nama', namaPasien);
    localStorage.setItem('cP_nik', "NIK: " + ($('nik').value || '-'));
    localStorage.setItem('cP_umur', "Umur: " + umur);
    localStorage.setItem('cTglEdit', tanggalRekamLabel);

    switchPage('pageMedis', null);
    btn.disabled = false;
    btn.innerHTML = 'Lanjut Periksa ›';

    try {
        const payload = {
            action: "checkAndUpsertPasien",
            createVisitToday: true,
            localDate: localDateStr, localTime: localTimeStr,
            nama: namaPasien, nik: $('nik').value,
            tgl_lahir: $('tgl_lahir').value, jk: $('jk').value, alamat: $('alamat').value
        };
        const res  = await fetch(APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data || !data.pasien) throw new Error('Respons server tidak valid');

        currentPasienId = data.pasien.id;
        currentRiwayat  = data.riwayat || [];

        const tglIndoNorm = `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;
        let visitHariIni = currentRiwayat.find(r => {
            const t = String(r.tgl || '').trim();
            return t === tglIndoFull || t === tglIndoNorm || t === localDateStr;
        });

        if (visitHariIni) {
            currentKunjunganId = visitHariIni.id;
            let tdLama = String(visitHariIni.td || '');
            $('sistol').value   = tdLama.includes('/') ? tdLama.split('/')[0] : tdLama;
            $('diastol').value  = tdLama.includes('/') ? tdLama.split('/')[1] : '';
            $('nadi').value     = visitHariIni.nadi  || '';
            $('suhu').value     = visitHariIni.suhu  || '';
            $('rr').value       = visitHariIni.rr    || '';
            $('bb').value       = visitHariIni.bb    || '';
            $('tb').value       = visitHariIni.tb    || '';
            $('keluhan').value  = visitHariIni.keluhan || '';
            $('fisik').value    = visitHariIni.fisik   || '';
            let diagLama = String(visitHariIni.diag || '');
            if (diagLama.includes(" | ")) {
                $('diagnosa').value  = diagLama.split(" | ")[0];
                $('diagnosa2').value = diagLama.split(" | ")[1];
            } else {
                $('diagnosa').value  = diagLama;
                $('diagnosa2').value = "";
            }
            $('terapi').value = visitHariIni.terapi || '';
            document.querySelectorAll('[data-save="true"]').forEach(el => localStorage.setItem('rme_' + el.id, el.value));
            calculateIMT(); checkTensi();
            showToast("ℹ️ Melanjutkan data pemeriksaan hari ini", "info");
        } else {
            currentKunjunganId = currentRiwayat.length > 0 ? currentRiwayat[0].id : null;
            showToast("✅ Siap periksa: " + namaPasien, "success");
        }

        renderRiwayatList(currentRiwayat, 'historyListMedis');
        localStorage.setItem('cP_id', currentPasienId);
        localStorage.setItem('cK_id', currentKunjunganId);
        localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));

    } catch (e) {
        showToast("⚠️ Data belum sinkron: " + (e.message || 'Cek koneksi'), "warning");
        $('historyListMedis').innerHTML =
            `<div class="empty-state"><div class="empty-icon">⚠️</div>Gagal memuat riwayat. Bisa tetap input data.</div>`;
    }
}

// ── RESET SESI PENDAFTARAN ──
function resetSession() {
    clearSession();
    currentPasienId = null;
    currentKunjunganId = null;
    currentRiwayat = [];
    ['nama', 'nik', 'alamat', 'tgl_lahir'].forEach(id => { if ($(id)) $(id).value = ''; });
    if ($('jk')) $('jk').value = 'L';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.querySelectorAll('.nav-item')[0].classList.add('active-nav');
    switchPage('pageDaftar', null);
    fetchByDate();
}

// ── SCAN KTP (OCR) ──
function initScanKtp() {
    const camInput = $('camInput');
    if (!camInput) return;
    camInput.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;
        showToast("⏳ Sedang membaca KTP...", "info");
        try {
            const result = await Tesseract.recognize(file, 'ind');
            const text   = result.data.text;
            const nikMatch = text.match(/\b\d{16}\b/);
            if (nikMatch) $('nik').value = nikMatch[0];
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].toUpperCase().includes('NAMA')) {
                    let nama = lines[i].replace(/NAMA|:|Nama/gi, '').trim();
                    if (!nama && i + 1 < lines.length) nama = lines[i + 1].replace(/:/g, '').trim();
                    if (nama) $('nama').value = nama;
                    break;
                }
            }
            showToast("✅ KTP berhasil dipindai", "success");
        } catch (err) {
            showToast("❌ Gagal membaca KTP", "error");
        }
    });
}

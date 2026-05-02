// ════════════════════════════════════════════════════════
//  KLIKPRO RME — APP CONTROLLER
//  Inisialisasi aplikasi, navigasi halaman, onload
// ════════════════════════════════════════════════════════

// ── NAVIGASI HALAMAN ──
function switchPage(id, navEl) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');

    if (navEl) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
        navEl.classList.add('active-nav');
    }

    const filterDate = document.getElementById('filterDate');
    if (id === 'pageHariIni' && filterDate && filterDate.value) fetchByDate();
    if (id === 'pageUser') fetchUsers();
}

// ── INISIALISASI APLIKASI ──
async function initApp() {
    // BUG FIX: initPinLock dipanggil di sini (setelah HTML fragment ter-inject),
    // bukan dari auto-init di auth.js yang bisa race-condition.
    if (typeof initPinLock === 'function') initPinLock();

    // Gunakan $ dari utils.js (tidak perlu deklarasi ulang)
    const today        = new Date();
    const tzOffset     = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);

    // Tampilkan tanggal di header
    const headerDate = document.getElementById('headerDate');
    if (headerDate) {
        headerDate.innerText = today.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    // Set default tanggal filter
    const filterDate = document.getElementById('filterDate');
    if (filterDate) filterDate.value = localISOTime;

    // Bangun color switcher
    document.body.appendChild(buildColorSwitcher());

    // Isi datalist ICD-10
    if (typeof populateIcd10 === 'function') populateIcd10('list-icd');

    // Inisialisasi OCR scan KTP
    if (typeof initScanKtp === 'function') initScanKtp();

    // Bind format tanggal lahir
    if (typeof bindTglLahirFormat === 'function') bindTglLahirFormat('tgl_lahir');

    // Auto-save binding
    document.querySelectorAll('[data-save="true"]').forEach(el => {
        el.addEventListener('input', () => {
            localStorage.setItem('rme_' + el.id, el.value);
        });
    });

    // TTV bindings (menggunakan $ dari utils.js)
    // BUG FIX: guard tambahan — addEventListener hanya jika elemen ada
    const bbEl      = $('bb');
    const tbEl      = $('tb');
    const sistolEl  = $('sistol');
    const diastolEl = $('diastol');
    if (bbEl)      bbEl.addEventListener('input', calculateIMT);
    if (tbEl)      tbEl.addEventListener('input', calculateIMT);
    if (sistolEl)  sistolEl.addEventListener('input', checkTensi);
    if (diastolEl) diastolEl.addEventListener('input', checkTensi);

    // Pulihkan sesi pageMedis jika ada
    if (localStorage.getItem('activePage') === 'pageMedis') {
        currentPasienId    = localStorage.getItem('cP_id');
        currentKunjunganId = localStorage.getItem('cK_id');
        if (currentKunjunganId === "null") currentKunjunganId = null;

        if ($('infoPasienNama'))     $('infoPasienNama').innerText     = localStorage.getItem('cP_nama')  || '—';
        if ($('infoPasienNik'))      $('infoPasienNik').innerText      = localStorage.getItem('cP_nik')   || 'NIK: —';
        if ($('infoPasienUmur'))     $('infoPasienUmur').innerText     = localStorage.getItem('cP_umur')  || 'Umur: -';
        if ($('infoTglPemeriksaan')) {
            $('infoTglPemeriksaan').innerText     = localStorage.getItem('cTglEdit') || 'Tgl: -';
            $('infoTglPemeriksaan').style.display = 'block';
        }

        try {
            currentRiwayat = JSON.parse(localStorage.getItem('cP_riwayat') || '[]');
            if (typeof renderRiwayatList === 'function')
                renderRiwayatList(currentRiwayat, 'historyListMedis');
        } catch (e) {
            currentRiwayat = [];
        }

        if (typeof loadAutosave === 'function') loadAutosave();
        // Hitung IMT & cek tensi setelah autosave dimuat
        calculateIMT();
        checkTensi();

        switchPage('pageMedis', null);
    } else {
        if (typeof clearSession === 'function') clearSession();
    }

    // Ambil data awal dari server
    try {
        const res  = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "initData", filterDate: localISOTime })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        allPatients      = data.pasien || [];
        kunjunganHariIni = data.hariIni || [];

        const listPasien = document.getElementById('list-pasien');
        if (listPasien && allPatients.length > 0) {
            allPatients.forEach(p => {
                const opt   = document.createElement('option');
                opt.value   = p.nama;
                listPasien.appendChild(opt);
            });
        }

        if (typeof renderKunjunganHariIni === 'function') renderKunjunganHariIni();
    } catch (e) {
        showToast("⚡ Gagal terhubung ke server. Cek koneksi.", "error");
    }
}

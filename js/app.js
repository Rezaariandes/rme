// ════════════════════════════════════════════════════════
//  KLIKPRO RME — APP CONTROLLER
//  Inisialisasi aplikasi, navigasi halaman, dan onload
// ════════════════════════════════════════════════════════

// ── NAVIGASI HALAMAN ──
function switchPage(id, navEl) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    if (navEl) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
        navEl.classList.add('active-nav');
    }

    if (id === 'pageHariIni' && document.getElementById('filterDate').value) fetchByDate();
    if (id === 'pageUser') fetchUsers();
}

// ── INISIALISASI SAAT HALAMAN DIMUAT (Dipanggil dari index.html) ──
async function initApp() {
    const today        = new Date();
    const tzOffset     = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);

    // Tampilkan tanggal di header
    document.getElementById('headerDate').innerText =
        new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    // Set tanggal filter default ke hari ini
    document.getElementById('filterDate').value = localISOTime;

    // Bangun color switcher
    document.body.appendChild(buildColorSwitcher());

    // Isi datalist ICD-10
    if(typeof populateIcd10 === 'function') populateIcd10('list-icd');

    // Inisialisasi OCR scan KTP
    if(typeof initScanKtp === 'function') initScanKtp();

    // Bind format tanggal lahir
    if(typeof bindTglLahirFormat === 'function') bindTglLahirFormat('tgl_lahir');

    // Auto-save binding
    document.querySelectorAll('[data-save="true"]').forEach(el => {
        el.addEventListener('input', () => { localStorage.setItem('rme_' + el.id, el.value); });
    });

    // TTV binding
    const $ = id => document.getElementById(id);
    if($('bb')) $('bb').addEventListener('input', calculateIMT);
    if($('tb')) $('tb').addEventListener('input', calculateIMT);
    if($('sistol')) $('sistol').addEventListener('input', checkTensi);
    if($('diastol')) $('diastol').addEventListener('input', checkTensi);

    // Pulihkan sesi pageMedis jika ada
    if (localStorage.getItem('activePage') === 'pageMedis') {
        currentPasienId    = localStorage.getItem('cP_id');
        currentKunjunganId = localStorage.getItem('cK_id');
        if (currentKunjunganId === "null") currentKunjunganId = null;
        if($('infoPasienNama')) $('infoPasienNama').innerText     = localStorage.getItem('cP_nama')  || '—';
        if($('infoPasienNik')) $('infoPasienNik').innerText      = localStorage.getItem('cP_nik')   || 'NIK: —';
        if($('infoPasienUmur')) $('infoPasienUmur').innerText     = localStorage.getItem('cP_umur')  || 'Umur: -';
        if($('infoTglPemeriksaan')) {
            $('infoTglPemeriksaan').innerText = localStorage.getItem('cTglEdit') || 'Tgl: -';
            $('infoTglPemeriksaan').style.display = 'block';
        }
        try {
            currentRiwayat = JSON.parse(localStorage.getItem('cP_riwayat') || '[]');
            if(typeof renderRiwayatList === 'function') renderRiwayatList(currentRiwayat, 'historyListMedis');
        } catch (e) { }
        if(typeof loadAutosave === 'function') loadAutosave();
        switchPage('pageMedis', null);
    } else {
        if(typeof clearSession === 'function') clearSession();
    }

    // Ambil data awal dari server
    try {
        const res  = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "initData", filterDate: localISOTime })
        });
        const data = await res.json();
        allPatients      = data.pasien;
        kunjunganHariIni = data.hariIni || [];

        const listPasien = document.getElementById('list-pasien');
        if(listPasien && allPatients) {
            allPatients.forEach(p => listPasien.appendChild(new Option(p.nama, p.nama)));
        }
        if(typeof renderKunjunganHariIni === 'function') renderKunjunganHariIni();
    } catch (e) {
        showToast("⚡ Sistem offline (CORS/Jaringan)", "error");
    }
}
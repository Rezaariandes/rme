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
    if (id === 'pageUser')     fetchUsers();
    if (id === 'pageSettings') {
        // Hanya Admin/Dokter yang boleh akses Settings
        if (typeof loggedInUser !== 'undefined' && loggedInUser) {
            const jabatan = (loggedInUser.jabatan || '').toLowerCase();
            if (jabatan === 'paramedis') {
                showToast("⛔ Akses Settings hanya untuk Admin & Dokter", "error");
                switchPage('pageDaftar', document.querySelector('.nav-item'));
                return;
            }
        }
        if (typeof initSettings === 'function') initSettings();
    }
}

// ── MUAT KONFIGURASI AWAL DARI SERVER (setelah login) ──
async function loadRuntimeSettings() {
    try {
        const res  = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getSettings" })
        });
        const data = await res.json();
        if (data.status !== "success" || !data.settings) return;

        const s = data.settings;

        // Update konstanta global
        if (s.klinik_nama)  window.KLINIK_NAMA  = s.klinik_nama;
        if (s.klinik_title) window.KLINIK_TITLE = s.klinik_title;
        if (s.jabatan_medis) {
            const jabList = s.jabatan_medis.split(',').map(j => j.trim()).filter(j => j);
            if (jabList.length > 0) window.JABATAN_MEDIS = jabList;
        }

        // Update header
        const h1   = document.querySelector('.app-title h1');
        const span = document.querySelector('.app-title span');
        if (h1   && s.klinik_title) h1.innerText   = s.klinik_title;
        if (span && s.klinik_nama)  span.innerText  = s.klinik_nama;

        // ── OCR API KEY — dari Settings, bukan hardcoded ──
        if (s.ocr_api_key && s.ocr_api_key.trim() !== '') {
            window.OCR_API_KEY = s.ocr_api_key.trim();
        }

        // Update AI Keys — skip jika kosong/[]
        const providers = ['gemini','groq','openrouter','openai','mistral','cohere'];
        providers.forEach(p => {
            const rawKey = s[`ai_${p}`];
            if (rawKey && typeof rawKey === 'string') {
                const trimmed = rawKey.trim();
                if (trimmed !== '' && trimmed !== '[]') {
                    try {
                        const keys = JSON.parse(trimmed);
                        if (Array.isArray(keys) && keys.length > 0 && typeof AI_KEYS !== 'undefined') {
                            AI_KEYS[p] = keys;
                            console.log('[Klikpro] AI key loaded: ' + p + ' (' + keys.length + ' key)');
                        }
                    } catch(e) {}
                }
            }
        });

        // Simpan data dokter aktif
        if (data.dokter) window._dokterAktif = data.dokter;

    } catch (e) {
        // Gagal muat settings tidak kritis, lanjutkan dengan nilai default
        console.warn('[Klikpro] Gagal muat runtime settings:', e.message);
    }
}

// ── INISIALISASI APLIKASI ──
async function initApp() {
    if (typeof initPinLock === 'function') initPinLock();

    const today        = new Date();
    const tzOffset     = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);

    const headerDate = document.getElementById('headerDate');
    if (headerDate) {
        headerDate.innerText = today.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    const filterDate = document.getElementById('filterDate');
    if (filterDate) filterDate.value = localISOTime;

    document.body.appendChild(buildColorSwitcher());

    if (typeof populateIcd10   === 'function') populateIcd10('list-icd');
    if (typeof initScanKtp     === 'function') initScanKtp();
    if (typeof bindTglLahirFormat === 'function') bindTglLahirFormat('tgl_lahir');

    document.querySelectorAll('[data-save="true"]').forEach(el => {
        el.addEventListener('input', () => {
            localStorage.setItem('rme_' + el.id, el.value);
        });
    });

    const bbEl      = $('bb');
    const tbEl      = $('tb');
    const sistolEl  = $('sistol');
    const diastolEl = $('diastol');
    if (bbEl)      bbEl.addEventListener('input', calculateIMT);
    if (tbEl)      tbEl.addEventListener('input', calculateIMT);
    if (sistolEl)  sistolEl.addEventListener('input', checkTensi);
    if (diastolEl) diastolEl.addEventListener('input', checkTensi);

    ['lab_gds','lab_chol','lab_ua'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', checkLabAlert);
    });

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
        calculateIMT();
        checkTensi();
        checkLabAlert();

        switchPage('pageMedis', null);
    } else {
        if (typeof clearSession === 'function') clearSession();
    }

    // ── FIX RACE CONDITION ──
    // loadRuntimeSettings dijalankan DULU (await), baru initData.
    // Ini menjamin AI_KEYS & OCR_API_KEY sudah terisi sebelum UI aktif,
    // sehingga user tidak bisa klik Rekomendasi AI sebelum key tersedia.
    try {
        await loadRuntimeSettings();
    } catch(e) {
        console.warn('[Klikpro] Settings gagal, lanjut dengan default');
    }

    // Ambil data awal dari server
    try {
        const res  = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "initData", filterDate: localISOTime })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        allPatients      = data.pasien   || [];
        kunjunganHariIni = data.hariIni  || [];

        const listPasien = document.getElementById('list-pasien');
        if (listPasien && allPatients.length > 0) {
            allPatients.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.nama;
                listPasien.appendChild(opt);
            });
        }

        if (typeof renderKunjunganHariIni === 'function') renderKunjunganHariIni();

    } catch (e) {
        showToast("⚡ Gagal terhubung ke server. Cek koneksi.", "error");
    }
}

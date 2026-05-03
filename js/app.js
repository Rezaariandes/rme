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

// ── MUAT KONFIGURASI AWAL DARI SUPABASE ──
async function loadRuntimeSettings() {
    try {
        // FIX: Ganti fetch(APP_URL) → sb_getSettings()
        const data = await sb_getSettings();
        if (data.status !== "success" || !data.settings) return;

        const s = data.settings;

        if (s.klinik_nama)  window.KLINIK_NAMA  = s.klinik_nama;
        if (s.klinik_title) window.KLINIK_TITLE = s.klinik_title;
        if (s.jabatan_medis) {
            const jabList = s.jabatan_medis.split(',').map(j => j.trim()).filter(j => j);
            if (jabList.length > 0) window.JABATAN_MEDIS = jabList;
        }

        const h1   = document.querySelector('.app-title h1');
        const span = document.querySelector('.app-title span');
        if (h1   && s.klinik_title) h1.innerText   = s.klinik_title;
        if (span && s.klinik_nama)  span.innerText  = s.klinik_nama;

        if (s.ocr_api_key && s.ocr_api_key.trim() !== '') {
            window.OCR_API_KEY = s.ocr_api_key.trim();
        }

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

        if (data.dokter) window._dokterAktif = data.dokter;

        // BUG F FIX: Terapkan hak akses modul setelah settings dimuat
        // applyModuleAccess dipanggil di sini (bukan hanya di auth.js) agar
        // window._isParamedis tersedia sebelum renderKunjunganHariIni dijalankan
        if (typeof applyModuleAccess === 'function' &&
            typeof loggedInUser !== 'undefined' && loggedInUser && loggedInUser.jabatan) {
            applyModuleAccess(loggedInUser.jabatan);
        }

    } catch (e) {
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

    if (typeof populateIcd10      === 'function') populateIcd10('list-icd');
    if (typeof initScanKtp        === 'function') initScanKtp();
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

        // FIX Bug 3: Saat reload, fetch data kunjungan langsung dari Supabase
        // agar form selalu menampilkan data aktual dari database — bukan hanya
        // dari localStorage yang bisa stale atau kosong.
        if (currentKunjunganId) {
            try {
                const kunjunganData = await sb_getKunjunganById(currentKunjunganId);
                if (kunjunganData && typeof _isiFormDariKunjungan === 'function') {
                    _isiFormDariKunjungan(kunjunganData);
                    document.querySelectorAll('[data-save="true"]').forEach(el =>
                        localStorage.setItem('rme_' + el.id, el.value)
                    );
                } else {
                    // Fallback ke autosave localStorage jika fetch gagal
                    if (typeof loadAutosave === 'function') loadAutosave();
                }
            } catch (e) {
                console.warn('[Klikpro] Gagal fetch kunjungan saat reload, fallback autosave:', e.message);
                if (typeof loadAutosave === 'function') loadAutosave();
            }
        } else {
            // Kunjungan baru (belum disimpan) — pakai autosave
            if (typeof loadAutosave === 'function') loadAutosave();
        }

        calculateIMT();
        checkTensi();
        checkLabAlert();

        switchPage('pageMedis', null);
    } else {
        if (typeof clearSession === 'function') clearSession();
    }

    // FIX F: loadRuntimeSettings dipanggil SEBELUM sb_initData agar
    // applyModuleAccess & _isParamedis sudah tersedia saat render pertama.
    try {
        await loadRuntimeSettings();
    } catch(e) {
        console.warn('[Klikpro] Settings gagal, lanjut dengan default');
    }

    // FIX: Ambil data awal via sb_initData (Supabase) — bukan fetch(APP_URL)
    try {
        const data = await sb_initData(localISOTime);

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
        console.error('[Klikpro] initData error:', e);
    }
}

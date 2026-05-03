// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL KUNJUNGAN PASIEN
//  Mengelola daftar kunjungan harian & rekam medis
// ════════════════════════════════════════════════════════

let kunjunganHariIni   = [];
let currentKunjunganId = null;

// ════════════════════════════════════════════════════════
//  VALIDASI NILAI TANDA VITAL
//  Rentang absolut yang masih physiologically possible
// ════════════════════════════════════════════════════════
const VITAL_RULES = {
    sistol:   { min: 50,  max: 300, label: 'Sistol',       unit: 'mmHg' },
    diastol:  { min: 30,  max: 200, label: 'Diastol',      unit: 'mmHg' },
    nadi:     { min: 20,  max: 300, label: 'Nadi',         unit: 'x/mnt' },
    suhu:     { min: 30,  max: 45,  label: 'Suhu',         unit: '°C' },
    rr:       { min: 5,   max: 60,  label: 'Laju Napas',   unit: 'x/mnt' },
    bb:       { min: 1,   max: 300, label: 'Berat Badan',  unit: 'kg' },
    tb:       { min: 30,  max: 250, label: 'Tinggi Badan', unit: 'cm' },
    lab_gds:  { min: 20,  max: 800, label: 'GDS',          unit: 'mg/dL' },
    lab_chol: { min: 50,  max: 800, label: 'Kolesterol',   unit: 'mg/dL' },
    lab_ua:   { min: 1,   max: 20,  label: 'Asam Urat',    unit: 'mg/dL' },
};

function validasiNilaiVital() {
    const errors = [];
    Object.entries(VITAL_RULES).forEach(([id, rule]) => {
        const el = $(id);
        if (!el || el.value === '') return; // boleh kosong
        const val = parseFloat(el.value);
        if (isNaN(val)) {
            errors.push(`${rule.label}: bukan angka valid`);
            return;
        }
        if (val < rule.min || val > rule.max) {
            errors.push(`${rule.label}: ${val} ${rule.unit} (rentang valid: ${rule.min}–${rule.max})`);
        }
    });
    // Validasi silang: sistol harus > diastol
    const sis = parseFloat($('sistol')?.value  || '');
    const dia = parseFloat($('diastol')?.value || '');
    if (!isNaN(sis) && !isNaN(dia) && sis <= dia) {
        errors.push(`Tekanan darah tidak valid: Sistol (${sis}) harus lebih besar dari Diastol (${dia})`);
    }
    return errors;
}

// ── AMBIL DATA KUNJUNGAN BERDASARKAN TANGGAL ──
async function fetchByDate() {
    const filterEl = $('filterDate');
    if (!filterEl || !filterEl.value) return;
    const listEl = $('listHariIni');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat data...</div>`;
    try {
        // FIX: Ganti fetch(APP_URL) → sb_initData()
        const data = await sb_initData(filterEl.value);
        if (data.pasien) allPatients = data.pasien;
        kunjunganHariIni = data.hariIni || [];
        renderKunjunganHariIni();
    } catch (e) {
        showToast("❌ Gagal memuat data kunjungan", "error");
        if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div>Gagal memuat. Cek koneksi.</div>`;
    }
}

// ── RENDER DAFTAR KUNJUNGAN HARI INI ──
function renderKunjunganHariIni() {
    const container = $('listHariIni');
    const statTotal = $('statTotal');
    if (statTotal) statTotal.innerText = kunjunganHariIni.length;
    if (!container) return;

    if (kunjunganHariIni.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🗓️</div>Belum ada pasien hari ini.</div>`;
        return;
    }

    const sorted = [...kunjunganHariIni].sort((a, b) => {
        if (a.status !== b.status) return a.status === "Selesai" ? 1 : -1;
        return String(a.waktu || "00:00").localeCompare(String(b.waktu || "00:00"));
    });

    container.innerHTML = sorted.map(h => {
        const isDone    = h.status === 'Selesai';
        const diagRow   = window._isParamedis ? '' : `<div style="font-size:11px;color:var(--text-muted);">Diagnosa: ${h.diag || '-'}</div>`;
        // FIX: Jika h.nama kosong (join gagal di sb_initData), cari dari allPatients
        const tampilNama = h.nama || (allPatients.find(x => x.id === h.pasienId) || {}).nama || '(Nama tidak diketahui)';
        return `
        <div class="visit-card" style="opacity:${isDone ? '0.62' : '1'};" onclick="bukaRekamMedisHariIni('${h.id}')">
            <div class="visit-time-badge">${h.waktu || '-'}</div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tampilNama}</div>
                <div style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">Keluhan: ${h.keluhan || '-'}</div>
                <div style="font-size:11px; color:var(--text-muted);">TTV: ${h.td || '-'} mmHg | ${h.suhu || '-'}°C</div>
                ${diagRow}
            </div>
            <div class="status-badge ${isDone ? 'status-done' : 'status-wait'}">${isDone ? '✅ Selesai' : '⏳ Menunggu'}</div>
        </div>`;
    }).join('');
}

// ── BUKA REKAM MEDIS DARI KUNJUNGAN HARI INI ──
async function bukaRekamMedisHariIni(kId) {
    if (!canAccessMedis()) return;

    const h = kunjunganHariIni.find(x => x.id === kId);
    if (!h) return showToast("❌ Data tidak ditemukan", "error");

    // FIX: Cari pasien di allPatients — coba via pasienId dulu, lalu via nama
    const p = allPatients.find(x => x.id === h.pasienId) || allPatients.find(x => x.nama && h.nama && x.nama === h.nama);

    // FIX: Pastikan namaPasien selalu terisi — prioritas: dari pasien DB, lalu dari h.nama
    const namaPasien = (p && p.nama) ? p.nama : (h.nama || '');

    if (p) {
        if ($('nama'))      $('nama').value      = p.nama;
        if ($('nik'))       $('nik').value        = p.nik    || '';
        if ($('jk'))        $('jk').value         = p.jk     || 'L';
        if ($('alamat'))    $('alamat').value     = p.alamat || '';
        if ($('tgl_lahir')) $('tgl_lahir').value  = formatTglIndo(p.tgl) || '';
    } else {
        if ($('nama')) $('nama').value = namaPasien;
    }

    currentPasienId    = h.pasienId;
    currentKunjunganId = h.id;
    const umur         = p ? hitungUmur(p.tgl) : '-';

    if ($('infoPasienNama')) $('infoPasienNama').innerText = namaPasien || '—';
    if ($('infoPasienNik'))  $('infoPasienNik').innerText  = "NIK: " + (p ? (p.nik || '-') : '-');
    if ($('infoPasienUmur')) $('infoPasienUmur').innerText = "Umur: " + umur;

    const fVal = $('filterDate') ? $('filterDate').value : '';
    const tanggalRekamLabel = fVal ? "Tgl: " + formatTglIndo(fVal) : "Tgl: " + h.tgl;
    if ($('infoTglPemeriksaan')) {
        $('infoTglPemeriksaan').innerText     = tanggalRekamLabel;
        $('infoTglPemeriksaan').style.display = 'block';
    }

    // FIX: Data di array kunjunganHariIni (dari sb_initData) hanya berisi field ringkas
    // (td, suhu, keluhan, diag) — field seperti nadi, rr, bb, tb, lab_gds, lab_chol,
    // lab_ua, fisik, terapi, surat_sakit tidak ikut di-map.
    // Solusi: fetch data kunjungan lengkap dari Supabase via sb_getKunjunganById()
    // sebelum mengisi form, agar semua field tampil dengan benar.
    try {
        const kunjunganLengkap = await sb_getKunjunganById(kId);
        _isiFormDariKunjungan(kunjunganLengkap || h);
    } catch (e) {
        console.warn('[Klikpro] Gagal fetch kunjungan lengkap, fallback ke data ringkas:', e.message);
        _isiFormDariKunjungan(h);
    }
    document.querySelectorAll('[data-save="true"]').forEach(el => localStorage.setItem('rme_' + el.id, el.value));
    calculateIMT(); checkTensi(); checkLabAlert();

    localStorage.setItem('activePage', 'pageMedis');
    localStorage.setItem('cP_id',     currentPasienId);
    localStorage.setItem('cK_id',     currentKunjunganId);
    localStorage.setItem('cP_nama',   namaPasien);
    localStorage.setItem('cP_nik',    "NIK: " + (p ? (p.nik || '-') : '-'));
    localStorage.setItem('cP_umur',   "Umur: " + umur);
    localStorage.setItem('cTglEdit',  tanggalRekamLabel);

    if ($('historyListMedis')) {
        $('historyListMedis').innerHTML =
            `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat riwayat...</div>`;
    }
    switchPage('pageMedis', null);

    try {
        const today        = new Date();
        const tzOffset     = today.getTimezoneOffset() * 60000;
        const localDateStr = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);
        // FIX: Ganti fetch(APP_URL) → sb_checkAndUpsertPasien()
        const data = await sb_checkAndUpsertPasien({
            nama: h.nama,
            nik:  p ? (p.nik || '') : '',
            localDate: localDateStr
        });
        if (data && data.riwayat) {
            currentRiwayat = data.riwayat;
            renderRiwayatList(currentRiwayat, 'historyListMedis');
            localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));
        } else {
            if ($('historyListMedis')) {
                $('historyListMedis').innerHTML =
                    `<div class="empty-state"><div class="empty-icon">📂</div>Belum ada riwayat.</div>`;
            }
        }
    } catch (e) {
        if ($('historyListMedis')) {
            $('historyListMedis').innerHTML =
                `<div class="empty-state"><div class="empty-icon">⚠️</div>Gagal memuat riwayat.</div>`;
        }
    }
}

// ── SIMPAN REKAM MEDIS ──
async function saveAll() {
    const d1     = $('diagnosa')  ? $('diagnosa').value.trim()  : '';
    const d2     = $('diagnosa2') ? $('diagnosa2').value.trim() : '';
    const terapi = $('terapi')    ? $('terapi').value.trim()    : '';
    const hasData = ['sistol','diastol','nadi','suhu','rr','bb','tb','lab_gds','lab_chol','lab_ua'].some(id => $(id) && $(id).value !== "");

    if (!d1 && !hasData) return showToast("⚠️ Isi Diagnosa Utama atau Tanda Vital!", "error");

    // ── VALIDASI NILAI VITAL ──
    const vErrors = validasiNilaiVital();
    if (vErrors.length > 0) {
        showToast("⚠️ " + vErrors[0], "error");
        if (vErrors.length > 1) {
            vErrors.slice(1).forEach((msg, i) => {
                setTimeout(() => showToast("⚠️ " + msg, "error"), (i + 1) * 800);
            });
        }
        return;
    }

    const isSelesai = (d1 !== "" && terapi !== "");
    const btn = $('btnSave');
    if (btn) { btn.disabled = true; btn.innerText = "Menyimpan..."; }

    const sis = $('sistol')  ? $('sistol').value  : '';
    const dia = $('diastol') ? $('diastol').value : '';
    const tdGabungan = (sis || dia) ? ((sis || '-') + '/' + (dia || '-')) : '';

    // BUG B FIX: Helper konversi string kosong ke null untuk field numerik
    const _num = id => { const el = $(id); return (el && el.value !== '') ? el.value : null; };

    const today        = new Date();
    const tzOffset     = today.getTimezoneOffset() * 60000;
    const localDateStr = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);
    const localTimeStr = String(today.getHours()).padStart(2, '0') + ':' + String(today.getMinutes()).padStart(2, '0');

    const payload = {
        action: "saveKunjungan",
        pasienId:    currentPasienId,
        kunjunganId: currentKunjunganId || "",
        localDate:   localDateStr,
        localTime:   localTimeStr,
        nik:      $('nik')      ? $('nik').value      : '',
        nama:     $('nama')     ? $('nama').value     : '',
        tgl_lahir: $('tgl_lahir') ? $('tgl_lahir').value : '',
        jk:       $('jk')       ? $('jk').value       : 'L',
        alamat:   $('alamat')   ? $('alamat').value   : '',
        td:       tdGabungan || null,
        nadi:     _num('nadi'),
        rr:       _num('rr'),
        suhu:     _num('suhu'),
        bb:       _num('bb'),
        tb:       _num('tb'),
        lab_gds:  _num('lab_gds'),
        lab_chol: _num('lab_chol'),
        lab_ua:   _num('lab_ua'),
        // Darah rutin
        lab_hb:          _num('lab_hb'),
        lab_trombosit:   _num('lab_trombosit'),
        lab_leukosit:    _num('lab_leukosit'),
        lab_eritrosit:   _num('lab_eritrosit'),
        lab_hematokrit:  _num('lab_hematokrit'),
        // Triple eliminasi
        lab_hiv:       $('lab_hiv')      ? $('lab_hiv').value      : null,
        lab_sifilis:   $('lab_sifilis')  ? $('lab_sifilis').value  : null,
        lab_hepatitis: $('lab_hepatitis')? $('lab_hepatitis').value : null,
        // Profil lemak
        lab_hdl: _num('lab_hdl'),
        lab_ldl: _num('lab_ldl'),
        lab_tg:  _num('lab_tg'),
        // Gula darah
        lab_gdp:   _num('lab_gdp'),
        lab_hba1c: _num('lab_hba1c'),
        // Fungsi hati
        lab_sgot: _num('lab_sgot'),
        lab_sgpt: _num('lab_sgpt'),
        // Fungsi ginjal
        lab_ureum:    _num('lab_ureum'),
        lab_creatinin:_num('lab_creatinin'),
        keluhan:  $('keluhan')  ? $('keluhan').value  : '',
        fisik:    $('fisik')    ? $('fisik').value    : '',
        // BUG B FIX: diagnosa1 & diagnosa2 dikirim terpisah (bukan digabung dengan |)
        diagnosa:  d1,
        diagnosa2: d2,
        terapi:   terapi,
        suratSakit: ($('suratSakit') && $('suratSakit').checked) ? "YA" : "TIDAK"
    };

    try {
        // FIX: Ganti fetch(APP_URL) → sb_saveKunjungan()
        const result = await sb_saveKunjungan(payload);

        if (result && result.status === "Sukses") {
            if (!currentKunjunganId && result.kunjunganId) {
                currentKunjunganId = result.kunjunganId;
            }

            // BUG FIX: Update status di array lokal secara optimistis
            // agar tampilan Kunjungan Hari Ini langsung berubah tanpa menunggu refetch
            if (isSelesai && currentKunjunganId) {
                const idx = kunjunganHariIni.findIndex(x => x.id === currentKunjunganId);
                if (idx !== -1) kunjunganHariIni[idx].status = 'Selesai';
            }

            if (isSelesai) {
                showToast("✅ Rekam medis selesai & tersimpan!", "success");
                if (btn) btn.innerText = "✓ Tersimpan!";
                clearSession();
                setTimeout(() => {
                    currentPasienId = null; currentKunjunganId = null; currentRiwayat = [];
                    ['nama','nik','alamat','tgl_lahir'].forEach(id => { if ($(id)) $(id).value = ''; });
                    if ($('jk')) $('jk').value = 'L';
                    if (btn) { btn.disabled = false; btn.innerText = "✓ Simpan Rekam Medis"; }
                    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
                    const firstNav = document.querySelector('.nav-item');
                    if (firstNav) firstNav.classList.add('active-nav');
                    switchPage('pageDaftar', null);
                    fetchByDate();
                }, 1400);
            } else {
                showToast("✅ Data tersimpan sementara", "success");
                if (btn) btn.innerText = "✓ Disimpan!";
                setTimeout(() => {
                    if (btn) { btn.disabled = false; btn.innerText = "✓ Simpan Rekam Medis"; }
                }, 1400);
            }
        } else {
            throw new Error(result.error || "Gagal menyimpan");
        }
    } catch (e) {
        showToast("❌ Gagal menyimpan: " + (e.message || ''), "error");
        if (btn) { btn.disabled = false; btn.innerText = "✓ Simpan Rekam Medis"; }
    }
}

// ── RENDER RIWAYAT KUNJUNGAN ──
function renderRiwayatList(riwayatArr, containerId) {
    const c = $(containerId);
    if (!c) return;
    if (riwayatArr && riwayatArr.length > 0) {
        c.innerHTML = '<div class="section-divider"><span>Riwayat Kunjungan</span></div>' +
            riwayatArr.map((r, i) => `
                <div class="riwayat-item" onclick="openModal(${i})">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <div class="riwayat-date">📅 ${r.tgl ? formatTglIndo(r.tgl) : '-'} <span style="color:var(--text-muted); font-weight:normal;">${r.waktu ? '(' + r.waktu + ')' : ''}</span></div>
                        <div style="font-size:10px; color:var(--primary); font-weight:700;">Lihat Detail 👁️</div>
                    </div>
                    <div style="font-size:11px; margin-bottom:6px; color:var(--text-muted); background:var(--surface-2); padding:4px 8px; border-radius:8px;">
                        <b>TTV:</b> TD ${r.td||'-'} | N ${r.nadi||'-'} | S ${r.suhu||'-'} | RR ${r.rr||'-'} | BB ${r.bb||'-'}
                    </div>
                    ${(r.lab_gds||r.lab_chol||r.lab_ua) ? `<div style="font-size:11px;margin-bottom:6px;color:#7c3aed;background:rgba(124,58,237,0.07);padding:4px 8px;border-radius:8px;"><b>🔬 Lab:</b> GDS ${r.lab_gds||'-'} | Chol ${r.lab_chol||'-'} | AU ${r.lab_ua||'-'}</div>` : ''}
                    ${window._isParamedis ? '' : `<div class="riwayat-diag" style="margin-bottom:3px;">🩺 ${r.diag || 'Menunggu Diagnosa'}</div>`}
                    <div class="riwayat-keluhan" style="color:var(--text); border-top:1px dashed var(--border); padding-top:4px; margin-bottom:3px;"><b>Keluhan:</b> ${r.keluhan || '-'}</div>
                    <div class="riwayat-keluhan" style="color:var(--text);"><b>Terapi:</b> ${r.terapi || '-'}</div>
                </div>
            `).join('');
    } else {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div>Belum ada riwayat.</div>`;
    }
}

// ════════════════════════════════════════════════════════
//  DYNAMIC LAB SECTION — render berdasarkan window._labAktif
// ════════════════════════════════════════════════════════

// Definisi lengkap semua field lab (mirror dari settings.js LAB_GROUPS)
const ALL_LAB_FIELDS = [
    { id: 'lab_gds',       label: 'GDS',           unit: 'mg/dL',    step: '1',   group: 'dasar' },
    { id: 'lab_chol',      label: 'Kolesterol',     unit: 'mg/dL',    step: '1',   group: 'dasar' },
    { id: 'lab_ua',        label: 'Asam Urat',      unit: 'mg/dL',    step: '0.1', group: 'dasar' },
    { id: 'lab_hb',        label: 'HB',             unit: 'g/dL',     step: '0.1', group: 'darah_rutin' },
    { id: 'lab_trombosit', label: 'Trombosit',      unit: 'ribu/µL',  step: '1',   group: 'darah_rutin' },
    { id: 'lab_leukosit',  label: 'Leukosit',       unit: 'ribu/µL',  step: '0.1', group: 'darah_rutin' },
    { id: 'lab_eritrosit', label: 'Eritrosit',      unit: 'juta/µL',  step: '0.01',group: 'darah_rutin' },
    { id: 'lab_hematokrit',label: 'Hematokrit',     unit: '%',        step: '0.1', group: 'darah_rutin' },
    { id: 'lab_hiv',       label: 'HIV',            unit: 'hasil',    step: null,  group: 'triple', type: 'select', opts: ['—','Non-Reaktif','Reaktif'] },
    { id: 'lab_sifilis',   label: 'Sifilis',        unit: 'hasil',    step: null,  group: 'triple', type: 'select', opts: ['—','Non-Reaktif','Reaktif'] },
    { id: 'lab_hepatitis', label: 'Hepatitis B',    unit: 'hasil',    step: null,  group: 'triple', type: 'select', opts: ['—','Non-Reaktif','Reaktif'] },
    { id: 'lab_hdl',       label: 'HDL',            unit: 'mg/dL',    step: '1',   group: 'lemak' },
    { id: 'lab_ldl',       label: 'LDL',            unit: 'mg/dL',    step: '1',   group: 'lemak' },
    { id: 'lab_tg',        label: 'Trigliserida',   unit: 'mg/dL',    step: '1',   group: 'lemak' },
    { id: 'lab_gdp',       label: 'GDP',            unit: 'mg/dL',    step: '1',   group: 'gula' },
    { id: 'lab_hba1c',     label: 'HbA1c',          unit: '%',        step: '0.1', group: 'gula' },
    { id: 'lab_sgot',      label: 'SGOT',           unit: 'U/L',      step: '1',   group: 'hati' },
    { id: 'lab_sgpt',      label: 'SGPT',           unit: 'U/L',      step: '1',   group: 'hati' },
    { id: 'lab_ureum',     label: 'Ureum',          unit: 'mg/dL',    step: '1',   group: 'ginjal' },
    { id: 'lab_creatinin', label: 'Kreatinin',      unit: 'mg/dL',    step: '0.01',group: 'ginjal' },
];

// Grup label untuk tampilan
const LAB_GROUP_LABELS = {
    dasar:       '🩸 Lab Dasar',
    darah_rutin: '🔴 Darah Rutin',
    triple:      '🧬 Triple Eliminasi',
    lemak:       '💧 Profil Lemak',
    gula:        '🍬 Gula Darah',
    hati:        '🫀 Fungsi Hati',
    ginjal:      '🫘 Fungsi Ginjal',
};

function _renderSectionLabDinamic() {
    const section = $('sectionLab');
    if (!section) return;

    const labAktif = window._labAktif || { lab_gds: true, lab_chol: true, lab_ua: true };
    const activeFields = ALL_LAB_FIELDS.filter(f => labAktif[f.id]);

    if (activeFields.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';

    // Kelompokkan per group
    const grouped = {};
    activeFields.forEach(f => {
        if (!grouped[f.group]) grouped[f.group] = [];
        grouped[f.group].push(f);
    });

    let html = `<div class="section-divider"><span>🔬 Hasil Laboratorium</span></div>`;

    Object.entries(grouped).forEach(([grp, fields]) => {
        html += `<div style="margin-bottom:10px;">`;
        if (Object.keys(grouped).length > 1) {
            html += `<div style="font-size:10px;font-weight:700;color:var(--primary,#2563eb);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">${LAB_GROUP_LABELS[grp] || grp}</div>`;
        }
        html += `<div class="row g-2">`;
        fields.forEach(f => {
            const colClass = fields.length === 1 ? 'col-6' : 'col-4';
            if (f.type === 'select') {
                html += `<div class="${colClass}"><div class="ttv-item">
                    <label>${f.label} <span style="font-size:9px;font-weight:500;color:var(--text-muted);">(${f.unit})</span></label>
                    <select id="${f.id}" class="form-control" data-save="true" style="font-size:12px;padding:4px 6px;height:36px;">
                        ${(f.opts||[]).map(o => `<option value="${o === '—' ? '' : o}">${o}</option>`).join('')}
                    </select>
                </div></div>`;
            } else {
                html += `<div class="${colClass}"><div class="ttv-item">
                    <label>${f.label} <span style="font-size:9px;font-weight:500;color:var(--text-muted);">(${f.unit})</span></label>
                    <input type="number" id="${f.id}" placeholder="—" data-save="true" step="${f.step || 1}">
                </div></div>`;
            }
        });
        html += `</div></div>`;
    });

    html += `<div id="labAlert" style="display:none;font-size:11px;font-weight:700;padding:6px 10px;border-radius:8px;margin-bottom:10px;background:rgba(239,68,68,0.09);color:#dc2626;border:1px solid rgba(239,68,68,0.25);"></div>`;

    section.innerHTML = html;

    // Re-bind autosave & event listeners untuk field baru
    section.querySelectorAll('[data-save="true"]').forEach(el => {
        el.addEventListener('input', () => {
            localStorage.setItem('rme_' + el.id, el.value);
            checkLabAlert();
        });
        // Restore nilai dari localStorage
        const saved = localStorage.getItem('rme_' + el.id);
        if (saved !== null) el.value = saved;
    });

    checkLabAlert();
}

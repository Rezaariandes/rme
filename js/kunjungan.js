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

// ════════════════════════════════════════════════════════
//  STATUS PENANDA: OBAT & PEMBAYARAN
//  Disimpan di localStorage dengan key: klikpro_status_<kunjunganId>
// ════════════════════════════════════════════════════════

function _getStatusKunjungan(kId) {
    try {
        const raw = localStorage.getItem('klikpro_status_' + kId);
        return raw ? JSON.parse(raw) : { obat: false, bayar: false };
    } catch(e) {
        return { obat: false, bayar: false };
    }
}

function _setStatusKunjungan(kId, field, value) {
    const s = _getStatusKunjungan(kId);
    s[field] = value;
    localStorage.setItem('klikpro_status_' + kId, JSON.stringify(s));
}

/** Toggle status obat / bayar dari card kunjungan */
function toggleStatusKunjungan(event, kId, field) {
    event.stopPropagation();
    const s   = _getStatusKunjungan(kId);
    const val = !s[field];
    _setStatusKunjungan(kId, field, val);

    // Update tampilan badge langsung tanpa re-render penuh
    const badge = document.getElementById(`badge_${field}_${kId}`);
    if (badge) {
        badge.innerHTML     = _badgeHtml(field, val);
        badge.style.opacity = val ? '1' : '0.45';
    }

    const label = field === 'obat' ? 'Obat' : 'Pembayaran';
    showToast(val ? `✅ ${label} sudah ditandai` : `↩️ ${label} dibatalkan`, val ? 'success' : 'info');
}

/** Helper: render HTML badge status */
function _badgeHtml(field, active) {
    if (field === 'obat') {
        return active
            ? `<span style="font-size:9px;">💊</span> Obat ✓`
            : `<span style="font-size:9px;">💊</span> Obat`;
    }
    return active
        ? `<span style="font-size:9px;">💰</span> Bayar ✓`
        : `<span style="font-size:9px;">💰</span> Bayar`;
}

/** Helper: warna badge */
function _badgeStyle(field, active) {
    if (active) {
        return field === 'obat'
            ? 'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;'
            : 'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;';
    }
    return 'background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0;';
}

// ── AMBIL DATA KUNJUNGAN BERDASARKAN TANGGAL ──
async function fetchByDate() {
    const filterEl = $('filterDate');
    if (!filterEl || !filterEl.value) return;

    const today     = new Date();
    const tzOffset  = today.getTimezoneOffset() * 60000;
    const localToday = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);

    filterEl.max = localToday;

    if (filterEl.value > localToday) {
        showToast("⚠️ Tidak bisa melihat data tanggal masa depan", "warning");
        filterEl.value = localToday;
        return;
    }

    const listEl = $('listHariIni');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat data...</div>`;
    try {
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

    // Tentukan jabatan user yang login
    const jabatan = ((typeof loggedInUser !== 'undefined' && loggedInUser) ? (loggedInUser.jabatan || '') : '').toLowerCase();
    const isApoteker = jabatan === 'apoteker';
    const isKasir    = jabatan === 'kasir';
    const isAtlm     = jabatan === 'atlm';
    const isParamedis = window._isParamedis === true;

    container.innerHTML = sorted.map(h => {
        const isDone     = h.status === 'Selesai';
        const tampilNama = h.nama || (allPatients.find(x => x.id === h.pasienId) || {}).nama || '(Nama tidak diketahui)';

        // Lab row — tampilkan ke ATLM, Apoteker juga bisa lihat
        const hasLab = h.lab_gds || h.lab_chol || h.lab_ua;
        const labRow = hasLab
            ? `<div style="font-size:10.5px;color:#7c3aed;background:rgba(124,58,237,0.07);padding:3px 7px;border-radius:6px;margin-top:3px;">
                 🔬 GDS: ${h.lab_gds||'—'} | Kol: ${h.lab_chol||'—'} | AU: ${h.lab_ua||'—'}
               </div>`
            : '';

        const diagRow = (isParamedis || isApoteker || isKasir || isAtlm)
            ? ''
            : `<div style="font-size:11px;color:var(--text-muted);">Diagnosa: ${h.diag || '-'}</div>`;

        const dokterRow = h.dokterNama
            ? `<div style="font-size:10px;color:#059669;font-weight:600;margin-top:2px;">👨‍⚕️ dr. ${h.dokterNama}</div>`
            : '';

        // Status penanda obat & bayar
        const st       = _getStatusKunjungan(h.id);
        const obatDone = st.obat;
        const bayarDone= st.bayar;

        // Tombol aksi cepat — sesuai jabatan
        let actionBtns = '';

        // Tombol Invoice — tampil untuk Kasir, Admin, Dokter (bukan Paramedis & ATLM)
        if (!isParamedis && !isAtlm) {
            actionBtns += `
            <button onclick="event.stopPropagation();_quickInvoice('${h.id}','${escHtml(tampilNama)}')"
                style="flex:1;padding:5px 0;background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;">
                🧾 Invoice
            </button>`;
        }

        // Tombol Resep — tampil untuk Apoteker, Dokter, Admin (tidak untuk Kasir & ATLM)
        if (!isKasir && !isAtlm) {
            actionBtns += `
            <button onclick="event.stopPropagation();_quickResep('${h.id}','${escHtml(tampilNama)}')"
                style="flex:1;padding:5px 0;background:linear-gradient(135deg,#2563eb,#60a5fa);color:#fff;border:none;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;">
                💊 Resep
            </button>`;
        }

        // Badge status obat (Apoteker & semua lihat, hanya Apoteker & Admin bisa toggle)
        const canToggleObat  = ['apoteker','admin','dokter'].includes(jabatan);
        const canToggleBayar = ['kasir','admin','dokter'].includes(jabatan);

        const badgeObat = `
        <span id="badge_obat_${h.id}"
            onclick="${canToggleObat ? `toggleStatusKunjungan(event,'${h.id}','obat')` : 'event.stopPropagation()'}"
            style="cursor:${canToggleObat ? 'pointer' : 'default'};
                   display:inline-flex;align-items:center;gap:3px;
                   padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;
                   ${_badgeStyle('obat', obatDone)}opacity:${obatDone ? '1' : '0.55'};">
            ${_badgeHtml('obat', obatDone)}
        </span>`;

        const badgeBayar = `
        <span id="badge_bayar_${h.id}"
            onclick="${canToggleBayar ? `toggleStatusKunjungan(event,'${h.id}','bayar')` : 'event.stopPropagation()'}"
            style="cursor:${canToggleBayar ? 'pointer' : 'default'};
                   display:inline-flex;align-items:center;gap:3px;
                   padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;
                   ${_badgeStyle('bayar', bayarDone)}opacity:${bayarDone ? '1' : '0.55'};">
            ${_badgeHtml('bayar', bayarDone)}
        </span>`;

        return `
        <div class="visit-card" style="opacity:${isDone ? '0.72' : '1'};flex-direction:column;gap:0;padding:10px 12px;" onclick="bukaRekamMedisHariIni('${h.id}')">
            <div style="display:flex;align-items:flex-start;gap:10px;width:100%;">
                <div class="visit-time-badge" style="flex-shrink:0;">${h.waktu || '-'}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tampilNama}</div>
                    <div style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px;">Keluhan: ${h.keluhan || '-'}</div>
                    <div style="font-size:11px; color:var(--text-muted);">TTV: ${h.td || '-'} mmHg | ${h.suhu || '-'}°C | N: ${h.nadi || '-'}</div>
                    ${labRow}
                    ${diagRow}
                    ${dokterRow}
                </div>
                <div class="status-badge ${isDone ? 'status-done' : 'status-wait'}" style="flex-shrink:0;">${isDone ? '✅ Selesai' : '⏳ Menunggu'}</div>
            </div>

            <!-- Baris status penanda + tombol aksi -->
            <div style="display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:7px;border-top:1px dashed var(--border);" onclick="event.stopPropagation()">
                ${badgeObat}
                ${badgeBayar}
                <div style="flex:1;"></div>
                ${actionBtns}
            </div>
        </div>`;
    }).join('');
}

/** Buka invoice langsung dari card kunjungan */
function _quickInvoice(kId, namaPasien) {
    const tgl = $('filterDate') ? $('filterDate').value : '';
    if (typeof lihatTagihanKunjungan === 'function') {
        lihatTagihanKunjungan(kId, namaPasien, tgl);
    } else {
        showToast("⚠️ Modul biaya belum dimuat", "warning");
    }
}

/** Tampilkan resep dari kunjungan secara ringkas */
async function _quickResep(kId, namaPasien) {
    try {
        const items = await sb_getResepByKunjungan(kId);
        if (!items || items.length === 0) {
            showToast(`ℹ️ Belum ada resep untuk ${namaPasien}`, 'info');
            return;
        }
        const resepText = items.map((r, i) =>
            `${i+1}. ${r.nama_obat} — ${r.jumlah} ${r.obat?.satuan || 'tablet'} (${r.frekuensi || ''})`
        ).join('\n');
        alert(`💊 Resep — ${namaPasien}\n\n${resepText}\n\nTotal item: ${items.length}`);
    } catch(e) {
        showToast("❌ Gagal memuat resep: " + (e.message || ''), "error");
    }
}

// ── BUKA REKAM MEDIS DARI KUNJUNGAN HARI INI ──
async function bukaRekamMedisHariIni(kId) {
    // Kasir dan ATLM tidak bisa buka pageMedis penuh, redirect ke invoice/info saja
    const jabatan = ((typeof loggedInUser !== 'undefined' && loggedInUser) ? (loggedInUser.jabatan || '') : '').toLowerCase();
    if (jabatan === 'kasir') {
        const h = kunjunganHariIni.find(x => x.id === kId);
        const nama = h ? (h.nama || '') : '';
        _quickInvoice(kId, nama);
        return;
    }
    if (jabatan === 'atlm') {
        showToast("ℹ️ ATLM hanya dapat melihat data lab dari daftar kunjungan", "info");
        return;
    }

    if (!canAccessMedis()) return;

    const h = kunjunganHariIni.find(x => x.id === kId);
    if (!h) return showToast("❌ Data tidak ditemukan", "error");

    const p = allPatients.find(x => x.id === h.pasienId) || allPatients.find(x => x.nama && h.nama && x.nama === h.nama);
    const namaPasien = (p && p.nama) ? p.nama : (h.nama || '');

    if (p) {
        if ($('nama'))      $('nama').value      = p.nama;
        if ($('nik'))       $('nik').value        = p.nik    || '';
        if ($('jk'))        $('jk').value         = p.jk     || 'L';
        if ($('alamat'))    $('alamat').value     = p.alamat || '';
        if ($('tgl_lahir')) $('tgl_lahir').value  = formatTglIndo(p.tgl) || '';
        if ($('alergi'))    $('alergi').value     = p.alergi || '';
        localStorage.setItem('rme_alergi', p.alergi || '');
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
    if ($('infoTglPemeriksaan') && fVal) {
        $('infoTglPemeriksaan').innerText     = "Tgl: " + formatTglIndo(fVal);
        $('infoTglPemeriksaan').style.display = 'block';
    }

    localStorage.setItem('cP_id',    currentPasienId    || '');
    localStorage.setItem('cK_id',    currentKunjunganId || '');
    localStorage.setItem('cP_nama',  namaPasien);
    localStorage.setItem('cP_nik',   p ? (p.nik || '') : '');
    localStorage.setItem('cP_umur',  "Umur: " + umur);
    localStorage.setItem('cTglEdit', fVal ? "Tgl: " + formatTglIndo(fVal) : '');
    localStorage.setItem('activePage', 'pageMedis');

    try {
        const kunjunganData = await sb_getKunjunganById(currentKunjunganId);
        if (kunjunganData && typeof _isiFormDariKunjungan === 'function') {
            _isiFormDariKunjungan(kunjunganData);
        } else {
            if (typeof loadAutosave === 'function') loadAutosave();
        }
    } catch(e) {
        if (typeof loadAutosave === 'function') loadAutosave();
    }

    try {
        let riwayatRows = [];
        if (currentPasienId) {
            riwayatRows = await _sbFetch(
                `kunjungan?pasien_id=eq.${currentPasienId}&order=tgl.desc,waktu.desc&select=*,dokter(nama_dokter)`
            );
        }
        currentRiwayat = riwayatRows.map(r => ({
            id:           r.id,
            tgl:          r.tgl,
            waktu:        r.waktu,
            td:           r.td,
            nadi:         r.nadi,
            suhu:         r.suhu,
            rr:           r.rr,
            bb:           r.bb,
            tb:           r.tb,
            keluhan:      r.keluhan,
            fisik:        r.fisik,
            lab_gds:      r.lab_gds,
            lab_chol:     r.lab_chol,
            lab_ua:       r.lab_ua,
            diag:         r.diag,
            terapi:       r.terapi,
            status:       r.status,
            user_id:      r.user_id,
            dokter_id:    r.dokter_id,
            dokterNama:   r.dokter?.nama_dokter || ''
        }));
        localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));
        if (typeof renderRiwayatList === 'function') renderRiwayatList(currentRiwayat, 'historyListMedis');
    } catch(e) {
        currentRiwayat = [];
        try { currentRiwayat = JSON.parse(localStorage.getItem('cP_riwayat') || '[]'); } catch(e2) {}
        if (typeof renderRiwayatList === 'function') renderRiwayatList(currentRiwayat, 'historyListMedis');
    }

    calculateIMT();
    checkTensi();
    checkLabAlert();

    if (typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();

    switchPage('pageMedis', null);
}

// ── ESCAPE HTML ──
function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ════════════════════════════════════════════════════════
//  RENDER LIST RIWAYAT (HISTORY)
// ════════════════════════════════════════════════════════
function renderRiwayatList(list, containerId) {
    const c = $(containerId);
    if (!c) return;

    if (list && list.length > 0) {
        c.innerHTML = list.map((r, i) => {
            const labStr = [
                r.lab_gds  ? `GDS ${r.lab_gds}`   : '',
                r.lab_chol ? `Kol ${r.lab_chol}`  : '',
                r.lab_ua   ? `AU ${r.lab_ua}`      : ''
            ].filter(Boolean).join(' | ');

            const st       = r.id ? _getStatusKunjungan(r.id) : { obat: false, bayar: false };
            const obatDone = st.obat;
            const bayarDone= st.bayar;

            const jabatan = ((typeof loggedInUser !== 'undefined' && loggedInUser) ? (loggedInUser.jabatan || '') : '').toLowerCase();
            const canToggleObat  = ['apoteker','admin','dokter'].includes(jabatan);
            const canToggleBayar = ['kasir','admin','dokter'].includes(jabatan);

            const badgeObat = r.id ? `
            <span id="badge_obat_${r.id}"
                onclick="${canToggleObat ? `event.stopPropagation();toggleStatusKunjungan(event,'${r.id}','obat')` : 'event.stopPropagation()'}"
                style="cursor:${canToggleObat ? 'pointer' : 'default'};
                       display:inline-flex;align-items:center;gap:2px;
                       padding:2px 7px;border-radius:20px;font-size:9.5px;font-weight:700;
                       ${_badgeStyle('obat', obatDone)}opacity:${obatDone ? '1' : '0.5'};">
                ${_badgeHtml('obat', obatDone)}
            </span>` : '';

            const badgeBayar = r.id ? `
            <span id="badge_bayar_${r.id}"
                onclick="${canToggleBayar ? `event.stopPropagation();toggleStatusKunjungan(event,'${r.id}','bayar')` : 'event.stopPropagation()'}"
                style="cursor:${canToggleBayar ? 'pointer' : 'default'};
                       display:inline-flex;align-items:center;gap:2px;
                       padding:2px 7px;border-radius:20px;font-size:9.5px;font-weight:700;
                       ${_badgeStyle('bayar', bayarDone)}opacity:${bayarDone ? '1' : '0.5'};">
                ${_badgeHtml('bayar', bayarDone)}
            </span>` : '';

            return `
                <div class="riwayat-item" onclick="openModal(${i})" style="cursor:pointer; padding:10px 12px; border-bottom:1px solid var(--border);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                        <div style="font-size:12px; font-weight:700; color:var(--primary);">
                            📅 ${formatTglIndo(r.tgl)} (${r.waktu || '00:00'})
                        </div>
                        <div style="display:flex;gap:6px;align-items:center;">
                            <div style="font-size:10px; color:var(--primary); font-weight:700;">Lihat Detail 👁️</div>
                            ${r.id ? `<button onclick="event.stopPropagation();_bukaInvoiceRiwayat(this)" data-kunjid="${escHtml(String(r.id))}" data-tgl="${escHtml(r.tgl||'')}" style="padding:2px 7px;background:rgba(22,163,74,0.1);color:#166534;border:1px solid rgba(22,163,74,0.25);border-radius:6px;font-size:9.5px;font-weight:700;cursor:pointer;">🧾 Invoice</button>` : ''}
                            ${r.id ? `<button onclick="event.stopPropagation();_bukaResepRiwayat(this)" data-kunjid="${escHtml(String(r.id))}" data-nama="${escHtml(r.namaPasien||'')}" style="padding:2px 7px;background:rgba(37,99,235,0.1);color:#1e40af;border:1px solid rgba(37,99,235,0.25);border-radius:6px;font-size:9.5px;font-weight:700;cursor:pointer;">💊 Resep</button>` : ''}
                        </div>
                    </div>
                    <div style="font-size:11px; margin-bottom:6px; color:var(--text-muted); background:var(--surface-2); padding:4px 8px; border-radius:8px;">
                        <b>TTV:</b> TD ${r.td||'-'} | N ${r.nadi||'-'} | S ${r.suhu||'-'} | RR ${r.rr||'-'} | BB ${r.bb||'-'}
                    </div>
                    ${labStr ? `<div style="font-size:11px;margin-bottom:6px;color:#7c3aed;background:rgba(124,58,237,0.07);padding:4px 8px;border-radius:8px;"><b>🔬 Lab:</b> ${labStr}</div>` : ''}
                    ${window._isParamedis ? '' : `<div class="riwayat-diag" style="margin-bottom:3px;">🩺 ${r.diag || 'Menunggu Diagnosa'}</div>`}
                    <div class="riwayat-keluhan" style="color:var(--text); border-top:1px dashed var(--border); padding-top:4px; margin-bottom:3px;"><b>Keluhan:</b> ${r.keluhan || '-'}</div>
                    <div class="riwayat-keluhan" style="color:var(--text);margin-bottom:6px;"><b>Terapi:</b> ${r.terapi || '-'}</div>
                    ${r.dokterNama ? `<div style="font-size:10px;color:#059669;font-weight:600;padding-top:4px;border-top:1px dashed var(--border);">👨‍⚕️ Diperiksa oleh: ${r.dokterNama}</div>` : ''}
                    <!-- Penanda status -->
                    <div style="display:flex;gap:5px;align-items:center;margin-top:7px;padding-top:5px;border-top:1px dashed var(--border);" onclick="event.stopPropagation()">
                        ${badgeObat}
                        ${badgeBayar}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div>Belum ada riwayat.</div>`;
    }
}

// ════════════════════════════════════════════════════════
//  DYNAMIC LAB SECTION — render berdasarkan window._labAktif
// ════════════════════════════════════════════════════════

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

    if (window._stokAktif && typeof renderSectionResep === 'function') {
        renderSectionResep(currentKunjunganId || null);
        const secResep  = document.getElementById('sectionResep');
        const secManual = document.getElementById('sectionTerapiManual');
        if (secResep)  secResep.style.display  = '';
        if (secManual) secManual.style.display = 'none';
    }

    const labAktif = window._labAktif || { lab_gds: true, lab_chol: true, lab_ua: true };
    const activeFields = ALL_LAB_FIELDS.filter(f => labAktif[f.id]);

    if (activeFields.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';

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

    section.querySelectorAll('[data-save="true"]').forEach(el => {
        el.addEventListener('input', () => {
            localStorage.setItem('rme_' + el.id, el.value);
            checkLabAlert();
        });
        const saved = localStorage.getItem('rme_' + el.id);
        if (saved !== null) el.value = saved;
    });

    checkLabAlert();
}

// ── Helper: buka invoice dari tombol di riwayat list ──
function _bukaInvoiceRiwayat(btn) {
    const kunjId = btn.getAttribute('data-kunjid');
    const tgl    = btn.getAttribute('data-tgl');
    const nama   = (typeof allPatients !== 'undefined' && currentPasienId)
        ? (allPatients.find(p => p.id === currentPasienId)?.nama || '')
        : '';
    if (typeof lihatTagihanKunjungan === 'function') {
        lihatTagihanKunjungan(kunjId, nama, tgl);
    }
}

/** Helper: buka resep dari tombol di riwayat list */
async function _bukaResepRiwayat(btn) {
    const kunjId = btn.getAttribute('data-kunjid');
    const nama   = btn.getAttribute('data-nama') || '';
    try {
        const items = await sb_getResepByKunjungan(kunjId);
        if (!items || items.length === 0) {
            showToast('ℹ️ Tidak ada resep pada kunjungan ini', 'info');
            return;
        }
        const resepText = items.map((r, i) =>
            `${i+1}. ${r.nama_obat} — ${r.jumlah} ${r.obat?.satuan || 'tablet'} (${r.frekuensi || ''})`
        ).join('\n');
        alert(`💊 Resep — ${nama}\n\n${resepText}`);
    } catch(e) {
        showToast("❌ Gagal memuat resep", "error");
    }
}

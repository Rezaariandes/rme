// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL KUNJUNGAN PASIEN
//  Mengelola daftar kunjungan harian & rekam medis
// ════════════════════════════════════════════════════════

let kunjunganHariIni   = [];
let currentKunjunganId = null;

// ── AMBIL DATA KUNJUNGAN BERDASARKAN TANGGAL ──
async function fetchByDate() {
    const filterEl = $('filterDate');
    if (!filterEl || !filterEl.value) return;
    const listEl = $('listHariIni');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat data...</div>`;
    try {
        const res  = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "initData", filterDate: filterEl.value })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
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
        return `
        <div class="visit-card" style="opacity:${isDone ? '0.62' : '1'};" onclick="bukaRekamMedisHariIni('${h.id}')">
            <div class="visit-time-badge">${h.waktu || '-'}</div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${h.nama}</div>
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

    const p = allPatients.find(x => x.id === h.pasienId) || allPatients.find(x => x.nama === h.nama);

    if (p) {
        if ($('nama'))      $('nama').value      = p.nama;
        if ($('nik'))       $('nik').value        = p.nik    || '';
        if ($('jk'))        $('jk').value         = p.jk     || 'L';
        if ($('alamat'))    $('alamat').value    = p.alamat || '';
        if ($('tgl_lahir')) $('tgl_lahir').value = formatTglIndo(p.tgl) || '';
    } else {
        if ($('nama')) $('nama').value = h.nama;
    }

    currentPasienId    = h.pasienId;
    currentKunjunganId = h.id;
    const umur         = p ? hitungUmur(p.tgl) : '-';

    if ($('infoPasienNama')) $('infoPasienNama').innerText = h.nama;
    if ($('infoPasienNik'))  $('infoPasienNik').innerText  = "NIK: " + (p ? (p.nik || '-') : '-');
    if ($('infoPasienUmur')) $('infoPasienUmur').innerText = "Umur: " + umur;

    const fVal = $('filterDate') ? $('filterDate').value : '';
    const tanggalRekamLabel = fVal ? "Tgl: " + formatTglIndo(fVal) : "Tgl: " + h.tgl;
    if ($('infoTglPemeriksaan')) {
        $('infoTglPemeriksaan').innerText     = tanggalRekamLabel;
        $('infoTglPemeriksaan').style.display = 'block';
    }

    // Isi form TTV
    _isiFormDariKunjungan(h);
    document.querySelectorAll('[data-save="true"]').forEach(el => localStorage.setItem('rme_' + el.id, el.value));
    calculateIMT(); checkTensi();

    localStorage.setItem('activePage', 'pageMedis');
    localStorage.setItem('cP_id',     currentPasienId);
    localStorage.setItem('cK_id',     currentKunjunganId);
    localStorage.setItem('cP_nama',   h.nama);
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
        const res  = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "checkAndUpsertPasien",
                nama: h.nama,
                nik:  p ? (p.nik || '') : '',
                localDate: localDateStr
            })
        });
        const data = await res.json();
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
    const hasData = ['sistol','diastol','nadi','suhu','rr','bb','tb'].some(id => $(id) && $(id).value !== "");

    if (!d1 && !hasData) return showToast("⚠️ Isi Diagnosa Utama atau Tanda Vital!", "error");

    const isSelesai = (d1 !== "" && terapi !== "");
    const btn = $('btnSave');
    if (btn) { btn.disabled = true; btn.innerText = "Menyimpan..."; }

    const sis = $('sistol')  ? $('sistol').value  : '';
    const dia = $('diastol') ? $('diastol').value : '';
    const tdGabungan = (sis || dia) ? ((sis || '-') + '/' + (dia || '-')) : '';
    const diagGabung = d2 ? (d1 + " | " + d2) : d1;

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
        td:       tdGabungan,
        nadi:     $('nadi')     ? $('nadi').value     : '',
        rr:       $('rr')       ? $('rr').value       : '',
        suhu:     $('suhu')     ? $('suhu').value     : '',
        bb:       $('bb')       ? $('bb').value       : '',
        tb:       $('tb')       ? $('tb').value       : '',
        keluhan:  $('keluhan')  ? $('keluhan').value  : '',
        fisik:    $('fisik')    ? $('fisik').value    : '',
        diagnosa: diagGabung,
        terapi:   terapi,
        suratSakit: ($('suratSakit') && $('suratSakit').checked) ? "YA" : "TIDAK"
    };

    try {
        const res    = await fetch(APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();

        if (result && result.status === "Sukses") {
            if (!currentKunjunganId && result.kunjunganId) {
                currentKunjunganId = result.kunjunganId;
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
                    ${window._isParamedis ? '' : `<div class="riwayat-diag" style="margin-bottom:3px;">🩺 ${r.diag || 'Menunggu Diagnosa'}</div>`}
                    <div class="riwayat-keluhan" style="color:var(--text); border-top:1px dashed var(--border); padding-top:4px; margin-bottom:3px;"><b>Keluhan:</b> ${r.keluhan || '-'}</div>
                    <div class="riwayat-keluhan" style="color:var(--text);"><b>Terapi:</b> ${r.terapi || '-'}</div>
                </div>
            `).join('');
    } else {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div>Belum ada riwayat.</div>`;
    }
}

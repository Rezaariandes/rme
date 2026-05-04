// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL MODAL
//  Modal lihat & edit riwayat kunjungan
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
//  HELPER: CEK HAK AKSES EDIT
//  Mengembalikan { boleh: bool, alasan: string }
//
//  Aturan:
//  1. Data lebih dari 2 hari → TERKUNCI untuk semua
//  2. Dokter (jabatan='Dokter') → BOLEH edit kapan saja
//     dalam batas waktu 2 hari
//  3. User lain hanya boleh edit jika mereka yang menulis
//     (r.user_id === loggedInUser.id)
// ════════════════════════════════════════════════════════
function _cekHakAksesEdit(r) {
    // Cek batas waktu 2 hari
    if (r.tgl) {
        const tglRekam = new Date(r.tgl);        // format YYYY-MM-DD dari Supabase
        tglRekam.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selisihHari = Math.floor((today - tglRekam) / (1000 * 60 * 60 * 24));

        if (selisihHari > 2) {
            return {
                boleh: false,
                alasan: `Data tanggal ${formatTglIndo(r.tgl)} sudah melewati batas edit 2 hari. Hubungi Admin jika perlu koreksi.`
            };
        }
    }

    // Cek identitas user yang login
    const user = (typeof loggedInUser !== 'undefined') ? loggedInUser : null;
    if (!user) {
        return { boleh: false, alasan: 'Anda belum login.' };
    }

    const jabatan = (user.jabatan || '').toLowerCase();

    // Dokter boleh edit semua data (dalam 2 hari)
    if (jabatan === 'dokter') {
        return { boleh: true, alasan: '' };
    }

    // User lain hanya boleh edit data yang dia tulis sendiri
    if (r.user_id && user.id && r.user_id === user.id) {
        return { boleh: true, alasan: '' };
    }

    // Bukan dokter dan bukan penulis
    const penulisNama = _getNamaUserById(r.user_id);
    const pesanPenulis = penulisNama ? ` (ditulis oleh ${penulisNama})` : '';
    return {
        boleh: false,
        alasan: `Hanya Dokter atau petugas yang menulis data ini${pesanPenulis} yang dapat mengedit.`
    };
}

// Helper: cari nama user dari cache berdasarkan user_id
function _getNamaUserById(userId) {
    if (!userId) return null;
    const cache = window._usersCache || [];
    const u = cache.find(x => x.id === userId);
    return u ? u.nama : null;
}

// ════════════════════════════════════════════════════════
//  BUKA MODAL RIWAYAT
// ════════════════════════════════════════════════════════
function openModal(index) {
    const r = currentRiwayat[index];
    if (!r) return;
    if ($('modalIndex')) $('modalIndex').value = index;

    // ── VIEW: Header tanggal ──
    if ($('modalTanggalInfoView'))
        $('modalTanggalInfoView').innerText =
            "📅 " + (r.tgl ? formatTglIndo(r.tgl) : '-') + " (" + (r.waktu || '00:00') + ")";

    // ── VIEW: TTV ──
    if ($('viewTtv')) {
        const tdParts = (r.td || '').split('/');
        const sistol  = tdParts[0] ? tdParts[0].trim() : '-';
        const diastol = tdParts[1] ? tdParts[1].trim() : '-';
        $('viewTtv').innerHTML =
            `TD: ${sistol}/${diastol} mmHg &nbsp;|&nbsp; Nadi: ${r.nadi||'-'} x/m &nbsp;|&nbsp; Suhu: ${r.suhu||'-'} °C` +
            `<br>RR: ${r.rr||'-'} x/m &nbsp;|&nbsp; BB: ${r.bb||'-'} kg &nbsp;|&nbsp; TB: ${r.tb||'-'} cm`;
    }

    // ── VIEW: Alergi — diambil dari data pasien (permanen), bukan kunjungan ──
    const alergiRow = $('viewAlergiRow');
    const alergiEl  = $('viewAlergi');
    if (alergiRow && alergiEl) {
        // Cari alergi dari cache allPatients menggunakan currentPasienId
        const pasienCache = (typeof allPatients !== 'undefined' ? allPatients : []);
        const pasienData  = pasienCache.find(p => p.id === currentPasienId);
        const alergiVal   = (pasienData && pasienData.alergi) ? pasienData.alergi.trim() : '';
        alergiEl.innerText      = alergiVal || 'Tidak ada / tidak tercatat';
        alergiRow.style.display = '';
    }

    // ── VIEW: Keluhan & Fisik ──
    if ($('viewKeluhan')) $('viewKeluhan').innerText = r.keluhan || '-';
    if ($('viewFisik'))   $('viewFisik').innerText   = r.fisik   || '-';

    // ── VIEW: Lab ──
    const labRow = $('viewLabRow');
    const hasLab = r.lab_gds || r.lab_chol || r.lab_ua;
    if (labRow) labRow.style.display = hasLab ? '' : 'none';
    if ($('viewLab')) $('viewLab').innerHTML = hasLab
        ? `GDS: ${r.lab_gds||'-'} mg/dL &nbsp;|&nbsp; Kolesterol: ${r.lab_chol||'-'} mg/dL &nbsp;|&nbsp; Asam Urat: ${r.lab_ua||'-'} mg/dL`
        : '-';

    // ── VIEW: Diagnosa & Terapi ──
    if ($('viewDiag'))   $('viewDiag').innerText  = r.diag   || '-';
    if ($('viewTerapi')) $('viewTerapi').innerText = r.terapi || '-';

    // ── VIEW: Dokter Pemeriksa ──
    const dokterRow = $('viewDokterRow');
    const dokterEl  = $('viewDokterPemeriksa');
    if (dokterEl && dokterRow) {
        if (r.dokterNama) {
            dokterEl.innerText      = r.dokterNama;
            dokterRow.style.display = '';
        } else {
            dokterRow.style.display = 'none';
        }
    }

    // ── ROLE: Paramedis tidak bisa lihat Diagnosa & Terapi ──
    const isParamedis = window._isParamedis === true;
    if ($('viewDiagRow'))   $('viewDiagRow').style.display   = isParamedis ? 'none' : '';
    if ($('viewTerapiRow')) $('viewTerapiRow').style.display  = isParamedis ? 'none' : '';

    // ── CEK HAK AKSES EDIT ──
    const hakEdit = _cekHakAksesEdit(r);
    const lockNotif  = $('editLockNotif');
    const lockMsg    = $('editLockMsg');
    const btnEdit    = $('btnToggleEdit');

    if (hakEdit.boleh) {
        if (lockNotif) lockNotif.style.display = 'none';
        if (btnEdit) {
            btnEdit.style.display  = '';
            btnEdit.disabled       = false;
            btnEdit.innerText      = '✏️ Edit Data';
            btnEdit.style.opacity  = '1';
        }
    } else {
        if (lockNotif) lockNotif.style.display = '';
        if (lockMsg)   lockMsg.innerText        = hakEdit.alasan;
        if (btnEdit) {
            btnEdit.disabled       = true;
            btnEdit.innerText      = '🔒 Terkunci';
            btnEdit.style.opacity  = '0.5';
        }
    }

    // ── EDIT: Populate form ──
    if ($('modalTanggalInfoEdit'))
        $('modalTanggalInfoEdit').innerText =
            "✏️ Edit: " + (r.tgl ? formatTglIndo(r.tgl) : '-') + " (" + (r.waktu || '00:00') + ")";

    // TTV — pisahkan td "120/80"
    const tdParts2 = (r.td || '').split('/');
    if ($('modalSistol'))  $('modalSistol').value  = tdParts2[0] ? tdParts2[0].trim() : '';
    if ($('modalDiastol')) $('modalDiastol').value = tdParts2[1] ? tdParts2[1].trim() : '';
    if ($('modalNadi'))    $('modalNadi').value     = r.nadi    || '';
    if ($('modalSuhu'))    $('modalSuhu').value     = r.suhu    || '';
    if ($('modalRr'))      $('modalRr').value       = r.rr      || '';
    if ($('modalBb'))      $('modalBb').value       = r.bb      || '';
    if ($('modalTb'))      $('modalTb').value       = r.tb      || '';

    // Alergi — dari data pasien (permanen)
    if ($('modalAlergi')) {
        const pasienCache2 = (typeof allPatients !== 'undefined' ? allPatients : []);
        const pasienData2  = pasienCache2.find(p => p.id === currentPasienId);
        $('modalAlergi').value = (pasienData2 && pasienData2.alergi) ? pasienData2.alergi : '';
    }

    // Keluhan & Fisik
    if ($('modalKeluhan')) $('modalKeluhan').value = r.keluhan || '';
    if ($('modalFisik'))   $('modalFisik').value   = r.fisik   || '';

    // Lab
    if ($('modalLabGds'))  $('modalLabGds').value  = r.lab_gds  || '';
    if ($('modalLabChol')) $('modalLabChol').value = r.lab_chol || '';
    if ($('modalLabUa'))   $('modalLabUa').value   = r.lab_ua   || '';

    // Diagnosa
    const diagLama = String(r.diag || '');
    if (diagLama.includes(" | ")) {
        if ($('modalDiag1')) $('modalDiag1').value = diagLama.split(" | ")[0];
        if ($('modalDiag2')) $('modalDiag2').value = diagLama.split(" | ")[1];
    } else {
        if ($('modalDiag1')) $('modalDiag1').value = diagLama;
        if ($('modalDiag2')) $('modalDiag2').value = '';
    }
    if ($('modalTerapi')) $('modalTerapi').value = r.terapi || '';

    // Sembunyikan seksi Diagnosa untuk Paramedis di mode edit
    const editDiagSection = $('modalEditDiagSection');
    if (editDiagSection) editDiagSection.style.display = isParamedis ? 'none' : '';

    toggleEditModal(false);

    // Invoice button: tampil hanya jika modul biaya aktif & kunjungan punya ID
    const invRow = $('viewInvoiceRow');
    if (invRow) {
        const biayaAktif = window._biayaAktif === true;
        invRow.style.display = (biayaAktif && r.id) ? '' : 'none';
        window._modalCurrentKunjId     = r.id  || null;
        window._modalCurrentPasienNama = (typeof allPatients !== 'undefined')
            ? (allPatients.find(p => p.id === currentPasienId)?.nama || '')
            : '';
        window._modalCurrentTgl = r.tgl || '';
    }

    const modal = $('modalRiwayat');
    if (modal) modal.classList.add('show');
}

// ── TOGGLE VIEW / EDIT ──
function toggleEditModal(isEdit) {
    if ($('modalTitle'))
        $('modalTitle').innerText = isEdit ? "✏️ Edit Rekam Medis" : "📋 Detail Rekam Medis";
    if ($('modalView')) $('modalView').style.display = isEdit ? 'none'  : 'block';
    if ($('modalEdit')) $('modalEdit').style.display = isEdit ? 'block' : 'none';
}

function closeModal() {
    const modal = $('modalRiwayat');
    if (modal) modal.classList.remove('show');
}

// ════════════════════════════════════════════════════════
//  SIMPAN EDIT DARI MODAL
// ════════════════════════════════════════════════════════
async function simpanEditModal() {
    const btn = $('btnSaveModal');
    if (btn) { btn.disabled = true; btn.innerText = "Menyimpan..."; }

    const idx = $('modalIndex') ? parseInt($('modalIndex').value) : 0;
    const r   = currentRiwayat[idx];
    if (!r) {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Perubahan"; }
        return showToast("❌ Data tidak ditemukan", "error");
    }

    // Re-cek hak akses sebelum simpan (double guard)
    const hakEdit = _cekHakAksesEdit(r);
    if (!hakEdit.boleh) {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Perubahan"; }
        return showToast("⛔ " + hakEdit.alasan, "error");
    }

    const d1 = $('modalDiag1') ? $('modalDiag1').value : '';
    const d2 = $('modalDiag2') ? $('modalDiag2').value : '';
    const diagGabung = d2 ? (d1 + " | " + d2) : d1;

    // Gabungkan sistol/diastol ke format "120/80"
    const sistol  = $('modalSistol')  ? $('modalSistol').value.trim()  : '';
    const diastol = $('modalDiastol') ? $('modalDiastol').value.trim() : '';
    const tdGabung = (sistol && diastol) ? `${sistol}/${diastol}` : (sistol || diastol || '');

    const payload = {
        pasienId:    currentPasienId,
        kunjunganId: r.id,
        keluhan:  $('modalKeluhan') ? $('modalKeluhan').value : '',
        fisik:    $('modalFisik')   ? $('modalFisik').value   : '',
        td:       tdGabung,
        nadi:     $('modalNadi')    ? $('modalNadi').value    : '',
        suhu:     $('modalSuhu')    ? $('modalSuhu').value    : '',
        rr:       $('modalRr')      ? $('modalRr').value      : '',
        bb:       $('modalBb')      ? $('modalBb').value      : '',
        tb:       $('modalTb')      ? $('modalTb').value      : '',
        alergi:   $('modalAlergi')  ? $('modalAlergi').value.trim()  : '',
        lab_gds:  $('modalLabGds')  ? $('modalLabGds').value  : '',
        lab_chol: $('modalLabChol') ? $('modalLabChol').value : '',
        lab_ua:   $('modalLabUa')   ? $('modalLabUa').value   : '',
        diagnosa: diagGabung,
        terapi:   $('modalTerapi')  ? $('modalTerapi').value  : ''
    };

    try {
        await sb_saveKunjungan(payload);

        // Update alergi ke tabel pasien (data permanen) dan cache lokal allPatients
        const alergiVal = $('modalAlergi') ? $('modalAlergi').value.trim() : '';
        if (currentPasienId && currentPasienId !== 'null') {
            await _sbFetch(`pasien?id=eq.${currentPasienId}`, {
                method: 'PATCH',
                body: { alergi: alergiVal || null },
                prefer: 'return=minimal'
            });
        }
        // Sync cache allPatients agar tampilan modal langsung update
        if (typeof allPatients !== 'undefined') {
            const pIdx = allPatients.findIndex(p => p.id === currentPasienId);
            if (pIdx !== -1) allPatients[pIdx].alergi = alergiVal;
        }
        // Sync form utama jika sedang di halaman medis
        if ($('alergi')) $('alergi').value = alergiVal;
        localStorage.setItem('rme_alergi', alergiVal);

        showToast("✅ Perubahan berhasil disimpan", "success");

        // Update cache lokal kunjungan (tanpa alergi — sudah di pasien)
        Object.assign(r, {
            keluhan:  payload.keluhan,  fisik:    payload.fisik,
            td:       payload.td,       nadi:     payload.nadi,
            suhu:     payload.suhu,     rr:       payload.rr,
            bb:       payload.bb,       tb:       payload.tb,
            lab_gds:  payload.lab_gds,  lab_chol: payload.lab_chol,
            lab_ua:   payload.lab_ua,
            diag:     payload.diagnosa, terapi:   payload.terapi
        });

        // BUG-08 FIX: Update status ke "Selesai" jika diagnosa & terapi sudah diisi,
        // baik di cache riwayat maupun di array kunjunganHariIni.
        const isSelesai = !!(payload.diagnosa && payload.terapi);
        if (isSelesai) {
            r.status = 'Selesai';
            if (typeof kunjunganHariIni !== 'undefined') {
                const kIdx = kunjunganHariIni.findIndex(x => x.id === r.id);
                if (kIdx !== -1) kunjunganHariIni[kIdx].status = 'Selesai';
            }
        }

        renderRiwayatList(currentRiwayat, 'historyListMedis');
        if ($('riwayatDaftarContainer'))
            renderRiwayatList(currentRiwayat, 'riwayatDaftarContainer');
        localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));
        closeModal();
    } catch (e) {
        showToast("❌ Gagal menyimpan perubahan: " + (e.message || ''), "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Perubahan"; }
    }
}


// ── Invoice dari modal riwayat ──
function _viewInvoiceFromModal() {
    const kunjId    = window._modalCurrentKunjId;
    const nama      = window._modalCurrentPasienNama;
    const tgl       = window._modalCurrentTgl;
    if (!kunjId) return showToast('⚠️ Data kunjungan tidak tersedia', 'error');
    if (typeof lihatTagihanKunjungan === 'function') {
        lihatTagihanKunjungan(kunjId, nama, tgl);
    }
}

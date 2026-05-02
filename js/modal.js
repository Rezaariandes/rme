// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL MODAL
//  Modal lihat & edit riwayat kunjungan
// ════════════════════════════════════════════════════════

// ── BUKA MODAL RIWAYAT ──
function openModal(index) {
    const r = currentRiwayat[index];
    if (!r) return;
    if ($('modalIndex')) $('modalIndex').value = index;

    // Mode View
    if ($('modalTanggalInfoView'))
        $('modalTanggalInfoView').innerText =
            "📅 " + (r.tgl ? formatTglIndo(r.tgl) : '-') + " (" + (r.waktu || '00:00') + ")";
    if ($('viewKeluhan')) $('viewKeluhan').innerText = r.keluhan || '-';
    if ($('viewFisik'))   $('viewFisik').innerText   = r.fisik   || '-';
    if ($('viewTtv'))     $('viewTtv').innerHTML     =
        `TD: ${r.td||'-'} | N: ${r.nadi||'-'} | S: ${r.suhu||'-'} <br> RR: ${r.rr||'-'} | BB: ${r.bb||'-'} | TB: ${r.tb||'-'}`;
    if ($('viewDiag'))    $('viewDiag').innerText    = r.diag   || '-';
    if ($('viewTerapi'))  $('viewTerapi').innerText  = r.terapi || '-';

    // Mode Edit
    if ($('modalTanggalInfoEdit'))
        $('modalTanggalInfoEdit').innerText =
            "✏️ Edit: " + (r.tgl ? formatTglIndo(r.tgl) : '-') + " (" + (r.waktu || '00:00') + ")";
    if ($('modalKeluhan')) $('modalKeluhan').value = r.keluhan || '';
    if ($('modalFisik'))   $('modalFisik').value   = r.fisik   || '';
    if ($('modalTd'))      $('modalTd').value      = r.td      || '';
    if ($('modalNadi'))    $('modalNadi').value    = r.nadi    || '';
    if ($('modalSuhu'))    $('modalSuhu').value    = r.suhu    || '';
    if ($('modalRr'))      $('modalRr').value      = r.rr      || '';
    if ($('modalBb'))      $('modalBb').value      = r.bb      || '';
    if ($('modalTb'))      $('modalTb').value      = r.tb      || '';

    const diagLama = String(r.diag || '');
    if (diagLama.includes(" | ")) {
        if ($('modalDiag1')) $('modalDiag1').value = diagLama.split(" | ")[0];
        if ($('modalDiag2')) $('modalDiag2').value = diagLama.split(" | ")[1];
    } else {
        if ($('modalDiag1')) $('modalDiag1').value = diagLama;
        if ($('modalDiag2')) $('modalDiag2').value = '';
    }
    if ($('modalTerapi')) $('modalTerapi').value = r.terapi || '';

    toggleEditModal(false);

    // Sembunyikan baris diagnosa untuk Perawat
    const isPerawat = window._isParamedis === true;
    ['viewDiag', 'modalDiag1', 'modalDiag2'].forEach(id => {
        const el = $(id);
        if (el) el.closest('.col-6, .form-group, div') && (el.parentElement.style.display = isPerawat ? 'none' : '');
    });
    // Sembunyikan label & wrapper row diagnosa di mode view
    const viewDiagEl = $('viewDiag');
    if (viewDiagEl) {
        const wrapper = viewDiagEl.closest('[class]') || viewDiagEl.parentElement;
        if (wrapper) wrapper.style.display = isPerawat ? 'none' : '';
    }
    // Sembunyikan row diagnosa di mode edit
    const diagRow = $('modalDiag1') ? $('modalDiag1').closest('.row') : null;
    if (diagRow) diagRow.style.display = isPerawat ? 'none' : '';
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

// ── SIMPAN EDIT DARI MODAL ──
async function simpanEditModal() {
    const btn = $('btnSaveModal');
    if (btn) { btn.disabled = true; btn.innerText = "Menyimpan..."; }

    const idx = $('modalIndex') ? $('modalIndex').value : 0;
    const r   = currentRiwayat[idx];
    if (!r) {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Perubahan"; }
        return showToast("❌ Data tidak ditemukan", "error");
    }

    const d1 = $('modalDiag1') ? $('modalDiag1').value : '';
    const d2 = $('modalDiag2') ? $('modalDiag2').value : '';
    const diagGabung = d2 ? (d1 + " | " + d2) : d1;

    const payload = {
        action:      "saveKunjungan",
        pasienId:    currentPasienId,
        kunjunganId: r.id,
        keluhan:  $('modalKeluhan') ? $('modalKeluhan').value : '',
        fisik:    $('modalFisik')   ? $('modalFisik').value   : '',
        td:       $('modalTd')      ? $('modalTd').value      : '',
        nadi:     $('modalNadi')    ? $('modalNadi').value    : '',
        suhu:     $('modalSuhu')    ? $('modalSuhu').value    : '',
        rr:       $('modalRr')      ? $('modalRr').value      : '',
        bb:       $('modalBb')      ? $('modalBb').value      : '',
        tb:       $('modalTb')      ? $('modalTb').value      : '',
        diagnosa: diagGabung,
        terapi:   $('modalTerapi')  ? $('modalTerapi').value  : ''
    };

    try {
        await fetch(APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        showToast("✅ Perubahan berhasil disimpan", "success");

        // Update data lokal tanpa fetch ulang
        Object.assign(r, {
            keluhan: payload.keluhan, fisik:   payload.fisik,
            td:      payload.td,      nadi:    payload.nadi,
            suhu:    payload.suhu,    rr:      payload.rr,
            bb:      payload.bb,      tb:      payload.tb,
            diag:    payload.diagnosa, terapi: payload.terapi
        });

        renderRiwayatList(currentRiwayat, 'historyListMedis');
        if ($('riwayatDaftarContainer'))
            renderRiwayatList(currentRiwayat, 'riwayatDaftarContainer');
        localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));
        closeModal();
    } catch (e) {
        showToast("❌ Gagal menyimpan perubahan", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Perubahan"; }
    }
}

// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL MODAL
//  Modal lihat & edit riwayat kunjungan
// ════════════════════════════════════════════════════════

// ── BUKA MODAL RIWAYAT ──
function openModal(index) {
    const r = currentRiwayat[index];
    $('modalIndex').value = index;

    // View mode
    $('modalTanggalInfoView').innerText =
        "📅 Tanggal Kunjungan: " + (r.tgl ? formatTglIndo(r.tgl) : '-') + " (" + (r.waktu || '00:00') + ")";
    $('viewKeluhan').innerText  = r.keluhan || '-';
    $('viewFisik').innerText    = r.fisik   || '-';
    $('viewTtv').innerHTML      = `TD: ${r.td||'-'} | N: ${r.nadi||'-'} | S: ${r.suhu||'-'} <br> RR: ${r.rr||'-'} | BB: ${r.bb||'-'} | TB: ${r.tb||'-'}`;
    $('viewDiag').innerText     = r.diag    || '-';
    $('viewTerapi').innerText   = r.terapi  || '-';

    // Edit mode
    $('modalTanggalInfoEdit').innerText =
        "✏️ Edit Tanggal: " + (r.tgl ? formatTglIndo(r.tgl) : '-') + " (" + (r.waktu || '00:00') + ")";
    $('modalKeluhan').value = r.keluhan || '';
    $('modalFisik').value   = r.fisik   || '';
    $('modalTd').value      = r.td      || '';
    $('modalNadi').value    = r.nadi    || '';
    $('modalSuhu').value    = r.suhu    || '';
    $('modalRr').value      = r.rr      || '';
    $('modalBb').value      = r.bb      || '';
    $('modalTb').value      = r.tb      || '';

    let diagLama = String(r.diag || '');
    if (diagLama.includes(" | ")) {
        $('modalDiag1').value = diagLama.split(" | ")[0];
        $('modalDiag2').value = diagLama.split(" | ")[1];
    } else {
        $('modalDiag1').value = diagLama;
        $('modalDiag2').value = "";
    }
    $('modalTerapi').value = r.terapi || '';

    toggleEditModal(false);
    $('modalRiwayat').classList.add('show');
}

// ── TOGGLE ANTARA VIEW & EDIT MODE ──
function toggleEditModal(isEdit) {
    $('modalTitle').innerText       = isEdit ? "✏️ Edit Rekam Medis" : "📋 Detail Rekam Medis";
    $('modalView').style.display    = isEdit ? 'none'  : 'block';
    $('modalEdit').style.display    = isEdit ? 'block' : 'none';
}

function closeModal() {
    $('modalRiwayat').classList.remove('show');
}

// ── SIMPAN HASIL EDIT DARI MODAL ──
async function simpanEditModal() {
    const btn = $('btnSaveModal');
    btn.disabled = true;
    btn.innerText = "Menyimpan...";

    const idx = $('modalIndex').value;
    const r   = currentRiwayat[idx];
    const d1  = $('modalDiag1').value;
    const d2  = $('modalDiag2').value;
    let diagGabung = d1;
    if (d2) diagGabung += " | " + d2;

    const payload = {
        action: "saveKunjungan",
        pasienId: currentPasienId,
        kunjunganId: r.id,
        keluhan: $('modalKeluhan').value,
        fisik:   $('modalFisik').value,
        td:      $('modalTd').value,
        nadi:    $('modalNadi').value,
        suhu:    $('modalSuhu').value,
        rr:      $('modalRr').value,
        bb:      $('modalBb').value,
        tb:      $('modalTb').value,
        diagnosa: diagGabung,
        terapi:   $('modalTerapi').value
    };

    try {
        await fetch(APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        showToast("✅ Perubahan disimpan", "success");

        // Update data lokal
        r.keluhan = payload.keluhan; r.fisik  = payload.fisik;
        r.td      = payload.td;      r.nadi   = payload.nadi;
        r.suhu    = payload.suhu;    r.rr     = payload.rr;
        r.bb      = payload.bb;      r.tb     = payload.tb;
        r.diag    = payload.diagnosa; r.terapi = payload.terapi;

        renderRiwayatList(currentRiwayat, 'historyListMedis');
        if ($('riwayatDaftarContainer')) renderRiwayatList(currentRiwayat, 'riwayatDaftarContainer');
        localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));
        closeModal();
    } catch (e) {
        showToast("❌ Gagal menyimpan", "error");
    } finally {
        btn.disabled  = false;
        btn.innerText = "💾 Simpan Perubahan";
    }
}

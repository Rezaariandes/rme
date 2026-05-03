// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL MODAL
//  Modal lihat & edit riwayat kunjungan
// ════════════════════════════════════════════════════════

// ── BUKA MODAL RIWAYAT ──
function openModal(index) {
    const r = currentRiwayat[index];
    if (!r) return;
    if ($('modalIndex')) $('modalIndex').value = index;

    // ── VIEW: Header tanggal ──
    if ($('modalTanggalInfoView'))
        $('modalTanggalInfoView').innerText =
            "📅 " + (r.tgl ? formatTglIndo(r.tgl) : '-') + " (" + (r.waktu || '00:00') + ")";

    // ── VIEW: TTV — pisahkan sistol/diastol jika format "120/80" ──
    if ($('viewTtv')) {
        const tdParts = (r.td || '').split('/');
        const sistol  = tdParts[0] ? tdParts[0].trim() : '-';
        const diastol = tdParts[1] ? tdParts[1].trim() : '-';
        $('viewTtv').innerHTML =
            `TD: ${sistol}/${diastol} mmHg &nbsp;|&nbsp; Nadi: ${r.nadi||'-'} x/m &nbsp;|&nbsp; Suhu: ${r.suhu||'-'} °C` +
            `<br>RR: ${r.rr||'-'} x/m &nbsp;|&nbsp; BB: ${r.bb||'-'} kg &nbsp;|&nbsp; TB: ${r.tb||'-'} cm`;
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

    // ── EDIT: Header tanggal ──
    if ($('modalTanggalInfoEdit'))
        $('modalTanggalInfoEdit').innerText =
            "✏️ Edit: " + (r.tgl ? formatTglIndo(r.tgl) : '-') + " (" + (r.waktu || '00:00') + ")";

    // ── EDIT: TTV — pisahkan td "120/80" ke dua field terpisah ──
    const tdParts = (r.td || '').split('/');
    if ($('modalSistol'))  $('modalSistol').value  = tdParts[0] ? tdParts[0].trim() : '';
    if ($('modalDiastol')) $('modalDiastol').value = tdParts[1] ? tdParts[1].trim() : '';
    if ($('modalNadi'))    $('modalNadi').value     = r.nadi    || '';
    if ($('modalSuhu'))    $('modalSuhu').value     = r.suhu    || '';
    if ($('modalRr'))      $('modalRr').value       = r.rr      || '';
    if ($('modalBb'))      $('modalBb').value       = r.bb      || '';
    if ($('modalTb'))      $('modalTb').value       = r.tb      || '';

    // ── EDIT: Keluhan & Fisik ──
    if ($('modalKeluhan')) $('modalKeluhan').value = r.keluhan || '';
    if ($('modalFisik'))   $('modalFisik').value   = r.fisik   || '';

    // ── EDIT: Lab ──
    if ($('modalLabGds'))  $('modalLabGds').value  = r.lab_gds  || '';
    if ($('modalLabChol')) $('modalLabChol').value = r.lab_chol || '';
    if ($('modalLabUa'))   $('modalLabUa').value   = r.lab_ua   || '';

    // ── EDIT: Diagnosa ──
    const diagLama = String(r.diag || '');
    if (diagLama.includes(" | ")) {
        if ($('modalDiag1')) $('modalDiag1').value = diagLama.split(" | ")[0];
        if ($('modalDiag2')) $('modalDiag2').value = diagLama.split(" | ")[1];
    } else {
        if ($('modalDiag1')) $('modalDiag1').value = diagLama;
        if ($('modalDiag2')) $('modalDiag2').value = '';
    }
    if ($('modalTerapi')) $('modalTerapi').value = r.terapi || '';

    // ── ROLE: Sembunyikan Diagnosa & Terapi untuk Paramedis ──
    const isParamedis = window._isParamedis === true;

    // View mode
    const viewDiagRow   = $('viewDiagRow');
    const viewTerapiRow = $('viewTerapiRow');
    if (viewDiagRow)   viewDiagRow.style.display   = isParamedis ? 'none' : '';
    if (viewTerapiRow) viewTerapiRow.style.display  = isParamedis ? 'none' : '';

    // Edit mode
    const editDiagSection = $('modalEditDiagSection');
    if (editDiagSection) editDiagSection.style.display = isParamedis ? 'none' : '';

    toggleEditModal(false);

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

    const idx = $('modalIndex') ? parseInt($('modalIndex').value) : 0;
    const r   = currentRiwayat[idx];
    if (!r) {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Perubahan"; }
        return showToast("❌ Data tidak ditemukan", "error");
    }

    const d1 = $('modalDiag1') ? $('modalDiag1').value : '';
    const d2 = $('modalDiag2') ? $('modalDiag2').value : '';
    const diagGabung = d2 ? (d1 + " | " + d2) : d1;

    // Gabungkan sistol/diastol kembali ke format "120/80"
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
        lab_gds:  $('modalLabGds')  ? $('modalLabGds').value  : '',
        lab_chol: $('modalLabChol') ? $('modalLabChol').value : '',
        lab_ua:   $('modalLabUa')   ? $('modalLabUa').value   : '',
        diagnosa: diagGabung,
        terapi:   $('modalTerapi')  ? $('modalTerapi').value  : ''
    };

    try {
        await sb_saveKunjungan(payload);
        showToast("✅ Perubahan berhasil disimpan", "success");

        Object.assign(r, {
            keluhan:  payload.keluhan,  fisik:    payload.fisik,
            td:       payload.td,       nadi:     payload.nadi,
            suhu:     payload.suhu,     rr:       payload.rr,
            bb:       payload.bb,       tb:       payload.tb,
            lab_gds:  payload.lab_gds,  lab_chol: payload.lab_chol,
            lab_ua:   payload.lab_ua,
            diag:     payload.diagnosa, terapi:   payload.terapi
        });

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

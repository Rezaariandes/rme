// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL USER
//  Manajemen akun user & PIN
// ════════════════════════════════════════════════════════

let userListCache = [];

// ── POPULATE DROPDOWN JABATAN DARI JABATAN_MEDIS (DINAMIS) ──
// Dipanggil saat halaman pageUser dibuka (via switchPage di app.js)
function renderJabatanSelect() {
    const sel = $('u_jabatan');
    if (!sel) return;
    const jabList = (typeof JABATAN_MEDIS !== 'undefined' && Array.isArray(JABATAN_MEDIS) && JABATAN_MEDIS.length > 0)
        ? JABATAN_MEDIS
        : ['Dokter', 'Admin', 'Paramedis'];
    const current = sel.value;
    sel.innerHTML = jabList.map(j =>
        `<option value="${j}" ${j === current ? 'selected' : ''}>${j}</option>`
    ).join('');
    // Tampilkan/sembunyikan form Satu Sehat sesuai jabatan saat ini
    _toggleFormDokterBaru();
}

// ── TOGGLE TAMPILAN FORM DATA SATU SEHAT (saat jabatan = Dokter) ──
function _toggleFormDokterBaru() {
    const sel   = $('u_jabatan');
    const panel = $('panelDataDokterBaru');
    if (!sel || !panel) return;
    const isDokter = sel.value.toLowerCase() === 'dokter';
    panel.style.display = isDokter ? 'block' : 'none';
}

// ── AMBIL DAFTAR USER DARI SUPABASE ──
async function fetchUsers() {
    const listEl = $('listUserContainer');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat data user...</div>`;

    // Refresh dropdown jabatan setiap kali halaman dibuka
    renderJabatanSelect();

    try {
        const data = await sb_getUsers();
        userListCache = (data.data || []).map(u => ({
            id:      u.id,
            nama:    u.nama,
            jabatan: u.jabatan
        }));
        renderUserList();
    } catch (e) {
        if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div>Gagal memuat daftar user.</div>`;
    }
}

// ── RENDER DAFTAR USER ──
function renderUserList() {
    const c = $('listUserContainer');
    if (!c) return;
    if (userListCache.length === 0) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div>Belum ada user.</div>`;
        return;
    }
    c.innerHTML = userListCache.map(u => {
        // Tandai khusus akun bertipe Dokter agar mudah dikenali
        const isDokter = u.jabatan && u.jabatan.toLowerCase() === 'dokter';
        const badge = isDokter
            ? `<div class="status-badge" style="background:rgba(5,150,105,0.12);color:#065f46;border:1px solid rgba(5,150,105,0.25);font-size:10px;">👨‍⚕️ Dokter Pemeriksa</div>`
            : `<div class="status-badge status-wait">${u.jabatan}</div>`;
        return `
        <div class="visit-card" onclick="openEditUserModal('${u.id}')">
            <div class="visit-time-badge" style="font-size:18px;">${isDokter ? '👨‍⚕️' : '👤'}</div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:14px;">${u.nama}</div>
                <div style="font-size:11px; color:var(--text-muted);">${u.jabatan}</div>
                ${isDokter ? `<div style="font-size:10px;color:#059669;margin-top:2px;">✅ Kunjungan pasien akan tercatat atas nama dokter ini</div>` : ''}
            </div>
            ${badge}
        </div>`;
    }).join('');
}

// ── SIMPAN USER BARU ──
async function simpanUserBaru() {
    const nama    = $('u_nama')    ? $('u_nama').value.trim()    : '';
    const jabatan = $('u_jabatan') ? $('u_jabatan').value.trim() : '';
    const pin     = $('u_pin')     ? $('u_pin').value.trim()     : '';

    if (!nama || !jabatan || !pin) return showToast("⚠️ Semua kolom wajib diisi!", "warning");
    if (pin.length < 4) return showToast("⚠️ PIN minimal 4 digit", "warning");

    const isDokter = jabatan.toLowerCase() === 'dokter';

    // Validasi data Satu Sehat jika jabatan Dokter
    if (isDokter) {
        const nik = $('u_nik') ? $('u_nik').value.trim() : '';
        if (!nik) return showToast("⚠️ NIK wajib diisi untuk akun Dokter!", "warning");
    }

    const btn = $('btnSimpanUser');
    if (btn) { btn.disabled = true; btn.innerText = "Menyimpan..."; }

    try {
        // 1. Simpan user ke tabel users, dapatkan ID user yang baru dibuat
        const newUser = await sb_saveUser({ nama, jabatan, pin });

        // 2. Jika jabatan Dokter → otomatis daftarkan ke tabel dokter
        if (isDokter && newUser && newUser.userId) {
            const nik      = $('u_nik')      ? $('u_nik').value.trim()      : '';
            const ihs      = $('u_ihs')      ? $('u_ihs').value.trim()      : '';
            const sip      = $('u_sip')      ? $('u_sip').value.trim()      : '';
            const spesialis = $('u_spesialis') ? $('u_spesialis').value.trim() : '';

            await sb_tambahDokterDariUser({
                nama, jabatan: 'Dokter',
                nik, ihs, sip, spesialis,
                user_id: newUser.userId
            });

            // Refresh cache dokter di settings jika sudah dimuat
            if (typeof _dokterList !== 'undefined') {
                try {
                    const data = await sb_getSettings();
                    if (data.dokter) {
                        window._dokterAktif = data.dokter;
                    }
                } catch(e) {}
            }
        }

        showToast(
            isDokter
                ? `✅ Akun Dokter "${nama}" berhasil dibuat & terdaftar di Data Dokter`
                : `✅ User baru "${nama}" (${jabatan}) berhasil disimpan`,
            "success"
        );

        // Reset form
        if ($('u_nama'))      $('u_nama').value      = '';
        if ($('u_pin'))       $('u_pin').value        = '';
        if ($('u_nik'))       $('u_nik').value        = '';
        if ($('u_ihs'))       $('u_ihs').value        = '';
        if ($('u_sip'))       $('u_sip').value        = '';
        if ($('u_spesialis')) $('u_spesialis').value  = '';
        renderJabatanSelect(); // reset dropdown ke posisi pertama & sembunyikan panel dokter

        fetchUsers();
        if (typeof loadLoginUsers === "function") loadLoginUsers();
    } catch (e) {
        showToast("❌ Gagal menyimpan user: " + (e.message || ''), "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Akun User"; }
    }
}

// ── BUKA MODAL EDIT USER ──
function openEditUserModal(id) {
    const u = userListCache.find(x => x.id === id);
    if (!u) return;
    if ($('edit_u_id'))      $('edit_u_id').value      = u.id;
    if ($('edit_u_nama'))    $('edit_u_nama').value    = u.nama;
    if ($('edit_u_jabatan')) $('edit_u_jabatan').value = u.jabatan;
    if ($('edit_u_pin'))     $('edit_u_pin').value     = '';
    const modal = $('modalUser');
    if (modal) modal.classList.add('show');
}

// ── UPDATE PIN USER ──
async function updatePinUser() {
    const id     = $('edit_u_id')  ? $('edit_u_id').value         : '';
    const newPin = $('edit_u_pin') ? $('edit_u_pin').value.trim() : '';
    if (!newPin || newPin.length < 4) return showToast("⚠️ PIN minimal 4 digit", "warning");

    const btn = $('btnUpdateUser');
    if (btn) { btn.disabled = true; btn.innerText = "Mengupdate..."; }

    try {
        await sb_saveUser({ userId: id, pin: newPin });
        showToast("✅ PIN berhasil diupdate", "success");
        const modal = $('modalUser');
        if (modal) modal.classList.remove('show');
        fetchUsers();
    } catch (e) {
        showToast("❌ Gagal update PIN: " + (e.message || ''), "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Update User"; }
    }
}

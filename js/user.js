// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL USER
//  Manajemen akun user & PIN
//  KEAMANAN: PIN tidak pernah ditampilkan ke frontend
// ════════════════════════════════════════════════════════

let userListCache = [];

// ── AMBIL DAFTAR USER DARI SERVER ──
async function fetchUsers() {
    const listEl = $('listUserContainer');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat data user...</div>`;
    try {
        const res  = await fetch(APP_URL, { method: 'POST', body: JSON.stringify({ action: "getUsers" }) });
        const data = await res.json();
        // Simpan cache tanpa field PIN (PIN tidak boleh dikirim ke frontend)
        userListCache = (data.data || data.users || []).map(u => ({
            id:      u.id,
            nama:    u.nama,
            jabatan: u.jabatan
            // PIN sengaja tidak disimpan di frontend
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
    c.innerHTML = userListCache.map(u => `
        <div class="visit-card" onclick="openEditUserModal('${u.id}')">
            <div class="visit-time-badge" style="font-size:18px;">👤</div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:14px;">${u.nama}</div>
                <div style="font-size:11px; color:var(--text-muted);">${u.jabatan}</div>
            </div>
            <div class="status-badge status-wait">Ganti PIN ✏️</div>
        </div>
    `).join('');
}

// ── SIMPAN USER BARU ──
async function simpanUserBaru() {
    const nama    = $('u_nama')    ? $('u_nama').value.trim()    : '';
    const jabatan = $('u_jabatan') ? $('u_jabatan').value.trim() : '';
    const pin     = $('u_pin')     ? $('u_pin').value.trim()     : '';

    if (!nama || !jabatan || !pin) return showToast("⚠️ Semua kolom wajib diisi!", "warning");
    if (pin.length < 4) return showToast("⚠️ PIN minimal 4 digit", "warning");

    const btn = $('btnSimpanUser');
    if (btn) { btn.disabled = true; btn.innerText = "Menyimpan..."; }

    try {
        await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "saveUser", nama, jabatan, pin })
        });
        showToast("✅ User baru berhasil disimpan", "success");
        if ($('u_nama'))    $('u_nama').value    = '';
        if ($('u_jabatan')) $('u_jabatan').value = 'Admin';
        if ($('u_pin'))     $('u_pin').value     = '';
        fetchUsers();
        if (typeof loadLoginUsers === "function") loadLoginUsers();
    } catch (e) {
        showToast("❌ Gagal menyimpan user", "error");
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
    // Tidak pre-fill PIN — user harus ketik PIN baru
    if ($('edit_u_pin'))     $('edit_u_pin').value     = '';
    const modal = $('modalUser');
    if (modal) modal.classList.add('show');
}

// ── UPDATE PIN USER ──
async function updatePinUser() {
    const id     = $('edit_u_id')  ? $('edit_u_id').value              : '';
    const newPin = $('edit_u_pin') ? $('edit_u_pin').value.trim() : '';
    if (!newPin || newPin.length < 4) return showToast("⚠️ PIN minimal 4 digit", "warning");

    const btn = $('btnUpdateUser');
    if (btn) { btn.disabled = true; btn.innerText = "Mengupdate..."; }

    try {
        await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "saveUser", userId: id, pin: newPin })
        });
        showToast("✅ PIN berhasil diupdate", "success");
        const modal = $('modalUser');
        if (modal) modal.classList.remove('show');
        fetchUsers();
    } catch (e) {
        showToast("❌ Gagal update PIN", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Update User"; }
    }
}

// ── AUTO-INIT: dipanggil dari initApp() setelah fragment HTML ter-inject ──
// BUG FIX: auto-init dihapus; fetchUsers() dipanggil dari switchPage/initApp
// sehingga elemen #listUserContainer sudah pasti ada di DOM.

// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL USER
//  Manajemen akun user & PIN (hanya Dokter & Admin)
// ════════════════════════════════════════════════════════

let userListCache = [];

// ── AMBIL DAFTAR USER DARI SERVER ──
async function fetchUsers() {
    const listEl = $('listUserContainer');
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat data user...</div>`;
    try {
        const res  = await fetch(APP_URL, { method: 'POST', body: JSON.stringify({ action: "getUsers" }) });
        const data = await res.json();
        
        // PERBAIKAN: Mengambil array dari data.data (sesuai output Google Apps Script)
        userListCache = data.data || data.users || []; 
        
        renderUserList();
    } catch (e) {
        listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div>Gagal memuat daftar user.</div>`;
    }
}

// ── RENDER DAFTAR USER ──
function renderUserList() {
    const c = $('listUserContainer');
    if (userListCache.length === 0) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div>Belum ada user.</div>`;
        return;
    }
    c.innerHTML = userListCache.map(u => `
        <div class="visit-card" onclick="openEditUserModal('${u.id}')">
            <div class="visit-time-badge" style="font-size:16px;">👤</div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.nama}</div>
                <div style="font-size:11px; color:var(--text-muted);">${u.jabatan}</div>
            </div>
            <div class="status-badge status-wait">Edit PIN ✏️</div>
        </div>
    `).join('');
}

// ── SIMPAN USER BARU ──
async function simpanUserBaru() {
    const nama    = $('u_nama').value.trim();
    const jabatan = $('u_jabatan').value.trim();
    const pin     = $('u_pin').value.trim();

    if (!nama || !jabatan || !pin) return showToast("⚠️ Semua kolom wajib diisi!", "warning");
    if (pin.length < 4) return showToast("⚠️ PIN minimal 4 digit", "warning");

    const btn = $('btnSimpanUser');
    btn.disabled = true;
    btn.innerText = "Menyimpan...";

    try {
        await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "saveUser", nama, jabatan, pin })
        });
        showToast("✅ User baru berhasil disimpan", "success");
        $('u_nama').value    = '';
        $('u_jabatan').value = 'Admin';
        $('u_pin').value     = '';
        fetchUsers(); // Refresh daftar setelah save
        
        // Coba sinkronisasi juga layar login PIN jika belum direfresh
        if (typeof loadLoginUsers === "function") loadLoginUsers();
    } catch (e) {
        showToast("❌ Gagal menyimpan user", "error");
    } finally {
        btn.disabled  = false;
        btn.innerText = "💾 Simpan Akun User";
    }
}

// ── BUKA MODAL EDIT USER ──
function openEditUserModal(id) {
    const u = userListCache.find(x => x.id === id);
    if (!u) return;
    $('edit_u_id').value      = u.id;
    $('edit_u_nama').value    = u.nama;
    $('edit_u_jabatan').value = u.jabatan;
    $('edit_u_pin').value     = u.pin || ''; // Hindari undefined jika PIN tidak dikirim ke frontend
    $('modalUser').classList.add('show');
}

// ── UPDATE PIN USER ──
async function updatePinUser() {
    const id     = $('edit_u_id').value;
    const newPin = $('edit_u_pin').value.trim();
    if (!newPin || newPin.length < 4) return showToast("⚠️ PIN minimal 4 digit", "warning");

    const btn = $('btnUpdateUser');
    btn.disabled  = true;
    btn.innerText = "Mengupdate...";

    try {
        await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "saveUser", userId: id, pin: newPin })
        });
        showToast("✅ PIN berhasil diupdate", "success");
        $('modalUser').classList.remove('show');
        fetchUsers();
    } catch (e) {
        showToast("❌ Gagal update PIN", "error");
    } finally {
        btn.disabled  = false;
        btn.innerText = "💾 Update User";
    }
}

// Panggil fungsi secara otomatis saat file dimuat agar daftar langsung tersedia
document.addEventListener("DOMContentLoaded", () => {
    fetchUsers();
});
// ════════════════════════════════════════════════════════
//  KLIKPRO RME — AUTENTIKASI PIN
//  Mengelola layar kunci PIN dan sesi login user (Expire: 3 Jam)
// ════════════════════════════════════════════════════════

let currentPinInput = "";
let loggedInUser    = null; // { nama, jabatan }

// ── INISIALISASI PIN LOCK (CEK SESI 3 JAM) ──
function initPinLock() {
    const isUnlocked = localStorage.getItem('is_unlocked');
    const expiryTime = localStorage.getItem('session_expiry');
    const now        = Date.now();

    if (isUnlocked === 'true' && expiryTime && now < parseInt(expiryTime)) {
        const pinScreen = document.getElementById('pinScreen');
        if (pinScreen) pinScreen.style.display = 'none';

        const drNameEl = document.getElementById('drName');
        if (drNameEl && localStorage.getItem('rme_drName')) {
            drNameEl.innerText = localStorage.getItem('rme_drName');
        }

        try {
            loggedInUser = JSON.parse(localStorage.getItem('logged_user') || 'null');
        } catch (e) {
            loggedInUser = null;
        }

        applyRoleRestrictions();
        return;
    }

    // Sesi tidak valid / kedaluwarsa — bersihkan
    localStorage.removeItem('is_unlocked');
    localStorage.removeItem('logged_user');
    localStorage.removeItem('session_expiry');

    const pinScreen = document.getElementById('pinScreen');
    if (pinScreen) pinScreen.style.display = 'flex';
    
    loadLoginUsers();
    updatePinDots();
}

// ── MENGAMBIL DAFTAR USER DARI SUPABASE ──
async function loadLoginUsers() {
    const select = document.getElementById('loginUserSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Memuat user...</option>';
    
    try {
        // Menggunakan fungsi dari Supabase Client
        const res = await sb_getUsers();
        
        select.innerHTML = '';

        if (res.status === "success" && res.data && res.data.length > 0) {
            res.data.forEach((u, i) => {
                const opt       = document.createElement('option');
                opt.value       = u.id;
                opt.textContent = u.nama + ' (' + u.jabatan + ')';
                if (i === 0) opt.selected = true;
                select.appendChild(opt);
            });
        } else {
            select.innerHTML = '<option value="">Belum ada user / Gagal memuat</option>';
        }
    } catch (e) {
        console.error("Gagal muat user:", e);
        if (select) select.innerHTML = '<option value="">Koneksi bermasalah</option>';
    }
}

// ── INPUT PIN ──
function inputPin(num) {
    if (currentPinInput.length < 6) {
        currentPinInput += num;
        updatePinDots();
        if (currentPinInput.length === 6) setTimeout(checkPinServer, 200);
    }
}

function deletePin() {
    if (currentPinInput.length > 0) {
        currentPinInput = currentPinInput.slice(0, -1);
        updatePinDots();
    }
}

function updatePinDots() {
    const dotsEl = document.getElementById('pinDots');
    if (!dotsEl) return;
    const dots = dotsEl.children;
    for (let i = 0; i < 6; i++) {
        dots[i].className = 'pin-dot' + (i < currentPinInput.length ? ' filled' : '');
    }
}

// ── VERIFIKASI PIN KE SUPABASE ──
async function checkPinServer() {
    const select = document.getElementById('loginUserSelect');
    const userId = select ? select.value : '';

    if (!userId) {
        showPinError("Pilih akun terlebih dahulu!");
        return;
    }

    const subtitle = document.getElementById('pinSubtitle');
    if (subtitle) {
        subtitle.innerText    = "Memverifikasi...";
        subtitle.style.color  = "var(--primary)";
    }

    try {
        // Menggunakan fungsi verifikasi dari Supabase Client
        const res = await sb_verifyPin(userId, currentPinInput);

        if (res.isValid) {
            loggedInUser = res.user;

            // Sesi 3 jam
            const expiry = Date.now() + (3 * 60 * 60 * 1000);
            localStorage.setItem('is_unlocked',  'true');
            localStorage.setItem('logged_user',  JSON.stringify(loggedInUser));
            localStorage.setItem('session_expiry', expiry);

            if (res.user) {
                const label = res.user.nama + " (" + res.user.jabatan + ")";
                const drEl  = document.getElementById('drName');
                if (drEl) drEl.innerText = label;
                localStorage.setItem('rme_drName', label);
            }

            unlockScreen();
            applyRoleRestrictions();
        } else {
            showPinError("PIN Salah! Coba lagi.");
        }
    } catch (e) {
        console.error("Gagal verifikasi PIN:", e);
        showPinError("Koneksi gagal. Cek internet.");
    }
}

function showPinError(msg) {
    const subtitle = document.getElementById('pinSubtitle');
    if (subtitle) { subtitle.innerText = msg; subtitle.style.color = "var(--danger)"; }
    
    const dotsEl = document.getElementById('pinDots');
    if (dotsEl) Array.from(dotsEl.children).forEach(d => d.classList.add('error'));
    
    setTimeout(() => {
        currentPinInput = "";
        updatePinDots();
        if (subtitle) { subtitle.style.color = ""; subtitle.innerText = "Masukkan PIN 6 Digit"; }
    }, 1300);
}

function unlockScreen() {
    const screen = document.getElementById('pinScreen');
    if (screen) {
        screen.classList.add('hidden');
        setTimeout(() => { screen.style.display = 'none'; }, 420);
    }
    if (typeof showToast === 'function') {
        showToast("🔓 Selamat datang, " + (loggedInUser ? loggedInUser.nama : ''), "success");
    }
}

// ── PEMBATASAN AKSES BERDASARKAN JABATAN ──
function applyRoleRestrictions() {
    if (!loggedInUser) return;

    const jabatan     = loggedInUser.jabatan;
    const bolehMedis  = JABATAN_MEDIS.includes(jabatan);
    const isParamedis = jabatan === 'Paramedis';

    // Tombol lanjut periksa
    const btnNext = document.getElementById('btnNext');
    if (btnNext) btnNext.style.display = bolehMedis ? '' : 'none';

    // Seksi klinis disembunyikan untuk Paramedis
    const sectionKlinis = document.getElementById('sectionKlinis');
    if (sectionKlinis) {
        sectionKlinis.style.display = isParamedis ? 'none' : 'block';
    }

    // ── PERAWAT: Sembunyikan diagnosa di form ──
    const diagnosaEl = document.querySelector('#diagnosa');
    if (diagnosaEl) {
        const rowDiagnosa = diagnosaEl.closest('.row');
        if (rowDiagnosa) rowDiagnosa.style.display = isParamedis ? 'none' : '';
    }

    // ── PERAWAT: Sembunyikan nav item halaman User ──
    document.querySelectorAll('.nav-item').forEach(navEl => {
        const onclick = navEl.getAttribute('onclick') || '';
        if (onclick.includes('pageUser')) {
            navEl.style.display = isParamedis ? 'none' : '';
        }
    });

    // Simpan flag ke window supaya bisa diakses modul lain (render riwayat, dll.)
    window._isParamedis = isParamedis;

    if (!bolehMedis && localStorage.getItem('activePage') === 'pageMedis') {
        localStorage.removeItem('activePage');
    }
}

// ── LOGOUT ──
function logout() {
    localStorage.removeItem('is_unlocked');
    localStorage.removeItem('logged_user');
    localStorage.removeItem('session_expiry');
    localStorage.removeItem('rme_drName');
    if (typeof clearSession === 'function') clearSession();
    location.reload();
}

// ── CEK AKSES SEBELUM KE pageMedis ──
function canAccessMedis() {
    if (!loggedInUser) {
        if (typeof showToast === 'function') showToast("⛔ Anda belum login.", "error");
        return false;
    }
    if (!JABATAN_MEDIS.includes(loggedInUser.jabatan)) {
        if (typeof showToast === 'function') showToast("⛔ Akses ditolak. Hanya Dokter, Admin & Paramedis.", "error");
        return false;
    }
    return true;
}
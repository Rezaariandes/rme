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
        $('pinScreen').style.display = 'none';

        const drNameEl = $('drName');
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

    $('pinScreen').style.display = 'flex';
    loadLoginUsers();
    updatePinDots();
}

// ── MENGAMBIL DAFTAR USER (tanpa data PIN) ──
async function loadLoginUsers() {
    const select = $('loginUserSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Memuat user...</option>';
    try {
        const res  = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getUsers" })
        });
        const data = await res.json();
        select.innerHTML = '';

        if (data.status === "success" && data.data && data.data.length > 0) {
            data.data.forEach((u, i) => {
                const opt      = document.createElement('option');
                opt.value      = u.id;
                opt.textContent = u.nama + ' (' + u.jabatan + ')';
                if (i === 0) opt.selected = true;
                select.appendChild(opt);
            });
        } else {
            select.innerHTML = '<option value="">Belum ada user / Gagal memuat</option>';
        }
    } catch (e) {
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
    const dotsEl = $('pinDots');
    if (!dotsEl) return;
    const dots = dotsEl.children;
    for (let i = 0; i < 6; i++) {
        dots[i].className = 'pin-dot' + (i < currentPinInput.length ? ' filled' : '');
    }
}

// ── VERIFIKASI PIN KE SERVER ──
async function checkPinServer() {
    const select = $('loginUserSelect');
    const userId = select ? select.value : '';

    if (!userId) {
        showPinError("Pilih akun terlebih dahulu!");
        return;
    }

    const subtitle = $('pinSubtitle');
    if (subtitle) {
        subtitle.innerText    = "Memverifikasi...";
        subtitle.style.color  = "var(--primary)";
    }

    try {
        const res  = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "verifyPin", userId, pin: currentPinInput })
        });
        const data = await res.json();

        if (data.isValid) {
            loggedInUser = data.user;

            // Sesi 3 jam
            const expiry = Date.now() + (3 * 60 * 60 * 1000);
            localStorage.setItem('is_unlocked',  'true');
            localStorage.setItem('logged_user',  JSON.stringify(loggedInUser));
            localStorage.setItem('session_expiry', expiry);

            if (data.user) {
                const label = data.user.nama + " (" + data.user.jabatan + ")";
                const drEl  = $('drName');
                if (drEl) drEl.innerText = label;
                localStorage.setItem('rme_drName', label);
            }

            unlockScreen();
            applyRoleRestrictions();
        } else {
            showPinError("PIN Salah! Coba lagi.");
        }
    } catch (e) {
        showPinError("Koneksi gagal. Cek internet.");
    }
}

function showPinError(msg) {
    const subtitle = $('pinSubtitle');
    if (subtitle) { subtitle.innerText = msg; subtitle.style.color = "var(--danger)"; }
    const dotsEl = $('pinDots');
    if (dotsEl) Array.from(dotsEl.children).forEach(d => d.classList.add('error'));
    setTimeout(() => {
        currentPinInput = "";
        updatePinDots();
        if (subtitle) { subtitle.style.color = ""; subtitle.innerText = "Masukkan PIN 6 Digit"; }
    }, 1300);
}

function unlockScreen() {
    const screen = $('pinScreen');
    if (screen) {
        screen.classList.add('hidden');
        setTimeout(() => { screen.style.display = 'none'; }, 420);
    }
    showToast("🔓 Selamat datang, " + (loggedInUser ? loggedInUser.nama : ''), "success");
}

// ── PEMBATASAN AKSES BERDASARKAN JABATAN ──
function applyRoleRestrictions() {
    if (!loggedInUser) return;

    const jabatan     = loggedInUser.jabatan;
    const bolehMedis  = JABATAN_MEDIS.includes(jabatan);
    const isParamedis   = jabatan === 'Paramedis';

    // Tombol lanjut periksa
    const btnNext = $('btnNext');
    if (btnNext) btnNext.style.display = bolehMedis ? '' : 'none';

    // Seksi klinis disembunyikan untuk Paramedis
    const sectionKlinis = $('sectionKlinis');
    if (sectionKlinis) {
        sectionKlinis.style.display = (jabatan === 'Paramedis') ? 'none' : 'block';
    }

    // ── PERAWAT: Sembunyikan diagnosa di form ──
    const rowDiagnosa = document.querySelector('#diagnosa')?.closest('.row');
    if (rowDiagnosa) rowDiagnosa.style.display = isParamedis ? 'none' : '';

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
        showToast("⛔ Anda belum login.", "error");
        return false;
    }
    if (!JABATAN_MEDIS.includes(loggedInUser.jabatan)) {
        showToast("⛔ Akses ditolak. Hanya Dokter, Admin & Paramedis.", "error");
        return false;
    }
    return true;
}

// ── AUTO-INIT: dipanggil dari initApp() di app.js setelah semua fragment HTML ter-inject ──
// BUG FIX: Sebelumnya menggunakan DOMContentLoaded yang sudah terlambat (DOM sudah ready
// saat skrip diinjeksikan dinamis), namun elemen PIN belum tentu ada di DOM jika fragment
// HTML belum di-inject. initPinLock() sekarang dipanggil eksplisit dari initApp().

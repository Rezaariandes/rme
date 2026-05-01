// ════════════════════════════════════════════════════════
//  KLIKPRO RME — AUTENTIKASI PIN
//  Mengelola layar kunci PIN dan sesi login user (Expire: 3 Jam)
// ════════════════════════════════════════════════════════

let currentPinInput = "";
let loggedInUser = null; // { nama, jabatan }

// ── INISIALISASI PIN LOCK (CEK SESI 3 JAM) ──
function initPinLock() {
    const isUnlocked = localStorage.getItem('is_unlocked');
    const expiryTime = localStorage.getItem('session_expiry');
    const now = Date.now();

    // Cek apakah ada sesi dan waktunya belum melewati 3 jam
    if (isUnlocked === 'true' && expiryTime && now < parseInt(expiryTime)) {
        $('pinScreen').style.display = 'none';
        
        // Pulihkan identitas dari localStorage
        if (localStorage.getItem('rme_drName')) {
            $('drName').innerText = localStorage.getItem('rme_drName');
        }
        
        // Pulihkan objek user dari sesi
        try {
            loggedInUser = JSON.parse(localStorage.getItem('logged_user') || 'null');
        } catch (e) { loggedInUser = null; }
        
        // (Opsional) Jika ingin memperpanjang waktu 3 jam setiap kali user refresh/buka tab baru
        // localStorage.setItem('session_expiry', now + (3 * 60 * 60 * 1000));
        
        applyRoleRestrictions();
        return;
    } else {
        // Jika sesi tidak ada atau sudah kedaluwarsa (> 3 jam), bersihkan data
        localStorage.removeItem('is_unlocked');
        localStorage.removeItem('logged_user');
        localStorage.removeItem('session_expiry');
    }

    // Tampilkan layar PIN jika tidak valid
    $('pinScreen').style.display = 'flex';
    
    // Panggil fungsi untuk mengisi dropdown user saat layar login muncul
    loadLoginUsers(); 

    updatePinDots();
}

// ── MENGAMBIL DATA USER DARI DATABASE ──
async function loadLoginUsers() {
    try {
        const res = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getUsers" }) 
        });
        const data = await res.json();
        
        const select = $('loginUserSelect');
        select.innerHTML = ''; // Kosongkan agar tidak ada opsi kosong di awal

        if (data.status === "success" && data.data && data.data.length > 0) {
            data.data.forEach((u, index) => {
                // Berikan atribut 'selected' jika ini adalah user pertama (index ke-0)
                const isSelected = (index === 0) ? 'selected' : '';
                select.innerHTML += `<option value="${u.id}" ${isSelected}>${u.nama} (${u.jabatan})</option>`;
            });
        } else {
            select.innerHTML = '<option value="">Belum ada user / Gagal memuat</option>';
        }
    } catch (e) {
        $('loginUserSelect').innerHTML = '<option value="">Koneksi bermasalah</option>';
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
    const dots = $('pinDots').children;
    for (let i = 0; i < 6; i++) {
        dots[i].className = 'pin-dot' + (i < currentPinInput.length ? ' filled' : '');
    }
}

// ── VERIFIKASI PIN KE SERVER ──
async function checkPinServer() {
    const selectedUserId = $('loginUserSelect').value;

    // Cegah login jika user belum dipilih dari dropdown
    if (!selectedUserId) {
        showPinError("Pilih akun terlebih dahulu!");
        return;
    }

    const subtitle = $('pinSubtitle');
    subtitle.innerText = "Memverifikasi...";
    subtitle.style.color = "var(--primary)";

    try {
        const res = await fetch(APP_URL, {
            method: 'POST',
            // Kirim userId beserta PIN ke server
            body: JSON.stringify({ action: "verifyPin", userId: selectedUserId, pin: currentPinInput })
        });
        const data = await res.json();

        if (data.isValid) {
            loggedInUser = data.user; // { nama, jabatan }
            
            // Hitung waktu kedaluwarsa: Sekarang + (3 Jam x 60 Menit x 60 Detik x 1000 Milidetik)
            const expiryTime = Date.now() + (3 * 60 * 60 * 1000);

            // Simpan sesi ke localStorage
            localStorage.setItem('is_unlocked', 'true');
            localStorage.setItem('logged_user', JSON.stringify(loggedInUser));
            localStorage.setItem('session_expiry', expiryTime);

            if (data.user) {
                const finalName = data.user.nama + " (" + data.user.jabatan + ")";
                $('drName').innerText = finalName;
                localStorage.setItem('rme_drName', finalName);
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
    $('pinSubtitle').innerText = msg;
    $('pinSubtitle').style.color = "var(--danger)";
    const dots = $('pinDots').children;
    for (let i = 0; i < 6; i++) dots[i].classList.add('error');
    setTimeout(() => {
        currentPinInput = "";
        updatePinDots();
        $('pinSubtitle').style.color = "var(--text-muted)";
        $('pinSubtitle').innerText = "Masukkan PIN 6 Digit";
    }, 1200);
}

function unlockScreen() {
    $('pinScreen').classList.add('hidden');
    setTimeout(() => { $('pinScreen').style.display = 'none'; }, 400);
    showToast("🔓 Login Berhasil — Selamat datang, " + (loggedInUser ? loggedInUser.nama : ''), "success");
}

// ── PEMBATASAN AKSES BERDASARKAN JABATAN ──
function applyRoleRestrictions() {
    if (!loggedInUser) return;

    const bolehMedis = JABATAN_MEDIS.includes(loggedInUser.jabatan);

    // Tampilkan/sembunyikan tombol "Lanjut Periksa"
    const btnNext = $('btnNext');
    if (btnNext) {
        btnNext.style.display = bolehMedis ? '' : 'none';
    }

    // Tampilkan/sembunyikan Section Klinis berdasarkan jabatan
    const sectionKlinis = $('sectionKlinis');
    if (sectionKlinis) {
        if (loggedInUser.jabatan === 'Paramedis') {
            sectionKlinis.style.display = 'none'; // Sembunyikan untuk Paramedis
        } else {
            sectionKlinis.style.display = 'block'; // Tampilkan untuk Dokter/Admin
        }
    }

    // Jika user tidak punya akses dan sesi menyimpan pageMedis, redirect ke pageDaftar
    if (!bolehMedis && localStorage.getItem('activePage') === 'pageMedis') {
        localStorage.removeItem('activePage');
    }
}

// ── LOGOUT PENGGUNA ──
function logout() {
    // Bersihkan semua sesi dari localStorage
    localStorage.removeItem('is_unlocked');
    localStorage.removeItem('logged_user');
    localStorage.removeItem('session_expiry');
    localStorage.removeItem('rme_drName');
    
    if (typeof clearSession === 'function') clearSession();
    location.reload();
}

// ── CEK AKSES SEBELUM PINDAH KE pageMedis ──
function canAccessMedis() {
    if (!loggedInUser) {
        showToast("⛔ Anda belum login.", "error");
        return false;
    }
    if (!JABATAN_MEDIS.includes(loggedInUser.jabatan)) {
        showToast("⛔ Akses ditolak. Hanya Dokter, Admin, & Paramedis yang dapat melakukan pemeriksaan.", "error");
        return false;
    }
    return true;
}

// ── PERBAIKAN: Langsung eksekusi jika dipanggil via fetch ──
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initPinLock);
} else {
    initPinLock();
}
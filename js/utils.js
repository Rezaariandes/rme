// ════════════════════════════════════════════════════════
//  KLIKPRO RME — UTILITAS & HELPER UMUM
// ════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

// ── FORMAT TANGGAL ──
function formatTglIndo(tglStr) {
    if (!tglStr) return "";
    tglStr = String(tglStr).trim();
    if (tglStr.includes('/')) return tglStr;
    if (tglStr.includes('-')) {
        const p = tglStr.split('-');
        if (p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
    }
    return tglStr;
}

function hitungUmur(tglStr) {
    if (!tglStr) return "-";
    tglStr = String(tglStr).trim();
    let parts = tglStr.includes('/') ? tglStr.split('/') : tglStr.split('-');
    let bD = parts.length === 3
        ? (parts[0].length === 4
            ? new Date(parts[0], parts[1] - 1, parts[2])
            : new Date(parts[2], parts[1] - 1, parts[0]))
        : new Date(tglStr);
    if (isNaN(bD)) return "-";
    let age = new Date().getFullYear() - bD.getFullYear();
    let m = new Date().getMonth() - bD.getMonth();
    if (m < 0 || (m === 0 && new Date().getDate() < bD.getDate())) age--;
    return age + " Thn";
}

// ── TOAST NOTIFICATION ──
function showToast(msg, type) {
    const c = $('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

// ── TEMA WARNA ──
const themes = [
    { h: 210, name: '#2563eb' },
    { h: 270, name: '#7c3aed' },
    { h: 160, name: '#059669' },
    { h: 340, name: '#db2777' },
    { h: 30,  name: '#d97706' },
    { h: 190, name: '#0891b2' }
];
let currentTheme = 0;

function applyTheme(idx) {
    const t = themes[idx];
    document.documentElement.style.setProperty('--bg-h', t.h);
    document.querySelectorAll('.color-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

function buildColorSwitcher() {
    const sw = document.createElement('div');
    sw.className = 'color-switcher';
    themes.forEach((t, i) => {
        const dot = document.createElement('div');
        dot.className = 'color-dot' + (i === 0 ? ' active' : '');
        dot.style.background = t.name;
        dot.title = 'Tema ' + (i + 1);
        dot.onclick = () => { currentTheme = i; applyTheme(i); };
        sw.appendChild(dot);
    });
    return sw;
}

setInterval(() => {
    currentTheme = (currentTheme + 1) % themes.length;
    applyTheme(currentTheme);
}, 8000);

// ── KALKULASI IMT ──
function calculateIMT() {
    const bb = parseFloat($('bb').value);
    const tb = parseFloat($('tb').value) / 100;
    if (bb && tb && tb > 0) {
        const imt = (bb / (tb * tb)).toFixed(1);
        let kat = imt < 18.5 ? "Underweight" : imt < 25 ? "Normal" : imt < 30 ? "Overweight" : "Obesitas";
        $('imtCalc').innerText = `IMT: ${imt} (${kat})`;
    } else {
        $('imtCalc').innerText = "";
    }
}

// ── CEK TENSI TINGGI ──
function checkTensi() {
    const s = parseInt($('sistol').value);
    const d = parseInt($('diastol').value);
    if (s >= 140) $('sistol').classList.add('is-high'); else $('sistol').classList.remove('is-high');
    if (d >= 90) $('diastol').classList.add('is-high'); else $('diastol').classList.remove('is-high');
}

// ── AUTO-SAVE & CLEAR SESSION ──
function loadAutosave() {
    document.querySelectorAll('[data-save="true"]').forEach(el => {
        const v = localStorage.getItem('rme_' + el.id);
        if (v) {
            el.value = v;
            if (el.id === 'bb' || el.id === 'tb') calculateIMT();
            if (el.id === 'sistol' || el.id === 'diastol') checkTensi();
        }
    });
}

function clearSession() {
    document.querySelectorAll('[data-save="true"]').forEach(el => localStorage.removeItem('rme_' + el.id));
    localStorage.removeItem('activePage');
    $('suratSakit').checked = false;
    $('imtCalc').innerText = "";
    $('sistol').classList.remove('is-high');
    $('diastol').classList.remove('is-high');
}

// ── INPUT OTOMATIS FORMAT TANGGAL LAHIR ──
function bindTglLahirFormat(inputId) {
    const el = $(inputId);
    if (!el) return;
    el.addEventListener('input', function () {
        let v = this.value.replace(/\D/g, '');
        if (v.length > 8) v = v.substring(0, 8);
        if (v.length >= 5) {
            this.value = v.substring(0, 2) + '/' + v.substring(2, 4) + '/' + v.substring(4, 8);
        } else if (v.length >= 3) {
            this.value = v.substring(0, 2) + '/' + v.substring(2, 4);
        } else {
            this.value = v;
        }
    });
}

// ── SPEECH TO TEXT ──
function startSTT(targetId) {
    if (!('webkitSpeechRecognition' in window)) return showToast("❌ Mikrofon tidak didukung", "error");
    const btn = event.currentTarget;
    const rec = new webkitSpeechRecognition();
    rec.lang = 'id-ID';
    btn.classList.add('recording');
    showToast("🎙️ Mendengarkan...", "info");
    rec.start();
    rec.onresult = (e) => {
        const el = $(targetId);
        el.value += (el.value ? ' ' : '') + e.results[0][0].transcript;
        localStorage.setItem('rme_' + targetId, el.value);
        showToast("✅ Teks ditambahkan", "success");
        btn.classList.remove('recording');
    };
    rec.onerror = () => btn.classList.remove('recording');
    rec.onend = () => btn.classList.remove('recording');
}

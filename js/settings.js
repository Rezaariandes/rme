// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL SETTINGS
//  Manajemen konfigurasi klinik dari dalam aplikasi
//  Data tersimpan di Google Sheets (sheet: Konfigurasi)
// ════════════════════════════════════════════════════════

// ── State settings lokal ──
let _settingsCache = {};
let _dokterList    = [];   // [{nama, nik, ihs, kode_dokter, jabatan}]

// ────────────────────────────────────────
//  INIT: Dipanggil saat switchPage ke pageSettings
// ────────────────────────────────────────
function initSettings() {
    memuatSettings();
}

// ────────────────────────────────────────
//  MUAT SETTINGS DARI SERVER
// ────────────────────────────────────────
async function memuatSettings() {
    showSettingsBanner("⏳ Memuat konfigurasi dari server...", "info");
    try {
        const res  = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getSettings" })
        });
        const data = await res.json();
        if (data.status !== "success") throw new Error(data.error || "Gagal memuat");

        _settingsCache = data.settings || {};
        _dokterList    = data.dokter   || [];

        _isiFormDariSettings(_settingsCache);
        _renderDokterList();
        _renderAiKeys(_settingsCache);
        showSettingsBanner("✅ Konfigurasi berhasil dimuat", "success");
        setTimeout(() => hideSettingsBanner(), 2500);

    } catch (e) {
        // Fallback: isi dari konstanta di index.html jika ada
        _fallbackDariKonstanta();
        showSettingsBanner("⚠️ Gagal muat server — menampilkan konfigurasi lokal", "warning");
    }
}

// ────────────────────────────────────────
//  FALLBACK: Isi dari konstanta index.html
// ────────────────────────────────────────
function _fallbackDariKonstanta() {
    _setVal('cfg_klinik_nama',  typeof KLINIK_NAMA  !== 'undefined' ? KLINIK_NAMA  : '');
    _setVal('cfg_klinik_title', typeof KLINIK_TITLE !== 'undefined' ? KLINIK_TITLE : '');
    _setVal('cfg_app_url',      typeof APP_URL      !== 'undefined' ? APP_URL      : '');
    _setVal('cfg_jabatan_medis',
        typeof JABATAN_MEDIS !== 'undefined' ? JABATAN_MEDIS.join(', ') : 'Dokter, Admin, Paramedis');
    _renderDokterList();
    _renderAiKeys({});
}

// ────────────────────────────────────────
//  ISI FORM DARI DATA SETTINGS
// ────────────────────────────────────────
function _isiFormDariSettings(s) {
    _setVal('cfg_klinik_nama',       s.klinik_nama       || '');
    _setVal('cfg_klinik_title',      s.klinik_title      || '');
    _setVal('cfg_klinik_alamat',     s.klinik_alamat     || '');
    _setVal('cfg_klinik_telp',       s.klinik_telp       || '');
    _setVal('cfg_klinik_email',      s.klinik_email      || '');
    _setVal('cfg_jabatan_medis',     s.jabatan_medis     || 'Dokter, Admin, Paramedis');
    _setVal('cfg_app_url',           s.app_url           || (typeof APP_URL !== 'undefined' ? APP_URL : ''));
    _setVal('cfg_ss_env',            s.ss_env            || 'development');
    _setVal('cfg_ss_org_id',         s.ss_org_id         || '');
    _setVal('cfg_ss_client_id',      s.ss_client_id      || '');
    // Secret tidak diisi dari server (keamanan)
    _setVal('cfg_ss_client_secret',  '');
}

// ────────────────────────────────────────
//  RENDER DAFTAR DOKTER
// ────────────────────────────────────────
function _renderDokterList() {
    const container = $('daftarDokterSettings');
    if (!container) return;

    if (_dokterList.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:12px;">Belum ada data dokter. Klik ➕ untuk menambahkan.</div>`;
        return;
    }

    container.innerHTML = _dokterList.map((d, i) => `
        <div class="dokter-row" id="dokter_row_${i}">
            <button class="btn-hapus-dokter" onclick="hapusDokterRow(${i})">✕ Hapus</button>
            <div class="row g-2 mb-2">
                <div class="col-8">
                    <label class="form-label" style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px;">Nama Lengkap + Gelar</label>
                    <input type="text" class="form-control" id="dk_nama_${i}" value="${escHtml(d.nama||'')}" placeholder="dr. Nama Dokter, Sp.XX">
                </div>
                <div class="col-4">
                    <label class="form-label" style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px;">Jabatan</label>
                    <select class="form-control" id="dk_jabatan_${i}">
                        <option value="Dokter"    ${d.jabatan==='Dokter'    ?'selected':''}>Dokter</option>
                        <option value="Bidan"     ${d.jabatan==='Bidan'     ?'selected':''}>Bidan</option>
                        <option value="Perawat"   ${d.jabatan==='Perawat'   ?'selected':''}>Perawat</option>
                        <option value="Apoteker"  ${d.jabatan==='Apoteker'  ?'selected':''}>Apoteker</option>
                        <option value="Admin"     ${d.jabatan==='Admin'     ?'selected':''}>Admin</option>
                    </select>
                </div>
            </div>
            <div class="row g-2">
                <div class="col-6">
                    <label class="form-label" style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px;">NIK KTP Dokter</label>
                    <input type="tel" class="form-control" id="dk_nik_${i}" value="${escHtml(d.nik||'')}" placeholder="16 digit NIK" maxlength="16">
                </div>
                <div class="col-6">
                    <label class="form-label" style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px;">Kode IHS (Satu Sehat)</label>
                    <input type="text" class="form-control" id="dk_ihs_${i}" value="${escHtml(d.ihs||'')}" placeholder="IHS Number">
                </div>
                <div class="col-6">
                    <label class="form-label" style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px;">SIP / STR</label>
                    <input type="text" class="form-control" id="dk_sip_${i}" value="${escHtml(d.sip||'')}" placeholder="No. SIP/STR">
                </div>
                <div class="col-6">
                    <label class="form-label" style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px;">Spesialisasi</label>
                    <input type="text" class="form-control" id="dk_spesialis_${i}" value="${escHtml(d.spesialis||'')}" placeholder="Umum / Sp.PD / dll">
                </div>
            </div>
        </div>
    `).join('');
}

function tambahBarisDokter() {
    _dokterList.push({ nama:'', jabatan:'Dokter', nik:'', ihs:'', sip:'', spesialis:'' });
    _renderDokterList();
    // Scroll ke row terbaru
    const rows = document.querySelectorAll('.dokter-row');
    if (rows.length > 0) rows[rows.length-1].scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function hapusDokterRow(i) {
    _dokterList.splice(i, 1);
    _renderDokterList();
}

// Kumpulkan data dokter dari form
function _kumpulkanDokter() {
    return _dokterList.map((_, i) => ({
        nama:      _getVal(`dk_nama_${i}`),
        jabatan:   _getVal(`dk_jabatan_${i}`),
        nik:       _getVal(`dk_nik_${i}`),
        ihs:       _getVal(`dk_ihs_${i}`),
        sip:       _getVal(`dk_sip_${i}`),
        spesialis: _getVal(`dk_spesialis_${i}`)
    })).filter(d => d.nama.trim() !== '');
}

// ────────────────────────────────────────
//  RENDER AI KEYS DARI SETTINGS
// ────────────────────────────────────────
const AI_PROVIDER_NAMES = ['gemini','groq','openrouter','openai','mistral'];

function _renderAiKeys(s) {
    AI_PROVIDER_NAMES.forEach(provider => {
        const container = $(`${provider}_keys_container`);
        if (!container) return;

        // Coba ambil dari settings server, lalu fallback ke konstanta AI_KEYS
        let keys = [];
        if (s[`ai_${provider}`]) {
            try { keys = JSON.parse(s[`ai_${provider}`]); } catch(e) {}
        }
        if (keys.length === 0 && typeof AI_KEYS !== 'undefined' && AI_KEYS[provider]) {
            keys = AI_KEYS[provider].filter(k => k && k.trim() !== '');
        }

        // Simpan ke state
        window[`_aiKeys_${provider}`] = keys.length > 0 ? keys : [''];
        _renderAiKeyRows(provider);
    });
}

function _renderAiKeyRows(provider) {
    const container = $(`${provider}_keys_container`);
    if (!container) return;
    const keys  = window[`_aiKeys_${provider}`] || [''];
    const dot   = $(`${provider}_status`);

    const hasKey = keys.some(k => k && k.trim() !== '');
    if (dot) dot.className = 'ai-status-dot' + (hasKey ? ' has-key' : '');

    container.innerHTML = keys.map((k, i) => `
        <div class="ai-key-row">
            <span style="font-size:10px;color:var(--text-muted);font-weight:700;min-width:18px;">${i+1}.</span>
            <input type="password"
                   class="form-control"
                   id="aikey_${provider}_${i}"
                   value="${escHtml(k)}"
                   placeholder="Masukkan API Key ${i+1}..."
                   onchange="updateAiKey('${provider}', ${i}, this.value)"
                   style="font-size:11px;font-family:monospace;">
            <button onclick="hapusAiKey('${provider}', ${i})" class="btn-del-key" title="Hapus key ini">🗑️</button>
        </div>
    `).join('');
}

function tambahAiKey(provider) {
    if (!window[`_aiKeys_${provider}`]) window[`_aiKeys_${provider}`] = [];
    window[`_aiKeys_${provider}`].push('');
    _renderAiKeyRows(provider);
}

function hapusAiKey(provider, idx) {
    const keys = window[`_aiKeys_${provider}`] || [];
    if (keys.length <= 1) {
        window[`_aiKeys_${provider}`] = [''];
    } else {
        keys.splice(idx, 1);
    }
    _renderAiKeyRows(provider);
}

function updateAiKey(provider, idx, val) {
    if (!window[`_aiKeys_${provider}`]) window[`_aiKeys_${provider}`] = [];
    window[`_aiKeys_${provider}`][idx] = val;
    _renderAiKeyRows(provider);
}

function toggleAiSection(provider) {
    const body = $(`section_${provider}`);
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
}

// ────────────────────────────────────────
//  SIMPAN SEMUA SETTINGS KE SERVER
// ────────────────────────────────────────
async function simpanSemuaSettings() {
    const btn = $('btnSimpanSettings');
    if (btn) { btn.disabled = true; btn.innerText = "Menyimpan..."; }

    showSettingsBanner("⏳ Menyimpan pengaturan ke server...", "info");

    // Kumpulkan AI keys per provider
    const aiKeysPayload = {};
    AI_PROVIDER_NAMES.forEach(p => {
        const keys = (window[`_aiKeys_${p}`] || []).filter(k => k && k.trim() !== '');
        aiKeysPayload[`ai_${p}`] = JSON.stringify(keys);
    });

    // Kumpulkan data dokter
    const dokterPayload = _kumpulkanDokter();

    const payload = {
        action: "saveSettings",

        // Identitas klinik
        klinik_nama:  _getVal('cfg_klinik_nama'),
        klinik_title: _getVal('cfg_klinik_title'),
        klinik_alamat: _getVal('cfg_klinik_alamat'),
        klinik_telp:  _getVal('cfg_klinik_telp'),
        klinik_email: _getVal('cfg_klinik_email'),

        // Konfigurasi sistem
        jabatan_medis: _getVal('cfg_jabatan_medis'),
        app_url:       _getVal('cfg_app_url'),

        // Satu Sehat
        ss_env:           _getVal('cfg_ss_env'),
        ss_org_id:        _getVal('cfg_ss_org_id'),
        ss_client_id:     _getVal('cfg_ss_client_id'),
        ss_client_secret: _getVal('cfg_ss_client_secret'), // hanya jika diisi

        // AI Keys
        ...aiKeysPayload,

        // Data dokter
        dokter: JSON.stringify(dokterPayload)
    };

    try {
        const res  = await fetch(APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();

        if (data.status === "success") {
            showSettingsBanner("✅ Pengaturan berhasil disimpan! Reload halaman untuk menerapkan perubahan.", "success");

            // Update konstanta runtime agar langsung berlaku tanpa reload
            _terapkanSettingsRuntime(payload, dokterPayload);

            showToast("✅ Pengaturan berhasil disimpan", "success");
            // Kosongkan field secret setelah simpan
            _setVal('cfg_ss_client_secret', '');
        } else {
            throw new Error(data.error || "Respons server tidak valid");
        }
    } catch (e) {
        showSettingsBanner("❌ Gagal menyimpan: " + (e.message || 'Cek koneksi'), "error");
        showToast("❌ Gagal menyimpan pengaturan", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Semua Pengaturan"; }
    }
}

// ────────────────────────────────────────
//  TERAPKAN SETTINGS KE RUNTIME (TANPA RELOAD)
// ────────────────────────────────────────
function _terapkanSettingsRuntime(s, dokter) {
    // Update header klinik
    const h1   = document.querySelector('.app-title h1');
    const span = document.querySelector('.app-title span');
    if (h1   && s.klinik_title) h1.innerText   = s.klinik_title;
    if (span && s.klinik_nama)  span.innerText  = s.klinik_nama;

    // Update jabatan medis global
    if (s.jabatan_medis) {
        const jabList = s.jabatan_medis.split(',').map(j => j.trim()).filter(j => j);
        if (jabList.length > 0) window.JABATAN_MEDIS = jabList;
    }

    // Update AI Keys global
    AI_PROVIDER_NAMES.forEach(p => {
        if (s[`ai_${p}`]) {
            try {
                const keys = JSON.parse(s[`ai_${p}`]);
                if (typeof AI_KEYS !== 'undefined') AI_KEYS[p] = keys;
            } catch(e) {}
        }
    });

    // Simpan data dokter aktif ke window untuk diakses modul lain
    window._dokterAktif = dokter;
}

// ────────────────────────────────────────
//  TEST KONEKSI DATABASE (APP_URL)
// ────────────────────────────────────────
async function testKoneksiDB() {
    const url   = _getVal('cfg_app_url');
    const badge = $('dbStatusBadge');
    if (!url) return;
    if (badge) { badge.style.display='block'; badge.textContent='🔄 Testing...'; badge.style.background='rgba(59,130,246,0.1)'; badge.style.color='#1d4ed8'; badge.style.border='1px solid rgba(59,130,246,0.3)'; }
    try {
        const res = await fetch(url, { method:'POST', body: JSON.stringify({ action:'ping' }) });
        if (res.ok) {
            if (badge) { badge.textContent='✅ Koneksi berhasil!'; badge.style.background='rgba(5,150,105,0.1)'; badge.style.color='#065f46'; badge.style.border='1px solid rgba(5,150,105,0.3)'; }
        } else { throw new Error('HTTP ' + res.status); }
    } catch(e) {
        if (badge) { badge.textContent='❌ Koneksi gagal: ' + (e.message||''); badge.style.background='rgba(239,68,68,0.1)'; badge.style.color='#dc2626'; badge.style.border='1px solid rgba(239,68,68,0.3)'; }
    }
}

// ────────────────────────────────────────
//  TEST KONEKSI SATU SEHAT
// ────────────────────────────────────────
async function testKoneksiSatuSehat() {
    const btn    = $('btnTestSS');
    const badge  = $('ssStatusBadge');
    const env    = _getVal('cfg_ss_env');
    const cid    = _getVal('cfg_ss_client_id');
    const secret = _getVal('cfg_ss_client_secret');

    if (!cid || !secret) {
        if (badge) { badge.style.display='block'; badge.textContent='⚠️ Client ID & Secret wajib diisi untuk test'; badge.style.background='rgba(245,158,11,0.1)'; badge.style.color='#92400e'; badge.style.border='1px solid rgba(245,158,11,0.3)'; }
        return;
    }

    if (btn) { btn.disabled=true; btn.textContent='🔄 Menghubungkan...'; }
    if (badge) { badge.style.display='block'; badge.textContent='🔄 Menghubungkan ke Satu Sehat...'; badge.style.background='rgba(59,130,246,0.1)'; badge.style.color='#1d4ed8'; badge.style.border='1px solid rgba(59,130,246,0.3)'; }

    // Delegasikan ke Google Apps Script agar client secret tidak expose di frontend
    try {
        const res  = await fetch(APP_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'testSatuSehat',
                ss_env: env,
                ss_client_id: cid,
                ss_client_secret: secret
            })
        });
        const data = await res.json();
        if (data.success) {
            if (badge) { badge.textContent='✅ Koneksi Satu Sehat berhasil! Token OK.'; badge.style.background='rgba(5,150,105,0.1)'; badge.style.color='#065f46'; badge.style.border='1px solid rgba(5,150,105,0.3)'; }
        } else {
            throw new Error(data.error || 'Autentikasi gagal');
        }
    } catch(e) {
        if (badge) { badge.textContent='❌ Gagal: ' + (e.message||'Cek Client ID & Secret'); badge.style.background='rgba(239,68,68,0.1)'; badge.style.color='#dc2626'; badge.style.border='1px solid rgba(239,68,68,0.3)'; }
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='🔗 Test Koneksi Satu Sehat'; }
    }
}

// ────────────────────────────────────────
//  HELPERS INTERNAL
// ────────────────────────────────────────
function showSettingsBanner(msg, type) {
    const el = $('settingsBanner');
    if (!el) return;
    el.style.display = 'block';
    el.textContent   = msg;
    const colors = {
        success: { bg:'rgba(5,150,105,0.1)',   color:'#065f46', border:'rgba(5,150,105,0.3)'   },
        error:   { bg:'rgba(239,68,68,0.1)',   color:'#dc2626', border:'rgba(239,68,68,0.3)'   },
        warning: { bg:'rgba(245,158,11,0.1)',  color:'#92400e', border:'rgba(245,158,11,0.3)'  },
        info:    { bg:'rgba(59,130,246,0.1)',  color:'#1d4ed8', border:'rgba(59,130,246,0.3)'  }
    };
    const c = colors[type] || colors.info;
    el.style.background  = c.bg;
    el.style.color       = c.color;
    el.style.borderColor = c.border;
}

function hideSettingsBanner() {
    const el = $('settingsBanner');
    if (el) el.style.display = 'none';
}

function togglePasswordVis(inputId, btn) {
    const el = $(inputId);
    if (!el) return;
    if (el.type === 'password') { el.type='text'; btn.textContent='🙈'; }
    else { el.type='password'; btn.textContent='👁️'; }
}

function _getVal(id) {
    const el = $(id);
    return el ? el.value.trim() : '';
}

function _setVal(id, val) {
    const el = $(id);
    if (el) el.value = val || '';
}

function escHtml(str) {
    return String(str||'')
        .replace(/&/g,'&amp;')
        .replace(/"/g,'&quot;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;');
}

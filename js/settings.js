// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL SETTINGS (v3.0)
//  • Accordion per-seksi (klik untuk buka/tutup)
//  • Tombol Simpan di setiap seksi (tidak hanya di bawah)
//  • Pengaturan akses modul per jabatan
//  • Pemecahan sub-modul pemeriksaan per jabatan
// ════════════════════════════════════════════════════════

// ── State settings lokal ──
let _settingsCache = {};
let _dokterList    = [];   // [{nama, nik, ihs, kode_dokter, jabatan, user_id}]
let _userListCache = [];   // [{id, nama, jabatan}] — untuk dropdown link dokter ke akun

// ── Helper: build <option> list dari _userListCache ──
function _buildUserOptions(selectedUserId) {
    return _userListCache.map(u =>
        `<option value="${escHtml(u.id)}" ${String(u.id) === String(selectedUserId) ? 'selected' : ''}>${escHtml(u.nama)} (${escHtml(u.jabatan)})</option>`
    ).join('');
}

// ── Muat daftar user ke cache agar bisa dipakai di dropdown dokter ──
async function _loadUserList() {
    try {
        const res = await sb_getUsers();
        _userListCache = (res.data || []);
    } catch(e) {
        _userListCache = [];
    }
}

// ── Definisi semua modul & sub-modul yang bisa diatur aksesnya ──
const MODULE_DEFINITIONS = [
    {
        id: 'mod_daftar',
        label: '📋 Daftar Pasien',
        desc: 'Halaman pendaftaran pasien baru & pencarian pasien'
    },
    {
        id: 'mod_kunjungan',
        label: '🗓️ Kunjungan Hari Ini',
        desc: 'Daftar antrian & kunjungan pasien hari ini'
    },
    {
        id: 'mod_pemeriksaan_ttv',
        label: '💊 Pemeriksaan – Tanda Vital',
        desc: 'Tekanan darah, nadi, suhu, RR, BB, TB'
    },
    {
        id: 'mod_pemeriksaan_lab',
        label: '🧪 Pemeriksaan – Laboratorium',
        desc: 'GDS, Kolesterol, Asam Urat'
    },
    {
        id: 'mod_pemeriksaan_keluhan',
        label: '🗣️ Pemeriksaan – Keluhan Pasien',
        desc: 'Form keluhan utama & catatan anamnesa'
    },
    {
        id: 'mod_pemeriksaan_fisik',
        label: '🩺 Pemeriksaan – Pemeriksaan Fisik',
        desc: 'Form pemeriksaan fisik umum'
    },
    {
        id: 'mod_diagnosa',
        label: '📝 Diagnosa & Terapi',
        desc: 'Input diagnosa ICD-10 dan rencana terapi/obat'
    },
    {
        id: 'mod_riwayat',
        label: '📂 Riwayat Kunjungan',
        desc: 'Lihat histori kunjungan & rekam medis lama'
    },
    {
        id: 'mod_settings',
        label: '⚙️ Pengaturan',
        desc: 'Akses halaman pengaturan sistem'
    },
    {
        id: 'mod_user',
        label: '👥 Manajemen User',
        desc: 'Tambah / edit user & PIN'
    },
    {
        id: 'mod_laporan',
        label: '📊 Laporan & Statistik',
        desc: 'Laporan kunjungan per bulan, filter diagnosa & dokter, export CSV'
    }
];

// ── Default akses per jabatan (diisi saat init, bisa di-override dari DB) ──
const DEFAULT_ACCESS = {
    'Dokter':    ['mod_daftar','mod_kunjungan','mod_pemeriksaan_ttv','mod_pemeriksaan_lab',
                  'mod_pemeriksaan_keluhan','mod_pemeriksaan_fisik','mod_diagnosa','mod_riwayat',
                  'mod_settings','mod_user','mod_laporan'],
    'Admin':     ['mod_daftar','mod_kunjungan','mod_pemeriksaan_ttv','mod_pemeriksaan_lab',
                  'mod_pemeriksaan_keluhan','mod_pemeriksaan_fisik','mod_diagnosa','mod_riwayat',
                  'mod_settings','mod_user','mod_laporan'],
    'Paramedis': ['mod_daftar','mod_kunjungan','mod_pemeriksaan_ttv','mod_pemeriksaan_lab',
                  'mod_riwayat']
};

// ── State akses modul yang sedang diedit ──
let _moduleAccess = {};   // { 'Dokter': [...], 'Paramedis': [...], ... }
let _jabatanList  = [];   // daftar jabatan aktif (dari cfg_jabatan_medis)

// ────────────────────────────────────────
//  INIT: Dipanggil saat switchPage ke pageSettings
// ────────────────────────────────────────
function initSettings() {
    _renderSettingsPage();
    memuatSettings();
}

// ────────────────────────────────────────
//  RENDER HALAMAN SETTINGS (ACCORDION)
// ────────────────────────────────────────
function _renderSettingsPage() {
    const container = $('pageSettings');
    if (!container) return;

    container.innerHTML = `
    <div class="page-settings-wrap">

      <!-- Banner Status (floating center) -->
      <div id="settingsBanner" style="display:none;"></div>

      <!-- ═══ SEKSI 1: IDENTITAS KLINIK ═══ -->
      ${_buildAccordion('sec_klinik', '🏥 Identitas Klinik',
          'Nama klinik, alamat, kontak yang tampil di aplikasi',
          _htmlIdentitasKlinik(),
          'klinik'
      )}

      <!-- ═══ SEKSI 2: AKSES MODUL PER JABATAN ═══ -->
      ${_buildAccordion('sec_akses', '🔐 Hak Akses per Jabatan',
          'Atur modul apa saja yang bisa diakses tiap jabatan',
          '<div id="aksesModulContainer">⏳ Memuat...</div>',
          'akses'
      )}

      <!-- ═══ SEKSI 3: DATA DOKTER ═══ -->
      ${_buildAccordion('sec_dokter', '👨‍⚕️ Data Dokter / Tenaga Medis',
          'Daftar dokter & tenaga medis untuk cetak resep & Satu Sehat',
          _htmlDokterSection(),
          'dokter'
      )}

      <!-- ═══ SEKSI 3b: LABORATORIUM ═══ -->
      ${_buildAccordion('sec_lab', '🧪 Jenis Pemeriksaan Laboratorium',
          'Aktifkan jenis lab yang tersedia — akan muncul di halaman pemeriksaan medis',
          _htmlLabSection(),
          'lab'
      )}

      <!-- ═══ SEKSI 3c: STOK OBAT ═══ -->
      ${_buildAccordion('sec_stok', '💊 Modul Stok Obat',
          'Aktifkan sistem stok & harga obat terintegrasi di halaman pemeriksaan',
          _htmlStokSection(),
          'stok'
      )}

      <!-- ═══ SEKSI 3d: SISTEM BIAYA ═══ -->
      \${_buildAccordion('sec_biaya', '🏷️ Sistem Pembiayaan',
          'Aktifkan tagihan otomatis, invoice, dan manajemen tarif layanan',
          _htmlBiayaSection(),
          'biaya'
      )}

      <!-- ═══ SEKSI 4: KONFIGURASI AI ═══ -->
      ${_buildAccordion('sec_ai', '🤖 API Key Kecerdasan Buatan (AI)',
          'Gemini, Groq, OpenRouter, OpenAI, Mistral',
          _htmlAiSection(),
          'ai'
      )}

      <!-- ═══ SEKSI 5: OCR & SATU SEHAT ═══ -->
      ${_buildAccordion('sec_integrasi', '🔗 Integrasi Eksternal',
          'OCR KTP, Satu Sehat FHIR',
          _htmlIntegrasiSection(),
          'integrasi'
      )}

      <!-- ═══ TOMBOL SIMPAN SEMUA (bawah) ═══ -->
      <div style="padding:8px 0 32px;">
        <button class="btn-simpan-all" onclick="simpanSemuaSettings()" id="btnSimpanSettings">
          💾 Simpan Semua Pengaturan
        </button>
      </div>

    </div>

    `;

    // Pasang style accordion inline jika belum ada
    _injectAccordionStyle();

    // FIX: Pasang event listener ke tombol simpan via JS (bukan onclick inline)
    // agar tidak ada konflik tanda kutip di atribut HTML
    _bindSimpanButtons();
}

function _bindSimpanButtons() {
    document.querySelectorAll('.btn-simpan-seksi[data-simpan-seksi]').forEach(btn => {
        btn.addEventListener('click', function() {
            const seksi = this.getAttribute('data-simpan-seksi');
            simpanSeksi(seksi);
        });
    });
}

// ────────────────────────────────────────
//  BUILDER ACCORDION SECTION
// ────────────────────────────────────────
function _buildAccordion(id, title, subtitle, bodyHtml, saveAction) {
    // FIX: Tombol simpan menggunakan data-simpan-seksi dengan nama seksi (bukan kode JS).
    // Ini menghindari konflik tanda kutip di dalam atribut onclick="simpanSeksi("x")"
    // yang menyebabkan browser memutus atribut di tengah dan tombol tidak berfungsi.
    // Event handler dipasang via addEventListener setelah render selesai (_bindSimpanButtons).
    return `
    <div class="settings-accordion" id="${id}_wrap">
      <div class="settings-accordion-header" onclick="toggleSettingsSection('${id}')">
        <div>
          <div class="settings-acc-title">${title}</div>
          <div class="settings-acc-sub">${subtitle}</div>
        </div>
        <span class="settings-acc-arrow" id="${id}_arrow">▶</span>
      </div>
      <div class="settings-accordion-body" id="${id}_body" style="display:none;">
        <div class="settings-acc-content">
          ${bodyHtml}
        </div>
        <div class="settings-acc-footer">
          <button class="btn-simpan-seksi" data-simpan-seksi="${saveAction}">
            💾 Simpan Bagian Ini
          </button>
        </div>
      </div>
    </div>`;
}

// ────────────────────────────────────────
//  TOGGLE ACCORDION
// ────────────────────────────────────────
function toggleSettingsSection(id) {
    const body  = $(`${id}_body`);
    const arrow = $(`${id}_arrow`);
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
}

// ────────────────────────────────────────
//  HTML SEKSI: IDENTITAS KLINIK
// ────────────────────────────────────────
function _htmlIdentitasKlinik() {
    return `
    <div class="row g-2">
      <div class="col-12">
        <label class="cfg-label">Nama Klinik / Praktek</label>
        <input type="text" class="form-control" id="cfg_klinik_nama" placeholder="Praktek dr. …">
      </div>
      <div class="col-12">
        <label class="cfg-label">Tagline / Judul Aplikasi</label>
        <input type="text" class="form-control" id="cfg_klinik_title" placeholder="Klikpro RME V2">
      </div>
      <div class="col-12">
        <label class="cfg-label">Alamat</label>
        <input type="text" class="form-control" id="cfg_klinik_alamat" placeholder="Jl. …">
      </div>
      <div class="col-6">
        <label class="cfg-label">Telepon</label>
        <input type="tel" class="form-control" id="cfg_klinik_telp" placeholder="08xx…">
      </div>
      <div class="col-6">
        <label class="cfg-label">Email</label>
        <input type="email" class="form-control" id="cfg_klinik_email" placeholder="email@…">
      </div>
      <div class="col-12">
        <label class="cfg-label">Jabatan yang Tersedia <span style="color:var(--text-muted);font-weight:400">(pisah koma)</span></label>
        <input type="text" class="form-control" id="cfg_jabatan_medis" placeholder="Dokter, Admin, Paramedis">
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">
          ⚠️ Perubahan jabatan akan memperbarui pilihan hak akses di bawah secara otomatis.
        </div>
      </div>
    </div>`;
}

// ────────────────────────────────────────
//  HTML SEKSI: LABORATORIUM
// ────────────────────────────────────────
const LAB_GROUPS = [
    {
        id: 'lab_dasar',
        label: '🩸 Lab Dasar',
        items: [
            { id: 'lab_gds',  label: 'GDS (Gula Darah Sewaktu)',   unit: 'mg/dL' },
            { id: 'lab_chol', label: 'Kolesterol Total',            unit: 'mg/dL' },
            { id: 'lab_ua',   label: 'Asam Urat',                  unit: 'mg/dL' }
        ]
    },
    {
        id: 'lab_darah_rutin',
        label: '🔴 Darah Rutin',
        items: [
            { id: 'lab_hb',         label: 'Hemoglobin (HB)',   unit: 'g/dL' },
            { id: 'lab_trombosit',  label: 'Trombosit',         unit: 'ribu/µL' },
            { id: 'lab_leukosit',   label: 'Leukosit',          unit: 'ribu/µL' },
            { id: 'lab_eritrosit',  label: 'Eritrosit',         unit: 'juta/µL' },
            { id: 'lab_hematokrit', label: 'Hematokrit',        unit: '%' }
        ]
    },
    {
        id: 'lab_triple_eliminasi',
        label: '🧬 Triple Eliminasi',
        items: [
            { id: 'lab_hiv',       label: 'HIV',       unit: 'reaktif/non' },
            { id: 'lab_sifilis',   label: 'Sifilis',   unit: 'reaktif/non' },
            { id: 'lab_hepatitis', label: 'Hepatitis B', unit: 'reaktif/non' }
        ]
    },
    {
        id: 'lab_profil_lemak',
        label: '💧 Profil Lemak',
        items: [
            { id: 'lab_hdl',   label: 'HDL',               unit: 'mg/dL' },
            { id: 'lab_ldl',   label: 'LDL',               unit: 'mg/dL' },
            { id: 'lab_tg',    label: 'Trigliserida',       unit: 'mg/dL' }
        ]
    },
    {
        id: 'lab_gula_darah',
        label: '🍬 Gula Darah',
        items: [
            { id: 'lab_gdp',   label: 'GDP (Gula Darah Puasa)', unit: 'mg/dL' },
            { id: 'lab_hba1c', label: 'HbA1c',                  unit: '%' }
        ]
    },
    {
        id: 'lab_fungsi_hati',
        label: '🫀 Fungsi Hati',
        items: [
            { id: 'lab_sgot', label: 'SGOT', unit: 'U/L' },
            { id: 'lab_sgpt', label: 'SGPT', unit: 'U/L' }
        ]
    },
    {
        id: 'lab_fungsi_ginjal',
        label: '🫘 Fungsi Ginjal',
        items: [
            { id: 'lab_ureum',    label: 'Ureum',    unit: 'mg/dL' },
            { id: 'lab_creatinin',label: 'Kreatinin', unit: 'mg/dL' }
        ]
    }
];

// State: lab yang aktif (diambil/disimpan ke DB)
let _labAktif = {};  // { lab_gds: true, lab_hb: false, ... }

function _htmlLabSection() {
    return `
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;padding:8px 10px;background:rgba(var(--primary-rgb,37,99,235),0.05);border-radius:8px;">
        💡 Aktifkan pemeriksaan lab yang tersedia di klinik Anda. Item yang diaktifkan akan muncul sebagai input di halaman Pemeriksaan Medis.
    </div>
    <div id="labGroupsContainer">
        ${LAB_GROUPS.map(g => `
        <div style="margin-bottom:12px;border:1px solid rgba(var(--primary-rgb,37,99,235),0.1);border-radius:10px;overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:rgba(var(--primary-rgb,37,99,235),0.04);cursor:pointer;"
                 onclick="toggleLabGroup('${g.id}')">
                <span style="font-size:12px;font-weight:700;color:var(--text-primary,#1e293b);">${g.label}</span>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span id="labgrp_count_${g.id}" style="font-size:10px;font-weight:600;color:var(--primary,#2563eb);background:rgba(var(--primary-rgb,37,99,235),0.1);padding:2px 8px;border-radius:20px;">0 aktif</span>
                    <span id="labgrp_arrow_${g.id}" style="font-size:10px;color:var(--primary,#2563eb);">▶</span>
                </div>
            </div>
            <div id="labgrp_body_${g.id}" style="display:none;padding:10px 12px;">
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <button class="btn-small-secondary" onclick="toggleAllLabGroup('${g.id}', true)">✅ Aktifkan Semua</button>
                    <button class="btn-small-secondary" onclick="toggleAllLabGroup('${g.id}', false)">⬜ Nonaktifkan</button>
                </div>
                ${g.items.map(item => `
                <label style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;border:1px solid rgba(var(--primary-rgb,37,99,235),0.08);margin-bottom:5px;cursor:pointer;transition:background 0.15s;"
                       id="labitem_label_${item.id}"
                       class="lab-toggle-item">
                    <input type="checkbox" id="labtog_${item.id}" style="width:16px;height:16px;accent-color:var(--primary,#2563eb);"
                           onchange="_onLabToggle('${g.id}', '${item.id}', this.checked, this)">
                    <div style="flex:1;">
                        <div style="font-size:12px;font-weight:600;color:var(--text-primary,#1e293b);">${item.label}</div>
                        <div style="font-size:10px;color:var(--text-muted,#64748b);">Satuan: ${item.unit}</div>
                    </div>
                    <span id="labtog_badge_${item.id}" style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;background:#e2e8f0;color:#64748b;">OFF</span>
                </label>`).join('')}
            </div>
        </div>`).join('')}
    </div>`;
}

function toggleLabGroup(groupId) {
    const body  = $(`labgrp_body_${groupId}`);
    const arrow = $(`labgrp_arrow_${groupId}`);
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
}

function toggleAllLabGroup(groupId, active) {
    const group = LAB_GROUPS.find(g => g.id === groupId);
    if (!group) return;
    group.items.forEach(item => {
        _labAktif[item.id] = active;
        const chk = $(`labtog_${item.id}`);
        if (chk) chk.checked = active;
        _updateLabItemVisual(item.id, active);
    });
    _updateLabGroupCount(groupId);
}

function _onLabToggle(groupId, itemId, checked, el) {
    _labAktif[itemId] = checked;
    _updateLabItemVisual(itemId, checked);
    _updateLabGroupCount(groupId);
}

function _updateLabItemVisual(itemId, active) {
    const label = $(`labitem_label_${itemId}`);
    const badge = $(`labtog_badge_${itemId}`);
    if (label) label.style.background = active ? 'rgba(var(--primary-rgb,37,99,235),0.06)' : '';
    if (badge) {
        badge.textContent = active ? 'ON' : 'OFF';
        badge.style.background = active ? 'rgba(5,150,105,0.15)' : '#e2e8f0';
        badge.style.color      = active ? '#065f46' : '#64748b';
    }
}

function _updateLabGroupCount(groupId) {
    const group = LAB_GROUPS.find(g => g.id === groupId);
    if (!group) return;
    const count = group.items.filter(item => _labAktif[item.id]).length;
    const el = $(`labgrp_count_${groupId}`);
    if (el) el.textContent = `${count} aktif`;
}

function _renderLabToggles() {
    LAB_GROUPS.forEach(g => {
        g.items.forEach(item => {
            const chk = $(`labtog_${item.id}`);
            if (chk) {
                chk.checked = !!_labAktif[item.id];
                _updateLabItemVisual(item.id, !!_labAktif[item.id]);
            }
        });
        _updateLabGroupCount(g.id);
    });
}

function _getLabAktifPayload() {
    return JSON.stringify(_labAktif);
}

// ────────────────────────────────────────
//  HTML SEKSI: DOKTER
// ────────────────────────────────────────
function _htmlDokterSection() {
    return `
    <div id="daftarDokterSettings">
      <div style="text-align:center;color:var(--text-muted);font-size:12px;padding:12px;">
        ⏳ Memuat data dokter...
      </div>
    </div>
    <button class="btn-add-row" onclick="tambahBarisDokter()">➕ Tambah Dokter / Tenaga Medis</button>`;
}

// ────────────────────────────────────────
//  HTML SEKSI: AI
// ────────────────────────────────────────
function _htmlAiSection() {
    const providers = [
        { id:'gemini',     label:'Google Gemini',    icon:'✨' },
        { id:'groq',       label:'Groq (LLaMA)',      icon:'⚡' },
        { id:'openrouter', label:'OpenRouter',        icon:'🔀' },
        { id:'openai',     label:'OpenAI (GPT)',      icon:'🟢' },
        { id:'mistral',    label:'Mistral AI',        icon:'🌬️' }
    ];
    return providers.map(p => `
    <div class="ai-provider-card">
      <div class="ai-provider-header" onclick="toggleAiSection('${p.id}')">
        <span>${p.icon} ${p.label}</span>
        <span class="ai-status-dot" id="${p.id}_status"></span>
      </div>
      <div id="section_${p.id}" style="display:none;padding:10px 0 4px;">
        <div id="${p.id}_keys_container"></div>
        <button class="btn-add-row" onclick="tambahAiKey('${p.id}')">➕ Tambah Key</button>
      </div>
    </div>`).join('');
}

// ────────────────────────────────────────
//  HTML SEKSI: INTEGRASI
// ────────────────────────────────────────
function _htmlIntegrasiSection() {
    return `
    <div class="sub-section-label">📷 OCR KTP</div>
    <div class="row g-2 mb-3">
      <div class="col-12">
        <label class="cfg-label">API Key OCR.space</label>
        <div style="display:flex;gap:6px;">
          <input type="password" class="form-control" id="cfg_ocr_api_key" placeholder="Masukkan OCR API Key…">
          <button class="btn-eye" onclick="togglePasswordVis('cfg_ocr_api_key', this)">👁️</button>
        </div>
      </div>
    </div>

    <div class="sub-section-label">🏥 Satu Sehat (FHIR)</div>
    <div class="row g-2">
      <div class="col-6">
        <label class="cfg-label">Environment</label>
        <select class="form-control" id="cfg_ss_env">
          <option value="development">Development</option>
          <option value="production">Production</option>
        </select>
      </div>
      <div class="col-6">
        <label class="cfg-label">Organization ID</label>
        <input type="text" class="form-control" id="cfg_ss_org_id" placeholder="org-xxxx">
      </div>
      <div class="col-12">
        <label class="cfg-label">Client ID</label>
        <input type="text" class="form-control" id="cfg_ss_client_id" placeholder="Client ID Satu Sehat">
      </div>
      <div class="col-12">
        <label class="cfg-label">Client Secret <span style="font-weight:400;color:var(--text-muted)">(kosongkan jika tidak berubah)</span></label>
        <div style="display:flex;gap:6px;">
          <input type="password" class="form-control" id="cfg_ss_client_secret" placeholder="••••••••">
          <button class="btn-eye" onclick="togglePasswordVis('cfg_ss_client_secret', this)">👁️</button>
        </div>
      </div>
      <div class="col-12">
        <button class="btn-test" onclick="testKoneksiSatuSehat()" id="btnTestSS">🔗 Test Koneksi Satu Sehat</button>
        <div id="ssStatusBadge" style="display:none;margin-top:6px;padding:7px 10px;border-radius:8px;font-size:11px;font-weight:600;"></div>
      </div>
    </div>`;
}

// ────────────────────────────────────────
//  MUAT SETTINGS DARI SERVER
// ────────────────────────────────────────
async function memuatSettings() {
    showSettingsBanner("⏳ Memuat konfigurasi dari server...", "info");
    try {
        const data = await sb_getSettings();
        if (data.status !== "success") throw new Error(data.error || "Gagal memuat");

        _settingsCache = data.settings || {};
        _dokterList    = data.dokter   || [];

        _isiFormDariSettings(_settingsCache);
        await _loadUserList();  // muat daftar user agar dropdown link dokter↔akun tersedia
        _renderDokterList();
        _renderAiKeys(_settingsCache);
        _initModuleAccess();
        _loadLabAktif(_settingsCache);
        _loadStokAktif(_settingsCache);
        _loadBiayaAktif(_settingsCache);

        showSettingsBanner("✅ Konfigurasi berhasil dimuat", "success");
        setTimeout(() => hideSettingsBanner(), 2500);

    } catch (e) {
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
    _setVal('cfg_jabatan_medis',
        typeof JABATAN_MEDIS !== 'undefined' ? JABATAN_MEDIS.join(', ') : 'Dokter, Admin, Paramedis');
    _renderDokterList();
    _renderAiKeys({});
    _initModuleAccess();
    _loadLabAktif({});
}

// ────────────────────────────────────────
//  ISI FORM DARI DATA SETTINGS
// ────────────────────────────────────────
function _isiFormDariSettings(s) {
    _setVal('cfg_klinik_nama',      s.klinik_nama       || '');
    _setVal('cfg_klinik_title',     s.klinik_title      || '');
    _setVal('cfg_klinik_alamat',    s.klinik_alamat     || '');
    _setVal('cfg_klinik_telp',      s.klinik_telp       || '');
    _setVal('cfg_klinik_email',     s.klinik_email      || '');
    _setVal('cfg_jabatan_medis',    s.jabatan_medis     || 'Dokter, Admin, Paramedis');
    _setVal('cfg_ocr_api_key',      s.ocr_api_key       || '');
    _setVal('cfg_ss_env',           s.ss_env            || 'development');
    _setVal('cfg_ss_org_id',        s.ss_org_id         || '');
    _setVal('cfg_ss_client_id',     s.ss_client_id      || '');
    _setVal('cfg_ss_client_secret', '');
}

// ── Helper muat lab aktif dari settings ──
function _loadLabAktif(s) {
    _labAktif = {};
    if (s.lab_aktif) {
        try { _labAktif = JSON.parse(s.lab_aktif); } catch(e) {}
    }
    // Default: 3 lab dasar aktif jika belum ada konfigurasi
    if (Object.keys(_labAktif).length === 0) {
        _labAktif = { lab_gds: true, lab_chol: true, lab_ua: true };
    }
    _renderLabToggles();
    // Simpan ke window global agar page-medis bisa pakai
    window._labAktif = _labAktif;
}

// ════════════════════════════════════════
//  HAK AKSES MODUL PER JABATAN
// ════════════════════════════════════════

function _initModuleAccess() {
    // Ambil jabatan dari form
    const jabStr = _getVal('cfg_jabatan_medis') ||
                   (typeof JABATAN_MEDIS !== 'undefined' ? JABATAN_MEDIS.join(', ') : 'Dokter, Admin, Paramedis');
    _jabatanList = jabStr.split(',').map(j => j.trim()).filter(j => j);

    // Coba parse dari cache server
    let savedAccess = {};
    if (_settingsCache.module_access) {
        try { savedAccess = JSON.parse(_settingsCache.module_access); } catch(e) {}
    }

    // Merge dengan default
    _moduleAccess = {};
    _jabatanList.forEach(jab => {
        _moduleAccess[jab] = savedAccess[jab] ||
                             DEFAULT_ACCESS[jab] ||
                             ['mod_daftar','mod_kunjungan','mod_pemeriksaan_ttv'];
    });

    _renderModuleAccess();
}

function _renderModuleAccess() {
    const c = $('aksesModulContainer');
    if (!c) return;

    if (_jabatanList.length === 0) {
        c.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:10px 0;">
            Belum ada jabatan. Isi dulu kolom "Jabatan yang Tersedia" di atas, lalu simpan seksi Identitas Klinik.
        </div>`;
        return;
    }

    c.innerHTML = _jabatanList.map(jab => {
        const currentMods = _moduleAccess[jab] || [];
        return `
        <div class="jabatan-access-card">
          <div class="jabatan-access-title" onclick="toggleJabatanAccess('${_escId(jab)}')">
            <span>👤 ${jab}</span>
            <span class="jabatan-acc-count">${currentMods.length} modul aktif</span>
            <span id="jab_arrow_${_escId(jab)}">▶</span>
          </div>
          <div id="jab_body_${_escId(jab)}" style="display:none; padding:10px 0 4px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">
              Centang modul yang dapat diakses oleh jabatan <strong>${jab}</strong>:
            </div>
            <div class="module-checkbox-grid">
              ${MODULE_DEFINITIONS.map(mod => `
              <label class="module-check-item ${currentMods.includes(mod.id) ? 'checked' : ''}">
                <input type="checkbox"
                       id="chk_${_escId(jab)}_${mod.id}"
                       ${currentMods.includes(mod.id) ? 'checked' : ''}
                       onchange="_onModuleCheckChange('${jab}', '${mod.id}', this.checked, this)">
                <div class="module-check-body">
                  <div class="module-check-label">${mod.label}</div>
                  <div class="module-check-desc">${mod.desc}</div>
                </div>
              </label>`).join('')}
            </div>
            <div style="margin-top:10px;display:flex;gap:8px;">
              <button class="btn-small-secondary" onclick="_pilihSemuaModul('${jab}', true)">✅ Pilih Semua</button>
              <button class="btn-small-secondary" onclick="_pilihSemuaModul('${jab}', false)">⬜ Kosongkan</button>
              <button class="btn-small-secondary" onclick="_resetDefaultModul('${jab}')">🔄 Reset Default</button>
            </div>
          </div>
        </div>`;
    }).join('');
}

function toggleJabatanAccess(jabEscId) {
    const body  = $(`jab_body_${jabEscId}`);
    const arrow = $(`jab_arrow_${jabEscId}`);
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
}

function _onModuleCheckChange(jab, modId, checked, checkboxEl) {
    if (!_moduleAccess[jab]) _moduleAccess[jab] = [];
    if (checked) {
        if (!_moduleAccess[jab].includes(modId)) _moduleAccess[jab].push(modId);
    } else {
        _moduleAccess[jab] = _moduleAccess[jab].filter(m => m !== modId);
    }
    // Update visual state item
    const label = checkboxEl ? checkboxEl.closest('.module-check-item') : null;
    if (label) label.classList.toggle('checked', checked);
    // Update counter
    const jabEscId = _escId(jab);
    const countEl  = document.querySelector(`#jab_body_${jabEscId}`)
                      ?.closest('.jabatan-access-card')
                      ?.querySelector('.jabatan-acc-count');
    if (countEl) countEl.textContent = (_moduleAccess[jab] || []).length + ' modul aktif';
}

function _pilihSemuaModul(jab, all) {
    _moduleAccess[jab] = all ? MODULE_DEFINITIONS.map(m => m.id) : [];
    _renderModuleAccess();
    // Buka kembali accordion jabatan ini
    const jabEscId = _escId(jab);
    const body = $(`jab_body_${jabEscId}`);
    if (body) { body.style.display = 'block'; $(`jab_arrow_${jabEscId}`).textContent = '▼'; }
}

function _resetDefaultModul(jab) {
    _moduleAccess[jab] = [...(DEFAULT_ACCESS[jab] || ['mod_daftar','mod_kunjungan'])];
    _renderModuleAccess();
    const jabEscId = _escId(jab);
    const body = $(`jab_body_${jabEscId}`);
    if (body) { body.style.display = 'block'; $(`jab_arrow_${jabEscId}`).textContent = '▼'; }
    showToast(`♻️ Hak akses ${jab} direset ke default`, "info");
}

// ── Terapkan hak akses ke UI berdasarkan jabatan login ──
function applyModuleAccess(jabatan) {
    let access = _moduleAccess[jabatan];

    // Fallback: coba ambil dari localStorage jika settings belum tersedia
    if (!access) {
        const stored = localStorage.getItem('kp_module_access');
        if (stored) {
            try {
                const all = JSON.parse(stored);
                access = all[jabatan] || null;
            } catch(e) {}
        }
    }
    if (!access) access = DEFAULT_ACCESS[jabatan] || ['mod_daftar','mod_kunjungan'];

    // ── Navigasi (menu bawah) ──
    const navMap = {
        'mod_daftar':    'navDaftar',
        'mod_kunjungan': 'navHariIni',
        'mod_laporan':   'navLaporan',
        'mod_settings':  'navSettings',
        'mod_user':      'navUser'
    };
    Object.entries(navMap).forEach(([modId, navId]) => {
        const el = $(navId);
        if (el) el.style.display = access.includes(modId) ? '' : 'none';
    });

    // ── Sub-modul pemeriksaan di halaman pageMedis ──
    const sectionMap = {
        'mod_pemeriksaan_keluhan': 'sectionKeluhan',
        'mod_pemeriksaan_fisik':   'sectionFisik',
        'mod_pemeriksaan_ttv':     'sectionTTV',
        'mod_pemeriksaan_lab':     'sectionLab',
        'mod_diagnosa':            'sectionDiagnosa',
        'mod_riwayat':             'sectionRiwayat'
    };
    Object.entries(sectionMap).forEach(([modId, sectionId]) => {
        const el = $(sectionId);
        if (el) el.style.display = access.includes(modId) ? '' : 'none';
    });

    // ── Simpan window global untuk dipakai modul lain ──
    window._currentAccess = access;
    window._isParamedis   = jabatan.toLowerCase() === 'paramedis';

    // ── Settings page: hanya Admin & Dokter ──
    const jabLower = jabatan.toLowerCase();
    if (jabLower === 'paramedis' || !access.includes('mod_settings')) {
        const navSettings = $('navSettings');
        if (navSettings) navSettings.style.display = 'none';
    }
}

// ── Helper escape id ──
function _escId(str) {
    return String(str).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

// ════════════════════════════════════════
//  RENDER DAFTAR DOKTER
// ════════════════════════════════════════
function _renderDokterList() {
    const container = $('daftarDokterSettings');
    if (!container) return;

    if (_dokterList.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:12px;">
            Belum ada data dokter. Klik ➕ untuk menambahkan, atau daftarkan akun user baru dengan jabatan <strong>Dokter</strong> di menu 👥 User.
        </div>`;
        return;
    }

    container.innerHTML = _dokterList.map((d, i) => {
        // Cari info akun user yang terhubung (jika ada)
        const linkedUser = d.user_id
            ? _userListCache.find(u => String(u.id) === String(d.user_id))
            : null;
        const linkedUserInfo = linkedUser
            ? `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(5,150,105,0.07);border:1px solid rgba(5,150,105,0.2);border-radius:8px;margin-bottom:8px;">
                   <span style="font-size:14px;">🔗</span>
                   <div>
                     <div style="font-size:11px;font-weight:700;color:#065f46;">Terhubung ke akun: ${escHtml(linkedUser.nama)} (${escHtml(linkedUser.jabatan)})</div>
                     <div style="font-size:10px;color:#059669;">Kunjungan pasien yang diperiksa akan tercatat atas nama dokter ini</div>
                   </div>
               </div>`
            : `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:8px;margin-bottom:8px;">
                   <span style="font-size:14px;">⚠️</span>
                   <div style="font-size:11px;color:#92400e;">Belum terhubung ke akun user. Daftarkan user baru dengan jabatan <strong>Dokter</strong> di menu 👥 User agar terhubung otomatis.</div>
               </div>`;

        // Hidden input untuk user_id agar _kumpulkanDokter() tetap bisa membacanya
        return `
    <div class="dokter-row" id="dokter_row_${i}">
      <input type="hidden" id="dk_user_id_${i}" value="${escHtml(d.user_id || '')}">
      ${linkedUserInfo}
      <div class="row g-2 mb-2">
        <div class="col-8">
          <label class="cfg-label">Nama Lengkap + Gelar</label>
          <input type="text" class="form-control" id="dk_nama_${i}" value="${escHtml(d.nama||'')}" placeholder="dr. Nama, Sp.XX">
        </div>
        <div class="col-4">
          <label class="cfg-label">Jabatan</label>
          <select class="form-control" id="dk_jabatan_${i}">
            <option value="Dokter"   ${d.jabatan==='Dokter'   ?'selected':''}>Dokter</option>
            <option value="Bidan"    ${d.jabatan==='Bidan'    ?'selected':''}>Bidan</option>
            <option value="Perawat"  ${d.jabatan==='Perawat'  ?'selected':''}>Perawat</option>
            <option value="Apoteker" ${d.jabatan==='Apoteker' ?'selected':''}>Apoteker</option>
            <option value="Admin"    ${d.jabatan==='Admin'    ?'selected':''}>Admin</option>
          </select>
        </div>
      </div>
      <div class="row g-2">
        <div class="col-6">
          <label class="cfg-label">NIK KTP</label>
          <input type="tel" class="form-control" id="dk_nik_${i}" value="${escHtml(d.nik||'')}" placeholder="16 digit NIK" maxlength="16">
        </div>
        <div class="col-6">
          <label class="cfg-label">Kode IHS (Satu Sehat)</label>
          <input type="text" class="form-control" id="dk_ihs_${i}" value="${escHtml(d.ihs||'')}" placeholder="IHS Number">
        </div>
        <div class="col-6">
          <label class="cfg-label">SIP / STR</label>
          <input type="text" class="form-control" id="dk_sip_${i}" value="${escHtml(d.sip||'')}" placeholder="No. SIP/STR">
        </div>
        <div class="col-6">
          <label class="cfg-label">Spesialisasi</label>
          <input type="text" class="form-control" id="dk_spesialis_${i}" value="${escHtml(d.spesialis||'')}" placeholder="Umum / Sp.PD / dll">
        </div>
      </div>
    </div>`;
    }).join('');
}

function tambahBarisDokter() {
    _dokterList.push({ nama:'', jabatan:'Dokter', nik:'', ihs:'', sip:'', spesialis:'', user_id:'' });
    _renderDokterList();
    const rows = document.querySelectorAll('.dokter-row');
    if (rows.length > 0) rows[rows.length-1].scrollIntoView({ behavior:'smooth', block:'nearest' });
}


function _kumpulkanDokter() {
    return _dokterList.map((_, i) => ({
        nama:      _getVal(`dk_nama_${i}`),
        jabatan:   _getVal(`dk_jabatan_${i}`),
        nik:       _getVal(`dk_nik_${i}`),
        ihs:       _getVal(`dk_ihs_${i}`),
        sip:       _getVal(`dk_sip_${i}`),
        spesialis: _getVal(`dk_spesialis_${i}`),
        user_id:   _getVal(`dk_user_id_${i}`) || null
    })).filter(d => d.nama.trim() !== '');
}

// ════════════════════════════════════════
//  RENDER AI KEYS
// ════════════════════════════════════════
const AI_PROVIDER_NAMES = ['gemini','groq','openrouter','openai','mistral'];

function _renderAiKeys(s) {
    AI_PROVIDER_NAMES.forEach(provider => {
        const container = $(`${provider}_keys_container`);
        if (!container) return;
        let keys = [];
        if (s[`ai_${provider}`]) {
            try { keys = JSON.parse(s[`ai_${provider}`]); } catch(e) {}
        }
        if (keys.length === 0 && typeof AI_KEYS !== 'undefined' && AI_KEYS[provider]) {
            keys = AI_KEYS[provider].filter(k => k && k.trim() !== '');
        }
        window[`_aiKeys_${provider}`] = keys.length > 0 ? keys : [''];
        _renderAiKeyRows(provider);
    });
}

function _renderAiKeyRows(provider) {
    const container = $(`${provider}_keys_container`);
    if (!container) return;
    const keys = window[`_aiKeys_${provider}`] || [''];
    const dot  = $(`${provider}_status`);
    const hasKey = keys.some(k => k && k.trim() !== '');
    if (dot) dot.className = 'ai-status-dot' + (hasKey ? ' has-key' : '');

    container.innerHTML = keys.map((k, i) => `
    <div class="ai-key-row">
      <span style="font-size:10px;color:var(--text-muted);font-weight:700;min-width:18px;">${i+1}.</span>
      <input type="password" class="form-control"
             id="aikey_${provider}_${i}"
             value="${escHtml(k)}"
             placeholder="Masukkan API Key ${i+1}..."
             onchange="updateAiKey('${provider}', ${i}, this.value)"
             style="font-size:11px;font-family:monospace;">
      <button onclick="hapusAiKey('${provider}', ${i})" class="btn-del-key" title="Hapus key ini">🗑️</button>
    </div>`).join('');
}

function tambahAiKey(provider) {
    if (!window[`_aiKeys_${provider}`]) window[`_aiKeys_${provider}`] = [];
    window[`_aiKeys_${provider}`].push('');
    _renderAiKeyRows(provider);
}

function hapusAiKey(provider, idx) {
    const keys = window[`_aiKeys_${provider}`] || [];
    if (keys.length <= 1) { window[`_aiKeys_${provider}`] = ['']; }
    else { keys.splice(idx, 1); }
    _renderAiKeyRows(provider);
}

// BUG-09 FIX: Sebelumnya updateAiKey memanggil _renderAiKeyRows() setiap ketik,
// yang me-render ulang seluruh container → kursor loncat ke awal & performa buruk di HP.
// Sekarang hanya update nilai di array dan dot status, tanpa re-render DOM.
function updateAiKey(provider, idx, val) {
    if (!window[`_aiKeys_${provider}`]) window[`_aiKeys_${provider}`] = [];
    window[`_aiKeys_${provider}`][idx] = val;
    // Update hanya dot status, TIDAK memanggil _renderAiKeyRows()
    const hasKey = window[`_aiKeys_${provider}`].some(k => k && k.trim());
    const dot = $(`${provider}_status`);
    if (dot) dot.className = 'ai-status-dot' + (hasKey ? ' has-key' : '');
}

function toggleAiSection(provider) {
    const body = $(`section_${provider}`);
    if (!body) return;
    body.style.display = body.style.display !== 'none' ? 'none' : 'block';
}

// ════════════════════════════════════════
//  SIMPAN PER SEKSI
// ════════════════════════════════════════
async function simpanSeksi(seksi) {
    showSettingsBanner("⏳ Menyimpan...", "info");

    try {
        if (seksi === 'klinik') {
            await sb_saveSettings({
                klinik_nama:   _getVal('cfg_klinik_nama'),
                klinik_title:  _getVal('cfg_klinik_title'),
                klinik_alamat: _getVal('cfg_klinik_alamat'),
                klinik_telp:   _getVal('cfg_klinik_telp'),
                klinik_email:  _getVal('cfg_klinik_email'),
                jabatan_medis: _getVal('cfg_jabatan_medis')
            });
            // Jika jabatan berubah, refresh panel akses
            _initModuleAccess();
            _terapkanSettingsRuntime({
                klinik_nama:   _getVal('cfg_klinik_nama'),
                klinik_title:  _getVal('cfg_klinik_title'),
                jabatan_medis: _getVal('cfg_jabatan_medis')
            }, window._dokterAktif || []);
            showToast("✅ Identitas klinik disimpan", "success");

        } else if (seksi === 'akses') {
            // Sinkron _moduleAccess dari checkbox yang ada
            _jabatanList.forEach(jab => {
                const jabEscId = _escId(jab);
                const newAccess = MODULE_DEFINITIONS
                    .filter(mod => {
                        const chk = $(`chk_${jabEscId}_${mod.id}`);
                        return chk && chk.checked;
                    })
                    .map(mod => mod.id);
                _moduleAccess[jab] = newAccess;
            });
            await sb_saveSettings({ module_access: JSON.stringify(_moduleAccess) });
            // Simpan juga ke localStorage agar bisa dipakai tanpa reload settings
            localStorage.setItem('kp_module_access', JSON.stringify(_moduleAccess));
            showToast("✅ Hak akses per jabatan disimpan", "success");

        } else if (seksi === 'dokter') {
            const dokterPayload = _kumpulkanDokter();
            await sb_saveSettings({ dokter: JSON.stringify(dokterPayload) });
            window._dokterAktif = dokterPayload;
            showToast("✅ Data dokter disimpan", "success");

        } else if (seksi === 'ai') {
            const aiKeysPayload = {};
            AI_PROVIDER_NAMES.forEach(p => {
                const keys = (window[`_aiKeys_${p}`] || []).filter(k => k && k.trim() !== '');
                aiKeysPayload[`ai_${p}`] = JSON.stringify(keys);
            });
            await sb_saveSettings(aiKeysPayload);
            _terapkanSettingsRuntime(aiKeysPayload, window._dokterAktif || []);
            showToast("✅ API Key AI disimpan", "success");

        } else if (seksi === 'lab') {
            // Kumpulkan state toggle dari DOM
            LAB_GROUPS.forEach(g => {
                g.items.forEach(item => {
                    const chk = $(`labtog_${item.id}`);
                    if (chk) _labAktif[item.id] = chk.checked;
                });
            });
            await sb_saveSettings({ lab_aktif: _getLabAktifPayload() });
            window._labAktif = _labAktif;
            // Rebuild section lab di halaman medis jika sudah terbuka
            if (typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();
            showToast("✅ Konfigurasi laboratorium disimpan", "success");

        } else if (seksi === 'biaya') {
            const aktif = !!document.getElementById('cfg_biaya_aktif')?.checked;
            await sb_saveSettings({ biaya_aktif: aktif ? '1' : '0' });
            window._biayaAktif = aktif;
            _applyBiayaAktif(aktif);
            showToast('✅ Pengaturan pembiayaan disimpan', 'success');

        } else if (seksi === 'stok') {
            const aktif = !!document.getElementById('cfg_stok_aktif')?.checked;
            await sb_saveSettings({ stok_aktif: aktif ? '1' : '0' });
            window._stokAktif = aktif;
            // Toggle nav stok & section resep
            _applyStokAktif(aktif);
            showToast('✅ Pengaturan stok obat disimpan', 'success');

        } else if (seksi === 'integrasi') {
            const payload = {
                ocr_api_key:      _getVal('cfg_ocr_api_key'),
                ss_env:           _getVal('cfg_ss_env'),
                ss_org_id:        _getVal('cfg_ss_org_id'),
                ss_client_id:     _getVal('cfg_ss_client_id'),
                ss_client_secret: _getVal('cfg_ss_client_secret')
            };
            await sb_saveSettings(payload);
            if (payload.ocr_api_key) window.OCR_API_KEY = payload.ocr_api_key;
            _setVal('cfg_ss_client_secret', '');
            showToast("✅ Pengaturan integrasi disimpan", "success");
        }

        showSettingsBanner("✅ Berhasil disimpan", "success");
        setTimeout(() => hideSettingsBanner(), 2500);

    } catch (e) {
        showSettingsBanner("❌ Gagal menyimpan: " + (e.message || 'Cek koneksi'), "error");
        showToast("❌ Gagal menyimpan: " + (e.message || ''), "error");
    }
}

// ════════════════════════════════════════
//  SIMPAN SEMUA SETTINGS
// ════════════════════════════════════════
async function simpanSemuaSettings() {
    const btn = $('btnSimpanSettings');
    if (btn) { btn.disabled = true; btn.innerText = "Menyimpan..."; }
    showSettingsBanner("⏳ Menyimpan semua pengaturan ke server...", "info");

    const aiKeysPayload = {};
    AI_PROVIDER_NAMES.forEach(p => {
        const keys = (window[`_aiKeys_${p}`] || []).filter(k => k && k.trim() !== '');
        aiKeysPayload[`ai_${p}`] = JSON.stringify(keys);
    });

    // Sinkron akses dari checkbox
    _jabatanList.forEach(jab => {
        const jabEscId = _escId(jab);
        _moduleAccess[jab] = MODULE_DEFINITIONS
            .filter(mod => { const c = $(`chk_${jabEscId}_${mod.id}`); return c && c.checked; })
            .map(mod => mod.id);
    });

    const dokterPayload = _kumpulkanDokter();

    // Sinkron lab toggles dari DOM
    LAB_GROUPS.forEach(g => {
        g.items.forEach(item => {
            const chk = $(`labtog_${item.id}`);
            if (chk) _labAktif[item.id] = chk.checked;
        });
    });

    const payload = {
        klinik_nama:      _getVal('cfg_klinik_nama'),
        klinik_title:     _getVal('cfg_klinik_title'),
        klinik_alamat:    _getVal('cfg_klinik_alamat'),
        klinik_telp:      _getVal('cfg_klinik_telp'),
        klinik_email:     _getVal('cfg_klinik_email'),
        jabatan_medis:    _getVal('cfg_jabatan_medis'),
        ocr_api_key:      _getVal('cfg_ocr_api_key'),
        ss_env:           _getVal('cfg_ss_env'),
        ss_org_id:        _getVal('cfg_ss_org_id'),
        ss_client_id:     _getVal('cfg_ss_client_id'),
        ss_client_secret: _getVal('cfg_ss_client_secret'),
        module_access:    JSON.stringify(_moduleAccess),
        lab_aktif:        _getLabAktifPayload(),
        stok_aktif:       document.getElementById('cfg_stok_aktif')?.checked ? '1' : '0',
        biaya_aktif:      document.getElementById('cfg_biaya_aktif')?.checked ? '1' : '0',
        dokter:           JSON.stringify(dokterPayload),
        ...aiKeysPayload
    };

    try {
        await sb_saveSettings(payload);
        localStorage.setItem('kp_module_access', JSON.stringify(_moduleAccess));
        window._labAktif = _labAktif;
        _terapkanSettingsRuntime(payload, dokterPayload);
        _setVal('cfg_ss_client_secret', '');
        showSettingsBanner("✅ Semua pengaturan berhasil disimpan!", "success");
        showToast("✅ Semua pengaturan disimpan", "success");
    } catch (e) {
        showSettingsBanner("❌ Gagal menyimpan: " + (e.message || 'Cek koneksi'), "error");
        showToast("❌ Gagal menyimpan", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Semua Pengaturan"; }
    }
}

// ════════════════════════════════════════
//  TERAPKAN SETTINGS KE RUNTIME
// ════════════════════════════════════════
function _terapkanSettingsRuntime(s, dokter) {
    const h1   = document.querySelector('.app-title h1');
    const span = document.querySelector('.app-title span');
    if (h1   && s.klinik_title) h1.innerText  = s.klinik_title;
    if (span && s.klinik_nama)  span.innerText = s.klinik_nama;

    if (s.jabatan_medis) {
        const jabList = s.jabatan_medis.split(',').map(j => j.trim()).filter(j => j);
        if (jabList.length > 0) window.JABATAN_MEDIS = jabList;
    }
    if (s.ocr_api_key && s.ocr_api_key.trim() !== '') {
        window.OCR_API_KEY = s.ocr_api_key.trim();
    }
    AI_PROVIDER_NAMES.forEach(p => {
        if (s[`ai_${p}`]) {
            try {
                const keys = JSON.parse(s[`ai_${p}`]);
                if (typeof AI_KEYS !== 'undefined') AI_KEYS[p] = keys;
            } catch(e) {}
        }
    });
    window._dokterAktif = dokter;
}

// ════════════════════════════════════════
//  TEST KONEKSI SATU SEHAT
// ════════════════════════════════════════
async function testKoneksiSatuSehat() {
    const btn    = $('btnTestSS');
    const badge  = $('ssStatusBadge');
    const env    = _getVal('cfg_ss_env');
    const cid    = _getVal('cfg_ss_client_id');
    const secret = _getVal('cfg_ss_client_secret');

    if (!cid || !secret) {
        if (badge) {
            badge.style.display='block';
            badge.textContent='⚠️ Client ID & Secret wajib diisi untuk test';
            Object.assign(badge.style, { background:'rgba(245,158,11,0.1)', color:'#92400e', border:'1px solid rgba(245,158,11,0.3)' });
        }
        return;
    }

    if (btn) { btn.disabled=true; btn.textContent='🔄 Menghubungkan...'; }
    if (badge) {
        badge.style.display='block';
        badge.textContent='🔄 Menghubungkan ke Satu Sehat...';
        Object.assign(badge.style, { background:'rgba(59,130,246,0.1)', color:'#1d4ed8', border:'1px solid rgba(59,130,246,0.3)' });
    }
    // FIX: Test Satu Sehat membutuhkan backend proxy — tidak bisa dilakukan langsung
    // dari frontend karena client_secret tidak boleh terekspos.
    try {
        if (badge) {
            badge.textContent = '⚠️ Test koneksi Satu Sehat memerlukan backend proxy (Edge Function). Simpan konfigurasi dan verifikasi melalui administrator.';
            Object.assign(badge.style, { background:'rgba(245,158,11,0.1)', color:'#92400e', border:'1px solid rgba(245,158,11,0.3)' });
        }
    } catch(e) {
        if (badge) { badge.textContent = '❌ Gagal: ' + (e.message || 'Cek Client ID & Secret'); Object.assign(badge.style, { background:'rgba(239,68,68,0.1)', color:'#dc2626', border:'1px solid rgba(239,68,68,0.3)' }); }
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='🔗 Test Koneksi Satu Sehat'; }
    }
}

// ════════════════════════════════════════
//  INJECT STYLE ACCORDION (sekali saja)
// ════════════════════════════════════════
// BUG-11 FIX: Gunakan querySelector dengan ID selector untuk memastikan pengecekan
// duplikat berfungsi. document.getElementById() tidak menangani ID dengan tanda hubung
// melalui shortcut $() di beberapa implementasi — querySelector lebih aman.
function _injectAccordionStyle() {
    if (document.querySelector('#settings-accordion-style')) return;
    const style = document.createElement('style');
    style.id = 'settings-accordion-style';
    style.textContent = `
    .page-settings-wrap { padding: 12px 0 20px; }

    /* ── Banner animation ── */
    @keyframes sbBannerIn {
        from { opacity:0; transform:translateY(-10px) scale(0.92); }
        to   { opacity:1; transform:translateY(0)     scale(1); }
    }

    /* ── Lab toggle item hover ── */
    .lab-toggle-item:hover { background: rgba(var(--primary-rgb,37,99,235),0.04) !important; }

    /* ── Accordion Card ── */
    .settings-accordion {
        background: var(--card-bg, #fff);
        border: 1px solid rgba(var(--primary-rgb, 37,99,235), 0.12);
        border-radius: 14px;
        margin-bottom: 10px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        transition: box-shadow 0.2s;
    }
    .settings-accordion:focus-within {
        box-shadow: 0 4px 16px rgba(var(--primary-rgb,37,99,235),0.12);
    }
    .settings-accordion-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        cursor: pointer;
        user-select: none;
        gap: 8px;
        transition: background 0.15s;
    }
    .settings-accordion-header:hover {
        background: rgba(var(--primary-rgb,37,99,235),0.04);
    }
    .settings-acc-title {
        font-size: 13px;
        font-weight: 700;
        color: var(--text-primary, #1e293b);
    }
    .settings-acc-sub {
        font-size: 11px;
        color: var(--text-muted, #64748b);
        margin-top: 2px;
    }
    .settings-acc-arrow {
        font-size: 11px;
        color: var(--primary, #2563eb);
        flex-shrink: 0;
        transition: transform 0.2s;
    }
    .settings-accordion-body {
        border-top: 1px solid rgba(var(--primary-rgb,37,99,235),0.08);
        animation: fadeInDown 0.18s ease;
    }
    @keyframes fadeInDown {
        from { opacity:0; transform:translateY(-6px); }
        to   { opacity:1; transform:translateY(0); }
    }
    .settings-acc-content { padding: 14px 16px 4px; }
    .settings-acc-footer {
        padding: 10px 16px 14px;
        border-top: 1px solid rgba(var(--primary-rgb,37,99,235),0.06);
        display: flex;
        justify-content: flex-end;
    }

    /* ── Label ── */
    .cfg-label {
        font-size: 10px;
        font-weight: 700;
        color: var(--text-muted, #64748b);
        text-transform: uppercase;
        letter-spacing: .4px;
        margin-bottom: 3px;
        display: block;
    }
    .sub-section-label {
        font-size: 11px;
        font-weight: 700;
        color: var(--primary, #2563eb);
        margin: 14px 0 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(var(--primary-rgb,37,99,235),0.15);
    }

    /* ── Tombol Simpan per Seksi ── */
    .btn-simpan-seksi {
        background: linear-gradient(135deg, var(--primary,#2563eb), hsl(var(--bg-h,210),70%,42%));
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 8px 20px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        transition: opacity 0.2s, transform 0.1s;
    }
    .btn-simpan-seksi:hover  { opacity: .88; }
    .btn-simpan-seksi:active { transform: scale(0.97); }
    .btn-simpan-seksi:disabled { opacity: .5; cursor: not-allowed; }

    /* ── Tombol Simpan Semua ── */
    .btn-simpan-all {
        width: 100%;
        background: linear-gradient(135deg, #1e40af, #2563eb);
        color: #fff;
        border: none;
        border-radius: 14px;
        padding: 14px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        box-shadow: 0 4px 14px rgba(37,99,235,0.3);
        transition: opacity 0.2s, transform 0.1s;
    }
    .btn-simpan-all:hover  { opacity: .9; }
    .btn-simpan-all:active { transform: scale(0.98); }
    .btn-simpan-all:disabled { opacity: .5; cursor: not-allowed; }

    /* ── Jabatan Access Card ── */
    .jabatan-access-card {
        background: rgba(var(--primary-rgb,37,99,235),0.03);
        border: 1px solid rgba(var(--primary-rgb,37,99,235),0.1);
        border-radius: 10px;
        margin-bottom: 8px;
        overflow: hidden;
    }
    .jabatan-access-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        color: var(--text-primary,#1e293b);
        gap: 8px;
        user-select: none;
    }
    .jabatan-access-title:hover { background: rgba(var(--primary-rgb,37,99,235),0.05); }
    .jabatan-acc-count {
        font-size: 10px;
        font-weight: 600;
        color: var(--primary,#2563eb);
        background: rgba(var(--primary-rgb,37,99,235),0.1);
        padding: 2px 8px;
        border-radius: 20px;
        margin-left: auto;
    }

    /* ── Module Checkbox Grid ── */
    .module-checkbox-grid {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .module-check-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid rgba(var(--primary-rgb,37,99,235),0.1);
        background: var(--card-bg,#fff);
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
    }
    .module-check-item.checked {
        border-color: rgba(var(--primary-rgb,37,99,235),0.4);
        background: rgba(var(--primary-rgb,37,99,235),0.05);
    }
    .module-check-item input[type=checkbox] { margin-top: 2px; flex-shrink:0; }
    .module-check-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-primary,#1e293b);
    }
    .module-check-desc {
        font-size: 10px;
        color: var(--text-muted,#64748b);
        margin-top: 1px;
    }

    /* ── AI Provider Card ── */
    .ai-provider-card {
        border: 1px solid rgba(var(--primary-rgb,37,99,235),0.1);
        border-radius: 10px;
        margin-bottom: 8px;
        overflow: hidden;
    }
    .ai-provider-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
    }
    .ai-provider-header:hover { background: rgba(var(--primary-rgb,37,99,235),0.04); }
    .ai-status-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #e2e8f0;
        flex-shrink: 0;
    }
    .ai-status-dot.has-key { background: #10b981; }
    .ai-key-row {
        display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
    }
    .btn-del-key {
        background: none; border: none; cursor: pointer;
        font-size: 14px; padding: 2px 4px; border-radius: 6px;
        transition: background 0.15s;
    }
    .btn-del-key:hover { background: rgba(239,68,68,0.1); }

    /* ── Misc buttons ── */
    .btn-add-row {
        background: none;
        border: 1px dashed rgba(var(--primary-rgb,37,99,235),0.4);
        color: var(--primary,#2563eb);
        border-radius: 8px;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
        margin-top: 8px;
        font-family: inherit;
        transition: background 0.15s;
    }
    .btn-add-row:hover { background: rgba(var(--primary-rgb,37,99,235),0.05); }
    .btn-test {
        background: rgba(var(--primary-rgb,37,99,235),0.08);
        border: 1px solid rgba(var(--primary-rgb,37,99,235),0.25);
        color: var(--primary,#2563eb);
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        width: 100%;
        transition: background 0.15s;
    }
    .btn-test:hover { background: rgba(var(--primary-rgb,37,99,235),0.14); }
    .btn-eye {
        background: rgba(var(--primary-rgb,37,99,235),0.07);
        border: 1px solid rgba(var(--primary-rgb,37,99,235),0.2);
        border-radius: 8px;
        padding: 0 10px;
        cursor: pointer;
        font-size: 14px;
        flex-shrink: 0;
    }
    .btn-small-secondary {
        background: none;
        border: 1px solid rgba(var(--primary-rgb,37,99,235),0.2);
        color: var(--primary,#2563eb);
        border-radius: 7px;
        padding: 4px 10px;
        font-size: 10px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s;
    }
    .btn-small-secondary:hover { background: rgba(var(--primary-rgb,37,99,235),0.07); }
    .btn-danger {
        background: #ef4444; color: #fff; border: none;
        border-radius: 10px; padding: 9px 14px;
        font-size: 13px; font-weight: 700;
        cursor: pointer; font-family: inherit;
    }
    .btn-secondary {
        background: rgba(100,116,139,0.1);
        color: var(--text-primary,#1e293b);
        border: 1px solid rgba(100,116,139,0.2);
        border-radius: 10px; padding: 9px 14px;
        font-size: 13px; font-weight: 600;
        cursor: pointer; font-family: inherit;
    }
    .btn-hapus-dokter {
        display: none;
    }
    .dokter-row {
        border: 1px solid rgba(var(--primary-rgb,37,99,235),0.1);
        border-radius: 10px;
        padding: 12px 10px 10px;
        margin-bottom: 10px;
        background: rgba(var(--primary-rgb,37,99,235),0.02);
    }
    `;
    document.head.appendChild(style);
}

// ════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════
function showSettingsBanner(msg, type) {
    let el = $('settingsBanner');
    if (!el) return;

    const colors = {
        success: { bg:'#ecfdf5', color:'#065f46', border:'#6ee7b7', icon:'✅' },
        error:   { bg:'#fef2f2', color:'#dc2626', border:'#fca5a5', icon:'❌' },
        warning: { bg:'#fffbeb', color:'#92400e', border:'#fcd34d', icon:'⚠️' },
        info:    { bg:'#eff6ff', color:'#1d4ed8', border:'#93c5fd', icon:'⏳' }
    };
    const c = colors[type] || colors.info;

    el.innerHTML = `
    <div style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;
        background:${c.bg};color:${c.color};border:1.5px solid ${c.border};
        border-radius:50px;font-size:12px;font-weight:700;
        box-shadow:0 4px 20px rgba(0,0,0,0.12);
        animation:sbBannerIn 0.25s cubic-bezier(.34,1.56,.64,1);">
        <span>${c.icon}</span>
        <span>${msg}</span>
    </div>`;
    el.style.cssText = `
        display:flex;justify-content:center;
        position:fixed;top:70px;left:0;right:0;z-index:9999;
        pointer-events:none;`;
}

function hideSettingsBanner() {
    const el = $('settingsBanner');
    if (el) {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.3s';
        setTimeout(() => { el.style.display = 'none'; el.style.opacity = '1'; }, 300);
    }
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


// ════════════════════════════════════════
//  STOK OBAT — SETTINGS
// ════════════════════════════════════════
function _htmlStokSection() {
    return `
    <div style="padding:4px 0;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:12px;margin-bottom:10px;">
            <div>
                <div style="font-weight:700;font-size:13px;color:var(--primary-dark);">💊 Aktifkan Modul Stok Obat</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Tampilkan halaman Stok & picker resep otomatis di pemeriksaan medis</div>
            </div>
            <label style="position:relative;display:inline-block;width:46px;height:26px;flex-shrink:0;">
                <input type="checkbox" id="cfg_stok_aktif" style="opacity:0;width:0;height:0;"
                    onchange="_previewStokToggle(this.checked)">
                <span id="stok_toggle_thumb" style="position:absolute;cursor:pointer;inset:0;background:#cbd5e1;border-radius:26px;transition:.3s;">
                    <span style="position:absolute;height:20px;width:20px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.3s;box-shadow:0 1px 4px rgba(0,0,0,0.2);"></span>
                </span>
            </label>
        </div>

        <div style="background:#f8fafc;border-radius:10px;padding:12px;font-size:11.5px;color:var(--text-muted);line-height:1.7;">
            <div style="font-weight:700;color:var(--text);margin-bottom:4px;">Ketika diaktifkan:</div>
            <div>✅ Menu <b>STOK</b> muncul di navigasi bawah</div>
            <div>✅ Form resep obat otomatis muncul di halaman pemeriksaan</div>
            <div>✅ Frekuensi penggunaan terisi otomatis dari data obat</div>
            <div>✅ Stok berkurang otomatis saat resep disimpan</div>
            <div>✅ Kolom <b>Terapi & Obat</b> manual tetap tersedia sebagai fallback</div>
            <div style="margin-top:8px;">Ketika dimatikan:</div>
            <div>↩️ Kembali ke kolom Terapi & Obat teks biasa</div>
        </div>

        <div style="margin-top:12px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:10px;padding:10px;font-size:11px;color:#92400e;">
            ⚠️ <b>SQL yang diperlukan di Supabase</b> — Jalankan skrip DDL di bawah ini satu kali di SQL Editor Supabase sebelum mengaktifkan modul ini.
            <details style="margin-top:8px;">
                <summary style="cursor:pointer;font-weight:700;color:var(--primary);">Lihat SQL DDL ▼</summary>
                <pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:8px;font-size:10px;overflow-x:auto;margin-top:8px;white-space:pre-wrap;">-- Tabel master obat
CREATE TABLE IF NOT EXISTS obat (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama               TEXT NOT NULL,
  kategori           TEXT DEFAULT 'Umum',
  satuan             TEXT DEFAULT 'tablet',
  harga_beli         NUMERIC(12,2) DEFAULT 0,
  harga_jual         NUMERIC(12,2) DEFAULT 0,
  stok               INTEGER DEFAULT 0,
  stok_minimum       INTEGER DEFAULT 5,
  frekuensi_default  TEXT DEFAULT '3x1',
  keterangan         TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- Tabel item resep per kunjungan
CREATE TABLE IF NOT EXISTS resep_item (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunjungan_id UUID NOT NULL REFERENCES kunjungan(id) ON DELETE CASCADE,
  obat_id      UUID REFERENCES obat(id) ON DELETE SET NULL,
  nama_obat    TEXT NOT NULL,
  jumlah       INTEGER NOT NULL DEFAULT 1,
  frekuensi    TEXT DEFAULT '3x1',
  catatan      TEXT,
  harga_satuan NUMERIC(12,2) DEFAULT 0,
  subtotal     NUMERIC(14,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_resep_kunjungan ON resep_item(kunjungan_id);

-- RPC untuk kurangi stok (atomic)
CREATE OR REPLACE FUNCTION kurangi_stok_obat(p_obat_id UUID, p_jumlah INTEGER)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE obat SET stok = GREATEST(0, stok - p_jumlah) WHERE id = p_obat_id;
END;
$$;

-- RLS Policies (sesuaikan dengan auth setup Anda)
ALTER TABLE obat ENABLE ROW LEVEL SECURITY;
ALTER TABLE resep_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_obat" ON obat FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_resep" ON resep_item FOR ALL USING (true) WITH CHECK (true);</pre>
            </details>
        </div>
    </div>`;
}

function _loadStokAktif(s) {
    const aktif = s.stok_aktif === '1';
    window._stokAktif = aktif;
    const chk = document.getElementById('cfg_stok_aktif');
    if (chk) {
        chk.checked = aktif;
        _updateStokToggleStyle(aktif);
    }
    _applyStokAktif(aktif);
}

function _previewStokToggle(aktif) {
    _updateStokToggleStyle(aktif);
}

function _updateStokToggleStyle(aktif) {
    const thumb = document.getElementById('stok_toggle_thumb');
    if (!thumb) return;
    thumb.style.background = aktif ? 'var(--primary)' : '#cbd5e1';
    const ball = thumb.querySelector('span');
    if (ball) ball.style.transform = aktif ? 'translateX(20px)' : 'translateX(0)';
}

function _applyStokAktif(aktif) {
    // Toggle nav item stok
    const navStok = document.getElementById('navStok');
    if (navStok) navStok.style.display = aktif ? '' : 'none';

    // Toggle section resep vs terapi manual di page-medis
    const secResep  = document.getElementById('sectionResep');
    const secManual = document.getElementById('sectionTerapiManual');
    if (secResep)  secResep.style.display  = aktif ? ''     : 'none';
    if (secManual) secManual.style.display = aktif ? 'none' : '';

    window._stokAktif = aktif;
    if (aktif && typeof initStokModule === 'function') initStokModule();
}


// ════════════════════════════════════════
//  SISTEM BIAYA — SETTINGS
// ════════════════════════════════════════
function _htmlBiayaSection() {
    return `
    <div style="padding:4px 0;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:rgba(5,150,105,0.06);border:1px solid rgba(5,150,105,0.18);border-radius:12px;margin-bottom:10px;">
            <div>
                <div style="font-weight:700;font-size:13px;color:var(--primary-dark);">🏷️ Aktifkan Sistem Pembiayaan</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Tagihan otomatis, invoice & print setelah selesai periksa</div>
            </div>
            <label style="position:relative;display:inline-block;width:46px;height:26px;flex-shrink:0;">
                <input type="checkbox" id="cfg_biaya_aktif" style="opacity:0;width:0;height:0;"
                    onchange="_previewBiayaToggle(this.checked)">
                <span id="biaya_toggle_thumb" style="position:absolute;cursor:pointer;inset:0;background:#cbd5e1;border-radius:26px;transition:.3s;">
                    <span style="position:absolute;height:20px;width:20px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.3s;box-shadow:0 1px 4px rgba(0,0,0,0.2);"></span>
                </span>
            </label>
        </div>

        <div style="background:#f8fafc;border-radius:10px;padding:12px;font-size:11.5px;color:var(--text-muted);line-height:1.7;margin-bottom:10px;">
            <div style="font-weight:700;color:var(--text);margin-bottom:4px;">Ketika diaktifkan:</div>
            <div>✅ Menu <b>TARIF</b> muncul di navigasi untuk input tarif layanan</div>
            <div>✅ Tagihan <b>otomatis muncul</b> setelah rekam medis disimpan</div>
            <div>✅ Biaya dihitung dari: Vital Sign, Konsultasi, Lab, Obat, Surat Ket.</div>
            <div>✅ Bisa tambah/hapus item & beri diskon sebelum simpan</div>
            <div>✅ Invoice bisa dilihat & di-print dari riwayat kunjungan</div>
            <div>✅ Laporan keuangan tersedia di halaman Laporan</div>
        </div>

        <div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:10px;padding:10px;font-size:11px;color:#92400e;">
            ⚠️ <b>SQL yang diperlukan di Supabase</b> — Jalankan satu kali sebelum mengaktifkan.
            <details style="margin-top:8px;">
                <summary style="cursor:pointer;font-weight:700;color:var(--primary);">Lihat SQL DDL ▼</summary>
                <pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:8px;font-size:10px;overflow-x:auto;margin-top:8px;white-space:pre-wrap;">-- Tabel master tarif layanan
CREATE TABLE IF NOT EXISTS tarif_layanan (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        TEXT NOT NULL,
  kategori    TEXT DEFAULT 'Pemeriksaan',
  harga       NUMERIC(12,2) DEFAULT 0,
  keterangan  TEXT,
  aktif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Tabel tagihan per kunjungan
CREATE TABLE IF NOT EXISTS tagihan (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunjungan_id UUID NOT NULL REFERENCES kunjungan(id) ON DELETE CASCADE,
  pasien_id    UUID REFERENCES pasien(id) ON DELETE SET NULL,
  subtotal     NUMERIC(14,2) DEFAULT 0,
  diskon       NUMERIC(14,2) DEFAULT 0,
  total        NUMERIC(14,2) DEFAULT 0,
  status       TEXT DEFAULT 'Lunas',
  catatan      TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Tabel item tagihan
CREATE TABLE IF NOT EXISTS tagihan_item (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tagihan_id   UUID NOT NULL REFERENCES tagihan(id) ON DELETE CASCADE,
  nama_item    TEXT NOT NULL,
  kategori     TEXT DEFAULT 'Layanan',
  jumlah       INTEGER DEFAULT 1,
  harga_satuan NUMERIC(12,2) DEFAULT 0,
  subtotal     NUMERIC(14,2) DEFAULT 0,
  keterangan   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_tagihan_kunjungan ON tagihan(kunjungan_id);
CREATE INDEX IF NOT EXISTS idx_tagihan_item ON tagihan_item(tagihan_id);

-- RLS
ALTER TABLE tarif_layanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE tagihan        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tagihan_item   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_tarif"   ON tarif_layanan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_tagihan" ON tagihan        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_tagitem" ON tagihan_item   FOR ALL USING (true) WITH CHECK (true);</pre>
            </details>
        </div>
    </div>`;
}

function _loadBiayaAktif(s) {
    const aktif = s.biaya_aktif === '1';
    window._biayaAktif = aktif;
    const chk = document.getElementById('cfg_biaya_aktif');
    if (chk) {
        chk.checked = aktif;
        _updateBiayaToggleStyle(aktif);
    }
    _applyBiayaAktif(aktif);
}

function _previewBiayaToggle(aktif) {
    _updateBiayaToggleStyle(aktif);
}

function _updateBiayaToggleStyle(aktif) {
    const thumb = document.getElementById('biaya_toggle_thumb');
    if (!thumb) return;
    thumb.style.background = aktif ? '#059669' : '#cbd5e1';
    const ball = thumb.querySelector('span');
    if (ball) ball.style.transform = aktif ? 'translateX(20px)' : 'translateX(0)';
}

function _applyBiayaAktif(aktif) {
    const navBiaya = document.getElementById('navBiaya');
    if (navBiaya) navBiaya.style.display = aktif ? '' : 'none';
    window._biayaAktif = aktif;
}

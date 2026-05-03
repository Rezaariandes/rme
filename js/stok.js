// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL STOK OBAT (stok.js)
//  Halaman manajemen + picker resep di page-medis
// ════════════════════════════════════════════════════════

// ── State ──
let _obatCache    = [];   // semua obat dari server
let _resepItems   = [];   // item resep aktif (kunjungan sedang berjalan)
let _stokAktif    = false; // diambil dari konfigurasi

// ════════════════════════════════════════
//  INIT — dipanggil dari app.js saat load
// ════════════════════════════════════════
async function initStokModule() {
    // Cek apakah modul stok aktif dari settings
    _stokAktif = (window._stokAktif === true);
    if (!_stokAktif) return;

    try {
        _obatCache = await sb_getObat();
    } catch(e) {
        _obatCache = [];
    }

    // Jika halaman stok sudah ada di DOM, render
    if (document.getElementById('pageStok')) {
        await initPageStok();
    }
}

// ════════════════════════════════════════
//  HALAMAN STOK OBAT
// ════════════════════════════════════════
async function initPageStok() {
    await _refreshObatCache();
    renderDaftarObat();
    _renderStokSummary();
    _isiDatalistKategori();
}

async function _refreshObatCache() {
    try {
        _obatCache = await sb_getObat();
    } catch(e) {
        showToast('❌ Gagal memuat data obat', 'error');
    }
}

function renderDaftarObat() {
    const container = document.getElementById('daftarObat');
    if (!container) return;

    const search   = (document.getElementById('stokSearch')?.value || '').toLowerCase();
    const kategori = document.getElementById('stokFilterKategori')?.value || '';

    let list = _obatCache.filter(o => {
        const matchSearch   = !search   || o.nama.toLowerCase().includes(search);
        const matchKategori = !kategori || o.kategori === kategori;
        return matchSearch && matchKategori;
    });

    // Isi filter kategori dropdown
    const selKat = document.getElementById('stokFilterKategori');
    if (selKat) {
        const categories = [...new Set(_obatCache.map(o => o.kategori).filter(Boolean))].sort();
        const currentVal = selKat.value;
        selKat.innerHTML = '<option value="">Semua Kategori</option>' +
            categories.map(k => `<option value="${escHtml(k)}" ${currentVal===k?'selected':''}>${escHtml(k)}</option>`).join('');
    }

    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">💊</div>${search ? 'Obat tidak ditemukan' : 'Belum ada data obat'}</div>`;
        return;
    }

    container.innerHTML = list.map(o => {
        const isKritis   = o.stok <= o.stok_minimum;
        const stokColor  = isKritis ? '#dc2626' : (o.stok <= o.stok_minimum * 2 ? '#d97706' : 'var(--success)');
        const stokBg     = isKritis ? 'rgba(220,38,38,0.07)' : 'rgba(22,163,74,0.06)';
        const margin     = _hitungMargin(o.harga_beli, o.harga_jual);

        return `
        <div style="background:${stokBg};border:1px solid ${isKritis ? 'rgba(220,38,38,0.25)' : 'rgba(0,0,0,0.07)'};border-radius:12px;padding:12px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:13px;color:var(--primary-dark);margin-bottom:2px;">${escHtml(o.nama)}</div>
                    <div style="font-size:10.5px;color:var(--text-muted);">
                        ${escHtml(o.kategori || '—')} · ${escHtml(o.satuan)} · ${escHtml(o.frekuensi_default || '3x1')}
                    </div>
                    <div style="font-size:11px;margin-top:4px;display:flex;gap:10px;flex-wrap:wrap;">
                        <span>Beli: <b>Rp ${_fmt(o.harga_beli)}</b></span>
                        <span>Jual: <b style="color:var(--primary)">Rp ${_fmt(o.harga_jual)}</b></span>
                        <span style="color:${margin >= 0 ? 'var(--success)' : '#dc2626'}">Margin: ${margin}%</span>
                    </div>
                    ${o.keterangan ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:2px;">📌 ${escHtml(o.keterangan)}</div>` : ''}
                </div>
                <div style="text-align:center;flex-shrink:0;">
                    <div style="font-size:20px;font-weight:900;color:${stokColor};line-height:1;">${o.stok ?? 0}</div>
                    <div style="font-size:9px;color:${stokColor};font-weight:600;">${isKritis ? '⚠️ KRITIS' : 'stok'}</div>
                    <div style="font-size:9px;color:var(--text-muted);">min. ${o.stok_minimum ?? 5}</div>
                </div>
            </div>
            <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
                <button onclick="openModalObat('${escHtml(String(o.id))}')"
                    style="flex:1;padding:6px 8px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;min-width:70px;">
                    ✏️ Edit
                </button>
                <button onclick="openModalRestock('${escHtml(String(o.id))}')"
                    style="flex:1;padding:6px 8px;background:var(--success);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;min-width:70px;">
                    📦 Restock
                </button>
                <button onclick="hapusObat('${escHtml(String(o.id))}')"
                    style="padding:6px 10px;background:rgba(220,38,38,0.09);color:#dc2626;border:1px solid rgba(220,38,38,0.2);border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">
                    🗑️
                </button>
            </div>
        </div>`;
    }).join('');

    _renderStokSummary();
}

function _renderStokSummary() {
    const el = document.getElementById('stokSummary');
    if (!el) return;
    const total   = _obatCache.length;
    const kritis  = _obatCache.filter(o => (o.stok ?? 0) <= (o.stok_minimum ?? 5)).length;
    const nilaiStok = _obatCache.reduce((s, o) => s + ((o.stok ?? 0) * (o.harga_beli ?? 0)), 0);

    const tile = (icon, label, val, color) =>
        `<div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:10px;text-align:center;">
            <div style="font-size:18px;">${icon}</div>
            <div style="font-size:17px;font-weight:900;color:${color};">${val}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:1px;">${label}</div>
        </div>`;

    el.innerHTML =
        tile('💊', 'Total Jenis', total, 'var(--primary)') +
        tile('⚠️', 'Stok Kritis', kritis, kritis > 0 ? '#dc2626' : 'var(--success)') +
        tile('💰', 'Nilai Stok', 'Rp ' + _fmt(nilaiStok), 'var(--primary-dark)');
}

function _isiDatalistKategori() {
    const dl = document.getElementById('list-kategori-obat');
    if (!dl) return;
    const cats = [...new Set(_obatCache.map(o => o.kategori).filter(Boolean))].sort();
    dl.innerHTML = cats.map(k => `<option value="${escHtml(k)}">`).join('');
}

// ════════════════════════════════════════
//  MODAL: TAMBAH / EDIT OBAT
// ════════════════════════════════════════
async function openModalObat(id = null) {
    const modal = document.getElementById('modalObat');
    if (!modal) return;

    _clearFormObat();

    if (id) {
        document.getElementById('modalObatTitle').textContent = '✏️ Edit Obat';
        const obat = _obatCache.find(o => String(o.id) === String(id)) || await sb_getObatById(id);
        if (obat) _isiFormObat(obat);
    } else {
        document.getElementById('modalObatTitle').textContent = '➕ Tambah Obat Baru';
    }

    _isiDatalistKategori();
    modal.style.display = 'block';
    setTimeout(() => document.getElementById('obat_nama')?.focus(), 100);
}

function closeModalObat() {
    const modal = document.getElementById('modalObat');
    if (modal) modal.style.display = 'none';
}

function _clearFormObat() {
    ['obat_id','obat_nama','obat_kategori','obat_harga_beli','obat_harga_jual',
     'obat_stok','obat_stok_minimum','obat_keterangan'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const sat = document.getElementById('obat_satuan');
    if (sat) sat.value = 'tablet';
    const fq = document.getElementById('obat_frekuensi_default');
    if (fq) fq.value = '3x1';
}

function _isiFormObat(o) {
    const _set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    _set('obat_id',              o.id);
    _set('obat_nama',            o.nama);
    _set('obat_kategori',        o.kategori);
    _set('obat_satuan',          o.satuan);
    _set('obat_harga_beli',      o.harga_beli);
    _set('obat_harga_jual',      o.harga_jual);
    _set('obat_stok',            o.stok);
    _set('obat_stok_minimum',    o.stok_minimum);
    _set('obat_keterangan',      o.keterangan);
    const fq = document.getElementById('obat_frekuensi_default');
    if (fq) fq.value = o.frekuensi_default || '3x1';
}

async function simpanObat() {
    const nama = document.getElementById('obat_nama')?.value.trim();
    if (!nama) return showToast('⚠️ Nama obat wajib diisi', 'error');

    const payload = {
        id:                 document.getElementById('obat_id')?.value || null,
        nama,
        kategori:           document.getElementById('obat_kategori')?.value.trim()  || 'Umum',
        satuan:             document.getElementById('obat_satuan')?.value            || 'tablet',
        harga_beli:         document.getElementById('obat_harga_beli')?.value        || 0,
        harga_jual:         document.getElementById('obat_harga_jual')?.value        || 0,
        stok:               document.getElementById('obat_stok')?.value             || 0,
        stok_minimum:       document.getElementById('obat_stok_minimum')?.value     || 5,
        frekuensi_default:  document.getElementById('obat_frekuensi_default')?.value || '3x1',
        keterangan:         document.getElementById('obat_keterangan')?.value.trim() || null
    };

    try {
        await sb_saveObat(payload);
        showToast('✅ Data obat tersimpan', 'success');
        closeModalObat();
        await _refreshObatCache();
        renderDaftarObat();
    } catch(e) {
        showToast('❌ Gagal menyimpan: ' + (e.message || ''), 'error');
    }
}

async function hapusObat(id) {
    if (!confirm('Hapus obat ini? Tindakan tidak dapat dibatalkan.')) return;
    try {
        await sb_deleteObat(id);
        showToast('🗑️ Obat dihapus', 'success');
        await _refreshObatCache();
        renderDaftarObat();
    } catch(e) {
        showToast('❌ Gagal menghapus: ' + (e.message || ''), 'error');
    }
}

// ════════════════════════════════════════
//  MODAL: RESTOCK
// ════════════════════════════════════════
function openModalRestock(obatId) {
    const modal = document.getElementById('modalRestock');
    if (!modal) return;
    const obat = _obatCache.find(o => String(o.id) === String(obatId));
    document.getElementById('restock_obat_id').value    = obatId;
    document.getElementById('restock_nama_obat').textContent = obat ? `💊 ${obat.nama}  (Stok saat ini: ${obat.stok ?? 0} ${obat.satuan})` : '';
    document.getElementById('restock_jumlah').value     = '';
    document.getElementById('restock_harga').value      = '';
    modal.style.display = 'block';
    setTimeout(() => document.getElementById('restock_jumlah')?.focus(), 100);
}

function closeModalRestock() {
    const modal = document.getElementById('modalRestock');
    if (modal) modal.style.display = 'none';
}

async function simpanRestock() {
    const id     = document.getElementById('restock_obat_id')?.value;
    const jumlah = Number(document.getElementById('restock_jumlah')?.value);
    const harga  = document.getElementById('restock_harga')?.value;

    if (!jumlah || jumlah < 1) return showToast('⚠️ Jumlah harus minimal 1', 'error');

    try {
        await sb_tambahStok(id, jumlah, harga || null);
        showToast(`✅ Stok ditambah ${jumlah}`, 'success');
        closeModalRestock();
        await _refreshObatCache();
        renderDaftarObat();
    } catch(e) {
        showToast('❌ Gagal restock: ' + (e.message || ''), 'error');
    }
}

// ════════════════════════════════════════
//  RESEP PICKER — untuk page-medis
// ════════════════════════════════════════

/** Render section resep di page-medis.
 *  Dipanggil dari kunjungan.js saat _stokAktif = true */
function renderSectionResep(kunjunganId) {
    const container = document.getElementById('sectionResep');
    if (!container) return;

    container.innerHTML = `
    <div class="section-divider"><span>💊 Resep Obat</span>
        <button onclick="openModalPilihObat()"
            style="margin-left:auto;padding:4px 10px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">
            ➕ Pilih Obat
        </button>
    </div>

    <div id="resepItemList" style="margin-bottom:8px;min-height:40px;">
        ${_resepItems.length === 0
            ? '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:10px;">Belum ada obat ditambahkan</div>'
            : _resepItems.map((item, idx) => _htmlResepItem(item, idx)).join('')
        }
    </div>

    ${_resepItems.length > 0 ? `
    <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:10px 12px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;font-weight:700;color:var(--primary-dark);">
            <span>Total Biaya Obat:</span>
            <span>Rp ${_fmt(_resepItems.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0))}</span>
        </div>
    </div>` : ''}
    `;
}

function _htmlResepItem(item, idx) {
    const subtotal = Number(item.jumlah) * Number(item.harga_satuan);
    return `
    <div style="background:#fff;border:1px solid rgba(0,0,0,0.09);border-radius:10px;padding:10px 12px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;">
                <div style="font-weight:700;font-size:12.5px;color:var(--primary-dark);">${escHtml(item.nama_obat)}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">Rp ${_fmt(item.harga_satuan)} / ${escHtml(item.satuan || 'tablet')}</div>
            </div>
            <button onclick="_hapusResepItem(${idx})"
                style="background:none;border:none;color:#dc2626;font-size:16px;cursor:pointer;padding:0;line-height:1;">✕</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:4px;">
                <label style="font-size:10.5px;color:var(--text-muted);">Jumlah:</label>
                <input type="number" value="${item.jumlah}" min="1"
                    style="width:52px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;text-align:center;"
                    onchange="_updateResepItem(${idx}, 'jumlah', this.value)">
            </div>
            <div style="display:flex;align-items:center;gap:4px;flex:1;">
                <label style="font-size:10.5px;color:var(--text-muted);">Frekuensi:</label>
                <select style="flex:1;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;"
                    onchange="_updateResepItem(${idx}, 'frekuensi', this.value)">
                    ${['1x1','2x1','3x1','3x2','4x1','1x1 malam','prn'].map(f =>
                        `<option value="${f}" ${item.frekuensi === f ? 'selected' : ''}>${f}</option>`
                    ).join('')}
                </select>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;margin-top:6px;">
            <label style="font-size:10.5px;color:var(--text-muted);">Catatan:</label>
            <input type="text" value="${escHtml(item.catatan || '')}" placeholder="Sesudah makan, dll."
                style="flex:1;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;"
                onchange="_updateResepItem(${idx}, 'catatan', this.value)">
        </div>
        <div style="text-align:right;font-size:11px;color:var(--primary);font-weight:700;margin-top:6px;">
            Subtotal: Rp ${_fmt(subtotal)}
        </div>
    </div>`;
}

function _hapusResepItem(idx) {
    _resepItems.splice(idx, 1);
    _rerenderResepList();
    _syncTerapiField();
}

function _updateResepItem(idx, field, val) {
    if (_resepItems[idx]) {
        _resepItems[idx][field] = field === 'jumlah' ? Math.max(1, Number(val)) : val;
        _rerenderResepList();
        _syncTerapiField();
    }
}

function _rerenderResepList() {
    const el = document.getElementById('resepItemList');
    if (!el) return;
    if (_resepItems.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:10px;">Belum ada obat ditambahkan</div>';
    } else {
        el.innerHTML = _resepItems.map((item, idx) => _htmlResepItem(item, idx)).join('');
    }
    // Update total
    const totalEl = el.nextElementSibling;
    if (totalEl && _resepItems.length > 0) {
        const total = _resepItems.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
        totalEl.style.display = '';
        totalEl.querySelector('span:last-child').textContent = 'Rp ' + _fmt(total);
    } else if (totalEl) {
        totalEl.style.display = 'none';
    }
}

/** Sinkron field #terapi dengan teks ringkasan resep */
function _syncTerapiField() {
    const terapiEl = document.getElementById('terapi');
    if (!terapiEl) return;
    if (_resepItems.length === 0) {
        terapiEl.value = '';
        return;
    }
    terapiEl.value = _resepItems.map(item =>
        `${item.nama_obat} ${item.frekuensi}${item.catatan ? ' (' + item.catatan + ')' : ''}`
    ).join('\n');
}

// ════════════════════════════════════════
//  MODAL: PILIH OBAT (di page-medis)
// ════════════════════════════════════════
function openModalPilihObat() {
    let modal = document.getElementById('modalPilihObat');
    if (!modal) {
        modal = _buildModalPilihObat();
        document.body.appendChild(modal);
    }
    _renderPilihObatList('');
    modal.style.display = 'block';
    setTimeout(() => document.getElementById('searchPilihObat')?.focus(), 100);
}

function _buildModalPilihObat() {
    const div = document.createElement('div');
    div.id = 'modalPilihObat';
    div.style.cssText = 'display:none;position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.5);overflow-y:auto;padding:16px;';
    div.innerHTML = `
    <div style="background:#fff;border-radius:18px;max-width:480px;margin:0 auto;padding:20px;box-shadow:0 8px 40px rgba(0,0,0,0.2);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-size:14px;font-weight:800;color:var(--primary-dark);">💊 Pilih Obat</div>
            <button onclick="closeModalPilihObat()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted);">✕</button>
        </div>
        <input type="text" id="searchPilihObat" placeholder="🔍 Cari nama obat..." class="form-control"
            style="margin-bottom:10px;" oninput="_renderPilihObatList(this.value)">
        <div id="pilihObatList" style="max-height:360px;overflow-y:auto;"></div>
    </div>`;
    return div;
}

function closeModalPilihObat() {
    const modal = document.getElementById('modalPilihObat');
    if (modal) modal.style.display = 'none';
}

function _renderPilihObatList(search) {
    const container = document.getElementById('pilihObatList');
    if (!container) return;

    const q = (search || '').toLowerCase();
    const list = _obatCache.filter(o => !q || o.nama.toLowerCase().includes(q));

    if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:20px;">Obat tidak ditemukan</div>';
        return;
    }

    container.innerHTML = list.map(o => {
        const stokKritis = (o.stok ?? 0) <= (o.stok_minimum ?? 5);
        const stokHabis  = (o.stok ?? 0) === 0;
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #f1f5f9;cursor:${stokHabis ? 'not-allowed' : 'pointer'};opacity:${stokHabis ? '0.5' : '1'}"
            ${stokHabis ? '' : `onclick="_pilihObat('${escHtml(String(o.id))}')"`}>
            <div style="flex:1;">
                <div style="font-weight:700;font-size:12.5px;">${escHtml(o.nama)}</div>
                <div style="font-size:10.5px;color:var(--text-muted);">${escHtml(o.kategori||'—')} · ${escHtml(o.frekuensi_default||'3x1')}</div>
                <div style="font-size:10.5px;color:var(--primary);">Rp ${_fmt(o.harga_jual)} / ${escHtml(o.satuan)}</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:15px;font-weight:800;color:${stokKritis ? '#dc2626' : 'var(--success)'};">${o.stok ?? 0}</div>
                <div style="font-size:9px;color:var(--text-muted);">${stokHabis ? '❌ HABIS' : stokKritis ? '⚠️ tipis' : 'stok'}</div>
            </div>
        </div>`;
    }).join('');
}

function _pilihObat(obatId) {
    const obat = _obatCache.find(o => String(o.id) === String(obatId));
    if (!obat) return;

    // Jika sudah ada di resep, tambah jumlahnya
    const existing = _resepItems.find(i => String(i.obat_id) === String(obatId));
    if (existing) {
        existing.jumlah = (existing.jumlah || 1) + 1;
    } else {
        _resepItems.push({
            obat_id:      obat.id,
            nama_obat:    obat.nama,
            satuan:       obat.satuan,
            jumlah:       1,
            frekuensi:    obat.frekuensi_default || '3x1',
            harga_satuan: obat.harga_jual || 0,
            catatan:      obat.keterangan || ''
        });
    }

    closeModalPilihObat();
    _rerenderResepList();
    _syncTerapiField();
    showToast(`✅ ${obat.nama} ditambahkan ke resep`, 'success');
}

// ════════════════════════════════════════
//  SIMPAN RESEP (dipanggil dari saveAll di kunjungan.js)
// ════════════════════════════════════════
async function simpanResepKunjungan(kunjunganId) {
    if (!_stokAktif || _resepItems.length === 0) return;
    try {
        await sb_saveResep(kunjunganId, _resepItems);
    } catch(e) {
        showToast('⚠️ Resep tersimpan sebagian: ' + (e.message || ''), 'error');
    }
}

/** Reset state resep saat sesi pasien diganti */
function resetResepSession() {
    _resepItems = [];
    const el = document.getElementById('resepItemList');
    if (el) el.innerHTML = '';
}

/** Load resep lama saat kunjungan di-resume */
async function loadResepByKunjungan(kunjunganId) {
    if (!_stokAktif || !kunjunganId) return;
    try {
        const rows = await sb_getResepByKunjungan(kunjunganId);
        _resepItems = rows.map(r => ({
            obat_id:      r.obat_id,
            nama_obat:    r.nama_obat || (r.obat && r.obat.nama) || '—',
            satuan:       (r.obat && r.obat.satuan) || 'tablet',
            jumlah:       r.jumlah,
            frekuensi:    r.frekuensi,
            harga_satuan: r.harga_satuan,
            catatan:      r.catatan || ''
        }));
        _rerenderResepList();
        _syncTerapiField();
    } catch(e) {
        _resepItems = [];
    }
}

// ════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════
function _fmt(n) {
    return Number(n || 0).toLocaleString('id-ID');
}

function _hitungMargin(beli, jual) {
    if (!beli || beli == 0) return jual > 0 ? 100 : 0;
    return Math.round(((jual - beli) / beli) * 100);
}

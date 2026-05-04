// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL PEMBIAYAAN (biaya.js)
//  • Manajemen tarif layanan
//  • Auto-generate tagihan dari kunjungan
//  • Invoice viewer + print
// ════════════════════════════════════════════════════════

// ── State ──
let _tarifCache   = [];  // master tarif layanan
let _activeKatTab = '';  // tab kategori aktif di page-biaya

// Kategori bawaan yang harus ada saat tarif pertama kali dimuat
const TARIF_DEFAULT = [
    { nama: 'Vital Sign',                kategori: 'Pemeriksaan', harga: 15000  },
    { nama: 'Konsultasi Medis',          kategori: 'Pemeriksaan', harga: 50000  },
    { nama: 'Pemeriksaan Fisik',         kategori: 'Pemeriksaan', harga: 25000  },
    { nama: 'GDS',                        kategori: 'Laboratorium', harga: 15000  },
    { nama: 'Kolesterol',                kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Asam Urat',                 kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Hemoglobin (HB)',           kategori: 'Laboratorium', harga: 15000  },
    { nama: 'Trombosit',                 kategori: 'Laboratorium', harga: 15000  },
    { nama: 'Leukosit',                  kategori: 'Laboratorium', harga: 15000  },
    { nama: 'Eritrosit',                 kategori: 'Laboratorium', harga: 15000  },
    { nama: 'Hematokrit',               kategori: 'Laboratorium', harga: 15000  },
    { nama: 'HIV',                       kategori: 'Laboratorium', harga: 35000  },
    { nama: 'Sifilis',                   kategori: 'Laboratorium', harga: 35000  },
    { nama: 'Hepatitis B',               kategori: 'Laboratorium', harga: 35000  },
    { nama: 'HDL',                       kategori: 'Laboratorium', harga: 20000  },
    { nama: 'LDL',                       kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Trigliserida',             kategori: 'Laboratorium', harga: 20000  },
    { nama: 'GDP',                       kategori: 'Laboratorium', harga: 15000  },
    { nama: 'HbA1c',                    kategori: 'Laboratorium', harga: 45000  },
    { nama: 'SGOT',                      kategori: 'Laboratorium', harga: 20000  },
    { nama: 'SGPT',                      kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Ureum',                     kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Creatinin',                kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Surat Keterangan Sakit',   kategori: 'Administrasi', harga: 15000  },
    { nama: 'Surat Keterangan Sehat',   kategori: 'Administrasi', harga: 25000  },
    { nama: 'Surat Rujukan',            kategori: 'Administrasi', harga: 10000  }
];

// Ikon per kategori
const KAT_ICON = {
    'Pemeriksaan': '🩺',
    'Laboratorium': '🔬',
    'Obat': '💊',
    'Administrasi': '📋',
    'Tindakan': '⚕️',
    'Lainnya': '📌'
};

// ════════════════════════════════════════
//  INIT HALAMAN TARIF
// ════════════════════════════════════════
async function initPageBiaya() {
    await _refreshTarifCache();
    renderDaftarTarif();
}

async function _refreshTarifCache() {
    try {
        _tarifCache = await sb_getTarif();
        // Seed default jika kosong
        if (_tarifCache.length === 0) {
            await _seedTarifDefault();
            _tarifCache = await sb_getTarif();
        }
    } catch(e) {
        showToast('❌ Gagal memuat tarif', 'error');
    }
}

async function _seedTarifDefault() {
    try {
        for (const t of TARIF_DEFAULT) {
            await sb_saveTarif({ ...t, aktif: true });
        }
        showToast('✅ Tarif default berhasil dibuat', 'success');
    } catch(e) {}
}

function renderDaftarTarif() {
    const container = document.getElementById('daftarTarif');
    const tabsEl    = document.getElementById('biayaKategoriTabs');
    if (!container) return;

    // Build kategori tabs
    const categories = [...new Set(_tarifCache.map(t => t.kategori))].sort();
    if (tabsEl) {
        tabsEl.innerHTML = ['', ...categories].map(k => {
            const isAll = k === '';
            const active = _activeKatTab === k;
            return `<button onclick="_setBiayaTab('${k}')"
                style="padding:5px 12px;border:1.5px solid ${active ? 'var(--primary)' : '#e2e8f0'};
                       border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;
                       background:${active ? 'var(--primary)' : '#fff'};
                       color:${active ? '#fff' : 'var(--text)'};white-space:nowrap;">
                ${isAll ? '📋 Semua' : (KAT_ICON[k]||'📌') + ' ' + k}
            </button>`;
        }).join('');
    }

    // Filter
    const list = _activeKatTab
        ? _tarifCache.filter(t => t.kategori === _activeKatTab)
        : _tarifCache;

    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🏷️</div>Belum ada tarif</div>`;
        return;
    }

    // Group by kategori
    const grouped = {};
    list.forEach(t => {
        if (!grouped[t.kategori]) grouped[t.kategori] = [];
        grouped[t.kategori].push(t);
    });

    container.innerHTML = Object.entries(grouped).map(([kat, items]) => `
        <div style="margin-bottom:16px;">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-muted);margin-bottom:8px;padding:0 2px;">
                ${KAT_ICON[kat]||'📌'} ${kat}
            </div>
            ${items.map(t => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${t.aktif ? '#fff' : '#f8fafc'};
                        border:1px solid ${t.aktif ? 'rgba(0,0,0,0.08)' : '#e2e8f0'};
                        border-radius:10px;margin-bottom:6px;opacity:${t.aktif ? 1 : 0.6};">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:12.5px;color:var(--primary-dark);">${escHtml(t.nama)}</div>
                    ${t.keterangan ? `<div style="font-size:10.5px;color:var(--text-muted);">${escHtml(t.keterangan)}</div>` : ''}
                    ${!t.aktif ? '<div style="font-size:10px;color:#94a3b8;font-style:italic;">⏸️ Non-aktif</div>' : ''}
                </div>
                <div style="font-weight:800;font-size:14px;color:var(--primary);white-space:nowrap;">Rp ${_fmtRp(t.harga)}</div>
                <div style="display:flex;gap:5px;flex-shrink:0;">
                    <button onclick="openModalTarif('${escHtml(String(t.id))}')"
                        style="padding:5px 8px;background:var(--primary);color:#fff;border:none;border-radius:7px;font-size:11px;cursor:pointer;">✏️</button>
                    <button onclick="hapusTarif('${escHtml(String(t.id))}')"
                        style="padding:5px 8px;background:rgba(220,38,38,0.08);color:#dc2626;border:1px solid rgba(220,38,38,0.2);border-radius:7px;font-size:11px;cursor:pointer;">🗑️</button>
                </div>
            </div>`).join('')}
        </div>
    `).join('');
}

function _setBiayaTab(kat) {
    _activeKatTab = kat;
    renderDaftarTarif();
}

// ════════════════════════════════════════
//  MODAL TAMBAH / EDIT TARIF
// ════════════════════════════════════════
function openModalTarif(id = null) {
    const modal = document.getElementById('modalTarif');
    if (!modal) return;
    _clearFormTarif();
    if (id) {
        document.getElementById('modalTarifTitle').textContent = '✏️ Edit Tarif';
        const t = _tarifCache.find(x => String(x.id) === String(id));
        if (t) {
            document.getElementById('tarif_id').value         = t.id;
            document.getElementById('tarif_nama').value       = t.nama;
            document.getElementById('tarif_kategori').value   = t.kategori;
            document.getElementById('tarif_harga').value      = t.harga;
            document.getElementById('tarif_keterangan').value = t.keterangan || '';
            document.getElementById('tarif_aktif').checked    = t.aktif !== false;
            _onKategoriTarifChange(t.kategori);
        }
    } else {
        document.getElementById('modalTarifTitle').textContent = '➕ Tambah Tarif';
    }
    modal.style.display = 'block';
    setTimeout(() => document.getElementById('tarif_nama')?.focus(), 100);
}

function closeModalTarif() {
    const m = document.getElementById('modalTarif');
    if (m) m.style.display = 'none';
}

function _clearFormTarif() {
    ['tarif_id','tarif_nama','tarif_harga','tarif_keterangan'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const akt = document.getElementById('tarif_aktif');
    if (akt) akt.checked = true;
    const kat = document.getElementById('tarif_kategori');
    if (kat) { kat.value = 'Pemeriksaan'; _onKategoriTarifChange('Pemeriksaan'); }
}

function _onKategoriTarifChange(val) {
    const info = document.getElementById('infoTarifLab');
    if (info) info.style.display = val === 'Laboratorium' ? '' : 'none';
}

async function simpanTarif() {
    const nama = document.getElementById('tarif_nama')?.value.trim();
    const harga = document.getElementById('tarif_harga')?.value;
    if (!nama)  return showToast('⚠️ Nama layanan wajib diisi', 'error');
    if (!harga) return showToast('⚠️ Harga wajib diisi', 'error');

    try {
        await sb_saveTarif({
            id:         document.getElementById('tarif_id')?.value || null,
            nama,
            kategori:   document.getElementById('tarif_kategori')?.value  || 'Pemeriksaan',
            harga,
            keterangan: document.getElementById('tarif_keterangan')?.value || null,
            aktif:      document.getElementById('tarif_aktif')?.checked !== false
        });
        showToast('✅ Tarif tersimpan', 'success');
        closeModalTarif();
        await _refreshTarifCache();
        renderDaftarTarif();
    } catch(e) {
        showToast('❌ Gagal menyimpan: ' + (e.message || ''), 'error');
    }
}

async function hapusTarif(id) {
    if (!confirm('Hapus tarif ini?')) return;
    try {
        await sb_deleteTarif(id);
        showToast('🗑️ Tarif dihapus', 'success');
        await _refreshTarifCache();
        renderDaftarTarif();
    } catch(e) {
        showToast('❌ Gagal menghapus', 'error');
    }
}

// ════════════════════════════════════════
//  MODAL TAGIHAN — muncul setelah simpan rekam medis
// ════════════════════════════════════════
let _tagihanItems   = [];
let _tagihanKunjId  = null;
let _tagihanPasienId= null;
let _tagihanPasienNama = '';
let _tagihanTgl     = '';

/** Dipanggil dari kunjungan.js setelah saveAll sukses */
async function openModalTagihan(kunjunganId, pasienId, pasienNama, tgl, kunjunganData) {
    _tagihanKunjId   = kunjunganId;
    _tagihanPasienId = pasienId;
    _tagihanPasienNama = pasienNama || '—';
    _tagihanTgl      = tgl || '';

    // Pastikan tarif cache tersedia
    if (_tarifCache.length === 0) {
        await _refreshTarifCache();
    }

    // Auto-generate items dari kunjungan
    try {
        _tagihanItems = await sb_autoTagihanFromKunjungan(kunjunganId, kunjunganData);
    } catch(e) {
        _tagihanItems = [];
    }

    // Bangun modal jika belum ada
    let modal = document.getElementById('modalTagihan');
    if (!modal) {
        modal = _buildModalTagihan();
        document.body.appendChild(modal);
    }
    _renderModalTagihanContent();
    modal.style.display = 'block';
}

function closeModalTagihan() {
    const m = document.getElementById('modalTagihan');
    if (m) m.style.display = 'none';
}

function _buildModalTagihan() {
    const div = document.createElement('div');
    div.id = 'modalTagihan';
    div.style.cssText = 'display:none;position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.5);overflow-y:auto;padding:12px;';
    div.innerHTML = `<div id="modalTagihanInner" style="background:#fff;border-radius:18px;max-width:520px;margin:0 auto;padding:0;box-shadow:0 8px 40px rgba(0,0,0,0.2);overflow:hidden;"></div>`;
    return div;
}

function _renderModalTagihanContent() {
    const inner = document.getElementById('modalTagihanInner');
    if (!inner) return;

    const subtotal = _tagihanItems.reduce((s, i) => s + (i.jumlah * i.harga_satuan), 0);
    const diskon   = Number(document.getElementById('inp_diskon')?.value) || 0;
    const total    = Math.max(0, subtotal - diskon);

    inner.innerHTML = `
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:18px 20px 16px;color:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
                <div style="font-size:16px;font-weight:800;margin-bottom:2px;">🧾 Tagihan Kunjungan</div>
                <div style="font-size:11.5px;opacity:.85;">${escHtml(_tagihanPasienNama)} · ${_tagihanTgl ? formatTglIndo(_tagihanTgl) : '—'}</div>
            </div>
            <button onclick="closeModalTagihan()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:8px;padding:5px 9px;font-size:16px;cursor:pointer;line-height:1;">✕</button>
        </div>
    </div>

    <div style="padding:16px 18px;">

        <!-- Item list -->
        <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:12px;font-weight:800;color:var(--primary-dark);">Item Tagihan</div>
                <button onclick="_addItemTagihanManual()"
                    style="padding:4px 10px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">
                    ➕ Tambah Item
                </button>
            </div>

            <div id="tagihanItemList">
                ${_tagihanItems.length === 0
                    ? '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:16px;">Tidak ada item tagihan. Klik "➕ Tambah Item" untuk menambah manual.</div>'
                    : _tagihanItems.map((item, idx) => _htmlTagihanItem(item, idx)).join('')
                }
            </div>
        </div>

        <!-- Diskon & Total -->
        <div style="background:#f8fafc;border-radius:12px;padding:12px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;color:var(--text-muted);">
                <span>Subtotal</span><span style="font-weight:700;color:var(--text);">Rp ${_fmtRp(subtotal)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:12px;color:var(--text-muted);flex-shrink:0;">Diskon (Rp)</span>
                <input type="number" id="inp_diskon" value="${diskon}" min="0" max="${subtotal}" placeholder="0"
                    style="flex:1;padding:5px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;text-align:right;"
                    oninput="_renderModalTagihanContent()">
            </div>
            <div style="display:flex;justify-content:space-between;border-top:2px solid #e2e8f0;padding-top:8px;">
                <span style="font-size:14px;font-weight:800;color:var(--primary-dark);">TOTAL</span>
                <span style="font-size:16px;font-weight:900;color:var(--primary);">Rp ${_fmtRp(total)}</span>
            </div>
        </div>

        <!-- Catatan -->
        <div style="margin-bottom:14px;">
            <label style="font-size:11.5px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;">Catatan</label>
            <input type="text" id="inp_catatan_tagihan" placeholder="Opsional"
                style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;">
        </div>

        <!-- Tombol aksi -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="simpanTagihan()" style="flex:1;min-width:100px;padding:11px;background:var(--success);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
                💾 Simpan Tagihan
            </button>
            <button onclick="simpanDanPrintTagihan()" style="flex:1;min-width:100px;padding:11px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
                🖨️ Simpan & Print
            </button>
            <button onclick="closeModalTagihan()" style="padding:11px 14px;background:#f1f5f9;color:var(--text);border:none;border-radius:10px;font-size:12px;cursor:pointer;">
                Lewati
            </button>
        </div>
    </div>`;
}

function _htmlTagihanItem(item, idx) {
    const sub = (Number(item.jumlah) * Number(item.harga_satuan));
    const katColor = {
        'Pemeriksaan': '#3b82f6', 'Laboratorium': '#7c3aed',
        'Obat': '#059669', 'Administrasi': '#d97706', 'Tindakan': '#dc2626'
    }[item.kategori] || '#64748b';

    return `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:9px 10px;background:#fff;
                border:1px solid rgba(0,0,0,0.07);border-radius:9px;margin-bottom:5px;">
        <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:12px;color:var(--primary-dark);">${escHtml(item.nama_item)}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">
                <span style="font-size:9.5px;background:${katColor}18;color:${katColor};padding:1px 6px;border-radius:10px;font-weight:700;">${escHtml(item.kategori)}</span>
                <span style="font-size:10.5px;color:var(--text-muted);">Rp ${_fmtRp(item.harga_satuan)}</span>
                ${item.keterangan ? `<span style="font-size:10px;color:var(--text-muted);">(${escHtml(item.keterangan)})</span>` : ''}
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
            <input type="number" value="${item.jumlah}" min="1"
                style="width:42px;padding:3px 5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;text-align:center;"
                onchange="_updateTagihanItem(${idx}, 'jumlah', this.value)">
            <div style="font-size:12px;font-weight:700;color:var(--primary);min-width:70px;text-align:right;">Rp ${_fmtRp(sub)}</div>
            <button onclick="_hapusTagihanItem(${idx})"
                style="background:none;border:none;color:#dc2626;font-size:15px;cursor:pointer;padding:0;line-height:1;">✕</button>
        </div>
    </div>`;
}

function _hapusTagihanItem(idx) {
    _tagihanItems.splice(idx, 1);
    _renderModalTagihanContent();
}

function _updateTagihanItem(idx, field, val) {
    if (_tagihanItems[idx]) {
        _tagihanItems[idx][field] = Number(val) || 1;
        _renderModalTagihanContent();
    }
}

function _addItemTagihanManual() {
    // Build mini inline-form atau ambil dari tarif
    let modal = document.getElementById('modalTambahItemTagihan');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalTambahItemTagihan';
        modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.5);overflow-y:auto;padding:16px;';
        modal.innerHTML = `
        <div style="background:#fff;border-radius:18px;max-width:400px;margin:0 auto;padding:20px;box-shadow:0 8px 40px rgba(0,0,0,0.2);">
            <div style="font-size:14px;font-weight:800;margin-bottom:12px;color:var(--primary-dark);">➕ Tambah Item Tagihan</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <div>
                    <label class="form-label" style="font-size:11px;">Pilih dari tarif</label>
                    <select id="selTarifPilih" class="form-control" style="font-size:12px;" onchange="_onPilihTarifManual(this.value)">
                        <option value="">-- Pilih tarif yang ada --</option>
                        ${_tarifCache.filter(t => t.aktif).map(t =>
                            `<option value="${t.id}" data-nama="${escHtml(t.nama)}" data-kat="${escHtml(t.kategori)}" data-harga="${t.harga}">
                                ${escHtml(t.nama)} (Rp ${_fmtRp(t.harga)})
                            </option>`
                        ).join('')}
                        <option value="__manual__">-- Input manual --</option>
                    </select>
                </div>
                <div id="formItemManual" style="display:none;flex-direction:column;gap:6px;">
                    <input type="text" id="inp_item_nama" class="form-control" placeholder="Nama item" style="font-size:12px;">
                    <select id="inp_item_kat" class="form-control" style="font-size:12px;">
                        ${Object.keys(KAT_ICON).map(k => `<option value="${k}">${KAT_ICON[k]} ${k}</option>`).join('')}
                    </select>
                    <input type="number" id="inp_item_harga" class="form-control" placeholder="Harga (Rp)" min="0" style="font-size:12px;">
                </div>
                <input type="number" id="inp_item_qty" class="form-control" placeholder="Jumlah" value="1" min="1" style="font-size:12px;">
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;">
                <button onclick="_konfirmasiTambahItem()" style="flex:1;padding:10px;background:var(--primary);color:#fff;border:none;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;">✅ Tambah</button>
                <button onclick="document.getElementById('modalTambahItemTagihan').style.display='none'"
                    style="padding:10px 14px;background:#f1f5f9;color:var(--text);border:none;border-radius:9px;font-size:12px;cursor:pointer;">Batal</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }

    // Reset form
    const sel = document.getElementById('selTarifPilih');
    if (sel) sel.value = '';
    const frm = document.getElementById('formItemManual');
    if (frm) frm.style.display = 'none';
    const qty = document.getElementById('inp_item_qty');
    if (qty) qty.value = 1;

    modal.style.display = 'block';
}

function _onPilihTarifManual(val) {
    const frm = document.getElementById('formItemManual');
    if (val === '__manual__') {
        if (frm) frm.style.display = 'flex';
    } else {
        if (frm) frm.style.display = 'none';
    }
}

function _konfirmasiTambahItem() {
    const selVal = document.getElementById('selTarifPilih')?.value;
    const qty    = Number(document.getElementById('inp_item_qty')?.value) || 1;

    if (!selVal) return showToast('⚠️ Pilih item terlebih dahulu', 'error');

    let item;
    if (selVal === '__manual__') {
        const nama  = document.getElementById('inp_item_nama')?.value.trim();
        const kat   = document.getElementById('inp_item_kat')?.value || 'Lainnya';
        const harga = Number(document.getElementById('inp_item_harga')?.value) || 0;
        if (!nama)  return showToast('⚠️ Nama item wajib diisi', 'error');
        item = { nama_item: nama, kategori: kat, jumlah: qty, harga_satuan: harga };
    } else {
        const t = _tarifCache.find(x => String(x.id) === String(selVal));
        if (!t) return;
        item = { nama_item: t.nama, kategori: t.kategori, jumlah: qty, harga_satuan: t.harga };
    }

    _tagihanItems.push(item);
    document.getElementById('modalTambahItemTagihan').style.display = 'none';
    _renderModalTagihanContent();
}

// ════════════════════════════════════════
//  SIMPAN TAGIHAN
// ════════════════════════════════════════
async function simpanTagihan() {
    if (!_tagihanKunjId) return showToast('⚠️ Kunjungan tidak valid', 'error');
    const diskon  = Number(document.getElementById('inp_diskon')?.value) || 0;
    const catatan = document.getElementById('inp_catatan_tagihan')?.value || '';

    try {
        const result = await sb_saveTagihan(
            _tagihanKunjId, _tagihanPasienId, _tagihanItems, diskon, catatan
        );
        showToast(`✅ Tagihan Rp ${_fmtRp(result.total)} tersimpan`, 'success');
        closeModalTagihan();
        // Refresh riwayat jika ada
        if (typeof renderRiwayatList === 'function' && currentRiwayat) {
            renderRiwayatList(currentRiwayat, 'historyListMedis');
        }
    } catch(e) {
        showToast('❌ Gagal simpan tagihan: ' + (e.message || ''), 'error');
    }
}

async function simpanDanPrintTagihan() {
    await simpanTagihan();
    // Ambil tagihan yang baru disimpan, lalu print
    setTimeout(async () => {
        try {
            const tagihan = await sb_getTagihan(_tagihanKunjId);
            if (tagihan) printInvoice(tagihan, _tagihanPasienNama, _tagihanTgl);
        } catch(e) {}
    }, 600);
}

// ════════════════════════════════════════
//  LIHAT TAGIHAN DARI RIWAYAT
// ════════════════════════════════════════
async function lihatTagihanKunjungan(kunjunganId, pasienNama, tgl) {
    try {
        const tagihan = await sb_getTagihan(kunjunganId);
        if (!tagihan) {
            showToast('ℹ️ Belum ada tagihan untuk kunjungan ini', 'info');
            return;
        }
        _showInvoiceModal(tagihan, pasienNama, tgl);
    } catch(e) {
        showToast('❌ Gagal memuat tagihan', 'error');
    }
}

function _showInvoiceModal(tagihan, pasienNama, tgl) {
    let modal = document.getElementById('modalInvoiceView');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalInvoiceView';
        modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.5);overflow-y:auto;padding:12px;';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;max-width:520px;margin:0 auto;padding:0;box-shadow:0 8px 40px rgba(0,0,0,0.2);overflow:hidden;">
        ${_buildInvoiceHtml(tagihan, pasienNama, tgl, false)}
        <div style="padding:12px 18px 18px;display:flex;gap:8px;">
            <button onclick="printInvoice(${JSON.stringify(tagihan).replace(/"/g,'&quot;')}, '${escHtml(pasienNama)}', '${tgl}')"
                style="flex:1;padding:11px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
                🖨️ Print Invoice
            </button>
            <button onclick="document.getElementById('modalInvoiceView').style.display='none'"
                style="padding:11px 16px;background:#f1f5f9;color:var(--text);border:none;border-radius:10px;font-size:12px;cursor:pointer;">
                Tutup
            </button>
        </div>
    </div>`;
    modal.style.display = 'block';
}

// ════════════════════════════════════════
//  PRINT INVOICE
// ════════════════════════════════════════
function printInvoice(tagihan, pasienNama, tgl) {
    const klinikNama  = window.KLINIK_NAMA  || 'Klinik';
    const klinikAlamat = window._settingsFull?.klinik_alamat || '';
    const klinikTelp   = window._settingsFull?.klinik_telp   || '';

    const win = window.open('', '_blank', 'width=420,height=700');
    if (!win) return showToast('⚠️ Izinkan popup untuk print invoice', 'error');

    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice - ${escHtml(pasienNama)}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff; }
  .wrap { max-width:380px;margin:0 auto;padding:20px 16px; }
  .kop { text-align:center;border-bottom:2px solid #1e293b;padding-bottom:10px;margin-bottom:12px; }
  .kop h1 { font-size:16px;font-weight:800; }
  .kop p  { font-size:10px;color:#475569;margin-top:2px; }
  .inv-title { text-align:center;font-size:13px;font-weight:800;letter-spacing:2px;margin-bottom:10px;border:1.5px dashed #94a3b8;padding:5px;border-radius:4px; }
  .meta { display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10.5px;margin-bottom:12px; }
  .meta dt { color:#64748b;font-weight:600; }
  .meta dd { font-weight:700; }
  table { width:100%;border-collapse:collapse;margin-bottom:10px; }
  thead th { background:#f1f5f9;padding:5px 6px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px; }
  tbody td { padding:5px 6px;font-size:11px;border-bottom:1px solid #f1f5f9; }
  tbody td:last-child, thead th:last-child { text-align:right; }
  .subtotal-row td { font-weight:600;color:#475569; }
  .diskon-row td   { color:#dc2626; }
  .total-row  td   { font-size:13px;font-weight:900;color:#1d4ed8;border-top:2px solid #1e293b;border-bottom:none;padding-top:8px; }
  .footer { text-align:center;font-size:10px;color:#94a3b8;border-top:1px dashed #e2e8f0;margin-top:14px;padding-top:10px; }
  .status-badge { display:inline-block;background:#dcfce7;color:#166534;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:800;margin-left:8px; }
  @media print { @page { size:80mm auto;margin:0; } .wrap { padding:8px; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="kop">
    <h1>${escHtml(klinikNama)}</h1>
    ${klinikAlamat ? `<p>${escHtml(klinikAlamat)}</p>` : ''}
    ${klinikTelp   ? `<p>Telp: ${escHtml(klinikTelp)}</p>` : ''}
  </div>
  <div class="inv-title">INVOICE / KWITANSI <span class="status-badge">${escHtml(tagihan.status || 'Lunas')}</span></div>
  <dl class="meta">
    <dt>No. Tagihan</dt><dd>${String(tagihan.id || '').substring(0,8).toUpperCase()}</dd>
    <dt>Tanggal</dt><dd>${tgl ? formatTglIndo(tgl) : '—'}</dd>
    <dt>Pasien</dt><dd>${escHtml(pasienNama)}</dd>
    ${tagihan.catatan ? `<dt>Catatan</dt><dd>${escHtml(tagihan.catatan)}</dd>` : ''}
  </dl>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Harga</th><th>Total</th></tr></thead>
    <tbody>
      ${(tagihan.tagihan_item || []).map(i => `
      <tr>
        <td>${escHtml(i.nama_item)}${i.keterangan ? `<br><span style="font-size:9.5px;color:#94a3b8;">${escHtml(i.keterangan)}</span>` : ''}</td>
        <td>${i.jumlah}</td>
        <td>Rp ${_fmtRp(i.harga_satuan)}</td>
        <td>Rp ${_fmtRp(i.subtotal)}</td>
      </tr>`).join('')}
      <tr class="subtotal-row"><td colspan="3">Subtotal</td><td>Rp ${_fmtRp(tagihan.subtotal)}</td></tr>
      ${tagihan.diskon > 0 ? `<tr class="diskon-row"><td colspan="3">Diskon</td><td>- Rp ${_fmtRp(tagihan.diskon)}</td></tr>` : ''}
      <tr class="total-row"><td colspan="3">TOTAL</td><td>Rp ${_fmtRp(tagihan.total)}</td></tr>
    </tbody>
  </table>
  <div class="footer">
    <p>Terima kasih atas kepercayaan Anda</p>
    <p style="margin-top:4px;">Dicetak: ${new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
  </div>
</div>
<script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; }<\/script>
</body></html>`);
    win.document.close();
}

function _buildInvoiceHtml(tagihan, pasienNama, tgl, compact) {
    return `
    <div style="padding:18px 20px 4px;">
        <div style="font-size:15px;font-weight:800;color:var(--primary-dark);margin-bottom:2px;">🧾 Invoice Kunjungan</div>
        <div style="font-size:11px;color:var(--text-muted);">${escHtml(pasienNama)} · ${tgl ? formatTglIndo(tgl) : '—'}</div>
        <div style="display:inline-block;margin-top:6px;padding:2px 10px;border-radius:20px;font-size:10.5px;font-weight:800;
             background:${tagihan.status === 'Lunas' ? '#dcfce7' : '#fef3c7'};
             color:${tagihan.status === 'Lunas' ? '#166534' : '#92400e'};">
             ${escHtml(tagihan.status || 'Lunas')}
        </div>
    </div>
    <div style="padding:12px 18px;">
        ${(tagihan.tagihan_item || []).map(i => `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:12px;">
            <div>
                <span style="font-weight:600;">${escHtml(i.nama_item)}</span>
                ${i.keterangan ? `<span style="font-size:10px;color:var(--text-muted);"> · ${escHtml(i.keterangan)}</span>` : ''}
                <div style="font-size:10.5px;color:var(--text-muted);">Rp ${_fmtRp(i.harga_satuan)} × ${i.jumlah}</div>
            </div>
            <div style="font-weight:700;white-space:nowrap;">Rp ${_fmtRp(i.subtotal)}</div>
        </div>`).join('')}
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--text-muted);">
            <span>Subtotal</span><span>Rp ${_fmtRp(tagihan.subtotal)}</span>
        </div>
        ${tagihan.diskon > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#dc2626;"><span>Diskon</span><span>- Rp ${_fmtRp(tagihan.diskon)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;border-top:2px solid #e2e8f0;padding-top:8px;margin-top:6px;">
            <span style="font-size:14px;font-weight:800;">TOTAL</span>
            <span style="font-size:16px;font-weight:900;color:var(--primary);">Rp ${_fmtRp(tagihan.total)}</span>
        </div>
        ${tagihan.catatan ? `<div style="margin-top:8px;font-size:11px;color:var(--text-muted);">📝 ${escHtml(tagihan.catatan)}</div>` : ''}
    </div>`;
}

// ════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════
function _fmtRp(n) {
    return Number(n || 0).toLocaleString('id-ID');
}

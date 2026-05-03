// ════════════════════════════════════════════════════════
//  KLIKPRO RME — SUPABASE: MODUL STOK OBAT
//  Tabel: obat, resep_item
//  Dipisahkan dari supabase.js agar modular
// ════════════════════════════════════════════════════════

// ═══════════════════════════════════════
//  OBAT (Master Data)
// ═══════════════════════════════════════

/** Ambil semua obat, urut nama */
async function sb_getObat({ search = '', kategori = '' } = {}) {
    let path = 'obat?select=*&order=nama.asc';
    if (search)   path += `&nama=ilike.*${encodeURIComponent(search)}*`;
    if (kategori) path += `&kategori=eq.${encodeURIComponent(kategori)}`;
    return await _sbFetch(path);
}

/** Ambil satu obat by ID */
async function sb_getObatById(id) {
    const rows = await _sbFetch(`obat?id=eq.${id}&limit=1`);
    return rows[0] || null;
}

/** Simpan obat (insert atau update) */
async function sb_saveObat(payload) {
    const {
        id, nama, kategori, satuan, harga_beli, harga_jual,
        stok, stok_minimum, frekuensi_default, keterangan
    } = payload;

    const body = {
        nama:               (nama || '').trim(),
        kategori:           kategori || 'Umum',
        satuan:             satuan   || 'tablet',
        harga_beli:         harga_beli  ? Number(harga_beli)  : 0,
        harga_jual:         harga_jual  ? Number(harga_jual)  : 0,
        stok:               stok        ? Number(stok)        : 0,
        stok_minimum:       stok_minimum? Number(stok_minimum): 5,
        frekuensi_default:  frekuensi_default || '3x1',
        keterangan:         keterangan || null
    };

    if (id) {
        await _sbFetch(`obat?id=eq.${id}`, {
            method: 'PATCH', body, prefer: 'return=minimal'
        });
        return { status: 'success', id };
    } else {
        const rows = await _sbFetch('obat', {
            method: 'POST', body, prefer: 'return=representation'
        });
        return { status: 'success', id: rows[0]?.id };
    }
}

/** Hapus obat by ID */
async function sb_deleteObat(id) {
    await _sbFetch(`obat?id=eq.${id}`, {
        method: 'DELETE', prefer: 'return=minimal'
    });
    return { status: 'success' };
}

/** Kurangi stok setelah resep disimpan */
async function sb_kurangiStok(obatId, jumlah) {
    // Pakai RPC agar atomic (hindari race condition)
    // Fallback: PATCH langsung jika RPC belum tersedia
    try {
        await _sbFetch(`rpc/kurangi_stok_obat`, {
            method: 'POST',
            body: { p_obat_id: obatId, p_jumlah: Number(jumlah) }
        });
    } catch (e) {
        // Fallback manual: ambil stok sekarang lalu PATCH
        const obat = await sb_getObatById(obatId);
        if (obat) {
            const newStok = Math.max(0, (obat.stok || 0) - Number(jumlah));
            await _sbFetch(`obat?id=eq.${obatId}`, {
                method: 'PATCH',
                body: { stok: newStok },
                prefer: 'return=minimal'
            });
        }
    }
    return { status: 'success' };
}

/** Tambah stok (pembelian/restock) */
async function sb_tambahStok(obatId, jumlah, harga_beli_baru) {
    const obat = await sb_getObatById(obatId);
    if (!obat) throw new Error('Obat tidak ditemukan');
    const body = { stok: (obat.stok || 0) + Number(jumlah) };
    if (harga_beli_baru) body.harga_beli = Number(harga_beli_baru);
    await _sbFetch(`obat?id=eq.${obatId}`, {
        method: 'PATCH', body, prefer: 'return=minimal'
    });
    return { status: 'success' };
}

// ═══════════════════════════════════════
//  RESEP ITEM (per Kunjungan)
// ═══════════════════════════════════════

/** Ambil item resep untuk satu kunjungan */
async function sb_getResepByKunjungan(kunjunganId) {
    const rows = await _sbFetch(
        `resep_item?kunjungan_id=eq.${kunjunganId}&select=*,obat(id,nama,satuan,harga_jual)&order=created_at.asc`
    );
    return rows;
}

/** Simpan seluruh resep untuk satu kunjungan (replace semua) */
async function sb_saveResep(kunjunganId, items) {
    // Hapus resep lama untuk kunjungan ini
    await _sbFetch(`resep_item?kunjungan_id=eq.${kunjunganId}`, {
        method: 'DELETE', prefer: 'return=minimal'
    });

    if (!items || items.length === 0) return { status: 'success' };

    const rows = items.map(item => ({
        kunjungan_id:  kunjunganId,
        obat_id:       item.obat_id,
        nama_obat:     item.nama_obat,   // snapshot nama saat resep dibuat
        jumlah:        Number(item.jumlah) || 1,
        frekuensi:     item.frekuensi || '3x1',
        catatan:       item.catatan || null,
        harga_satuan:  Number(item.harga_satuan) || 0,
        subtotal:      (Number(item.jumlah) || 1) * (Number(item.harga_satuan) || 0)
    }));

    await _sbFetch('resep_item', {
        method: 'POST', body: rows, prefer: 'return=minimal'
    });

    // Kurangi stok untuk setiap item
    for (const item of rows) {
        if (item.obat_id) {
            await sb_kurangiStok(item.obat_id, item.jumlah).catch(() => {});
        }
    }

    return { status: 'success' };
}

/** Ambil daftar kategori obat yang ada */
async function sb_getKategoriObat() {
    const rows = await _sbFetch('obat?select=kategori&order=kategori.asc');
    const unique = [...new Set(rows.map(r => r.kategori).filter(Boolean))];
    return unique;
}

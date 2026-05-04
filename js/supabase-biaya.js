// ════════════════════════════════════════════════════════
//  KLIKPRO RME — SUPABASE: MODUL PEMBIAYAAN
//  Tabel: tarif_layanan, tagihan, tagihan_item
// ════════════════════════════════════════════════════════

// ═══════════════════════════════════════
//  TARIF LAYANAN (Master)
// ═══════════════════════════════════════

/** Ambil semua tarif layanan */
async function sb_getTarif() {
    return await _sbFetch('tarif_layanan?select=*&order=kategori.asc,nama.asc');
}

/** Simpan tarif (upsert by id) */
async function sb_saveTarif(payload) {
    const { id, nama, kategori, harga, keterangan, aktif } = payload;
    const body = {
        nama:       (nama || '').trim(),
        kategori:   kategori  || 'Umum',
        harga:      Number(harga) || 0,
        keterangan: keterangan || null,
        aktif:      aktif !== false
    };
    if (id) {
        await _sbFetch(`tarif_layanan?id=eq.${id}`, {
            method: 'PATCH', body, prefer: 'return=minimal'
        });
        return { status: 'success', id };
    } else {
        const rows = await _sbFetch('tarif_layanan', {
            method: 'POST', body, prefer: 'return=representation'
        });
        return { status: 'success', id: rows[0]?.id };
    }
}

/** Hapus tarif */
async function sb_deleteTarif(id) {
    await _sbFetch(`tarif_layanan?id=eq.${id}`, {
        method: 'DELETE', prefer: 'return=minimal'
    });
    return { status: 'success' };
}

// ═══════════════════════════════════════
//  TAGIHAN (per Kunjungan)
// ═══════════════════════════════════════

/** Ambil tagihan + item untuk satu kunjungan */
async function sb_getTagihan(kunjunganId) {
    const rows = await _sbFetch(
        `tagihan?kunjungan_id=eq.${kunjunganId}&select=*,tagihan_item(*)`
    );
    return rows[0] || null;
}

/** Buat atau update tagihan untuk kunjungan */
async function sb_saveTagihan(kunjunganId, pasienId, items, diskon, catatan) {
    // Hitung total
    const subtotal = items.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
    const nominalDiskon = Number(diskon) || 0;
    const total = Math.max(0, subtotal - nominalDiskon);

    // Cek apakah tagihan sudah ada
    const existing = await _sbFetch(
        `tagihan?kunjungan_id=eq.${kunjunganId}&select=id&limit=1`
    );

    let tagihanId;
    const tagihanBody = {
        kunjungan_id: kunjunganId,
        pasien_id:    pasienId,
        subtotal,
        diskon:       nominalDiskon,
        total,
        catatan:      catatan || null,
        status:       'Lunas'
    };

    if (existing.length > 0) {
        tagihanId = existing[0].id;
        await _sbFetch(`tagihan?id=eq.${tagihanId}`, {
            method: 'PATCH', body: tagihanBody, prefer: 'return=minimal'
        });
        // Hapus item lama
        await _sbFetch(`tagihan_item?tagihan_id=eq.${tagihanId}`, {
            method: 'DELETE', prefer: 'return=minimal'
        });
    } else {
        const rows = await _sbFetch('tagihan', {
            method: 'POST', body: tagihanBody, prefer: 'return=representation'
        });
        tagihanId = rows[0]?.id;
    }

    // Insert item baru
    if (items.length > 0 && tagihanId) {
        const itemRows = items.map(i => ({
            tagihan_id:   tagihanId,
            nama_item:    i.nama_item,
            kategori:     i.kategori  || 'Layanan',
            jumlah:       Number(i.jumlah) || 1,
            harga_satuan: Number(i.harga_satuan) || 0,
            subtotal:     (Number(i.jumlah) || 1) * (Number(i.harga_satuan) || 0),
            keterangan:   i.keterangan || null
        }));
        await _sbFetch('tagihan_item', {
            method: 'POST', body: itemRows, prefer: 'return=minimal'
        });
    }

    return { status: 'success', tagihanId, total };
}

/** Update status pembayaran tagihan */
async function sb_updateStatusTagihan(tagihanId, status) {
    await _sbFetch(`tagihan?id=eq.${tagihanId}`, {
        method: 'PATCH',
        body: { status },
        prefer: 'return=minimal'
    });
    return { status: 'success' };
}

/** Ambil semua tagihan untuk laporan keuangan */
async function sb_getLaporanTagihan(tglMulai, tglSelesai) {
    let path = `tagihan?select=*,tagihan_item(*),pasien(nama,nik)&order=created_at.desc`;
    if (tglMulai)   path += `&created_at=gte.${tglMulai}T00:00:00`;
    if (tglSelesai) path += `&created_at=lte.${tglSelesai}T23:59:59`;
    return await _sbFetch(path);
}

/** Auto-generate item tagihan dari data kunjungan */
async function sb_autoTagihanFromKunjungan(kunjunganId, kunjunganData) {
    // ── Normalisasi key: payload saveAll pakai key berbeda dari kunjungan DB ──
    // saveAll payload  → { diagnosa, suratSakit, td, nadi, suhu, lab_gds, ... }
    // kunjungan DB row → { diag, surat_sakit, td, nadi, suhu, lab_gds, ... }
    // Fungsi ini menerima KEDUANYA — normalisasi di sini agar tidak error
    const d = {
        td:           kunjunganData.td,
        nadi:         kunjunganData.nadi,
        suhu:         kunjunganData.suhu,
        rr:           kunjunganData.rr,
        bb:           kunjunganData.bb,
        tb:           kunjunganData.tb,
        // diagnosa: bisa dari payload saveAll ('diagnosa') atau dari DB row ('diag')
        diag:         kunjunganData.diagnosa  || kunjunganData.diag,
        // surat: bisa dari payload saveAll ('suratSakit') atau DB row ('surat_sakit')
        surat_sakit:  kunjunganData.suratSakit || kunjunganData.surat_sakit,
        // lab fields — nama konsisten di keduanya
        lab_gds:       kunjunganData.lab_gds,
        lab_chol:      kunjunganData.lab_chol,
        lab_ua:        kunjunganData.lab_ua,
        lab_hb:        kunjunganData.lab_hb,
        lab_trombosit: kunjunganData.lab_trombosit,
        lab_leukosit:  kunjunganData.lab_leukosit,
        lab_eritrosit: kunjunganData.lab_eritrosit,
        lab_hematokrit:kunjunganData.lab_hematokrit,
        lab_hiv:       kunjunganData.lab_hiv,
        lab_sifilis:   kunjunganData.lab_sifilis,
        lab_hepatitis: kunjunganData.lab_hepatitis,
        lab_hdl:       kunjunganData.lab_hdl,
        lab_ldl:       kunjunganData.lab_ldl,
        lab_tg:        kunjunganData.lab_tg,
        lab_gdp:       kunjunganData.lab_gdp,
        lab_hba1c:     kunjunganData.lab_hba1c,
        lab_sgot:      kunjunganData.lab_sgot,
        lab_sgpt:      kunjunganData.lab_sgpt,
        lab_ureum:     kunjunganData.lab_ureum,
        lab_creatinin: kunjunganData.lab_creatinin
    };

    // ── Helper: nilai dianggap "ada" jika bukan null/undefined/''/0/'—'/TIDAK ──
    const _ada = v => v !== null && v !== undefined && v !== '' && v !== '—' && v !== 'TIDAK' && v !== 0;

    // Ambil semua tarif aktif dari DB
    const tarif = await sb_getTarif();
    const _tarif = (kategori, nama) =>
        tarif.find(x => x.aktif && x.kategori === kategori && x.nama === nama);

    const items = [];
    const addItem = (nama_item, kategori, harga, jumlah = 1, ket = null) => {
        if (harga > 0) items.push({ nama_item, kategori, jumlah, harga_satuan: harga, keterangan: ket });
    };

    // ── 1. VITAL SIGN ──
    // Muncul jika salah satu TTV diisi (td, nadi, suhu, rr, bb, atau tb)
    const hasTtv = _ada(d.td) || _ada(d.nadi) || _ada(d.suhu) ||
                   _ada(d.rr) || _ada(d.bb)   || _ada(d.tb);
    if (hasTtv) {
        const t = _tarif('Pemeriksaan', 'Vital Sign');
        if (t) addItem('Pemeriksaan Vital Sign', 'Pemeriksaan', t.harga);
    }

    // ── 2. KONSULTASI MEDIS ──
    // Muncul jika ada diagnosa utama
    if (_ada(d.diag)) {
        const t = _tarif('Pemeriksaan', 'Konsultasi Medis');
        if (t) addItem('Konsultasi Medis', 'Pemeriksaan', t.harga);
    }

    // ── 3. PEMERIKSAAN FISIK ──
    // Muncul jika ada isi pemeriksaan fisik
    if (_ada(kunjunganData.fisik)) {
        const t = _tarif('Pemeriksaan', 'Pemeriksaan Fisik');
        if (t) addItem('Pemeriksaan Fisik', 'Pemeriksaan', t.harga);
    }

    // ── 4. LABORATORIUM — per item ──
    // Nama di tarif_layanan HARUS sama persis dengan kolom 'nama' di bawah
    const labFields = [
        { key: 'lab_gds',        nama: 'GDS' },
        { key: 'lab_chol',       nama: 'Kolesterol' },
        { key: 'lab_ua',         nama: 'Asam Urat' },
        { key: 'lab_hb',         nama: 'Hemoglobin (HB)' },
        { key: 'lab_trombosit',  nama: 'Trombosit' },
        { key: 'lab_leukosit',   nama: 'Leukosit' },
        { key: 'lab_eritrosit',  nama: 'Eritrosit' },
        { key: 'lab_hematokrit', nama: 'Hematokrit' },
        { key: 'lab_hiv',        nama: 'HIV' },
        { key: 'lab_sifilis',    nama: 'Sifilis' },
        { key: 'lab_hepatitis',  nama: 'Hepatitis B' },
        { key: 'lab_hdl',        nama: 'HDL' },
        { key: 'lab_ldl',        nama: 'LDL' },
        { key: 'lab_tg',         nama: 'Trigliserida' },
        { key: 'lab_gdp',        nama: 'GDP' },
        { key: 'lab_hba1c',      nama: 'HbA1c' },
        { key: 'lab_sgot',       nama: 'SGOT' },
        { key: 'lab_sgpt',       nama: 'SGPT' },
        { key: 'lab_ureum',      nama: 'Ureum' },
        { key: 'lab_creatinin',  nama: 'Creatinin' }
    ];

    labFields.forEach(f => {
        if (_ada(d[f.key])) {
            const t = _tarif('Laboratorium', f.nama);
            if (t) addItem('Lab: ' + f.nama, 'Laboratorium', t.harga);
        }
    });

    // ── 5. OBAT dari resep (jika modul stok aktif) ──
    // Resep sudah disimpan sebelum openModalTagihan dipanggil
    if (window._stokAktif) {
        try {
            const resepRows = await sb_getResepByKunjungan(kunjunganId);
            resepRows.forEach(r => {
                if (r.harga_satuan > 0) {
                    addItem(r.nama_obat, 'Obat', r.harga_satuan, r.jumlah, r.frekuensi);
                }
            });
        } catch(e) { /* resep kosong atau modul tidak aktif */ }
    }

    // ── 6. SURAT KETERANGAN ──
    // suratSakit dari payload saveAll = "YA"/"TIDAK"
    // surat_sakit dari DB row = "YA"/null
    if (d.surat_sakit === 'YA') {
        const t = _tarif('Administrasi', 'Surat Keterangan Sakit');
        if (t) addItem('Surat Keterangan Sakit', 'Administrasi', t.harga);
    }

    // ── 7. SURAT KETERANGAN SEHAT ──
    // Jika ada field terpisah di form — cek kunjunganData.surat_sehat
    if (kunjunganData.surat_sehat === 'YA') {
        const t = _tarif('Administrasi', 'Surat Keterangan Sehat');
        if (t) addItem('Surat Keterangan Sehat', 'Administrasi', t.harga);
    }

    return items;
}

// ════════════════════════════════════════════════════════
//  KLIKPRO RME — SUPABASE CLIENT
//  Menggantikan semua komunikasi ke Google Apps Script
// ════════════════════════════════════════════════════════

const _SB_URL = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
const _SB_KEY = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';

// ── Helper fetch ke Supabase REST API ──
async function _sbFetch(path, opts = {}) {
    const res = await fetch(_SB_URL + '/rest/v1/' + path, {
        headers: {
            'apikey':        _SB_KEY,
            'Authorization': 'Bearer ' + _SB_KEY,
            'Content-Type':  'application/json',
            'Prefer':        opts.prefer || 'return=representation',
            ...(opts.headers || {})
        },
        method: opts.method || 'GET',
        body:   opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Supabase error ' + res.status);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
}

// ═══════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════
async function sb_getSettings() {
    const rows = await _sbFetch('konfigurasi?select=key,value');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    const dokter = await _sbFetch('dokter?select=*');
    return { status: 'success', settings, dokter };
}

async function sb_saveSettings(payload) {
    const updates = [];
    const keys = ['klinik_nama','klinik_title','klinik_alamat','klinik_telp',
                   'klinik_email','jabatan_medis','ocr_api_key','ss_env',
                   'ss_org_id','ss_client_id','ss_client_secret',
                   'ai_gemini','ai_groq','ai_openrouter','ai_openai','ai_mistral',
                   'module_access'];
    for (const key of keys) {
        if (payload[key] === undefined) continue;
        if (key === 'ss_client_secret' && !payload[key]) continue;
        // FIX: Ganti PATCH ke UPSERT (POST + Prefer: resolution=merge-duplicates).
        // PATCH ke ?key=eq.xxx mengembalikan HTTP 200 dengan 0 rows affected jika key
        // belum ada di tabel konfigurasi — data tidak tersimpan tanpa ada error sama sekali.
        // UPSERT memastikan baris dibuat jika belum ada, atau diupdate jika sudah ada.
        updates.push(
            _sbFetch('konfigurasi', {
                method: 'POST',
                body: { key, value: payload[key] },
                prefer: 'resolution=merge-duplicates,return=minimal'
            })
        );
    }
    await Promise.all(updates);

    // BUG FIX: Perbaikan syntax DELETE dokter — path filter harus masuk ke URL, bukan headers
    if (payload.dokter) {
        const dokterList = JSON.parse(payload.dokter);
        // Hapus semua dokter yang ada
        await _sbFetch('dokter?id=neq.00000000-0000-0000-0000-000000000000', {
            method: 'DELETE',
            prefer: 'return=minimal'
        });
        if (dokterList.length > 0) {
            await _sbFetch('dokter', { method: 'POST', body: dokterList, prefer: 'return=minimal' });
        }
    }
    return { status: 'success' };
}

// ═══════════════════════════════════════
//  USERS & AUTH
// ═══════════════════════════════════════
async function sb_getUsers() {
    const data = await _sbFetch('users?select=id,nama,jabatan&order=nama.asc');
    return { status: 'success', data };
}

async function sb_verifyPin(userId, pin) {
    const hashed = await _sha256(pin);
    const rows = await _sbFetch(`users?id=eq.${userId}&pin_hash=eq.${hashed}&select=id,nama,jabatan`);
    if (rows.length > 0) {
        return { isValid: true, user: rows[0] };
    }
    return { isValid: false };
}

async function sb_saveUser(payload) {
    const { userId, nama, jabatan, pin } = payload;
    const pinHash = pin ? await _sha256(pin) : null;

    if (userId) {
        const body = {};
        if (pinHash) body.pin_hash = pinHash;
        if (nama)    body.nama     = nama;
        if (jabatan) body.jabatan  = jabatan;
        await _sbFetch(`users?id=eq.${userId}`, { method: 'PATCH', body, prefer: 'return=minimal' });
    } else {
        await _sbFetch('users', {
            method: 'POST',
            body: { nama, jabatan, pin_hash: pinHash },
            prefer: 'return=minimal'
        });
    }
    return { status: 'success' };
}

// SHA-256 untuk hash PIN di browser
async function _sha256(text) {
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ═══════════════════════════════════════
//  PASIEN
// ═══════════════════════════════════════
async function sb_initData(filterDate) {
    const [pasien, kunjungan] = await Promise.all([
        _sbFetch('pasien?select=id,nama,nik,jk,tgl_lahir,alamat&order=nama.asc'),
        _sbFetch(`kunjungan?tgl=eq.${filterDate}&select=*&order=waktu.asc`)
    ]);

    const hariIni = kunjungan.map(k => {
        const p = pasien.find(p => p.id === k.pasien_id) || {};
        return {
            id: k.id, pasienId: k.pasien_id,
            nama: p.nama || '', waktu: k.waktu, tgl: k.tgl,
            td: k.td, suhu: k.suhu, keluhan: k.keluhan,
            diag: k.diagnosa, status: k.status || 'Menunggu'
        };
    });

    return {
        pasien: pasien.map(p => ({
            id: p.id, nama: p.nama, nik: p.nik,
            jk: p.jk, tgl: p.tgl_lahir, alamat: p.alamat
        })),
        hariIni
    };
}

async function sb_checkAndUpsertPasien(payload) {
    const { nama, nik, tgl_lahir, jk, alamat, localDate, createVisitToday, localTime } = payload;

    let pasienRow = null;
    if (nik) {
        const rows = await _sbFetch(`pasien?nik=eq.${encodeURIComponent(nik)}&limit=1`);
        if (rows.length) pasienRow = rows[0];
    }
    if (!pasienRow) {
        // BUG G FIX: encodeURIComponent benar untuk spasi (%20) tapi karakter & dalam nama
        // harus di-encode agar tidak break query string. encodeURIComponent sudah handle ini
        // (& → %26), jadi tetap pakai encodeURIComponent namun pastikan nama di-trim dulu.
        const namaEncoded = encodeURIComponent((nama || '').trim());
        const rows = await _sbFetch(`pasien?nama=eq.${namaEncoded}&limit=1`);
        if (rows.length) pasienRow = rows[0];
    }

    if (!pasienRow) {
        const inserted = await _sbFetch('pasien', {
            method: 'POST',
            body: { nama, nik: nik||null, jk: jk||'L', tgl_lahir: tgl_lahir||null, alamat: alamat||null }
        });
        pasienRow = inserted[0];
    } else if (tgl_lahir || alamat) {
        await _sbFetch(`pasien?id=eq.${pasienRow.id}`, {
            method: 'PATCH',
            body: { ...(tgl_lahir && {tgl_lahir}), ...(alamat && {alamat}), ...(jk && {jk}), ...(nik && {nik}) },
            prefer: 'return=minimal'
        });
    }

    // ── Ambil atau buat kunjungan hari ini ──
    let kunjunganHariIni = null;
    if (createVisitToday && localDate) {
        const existing = await _sbFetch(
            `kunjungan?pasien_id=eq.${pasienRow.id}&tgl=eq.${localDate}&limit=1&select=*`
        );
        if (existing.length > 0) {
            // Kunjungan sudah ada — gunakan data yang ada (jangan buat baru)
            kunjunganHariIni = existing[0];
        } else {
            // Belum ada — buat baru
            const inserted = await _sbFetch('kunjungan', {
                method: 'POST',
                body: { pasien_id: pasienRow.id, tgl: localDate, waktu: localTime||'00:00', status: 'Menunggu' }
            });
            kunjunganHariIni = inserted[0];
        }
    }

    const riwayat = await _sbFetch(
        `kunjungan?pasien_id=eq.${pasienRow.id}&order=tgl.desc,waktu.desc&select=*`
    );

    // Mapper helper agar konsisten
    const _mapKunjungan = r => ({
        id: r.id, tgl: r.tgl, waktu: r.waktu,
        td: r.td, nadi: r.nadi, suhu: r.suhu, rr: r.rr,
        bb: r.bb, tb: r.tb,
        lab_gds: r.lab_gds, lab_chol: r.lab_chol, lab_ua: r.lab_ua,
        keluhan: r.keluhan, fisik: r.fisik,
        diag: r.diagnosa, diagnosa2: r.diagnosa2,
        terapi: r.terapi, surat_sakit: r.surat_sakit,
        status: r.status
    });

    return {
        pasien: {
            id: pasienRow.id, nama: pasienRow.nama, nik: pasienRow.nik,
            jk: pasienRow.jk, tgl_lahir: pasienRow.tgl_lahir, alamat: pasienRow.alamat
        },
        // kunjunganHariIni: data kunjungan aktif (lengkap) untuk di-populate ke form
        kunjunganHariIni: kunjunganHariIni ? _mapKunjungan(kunjunganHariIni) : null,
        riwayat: riwayat.map(_mapKunjungan)
    };
}

async function sb_savePasienOnly(payload) {
    const { pasienId, nama, nik, jk, tgl_lahir, alamat } = payload;
    if (pasienId) {
        await _sbFetch(`pasien?id=eq.${pasienId}`, {
            method: 'PATCH',
            body: { nama, nik, jk, tgl_lahir, alamat },
            prefer: 'return=minimal'
        });
        return { status: 'Sukses', pasienId };
    } else {
        const rows = await _sbFetch('pasien', { method: 'POST', body: { nama, nik, jk, tgl_lahir, alamat } });
        return { status: 'Sukses', pasienId: rows[0]?.id };
    }
}

// ═══════════════════════════════════════
//  KUNJUNGAN
// ═══════════════════════════════════════

// ── Ambil satu kunjungan lengkap by ID (untuk populate form pemeriksaan) ──
async function sb_getKunjunganById(kunjunganId) {
    const rows = await _sbFetch(`kunjungan?id=eq.${kunjunganId}&select=*&limit=1`);
    if (!rows.length) return null;
    const r = rows[0];
    return {
        id: r.id, pasien_id: r.pasien_id, tgl: r.tgl, waktu: r.waktu,
        td: r.td, nadi: r.nadi, suhu: r.suhu, rr: r.rr,
        bb: r.bb, tb: r.tb,
        lab_gds: r.lab_gds, lab_chol: r.lab_chol, lab_ua: r.lab_ua,
        keluhan: r.keluhan, fisik: r.fisik,
        diag: r.diagnosa, diagnosa2: r.diagnosa2,
        terapi: r.terapi, surat_sakit: r.surat_sakit,
        status: r.status
    };
}

async function sb_saveKunjungan(payload) {
    const {
        pasienId, kunjunganId, localDate, localTime,
        nama, nik, tgl_lahir, jk, alamat,
        td, nadi, rr, suhu, bb, tb,
        lab_gds, lab_chol, lab_ua,
        keluhan, fisik, diagnosa, diagnosa2, terapi, suratSakit
    } = payload;

    // BUG E FIX: Guard — jangan PATCH pasien jika pasienId tidak valid
    if (pasienId && pasienId !== 'null' && pasienId !== 'undefined') {
        await _sbFetch(`pasien?id=eq.${pasienId}`, {
            method: 'PATCH',
            body: { nama, nik, jk, ...(tgl_lahir && {tgl_lahir}), ...(alamat && {alamat}) },
            prefer: 'return=minimal'
        });
    }

    // BUG A FIX: Konversi string kosong '' ke null untuk kolom numerik di Supabase
    // Supabase menolak '' pada kolom INTEGER/NUMERIC — harus null
    const _num = v => (v === '' || v === null || v === undefined) ? null : v;

    const isSelesai = diagnosa && terapi;
    const body = {
        pasien_id: pasienId, tgl: localDate, waktu: localTime,
        td: td || null,
        nadi:     _num(nadi),
        rr:       _num(rr),
        suhu:     _num(suhu),
        bb:       _num(bb),
        tb:       _num(tb),
        lab_gds:  _num(lab_gds),
        lab_chol: _num(lab_chol),
        lab_ua:   _num(lab_ua),
        keluhan: keluhan || null,
        fisik:   fisik   || null,
        diagnosa:  diagnosa  || null,
        diagnosa2: diagnosa2 || null,
        terapi:    terapi    || null,
        surat_sakit: suratSakit || null,
        status: isSelesai ? 'Selesai' : 'Menunggu'
    };

    let kId = kunjunganId;
    if (kunjunganId) {
        await _sbFetch(`kunjungan?id=eq.${kunjunganId}`, {
            method: 'PATCH', body, prefer: 'return=minimal'
        });
    } else {
        const rows = await _sbFetch('kunjungan', { method: 'POST', body });
        kId = rows[0]?.id;
    }

    return { status: 'Sukses', kunjunganId: kId };
}

// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL AI REKOMENDASI DIAGNOSA
//  Menggunakan Gemini API untuk analisa klinis
//  ⚠️  Ganti GEMINI_API_KEY dengan API key Anda sendiri
//      https://aistudio.google.com/app/apikey
// ════════════════════════════════════════════════════════

const GEMINI_API_KEY = 'ISI_API_KEY_GEMINI_ANDA_DISINI';
const GEMINI_URL     = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY;

// ── TUTUP NOTIF AI ──
function tutupAINotif() {
    const notif = document.getElementById('aiNotif');
    if (notif) notif.style.display = 'none';
}

// ── KUMPULKAN DATA KLINIS DARI FORM ──
function _kumpulkanDataKlinis() {
    const get = id => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };

    const namaPasien = get('infoPasienNama') || document.getElementById('infoPasienNama')?.innerText || '';
    const umurText   = document.getElementById('infoPasienUmur')?.innerText || '';
    const jk         = get('jk') || (document.getElementById('jk')?.value) || '';
    const jkLabel    = jk === 'L' ? 'Laki-laki' : jk === 'P' ? 'Perempuan' : jk;

    // TTV
    const sistol  = get('sistol');
    const diastol = get('diastol');
    const nadi    = get('nadi');
    const suhu    = get('suhu');
    const rr      = get('rr');
    const bb      = get('bb');
    const tb      = get('tb');
    const tdStr   = (sistol || diastol) ? `${sistol||'?'}/${diastol||'?'} mmHg` : '-';

    // IMT
    let imtStr = '-';
    if (bb && tb) {
        const tbM = parseFloat(tb) / 100;
        const imt = (parseFloat(bb) / (tbM * tbM)).toFixed(1);
        const kat = imt < 18.5 ? 'Underweight' : imt < 25 ? 'Normal' : imt < 30 ? 'Overweight' : 'Obesitas';
        imtStr = `${imt} (${kat})`;
    }

    // Data klinis
    const keluhan = get('keluhan');
    const fisik   = get('fisik');

    return {
        umurText, jkLabel, tdStr,
        nadi: nadi || '-', suhu: suhu || '-',
        rr:   rr   || '-', bb:   bb   || '-',
        tb:   tb   || '-', imt:  imtStr,
        keluhan: keluhan || '-',
        fisik:   fisik   || '-'
    };
}

// ── SUSUN PROMPT UNTUK GEMINI ──
function _buatPrompt(data) {
    return `Kamu adalah asisten klinis dokter yang membantu memberikan rekomendasi diagnosa berdasarkan data anamnesis dan pemeriksaan. 

DATA PASIEN:
- Usia: ${data.umurText}
- Jenis Kelamin: ${data.jkLabel}

TANDA-TANDA VITAL:
- Tekanan Darah: ${data.tdStr}
- Nadi: ${data.nadi} x/mnt
- Suhu: ${data.suhu} °C
- Laju Napas (RR): ${data.rr} x/mnt
- Berat Badan: ${data.bb} kg | Tinggi: ${data.tb} cm | IMT: ${data.imt}

ANAMNESIS (Keluhan Utama):
${data.keluhan}

PEMERIKSAAN FISIK:
${data.fisik}

TUGAS:
Berikan 2-3 kemungkinan diagnosa yang paling relevan berdasarkan data di atas. Format jawaban HARUS seperti ini (jangan ada teks lain di luar format):

DIAGNOSA_1: [kode ICD-10 dan nama diagnosa]
DIAGNOSA_2: [kode ICD-10 dan nama diagnosa]
DIAGNOSA_3: [kode ICD-10 dan nama diagnosa, atau tulis TIDAK_ADA jika hanya ada 2]
ALASAN: [penjelasan singkat 1-2 kalimat mengapa diagnosa tersebut direkomendasikan]

Catatan: ini adalah alat bantu klinis, keputusan akhir tetap pada dokter. Gunakan kode ICD-10 yang umum dipakai di Indonesia.`;
}

// ── PARSE RESPONS GEMINI ──
function _parseResponGemini(teks) {
    const baris = teks.split('\n').map(b => b.trim()).filter(Boolean);
    const hasil = { diagnosa: [], alasan: '' };

    baris.forEach(b => {
        const matchD = b.match(/^DIAGNOSA_\d+:\s*(.+)$/i);
        const matchA = b.match(/^ALASAN:\s*(.+)$/i);
        if (matchD && matchD[1].trim().toUpperCase() !== 'TIDAK_ADA') {
            hasil.diagnosa.push(matchD[1].trim());
        }
        if (matchA) hasil.alasan = matchA[1].trim();
    });

    return hasil;
}

// ── TAMPILKAN HASIL KE NOTIF ──
function _tampilkanHasil(hasil) {
    const notif    = document.getElementById('aiNotif');
    const notifTxt = document.getElementById('aiNotifText');
    if (!notif || !notifTxt) return;

    if (hasil.diagnosa.length === 0) {
        notifTxt.innerHTML = `<span style="color:#ef4444;">⚠️ Data klinis belum cukup untuk analisa. Lengkapi keluhan & pemeriksaan fisik.</span>`;
    } else {
        const chips = hasil.diagnosa.map((d, i) => {
            // Klik chip → isi ke kolom diagnosa
            const target = i === 0 ? 'diagnosa' : 'diagnosa2';
            const safeD  = d.replace(/'/g, "\\'");
            return `<span class="ai-chip" onclick="isiDiagnosa('${target}','${safeD}')" title="Klik untuk mengisi kolom diagnosa">${d}</span>`;
        }).join('');

        notifTxt.innerHTML =
            `<div style="font-size:10px;font-weight:800;color:#4f46e5;letter-spacing:.5px;margin-bottom:4px;">✨ REKOMENDASI AI</div>` +
            `<div style="margin-bottom:6px;">${chips}</div>` +
            (hasil.alasan ? `<div style="font-size:10.5px;color:#4338ca;opacity:.85;border-top:1px dashed rgba(99,102,241,0.2);padding-top:5px;">${hasil.alasan}</div>` : '') +
            `<div style="font-size:9.5px;color:#6366f1;opacity:.6;margin-top:4px;">💡 Klik chip diagnosa untuk mengisi kolom</div>`;
    }

    notif.style.display = 'flex';
    notif.style.animation = 'none';
    setTimeout(() => { notif.style.animation = 'aiSlideIn .3s ease'; }, 10);
}

// ── ISI KOLOM DIAGNOSA DARI CHIP ──
function isiDiagnosa(targetId, nilai) {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.value = nilai;
    localStorage.setItem('rme_' + targetId, nilai);
    el.style.transition = 'background .3s';
    el.style.background = 'rgba(99,102,241,0.08)';
    setTimeout(() => { el.style.background = ''; }, 800);
    showToast(`✅ Diagnosa diisi: ${nilai.substring(0, 40)}...`, 'success');
}

// ── FUNGSI UTAMA: REKOMENDASI AI ──
async function rekomendasiAI() {
    // Cek API key
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'ISI_API_KEY_GEMINI_ANDA_DISINI') {
        const notif    = document.getElementById('aiNotif');
        const notifTxt = document.getElementById('aiNotifText');
        if (notif && notifTxt) {
            notifTxt.innerHTML = `<span style="color:#ef4444;">⚙️ <b>API Key belum diisi.</b> Edit file <code>ai-rekomendasi.js</code> dan isi <code>GEMINI_API_KEY</code> dengan key dari <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#6366f1;">Google AI Studio</a>.</span>`;
            notif.style.display = 'flex';
        }
        return;
    }

    // Cek data minimal
    const data = _kumpulkanDataKlinis();
    if (data.keluhan === '-' && data.fisik === '-') {
        showToast('⚠️ Isi Keluhan atau Pemeriksaan Fisik terlebih dahulu!', 'warning');
        return;
    }

    // Loading state
    const btn      = document.getElementById('btnAI');
    const btnIcon  = document.getElementById('btnAIIcon');
    const btnLabel = document.getElementById('btnAILabel');
    if (btn) btn.disabled = true;
    if (btnIcon)  btnIcon.innerHTML  = '<span style="display:inline-block;animation:spin .7s linear infinite">⏳</span>';
    if (btnLabel) btnLabel.textContent = 'Menganalisa...';

    // Sembunyikan notif lama
    const notif = document.getElementById('aiNotif');
    if (notif) notif.style.display = 'none';

    try {
        const prompt = _buatPrompt(data);
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature:     0.3,
                    maxOutputTokens: 400,
                    topP:            0.8
                }
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `HTTP ${res.status}`);
        }

        const json    = await res.json();
        const teksAI  = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!teksAI) throw new Error('Respons AI kosong');

        const hasil = _parseResponGemini(teksAI);
        _tampilkanHasil(hasil);

    } catch (e) {
        const notifTxt = document.getElementById('aiNotifText');
        if (notif && notifTxt) {
            notifTxt.innerHTML = `<span style="color:#ef4444;">❌ <b>Gagal:</b> ${e.message}. Cek koneksi & API key.</span>`;
            notif.style.display = 'flex';
        }
        showToast('❌ AI gagal dijalankan: ' + e.message, 'error');
    } finally {
        if (btn)     btn.disabled        = false;
        if (btnIcon)  btnIcon.textContent = '✨';
        if (btnLabel) btnLabel.textContent = 'Rekomendasi AI';
    }
}

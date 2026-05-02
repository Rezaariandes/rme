// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL AI REKOMENDASI DIAGNOSA
//  Sistem Multi-Provider dengan Auto-Fallback
//
//  CARA MENGISI API KEY:
//  1. Isi key pada provider yang Anda miliki
//  2. Kosongkan string ('') untuk provider yang tidak dipakai
//  3. Urutan provider = urutan prioritas fallback
//
//  DAFTAR PROVIDER & LINK DAFTAR KEY GRATIS:
//  ┌─────────────┬──────────────────────────────────────────────────┐
//  │ GEMINI      │ https://aistudio.google.com/app/apikey           │
//  │ GROQ        │ https://console.groq.com/keys                    │
//  │ OPENROUTER  │ https://openrouter.ai/keys  (akses 100+ model)   │
//  │ OPENAI      │ https://platform.openai.com/api-keys             │
//  │ MISTRAL     │ https://console.mistral.ai/api-keys              │
//  │ COHERE      │ https://dashboard.cohere.com/api-keys            │
//  └─────────────┴──────────────────────────────────────────────────┘
// ════════════════════════════════════════════════════════

const AI_PROVIDERS = [

    // ── GOOGLE GEMINI (Gratis, cepat) ──
    // Daftar: https://aistudio.google.com/app/apikey
    {
        nama:    'Gemini 2.0 Flash',
        enabled: true,
        keys: [
            'ISI_GEMINI_KEY_1_DISINI',
            'ISI_GEMINI_KEY_2_DISINI',
            'ISI_GEMINI_KEY_3_DISINI',
        ],
        call: async (apiKey, prompt) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 400, topP: 0.8 }
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
    },

    // ── GROQ (Gratis, sangat cepat — LLaMA & Mixtral) ──
    // Daftar: https://console.groq.com/keys
    {
        nama:    'Groq LLaMA 3.3',
        enabled: true,
        keys: [
            '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',
            'ISI_GROQ_KEY_2_DISINI',
            'ISI_GROQ_KEY_3_DISINI',
        ],
        call: async (apiKey, prompt) => {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 400
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.choices?.[0]?.message?.content || '';
        }
    },

    // ── OPENROUTER (Akses 100+ model, ada tier gratis) ──
    // Daftar: https://openrouter.ai/keys
    {
        nama:    'OpenRouter',
        enabled: true,
        keys: [
            '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',
            'ISI_OPENROUTER_KEY_2_DISINI',
        ],
        call: async (apiKey, prompt) => {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'Klikpro RME'
                },
                body: JSON.stringify({
                    model: 'meta-llama/llama-3.3-70b-instruct:free',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 400
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.choices?.[0]?.message?.content || '';
        }
    },

    // ── OPENAI (GPT-4o-mini, berbayar tapi murah) ──
    // Daftar: https://platform.openai.com/api-keys
    {
        nama:    'OpenAI GPT-4o-mini',
        enabled: true,
        keys: [
            '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',
            'ISI_OPENAI_KEY_2_DISINI',
        ],
        call: async (apiKey, prompt) => {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 400
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.choices?.[0]?.message?.content || '';
        }
    },

    // ── MISTRAL (Tier gratis tersedia) ──
    // Daftar: https://console.mistral.ai/api-keys
    {
        nama:    'Mistral Small',
        enabled: true,
        keys: [
            'ISI_MISTRAL_KEY_1_DISINI',
            'ISI_MISTRAL_KEY_2_DISINI',
        ],
        call: async (apiKey, prompt) => {
            const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'mistral-small-latest',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 400
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.choices?.[0]?.message?.content || '';
        }
    },

    // ── COHERE (Tier gratis tersedia) ──
    // Daftar: https://dashboard.cohere.com/api-keys
    {
        nama:    'Cohere Command-R',
        enabled: true,
        keys: [
            'ISI_COHERE_KEY_1_DISINI',
        ],
        call: async (apiKey, prompt) => {
            const res = await fetch('https://api.cohere.com/v2/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'command-r',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 400
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.message?.content?.[0]?.text || '';
        }
    }

];

// ════════════════════════════════════════════════════════
//  ENGINE: COBA SEMUA KEY & PROVIDER SECARA BERURUTAN
// ════════════════════════════════════════════════════════

async function _callAIWithFallback(prompt) {
    const errors = [];

    for (const provider of AI_PROVIDERS) {
        if (!provider.enabled) continue;

        // Filter key yang sudah diisi (bukan placeholder)
        const validKeys = (provider.keys || []).filter(
            k => k && k.trim() !== '' && !k.includes('_DISINI')
        );
        if (validKeys.length === 0) continue;

        for (const key of validKeys) {
            try {
                console.log(`[AI] Mencoba: ${provider.nama}...`);
                const teks = await provider.call(key, prompt);
                if (teks && teks.trim()) {
                    console.log(`[AI] Berhasil via: ${provider.nama}`);
                    return { teks, provider: provider.nama };
                }
                throw new Error('Respons kosong');
            } catch (e) {
                const msg = `${provider.nama}: ${e.message}`;
                errors.push(msg);
                console.warn(`[AI] Gagal (${msg}), mencoba berikutnya...`);
            }
        }
    }

    throw new Error('Semua provider AI gagal. Error: ' + errors.slice(-3).join(' | '));
}

// ════════════════════════════════════════════════════════
//  FUNGSI HELPER
// ════════════════════════════════════════════════════════

function tutupAINotif() {
    const notif = document.getElementById('aiNotif');
    if (notif) notif.style.display = 'none';
}

function _kumpulkanDataKlinis() {
    const get = id => {
        const el = document.getElementById(id);
        if (!el) return '';
        const val = (el.value !== undefined && el.value !== null) ? el.value : el.innerText;
        return val ? String(val).trim() : '';
    };

    const umurText = get('infoPasienUmur');
    const jk       = get('jk');
    const jkLabel  = jk === 'L' ? 'Laki-laki' : jk === 'P' ? 'Perempuan' : jk;

    const sistol  = get('sistol');
    const diastol = get('diastol');
    const nadi    = get('nadi');
    const suhu    = get('suhu');
    const rr      = get('rr');
    const bb      = get('bb');
    const tb      = get('tb');
    const tdStr   = (sistol || diastol) ? `${sistol||'?'}/${diastol||'?'} mmHg` : '-';

    let imtStr = '-';
    if (bb && tb) {
        const tbM = parseFloat(tb) / 100;
        const imt = (parseFloat(bb) / (tbM * tbM)).toFixed(1);
        const kat = imt < 18.5 ? 'Underweight' : imt < 25 ? 'Normal' : imt < 30 ? 'Overweight' : 'Obesitas';
        imtStr = `${imt} (${kat})`;
    }

    return {
        umurText, jkLabel, tdStr,
        nadi: nadi || '-', suhu: suhu || '-',
        rr:   rr   || '-', bb:   bb   || '-',
        tb:   tb   || '-', imt:  imtStr,
        keluhan: get('keluhan') || '-',
        fisik:   get('fisik')   || '-'
    };
}

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

function _parseResponAI(teks) {
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

function _tampilkanHasil(hasil, providerNama) {
    const notif    = document.getElementById('aiNotif');
    const notifTxt = document.getElementById('aiNotifText');
    if (!notif || !notifTxt) return;

    if (hasil.diagnosa.length === 0) {
        notifTxt.innerHTML = `<span style="color:#ef4444;">⚠️ Data klinis belum cukup untuk analisa. Lengkapi keluhan & pemeriksaan fisik.</span>`;
    } else {
        const chips = hasil.diagnosa.map((d, i) => {
            const target = i === 0 ? 'diagnosa' : 'diagnosa2';
            const safeD  = d.replace(/'/g, "\\'");
            return `<span class="ai-chip" onclick="isiDiagnosa('${target}','${safeD}')" title="Klik untuk mengisi kolom diagnosa">${d}</span>`;
        }).join('');

        notifTxt.innerHTML =
            `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">` +
                `<div style="font-size:10px;font-weight:800;color:#4f46e5;letter-spacing:.5px;">✨ REKOMENDASI AI</div>` +
                `<div style="font-size:9px;color:#94a3b8;font-weight:600;">via ${providerNama || 'AI'}</div>` +
            `</div>` +
            `<div style="margin-bottom:6px;">${chips}</div>` +
            (hasil.alasan ? `<div style="font-size:10.5px;color:#4338ca;opacity:.85;border-top:1px dashed rgba(99,102,241,0.2);padding-top:5px;">${hasil.alasan}</div>` : '') +
            `<div style="font-size:9.5px;color:#6366f1;opacity:.6;margin-top:4px;">💡 Klik chip diagnosa untuk mengisi kolom</div>`;
    }

    notif.style.display = 'flex';
    notif.style.animation = 'none';
    setTimeout(() => { notif.style.animation = 'aiSlideIn .3s ease'; }, 10);
}

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

// ════════════════════════════════════════════════════════
//  FUNGSI UTAMA: REKOMENDASI AI
// ════════════════════════════════════════════════════════

async function rekomendasiAI() {
    // Cek apakah ada minimal 1 key yang diisi
    const adaKey = AI_PROVIDERS.some(p =>
        p.enabled && (p.keys || []).some(k => k && k.trim() && !k.includes('_DISINI'))
    );

    if (!adaKey) {
        const notif    = document.getElementById('aiNotif');
        const notifTxt = document.getElementById('aiNotifText');
        if (notif && notifTxt) {
            notifTxt.innerHTML =
                `<span style="color:#ef4444;">⚙️ <b>Belum ada API Key.</b> Isi minimal 1 key di file <code>ai-rekomendasi.js</code>.<br>` +
                `Provider tersedia: Gemini · Groq · OpenRouter · OpenAI · Mistral · Cohere</span>`;
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
    if (btn)      btn.disabled         = true;
    if (btnIcon)  btnIcon.innerHTML    = '<span style="display:inline-block;animation:spin .7s linear infinite">⏳</span>';
    if (btnLabel) btnLabel.textContent = 'Menganalisa...';

    const notif = document.getElementById('aiNotif');
    if (notif) notif.style.display = 'none';

    try {
        const prompt             = _buatPrompt(data);
        const { teks, provider } = await _callAIWithFallback(prompt);
        const hasil              = _parseResponAI(teks);
        _tampilkanHasil(hasil, provider);

    } catch (e) {
        const notifTxt = document.getElementById('aiNotifText');
        if (notif && notifTxt) {
            notifTxt.innerHTML = `<span style="color:#ef4444;">❌ <b>Semua provider gagal.</b><br><small style="opacity:.8">${e.message}</small></span>`;
            notif.style.display = 'flex';
        }
        showToast('❌ Semua AI provider gagal', 'error');
    } finally {
        if (btn)      btn.disabled         = false;
        if (btnIcon)  btnIcon.textContent  = '✨';
        if (btnLabel) btnLabel.textContent = 'Rekomendasi AI';
    }
}

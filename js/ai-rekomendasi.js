// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL AI REKOMENDASI DIAGNOSA
//  Sistem Multi-Provider dengan Auto-Fallback
//
//  ⚠️  API KEY diisi di index.html (tidak di-push ke GitHub)
//      Cari bagian: const AI_KEYS = { ... }
// ════════════════════════════════════════════════════════

const AI_PROVIDERS = [

    // ── GOOGLE GEMINI (Gratis, cepat) ──
    {
        nama:    'Gemini 2.0 Flash',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.gemini : []; },
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
    {
        nama:    'Groq LLaMA 3.3',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.groq : []; },
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
    {
        nama:    'OpenRouter',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.openrouter : []; },
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
    {
        nama:    'OpenAI GPT-4o-mini',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.openai : []; },
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
    {
        nama:    'Mistral Small',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.mistral : []; },
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
    {
        nama:    'Cohere Command-R',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.cohere : []; },
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

// Cek apakah error adalah rate-limit / quota
function _isRateLimitError(msg) {
    return /quota|rate.?limit|429|too many|exceeded|retry/i.test(msg);
}

// Update teks loading di tombol AI
function _setAILoadingLabel(txt) {
    const el = document.getElementById('btnAILabel');
    if (el) el.textContent = txt;
}

async function _callAIWithFallback(prompt) {
    const errors   = [];
    let   anyKeyTried = false;

    for (const provider of AI_PROVIDERS) {
        if (!provider.enabled) continue;

        // Filter key yang sudah diisi (bukan placeholder)
        const validKeys = (provider.keys || []).filter(k => k && k.trim() !== '');
        if (validKeys.length === 0) continue;

        for (const key of validKeys) {
            anyKeyTried = true;
            try {
                _setAILoadingLabel('Mencoba ' + provider.nama + '...');
                console.log(`[AI] Mencoba: ${provider.nama}...`);
                const teks = await provider.call(key, prompt);
                if (teks && teks.trim()) {
                    console.log(`[AI] Berhasil via: ${provider.nama}`);
                    return { teks, provider: provider.nama };
                }
                throw new Error('Respons kosong');
            } catch (e) {
                const isLimit = _isRateLimitError(e.message);
                const msg     = `${provider.nama}${isLimit ? ' [quota]' : ''}: ${e.message.substring(0, 80)}`;
                errors.push(msg);
                console.warn(`[AI] Gagal (${provider.nama}), lanjut berikutnya...`);
                // Tidak perlu delay — langsung ke key/provider berikutnya
            }
        }
    }

    if (!anyKeyTried) {
        throw new Error(
            'Tidak ada API Key yang diisi. Buka file ai-rekomendasi.js dan isi minimal 1 key. ' +
            'Provider gratis: Groq (console.groq.com) · Gemini (aistudio.google.com) · OpenRouter (openrouter.ai)'
        );
    }

    throw new Error('Semua provider & key sudah dicoba tapi gagal. Detail: ' + errors.slice(-4).join(' | '));
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
        p.enabled && (p.keys || []).some(k => k && k.trim() !== '')
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

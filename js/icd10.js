// ════════════════════════════════════════════════════════
//  KLIKPRO RME — DATA ICD-10
//  Tambahkan kode diagnosa sesuai kebutuhan klinik
// ════════════════════════════════════════════════════════

const icd10Data = [
    // Infeksi & Parasit
    "A01.0 - Demam Tifoid",
    "A09 - Diare dan Gastroenteritis",
    "B01.9 - Varicella (Cacar Air)",

    // Endokrin & Metabolik
    "E11.9 - Diabetes Mellitus Tipe 2",
    "E78.5 - Hiperlipidemia (Kolesterol Tinggi)",

    // Mata
    "H10.9 - Konjungtivitis",

    // Kardiovaskular
    "I10 - Hipertensi Esensial (Primer)",

    // Saluran Napas
    "J00 - Acute Nasopharyngitis (Common Cold)",
    "J02.9 - Faringitis Akut",
    "J03.9 - Tonsilitis Akut",
    "J06.9 - ISPA Tidak Spesifik",
    "J11.1 - Influenza",
    "J45.9 - Asma Tidak Spesifik",

    // Pencernaan & Gigi
    "K04.0 - Pulpitis (Sakit Gigi)",
    "K29.7 - Gastritis (Asam Lambung)",
    "K30 - Dispepsia",

    // Kulit
    "L20.9 - Dermatitis Atopik",
    "L50.9 - Urtikaria (Biduran)",

    // Muskuloskeletal
    "M54.5 - Low Back Pain (LBP)",
    "M79.1 - Myalgia (Nyeri Otot)",

    // Saluran Kemih
    "N39.0 - Infeksi Saluran Kemih (ISK)",

    // Gejala Umum
    "R05 - Batuk (Cough)",
    "R50.9 - Demam (Fever)",
    "R51 - Nyeri Kepala (Headache)"
];

/** Mengisi datalist ICD-10 ke elemen dengan id tertentu */
function populateIcd10(datalistId) {
    const listEl = document.getElementById(datalistId);
    if (!listEl) return;
    icd10Data.forEach(diag => {
        const opt = document.createElement('option');
        opt.value = diag;
        listEl.appendChild(opt);
    });
}

const icd10Database = [
    { code: "A01.0", name: "Demam Tifoid (Tipes)" },
    { code: "A09", name: "Diare dan Gastroenteritis" },
    { code: "E11", name: "Diabetes Melitus Tipe 2" },
    { code: "I10", name: "Hipertensi Esensial" },
    { code: "J00", name: "Common Cold (Salesma)" },
    { code: "J06.9", name: "ISPA (Infeksi Saluran Pernapasan Akut)" },
    { code: "K30", name: "Dispepsia / Maag" },
    { code: "M54.5", name: "Low Back Pain (Nyeri Punggung Bawah)" },
    { code: "R51", name: "Cephalgia (Sakit Kepala)" },
    { code: "R50.9", name: "Febris (Demam) Unspecified" }
];

function populateICD10() {
    const datalist = document.getElementById('list-icd');
    if(!datalist) return;
    datalist.innerHTML = '';
    icd10Database.forEach(item => {
        let opt = document.createElement('option');
        opt.value = `${item.code} - ${item.name}`;
        datalist.appendChild(opt);
    });
}
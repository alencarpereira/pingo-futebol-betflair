// ===============================
// MODELO 3.0 PROFISSIONAL CALIBRADO
// ===============================

let chartGols = null;
let chartPlacares = null;

const EV_MINIMO = 0.05;
const MAX_GOALS = 8;
const MEDIA_LIGA = 2.4;

// ===============================
// HELPERS
// ===============================

function mean(arr) {
    const valid = arr.map(Number).filter(n => !isNaN(n));
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function getValues(selector) {
    return Array.from(document.querySelectorAll(selector))
        .map(i => parseFloat(i.value) || 0);
}

function factorial(n) {
    if (n <= 1) return 1;
    let f = 1;
    for (let i = 2; i <= n; i++) f *= i;
    return f;
}

function poisson(lambda, k) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function calcularEV(prob, odd) {
    if (!odd || odd <= 1) return -1;
    return (prob * odd) - 1;
}

function limitar(valor, min, max) {
    return Math.max(min, Math.min(max, valor));
}

// ===============================
// FAVORITISMO
// ===============================

function atualizarFavoritismo() {
    const favA = parseFloat(document.getElementById("favA").value) || 50;
    const favB = 100 - favA;
    document.getElementById("favB").value = favB;
}

// ===============================
// CALCULAR 3.0
// ===============================

function calcular() {

    const golsA = mean(getValues(".golsA"));
    const sofridosA = mean(getValues(".golsSofridosA"));
    const golsB = mean(getValues(".golsB"));
    const sofridosB = mean(getValues(".golsSofridosB"));

    // FORÇAS RELATIVAS
    const ataqueA = golsA / MEDIA_LIGA;
    const defesaA = sofridosA / MEDIA_LIGA;
    const ataqueB = golsB / MEDIA_LIGA;
    const defesaB = sofridosB / MEDIA_LIGA;

    // LAMBDAS MULTIPLICATIVOS
    let lambdaA = MEDIA_LIGA * ataqueA * defesaB;
    let lambdaB = MEDIA_LIGA * ataqueB * defesaA;

    lambdaA = limitar(lambdaA, 0.3, 2.8);
    lambdaB = limitar(lambdaB, 0.3, 2.8);

    // MATRIZ POISSON
    let probA = 0, probEmpate = 0, probB = 0;
    let probOver25 = 0, probUnder25 = 0, probBTTS = 0;

    for (let i = 0; i <= MAX_GOALS; i++) {
        for (let j = 0; j <= MAX_GOALS; j++) {

            const prob = poisson(lambdaA, i) * poisson(lambdaB, j);

            if (i > j) probA += prob;
            if (i === j) probEmpate += prob;
            if (j > i) probB += prob;

            if (i + j >= 3) probOver25 += prob;
            else probUnder25 += prob;

            if (i > 0 && j > 0) probBTTS += prob;
        }
    }

    // ===============================
    // CALIBRAÇÃO COM MERCADO
    // ===============================

    const oddCasa = parseFloat(document.getElementById("mercadoCasa").value);
    const oddEmpate = parseFloat(document.getElementById("mercadoEmpate").value);
    const oddVisit = parseFloat(document.getElementById("mercadoVisitante").value);

    const probMercCasa = 1 / oddCasa;
    const probMercEmp = 1 / oddEmpate;
    const probMercVis = 1 / oddVisit;

    // Mistura 75% modelo + 25% mercado
    probA = 0.75 * probA + 0.25 * probMercCasa;
    probEmpate = 0.75 * probEmpate + 0.25 * probMercEmp;
    probB = 0.75 * probB + 0.25 * probMercVis;

    // NORMALIZA
    const soma = probA + probEmpate + probB;
    probA /= soma;
    probEmpate /= soma;
    probB /= soma;

    // LIMITADOR ZEBRA
    if (oddVisit >= 4) {
        probB = limitar(probB, 0, 0.35);
    }

    // LIMITADOR DIFERENÇA
    if (Math.abs(probA - probB) > 0.45) {
        const media = (probA + probB) / 2;
        probA = media + 0.225;
        probB = media - 0.225;
    }

    // ===============================
    // MERCADOS
    // ===============================

    const mercados = [
        { nome: "Vitória Casa", prob: probA, odd: oddCasa },
        { nome: "Empate", prob: probEmpate, odd: oddEmpate },
        { nome: "Vitória Visitante", prob: probB, odd: oddVisit },
        { nome: "Over 2.5", prob: probOver25, odd: parseFloat(document.getElementById("mercadoOver").value) },
        { nome: "Under 2.5", prob: probUnder25, odd: parseFloat(document.getElementById("mercadoUnder").value) },
        { nome: "BTTS", prob: probBTTS, odd: parseFloat(document.getElementById("mercadoBTTS").value) }
    ];

    let melhor = null;

    mercados.forEach(m => {
        if (m.odd && m.odd > 1) {
            m.ev = calcularEV(m.prob, m.odd);
            if (!melhor || m.ev > melhor.ev) melhor = m;
        }
    });

    // ===============================
    // OUTPUT
    // ===============================

    let resultado = `
        <h3>📊 Probabilidades Ajustadas 3.0</h3>
        <p>Vitória Casa: ${(probA * 100).toFixed(1)}%</p>
        <p>Empate: ${(probEmpate * 100).toFixed(1)}%</p>
        <p>Vitória Visitante: ${(probB * 100).toFixed(1)}%</p>
        <hr>
        <p>Over 2.5: ${(probOver25 * 100).toFixed(1)}%</p>
        <p>Under 2.5: ${(probUnder25 * 100).toFixed(1)}%</p>
        <p>BTTS: ${(probBTTS * 100).toFixed(1)}%</p>
    `;

    if (melhor && melhor.ev >= EV_MINIMO) {
        resultado += `
            <hr>
            <h3>🎯 Melhor Aposta</h3>
            <p>${melhor.nome}</p>
            <p>Odd: ${melhor.odd}</p>
            <p>EV: ${(melhor.ev * 100).toFixed(2)}%</p>
        `;
    } else {
        resultado += `<hr><h3>🔴 Sem Value ≥5%</h3>`;
    }

    document.getElementById("resultado").innerHTML = resultado;
}

// ===============================
// PREENCHER EXEMPLO
// ===============================

function preencherExemplo() {

    document.getElementById("mercadoCasa").value = 1.80;
    document.getElementById("mercadoEmpate").value = 3.50;
    document.getElementById("mercadoVisitante").value = 4.50;
    document.getElementById("mercadoOver").value = 2.00;
    document.getElementById("mercadoUnder").value = 1.80;
    document.getElementById("mercadoBTTS").value = 1.95;

    const preencher = (classe, valores) => {
        document.querySelectorAll(classe).forEach((el, i) => {
            el.value = valores[i] || 0;
        });
    };

    preencher(".golsA", [2, 1, 2, 1, 3]);
    preencher(".golsSofridosA", [1, 1, 0, 2, 1]);
    preencher(".golsB", [1, 0, 1, 1, 2]);
    preencher(".golsSofridosB", [2, 1, 2, 1, 2]);
}

// ===============================
// LIMPAR
// ===============================

function limpar() {
    document.querySelectorAll("input").forEach(input => {
        if (!input.disabled) input.value = "";
    });
    document.getElementById("resultado").innerHTML = "";
}







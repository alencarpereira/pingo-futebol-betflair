// ===============================
// CONFIG PROFISSIONAL 5.0
// ===============================
let chartGols = null;
let chartPlacares = null;

const MAX_GOALS = 10;
const MEDIA_LIGA = 2.4;
const PESO_MERCADO = 0.15;

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

// ===============================
// EV DINÂMICO POR FAIXA DE ODD
// ===============================
function evMinimoPorOdd(odd) {

    if (odd >= 1.55 && odd <= 1.85) return 0.08; // 8%
    if (odd > 1.85 && odd <= 2.50) return 0.05;  // 5%
    if (odd > 2.50 && odd <= 4.20) return 0.03;  // 3%

    return 0.99; // bloqueia fora da faixa
}

function classificarEV(ev) {
    if (ev > 0.12) return { texto: "🟢 VALUE MUITO FORTE", cor: "green" };
    if (ev > 0.08) return { texto: "🟢 VALUE FORTE", cor: "green" };
    if (ev > 0.05) return { texto: "🟡 VALUE MODERADA", cor: "orange" };
    if (ev > 0.03) return { texto: "🟠 VALUE LEVE", cor: "orange" };
    return { texto: "🔴 SEM VALOR", cor: "red" };
}

// ===============================
// FAVORITISMO
// ===============================
function atualizarFavoritismo() {
    const favA = parseFloat(document.getElementById("favA")?.value) || 50;
    const favB = 100 - favA;

    const favBInput = document.getElementById("favB");
    if (favBInput) favBInput.value = favB;

    const favText = document.getElementById("favValores");
    if (favText)
        favText.innerText = `Time A: ${favA}% — Time B: ${favB}%`;
}

// ===============================
// CALCULAR MODELO
// ===============================
function calcular() {

    const golsA = mean(getValues(".golsA"));
    const sofridosA = mean(getValues(".golsSofridosA"));
    const golsB = mean(getValues(".golsB"));
    const sofridosB = mean(getValues(".golsSofridosB"));
    const h2hA = mean(getValues(".h2hA"));
    const h2hB = mean(getValues(".h2hB"));

    const favA = (parseFloat(document.getElementById("favA")?.value) || 50) / 100;
    const favB = 1 - favA;

    let lambdaA = (golsA + sofridosB) / 2;
    let lambdaB = (golsB + sofridosA) / 2;

    lambdaA *= (0.9 + favA * 0.2);
    lambdaB *= (0.9 + favB * 0.2);

    if (h2hA > 0 || h2hB > 0) {
        lambdaA = (lambdaA * 0.9) + (h2hA * 0.1);
        lambdaB = (lambdaB * 0.9) + (h2hB * 0.1);
    }

    const mediaAtual = lambdaA + lambdaB;
    const fatorShrink = MEDIA_LIGA / (mediaAtual || 1);

    lambdaA *= (0.7 + 0.3 * fatorShrink);
    lambdaB *= (0.7 + 0.3 * fatorShrink);

    // CALIBRAÇÃO MERCADO
    const oddCasa = parseFloat(document.getElementById("mercadoCasa")?.value);
    const oddVisitante = parseFloat(document.getElementById("mercadoVisitante")?.value);

    if (oddCasa > 1 && oddVisitante > 1) {

        const probMercadoCasa = 1 / oddCasa;
        const probMercadoVisitante = 1 / oddVisitante;
        const soma = probMercadoCasa + probMercadoVisitante;

        const ajusteCasa = probMercadoCasa / soma;
        const ajusteVisitante = probMercadoVisitante / soma;

        lambdaA *= (1 - PESO_MERCADO + PESO_MERCADO * ajusteCasa * 2);
        lambdaB *= (1 - PESO_MERCADO + PESO_MERCADO * ajusteVisitante * 2);
    }

    lambdaA = Math.max(lambdaA, 0.25);
    lambdaB = Math.max(lambdaB, 0.25);

    // MATRIZ
    let matriz = [];
    let somaTotal = 0;

    for (let i = 0; i <= MAX_GOALS; i++) {
        for (let j = 0; j <= MAX_GOALS; j++) {
            const prob = poisson(lambdaA, i) * poisson(lambdaB, j);
            matriz.push({ i, j, prob });
            somaTotal += prob;
        }
    }

    matriz = matriz.map(p => ({ ...p, prob: p.prob / somaTotal }));

    let probOver25 = 0, probUnder25 = 0, probBTTS = 0;
    let probA = 0, probEmpate = 0, probB = 0;

    matriz.forEach(p => {
        if (p.i + p.j >= 3) probOver25 += p.prob;
        else probUnder25 += p.prob;

        if (p.i > 0 && p.j > 0) probBTTS += p.prob;

        if (p.i > p.j) probA += p.prob;
        if (p.i === p.j) probEmpate += p.prob;
        if (p.j > p.i) probB += p.prob;
    });

    const expectativaGols = lambdaA + lambdaB;

    const mercados = [
        { nome: "Vitória Casa", prob: probA, odd: oddCasa },
        { nome: "Empate", prob: probEmpate, odd: parseFloat(document.getElementById("mercadoEmpate")?.value) },
        { nome: "Vitória Visitante", prob: probB, odd: oddVisitante },
        { nome: "Over 2.5", prob: probOver25, odd: parseFloat(document.getElementById("mercadoOver")?.value) },
        { nome: "Under 2.5", prob: probUnder25, odd: parseFloat(document.getElementById("mercadoUnder")?.value) },
        { nome: "BTTS", prob: probBTTS, odd: parseFloat(document.getElementById("mercadoBTTS")?.value) }
    ];

    let apostasFiltradas = mercados.filter(m => {

        if (!m.odd || m.odd <= 1) return false;

        const ev = calcularEV(m.prob, m.odd);
        const evMin = evMinimoPorOdd(m.odd);

        if (m.prob < 0.48) return false;
        if (ev < evMin) return false;

        m.ev = ev;
        return true;
    });

    apostasFiltradas.sort((a, b) => b.ev - a.ev);
    const melhor = apostasFiltradas.length ? apostasFiltradas[0] : null;

    let blocoProb = `
        <h3>📊 Probabilidades do Modelo</h3>
        <p>Vitória A: ${(probA * 100).toFixed(1)}%</p>
        <p>Empate: ${(probEmpate * 100).toFixed(1)}%</p>
        <p>Vitória B: ${(probB * 100).toFixed(1)}%</p>
        <hr>
        <p>Over 2.5: ${(probOver25 * 100).toFixed(1)}%</p>
        <p>Under 2.5: ${(probUnder25 * 100).toFixed(1)}%</p>
        <p>BTTS: ${(probBTTS * 100).toFixed(1)}%</p>
        <hr>
        <p><strong>Expectativa de Gols:</strong> ${expectativaGols.toFixed(2)}</p>
    `;

    let blocoAposta = `<h3 style="color:red;">🔴 SEM VALUE</h3>`;

    if (melhor) {
        const classificacao = classificarEV(melhor.ev);

        blocoAposta = `
            <h3 style="color:${classificacao.cor};">🎯 MELHOR APOSTA</h3>
            <p><strong>${melhor.nome}</strong></p>
            <p>Probabilidade Modelo: ${(melhor.prob * 100).toFixed(1)}%</p>
            <p>Odd Mercado: ${melhor.odd}</p>
            <p>EV: ${(melhor.ev * 100).toFixed(2)}%</p>
            <p><strong>${classificacao.texto}</strong></p>
        `;
    }

    document.getElementById("resultado").innerHTML = blocoProb + "<hr>" + blocoAposta;
}

// ===============================
// PREENCHER EXEMPLO
// ===============================
function preencherExemplo() {

    document.getElementById("favA").value = 55;
    atualizarFavoritismo();

    document.getElementById("mercadoCasa").value = 2.10;
    document.getElementById("mercadoEmpate").value = 3.20;
    document.getElementById("mercadoVisitante").value = 3.50;
    document.getElementById("mercadoOver").value = 2.00;
    document.getElementById("mercadoUnder").value = 1.80;
    document.getElementById("mercadoBTTS").value = 1.95;

    const preencher = (classe, valores) => {
        document.querySelectorAll(classe).forEach((el, i) => {
            el.value = valores[i] ?? "";
        });
    };

    preencher(".golsA", [2, 1, 3, 1, 2]);
    preencher(".golsSofridosA", [1, 0, 2, 1, 1]);
    preencher(".golsB", [1, 2, 0, 1, 1]);
    preencher(".golsSofridosB", [2, 1, 1, 2, 2]);
    preencher(".h2hA", [1, 1, 2, 0, 1]);
    preencher(".h2hB", [1, 0, 1, 1, 1]);
}

// ===============================
// LIMPAR
// ===============================
function limpar() {

    document.querySelectorAll("input").forEach(input => {
        if (!input.disabled) input.value = "";
    });

    document.getElementById("favA").value = 50;
    atualizarFavoritismo();

    document.getElementById("resultado").innerHTML = "";
}

window.onload = atualizarFavoritismo;







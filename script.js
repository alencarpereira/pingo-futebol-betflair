// ===============================
// CONFIG PROFISSIONAL 3.0
// ===============================
let chartGols = null;
let chartPlacares = null;

const EV_MINIMO = 0.05;
const MAX_GOALS = 10;
const MEDIA_LIGA = 2.4;
const PESO_MERCADO = 0.15; // quanto o mercado influencia (0.10 a 0.20 ideal)

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

function classificarEV(ev) {
    if (ev > 0.12) return { texto: "🟢 VALUE MUITO FORTE", cor: "green" };
    if (ev > 0.08) return { texto: "🟢 VALUE FORTE", cor: "green" };
    if (ev > 0.05) return { texto: "🟡 VALUE MODERADA", cor: "orange" };
    return { texto: "🔴 SEM VALOR", cor: "red" };
}

// ===============================
// FAVORITISMO
// ===============================
function atualizarFavoritismo() {
    const favA = parseFloat(document.getElementById("favA").value) || 50;
    const favB = 100 - favA;

    document.getElementById("favB").value = favB;
    document.getElementById("favValores").innerText =
        `Time A: ${favA}% — Time B: ${favB}%`;
}

// ===============================
// CALCULAR MODELO 3.0
// ===============================
function calcular() {

    const golsA = mean(getValues(".golsA"));
    const sofridosA = mean(getValues(".golsSofridosA"));
    const golsB = mean(getValues(".golsB"));
    const sofridosB = mean(getValues(".golsSofridosB"));
    const h2hA = mean(getValues(".h2hA"));
    const h2hB = mean(getValues(".h2hB"));

    const favA = (parseFloat(document.getElementById("favA").value) || 50) / 100;
    const favB = 1 - favA;

    // ===============================
    // LAMBDAS BASE
    // ===============================
    let lambdaA = (golsA + sofridosB) / 2;
    let lambdaB = (golsB + sofridosA) / 2;

    // Ajuste favoritismo suave
    lambdaA *= (0.9 + favA * 0.2);
    lambdaB *= (0.9 + favB * 0.2);

    // H2H leve (10%)
    if (h2hA > 0 || h2hB > 0) {
        lambdaA = (lambdaA * 0.90) + (h2hA * 0.10);
        lambdaB = (lambdaB * 0.90) + (h2hB * 0.10);
    }

    // Shrink para média da liga
    const mediaAtual = lambdaA + lambdaB;
    const fatorShrink = MEDIA_LIGA / (mediaAtual || 1);
    lambdaA *= (0.7 + 0.3 * fatorShrink);
    lambdaB *= (0.7 + 0.3 * fatorShrink);

    // ===============================
    // CALIBRAÇÃO PELO MERCADO (NOVO)
    // ===============================
    const oddCasa = parseFloat(document.getElementById("mercadoCasa").value);
    const oddVisitante = parseFloat(document.getElementById("mercadoVisitante").value);

    if (oddCasa > 1 && oddVisitante > 1) {

        const probMercadoCasa = (1 / oddCasa);
        const probMercadoVisitante = (1 / oddVisitante);
        const soma = probMercadoCasa + probMercadoVisitante;

        const ajusteCasa = probMercadoCasa / soma;
        const ajusteVisitante = probMercadoVisitante / soma;

        lambdaA *= (1 - PESO_MERCADO + PESO_MERCADO * ajusteCasa * 2);
        lambdaB *= (1 - PESO_MERCADO + PESO_MERCADO * ajusteVisitante * 2);
    }

    lambdaA = Math.max(lambdaA, 0.25);
    lambdaB = Math.max(lambdaB, 0.25);

    // ===============================
    // MATRIZ POISSON
    // ===============================
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

    let probOver25 = 0;
    let probUnder25 = 0;
    let probBTTS = 0;
    let probA = 0;
    let probEmpate = 0;
    let probB = 0;

    matriz.forEach(p => {
        if (p.i + p.j >= 3) probOver25 += p.prob;
        else probUnder25 += p.prob;

        if (p.i > 0 && p.j > 0) probBTTS += p.prob;

        if (p.i > p.j) probA += p.prob;
        if (p.i === p.j) probEmpate += p.prob;
        if (p.j > p.i) probB += p.prob;
    });

    // Teto anti-distorção
    probUnder25 = Math.min(probUnder25, 0.72);
    probOver25 = Math.min(probOver25, 0.72);
    probA = Math.min(probA, 0.75);
    probB = Math.min(probB, 0.75);

    const expectativaGols = lambdaA + lambdaB;

    // ===============================
    // MERCADOS
    // ===============================
    const mercados = [
        { nome: "Vitória Casa", prob: probA, odd: oddCasa },
        { nome: "Empate", prob: probEmpate, odd: parseFloat(document.getElementById("mercadoEmpate").value) },
        { nome: "Vitória Visitante", prob: probB, odd: oddVisitante },
        { nome: "Over 2.5", prob: probOver25, odd: parseFloat(document.getElementById("mercadoOver").value) },
        { nome: "Under 2.5", prob: probUnder25, odd: parseFloat(document.getElementById("mercadoUnder").value) },
        { nome: "BTTS", prob: probBTTS, odd: parseFloat(document.getElementById("mercadoBTTS").value) }
    ];

    let apostas = [];

    mercados.forEach(m => {
        if (m.odd && m.odd > 1) {
            m.ev = calcularEV(m.prob, m.odd);

            if (m.nome === "Over 2.5" && expectativaGols < 2.1) return;
            if (m.nome === "Under 2.5" && expectativaGols > 2.9) return;

            apostas.push(m);
        }
    });

    // ===============================
    // FILTRO PROFISSIONAL DE SAÍDA
    // ===============================
    let apostasFiltradas = apostas.filter(m => {

        if (!m.odd || m.odd <= 1) return false;

        // 1️⃣ Probabilidade mínima
        if (m.prob < 0.45) return false;

        // 2️⃣ EV mínimo
        if (m.ev < EV_MINIMO) return false;

        // 3️⃣ Faixa de odd permitida
        if (m.odd < 1.50 || m.odd > 4.50) return false;

        return true;
    });

    // Ordena pelo maior EV apenas entre as filtradas
    apostasFiltradas.sort((a, b) => b.ev - a.ev);

    const melhor = apostasFiltradas.length ? apostasFiltradas[0] : null;

    // ===============================
    // OUTPUT
    // ===============================
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

    let blocoAposta = `
        <h3 style="color:red;">🔴 SEM VALUE</h3>
        <p>Nenhuma aposta com vantagem ≥ 5%</p>
    `;

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

    document.getElementById("resultado").innerHTML =
        blocoProb + "<hr>" + blocoAposta;
}

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
            el.value = valores[i] || 0;
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
// LIMPAR CAMPOS
// ===============================
function limpar() {

    // limpa todos os inputs que não são disabled
    document.querySelectorAll("input").forEach(input => {
        if (!input.disabled) {
            input.value = "";
        }
    });

    // reseta favoritismo
    document.getElementById("favA").value = 50;
    atualizarFavoritismo();

    // limpa resultado
    const resultado = document.getElementById("resultado");
    if (resultado) resultado.innerHTML = "";
}

window.onload = atualizarFavoritismo;







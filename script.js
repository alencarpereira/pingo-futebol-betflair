// ===============================
// CONFIG
// ===============================
let chartGols = null;
let chartPlacares = null;
const EV_MINIMO = 0.03; // mínimo 3%
const MAX_GOALS = 10;

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
    if (ev > 0.08) return { texto: "🟢 VALUE FORTE", cor: "green" };
    if (ev > 0.05) return { texto: "🟡 VALUE BOA", cor: "orange" };
    if (ev > 0.03) return { texto: "⚪ VALUE LEVE", cor: "gray" };
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
// CALCULAR
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

    let lambdaA = ((golsA + sofridosB) / 2) * (0.75 + favA * 0.5);
    let lambdaB = ((golsB + sofridosA) / 2) * (0.75 + favB * 0.5);

    // Peso confronto direto
    if (h2hA > 0 || h2hB > 0) {
        lambdaA = (lambdaA * 0.85) + (h2hA * 0.15);
        lambdaB = (lambdaB * 0.85) + (h2hB * 0.15);
    }

    lambdaA = Math.max(lambdaA, 0.2);
    lambdaB = Math.max(lambdaB, 0.2);

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

    const expectativaGols = lambdaA + lambdaB;

    // ===============================
    // ODDS
    // ===============================
    const mercados = [
        { nome: "Vitória Casa", prob: probA, odd: parseFloat(document.getElementById("mercadoCasa").value) },
        { nome: "Empate", prob: probEmpate, odd: parseFloat(document.getElementById("mercadoEmpate").value) },
        { nome: "Vitória Visitante", prob: probB, odd: parseFloat(document.getElementById("mercadoVisitante").value) },
        { nome: "Over 2.5", prob: probOver25, odd: parseFloat(document.getElementById("mercadoOver").value) },
        { nome: "Under 2.5", prob: probUnder25, odd: parseFloat(document.getElementById("mercadoUnder").value) },
        { nome: "BTTS", prob: probBTTS, odd: parseFloat(document.getElementById("mercadoBTTS").value) }
    ];

    let apostas = [];

    mercados.forEach(m => {
        if (m.odd && m.odd > 1) {
            m.ev = calcularEV(m.prob, m.odd);

            // FILTRO INTELIGENTE
            if (m.nome === "Over 2.5" && expectativaGols < 2.2) return;
            if (m.nome === "Under 2.5" && expectativaGols > 2.8) return;

            apostas.push(m);
        }
    });

    apostas.sort((a, b) => b.ev - a.ev);

    const melhor = apostas.length ? apostas[0] : null;

    // ===============================
    // RESULTADO
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

    let blocoAposta = "⚪ Nenhuma odd informada";

    if (melhor) {
        const classificacao = classificarEV(melhor.ev);

        if (melhor.ev < EV_MINIMO) {
            blocoAposta = `
                <h3 style="color:red;">🔴 EVENTO SEM VALUE</h3>
                <p>Sem vantagem estatística relevante.</p>
            `;
        } else {
            blocoAposta = `
                <h3 style="color:${classificacao.cor};">🎯 MELHOR APOSTA</h3>
                <p><strong>${melhor.nome}</strong></p>
                <p>Probabilidade Modelo: ${(melhor.prob * 100).toFixed(1)}%</p>
                <p>Odd Mercado: ${melhor.odd}</p>
                <p>EV: ${(melhor.ev * 100).toFixed(2)}%</p>
                <p><strong>${classificacao.texto}</strong></p>
            `;
        }
    }

    document.getElementById("resultado").innerHTML =
        blocoProb + "<hr>" + blocoAposta;
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

// ===============================
window.onload = atualizarFavoritismo;







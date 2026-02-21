// ===============================
// CONFIG
// ===============================
let chartGols = null;
let chartPlacares = null;

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

function poisson(lambda, k) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n) {
    if (n <= 1) return 1;
    let f = 1;
    for (let i = 2; i <= n; i++) f *= i;
    return f;
}

// ===============================
// LIMITE DINÂMICO DE GOLS
// ===============================
function calcularMaxGoals(lambdaA, lambdaB) {
    const mediaTotal = lambdaA + lambdaB;
    return Math.max(8, Math.ceil(mediaTotal + 6));
}

// ===============================
// FAVORITISMO
// ===============================
function atualizarFavoritismo() {
    const favA = parseFloat(document.getElementById("favA").value);
    const favB = 100 - favA;

    document.getElementById("favB").value = favB;
    document.getElementById("favValores").innerText =
        `Time A: ${favA}% — Time B: ${favB}%`;
}

// ===============================
// CALCULAR
// ===============================
function calcular() {

    // ===== MÉDIAS =====
    const golsA = mean(getValues(".golsA"));
    const sofridosA = mean(getValues(".golsSofridosA"));
    const golsB = mean(getValues(".golsB"));
    const sofridosB = mean(getValues(".golsSofridosB"));

    const h2hA = mean(getValues(".h2hA"));
    const h2hB = mean(getValues(".h2hB"));

    const favA = parseFloat(document.getElementById("favA").value) / 100;
    const favB = 1 - favA;

    // ===== LAMBDA AJUSTADO =====
    let lambdaA = ((golsA + sofridosB) / 2) * (0.7 + favA * 0.6);
    let lambdaB = ((golsB + sofridosA) / 2) * (0.7 + favB * 0.6);

    // Peso confronto direto
    if (h2hA > 0 || h2hB > 0) {
        lambdaA = (lambdaA * 0.8) + (h2hA * 0.2);
        lambdaB = (lambdaB * 0.8) + (h2hB * 0.2);
    }

    const maxGoals = calcularMaxGoals(lambdaA, lambdaB);

    // ===== MATRIZ =====
    let matriz = [];
    let somaTotal = 0;

    for (let i = 0; i <= maxGoals; i++) {
        for (let j = 0; j <= maxGoals; j++) {
            const prob = poisson(lambdaA, i) * poisson(lambdaB, j);
            matriz.push({ i, j, prob });
            somaTotal += prob;
        }
    }

    // ===== NORMALIZAÇÃO (corrige perda de cauda) =====
    matriz = matriz.map(p => ({
        ...p,
        prob: p.prob / somaTotal
    }));

    // ===== MERCADOS =====
    let probOver25 = 0;
    let probBTTS = 0;
    let probA = 0;
    let probEmpate = 0;
    let probB = 0;

    let melhorPlacar = { prob: 0, placar: "0x0" };

    matriz.forEach(p => {

        if (p.i + p.j > 2.5) probOver25 += p.prob;
        if (p.i > 0 && p.j > 0) probBTTS += p.prob;

        if (p.i > p.j) probA += p.prob;
        if (p.i === p.j) probEmpate += p.prob;
        if (p.j > p.i) probB += p.prob;

        if (p.prob > melhorPlacar.prob) {
            melhorPlacar = {
                prob: p.prob,
                placar: `${p.i}x${p.j}`
            };
        }
    });

    const mediaTotal = lambdaA + lambdaB;

    // ===== INTERPRETAÇÃO =====
    let interpretacao = "";

    if (mediaTotal > 2.6 || probOver25 > 0.6) {
        interpretacao += "Jogo com tendência ofensiva. ";
    } else if (mediaTotal < 2.2) {
        interpretacao += "Jogo com tendência mais equilibrada e poucos gols. ";
    } else {
        interpretacao += "Partida com cenário moderado de gols. ";
    }

    if (lambdaA > lambdaB + 0.4) {
        interpretacao += "Time A apresenta superioridade estatística. ";
    } else if (lambdaB > lambdaA + 0.4) {
        interpretacao += "Time B apresenta superioridade estatística. ";
    } else {
        interpretacao += "Confronto equilibrado sem favorito claro. ";
    }

    if (probBTTS > 0.55) {
        interpretacao += "Alta probabilidade de ambas equipes marcarem. ";
    } else if (probBTTS < 0.45) {
        interpretacao += "Baixa probabilidade de ambas marcarem. ";
    }

    interpretacao += `Expectativa média de ${mediaTotal.toFixed(2)} gols.`;

    const mercados = [
        { nome: "Over 2.5 gols", valor: probOver25 },
        { nome: "Under 2.5 gols", valor: 1 - probOver25 },
        { nome: "BTTS - Sim", valor: probBTTS },
        { nome: "Vitória Time A", valor: probA },
        { nome: "Empate", valor: probEmpate },
        { nome: "Vitória Time B", valor: probB }
    ];

    mercados.sort((a, b) => b.valor - a.valor);
    const sugestao = mercados[0].nome;

    // ===== SAÍDA =====
    document.getElementById("resultado").innerHTML = `
        <h3>📊 Análise Estatística</h3>
        <p><strong>Placar mais provável:</strong> ${melhorPlacar.placar}</p>
        <p><strong>Over 2.5:</strong> ${(probOver25 * 100).toFixed(1)}%</p>
        <p><strong>BTTS:</strong> ${(probBTTS * 100).toFixed(1)}%</p>
        <p><strong>Vitória A:</strong> ${(probA * 100).toFixed(1)}%</p>
        <p><strong>Empate:</strong> ${(probEmpate * 100).toFixed(1)}%</p>
        <p><strong>Vitória B:</strong> ${(probB * 100).toFixed(1)}%</p>
        <hr>
        <h4>🧠 Interpretação:</h4>
        <p>${interpretacao}</p>
        <h4>🎯 Sugestão estatística:</h4>
        <p><strong>${sugestao}</strong></p>
    `;

    gerarGraficoGols(lambdaA, lambdaB, maxGoals);
    gerarGraficoPlacares(matriz);
}

// ===============================
// GRÁFICO DE GOLS
// ===============================
function gerarGraficoGols(lambdaA, lambdaB, maxGoals) {

    const labels = [];
    const dadosA = [];
    const dadosB = [];

    for (let i = 0; i <= maxGoals; i++) {
        labels.push(i);
        dadosA.push(poisson(lambdaA, i));
        dadosB.push(poisson(lambdaB, i));
    }

    if (chartGols) chartGols.destroy();

    chartGols = new Chart(document.getElementById("graficoGols"), {
        type: "bar",
        data: {
            labels,
            datasets: [
                { label: "Time A", data: dadosA },
                { label: "Time B", data: dadosB }
            ]
        }
    });
}

// ===============================
// GRÁFICO PLACARES
// ===============================
function gerarGraficoPlacares(matriz) {

    const top = [...matriz]
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 6);

    if (chartPlacares) chartPlacares.destroy();

    chartPlacares = new Chart(document.getElementById("graficoPlacares"), {
        type: "bar",
        data: {
            labels: top.map(p => `${p.i}x${p.j}`),
            datasets: [{
                label: "Probabilidade",
                data: top.map(p => p.prob)
            }]
        }
    });
}

// ===============================
// EXEMPLO
// ===============================
function preencherExemplo() {
    document.querySelectorAll("input[type='number']").forEach(i => {
        if (!i.disabled) {
            i.value = Math.floor(Math.random() * 3);
        }
    });
    atualizarFavoritismo();
}

// ===============================
// LIMPAR
// ===============================
function limpar() {
    document.querySelectorAll("input").forEach(i => {
        if (i.type === "number" && !i.disabled) {
            i.value = "";
        }
    });

    document.getElementById("resultado").innerHTML = "";

    if (chartGols) chartGols.destroy();
    if (chartPlacares) chartPlacares.destroy();
}

// ===============================
// INICIALIZAÇÃO
// ===============================
window.onload = function () {
    atualizarFavoritismo();
};






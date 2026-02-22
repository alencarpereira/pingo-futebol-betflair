// ===============================
// CONFIG
// ===============================
let chartGols = null;
let chartPlacares = null;
const CORTE_MINIMO = 0.58; // 58%

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

    const golsA = mean(getValues(".golsA"));
    const sofridosA = mean(getValues(".golsSofridosA"));
    const golsB = mean(getValues(".golsB"));
    const sofridosB = mean(getValues(".golsSofridosB"));

    const h2hA = mean(getValues(".h2hA"));
    const h2hB = mean(getValues(".h2hB"));

    const favA = parseFloat(document.getElementById("favA").value) / 100;
    const favB = 1 - favA;

    let lambdaA = ((golsA + sofridosB) / 2) * (0.7 + favA * 0.6);
    let lambdaB = ((golsB + sofridosA) / 2) * (0.7 + favB * 0.6);

    if (h2hA > 0 || h2hB > 0) {
        lambdaA = (lambdaA * 0.8) + (h2hA * 0.2);
        lambdaB = (lambdaB * 0.8) + (h2hB * 0.2);
    }

    const maxGoals = calcularMaxGoals(lambdaA, lambdaB);

    let matriz = [];
    let somaTotal = 0;

    for (let i = 0; i <= maxGoals; i++) {
        for (let j = 0; j <= maxGoals; j++) {
            const prob = poisson(lambdaA, i) * poisson(lambdaB, j);
            matriz.push({ i, j, prob });
            somaTotal += prob;
        }
    }

    // Normalizar
    matriz = matriz.map(p => ({
        ...p,
        prob: p.prob / somaTotal
    }));

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

    const mercados = [
        { nome: "Over 2.5 gols", valor: probOver25 },
        { nome: "Under 2.5 gols", valor: 1 - probOver25 },
        { nome: "BTTS - Sim", valor: probBTTS },
        { nome: "Vitória Time A", valor: probA },
        { nome: "Empate", valor: probEmpate },
        { nome: "Vitória Time B", valor: probB }
    ];

    mercados.sort((a, b) => b.valor - a.valor);
    const melhorMercado = mercados[0];

    let sugestaoTexto = "";

    if (melhorMercado.valor >= CORTE_MINIMO) {
        sugestaoTexto = `
            <p style="color:green;">
            ✅ Aposta recomendada: <strong>${melhorMercado.nome}</strong>
            (${(melhorMercado.valor * 100).toFixed(1)}%)
            </p>
        `;
    } else {
        sugestaoTexto = `
            <p style="color:red;">
            ⚠️ Nenhum mercado forte o suficiente.
            Melhor probabilidade: ${(melhorMercado.valor * 100).toFixed(1)}%
            </p>
        `;
    }

    document.getElementById("resultado").innerHTML = `
        <h3>📊 Análise Estatística</h3>
        <p><strong>Placar mais provável:</strong> ${melhorPlacar.placar}</p>
        <p><strong>Over 2.5:</strong> ${(probOver25 * 100).toFixed(1)}%</p>
        <p><strong>BTTS:</strong> ${(probBTTS * 100).toFixed(1)}%</p>
        <p><strong>Vitória A:</strong> ${(probA * 100).toFixed(1)}%</p>
        <p><strong>Empate:</strong> ${(probEmpate * 100).toFixed(1)}%</p>
        <p><strong>Vitória B:</strong> ${(probB * 100).toFixed(1)}%</p>
        <hr>
        ${sugestaoTexto}
    `;

    gerarGraficoGols(lambdaA, lambdaB, maxGoals);
    gerarGraficoPlacares(matriz);
}

// ===============================
// GRÁFICO DE GOLS
// ===============================
function gerarGraficoGols(lambdaA, lambdaB, maxGoals) {

    const labels = [];
    const dataA = [];
    const dataB = [];

    for (let i = 0; i <= maxGoals; i++) {
        labels.push(i);
        dataA.push(poisson(lambdaA, i));
        dataB.push(poisson(lambdaB, i));
    }

    if (chartGols) chartGols.destroy();

    chartGols = new Chart(document.getElementById("graficoGols"), {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Time A",
                    data: dataA
                },
                {
                    label: "Time B",
                    data: dataB
                }
            ]
        }
    });
}

// ===============================
// GRÁFICO TOP PLACARES
// ===============================
function gerarGraficoPlacares(matriz) {

    const top = [...matriz]
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 10);

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
// PREENCHER EXEMPLO
// ===============================
function preencherExemplo() {

    document.getElementById("favA").value = 60;
    atualizarFavoritismo();

    const setValues = (selector, values) => {
        const inputs = document.querySelectorAll(selector);
        values.forEach((v, i) => inputs[i].value = v);
    };

    setValues(".golsA", [2, 1, 3, 2, 1]);
    setValues(".golsSofridosA", [1, 0, 1, 2, 1]);
    setValues(".golsB", [1, 0, 2, 1, 1]);
    setValues(".golsSofridosB", [2, 1, 2, 1, 3]);
    setValues(".h2hA", [1, 2, 0, 1, 2]);
    setValues(".h2hB", [1, 1, 1, 0, 1]);
}

// ===============================
// LIMPAR
// ===============================
function limpar() {

    document.querySelectorAll("input[type='number']").forEach(input => {
        input.value = "";
    });

    document.getElementById("favA").value = 50;
    atualizarFavoritismo();

    document.getElementById("resultado").innerHTML = "";

    if (chartGols) chartGols.destroy();
    if (chartPlacares) chartPlacares.destroy();
}







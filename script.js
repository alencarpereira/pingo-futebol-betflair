// ========================
// HELPERS
// ========================
function mean(arr) {
    const nums = arr.map(Number).filter(n => !isNaN(n));
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function factorial(n) {
    if (n <= 1) return 1;
    let f = 1;
    for (let i = 2; i <= n; i++) f *= i;
    return f;
}

function poissonP(lambda, k) {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k);
}

function getValuesByClass(cls) {
    return Array.from(document.querySelectorAll(`.${cls}`)).map(i => {
        const v = parseFloat(i.value);
        return isNaN(v) ? 0 : v;
    });
}

function setHTML(id, html) {
    const e = document.getElementById(id);
    if (e) e.innerHTML = html;
}

// ========================
// FAVORITISMO
// ========================
function atualizarFavoritismo() {
    const favA = parseInt(document.getElementById("favA").value) || 50;
    const favB = 100 - favA;

    document.getElementById("favB").value = favB;
    document.getElementById("favValores").textContent = `Time A: ${favA}% — Time B: ${favB}%`;
}

// ========================
// CALCULAR
// ========================
function calcular() {

    // Dados
    const golsA = getValuesByClass("golsA");
    const golsSofridosA = getValuesByClass("golsSofridosA");
    const golsB = getValuesByClass("golsB");
    const golsSofridosB = getValuesByClass("golsSofridosB");
    const h2hA = getValuesByClass("h2hA");
    const h2hB = getValuesByClass("h2hB");

    // Médias
    const mediaA_marc = mean(golsA);
    const mediaA_sof = mean(golsSofridosA);
    const mediaB_marc = mean(golsB);
    const mediaB_sof = mean(golsSofridosB);

    // Força relativa
    const avgMarc = (mediaA_marc + mediaB_marc) / 2 || 0.5;
    const avgSof = (mediaA_sof + mediaB_sof) / 2 || 0.5;

    const forcaOffA = mediaA_marc / avgMarc;
    const forcaOffB = mediaB_marc / avgMarc;

    const forcaDefA = mediaA_sof / avgSof;
    const forcaDefB = mediaB_sof / avgSof;

    // Base do lambda Poisson
    let lambdaA = mediaA_marc * forcaDefB;
    let lambdaB = mediaB_marc * forcaDefA;

    // Fator H2H
    const mediaH2HA = mean(h2hA);
    const mediaH2HB = mean(h2hB);

    const h2hFactorA = (mediaH2HA + 0.01) / ((mediaA_marc || 0.01) + 0.01);
    const h2hFactorB = (mediaH2HB + 0.01) / ((mediaB_marc || 0.01) + 0.01);

    lambdaA *= Math.min(Math.max(h2hFactorA, 0.8), 1.2);
    lambdaB *= Math.min(Math.max(h2hFactorB, 0.8), 1.2);

    // Fator de Favoritismo
    const favA = (parseInt(document.getElementById("favA").value) || 50) / 100;
    const favB = 1 - favA;

    lambdaA *= (0.8 + favA * 0.4);
    lambdaB *= (0.8 + favB * 0.4);

    // Limitar lambdas
    lambdaA = Math.max(0.05, Math.min(lambdaA, 6));
    lambdaB = Math.max(0.05, Math.min(lambdaB, 6));

    // Matriz de probabilidades
    const N = 7;
    const matrix = Array.from({ length: N + 1 }, () => Array(N + 1).fill(0));

    for (let i = 0; i <= N; i++) {
        const pA = poissonP(lambdaA, i);
        for (let j = 0; j <= N; j++) {
            matrix[i][j] = pA * poissonP(lambdaB, j);
        }
    }

    // Indicadores principais
    let over25 = 0;
    let under25 = 0;
    let bttsSim = 0;
    let bttsNao = 0;
    const p00 = matrix[0][0];

    const scoreProbs = [];

    for (let i = 0; i <= N; i++) {
        for (let j = 0; j <= N; j++) {
            const p = matrix[i][j];

            if (i + j >= 3) over25 += p;
            else under25 += p;

            if (i > 0 && j > 0) bttsSim += p;
            else bttsNao += p;

            scoreProbs.push({ score: `${i}x${j}`, prob: p });
        }
    }

    // Ordenar placares
    scoreProbs.sort((a, b) => b.prob - a.prob);

    const pct = x => (x * 100).toFixed(1) + "%";

    // Mostrar resultados
    const html = `
    <h4>Resultados — Expectativas</h4>
    <table>
      <tr><th>Indicador</th><th>Probabilidade</th></tr>
      <tr><td>Over 2.5</td><td>${pct(over25)}</td></tr>
      <tr><td>Under 2.5</td><td>${pct(under25)}</td></tr>
      <tr><td>Ambos Marcam — Sim</td><td>${pct(bttsSim)}</td></tr>
      <tr><td>Ambos Marcam — Não</td><td>${pct(bttsNao)}</td></tr>
      <tr><td>0x0</td><td>${pct(p00)}</td></tr>
    </table>

    <h4>Top 6 placares mais prováveis</h4>
    <table>
      <tr><th>Placar</th><th>Probabilidade</th></tr>
      ${scoreProbs.slice(0, 6).map(s =>
        `<tr><td>${s.score}</td><td>${pct(s.prob)}</td></tr>`
    ).join("")}
    </table>
    `;

    setHTML("resultado", html);

    drawTotalGoalsChart(matrix);
    drawTopScoresChart(scoreProbs.slice(0, 8));
}

// ========================
// GRÁFICO — TOTAL DE GOLS
// ========================
let chartTotal = null;
let chartScores = null;

function drawTotalGoalsChart(matrix) {
    const N = matrix.length - 1;
    const totals = Array.from({ length: N * 2 + 1 }, () => 0);

    for (let i = 0; i <= N; i++) {
        for (let j = 0; j <= N; j++) {
            totals[i + j] += matrix[i][j];
        }
    }

    const ctx = document.getElementById("graficoGols").getContext("2d");

    if (chartTotal) chartTotal.destroy();

    chartTotal = new Chart(ctx, {
        type: "bar",
        data: {
            labels: totals.map((_, i) => `${i}`),
            datasets: [{
                label: "Distribuição de Gols (%)",
                data: totals.map(x => (x * 100).toFixed(2)),
                borderWidth: 1
            }]
        }
    });
}

// ========================
// GRÁFICO — TOP PLACARES
// ========================
function drawTopScoresChart(list) {
    const ctx = document.getElementById("graficoPlacares").getContext("2d");

    if (chartScores) chartScores.destroy();

    chartScores = new Chart(ctx, {
        type: "bar",
        data: {
            labels: list.map(s => s.score),
            datasets: [{
                label: "Probabilidade (%)",
                data: list.map(s => (s.prob * 100).toFixed(2)),
                borderWidth: 1
            }]
        }
    });
}

// ========================
// EXEMPLO
// ========================
function preencherExemplo() {

    const aGols = [2, 1, 3, 1, 2];
    const aSof = [1, 0, 1, 2, 1];
    const bGols = [1, 0, 2, 1, 1];
    const bSof = [2, 1, 0, 1, 1];

    document.querySelectorAll(".golsA").forEach((el, i) => el.value = aGols[i]);
    document.querySelectorAll(".golsSofridosA").forEach((el, i) => el.value = aSof[i]);
    document.querySelectorAll(".golsB").forEach((el, i) => el.value = bGols[i]);
    document.querySelectorAll(".golsSofridosB").forEach((el, i) => el.value = bSof[i]);

    // H2H exemplo
    const h2ha = [1, 2, 0, 1, 1];
    const h2hb = [0, 1, 2, 1, 1];

    document.querySelectorAll(".h2hA").forEach((el, i) => el.value = h2ha[i]);
    document.querySelectorAll(".h2hB").forEach((el, i) => el.value = h2hb[i]);
}

// ========================
// LIMPAR
// ========================
function limpar() {
    document.querySelectorAll("input[type='number']").forEach(i => i.value = "");
    setHTML("resultado", "");
    if (chartTotal) chartTotal.destroy();
    if (chartScores) chartScores.destroy();
}


// ===============================
// CONFIG
// ===============================
let chartGols = null;
let chartPlacares = null;
const CORTE_MINIMO = 0.55;

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

function calcularMaxGoals(lambdaA, lambdaB) {
    const mediaTotal = lambdaA + lambdaB;
    return Math.max(8, Math.ceil(mediaTotal + 6));
}

// ===============================
// AUTO AJUSTE PELO MERCADO
// ===============================
function ajustarFavoritismoPeloMercado() {

    const mercadoCasa = parseFloat(document.getElementById("mercadoCasa").value);
    const mercadoVisitante = parseFloat(document.getElementById("mercadoVisitante").value);

    if (!isNaN(mercadoCasa) && !isNaN(mercadoVisitante)) {

        const total = mercadoCasa + mercadoVisitante;

        if (total > 0) {
            const novaFav = (mercadoCasa / total) * 100;

            document.getElementById("favA").value = novaFav.toFixed(0);
            atualizarFavoritismo();
        }
    }
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

    // 🔥 ajuste automático antes de calcular
    ajustarFavoritismoPeloMercado();

    const golsA = mean(getValues(".golsA"));
    const sofridosA = mean(getValues(".golsSofridosA"));
    const golsB = mean(getValues(".golsB"));
    const sofridosB = mean(getValues(".golsSofridosB"));
    const h2hA = mean(getValues(".h2hA"));
    const h2hB = mean(getValues(".h2hB"));

    const favA = (parseFloat(document.getElementById("favA").value) || 50) / 100;
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

    matriz = matriz.map(p => ({ ...p, prob: p.prob / somaTotal }));

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
            melhorPlacar = { prob: p.prob, placar: `${p.i}x${p.j}` };
        }
    });

    // ===============================
    // INTERPRETAÇÃO
    // ===============================
    const mediaTotal = lambdaA + lambdaB;

    let interpretacao =
        `Expectativa média: ${mediaTotal.toFixed(2)} gols. `;

    if (mediaTotal > 2.8)
        interpretacao += "Tendência ofensiva forte. ";
    else if (mediaTotal < 2.2)
        interpretacao += "Tendência under. ";
    else
        interpretacao += "Equilíbrio de gols. ";

    // ===============================
    // VALIDAÇÃO
    // ===============================
    const mercadoCasa = parseFloat(document.getElementById("mercadoCasa").value);
    const mercadoVisitante = parseFloat(document.getElementById("mercadoVisitante").value);
    const mercadoOver = parseFloat(document.getElementById("mercadoOver").value);
    const mercadoBTTS = parseFloat(document.getElementById("mercadoBTTS").value);

    function diff(modelo, mercado) {
        return Math.abs(modelo - (mercado / 100));
    }

    let status = "⚪ Sem dados de mercado";
    let cor = "gray";

    if (!isNaN(mercadoCasa)) {

        const d1 = diff(probA, mercadoCasa);
        const d2 = !isNaN(mercadoVisitante) ? diff(probB, mercadoVisitante) : 0;

        if (d1 < 0.06 && d2 < 0.06) {
            status = "🟢 Modelo alinhado com mercado";
            cor = "green";
        }
        else if (d1 < 0.12) {
            status = "🟡 Parcialmente alinhado";
            cor = "orange";
        }
        else {
            status = "🔴 Divergente do mercado";
            cor = "red";
        }
    }

    // ===============================
    // RESULTADO
    // ===============================
    document.getElementById("resultado").innerHTML = `
        <h3>📊 Análise Estatística</h3>
        <p><strong>Placar mais provável:</strong> ${melhorPlacar.placar}</p>
        <p><strong>Over 2.5:</strong> ${(probOver25 * 100).toFixed(1)}%</p>
        <p><strong>BTTS:</strong> ${(probBTTS * 100).toFixed(1)}%</p>
        <p><strong>Vitória Casa:</strong> ${(probA * 100).toFixed(1)}%</p>
        <p><strong>Empate:</strong> ${(probEmpate * 100).toFixed(1)}%</p>
        <p><strong>Vitória Visitante:</strong> ${(probB * 100).toFixed(1)}%</p>
        <hr>
        <p>${interpretacao}</p>
        <hr>
        <h3 style="color:${cor};">${status}</h3>
    `;

    if (typeof gerarGraficoGols === "function")
        gerarGraficoGols(lambdaA, lambdaB, maxGoals);

    if (typeof gerarGraficoPlacares === "function")
        gerarGraficoPlacares(matriz);
}

// ===============================
// PREENCHER EXEMPLO
// ===============================
function preencherExemplo() {

    document.getElementById("favA").value = 60;
    atualizarFavoritismo();

    // Time A
    const golsA = [2, 1, 3, 2, 1];
    const sofridosA = [1, 0, 1, 2, 1];

    document.querySelectorAll(".golsA").forEach((el, i) => el.value = golsA[i]);
    document.querySelectorAll(".golsSofridosA").forEach((el, i) => el.value = sofridosA[i]);

    // Time B
    const golsB = [1, 0, 2, 1, 1];
    const sofridosB = [2, 1, 2, 1, 3];

    document.querySelectorAll(".golsB").forEach((el, i) => el.value = golsB[i]);
    document.querySelectorAll(".golsSofridosB").forEach((el, i) => el.value = sofridosB[i]);

    // H2H
    const h2hA = [1, 2, 0, 1, 2];
    const h2hB = [1, 1, 1, 0, 1];

    document.querySelectorAll(".h2hA").forEach((el, i) => el.value = h2hA[i]);
    document.querySelectorAll(".h2hB").forEach((el, i) => el.value = h2hB[i]);

    // Mercado exemplo
    document.getElementById("mercadoCasa").value = 58;
    document.getElementById("mercadoVisitante").value = 30;
    document.getElementById("mercadoOver").value = 55;
    document.getElementById("mercadoBTTS").value = 52;
}

// ===============================
// LIMPAR CAMPOS
// ===============================
function limpar() {

    // 🔹 Zerar inputs numéricos
    document.querySelectorAll("input[type='number']").forEach(input => {
        if (!input.disabled) input.value = "";
    });

    // 🔹 Reset favoritismo
    document.getElementById("favA").value = 50;
    atualizarFavoritismo();

    // 🔹 Limpar resultado
    document.getElementById("resultado").innerHTML = "";

    // 🔹 Destruir gráficos se existirem
    if (chartGols) {
        chartGols.destroy();
        chartGols = null;
    }

    if (chartPlacares) {
        chartPlacares.destroy();
        chartPlacares = null;
    }
}
// ===============================
window.onload = atualizarFavoritismo;







// ============================================================= //
// CONFIG PROFISSIONAL 6.2 - DUAL VALUE & MARKET ANALYSIS        //
// ============================================================= //

const CONFIG = {
    MAX_GOALS: 10,
    MEDIA_LIGA: 2.5,
    PESO_MERCADO: 0.25,
    DIXON_COLES_RHO: -0.12,
    FATOR_VOLATILIDADE: 0.15
};

const FACTORIALS = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];

// =============================== //
// HELPERS ESTATÍSTICOS            //
// =============================== //

function getStats(arr) {
    const valid = arr.filter(n => n !== null && !isNaN(n));
    if (valid.length === 0) return { mean: 0, variance: 0, count: 0 };
    const m = valid.reduce((a, b) => a + b, 0) / valid.length;
    const v = valid.reduce((a, b) => a + Math.pow(b - m, 2), 0) / valid.length;
    return { mean: m, variance: v, count: valid.length };
}

function getValues(selector) {
    return Array.from(document.querySelectorAll(selector))
        .map(i => i.value.trim() === "" ? null : parseFloat(i.value));
}

function poisson(lambda, k) {
    if (k > CONFIG.MAX_GOALS) return 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / FACTORIALS[k];
}

function adjustmentDixonColes(i, j, lambdaA, lambdaB) {
    if (i === 0 && j === 0) return 1 - (lambdaA * lambdaB * CONFIG.DIXON_COLES_RHO);
    if (i === 0 && j === 1) return 1 + (lambdaA * CONFIG.DIXON_COLES_RHO);
    if (i === 1 && j === 0) return 1 + (lambdaB * CONFIG.DIXON_COLES_RHO);
    if (i === 1 && j === 1) return 1 - CONFIG.DIXON_COLES_RHO;
    return 1;
}

function classificarEV(ev) {
    if (ev > 0.15) return { texto: "🔥 ALTO VALOR", cor: "#00ffff" };
    if (ev > 0.08) return { texto: "🟢 VALOR FORTE", cor: "#00ff00" };
    return { texto: "🟡 VALOR LEVE", cor: "#ffcc00" };
}

function atualizarFavoritismo() {
    const favA = parseFloat(document.getElementById("favA")?.value) || 50;
    const favB = 100 - favA;
    if (document.getElementById("favB")) document.getElementById("favB").value = favB;
    const favText = document.getElementById("favValores");
    if (favText) favText.innerText = `Time A: ${favA}% — Time B: ${favB}%`;
}

// =============================== //
// CORE ENGINE                     //
// =============================== //

function calcular() {
    const statsAtk1 = getStats(getValues(".golsA"));
    const statsDef1 = getStats(getValues(".golsSofridosA"));
    const statsAtk2 = getStats(getValues(".golsB"));
    const statsDef2 = getStats(getValues(".golsSofridosB"));
    const statsH2H1 = getStats(getValues(".h2hA"));
    const statsH2H2 = getStats(getValues(".h2hB"));

    const favA = (parseFloat(document.getElementById("favA")?.value) || 50) / 100;
    const favB = 1 - favA;

    let lambdaA = (statsAtk1.mean + statsDef2.mean) / 2;
    let lambdaB = (statsAtk2.mean + statsDef1.mean) / 2;

    // Ajuste de Volatilidade
    lambdaA *= (1 - (statsAtk1.variance * CONFIG.FATOR_VOLATILIDADE / 10));
    lambdaB *= (1 - (statsAtk2.variance * CONFIG.FATOR_VOLATILIDADE / 10));

    // Favoritismo & H2H
    lambdaA *= (0.80 + favA * 0.4);
    lambdaB *= (0.80 + favB * 0.4);
    if (statsH2H1.count > 0) {
        lambdaA = (lambdaA * 0.85) + (statsH2H1.mean * 0.15);
        lambdaB = (lambdaB * 0.85) + (statsH2H2.mean * 0.15);
    }

    // Mercado Calibração
    const oddsInput = {
        casa: parseFloat(document.getElementById("mercadoCasa")?.value),
        empate: parseFloat(document.getElementById("mercadoEmpate")?.value),
        visitante: parseFloat(document.getElementById("mercadoVisitante")?.value),
        over: parseFloat(document.getElementById("mercadoOver")?.value),
        under: parseFloat(document.getElementById("mercadoUnder")?.value),
        btts: parseFloat(document.getElementById("mercadoBTTS")?.value)
    };

    if (oddsInput.casa > 1 && oddsInput.visitante > 1) {
        const probM1 = 1 / oddsInput.casa;
        const probM2 = 1 / oddsInput.visitante;
        lambdaA *= (1 - CONFIG.PESO_MERCADO + CONFIG.PESO_MERCADO * (probM1 / (probM1 + probM2)) * 2);
        lambdaB *= (1 - CONFIG.PESO_MERCADO + CONFIG.PESO_MERCADO * (probM2 / (probM1 + probM2)) * 2);
    }

    // Matriz & Probabilidades
    let pA = 0, pE = 0, pB = 0, pO = 0, pBTTS = 0, soma = 0;
    for (let i = 0; i <= CONFIG.MAX_GOALS; i++) {
        for (let j = 0; j <= CONFIG.MAX_GOALS; j++) {
            let p = poisson(lambdaA, i) * poisson(lambdaB, j) * adjustmentDixonColes(i, j, lambdaA, lambdaB);
            soma += p;
            if (i > j) pA += p; else if (i === j) pE += p; else pB += p;
            if (i + j > 2.5) pO += p; if (i > 0 && j > 0) pBTTS += p;
        }
    }

    const mercados = [
        { nome: "Vitória Casa", prob: pA / soma, odd: oddsInput.casa },
        { nome: "Empate", prob: pE / soma, odd: oddsInput.empate },
        { nome: "Vitória Visitante", prob: pB / soma, odd: oddsInput.visitante },
        { nome: "Over 2.5", prob: pO / soma, odd: oddsInput.over },
        { nome: "Under 2.5", prob: (1 - pO / soma), odd: oddsInput.under },
        { nome: "BTTS Sim", prob: pBTTS / soma, odd: oddsInput.btts }
    ].filter(m => m.odd > 1);

    const listaValor = mercados
        .map(m => ({ ...m, ev: (m.prob * m.odd) - 1 }))
        .sort((a, b) => b.ev - a.ev);

    // O que a casa acredita (menor odd = maior proteção deles)
    const apostaCasa = [...mercados].sort((a, b) => a.odd - b.odd)[0];

    exibirResultados(pA / soma, pE / soma, pB / soma, pO / soma, pBTTS / soma, lambdaA + lambdaB, listaValor.slice(0, 2), apostaCasa);
}

function exibirResultados(pA, pE, pB, pOver, pBTTS, expGols, tops, casa) {
    const el = document.getElementById("resultado");
    if (!el) return;

    let htmlValue = tops.map(m => `
        <div style="background: #1a1a1a; padding: 12px; border-radius: 8px; border-left: 5px solid ${classificarEV(m.ev).cor}; margin-bottom: 10px;">
            <span style="color:${classificarEV(m.ev).cor}; font-weight:bold">${classificarEV(m.ev).texto}</span><br>
            <b>${m.nome}</b> @${m.odd.toFixed(2)} | EV: <b>+${(m.ev * 100).toFixed(2)}%</b>
        </div>
    `).join("");

    el.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
            <div style="background: #333; padding: 8px; border-radius: 5px; font-size: 0.9em;">
                <b>📈 Probabilidades</b><br>Casa: ${(pA * 100).toFixed(1)}% | Fora: ${(pB * 100).toFixed(1)}%
            </div>
            <div style="background: #333; padding: 8px; border-radius: 5px; font-size: 0.9em;">
                <b>⚽ Gols</b><br>Over: ${(pOver * 100).toFixed(1)}% | BTTS: ${(pBTTS * 100).toFixed(1)}%
            </div>
        </div>
        <h4 style="margin: 10px 0 5px 0;">🎯 TOP 2 VALUE (MODELO)</h4>
        ${htmlValue || "<p>Sem valor detectado</p>"}
        <h4 style="margin: 15px 0 5px 0;">🛡️ PROBABILIDADE DA CASA (BAIXA ODD)</h4>
        <div style="background: #222; padding: 10px; border-radius: 8px; border-left: 5px solid #888;">
            <b>${casa ? casa.nome : '-'}</b> @${casa ? casa.odd.toFixed(2) : '-'}<br>
            <small>Este é o mercado que a casa considera mais provável.</small>
        </div>
    `;
}

// Funções Preencher e Limpar permanecem as mesmas da v6.1
function preencherExemplo() {
    limpar();
    const fill = (cls, vals) => document.querySelectorAll(cls).forEach((el, i) => el.value = vals[i] ?? "");
    document.getElementById("favA").value = 60; atualizarFavoritismo();
    const odds = { "mercadoCasa": 1.95, "mercadoEmpate": 3.40, "mercadoVisitante": 4.10, "mercadoOver": 1.85, "mercadoUnder": 1.95, "mercadoBTTS": 1.75 };
    for (const [id, val] of Object.entries(odds)) { if (document.getElementById(id)) document.getElementById(id).value = val; }
    fill(".golsA", [2, 1, 3, 0, 2]); fill(".golsSofridosA", [0, 1, 1, 2, 0]);
    fill(".golsB", [1, 0, 1, 2, 1]); fill(".golsSofridosB", [2, 2, 1, 0, 1]);
    fill(".h2hA", [2, 1, 1, 0, 2]); fill(".h2hB", [1, 1, 0, 1, 1]);
}

function limpar() {
    document.querySelectorAll("input").forEach(i => { if (!i.disabled) i.value = ""; });
    document.getElementById("favA").value = 50; atualizarFavoritismo();
    document.getElementById("resultado").innerHTML = "";
}

window.onload = atualizarFavoritismo;









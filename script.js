// ==========================================
// ⚽ CALCULADORA DE PROBABILIDADES FUTEBOL
// ==========================================

const MAX_GOALS = 6;
let graficoPlacaresInstancia = null;

// ===============================
// HELPERS
// ===============================
function media(arr) {
    const valid = arr.filter(v => !isNaN(v));
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function pegarValores(classe) {
    return [...document.querySelectorAll("." + classe)]
        .map(e => (e.value === "" ? NaN : Number(e.value)))
        .filter(v => !isNaN(v));
}

function fatorial(n) {
    if (n === 0) return 1;
    let r = 1;
    for (let i = 1; i <= n; i++) r *= i;
    return r;
}

function poisson(k, lambda) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / fatorial(k);
}

function probOdd(odd) {
    return odd > 0 ? (1 / odd) * 100 : 0;
}

function classificarTendencia(prob) {
    if (prob >= 65) return "🔥 MUITO FORTE";
    if (prob >= 55) return "⚡ BOA PROBABILIDADE";
    if (prob >= 45) return "⚠️ MODERADO";
    return "❌ BAIXA PROBABILIDADE";
}

function verificarValor(oddMercado, oddJusta) {

    if (!oddMercado || !oddJusta || oddJusta === "-") {
        return "-";
    }

    const ev = ((oddMercado / oddJusta) - 1) * 100;

    if (ev > 5) {
        return `<span style="color:#2e7d32;font-weight:bold;">+${ev.toFixed(1)}% 🔥</span>`;
    }

    if (ev > 0) {
        return `<span style="color:#4CAF50;">+${ev.toFixed(1)}%</span>`;
    }

    if (ev > -5) {
        return `<span style="color:#f9a825;">${ev.toFixed(1)}%</span>`;
    }

    return `<span style="color:#c62828;">${ev.toFixed(1)}%</span>`;
}

// ===============================
// CORE: CALCULAR
// ===============================

function calcular() {

    const golsA = pegarValores("golsA");
    const sofridosA = pegarValores("golsSofridosA");
    const golsB = pegarValores("golsB");
    const sofridosB = pegarValores("golsSofridosB");
    const h2hA = pegarValores("h2hA");
    const h2hB = pegarValores("h2hB");

    const ataqueA = media(golsA);
    const defesaA = media(sofridosA);
    const ataqueB = media(golsB);
    const defesaB = media(sofridosB);
    const hA = media(h2hA);
    const hB = media(h2hB);

    let lambdaA =
        (ataqueA * 0.5) +
        (defesaB * 0.35) +
        (hA * 0.15);

    let lambdaB =
        (ataqueB * 0.5) +
        (defesaA * 0.35) +
        (hB * 0.15);

    // proteção para evitar valores muito baixos
    lambdaA = Math.max(0.2, lambdaA);
    lambdaB = Math.max(0.2, lambdaB);

    const oddCasa = Number(document.getElementById("mercadoCasa").value);
    const oddFora = Number(document.getElementById("mercadoVisitante").value);
    const bancaTotal = Number(document.getElementById("valorApostaTotal")?.value) || 10;

    const oddsMercado = {
        empate: Number(document.getElementById("mercadoEmpate").value),
        over: Number(document.getElementById("mercadoOver").value),
        btts: Number(document.getElementById("mercadoBTTS").value)
    };

    // ajuste pelo mercado
    if (oddCasa && oddFora) {
        const pMercadoA = probOdd(oddCasa);
        const pMercadoB = probOdd(oddFora);
        const total = pMercadoA + pMercadoB;
        const pesoA = pMercadoA / total;

        lambdaA *= (1 + (pesoA - 0.5) * 0.25);
        lambdaB *= (1 - (pesoA - 0.5) * 0.15);
    }

    // 🔒 limite máximo para evitar distorções
    lambdaA = Math.min(3.5, lambdaA);
    lambdaB = Math.min(3.5, lambdaB);

    let pWinA = 0;
    let pDraw = 0;
    let pWinB = 0;
    let pOver25 = 0;
    let pBTTS = 0;

    let placares = [];

    for (let i = 0; i <= MAX_GOALS; i++) {
        for (let j = 0; j <= MAX_GOALS; j++) {

            const p = poisson(i, lambdaA) * poisson(j, lambdaB);

            placares.push({ p: `${i}x${j}`, val: p * 100 });

            if (i > j) pWinA += p;
            else if (i === j) pDraw += p;
            else pWinB += p;

            if (i + j > 2.5) pOver25 += p;
            if (i > 0 && j > 0) pBTTS += p;
        }
    }

    const resA = pWinA * 100;
    const resEmp = pDraw * 100;
    const resB = pWinB * 100;
    const resOver = pOver25 * 100;
    const resUnder = 100 - resOver;
    const resBTTS = pBTTS * 100;

    placares.sort((a, b) => b.val - a.val);

    const fairCasa = resA > 0 ? (100 / resA).toFixed(2) : "-";
    const fairEmpate = resEmp > 0 ? (100 / resEmp).toFixed(2) : "-";
    const fairOver = resOver > 0 ? (100 / resOver).toFixed(2) : "-";
    const fairBTTS = resBTTS > 0 ? (100 / resBTTS).toFixed(2) : "-";

    const evCasa = ((oddCasa / fairCasa) - 1) * 100;

    const confianca = (resA * 0.7 + (100 - resB) * 0.3).toFixed(0);

    let veredito = "";

    if (evCasa >= 5 && confianca >= 60) {
        veredito = "🔥 ENTRADA FORTE (VALOR + CONFIANÇA)";
    }
    else if (evCasa > 0 && confianca >= 55) {
        veredito = "✅ ENTRADA PADRÃO (VALOR IDENTIFICADO)";
    }
    else if (evCasa > 10) {
        veredito = "⚠️ VALOR ALTO MAS RISCO ELEVADO";
    }
    else {
        veredito = "🚫 FORA (SEM VANTAGEM MATEMÁTICA)";
    }

    let melhorHedge = { nome: "Empate", odd: oddsMercado.empate, prob: resEmp };

    if (resOver > resEmp && resOver > 50 && oddsMercado.over > 1) {
        melhorHedge = { nome: "Over 2.5", odd: oddsMercado.over, prob: resOver };
    }

    if (resBTTS > resEmp && resBTTS > 50 && oddsMercado.btts > 1) {
        melhorHedge = { nome: "BTTS", odd: oddsMercado.btts, prob: resBTTS };
    }

    let stakePrincipal = 0;
    let stakeHedge = 0;
    let lucroSeVencer = 0;

    if (oddCasa > 1 && melhorHedge.odd > 1) {

        stakeHedge = bancaTotal / melhorHedge.odd;
        stakePrincipal = bancaTotal - stakeHedge;

        const retornoPrincipal = stakePrincipal * oddCasa;
        lucroSeVencer = retornoPrincipal - bancaTotal;
    }

    const retornoProtecao = stakeHedge * melhorHedge.odd;

    document.getElementById("resultado").innerHTML = `

<b>${veredito}</b><br><br>

📊 <b>PREÇO JUSTO vs MERCADO</b><br>
Casa → ${verificarValor(oddCasa, fairCasa)}<br>
Empate → ${verificarValor(oddsMercado.empate, fairEmpate)}<br>
Over → ${verificarValor(oddsMercado.over, fairOver)}<br>
BTTS → ${verificarValor(oddsMercado.btts, fairBTTS)}<br><br>

🛡️ <b>ANÁLISE DO TIME A</b><br>
Vitória: ${resA.toFixed(1)}%<br>
Empate: ${resEmp.toFixed(1)}%<br>
Derrota: ${resB.toFixed(1)}%<br><br>

⚽ <b>MERCADO DE GOLS</b><br>
Over 2.5: ${resOver.toFixed(1)}%<br>
Under 2.5: ${resUnder.toFixed(1)}%<br>
BTTS: ${resBTTS.toFixed(1)}%<br><br>

🎯 <b>PLACARES MAIS PROVÁVEIS</b><br>
${placares.slice(0, 4).map(p => `${p.p} → ${p.val.toFixed(1)}%`).join("<br>")}<br><br>

🛡️ <b>Sugestão de Cobertura (Hedge)</b><br>

<b>CONFIANÇA</b><br>
${confianca}%<br><br>

🛡️ <b>Hedge:</b> ${melhorHedge.nome}<br><br>

🎯 <b>Principal:</b> R$ ${stakePrincipal.toFixed(2)} (Vitória Casa)<br><br>

🛡️ <b>Proteção:</b> R$ ${stakeHedge.toFixed(2)} (${melhorHedge.nome})<br><br>

✅ <b>LUCRO ESTIMADO:</b> R$ ${lucroSeVencer.toFixed(2)}<br>

Se der apenas a proteção, você recupera 
<b>R$ ${retornoProtecao.toFixed(2)}</b> (Banca protegida)

`;

    renderizarGrafico(placares.slice(0, 6));
}

function renderizarGrafico(dados) {
    const ctx = document.getElementById('graficoPlacares').getContext('2d');
    if (graficoPlacaresInstancia) graficoPlacaresInstancia.destroy();
    graficoPlacaresInstancia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.p),
            datasets: [{
                label: 'Probabilidade (%)',
                data: dados.map(d => d.val.toFixed(1)),
                backgroundColor: '#4CAF50'
            }]
        },
        options: { responsive: true }
    });
}

function preencherExemplo() {
    // Dados Realistas: Time A (Favorito em Casa) vs Time B (Visitante equilibrado)
    const gA = [2, 1, 3, 0, 2]; // Gols Marcados Casa
    const sA = [0, 1, 1, 0, 1]; // Gols Sofridos Casa
    const gB = [1, 0, 2, 1, 0]; // Gols Marcados Fora
    const sB = [2, 1, 0, 2, 0]; // Gols Sofridos Fora
    const h2hA = [2, 1, 1, 3, 0]; // Confronto Direto (Time A)
    const h2hB = [0, 1, 0, 1, 0]; // Confronto Direto (Time B)

    // Preenchendo as tabelas de gols
    document.querySelectorAll(".golsA").forEach((e, i) => e.value = gA[i]);
    document.querySelectorAll(".golsSofridosA").forEach((e, i) => e.value = sA[i]);
    document.querySelectorAll(".golsB").forEach((e, i) => e.value = gB[i]);
    document.querySelectorAll(".golsSofridosB").forEach((e, i) => e.value = sB[i]);
    document.querySelectorAll(".h2hA").forEach((e, i) => e.value = h2hA[i]);
    document.querySelectorAll(".h2hB").forEach((e, i) => e.value = h2hB[i]);

    // Preenchendo TODOS os campos de mercado (Odds)
    document.getElementById("mercadoCasa").value = 1.85;
    document.getElementById("mercadoEmpate").value = 3.50;
    document.getElementById("mercadoVisitante").value = 4.20;
    document.getElementById("mercadoOver").value = 2.05;
    document.getElementById("mercadoUnder").value = 1.80;
    document.getElementById("mercadoBTTS").value = 1.95;

    // Valor da Aposta (Stake)
    const campoStake = document.getElementById("valorApostaTotal");
    if (campoStake) campoStake.value = 10;

    console.log("✅ Exemplo preenchido com sucesso!");
}


function limpar() {
    document.querySelectorAll("input").forEach(e => e.value = "");
    document.getElementById("resultado").innerHTML = "Aguardando dados...";
    document.getElementById("cobertura").style.display = "none";
    if (graficoPlacaresInstancia) graficoPlacaresInstancia.destroy();
}











function poisson(k, lambda) {
    const exp = Math.exp(-lambda);
    let factorial = 1;
    for (let i = 1; i <= k; i++) factorial *= i;
    return (Math.pow(lambda, k) * exp) / factorial;
}

function getMedia(selector) {
    const inputs = document.querySelectorAll(selector);
    let soma = 0;
    let cont = 0;
    inputs.forEach(input => {
        if (input.value !== "") {
            soma += parseFloat(input.value);
            cont++;
        }
    });
    return cont > 0 ? soma / cont : 0;
}

function calcular() {
    // 1. Médias de Forma Atual (Ataque e Defesa)
    const gpA = getMedia('.golsA');
    const gsA = getMedia('.golsSofridosA');
    const gpB = getMedia('.golsB');
    const gsB = getMedia('.golsSofridosB');

    // 2. Médias do Confronto Direto (H2H)
    const h2hA = getMedia('.h2hA');
    const h2hB = getMedia('.h2hB');

    // 3. Cruzamento de Dados (Peso: 60% Forma Atual / 40% H2H)
    // Se não houver H2H, o sistema usa 100% a forma atual
    const lambdaA = h2hA > 0 ? (gpA * 0.6 + h2hA * 0.4) : (gpA + gsB) / 2;
    const lambdaB = h2hB > 0 ? (gpB * 0.6 + h2hB * 0.4) : (gpB + gsA) / 2;

    let probOver15 = 0;
    let probUnder35 = 0;

    // Calcular matriz de placares (até 6 gols por time)
    for (let i = 0; i <= 6; i++) {
        for (let j = 0; j <= 6; j++) {
            let p = poisson(i, lambdaA) * poisson(j, lambdaB);
            let totalGols = i + j;

            if (totalGols > 1.5) probOver15 += p;
            if (totalGols < 3.5) probUnder35 += p;
        }
    }

    exibirResultados(probOver15, probUnder35);
}

function exibirResultados(pOver, pUnder) {
    const oddMercadoO15 = parseFloat(document.getElementById('mercadoOver15').value) || 0;
    const oddMercadoU35 = parseFloat(document.getElementById('mercadoUnder35').value) || 0;

    const oddJustaO15 = 1 / pOver;
    const oddJustaU35 = 1 / pUnder;

    const valorO15 = oddMercadoO15 > oddJustaO15 ?
        `<span style="color:green">✅ VALOR (EV+)</span>` : `<span style="color:red">❌ SEM VALOR</span>`;

    const valorU35 = oddMercadoU35 > oddJustaU35 ?
        `<span style="color:green">✅ VALOR (EV+)</span>` : `<span style="color:red">❌ SEM VALOR</span>`;

    document.getElementById('resultado').innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="res-box">
                <h4>Mercado Over 1.5</h4>
                <p>Probabilidade: <b>${(pOver * 100).toFixed(1)}%</b></p>
                <p>Odd Justa: <b>${oddJustaO15.toFixed(2)}</b></p>
                <p>Status: ${valorO15}</p>
            </div>
            <div class="res-box">
                <h4>Mercado Under 3.5</h4>
                <p>Probabilidade: <b>${(pUnder * 100).toFixed(1)}%</b></p>
                <p>Odd Justa: <b>${oddJustaU35.toFixed(2)}</b></p>
                <p>Status: ${valorU35}</p>
            </div>
        </div>
    `;
}












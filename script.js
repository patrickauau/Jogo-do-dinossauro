const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// dino maior: 60x60, apoiado no chão (270)
const dino = { x: 50, y: 210, w: 60, h: 60, pulando: false, velY: 0 };
const gravidade = 0.4;           // queda padrão
const gravidadeSegurando = 0.3;  // subida com espaço segurado: arco firme
const gravidadeSolto = 0.65;     // soltou no meio da subida: corta o pulo
const velocidadeQuedaMax = 6.5;  // teto de queda: pouso sem "soco"
const chao = 270;
const velocidadeMaxima = 11;     // teto de velocidade do jogo

// hitbox do pássaro: 40x30 (o DESENHO é maior, a hitbox não muda)
let cacto = { x: 800, y: 230, w: 30, h: 40 };
let inimigoAereo = { x: -100, y: 190, w: 40, h: 30, ativo: false };
let pontos = 0;
let velocidade = 5;              // começa mais calmo
let fimDeJogo = false;
let espacoPressionado = false;   // rastreia se o espaço está segurado
let particulasChao = [];
for (let i = 0; i < 18; i++) {
  particulasChao.push({
    x: Math.random() * canvas.width,
    y: chao + 6 + Math.random() * 24,   // entre 6 e 30px abaixo da linha
    tamanho: 1 + Math.random() * 2,     // pontinhos de 1 a 3px
    fator: 0.4 + Math.random() * 0.6    // cada uma corre a uma fração da velocidade
  });
}

// recorde salvo no navegador (sobrevive ao fechamento da página)
let melhorPontuacao = Number(localStorage.getItem("recordeDino")) || 0;

// ===== SPRITES (arquivos individuais) =====
const nomesSprites = {
  corrida: [
    "dinossauroCorrendo1.png",
    "dinossauroCorrendo2.png",
    "dinossauroCorrendo3.png",
    "dinossauroCorrendo4.png"
  ],
  morte: [
    "dinossauroMorte1.png",
    "dinossauroMorte2.png"
  ],
  cenario: [
    "cacto.png",    // sheet com 2 frames lado a lado
    "passaro.png"   // sheet com 2 frames lado a lado
  ]
};

// pré-carrega todas as imagens
const imagens = {};
let carregadas = 0;
const total = nomesSprites.corrida.length + nomesSprites.morte.length + nomesSprites.cenario.length;

for (const lista of Object.values(nomesSprites)) {
  for (const nome of lista) {
    const img = new Image();
    img.onload = () => {
      carregadas++;
      if (carregadas === total) console.log("✅ Todas as sprites carregadas!");
    };
    img.onerror = () => console.log("❌ Erro ao carregar: " + nome);
    img.src = nome;
    imagens[nome] = img;
  }
}

const animacoes = {
  corrida: { lista: nomesSprites.corrida },
  morte:   { lista: nomesSprites.morte }
};

let frameAtual = 0;
let contador = 0;
let animacaoAnterior = null;
let contadorPiscada = 0;

function atualizarAnimacao() {
  const nomeAnim = fimDeJogo ? "morte" : "corrida";

  // se a animação mudou (morreu ou reiniciou), volta pro primeiro frame
  if (nomeAnim !== animacaoAnterior) {
    animacaoAnterior = nomeAnim;
    frameAtual = 0;
    contador = 0;
    contadorPiscada = 0;
  }

  const anim = animacoes[nomeAnim];

  // velocidade por animação: corrida rápida, morte em câmera lenta
  const intervalo = fimDeJogo ? 30 : 8;

  contador++;
  if (contador % intervalo === 0) {
    if (fimDeJogo) {
      // morte: avança até o último frame e congela
      if (frameAtual < anim.lista.length - 1) frameAtual++;
    } else {
      // corrida: loop infinito
      frameAtual = (frameAtual + 1) % anim.lista.length;
    }
  }
}

function desenharDino() {
  const anim = fimDeJogo ? animacoes.morte : animacoes.corrida;
  const img = imagens[anim.lista[frameAtual]];
  if (!img) return; // proteção: nunca desenha undefined

  if (fimDeJogo && frameAtual >= anim.lista.length - 1) {
    // animação de morte terminou: dino pisca durante o congelamento
    contadorPiscada++;
    const visivel = Math.floor(contadorPiscada / 15) % 2 === 0;
    if (!visivel) return; // frame "apagado": não desenha
  }

  ctx.drawImage(img, dino.x, dino.y, dino.w, dino.h);
}

// desenha uma sheet de N frames lado a lado, alternando entre eles
function desenharSheet(nome, x, y, w, h, intervalo, totalFrames) {
  const img = imagens[nome];
  if (!img || !img.width) return false; // sheet não carregou: usa fallback
  const frames = totalFrames || 2;      // padrão: 2 frames (pássaro)
  const frame = Math.floor(contador / intervalo) % frames;
  const larguraFrame = img.width / frames;
  ctx.drawImage(img, frame * larguraFrame, 0, larguraFrame, img.height, x, y, w, h);
  return true;
}

// ===== CONTROLES =====
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  espacoPressionado = true;

  // pulo: impulso firme, a altura vem do arco ao segurar
  if (!dino.pulando && !fimDeJogo) {
    dino.pulando = true;
    dino.velY = -7;
  }
  // reinício: só depois do congelamento com piscada (~1 segundo)
  if (fimDeJogo && contadorPiscada > 60) {
    fimDeJogo = false;
    pontos = 0;
    velocidade = 5;
    cacto.x = 800;
    inimigoAereo.ativo = false;
    frameAtual = 0;
  }
});

// soltou o espaço: apenas libera o "foguete" da subida
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") espacoPressionado = false;
});

// ===== LÓGICA =====
function atualizar() {
  atualizarAnimacao();
  if (fimDeJogo) return;

  // pontos acumulam conforme o cenário se move (proporcional à velocidade)
  pontos += velocidade / 20;

  // física do pulo: subida firme, queda com teto, pouso pronto pro próximo
  if (dino.pulando) {
    const subindo = dino.velY < 0;
    // segurando: arco controlado | soltou no meio: corta na hora
    const g = subindo ? (espacoPressionado ? gravidadeSegurando : gravidadeSolto) : gravidade;
    dino.y += dino.velY;
    dino.velY += g;
    // teto de queda: desce rápido, mas sem acelerar pra sempre
    if (dino.velY > velocidadeQuedaMax) dino.velY = velocidadeQuedaMax;
    if (dino.y >= chao - dino.h) {
      dino.y = chao - dino.h;
      dino.pulando = false;
      dino.velY = 0;
    }
  }

  // areia do chão: corre pra esquerda e recicla na direita (roda SEMPRE, pulando ou não)
  for (const p of particulasChao) {
    p.x -= velocidade * p.fator;
    if (p.x < -4) {
      p.x = canvas.width + Math.random() * 80;
      p.y = chao + 6 + Math.random() * 24;
      p.tamanho = 1 + Math.random() * 2;
      p.fator = 0.4 + Math.random() * 0.6;
    }
  }

  // movimento do cacto
  cacto.x -= velocidade;
  if (cacto.x + cacto.w < 0) {
    cacto.x = 800 + Math.random() * 400; // reaparece entre 800 e 1200
    velocidade = Math.min(velocidade + 0.1, velocidadeMaxima);
  }

  // inimigo aéreo: só aparece bem depois do início (pontos > 150)
  if (!inimigoAereo.ativo && Math.floor(pontos) > 150 && Math.random() < 0.003) {
    inimigoAereo.ativo = true;
    inimigoAereo.x = 800 + Math.random() * 200;
    // baixo (185): na altura da cabeça, exige pulo firme | alto (85): passe por baixo
    inimigoAereo.y = Math.random() < 0.5 ? 185 : 85;
    console.log(inimigoAereo.y === 185 ? "🛸 Passaro BAIXO (pule!)" : "🛸 Passaro ALTO (passe por baixo!)");
  }

  // movimento do inimigo aéreo: mesma velocidade do cacto
  if (inimigoAereo.ativo) {
    inimigoAereo.x -= velocidade;
    if (inimigoAereo.x + inimigoAereo.w < 0) inimigoAereo.ativo = false;
  }

  // colisão com o cacto (hitbox reduzida: perdão de 4px por lado)
  const perdaoCacto = 4;
  const colidiuCacto =
    dino.x < cacto.x + cacto.w - perdaoCacto &&
    dino.x + dino.w > cacto.x + perdaoCacto &&
    dino.y < cacto.y + cacto.h - perdaoCacto &&
    dino.y + dino.h > cacto.y + perdaoCacto;

  // colisão com o inimigo aéreo (hitbox reduzida: perdão de 6px por lado)
  const perdao = 6;
  const colidiuAereo =
    inimigoAereo.ativo &&
    dino.x < inimigoAereo.x + inimigoAereo.w - perdao &&
    dino.x + dino.w > inimigoAereo.x + perdao &&
    dino.y < inimigoAereo.y + inimigoAereo.h - perdao &&
    dino.y + dino.h > inimigoAereo.y + perdao;

  if (colidiuCacto || colidiuAereo) {
    fimDeJogo = true;
    // salva o recorde se a pontuação atual for maior
    if (Math.floor(pontos) > melhorPontuacao) {
      melhorPontuacao = Math.floor(pontos);
      localStorage.setItem("recordeDino", melhorPontuacao);
    }
  }
}

// ===== DESENHO =====
function desenhar() {
  // fundo roxo escuro (mesma cor da sheet, esconde o fundo dos sprites)
  ctx.fillStyle = "#371d5b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // chão
  ctx.fillStyle = "#999";
  ctx.fillRect(0, chao, canvas.width, 2);
  ctx.fillStyle = "rgba(201, 168, 106, 0.6)"; // areia translúcida
  for (const p of particulasChao) {
    ctx.fillRect(p.x, p.y, p.tamanho, p.tamanho);
  }

  desenharDino();

  // cacto: sprite animado (3 frames de balanço), com retângulo como fallback
  if (!desenharSheet("cacto.png", cacto.x, cacto.y, cacto.w, cacto.h, 30, 3)) {
    ctx.fillStyle = "#2e8b57";
    ctx.fillRect(cacto.x, cacto.y, cacto.w, cacto.h);
  }

  // inimigo aéreo: DESENHO maior (60x45) centralizado na hitbox (40x30)
  if (inimigoAereo.ativo) {
    const larguraVisual = 60;
    const alturaVisual = 45;
    const deslocX = (larguraVisual - inimigoAereo.w) / 2;  // 10px pra cada lado
    const deslocY = (alturaVisual - inimigoAereo.h) / 2;   // 7.5px pra cada lado
    const desenhou = desenharSheet(
      "passaro.png",
      inimigoAereo.x - deslocX,
      inimigoAereo.y - deslocY,
      larguraVisual,
      alturaVisual,
      15,
      2
    );
    if (!desenhou) {
      ctx.fillStyle = "#ff2fd6";
      ctx.fillRect(inimigoAereo.x - deslocX, inimigoAereo.y - deslocY, larguraVisual, alturaVisual);
    }
  }

  // pontuação atual (canto esquerdo)
  ctx.fillStyle = "#fff";
  ctx.font = "16px monospace";
  ctx.textAlign = "left";
  ctx.fillText("Pontos: " + Math.floor(pontos), 20, 30);

  // melhor pontuação (canto direito)
  ctx.textAlign = "right";
  ctx.fillText("Recorde: " + melhorPontuacao, canvas.width - 20, 30);
  ctx.textAlign = "left";

  if (fimDeJogo) {
    ctx.fillText("Fim de jogo! Aperte espaço pra reiniciar", 250, 150);
  }
}

function loop() {
  atualizar();
  desenhar();
  requestAnimationFrame(loop);
}

loop();
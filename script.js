const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// dino maior: 60x60, apoiado no chão (270)
const dino = { x: 50, y: 210, w: 60, h: 60, pulando: false, velY: 0 };
const gravidade = 0.6;
const chao = 270;

let cacto = { x: 800, y: 230, w: 30, h: 40 };
let pontos = 0;
let velocidade = 6;
let fimDeJogo = false;

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
  ]
};

// pré-carrega todas as imagens
const imagens = {};
let carregadas = 0;
const total = nomesSprites.corrida.length + nomesSprites.morte.length;

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

  if (nomeAnim !== animacaoAnterior) {
    animacaoAnterior = nomeAnim;
    frameAtual = 0;
    contador = 0;
    contadorPiscada = 0;
  }

  const anim = animacoes[nomeAnim];
  const intervalo = fimDeJogo ? 30 : 8;

  contador++;
  if (contador % intervalo === 0) {
    if (fimDeJogo) {
      if (frameAtual < anim.lista.length - 1) frameAtual++;
    } else {
      frameAtual = (frameAtual + 1) % anim.lista.length;
    }
  }
}

function desenharDino() {
  const anim = fimDeJogo ? animacoes.morte : animacoes.corrida;
  const img = imagens[anim.lista[frameAtual]];
  if (!img) return;

  if (fimDeJogo && frameAtual >= anim.lista.length - 1) {
    // animação de morte terminou: dino pisca durante o congelamento
    contadorPiscada++;
    const visivel = Math.floor(contadorPiscada / 15) % 2 === 0;
    if (!visivel) return; // frame "apagado": não desenha
  }

  ctx.drawImage(img, dino.x, dino.y, dino.w, dino.h);
}

// ===== CONTROLES =====
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !dino.pulando && !fimDeJogo) {
    dino.pulando = true;
    dino.velY = -12;
  }
  if (e.code === "Space" && fimDeJogo && contadorPiscada > 60) {
    fimDeJogo = false;
    pontos = 0;
    velocidade = 6;
    cacto.x = 800;
    frameAtual = 0;
  }
});

// ===== LÓGICA =====
function atualizar() {
  atualizarAnimacao();
  if (fimDeJogo) return;

  // física do pulo
  if (dino.pulando) {
    dino.y += dino.velY;
    dino.velY += gravidade;
    if (dino.y >= chao - dino.h) {
      dino.y = chao - dino.h;
      dino.pulando = false;
      dino.velY = 0;
    }
  }

  // movimento do cacto
  cacto.x -= velocidade;
  if (cacto.x + cacto.w < 0) {
    cacto.x = 800;
    pontos++;
    velocidade += 0.3;
  }

  // colisão
  if (
    dino.x < cacto.x + cacto.w &&
    dino.x + dino.w > cacto.x &&
    dino.y < cacto.y + cacto.h &&
    dino.y + dino.h > cacto.y
  ) {
    fimDeJogo = true;
  }
}

// ===== DESENHO =====
function desenhar() {
  // fundo roxo escuro (mesma cor da sheet, esconde o fundo dos sprites)
  ctx.fillStyle = "#1a0b2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // chão
  ctx.fillStyle = "#999";
  ctx.fillRect(0, chao, canvas.width, 2);

  desenharDino();

  // cacto
  ctx.fillStyle = "#2e8b57";
  ctx.fillRect(cacto.x, cacto.y, cacto.w, cacto.h);

  // pontuação
  ctx.fillStyle = "#fff";
  ctx.font = "16px monospace";
  ctx.fillText("Pontos: " + pontos, 20, 30);

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
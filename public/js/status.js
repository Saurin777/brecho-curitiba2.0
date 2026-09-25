// status.js - "Status" da logo, no estilo dos stories do Instagram
// Mostra as peças que entraram nos DESTAQUES nas últimas 24 horas.
// A lista vem pronta do servidor (/api/produtos/status): é automático, basta
// marcar a peça como destaque no painel admin que ela aparece aqui na hora.

const STATUS_DURACAO_MS = 5000;            // tempo de cada "tela" do status
const STATUS_CHAVE_VISTOS = 'statusVistos'; // memória local de quais já foram vistos

let statusItens = [];
let statusIndice = 0;
let statusTimer = null;
let statusInicioTela = 0;
let statusRestante = STATUS_DURACAO_MS;
let statusPausado = false;
let statusOverlay = null;
let statusAtualizacaoTimer = null;

// ---------- memória de "já vi esse status" ----------
// A chave inclui a data de entrada no destaque: se a peça sair e voltar aos
// destaques, ela conta como novidade de novo.
function chaveStatus(item) {
  return `${item.id}|${item.featuredAt}`;
}

function lerVistos() {
  try {
    const bruto = localStorage.getItem(STATUS_CHAVE_VISTOS);
    return bruto ? JSON.parse(bruto) : [];
  } catch (e) {
    return [];
  }
}

function salvarVisto(item) {
  try {
    const vistos = lerVistos();
    const chave = chaveStatus(item);
    if (!vistos.includes(chave)) {
      vistos.push(chave);
      // guarda no máximo 200 chaves para não crescer sem parar
      localStorage.setItem(STATUS_CHAVE_VISTOS, JSON.stringify(vistos.slice(-200)));
    }
  } catch (e) { /* localStorage indisponível: tudo bem, só perde a memória */ }
}

function foiVisto(item) {
  return lerVistos().includes(chaveStatus(item));
}

// ---------- tempo relativo ("há 3 h") ----------
function tempoRelativo(iso) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `há ${horas} h`;
}

// ---------- anel em volta da logo ----------
async function iniciarStatusLogo() {
  const botao = document.getElementById('btnLogoStatus');
  const anel = document.getElementById('anelStatus');
  if (!botao || !anel) return;

  try {
    statusItens = await apiFetch('/api/produtos/status');
  } catch (e) {
    statusItens = [];
  }

  clearInterval(statusAtualizacaoTimer);
  statusAtualizacaoTimer = setInterval(atualizarItensStatus, 5000);

  if (!statusItens.length) {
    anel.classList.remove('com-status', 'status-novo', 'status-visto');
    return;
  }

  atualizarAnel();


  botao.addEventListener('click', (e) => {
    if (!statusItens.length) return; // sem novidades: o clique segue para a home
    e.preventDefault();
    const primeiroNaoVisto = statusItens.findIndex(item => !foiVisto(item));
    abrirStatus(primeiroNaoVisto === -1 ? 0 : primeiroNaoVisto);
  });

  botao.setAttribute('aria-label', `Ver novidades (${statusItens.length} peça(s) nova(s))`);
  botao.setAttribute('title', 'Novidades dos destaques');
}

async function atualizarItensStatus() {
  try {
    const atualizados = await apiFetch('/api/produtos/status');
    const itemAtual = statusItens[statusIndice];
    statusItens = atualizados;
    let itemSaiuDaLista = false;
    if (itemAtual) {
      const novoIndice = statusItens.findIndex(item => String(item.id) === String(itemAtual.id));
      if (novoIndice >= 0) statusIndice = novoIndice;
      else {
        itemSaiuDaLista = true;
        statusIndice = Math.min(statusIndice, Math.max(statusItens.length - 1, 0));
      }
    }
    const anel = document.getElementById('anelStatus');
    if (!statusItens.length && anel) {
      anel.classList.remove('com-status', 'status-novo', 'status-visto');
      const badge = anel.parentElement.querySelector('.badge-status');
      if (badge) badge.remove();
      if (statusOverlay) fecharStatus();
      return;
    }
    atualizarAnel();
    if (statusOverlay && statusItens[statusIndice]) {
      if (itemSaiuDaLista) mostrarTela();
      else atualizarRodapeStatus(statusItens[statusIndice]);
    }
  } catch (e) { /* mantém o status carregado se a rede oscilar */ }
}

function atualizarAnel() {
  const anel = document.getElementById('anelStatus');
  if (!anel) return;
  const naoVistos = statusItens.filter(item => !foiVisto(item)).length;

  anel.classList.add('com-status');
  anel.classList.toggle('status-novo', naoVistos > 0);
  anel.classList.toggle('status-visto', naoVistos === 0);

  let badge = anel.parentElement.querySelector('.badge-status');
  if (naoVistos > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'badge-status';
      anel.parentElement.appendChild(badge);
    }
    badge.textContent = naoVistos;
  } else if (badge) {
    badge.remove();
  }
}

// ---------- visualizador ----------
function abrirStatus(indice) {
  if (statusOverlay) return;
  statusIndice = indice;

  statusOverlay = document.createElement('div');
  statusOverlay.className = 'status-overlay';
  statusOverlay.innerHTML = `
    <div class="status-caixa" role="dialog" aria-modal="true" aria-label="Novidades dos destaques">
      <div class="status-barras" id="statusBarras"></div>

      <div class="status-topo">
        <img class="status-logo" src="${(configuracoesSite && configuracoesSite.logoUrl) || '/img/logo-padrao.svg'}"
             alt="" onerror="this.src='/img/logo-padrao.svg'">
        <div class="status-titulo">
          <strong>${(configuracoesSite && configuracoesSite.nomeLoja) || 'Novidades'}</strong>
          <span id="statusTempo"></span>
        </div>
        <button type="button" class="status-fechar" id="statusFechar" aria-label="Fechar">&times;</button>
      </div>

      <div class="status-palco" id="statusPalco"></div>

      <button type="button" class="status-zona status-zona-esq" id="statusAnterior" aria-label="Anterior"></button>
      <button type="button" class="status-zona status-zona-dir" id="statusProximo" aria-label="Próximo"></button>

      <div class="status-rodape" id="statusRodape"></div>
    </div>
  `;
  document.body.appendChild(statusOverlay);
  document.body.classList.add('sem-rolagem');
  requestAnimationFrame(() => statusOverlay.classList.add('mostrar'));

  montarBarras();
  document.getElementById('statusFechar').addEventListener('click', fecharStatus);
  document.getElementById('statusAnterior').addEventListener('click', () => irPara(statusIndice - 1));
  document.getElementById('statusProximo').addEventListener('click', () => irPara(statusIndice + 1));
  statusOverlay.addEventListener('click', (e) => { if (e.target === statusOverlay) fecharStatus(); });

  // segurar o dedo/mouse pausa, igual no Instagram
  const palco = document.getElementById('statusPalco');
  ['pointerdown'].forEach(ev => palco.addEventListener(ev, pausarStatus));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => palco.addEventListener(ev, retomarStatus));

  document.addEventListener('keydown', teclasStatus);
  mostrarTela();
}

function teclasStatus(e) {
  if (!statusOverlay) return;
  if (e.key === 'Escape') fecharStatus();
  if (e.key === 'ArrowRight') irPara(statusIndice + 1);
  if (e.key === 'ArrowLeft') irPara(statusIndice - 1);
  if (e.key === ' ') { e.preventDefault(); statusPausado ? retomarStatus() : pausarStatus(); }
}

function montarBarras() {
  const barras = document.getElementById('statusBarras');
  barras.innerHTML = statusItens
    .map((_, i) => `<div class="status-barra"><span class="status-barra-preenche" data-i="${i}"></span></div>`)
    .join('');
}

function mostrarTela() {
  const item = statusItens[statusIndice];
  if (!item) return fecharStatus();

  const palco = document.getElementById('statusPalco');
  const rodape = document.getElementById('statusRodape');

  // A foto aparece inteira (sem esticar nem cortar). O fundo desfocado da própria
  // imagem preenche as sobras, do mesmo jeito que o Instagram faz nos stories.
  palco.innerHTML = item.image
    ? `<div class="status-moldura ${item.vendida ? 'status-moldura--vendida' : ''}">
         <div class="status-fundo" style="background-image:url('${item.image}')"></div>
         <img class="status-imagem" src="${item.image}" alt="${item.name}">
         ${item.vendida ? '<span class="status-selo-vendida">VENDIDA</span>' : ''}
       </div>`
    : `<div class="status-sem-imagem"><span>${item.name}</span>${item.vendida ? '<span class="status-selo-vendida">VENDIDA</span>' : ''}</div>`;

  atualizarRodapeStatus(item);

  document.getElementById('statusTempo').textContent = tempoRelativo(item.featuredAt);

  // barras: anteriores cheias, atual animando, próximas vazias
  document.querySelectorAll('.status-barra-preenche').forEach(el => {
    const i = Number(el.dataset.i);
    el.style.transition = 'none';
    el.style.width = i < statusIndice ? '100%' : '0%';
  });

  salvarVisto(item);
  atualizarAnel();
  iniciarContagem(STATUS_DURACAO_MS);
}

function atualizarRodapeStatus(item) {
  const rodape = document.getElementById('statusRodape');
  if (!rodape) return;
  rodape.innerHTML = item.vendida
    ? `<div class="status-info status-info-vendida"><strong class="status-nome">${item.name}</strong></div>`
    : `
      <a class="status-info" href="/produto.html?id=${item.id}">
        ${item.category ? `<span class="status-categoria">${item.category}</span>` : ''}
        <strong class="status-nome">${item.name}</strong>
        <span class="status-preco">${
          emPromocao(item)
            ? `<s class="status-preco-antigo">${formatarPreco(item.promo.originalPrice)}</s> ${formatarPreco(item.price)} <span class="status-selo-promo">-${percentualDesconto(item)}%</span>`
            : formatarPreco(item.price)
        }</span>
      </a>
      <a class="status-cta" href="/produto.html?id=${item.id}">Ver peça</a>
    `;
}

function barraAtual() {
  return document.querySelector(`.status-barra-preenche[data-i="${statusIndice}"]`);
}

function iniciarContagem(duracao) {
  clearTimeout(statusTimer);
  statusRestante = duracao;
  statusInicioTela = Date.now();
  statusPausado = false;

  const barra = barraAtual();
  if (barra) {
    const percorrido = 100 - (duracao / STATUS_DURACAO_MS) * 100;
    barra.style.transition = 'none';
    barra.style.width = `${percorrido}%`;
    // força o navegador a aplicar o estado inicial antes de animar
    void barra.offsetWidth;
    barra.style.transition = `width ${duracao}ms linear`;
    barra.style.width = '100%';
  }

  statusTimer = setTimeout(() => irPara(statusIndice + 1), duracao);
}

function pausarStatus() {
  if (statusPausado || !statusOverlay) return;
  statusPausado = true;
  clearTimeout(statusTimer);
  statusRestante = Math.max(300, statusRestante - (Date.now() - statusInicioTela));
  const barra = barraAtual();
  if (barra) {
    const largura = barra.getBoundingClientRect().width;
    const total = barra.parentElement.getBoundingClientRect().width || 1;
    barra.style.transition = 'none';
    barra.style.width = `${(largura / total) * 100}%`;
  }
}

function retomarStatus() {
  if (!statusPausado || !statusOverlay) return;
  statusPausado = false;
  iniciarContagem(statusRestante);
}

function irPara(novoIndice) {
  if (novoIndice < 0) return; // já está no primeiro
  if (novoIndice >= statusItens.length) return fecharStatus();

  // ao voltar, a barra da tela atual volta a zero
  if (novoIndice < statusIndice) {
    const barra = barraAtual();
    if (barra) { barra.style.transition = 'none'; barra.style.width = '0%'; }
  }
  statusIndice = novoIndice;
  mostrarTela();
}

function fecharStatus() {
  clearTimeout(statusTimer);
  document.removeEventListener('keydown', teclasStatus);
  document.body.classList.remove('sem-rolagem');
  if (statusOverlay) {
    statusOverlay.classList.remove('mostrar');
    const ref = statusOverlay;
    statusOverlay = null;
    setTimeout(() => ref.remove(), 200);
  }
  atualizarAnel();
}

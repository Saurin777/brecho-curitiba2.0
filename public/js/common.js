// common.js - monta cabeçalho/rodapé e funções usadas em todas as páginas

const ICONES = {
  coracao: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6c-1.9-1.9-5-1.9-6.9 0L12 6.5l-1.9-1.9c-1.9-1.9-5-1.9-6.9 0-1.9 1.9-1.9 5 0 6.9L12 20.3l8.8-8.8c1.9-1.9 1.9-5 0-6.9z"/></svg>`,
  carrinho: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  usuario: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  sair: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="#E8703A" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="6"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1.1" fill="#E8703A" stroke="none"/></svg>`,
  whatsapp: `<svg viewBox="0 0 32 32" fill="#E8703A"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.4.7 4.6 1.9 6.5L4 29l7.7-1.9c1.8 1 3.9 1.5 6.3 1.5 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-2.1 0-4.1-.6-5.8-1.6l-.4-.2-4.6 1.2 1.2-4.5-.3-.5C4.9 17.6 4.3 15.8 4.3 14 4.3 8.7 9.7 4.3 16 4.3S27.7 8.7 27.7 14 22.3 24.8 16 24.8zm6.2-8.4c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-2-1.8-2.3-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6 0-.2-.8-1.9-1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.9 5 3.5 1.4 3.5.9 4.1.8.6-.1 2-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.1-.3-.2-.6-.4z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  estrela: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.2 6.8.7-5.1 4.6 1.5 6.7L12 17.2l-6.1 3.5 1.5-6.7-5.1-4.6 6.8-.7L12 2.5z"/></svg>`
};

let usuarioAtual = null;
let configuracoesSite = null;

function escaparHtml(valor) {
  return String(valor).replace(/[&<>'"]/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[caractere]);
}

async function apiFetch(url, options = {}) {
  const resp = await fetch(url, {
    credentials: 'include',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options
  });
  let data = null;
  try { data = await resp.json(); } catch (e) { /* sem corpo */ }
  if (!resp.ok) {
    throw new Error((data && data.erro) || 'Ocorreu um erro. Tente novamente.');
  }
  return data;
}

async function carregarUsuario() {
  try {
    usuarioAtual = await apiFetch('/api/auth/me');
  } catch (e) {
    usuarioAtual = null;
  }
  return usuarioAtual;
}

async function carregarConfiguracoes() {
  configuracoesSite = await apiFetch('/api/configuracoes');
  return configuracoesSite;
}

async function montarCabecalho() {
  await Promise.all([carregarUsuario(), carregarConfiguracoes()]);

  const el = document.getElementById('cabecalho');
  if (!el) return;

  const linkConta = usuarioAtual
    ? `<button id="btnSair" class="btn-sair" title="Sair da conta">${ICONES.sair} Sair</button>`
    : `<a href="/login.html">${ICONES.usuario} Entrar</a>`;

  // Admin: o menu "Admin" reúne "Pedidos/Vendas", "Histórico comp." e "Painel Admin",
  // que abre ao passar o mouse (no celular, abre no primeiro toque).
  const linkAdmin = usuarioAtual && usuarioAtual.isAdmin
    ? `<div class="menu-admin" id="menuAdmin">
         <a href="/admin.html" class="btn btn-secundario menu-admin-gatilho" style="padding:8px 16px;" aria-haspopup="true">
           Admin
           <svg class="menu-admin-seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
         </a>
         <span class="badge-contagem" data-badge-pedidos style="display:none">0</span>
         <div class="menu-admin-lista">
           <div class="menu-admin-caixa" role="menu">
             <a href="/pedidos.html" role="menuitem">Pedidos/Vendas
               <span class="badge-contagem badge-inline" data-badge-pedidos style="display:none">0</span>
             </a>
             <a href="/historico.html" role="menuitem">Histórico comp.</a>
             <a href="/admin.html?aba=clientes" role="menuitem">Clientes</a>
             <a href="/admin.html" role="menuitem">Painel Admin</a>
           </div>
         </div>
       </div>` : '';

  // Cliente comum: o menu "Pedidos" reúne "Pendentes" e "Histórico",
  // que abre ao passar o mouse (no celular, abre no primeiro toque).
  const linkMeusPedidos = usuarioAtual && !usuarioAtual.isAdmin
    ? `<div class="menu-admin" id="menuPedidosCliente">
         <a href="/meus-pedidos.html" class="btn btn-secundario menu-admin-gatilho" style="padding:8px 16px;" aria-haspopup="true">
           Pedidos
           <svg class="menu-admin-seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
         </a>
         <span class="badge-contagem" data-badge-pedidos style="display:none">0</span>
         <div class="menu-admin-lista">
           <div class="menu-admin-caixa" role="menu">
             <a href="/meus-pedidos.html" role="menuitem">Pendentes
               <span class="badge-contagem badge-inline" data-badge-pedidos style="display:none">0</span>
             </a>
             <a href="/historico.html" role="menuitem">Histórico</a>
           </div>
         </div>
       </div>` : '';
  const saudacao = usuarioAtual
    ? `<span class="saudacao-usuario">Olá, ${escaparHtml(usuarioAtual.name.split(' ')[0])}!</span>` : '';

  el.innerHTML = `
    <div class="header-inner">
      ${saudacao}
      <div class="logo-area">
        <a href="/index.html" class="logo-botao" id="btnLogoStatus" title="Início">
          <span class="anel-status" id="anelStatus">
            <img src="${configuracoesSite.logoUrl}" alt="Logo ${configuracoesSite.nomeLoja}" onerror="this.src='/img/logo-padrao.svg'">
          </span>
        </a>
        <a href="/index.html" class="logo-nome">${configuracoesSite.nomeLoja}</a>
      </div>
      <form class="campo-busca busca-topo" id="formBuscaTopo" role="search">
        <svg class="icone-busca" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="search" id="campoBusca" placeholder="Buscar peça ou categoria..." autocomplete="off" aria-label="Buscar peça ou categoria">
        <button type="button" class="limpar-busca" id="btnLimparBusca" title="Limpar busca" style="display:none">&times;</button>
      </form>
      <nav class="nav-links">
        <a href="/index.html">Início</a>
        <a href="/favoritos.html" class="icon-link" title="Favoritos" aria-label="Favoritos">
          ${ICONES.coracao}
          <span class="badge-contagem" id="contagemFavoritos" style="display:none">0</span>
        </a>
        <a href="/carrinho.html" class="icon-link" title="Carrinho" aria-label="Carrinho">
          ${ICONES.carrinho}
          <span class="badge-contagem" id="contagemCarrinho" style="display:none">0</span>
        </a>
        ${linkMeusPedidos}
        ${linkAdmin}
        ${linkConta}
        <div class="social-icons">
          <a href="${configuracoesSite.instagram}" target="_blank" title="Instagram">${ICONES.instagram}</a>
          <a href="https://wa.me/${configuracoesSite.whatsapp}" target="_blank" title="WhatsApp">${ICONES.whatsapp}</a>
        </div>
      </nav>
    </div>
  `;

  marcarAbaAtiva();
  configurarMenuAdmin();

  const buscaMobile = document.getElementById('formBuscaTopo');
  if (buscaMobile && window.matchMedia('(max-width: 760px)').matches) {
    let ultimaRolagem = window.scrollY;
    window.addEventListener('scroll', () => {
      const atual = window.scrollY;
      if (atual < 40) buscaMobile.classList.remove('busca-oculta');
      else if (atual > ultimaRolagem + 1) buscaMobile.classList.add('busca-oculta');
      else if (atual < ultimaRolagem - 1) buscaMobile.classList.remove('busca-oculta');
      ultimaRolagem = atual;
    }, { passive: true });
  }

  // Em páginas que não são a vitrine, a busca leva o termo para a home
  const formBusca = document.getElementById('formBuscaTopo');
  if (formBusca) {
    formBusca.addEventListener('submit', (e) => {
      e.preventDefault();
      if (document.body.dataset.pagina === 'inicio') return; // na vitrine o main.js filtra ao vivo
      const termo = document.getElementById('campoBusca').value.trim();
      window.location.href = termo ? `/index.html?busca=${encodeURIComponent(termo)}` : '/index.html';
    });
  }

  const btnSair = document.getElementById('btnSair');
  if (btnSair) {
    btnSair.addEventListener('click', async () => {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/index.html';
    });
  }

  await atualizarBadgesContagem();

  // "Status" da logo: peças que entraram nos destaques nas últimas 24h
  if (typeof iniciarStatusLogo === 'function') {
    iniciarStatusLogo();
  }
}

// Menus suspensos (Admin / Pedidos do cliente): abrem por hover (CSS). Em
// telas de toque não existe hover, então tocar no gatilho abre/fecha o menu.
function configurarMenuAdmin() {
  const menus = document.querySelectorAll('.menu-admin');
  if (!menus.length) return;

  menus.forEach(menu => {
    const gatilho = menu.querySelector('.menu-admin-gatilho');
    if (!gatilho) return;
    gatilho.addEventListener('click', (e) => {
      // O gatilho é só o título do menu: clicar/tocar abre ou fecha a lista (o hover abre no desktop)
      e.preventDefault();
      menu.classList.toggle('aberto');
    });
  });

  document.addEventListener('click', (e) => {
    menus.forEach(menu => {
      if (!menu.contains(e.target)) menu.classList.remove('aberto');
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') menus.forEach(menu => menu.classList.remove('aberto'));
  });
}

// Destaca no menu a aba da página em que o usuário está (sublinhado + cor).
function marcarAbaAtiva() {
  let atual = window.location.pathname.replace(/\/+$/, '');
  if (atual === '' || atual === '/') atual = '/index.html';
  document.querySelectorAll('.nav-links a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href.startsWith('/') || href.startsWith('//')) return;
    const destino = href.split(/[?#]/)[0];
    const ativo = destino === atual;
    a.classList.toggle('ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  // Se a página atual é um item do menu do admin, o "Admin" também fica destacado
  const gatilho = document.querySelector('.menu-admin-gatilho');
  if (gatilho && document.querySelector('.menu-admin-lista a.ativo')) {
    gatilho.classList.add('ativo');
  }
}

// O botão "Voltar" do navegador às vezes restaura a página de um cache congelado
// (bfcache), sem executar o JS de novo — por isso os numerinhos do carrinho/favoritos
// ficavam desatualizados. Isso força a atualização sempre que a página volta a ficar visível.
window.addEventListener('pageshow', (evento) => {
  if (evento.persisted) {
    atualizarBadgesContagem();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    atualizarBadgesContagem();
  }
});

// Atualiza os numerinhos ao lado dos ícones de favoritos e carrinho, e o aviso
// de novos pedidos ao lado de "Pedidos/Vendas" (só para o admin).
async function atualizarBadgesContagem() {
  await Promise.all([
    atualizarBadgesFavoritosCarrinho(),
    atualizarBadgePedidos()
  ]);
}

async function atualizarBadgesFavoritosCarrinho() {
  const elFavoritos = document.getElementById('contagemFavoritos');
  const elCarrinho = document.getElementById('contagemCarrinho');
  if (!elFavoritos || !elCarrinho) return;

  if (!usuarioAtual) {
    elFavoritos.style.display = 'none';
    elCarrinho.style.display = 'none';
    return;
  }

  try {
    const [favoritos, carrinho] = await Promise.all([
      apiFetch('/api/favoritos').catch(() => []),
      apiFetch('/api/carrinho').catch(() => [])
    ]);

    if (favoritos.length > 0) {
      elFavoritos.textContent = favoritos.length;
      elFavoritos.style.display = 'flex';
    } else {
      elFavoritos.style.display = 'none';
    }

    if (carrinho.length > 0) {
      elCarrinho.textContent = carrinho.length;
      elCarrinho.style.display = 'flex';
    } else {
      elCarrinho.style.display = 'none';
    }
  } catch (e) { /* ignora falha ao atualizar contadores */ }
}

// Aviso de pedidos novos ainda não vistos: soma 1 a cada pedido que chegou
// desde a última vez que o usuário abriu a aba (fica até ele clicar nela).
async function atualizarBadgePedidos() {
  const badges = document.querySelectorAll('[data-badge-pedidos]');
  if (!badges.length) return;

  const esconder = () => badges.forEach(b => { b.style.display = 'none'; });

  if (!usuarioAtual) {
    esconder();
    return;
  }

  try {
    const resposta = await apiFetch('/api/pedidos/notificacoes');
    if (resposta && resposta.contagem > 0) {
      badges.forEach(b => {
        b.textContent = resposta.contagem;
        b.style.display = 'flex';
      });
    } else {
      esconder();
    }
  } catch (e) { /* ignora falha ao atualizar o aviso de pedidos */ }
}

// Marca os pedidos como vistos (chamado ao abrir "Pedidos/Vendas" ou "Pedidos
// Pendentes") e some com o numerinho de aviso.
async function marcarPedidosComoVistos() {
  try {
    await apiFetch('/api/pedidos/marcar-visto', { method: 'POST' });
  } catch (e) { /* ignora */ }
  await atualizarBadgePedidos();
}

function montarRodape() {
  const el = document.getElementById('rodape');
  if (!el || !configuracoesSite) return;
  el.innerHTML = `
    <footer class="rodape">
      ${configuracoesSite.nomeLoja} &middot; roupas com história, prontas para uma nova jornada 🧡
    </footer>
  `;
}

function formatarPreco(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ---------- Promoções ----------
// Quando a peça está em promoção, produto.price já é o valor com desconto e
// produto.promo.originalPrice guarda o preço cheio (o que aparece riscado).
function emPromocao(produto) {
  return !!(produto && produto.promo && produto.promo.originalPrice > produto.price);
}

function percentualDesconto(produto) {
  if (!emPromocao(produto)) return 0;
  const original = produto.promo.originalPrice;
  return Math.round(((original - produto.price) / original) * 100);
}

// Bloco de preço usado nos cards da vitrine, favoritos e status
function blocoPreco(produto, classe = 'preco') {
  if (!emPromocao(produto)) {
    return `<div class="${classe}">${formatarPreco(produto.price)}</div>`;
  }
  return `
    <div class="${classe} preco-em-promocao">
      <span class="preco-antigo">${formatarPreco(produto.promo.originalPrice)}</span>
      <span class="preco-novo">${formatarPreco(produto.price)}</span>
      <span class="selo-promocao">-${percentualDesconto(produto)}%</span>
    </div>
  `;
}

// Converte o tempo que falta em algo legível: "12h 30min" / "45min" / "38s"
function contagemRegressiva(endsAt) {
  const restante = new Date(endsAt).getTime() - Date.now();
  if (restante <= 0) return null;
  const segundos = Math.floor(restante / 1000);
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  if (horas > 0) return `${horas}h ${String(minutos).padStart(2, '0')}min`;
  if (minutos > 0) return `${minutos}min ${String(segundos % 60).padStart(2, '0')}s`;
  return `${segundos}s`;
}

// Bloco de preço + cronômetro dos CARDS (feed, destaques, favoritos...), já
// com o "container" que o cronômetro precisa pra se auto-atualizar sozinho.
// Uso: `<div id="precoCard-${produto.id}">${precoComCronometroCard(produto)}</div>`
function precoComCronometroCard(produto) {
  return blocoPreco(produto) + cronometroCard(produto);
}

// Só aparece quando a promoção tem prazo definido (produto.promo.endsAt).
function cronometroCard(produto) {
  if (!emPromocao(produto) || !produto.promo.endsAt) return '';
  return `
    <div class="selo-promocao-card">
      <span class="rotulo-promocao-card">🔥 Promoção</span>
      <span class="mini-cronometro" data-ends="${produto.promo.endsAt}" data-id="${produto.id}">⏳ ${contagemRegressiva(produto.promo.endsAt) || ''}</span>
    </div>
  `;
}

// Quando o cronômetro de um card zera, o preço já voltou ao normal no servidor
// (regra em db.js), então a gente busca a peça de novo e troca o preço no card
// na hora — sem precisar dar F5 na página.
async function atualizarPrecoCardExpirado(id) {
  const container = document.getElementById(`precoCard-${id}`);
  try {
    const produto = await apiFetch(`/api/produtos/${id}`);
    if (container) container.innerHTML = precoComCronometroCard(produto);
  } catch (e) { /* se falhar, o cronômetro já mostra "Promoção encerrada" */ }
}

// Atualiza, a cada segundo, todos os mini-cronômetros visíveis na página
// (funciona em qualquer lista, mesmo quando os cards são re-renderizados).
if (!window.__cronometrosCardsAtivos) {
  window.__cronometrosCardsAtivos = true;
  setInterval(() => {
    document.querySelectorAll('.mini-cronometro[data-ends]').forEach(el => {
      const texto = contagemRegressiva(el.dataset.ends);
      if (!texto) {
        if (el.dataset.expirando) return; // já disparou a atualização, evita repetir
        el.dataset.expirando = '1';
        el.textContent = 'Promoção encerrada';
        el.classList.add('mini-cronometro-encerrado');
        atualizarPrecoCardExpirado(el.dataset.id);
      } else {
        el.textContent = `⏳ ${texto}`;
      }
    });
  }, 1000);
}

// ---------- Notificações (substitui o alert() nativo do navegador) ----------
function mostrarNotificacao(mensagem, tipo = 'sucesso') {
  let container = document.getElementById('containerNotificacoes');
  if (!container) {
    container = document.createElement('div');
    container.id = 'containerNotificacoes';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `
    <span class="toast-icone">${tipo === 'erro' ? ICONES.x : ICONES.coracao}</span>
    <span class="toast-texto">${mensagem}</span>
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('mostrar'));

  setTimeout(() => {
    toast.classList.remove('mostrar');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ---------- Confirmação (substitui o confirm() nativo do navegador) ----------
function confirmarAcao(mensagem, textoConfirmar = 'Confirmar') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay-confirmacao';
    overlay.innerHTML = `
      <div class="caixa-confirmacao">
        <p class="texto-confirmacao">${mensagem}</p>
        <div class="acoes-confirmacao">
          <button type="button" class="btn btn-outline" id="btnCancelarConfirmacao">Cancelar</button>
          <button type="button" class="btn btn-perigo" id="btnOkConfirmacao">${textoConfirmar}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('mostrar'));

    function fechar(resultado) {
      overlay.classList.remove('mostrar');
      setTimeout(() => overlay.remove(), 180);
      resolve(resultado);
    }

    overlay.querySelector('#btnOkConfirmacao').addEventListener('click', () => fechar(true));
    overlay.querySelector('#btnCancelarConfirmacao').addEventListener('click', () => fechar(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(false); });
    document.addEventListener('keydown', function escFechar(e) {
      if (e.key === 'Escape') { fechar(false); document.removeEventListener('keydown', escFechar); }
    });
  });
}

function exigirLoginOuRedirecionar() {
  if (!usuarioAtual) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

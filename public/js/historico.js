// historico.js - aba "Histórico comp." (histórico de compras)
// Cliente logado vê só as próprias compras. Administrador vê as compras de
// todos os clientes, separadas por nome. Cada linha é um resumo simplificado;
// ao clicar, abre o detalhe completo (data, hora, valor e foto).

const ICONE_SETA_HIST = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`;

const STATUS_HISTORICO_LABEL = {
  aguardando: 'Aguardando confirmação',
  reservado: 'Reservado',
  vendido: 'Comprado',
  cancelado: 'Cancelado'
};

let pedidosHistorico = [];
let filtroHistoricoPecaAtual = '';
let filtroHistoricoClienteAtual = '';

function normalizarTextoFiltroHist(texto) {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function pedidoCombinaFiltroHistorico(pedido) {
  if (filtroHistoricoPecaAtual) {
    const nomesPecas = normalizarTextoFiltroHist((pedido.items || []).map(i => i.productName).join(' '));
    if (!nomesPecas.includes(filtroHistoricoPecaAtual)) return false;
  }
  if (filtroHistoricoClienteAtual) {
    const nomeCliente = normalizarTextoFiltroHist(pedido.customerName);
    if (!nomeCliente.includes(filtroHistoricoClienteAtual)) return false;
  }
  return true;
}

function filtroHistoricoAtivo() {
  return !!(filtroHistoricoPecaAtual || filtroHistoricoClienteAtual);
}

function montarFiltroHistorico() {
  const barra = document.getElementById('filtroHistorico');
  const campoPeca = document.getElementById('filtroHistoricoPeca');
  const campoCliente = document.getElementById('filtroHistoricoCliente');
  const btnLimpar = document.getElementById('btnLimparFiltroHistorico');
  if (!barra || !campoPeca || !campoCliente) return;

  barra.style.display = 'flex';

  campoPeca.addEventListener('input', () => {
    filtroHistoricoPecaAtual = normalizarTextoFiltroHist(campoPeca.value);
    renderizarClientes(pedidosHistorico);
  });
  campoCliente.addEventListener('input', () => {
    filtroHistoricoClienteAtual = normalizarTextoFiltroHist(campoCliente.value);
    renderizarClientes(pedidosHistorico);
  });
  btnLimpar.addEventListener('click', () => {
    campoPeca.value = '';
    campoCliente.value = '';
    filtroHistoricoPecaAtual = '';
    filtroHistoricoClienteAtual = '';
    renderizarClientes(pedidosHistorico);
  });
}

function dataHoraHist(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
function dataSomenteHist(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('pt-BR');
}
function horaSomenteHist(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ===== Linha simplificada de um pedido (resumo) =====
function renderizarLinhaHistorico(pedido) {
  const primeiro = pedido.items && pedido.items[0];
  const imagem = (primeiro && primeiro.image) || '/img/logo-padrao.svg';
  const status = STATUS_HISTORICO_LABEL[pedido.status] || pedido.status;
  const mostrarValores = usuarioAtual && usuarioAtual.isAdmin;
  const qtdItens = (pedido.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
  const linhaSecundaria = mostrarValores
    ? `<span>${qtdItens} ${qtdItens === 1 ? 'peça' : 'peças'} · ${formatarPreco(pedido.total)}</span>` : '';

  return `
    <button type="button" class="pedido-linha" data-pedido-id="${pedido.id}">
      <span class="pedido-linha-thumb"><img src="${imagem}" alt=""></span>
      <span class="pedido-linha-principal">
        <strong>${primeiro && primeiro.productName ? escaparHtml(primeiro.productName) : `Compra #${pedido.id}`}${(pedido.items || []).length > 1 ? ` +${(pedido.items || []).length - 1}` : ''}</strong>
        ${linhaSecundaria}
      </span>
      <span class="pedido-linha-status status-badge status-${pedido.status}">${status}</span>
      <span class="pedido-linha-data">${dataHoraHist(pedido.createdAt)}</span>
      <span class="pedido-linha-seta">${ICONE_SETA_HIST}</span>
    </button>
  `;
}

function listaOuVazia(pedidos) {
  if (!pedidos.length) {
    return `<div class="fila-vazia"><div class="fila-vazia-icone">🛍️</div><strong>Nenhuma compra por aqui ainda.</strong><span>Assim que uma compra for feita, ela aparece neste histórico.</span></div>`;
  }
  return `<div class="fila-pedidos">${pedidos.map(renderizarLinhaHistorico).join('')}</div>`;
}

function ativarCliquesLinhas(container) {
  container.querySelectorAll('.pedido-linha').forEach(btn => {
    btn.addEventListener('click', () => abrirDetalheHistorico(Number(btn.dataset.pedidoId)));
  });
}

// ===== Visão do cliente comum: lista direta das próprias compras =====
// Sem valor nem quantidade de peças aqui - só a contagem de compras.
function renderizarResumoCliente(pedidos) {
  const el = document.getElementById('resumoHistorico');
  if (!el) return;
  el.innerHTML = `
    <div class="resumo-card"><span class="resumo-valor">${pedidos.length}</span><span class="resumo-rotulo">${pedidos.length === 1 ? 'Compra no histórico' : 'Compras no histórico'}</span></div>
  `;
}

function renderizarPedidosCliente(pedidos) {
  const area = document.getElementById('areaHistorico');
  if (!area) return;
  area.innerHTML = listaOuVazia(pedidos);
  ativarCliquesLinhas(area);
}

// ===== Visão do administrador: agrupado por cliente =====
function agruparPorCliente(pedidos) {
  const mapa = new Map();
  pedidos.forEach(p => {
    const chave = p.userId || p.customerEmail || p.customerName;
    if (!mapa.has(chave)) {
      mapa.set(chave, { nome: p.customerName || 'Cliente', email: p.customerEmail || '', pedidos: [] });
    }
    mapa.get(chave).pedidos.push(p);
  });
  return [...mapa.values()].sort((a, b) => {
    const dataA = a.pedidos[0] ? new Date(a.pedidos[0].createdAt) : 0;
    const dataB = b.pedidos[0] ? new Date(b.pedidos[0].createdAt) : 0;
    return dataB - dataA;
  });
}

function renderizarResumoAdmin(pedidos) {
  const el = document.getElementById('resumoHistorico');
  if (!el) return;
  const clientes = agruparPorCliente(pedidos);
  const total = pedidos.reduce((s, p) => s + Number(p.total || 0), 0);
  el.innerHTML = `
    <div class="resumo-card"><span class="resumo-valor">${clientes.length}</span><span class="resumo-rotulo">${clientes.length === 1 ? 'Cliente' : 'Clientes'}</span></div>
    <div class="resumo-card"><span class="resumo-valor">${pedidos.length}</span><span class="resumo-rotulo">${pedidos.length === 1 ? 'Compra' : 'Compras'} no total</span></div>
    <div class="resumo-card"><span class="resumo-valor">${formatarPreco(total)}</span><span class="resumo-rotulo">Valor total movimentado</span></div>
  `;
}

function renderizarClientes(pedidos) {
  const area = document.getElementById('areaHistorico');
  if (!area) return;

  const pedidosFiltrados = pedidos.filter(pedidoCombinaFiltroHistorico);
  const clientes = agruparPorCliente(pedidosFiltrados);
  if (!clientes.length) {
    area.innerHTML = filtroHistoricoAtivo()
      ? `<div class="fila-vazia"><div class="fila-vazia-icone">🔎</div><strong>Nenhuma compra encontrada com esse filtro.</strong><span>Tente outro termo de busca.</span></div>`
      : `<div class="fila-vazia"><div class="fila-vazia-icone">🛍️</div><strong>Nenhuma compra registrada ainda.</strong><span>As compras dos clientes vão aparecer aqui, separadas por nome.</span></div>`;
    return;
  }

  area.innerHTML = `<div class="clientes-historico">${clientes.map((cliente, indice) => {
    const totalCliente = cliente.pedidos.reduce((s, p) => s + Number(p.total || 0), 0);
    return `
      <div class="cliente-historico-card" data-cliente-indice="${indice}">
        <button type="button" class="cliente-historico-cabecalho">
          <span>
            <span class="cliente-historico-nome">${escaparHtml(cliente.nome)}</span>
            <span class="cliente-historico-meta">${cliente.email ? escaparHtml(cliente.email) + ' · ' : ''}${cliente.pedidos.length} ${cliente.pedidos.length === 1 ? 'compra' : 'compras'} · ${formatarPreco(totalCliente)}</span>
          </span>
          <span class="cliente-historico-seta">${ICONE_SETA_HIST}</span>
        </button>
        <div class="cliente-historico-lista">${listaOuVazia(cliente.pedidos)}</div>
      </div>
    `;
  }).join('')}</div>`;

  area.querySelectorAll('.cliente-historico-cabecalho').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.cliente-historico-card').classList.toggle('aberto');
    });
  });
  ativarCliquesLinhas(area);
}

// ===== Detalhe completo (data, hora, valor e foto) =====
function abrirDetalheHistorico(id) {
  const pedido = pedidosHistorico.find(p => p.id === id);
  if (!pedido) return;

  const mostrarValoresDetalhe = usuarioAtual && usuarioAtual.isAdmin;
  const itens = (pedido.items || []).map(item => {
    const imagem = item.image || '/img/logo-padrao.svg';
    return `
      <div class="pedido-detalhe-item">
        <img src="${imagem}" alt="${escaparHtml(item.productName || 'Produto')}">
        <div class="pedido-detalhe-item-info">
          <strong>${escaparHtml(item.productName || 'Produto')}</strong>
          <span>Tamanho: ${item.size || 'Único'}</span>
          ${mostrarValoresDetalhe ? `<span>Quantidade: ${item.quantity || 1}</span>` : ''}
          ${mostrarValoresDetalhe ? `<span>Valor pago: ${formatarPreco(Number(item.price || 0) * Number(item.quantity || 1))}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const vendidoEm = pedido.soldAt || null;
  const canceladoEm = pedido.resolvedAt && pedido.status === 'cancelado' ? pedido.resolvedAt : null;
  const statusTexto = STATUS_HISTORICO_LABEL[pedido.status] || pedido.status;

  const overlay = document.createElement('div');
  overlay.className = 'overlay-confirmacao mostrar';
  overlay.innerHTML = `
    <div class="caixa-confirmacao caixa-pedido-detalhe">
      <div class="pedido-detalhe-topo">
        <div>
          <span class="pedido-detalhe-kicker">Compra #${pedido.id}${pedido.items && pedido.items[0] && pedido.items[0].productName ? ` - ${escaparHtml(pedido.items[0].productName)}` : ''}</span>
          <h3>${usuarioAtual && usuarioAtual.isAdmin ? escaparHtml(pedido.customerName || 'Cliente') : 'Detalhes da compra'}</h3>
        </div>
        <span class="status-badge status-${pedido.status}">${statusTexto}</span>
      </div>

      <div class="pedido-detalhe-grid">
        <div><small>Data da compra</small><strong>${dataSomenteHist(pedido.createdAt)}</strong></div>
        <div><small>Hora da compra</small><strong>${horaSomenteHist(pedido.createdAt)}</strong></div>
        ${vendidoEm ? `<div><small>Data da confirmação</small><strong>${dataSomenteHist(vendidoEm)}</strong></div><div><small>Hora da confirmação</small><strong>${horaSomenteHist(vendidoEm)}</strong></div>` : ''}
        ${canceladoEm ? `<div><small>Data do cancelamento</small><strong>${dataSomenteHist(canceladoEm)}</strong></div><div><small>Hora do cancelamento</small><strong>${horaSomenteHist(canceladoEm)}</strong></div>` : ''}
      </div>

      <div class="pedido-detalhe-secao">
        <h4>Peças</h4>
        <div>${itens}</div>
      </div>

      ${mostrarValoresDetalhe ? `
      <div class="pedido-detalhe-total">
        <span>Valor total</span><strong>${formatarPreco(pedido.total)}</strong>
      </div>` : ''}

      ${usuarioAtual && usuarioAtual.isAdmin ? `
      <div class="pedido-detalhe-secao pedido-detalhe-meta">
        <span>Cliente: ${escaparHtml(pedido.customerName || '-')}</span>
        ${pedido.customerEmail ? `<span>E-mail: ${escaparHtml(pedido.customerEmail)}</span>` : ''}
      </div>` : ''}

      <div class="acoes-confirmacao pedido-detalhe-acoes">
        <button type="button" class="btn btn-outline" id="btnFecharDetalheHistorico">Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const fechar = () => overlay.remove();
  overlay.querySelector('#btnFecharDetalheHistorico').addEventListener('click', fechar);
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
  document.addEventListener('keydown', function escFechar(e) {
    if (e.key === 'Escape') { fechar(); document.removeEventListener('keydown', escFechar); }
  });
}

// ===== Carregamento =====
async function carregarHistorico() {
  const area = document.getElementById('areaHistorico');
  if (!area) return;
  try {
    pedidosHistorico = await apiFetch('/api/pedidos/historico');
  } catch (e) {
    pedidosHistorico = [];
    mostrarNotificacao(e.message || 'Não foi possível carregar o histórico.', 'erro');
  }

  if (usuarioAtual && usuarioAtual.isAdmin) {
    renderizarResumoAdmin(pedidosHistorico);
    renderizarClientes(pedidosHistorico);
  } else {
    // Aqui só entram os pedidos já resolvidos (comprados/cancelados); os que
    // ainda estão em andamento ficam em "Pendentes".
    const resolvidos = pedidosHistorico.filter(p => p.resolvido);
    renderizarResumoCliente(resolvidos);
    renderizarPedidosCliente(resolvidos);
  }
}

async function iniciarHistorico() {
  await montarCabecalho();
  montarRodape();

  if (!usuarioAtual) {
    document.getElementById('avisoLogin').style.display = 'block';
    window.location.href = '/login.html';
    return;
  }

  if (usuarioAtual.isAdmin) {
    document.getElementById('tituloHistorico').textContent = 'Histórico de compras dos clientes';
    document.getElementById('subtituloHistorico').textContent = 'Todas as compras já feitas na loja, separadas por cliente';
    montarFiltroHistorico();
  } else {
    document.getElementById('tituloHistorico').textContent = 'Histórico';
    document.getElementById('subtituloHistorico').textContent = 'Seus pedidos já comprados ou cancelados';
  }

  document.getElementById('areaHistoricoPagina').style.display = 'block';
  await carregarHistorico();
  if (!usuarioAtual.isAdmin) {
    await marcarPedidosComoVistos();
  }
}
iniciarHistorico();

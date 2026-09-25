const ICONE_OLHO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICONE_SETA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`;

let pedidosAdmin = [];
let abaPedidosAtual = 'pendentes';
let filtroPedidosPecaAtual = '';
let filtroPedidosClienteAtual = '';

function normalizarTextoFiltro(texto) {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function pedidoCombinaFiltro(pedido) {
  if (filtroPedidosPecaAtual) {
    const nomesPecas = normalizarTextoFiltro((pedido.items || []).map(i => i.productName).join(' '));
    if (!nomesPecas.includes(filtroPedidosPecaAtual)) return false;
  }
  if (filtroPedidosClienteAtual) {
    const nomeCliente = normalizarTextoFiltro(pedido.customerName);
    if (!nomeCliente.includes(filtroPedidosClienteAtual)) return false;
  }
  return true;
}

function filtroPedidosAtivo() {
  return !!(filtroPedidosPecaAtual || filtroPedidosClienteAtual);
}

function montarFiltroPedidos() {
  const campoPeca = document.getElementById('filtroPedidosPeca');
  const campoCliente = document.getElementById('filtroPedidosCliente');
  const btnLimpar = document.getElementById('btnLimparFiltroPedidos');
  if (!campoPeca || !campoCliente) return;

  campoPeca.addEventListener('input', () => {
    filtroPedidosPecaAtual = normalizarTextoFiltro(campoPeca.value);
    renderizarFila();
  });
  campoCliente.addEventListener('input', () => {
    filtroPedidosClienteAtual = normalizarTextoFiltro(campoCliente.value);
    renderizarFila();
  });
  btnLimpar.addEventListener('click', () => {
    campoPeca.value = '';
    campoCliente.value = '';
    filtroPedidosPecaAtual = '';
    filtroPedidosClienteAtual = '';
    renderizarFila();
  });
}

const STATUS_PEDIDO_LABEL = {
  aguardando: 'Aguardando confirmação',
  reservado: 'Reservado',
  vendido: 'Vendido',
  cancelado: 'Cancelado'
};

function dataHora(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
function dataSomente(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('pt-BR');
}
function horaSomente(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ===== Resumo =====
function calcularResumoPedidos(pedidos) {
  const r = { vendidoQtd: 0, vendidoTotal: 0, reservadoQtd: 0, aguardandoQtd: 0, canceladoQtd: 0 };
  pedidos.forEach(p => {
    if (p.status === 'vendido') {
      r.vendidoTotal += Number(p.total || 0);
      r.vendidoQtd += (p.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
    } else if (p.status === 'reservado') r.reservadoQtd++;
    else if (p.status === 'aguardando') r.aguardandoQtd++;
    else if (p.status === 'cancelado') r.canceladoQtd++;
  });
  return r;
}
function renderizarResumoPedidos(pedidos) {
  const el = document.getElementById('resumoPedidos');
  if (!el) return;
  const r = calcularResumoPedidos(pedidos);
  const pend = pedidos.filter(p => !p.resolvido).length;
  const resol = pedidos.filter(p => p.resolvido).length;
  el.innerHTML = `
    <div class="resumo-card"><span class="resumo-valor">${pend}</span><span class="resumo-rotulo">Pendentes</span></div>
    <div class="resumo-card"><span class="resumo-valor">${resol}</span><span class="resumo-rotulo">Resolvidos</span></div>
    <div class="resumo-card"><span class="resumo-valor">${formatarPreco(r.vendidoTotal)}</span><span class="resumo-rotulo">Vendas registradas · ${r.vendidoQtd} ${r.vendidoQtd === 1 ? 'peça' : 'peças'}</span></div>
  `;
}

function renderizarPedidoLinha(pedido) {
  const primeiro = pedido.items && pedido.items[0];
  const imagem = (primeiro && primeiro.image) || '/img/logo-padrao.svg';
  const qtdItens = (pedido.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
  const status = STATUS_PEDIDO_LABEL[pedido.status] || pedido.status;
  const detalheStatus = pedido.status === 'vendido' && pedido.soldAt
    ? `Vendido em ${dataHora(pedido.soldAt)}`
    : pedido.status === 'cancelado' ? `Cancelado em ${dataHora(pedido.resolvedAt || pedido.updatedAt)}` : `Criado em ${dataHora(pedido.createdAt)}`;

  return `
    <button type="button" class="pedido-linha" data-pedido-id="${pedido.id}">
      <span class="pedido-linha-thumb"><img src="${imagem}" alt=""></span>
      <span class="pedido-linha-principal">
        <strong>Pedido #${pedido.id}${primeiro && primeiro.productName ? ` - ${primeiro.productName}` : ''}</strong>
        <span>${pedido.customerName || 'Cliente'} · ${qtdItens} ${qtdItens === 1 ? 'item' : 'itens'}${(pedido.items || []).length > 1 ? ` · +${(pedido.items || []).length - 1} ${((pedido.items || []).length - 1) === 1 ? 'peça' : 'peças'}` : ''}</span>
      </span>
      <span class="pedido-linha-status status-badge status-${pedido.status}">${status}</span>
      <span class="pedido-linha-data">${detalheStatus}</span>
      <span class="pedido-linha-seta">${ICONE_SETA}</span>
    </button>
  `;
}

function renderizarFila() {
  const area = document.getElementById('areaPedidos');
  if (!area) return;

  const listaBase = pedidosAdmin.filter(p => abaPedidosAtual === 'pendentes' ? !p.resolvido : p.resolvido);
  const lista = listaBase.filter(pedidoCombinaFiltro);
  const vazia = filtroPedidosAtivo()
    ? 'Nenhum pedido encontrado com esse filtro.'
    : (abaPedidosAtual === 'pendentes' ? 'Nenhum pedido pendente no momento.' : 'Nenhum pedido resolvido ainda.');

  area.innerHTML = lista.length
    ? `<div class="fila-pedidos">${lista.map(renderizarPedidoLinha).join('')}</div>`
    : `<div class="fila-vazia"><div class="fila-vazia-icone">✓</div><strong>${vazia}</strong><span>${filtroPedidosAtivo() ? 'Tente outro termo de busca.' : (abaPedidosAtual === 'pendentes' ? 'Novos pedidos, reservas e vendas aparecerão aqui.' : 'Vendas após 48 horas e cancelamentos aparecerão aqui.')}</span></div>`;

  area.querySelectorAll('.pedido-linha').forEach(btn => {
    btn.addEventListener('click', () => abrirDetalhesPedido(Number(btn.dataset.pedidoId)));
  });

  atualizarAbas();
}

function atualizarAbas() {
  const p = pedidosAdmin.filter(x => !x.resolvido).length;
  const r = pedidosAdmin.filter(x => x.resolvido).length;
  document.querySelectorAll('.aba-pedidos').forEach(btn => {
    btn.classList.toggle('ativa', btn.dataset.aba === abaPedidosAtual);
    const badge = btn.querySelector('.aba-badge');
    if (badge) badge.textContent = btn.dataset.aba === 'pendentes' ? p : r;
  });
}

function montarAbas() {
  document.querySelectorAll('.aba-pedidos').forEach(btn => {
    btn.addEventListener('click', () => {
      abaPedidosAtual = btn.dataset.aba;
      renderizarFila();
    });
  });
}

function abrirDetalhesPedido(id) {
  const pedido = pedidosAdmin.find(p => p.id === id);
  if (!pedido) return;

  const itens = (pedido.items || []).map(item => {
    const imagem = item.image || '/img/logo-padrao.svg';
    return `
      <div class="pedido-detalhe-item">
        <img src="${imagem}" alt="${item.productName || 'Produto'}">
        <div class="pedido-detalhe-item-info">
          <strong>${item.productName || 'Produto'}</strong>
          <span>Tamanho: ${item.size || 'Único'}</span>
          <span>Quantidade: ${item.quantity || 1}</span>
          <span>Valor pago: ${formatarPreco(Number(item.price || 0) * Number(item.quantity || 1))}</span>
        </div>
      </div>
    `;
  }).join('');

  const vendidoEm = pedido.soldAt || null;
  const canceladoEm = pedido.resolvedAt && pedido.status === 'cancelado' ? pedido.resolvedAt : null;
  const statusTexto = STATUS_PEDIDO_LABEL[pedido.status] || pedido.status;
  const infoResolucao = pedido.resolvido
    ? (pedido.status === 'vendido'
      ? `Movido para resolvidos após 48 horas em ${dataHora(pedido.resolvedAt)}.`
      : `Cancelado e enviado para resolvidos em ${dataHora(pedido.resolvedAt)}.`)
    : '';

  const overlay = document.createElement('div');
  overlay.className = 'overlay-confirmacao mostrar';
  overlay.innerHTML = `
    <div class="caixa-confirmacao caixa-pedido-detalhe">
      <div class="pedido-detalhe-topo">
        <div>
          <span class="pedido-detalhe-kicker">Pedido #${pedido.id}${pedido.items && pedido.items[0] && pedido.items[0].productName ? ` - ${pedido.items[0].productName}` : ''}</span>
          <h3>${pedido.customerName || 'Cliente'}</h3>
        </div>
        <span class="status-badge status-${pedido.status}">${statusTexto}</span>
      </div>

      <div class="pedido-detalhe-grid">
        <div><small>Data do pedido</small><strong>${dataSomente(pedido.createdAt)}</strong></div>
        <div><small>Hora do pedido</small><strong>${horaSomente(pedido.createdAt)}</strong></div>
        ${vendidoEm ? `<div><small>Data da venda</small><strong>${dataSomente(vendidoEm)}</strong></div><div><small>Hora da venda</small><strong>${horaSomente(vendidoEm)}</strong></div>` : ''}
        ${canceladoEm ? `<div><small>Data do cancelamento</small><strong>${dataSomente(canceladoEm)}</strong></div><div><small>Hora do cancelamento</small><strong>${horaSomente(canceladoEm)}</strong></div>` : ''}
      </div>

      <div class="pedido-detalhe-secao">
        <h4>Itens do pedido</h4>
        <div>${itens}</div>
      </div>

      <div class="pedido-detalhe-total">
        <span>Total pago</span><strong>${formatarPreco(pedido.total)}</strong>
      </div>

      <div class="pedido-detalhe-secao pedido-detalhe-meta">
        <span>Cliente: ${pedido.customerName || '-'}</span>
        ${pedido.customerEmail ? `<span>E-mail: ${pedido.customerEmail}</span>` : ''}
        ${infoResolucao ? `<span>${infoResolucao}</span>` : ''}
      </div>

      <div class="acoes-confirmacao pedido-detalhe-acoes">
        <select class="select-status-pedido" id="detalheStatus">
          ${Object.entries(STATUS_PEDIDO_LABEL).map(([v,l]) => `<option value="${v}" ${pedido.status === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-outline" id="btnFecharDetalhe">Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const fechar = () => overlay.remove();
  overlay.querySelector('#btnFecharDetalhe').addEventListener('click', fechar);
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
  overlay.querySelector('#detalheStatus').addEventListener('change', async e => {
    const novo = e.target.value;
    await atualizarStatusPedido(id, novo);
    const atualizado = pedidosAdmin.find(p => p.id === id);
    if (!atualizado || (abaPedidosAtual === 'pendentes' && atualizado.resolvido) || (abaPedidosAtual === 'resolvidos' && !atualizado.resolvido)) {
      fechar();
    } else {
      fechar();
      abrirDetalhesPedido(id);
    }
  });
}

async function carregarPedidosAdmin() {
  const area = document.getElementById('areaPedidos');
  if (!area) return;
  try {
    pedidosAdmin = await apiFetch('/api/pedidos');
  } catch (e) {
    pedidosAdmin = [];
    mostrarNotificacao(e.message || 'Não foi possível carregar os pedidos.', 'erro');
  }
  renderizarResumoPedidos(pedidosAdmin);
  renderizarFila();
}

async function atualizarStatusPedido(id, status) {
  try {
    await apiFetch(`/api/pedidos/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    mostrarNotificacao(`Pedido #${id} atualizado para "${STATUS_PEDIDO_LABEL[status]}".`);
    await carregarPedidosAdmin();
  } catch (err) {
    mostrarNotificacao(err.message, 'erro');
    await carregarPedidosAdmin();
  }
}

async function iniciarPedidos() {
  await montarCabecalho();
  montarRodape();
  if (!usuarioAtual || !usuarioAtual.isAdmin) {
    document.getElementById('avisoAcesso').style.display = 'block';
    if (!usuarioAtual) window.location.href = '/login.html';
    return;
  }
  document.getElementById('areaPedidosPagina').style.display = 'block';
  montarAbas();
  montarFiltroPedidos();
  await carregarPedidosAdmin();
  await marcarPedidosComoVistos();
}
iniciarPedidos();

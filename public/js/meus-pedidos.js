// meus-pedidos.js - aba "Pedidos Pendentes" do cliente.
// Mostra, só para leitura (sem clicar para ver detalhes), os pedidos que o
// próprio cliente fechou pelo WhatsApp. O status exibido é exatamente o mesmo
// que o administrador vê e controla em "Pedidos/Vendas" - assim que ele muda
// o status por lá, a mudança aparece aqui também.

const STATUS_MEUS_PEDIDOS_LABEL = {
  aguardando: 'Aguardando confirmação',
  reservado: 'Reservado',
  vendido: 'Vendido',
  cancelado: 'Cancelado'
};

function dataHoraMeusPedidos(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function renderizarLinhaMeuPedido(pedido) {
  const primeiro = pedido.items && pedido.items[0];
  const imagem = (primeiro && primeiro.image) || '/img/logo-padrao.svg';
  const status = STATUS_MEUS_PEDIDOS_LABEL[pedido.status] || pedido.status;

  return `
    <div class="pedido-linha pedido-linha--estatico">
      <span class="pedido-linha-thumb"><img src="${imagem}" alt=""></span>
      <span class="pedido-linha-principal">
        <strong>Pedido #${pedido.id}${primeiro && primeiro.productName ? ` - ${escaparHtml(primeiro.productName)}` : ''}</strong>
      </span>
      <span class="pedido-linha-status status-badge status-${pedido.status}">${status}</span>
      <span class="pedido-linha-data">${dataHoraMeusPedidos(pedido.createdAt)}</span>
    </div>
  `;
}

async function carregarMeusPedidos() {
  const area = document.getElementById('areaMeusPedidos');
  if (!area) return;

  let pedidos = [];
  try {
    pedidos = await apiFetch('/api/pedidos/historico');
  } catch (e) {
    mostrarNotificacao(e.message || 'Não foi possível carregar seus pedidos.', 'erro');
  }

  // Aqui só aparecem os pedidos ainda em andamento (não resolvidos); pedidos
  // vendidos/cancelados vão para "Histórico".
  pedidos = pedidos.filter(p => !p.resolvido);

  if (!pedidos.length) {
    area.innerHTML = `<div class="fila-vazia"><div class="fila-vazia-icone">🛍️</div><strong>Nenhum pedido pendente por aqui.</strong><span>Assim que você fechar um pedido pelo WhatsApp, ele aparece aqui.</span></div>`;
    return;
  }

  area.innerHTML = `<div class="fila-pedidos">${pedidos.map(renderizarLinhaMeuPedido).join('')}</div>`;
}

async function iniciarMeusPedidos() {
  await montarCabecalho();
  montarRodape();

  if (!usuarioAtual) {
    document.getElementById('avisoLoginMeusPedidos').style.display = 'block';
    window.location.href = '/login.html';
    return;
  }

  // O administrador já tem a fila completa (com detalhes e controle de status)
  // em "Pedidos/Vendas" - essa página aqui é só para o cliente comum.
  if (usuarioAtual.isAdmin) {
    window.location.href = '/pedidos.html';
    return;
  }

  document.getElementById('areaMeusPedidosPagina').style.display = 'block';
  await carregarMeusPedidos();
  await marcarPedidosComoVistos();
}
iniciarMeusPedidos();

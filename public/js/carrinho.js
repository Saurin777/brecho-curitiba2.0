let itensCarrinho = [];

function calcularTotalCarrinho() {
  return itensCarrinho.reduce((soma, item) => soma + item.produto.price * item.quantity, 0);
}

function renderizarItemCarrinho(item) {
  const imagem = item.produto.images && item.produto.images[0]
    ? `<img src="${item.produto.images[0]}" alt="${item.produto.name}">`
    : `<img src="/img/logo-padrao.svg" alt="${item.produto.name}">`;

  return `
    <div class="item-carrinho" data-item-id="${item.id}">
      ${imagem}
      <div class="info">
        <div class="nome">${item.produto.name}</div>
        <div class="detalhe">Tamanho: ${item.size} &middot; ${formatarPreco(item.produto.price)}</div>
        <div class="qtd-controle">
          <button class="btn-diminuir" data-id="${item.id}" title="Diminuir">−</button>
          <span>${item.quantity}</span>
          <button class="btn-aumentar" data-id="${item.id}" title="Aumentar">+</button>
        </div>
      </div>
      <button class="btn btn-perigo btn-remover" data-id="${item.id}">Remover</button>
    </div>
  `;
}

async function carregarCarrinho() {
  const lista = document.getElementById('listaCarrinho');
  const vazio = document.getElementById('estadoVazio');
  const resumo = document.getElementById('resumoCarrinho');

  try {
    itensCarrinho = await apiFetch('/api/carrinho');
  } catch (e) {
    itensCarrinho = [];
  }

  if (itensCarrinho.length === 0) {
    lista.innerHTML = '';
    resumo.style.display = 'none';
    vazio.style.display = 'block';
    return;
  }

  vazio.style.display = 'none';
  resumo.style.display = 'flex';

  lista.innerHTML = itensCarrinho.map(renderizarItemCarrinho).join('');
  document.getElementById('totalCarrinho').textContent = formatarPreco(calcularTotalCarrinho());

  document.querySelectorAll('.btn-aumentar').forEach(btn => {
    btn.addEventListener('click', () => alterarQuantidade(btn.dataset.id, 1));
  });
  document.querySelectorAll('.btn-diminuir').forEach(btn => {
    btn.addEventListener('click', () => alterarQuantidade(btn.dataset.id, -1));
  });
  document.querySelectorAll('.btn-remover').forEach(btn => {
    btn.addEventListener('click', () => removerItemCarrinho(btn.dataset.id));
  });
}

async function alterarQuantidade(itemId, delta) {
  const item = itensCarrinho.find(i => i.id === Number(itemId));
  if (!item) return;
  const novaQtd = item.quantity + delta;
  if (novaQtd < 1) { removerItemCarrinho(itemId); return; }

  try {
    await apiFetch(`/api/carrinho/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity: novaQtd })
    });
    await carregarCarrinho();
  } catch (e) { mostrarNotificacao(e.message, 'erro'); }
}

async function removerItemCarrinho(itemId) {
  try {
    await apiFetch(`/api/carrinho/${itemId}`, { method: 'DELETE' });
    await carregarCarrinho();
    atualizarBadgesContagem();
  } catch (e) { mostrarNotificacao(e.message, 'erro'); }
}

async function finalizarPedidoWhatsApp() {
  if (!configuracoesSite || itensCarrinho.length === 0) return;

  const linhas = itensCarrinho.map(item =>
    `• ${item.produto.name} (tam. ${item.size}) x${item.quantity} - ${formatarPreco(item.produto.price * item.quantity)}`
  );
  const total = formatarPreco(calcularTotalCarrinho());
  const mensagem = `Olá! Quero fechar este pedido no ${configuracoesSite.nomeLoja}:\n\n${linhas.join('\n')}\n\nTotal: ${total}`;
  const url = `https://wa.me/${configuracoesSite.whatsapp}?text=${encodeURIComponent(mensagem)}`;

  const btn = document.getElementById('btnFinalizar');
  if (btn) btn.disabled = true;

  try {
    // registra o pedido no painel admin (status inicial: "Aguardando confirmação")
    // antes de abrir o WhatsApp, para não perder o registro caso o cliente feche a aba
    await apiFetch('/api/pedidos', { method: 'POST' });
  } catch (e) {
    mostrarNotificacao(e.message, 'erro');
    if (btn) btn.disabled = false;
    return;
  }

  window.open(url, '_blank');
  mostrarNotificacao('Pedido enviado! Aguarde a confirmação da loja pelo WhatsApp. 🧡');

  await carregarCarrinho();
  atualizarBadgesContagem();
  if (btn) btn.disabled = false;
}

async function iniciarCarrinho() {
  await montarCabecalho();
  montarRodape();
  if (!exigirLoginOuRedirecionar()) return;

  await carregarCarrinho();

  document.getElementById('btnFinalizar').addEventListener('click', finalizarPedidoWhatsApp);
}

iniciarCarrinho();

const express = require('express');
const { readDB, writeDB, nextId } = require('../db');
const { exigirLogin, exigirAdmin } = require('../middleware/auth');
const { estaVendida, estoqueDoTamanho, estoqueTotal, temGradeDeTamanhos } = require('../estoque');

const router = express.Router();
const STATUS_VALIDOS = ['aguardando', 'reservado', 'vendido', 'cancelado'];
const VENDA_PARA_RESOLVER_MS = 48 * 60 * 60 * 1000;

function statusExigeBaixa(status) {
  return status === 'reservado' || status === 'vendido';
}
// Confere se ainda há estoque suficiente para dar baixa no pedido.
// Devolve uma mensagem de erro ou null se estiver tudo certo.
function verificarEstoquePedido(db, pedido) {
  const precisa = {};
  for (const item of pedido.items) {
    const chave = `${item.productId}|${item.size}`;
    precisa[chave] = (precisa[chave] || 0) + item.quantity;
  }
  for (const chave of Object.keys(precisa)) {
    const [idProduto, tamanho] = chave.split('|');
    const produto = db.products.find(p => p.id === Number(idProduto));
    if (!produto) continue;
    const disponivel = estoqueDoTamanho(produto, tamanho);
    if (disponivel !== null && disponivel < precisa[chave]) {
      return `Estoque insuficiente: "${produto.name}" tamanho ${tamanho} tem ${disponivel} em estoque e o pedido pede ${precisa[chave]}.`;
    }
  }
  return null;
}

function aplicarBaixaEstoque(db, pedido) {
  pedido.items.forEach(item => {
    const produto = db.products.find(p => p.id === item.productId);
    if (!produto || !produto.sizes || !item.size) return;
    if (Object.prototype.hasOwnProperty.call(produto.sizes, item.size)) {
      produto.sizes[item.size] = Math.max(0, (produto.sizes[item.size] || 0) - item.quantity);
    }
  });
}
function reverterBaixaEstoque(db, pedido) {
  pedido.items.forEach(item => {
    const produto = db.products.find(p => p.id === item.productId);
    if (!produto || !produto.sizes || !item.size) return;
    if (Object.prototype.hasOwnProperty.call(produto.sizes, item.size)) {
      produto.sizes[item.size] = (produto.sizes[item.size] || 0) + item.quantity;
    }
  });
}

// Atualiza automaticamente a fila. Vendas e cancelamentos são resolvidos
// imediatamente; a venda permanece visível na vitrine por 48h.
function atualizarResolvidos(db) {
  let mudou = false;
  const agora = Date.now();

  db.orders.forEach(pedido => {
    if (pedido.status === 'cancelado') {
      if (!pedido.resolvedAt) {
        pedido.resolvedAt = pedido.updatedAt || pedido.createdAt || new Date().toISOString();
        mudou = true;
      }
      return;
    }

    if (pedido.status === 'vendido') {
      if (!pedido.soldAt) {
        const vendaHist = (pedido.history || []).filter(h => h.status === 'vendido').pop();
        pedido.soldAt = (vendaHist && vendaHist.at) || pedido.updatedAt || pedido.createdAt;
        mudou = true;
      }
      // Vendas ficam na aba Resolvidos imediatamente.
      // Se for um pedido antigo da versão anterior, faz a migração automaticamente.
      if (!pedido.resolvedAt) {
        pedido.resolvedAt = pedido.soldAt || pedido.updatedAt || pedido.createdAt || new Date(agora).toISOString();
        mudou = true;
      }
    }
  });

  return mudou;
}

function serializarPedido(pedido) {
  const resolvido = !!pedido.resolvedAt;
  return { ...pedido, resolvido };
}

// Monta a lista completa de pedidos já com foto/descrição resolvidas
// (usado tanto pela fila de Pedidos/Vendas do admin quanto pelo Histórico de compras).
function montarPedidosCompletos(db) {
  return [...db.orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(pedido => {
      // pedidos antigos podem não ter guardado a foto; recupera do produto para o detalhe.
      const itens = (pedido.items || []).map(item => {
        if (item.image) return item;
        const produto = db.products.find(p => p.id === item.productId);
        return {
          ...item,
          image: produto && produto.images && produto.images[0] ? produto.images[0] : null,
          description: item.description || (produto && produto.description) || '',
          category: item.category || (produto && produto.category) || ''
        };
      });
      return serializarPedido({ ...pedido, items: itens });
    });
}

router.get('/', exigirAdmin, (req, res) => {
  const db = readDB();
  if (atualizarResolvidos(db)) writeDB(db);
  res.json(montarPedidosCompletos(db));
});

// Histórico de compras: exige login. Cliente comum só vê os próprios pedidos;
// administrador vê os pedidos de todos os clientes (o front separa por nome).
router.get('/historico', exigirLogin, (req, res) => {
  const db = readDB();
  if (atualizarResolvidos(db)) writeDB(db);
  let pedidos = montarPedidosCompletos(db);
  if (!req.user.isAdmin) {
    pedidos = pedidos.filter(p => p.userId === req.user.id);
  }
  res.json(pedidos);
});

// Contagem de pedidos ainda não vistos: para o administrador, conta pedidos
// novos de qualquer cliente; para o cliente comum, conta só os próprios
// pedidos. Fica somando até o usuário abrir a aba (ver /marcar-visto).
router.get('/notificacoes', exigirLogin, (req, res) => {
  const db = readDB();
  const usuario = db.users.find(u => u.id === req.user.id);
  const desde = usuario && usuario.lastPedidosSeenAt ? new Date(usuario.lastPedidosSeenAt).getTime() : 0;

  let pedidos = db.orders;
  if (!req.user.isAdmin) {
    pedidos = pedidos.filter(p => p.userId === req.user.id);
  }
  const contagem = pedidos.filter(p => new Date(p.createdAt).getTime() > desde).length;
  res.json({ contagem });
});

// Marca os pedidos como vistos (chamado ao abrir "Pedidos/Vendas" ou
// "Pedidos Pendentes") - o aviso some até chegar um pedido novo.
router.post('/marcar-visto', exigirLogin, (req, res) => {
  const db = readDB();
  const usuario = db.users.find(u => u.id === req.user.id);
  if (usuario) {
    usuario.lastPedidosSeenAt = new Date().toISOString();
    writeDB(db);
  }
  res.json({ ok: true });
});

router.post('/', exigirLogin, (req, res) => {
  const db = readDB();
  const itensCarrinho = db.cart.filter(c => c.userId === req.user.id);
  if (itensCarrinho.length === 0) return res.status(400).json({ erro: 'Seu carrinho está vazio.' });

  const items = [];
  itensCarrinho.forEach(c => {
    const produto = db.products.find(p => p.id === c.productId);
    if (!produto || estaVendida(produto)) return;
    items.push({
      productId: produto.id,
      productName: produto.name,
      description: produto.description,
      category: produto.category,
      image: (produto.images && produto.images[0]) || null,
      size: c.size,
      quantity: c.quantity,
      price: produto.price
    });
  });
  if (items.length === 0) return res.status(400).json({ erro: 'Os itens do seu carrinho não estão mais disponíveis.' });

  // Confere o estoque de cada tamanho antes de fechar o pedido
  const somaPorTamanho = {};
  for (const item of items) {
    const chave = `${item.productId}|${item.size}`;
    somaPorTamanho[chave] = (somaPorTamanho[chave] || 0) + item.quantity;
  }
  for (const item of items) {
    const produto = db.products.find(p => p.id === item.productId);
    const disponivel = estoqueDoTamanho(produto, item.size);
    if (disponivel !== null && disponivel < somaPorTamanho[`${item.productId}|${item.size}`]) {
      return res.status(409).json({
        erro: disponivel <= 0
          ? `"${item.productName}" no tamanho ${item.size} acabou. Remova do carrinho para continuar.`
          : `"${item.productName}" no tamanho ${item.size} tem só ${disponivel} em estoque. Ajuste a quantidade no carrinho.`
      });
    }
  }

  const total = items.reduce((soma, item) => soma + item.price * item.quantity, 0);
  const agora = new Date().toISOString();
  const pedido = {
    id: nextId(db),
    userId: req.user.id,
    customerName: req.user.name,
    customerEmail: req.user.email,
    items,
    total,
    status: 'aguardando',
    baixaEstoque: false,
    history: [{ status: 'aguardando', at: agora }],
    createdAt: agora,
    updatedAt: agora,
    soldAt: null,
    resolvedAt: null
  };

  db.orders.push(pedido);
  db.cart = db.cart.filter(c => c.userId !== req.user.id);
  writeDB(db);
  res.status(201).json(pedido);
});

router.put('/:id/status', exigirAdmin, (req, res) => {
  const { status } = req.body;
  if (!STATUS_VALIDOS.includes(status)) return res.status(400).json({ erro: 'Status inválido.' });

  const db = readDB();
  const pedido = db.orders.find(o => o.id === Number(req.params.id));
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });

  const precisaBaixa = statusExigeBaixa(status);
  if (precisaBaixa && !pedido.baixaEstoque) {
    const erroEstoque = verificarEstoquePedido(db, pedido);
    if (erroEstoque) return res.status(409).json({ erro: erroEstoque });
    aplicarBaixaEstoque(db, pedido);
    pedido.baixaEstoque = true;
  } else if (!precisaBaixa && pedido.baixaEstoque) {
    reverterBaixaEstoque(db, pedido);
    pedido.baixaEstoque = false;
  }

  const agora = new Date().toISOString();
  if (pedido.status !== status) {
    if (!Array.isArray(pedido.history)) pedido.history = [];
    pedido.history.push({ status, at: agora });
  }
  pedido.status = status;
  pedido.updatedAt = agora;

  if (status === 'vendido') {
    pedido.soldAt = agora;
    // Venda é considerada resolvida imediatamente na fila de Pedidos/Vendas.
    pedido.resolvedAt = agora;
  } else if (status === 'cancelado') {
    pedido.resolvedAt = agora;
    pedido.soldAt = null;
  } else {
    pedido.resolvedAt = null;
    pedido.soldAt = null;
  }

  // Selo VENDIDO na vitrine: só entra quando a venda zerou o estoque de TODOS os
  // tamanhos da peça. Se ainda sobrou unidade em algum tamanho, a peça continua
  // disponível para outros clientes (só o tamanho que zerou fica desativado).
  // Se a venda for cancelada/alterada (o estoque volta), o selo sai.
  const idsTocados = [...new Set(pedido.items.map(item => item.productId))];
  idsTocados.forEach(idProduto => {
    const produto = db.products.find(p => p.id === idProduto);
    if (!produto) return;
    const semGrade = !temGradeDeTamanhos(produto);
    const zerada = semGrade || estoqueTotal(produto) === 0;

    if (status === 'vendido' && zerada) {
      produto.soldAt = agora;
      produto.soldOrderId = pedido.id;
    } else if (produto.soldAt && (produto.soldOrderId === pedido.id || !zerada)) {
      produto.soldAt = null;
      produto.soldOrderId = null;
    }
  });

  atualizarResolvidos(db);
  writeDB(db);
  res.json(serializarPedido(pedido));
});

module.exports = router;

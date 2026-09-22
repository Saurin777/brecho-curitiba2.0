const express = require('express');
const { readDB, writeDB, nextId } = require('../db');
const { exigirLogin, exigirAdmin } = require('../middleware/auth');

const router = express.Router();
const STATUS_VALIDOS = ['aguardando', 'reservado', 'vendido', 'cancelado'];
const VENDA_PARA_RESOLVER_MS = 48 * 60 * 60 * 1000;

function statusExigeBaixa(status) {
  return status === 'reservado' || status === 'vendido';
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

router.get('/', exigirAdmin, (req, res) => {
  const db = readDB();
  if (atualizarResolvidos(db)) writeDB(db);
  const pedidos = [...db.orders]
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
  res.json(pedidos);
});

router.post('/', exigirLogin, (req, res) => {
  const db = readDB();
  const itensCarrinho = db.cart.filter(c => c.userId === req.user.id);
  if (itensCarrinho.length === 0) return res.status(400).json({ erro: 'Seu carrinho está vazio.' });

  const items = [];
  itensCarrinho.forEach(c => {
    const produto = db.products.find(p => p.id === c.productId);
    if (!produto || produto.soldAt) return;
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
    // A peça, porém, continua visível na vitrine por 48h com o selo VENDIDA.
    pedido.resolvedAt = agora;

    // Marca a peça como vendida no site por 48 horas.
    pedido.items.forEach(item => {
      const produto = db.products.find(p => p.id === item.productId);
      if (produto) {
        produto.soldAt = agora;
        produto.soldOrderId = pedido.id;
      }
    });
  } else if (status === 'cancelado') {
    pedido.resolvedAt = agora;

    // Se uma venda for cancelada, a peça volta completamente ao estado
    // anterior à venda: fica disponível novamente e perde o selo VENDIDA.
    // O estoque já foi revertido acima quando havia baixa registrada.
    if (pedido.soldAt) {
      pedido.items.forEach(item => {
        const produto = db.products.find(p => p.id === item.productId);
        if (produto && produto.soldOrderId === pedido.id) {
          produto.soldAt = null;
          produto.soldOrderId = null;
        }
      });
      pedido.soldAt = null;
    }
  } else {
    pedido.resolvedAt = null;
    if (pedido.soldAt) {
      pedido.items.forEach(item => {
        const produto = db.products.find(p => p.id === item.productId);
        if (produto && produto.soldOrderId === pedido.id) {
          produto.soldAt = null;
          produto.soldOrderId = null;
        }
      });
      pedido.soldAt = null;
    }
  }

  atualizarResolvidos(db);
  writeDB(db);
  res.json(serializarPedido(pedido));
});

module.exports = router;

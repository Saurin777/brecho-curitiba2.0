const express = require('express');
const { readDB, writeDB, nextId } = require('../db');
const { exigirLogin } = require('../middleware/auth');

const router = express.Router();

// GET /api/carrinho - itens do carrinho do usuário logado, já com dados do produto
router.get('/', exigirLogin, (req, res) => {
  const db = readDB();
  const itens = db.cart
    .filter(c => c.userId === req.user.id)
    .map(item => {
      const produto = db.products.find(p => p.id === item.productId);
      return { ...item, produto };
    })
    .filter(item => item.produto); // remove itens de produtos que não existem mais

  res.json(itens);
});

// POST /api/carrinho - adiciona item { productId, size, quantity }
router.post('/', exigirLogin, (req, res) => {
  const { productId, size, quantity } = req.body;
  if (!productId || !size) {
    return res.status(400).json({ erro: 'Selecione um tamanho antes de adicionar ao carrinho.' });
  }
  const db = readDB();
  const produto = db.products.find(p => p.id === Number(productId));
  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });
  if (produto.soldAt) return res.status(409).json({ erro: 'Esta peça já foi vendida e não está mais disponível.' });

  const qtd = Math.max(1, parseInt(quantity, 10) || 1);

  const existente = db.cart.find(
    c => c.userId === req.user.id && c.productId === Number(productId) && c.size === size
  );
  if (existente) {
    existente.quantity += qtd;
  } else {
    db.cart.push({
      id: nextId(db),
      userId: req.user.id,
      productId: Number(productId),
      size,
      quantity: qtd
    });
  }
  writeDB(db);
  res.status(201).json({ ok: true });
});

// PUT /api/carrinho/:itemId - atualiza quantidade { quantity }
router.put('/:itemId', exigirLogin, (req, res) => {
  const db = readDB();
  const item = db.cart.find(c => c.id === Number(req.params.itemId) && c.userId === req.user.id);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado no carrinho.' });
  const qtd = parseInt(req.body.quantity, 10);
  if (!qtd || qtd < 1) return res.status(400).json({ erro: 'Quantidade inválida.' });
  item.quantity = qtd;
  writeDB(db);
  res.json({ ok: true });
});

// DELETE /api/carrinho/:itemId - remove item
router.delete('/:itemId', exigirLogin, (req, res) => {
  const db = readDB();
  db.cart = db.cart.filter(c => !(c.id === Number(req.params.itemId) && c.userId === req.user.id));
  writeDB(db);
  res.json({ ok: true });
});

module.exports = router;

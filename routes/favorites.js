const express = require('express');
const { readDB, writeDB } = require('../db');
const { exigirLogin } = require('../middleware/auth');

const router = express.Router();

// GET /api/favoritos - lista os produtos favoritados pelo usuário logado
router.get('/', exigirLogin, (req, res) => {
  const db = readDB();
  const idsFavoritos = db.favorites.filter(f => f.userId === req.user.id).map(f => f.productId);
  const produtos = db.products.filter(p => idsFavoritos.includes(p.id));
  res.json(produtos);
});

// POST /api/favoritos/:productId - adiciona aos favoritos
router.post('/:productId', exigirLogin, (req, res) => {
  const db = readDB();
  const productId = Number(req.params.productId);
  const jaExiste = db.favorites.some(f => f.userId === req.user.id && f.productId === productId);
  if (!jaExiste) {
    db.favorites.push({ userId: req.user.id, productId });
    writeDB(db);
  }
  res.json({ ok: true });
});

// DELETE /api/favoritos/:productId - remove dos favoritos
router.delete('/:productId', exigirLogin, (req, res) => {
  const db = readDB();
  const productId = Number(req.params.productId);
  db.favorites = db.favorites.filter(f => !(f.userId === req.user.id && f.productId === productId));
  writeDB(db);
  res.json({ ok: true });
});

module.exports = router;

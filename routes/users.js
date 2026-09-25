const express = require('express');
const { readDB, writeDB } = require('../db');
const { exigirAdmin } = require('../middleware/auth');

const router = express.Router();

function normalizarCelular(valor) {
  const numero = String(valor || '').replace(/\D/g, '');
  return numero || null;
}

function normalizarContato(body) {
  const email = String(body.email || '').trim().toLowerCase();
  const phone = normalizarCelular(body.phone);
  return { email: email || null, phone };
}

function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function dadosPublicosUsuario(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email || null,
    phone: user.phone || null,
    createdAt: user.createdAt || null,
    isAdmin: !!user.isAdmin
  };
}

// Tudo nesta rota é exclusivo do administrador e nunca devolve a senha/hash.
router.use(exigirAdmin);

router.get('/', (req, res) => {
  const db = readDB();
  const usuarios = db.users
    .filter(u => !u.isAdmin)
    .map(dadosPublicosUsuario)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  res.json(usuarios);
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const user = db.users.find(u => u.id === id);

  if (!user || user.isAdmin) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' });
  }

  const name = String(req.body.name || '').trim();
  const { email, phone } = normalizarContato(req.body);

  if (!name) return res.status(400).json({ erro: 'Informe o nome do cliente.' });
  if (!email && !phone) return res.status(400).json({ erro: 'Informe o e-mail ou o celular do cliente.' });
  if (email && !emailValido(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  if (phone && (phone.length < 10 || phone.length > 15)) {
    return res.status(400).json({ erro: 'Informe um número de celular válido, com DDD.' });
  }

  const duplicado = db.users.find(u => u.id !== id && !u.isAdmin && (
    (email && u.email === email) || (phone && u.phone === phone)
  ));
  if (duplicado) {
    return res.status(409).json({ erro: 'Já existe outra conta com este e-mail ou celular.' });
  }

  user.name = name;
  user.email = email;
  user.phone = phone;
  writeDB(db);

  res.json(dadosPublicosUsuario(user));
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const index = db.users.findIndex(u => u.id === id);

  if (index === -1 || db.users[index].isAdmin) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' });
  }
  if (id === req.user.id) {
    return res.status(400).json({ erro: 'O administrador logado não pode excluir a própria conta por aqui.' });
  }

  const [removido] = db.users.splice(index, 1);
  // Remove dados temporários ligados à conta. Pedidos antigos permanecem no histórico.
  db.favorites = (db.favorites || []).filter(item => item.userId !== id);
  db.cart = (db.cart || []).filter(item => item.userId !== id);
  writeDB(db);

  res.json({ ok: true, id: removido.id });
});

module.exports = router;

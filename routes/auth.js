const express = require('express');
const bcrypt = require('bcryptjs');
const { readDB, writeDB, nextId } = require('../db');
const { gerarToken, definirCookie, limparCookie } = require('../middleware/auth');

const router = express.Router();

function normalizarCelular(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

router.post('/registro', (req, res) => {
  const { name, password } = req.body;
  const contato = String(req.body.contato || req.body.email || '').trim();
  if (!name || !contato || !password) {
    return res.status(400).json({ erro: 'Preencha nome, e-mail ou celular e senha.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const db = readDB();
  const ehEmail = contato.includes('@');
  const emailNormalizado = ehEmail ? contato.toLowerCase() : null;
  const celularNormalizado = ehEmail ? null : normalizarCelular(contato);
  if (ehEmail && !emailValido(emailNormalizado)) {
    return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  }
  if (!ehEmail && (celularNormalizado.length < 10 || celularNormalizado.length > 15)) {
    return res.status(400).json({ erro: 'Informe um número de celular válido, com DDD.' });
  }

  const existe = db.users.find(u =>
    (emailNormalizado && u.email === emailNormalizado) ||
    (celularNormalizado && u.phone === celularNormalizado)
  );
  if (existe) {
    return res.status(409).json({ erro: 'Já existe uma conta com este e-mail ou celular.' });
  }

  const user = {
    id: nextId(db),
    name: name.trim(),
    email: emailNormalizado,
    phone: celularNormalizado,
    password: bcrypt.hashSync(password, 10),
    isAdmin: false,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  writeDB(db);

  const token = gerarToken(user);
  definirCookie(res, token);
  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, isAdmin: user.isAdmin });
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  const contato = String(req.body.contato || req.body.email || '').trim();
  if (!contato || !password) {
    return res.status(400).json({ erro: 'Informe e-mail ou celular e senha.' });
  }
  const db = readDB();
  const ehEmail = contato.includes('@');
  const identificador = ehEmail ? contato.toLowerCase() : normalizarCelular(contato);
  const user = db.users.find(u => ehEmail ? u.email === identificador : u.phone === identificador);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ erro: 'E-mail/celular ou senha incorretos.' });
  }

  const token = gerarToken(user);
  definirCookie(res, token);
  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, isAdmin: user.isAdmin });
});

router.post('/logout', (req, res) => {
  limparCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ erro: 'Não logado.' });
  res.json(req.user);
});

module.exports = router;

const jwt = require('jsonwebtoken');
const { readDB } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'brecho-curitiba-segredo-troque-isso-em-producao';
const COOKIE_NAME = 'token';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias -> usuário não precisa logar toda vez

function gerarToken(user) {
  return jwt.sign({ id: user.id, isAdmin: !!user.isAdmin }, JWT_SECRET, { expiresIn: '30d' });
}

function definirCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: MAX_AGE_MS,
    sameSite: 'lax'
    // secure: true  // habilite ao publicar o site com HTTPS
  });
}

function limparCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

// Preenche req.user se houver um cookie válido (não bloqueia se não houver)
function identificarUsuario(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = readDB();
    const user = db.users.find(u => u.id === payload.id);
    if (user) {
      req.user = { id: user.id, name: user.name, email: user.email, phone: user.phone, isAdmin: !!user.isAdmin };
    }
  } catch (e) {
    // token inválido/expirado - ignora
  }
  next();
}

function exigirLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ erro: 'É necessário estar logado.' });
  next();
}

function exigirAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
  }
  next();
}

module.exports = { gerarToken, definirCookie, limparCookie, identificarUsuario, exigirLogin, exigirAdmin };

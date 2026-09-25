const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { readDB, writeDB } = require('../db');
const { exigirAdmin } = require('../middleware/auth');

function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

const router = express.Router();

const LOGO_DIR = path.join(__dirname, '..', 'uploads', 'logo');
if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LOGO_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `logo-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/configuracoes - público (usado no cabeçalho do site)
router.get('/', (req, res) => {
  const db = readDB();
  res.json(db.settings);
});

// PUT /api/configuracoes - somente admin (whatsapp, instagram, e opcionalmente novo logo)
router.put('/', exigirAdmin, upload.single('logo'), (req, res) => {
  const db = readDB();
  const { whatsapp, instagram, nomeLoja } = req.body;
  if (whatsapp !== undefined) db.settings.whatsapp = whatsapp.replace(/\D/g, '');
  if (instagram !== undefined) db.settings.instagram = instagram.trim();
  if (nomeLoja !== undefined) db.settings.nomeLoja = nomeLoja.trim();
  if (req.body.categorias !== undefined) {
    try {
      const categorias = typeof req.body.categorias === 'string' ? JSON.parse(req.body.categorias) : req.body.categorias;
      if (!Array.isArray(categorias)) return res.status(400).json({ erro: 'Lista de categorias inválida.' });
      db.settings.categorias = [...new Set(categorias.map(c => String(c).trim()).filter(Boolean))];
    } catch (e) { return res.status(400).json({ erro: 'Lista de categorias inválida.' }); }
  }
  if (req.file) {
    db.settings.logoUrl = `/uploads/logo/${req.file.filename}`;
  }
  writeDB(db);
  res.json(db.settings);
});

// PUT /api/configuracoes/admin - somente admin logado; troca o e-mail e a senha
// usados para o login de administrador (o usuário admin atual, identificado
// pelo token, passa a ser reconhecido apenas pelo novo e-mail e nova senha).
router.put('/admin', exigirAdmin, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe o novo e-mail de login e a nova senha.' });
  }
  if (!emailValido(email)) {
    return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const db = readDB();
  const emailEmUso = db.users.find(u => u.email === email && u.id !== req.user.id);
  if (emailEmUso) {
    return res.status(409).json({ erro: 'Já existe uma conta com este e-mail.' });
  }

  const admin = db.users.find(u => u.id === req.user.id);
  if (!admin) {
    return res.status(404).json({ erro: 'Administrador não encontrado.' });
  }

  admin.email = email;
  admin.password = bcrypt.hashSync(senha, 10);
  writeDB(db);

  res.json({ ok: true, email: admin.email });
});

module.exports = router;

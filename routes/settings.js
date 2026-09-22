const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readDB, writeDB } = require('../db');
const { exigirAdmin } = require('../middleware/auth');

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
  if (req.file) {
    db.settings.logoUrl = `/uploads/logo/${req.file.filename}`;
  }
  writeDB(db);
  res.json(db.settings);
});

module.exports = router;

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readDB, writeDB, nextId } = require('../db');
const { exigirAdmin } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'products');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `produto-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB por imagem
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Apenas arquivos de imagem são permitidos.'));
  }
});

// Converte string "P:5,M:3,G:0" em objeto { P:5, M:3, G:0 }
function parseSizes(input) {
  if (!input) return {};
  if (typeof input === 'object') return input;
  const result = {};
  input.split(',').forEach(par => {
    const [tamanho, qtd] = par.split(':').map(s => s.trim());
    if (tamanho) result[tamanho.toUpperCase()] = parseInt(qtd, 10) || 0;
  });
  return result;
}

// Quanto tempo uma peça fica no "status" da logo depois de entrar nos destaques
const STATUS_DURACAO_HORAS = 24;
const VENDA_EXIBICAO_MS = 48 * 60 * 60 * 1000;

// GET /api/produtos/status
// Peças que entraram nos DESTAQUES nas últimas 24h, em ordem de chegada.
// É isso que alimenta o "status" da logo (estilo stories do Instagram).
// Precisa vir ANTES da rota /:id, senão o Express entende "status" como um id.
router.get('/status', (req, res) => {
  const db = readDB();
  const limite = Date.now() - STATUS_DURACAO_HORAS * 60 * 60 * 1000;

  const itens = db.products
    .filter(p => p.featured && p.featuredAt && new Date(p.featuredAt).getTime() > limite)
    .sort((a, b) => new Date(a.featuredAt) - new Date(b.featuredAt))
    .map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category,
      promo: p.promo || null,
      image: (p.images && p.images[0]) || null,
      featuredAt: p.featuredAt
    }));

  res.json(itens);
});

// GET /api/produtos  (lista pública; ?featured=1 filtra destaques do feed)
router.get('/', (req, res) => {
  const db = readDB();
  const agora = Date.now();
  const ehAdmin = !!(req.user && req.user.isAdmin);

  // Para clientes: uma venda continua visível por 48h com o selo VENDIDA.
  // Depois disso sai da vitrine. Para o administrador, continua disponível para gestão/histórico.
  let produtos = ehAdmin
    ? db.products
    : db.products.filter(p => !p.soldAt || agora - new Date(p.soldAt).getTime() < VENDA_EXIBICAO_MS);

  if (req.query.featured === '1') {
    produtos = produtos.filter(p => p.featured);
  }

  produtos = produtos.map(p => ({
    ...p,
    vendida: !!(p.soldAt && agora - new Date(p.soldAt).getTime() < VENDA_EXIBICAO_MS),
    vendaExpiraEm: p.soldAt ? new Date(new Date(p.soldAt).getTime() + VENDA_EXIBICAO_MS).toISOString() : null
  }));

  res.json(produtos);
});

// GET /api/produtos/:id
router.get('/:id', (req, res) => {
  const db = readDB();
  const produto = db.products.find(p => p.id === Number(req.params.id));
  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });

  const ehAdmin = !!(req.user && req.user.isAdmin);
  const vendida = !!(produto.soldAt && Date.now() - new Date(produto.soldAt).getTime() < VENDA_EXIBICAO_MS);
  if (!ehAdmin && produto.soldAt && !vendida) {
    return res.status(404).json({ erro: 'Esta peça não está mais disponível.' });
  }

  res.json({
    ...produto,
    vendida,
    vendaExpiraEm: produto.soldAt ? new Date(new Date(produto.soldAt).getTime() + VENDA_EXIBICAO_MS).toISOString() : null
  });
});

// POST /api/produtos  (somente admin) - cria produto com imagens
router.post('/', exigirAdmin, upload.array('images', 6), (req, res) => {
  const { name, description, price, category, sizes, featured } = req.body;
  if (!name || !price) {
    return res.status(400).json({ erro: 'Nome e preço são obrigatórios.' });
  }
  const db = readDB();
  const imagens = (req.files || []).map(f => `/uploads/products/${f.filename}`);
  const ehDestaque = featured === 'true' || featured === true;
  const agora = new Date().toISOString();
  const produto = {
    id: nextId(db),
    name: name.trim(),
    description: (description || '').trim(),
    price: parseFloat(price),
    category: (category || '').trim(),
    sizes: parseSizes(sizes),
    images: imagens,
    featured: ehDestaque,
    promo: null,
    // marca o instante em que virou destaque -> é o que faz o "status" aparecer
    featuredAt: ehDestaque ? agora : null,
    soldAt: null,
    soldOrderId: null,
    createdAt: agora
  };
  db.products.push(produto);
  writeDB(db);
  res.status(201).json(produto);
});

// PUT /api/produtos/:id (somente admin) - edita dados e pode adicionar novas imagens
router.put('/:id', exigirAdmin, upload.array('images', 6), (req, res) => {
  const db = readDB();
  const produto = db.products.find(p => p.id === Number(req.params.id));
  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });

  const { name, description, price, category, sizes, featured } = req.body;
  if (name !== undefined) produto.name = name.trim();
  if (description !== undefined) produto.description = description.trim();
  if (price !== undefined) {
    const novoPreco = parseFloat(price);
    if (produto.promo && novoPreco >= produto.promo.originalPrice) {
      // editou o preço para o valor cheio (ou acima): a promoção acaba
      produto.promo = null;
    } else if (produto.promo) {
      // mantém a promoção, só ajusta o valor promocional
      produto.promo = { ...produto.promo };
    }
    produto.price = novoPreco;
  }
  if (category !== undefined) produto.category = category.trim();
  if (sizes !== undefined) produto.sizes = parseSizes(sizes);
  if (featured !== undefined) {
    const novoDestaque = featured === 'true' || featured === true;
    if (novoDestaque && !produto.featured) {
      // acabou de entrar nos destaques -> entra no "status" por 24h
      produto.featuredAt = new Date().toISOString();
    } else if (!novoDestaque) {
      // saiu dos destaques -> some do "status" na hora
      produto.featuredAt = null;
    }
    produto.featured = novoDestaque;
  }

  if (req.files && req.files.length > 0) {
    const novasImagens = req.files.map(f => `/uploads/products/${f.filename}`);
    produto.images = [...(produto.images || []), ...novasImagens];
  }

  writeDB(db);
  res.json(produto);
});

// GET /api/produtos/:id/movimentacoes (somente admin) - histórico de pedidos que tocaram essa peça
router.get('/:id/movimentacoes', exigirAdmin, (req, res) => {
  const db = readDB();
  const produtoId = Number(req.params.id);
  const produto = db.products.find(p => p.id === produtoId);
  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });

  const movimentacoes = [];
  db.orders.forEach(pedido => {
    pedido.items
      .filter(item => item.productId === produtoId)
      .forEach(item => {
        (pedido.history && pedido.history.length ? pedido.history : [{ status: pedido.status, at: pedido.createdAt }])
          .forEach(h => {
            movimentacoes.push({
              orderId: pedido.id,
              size: item.size,
              quantity: item.quantity,
              status: h.status,
              at: h.at,
              customerName: pedido.customerName
            });
          });
      });
  });

  movimentacoes.sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json({ product: { id: produto.id, name: produto.name }, movimentacoes });
});

// PUT /api/produtos/:id/promocao  (somente admin)
// Coloca a peça em promoção: { price: 49.9, durationHours: 24 }
// - durationHours vazio/0 = promoção sem prazo (fica até o admin encerrar)
// - se o preço enviado for igual ou maior que o preço original, a promoção é encerrada
router.put('/:id/promocao', exigirAdmin, (req, res) => {
  const db = readDB();
  const produto = db.products.find(p => p.id === Number(req.params.id));
  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });

  const novoPreco = parseFloat(req.body.price);
  if (!isFinite(novoPreco) || novoPreco <= 0) {
    return res.status(400).json({ erro: 'Informe um preço válido.' });
  }

  // o preço "cheio" é o original da promoção que já existe, ou o preço atual
  const precoOriginal = produto.promo ? produto.promo.originalPrice : produto.price;

  if (novoPreco >= precoOriginal) {
    // voltou ao preço de antes (ou acima): a promoção acaba
    produto.price = novoPreco;
    produto.promo = null;
    writeDB(db);
    return res.json({ produto, promocaoEncerrada: true });
  }

  const horas = parseFloat(req.body.durationHours);
  const agora = new Date();
  produto.price = novoPreco;
  produto.promo = {
    originalPrice: precoOriginal,
    startedAt: agora.toISOString(),
    endsAt: isFinite(horas) && horas > 0
      ? new Date(agora.getTime() + horas * 60 * 60 * 1000).toISOString()
      : null
  };

  writeDB(db);
  res.json({ produto, promocaoEncerrada: false });
});

// DELETE /api/produtos/:id/promocao (somente admin) - encerra e devolve o preço original
router.delete('/:id/promocao', exigirAdmin, (req, res) => {
  const db = readDB();
  const produto = db.products.find(p => p.id === Number(req.params.id));
  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });

  if (produto.promo) {
    produto.price = produto.promo.originalPrice;
    produto.promo = null;
    writeDB(db);
  }
  res.json({ produto, promocaoEncerrada: true });
});

// DELETE /api/produtos/:id/imagens  - remove uma imagem específica { url: '/uploads/products/xxx.jpg' }
router.delete('/:id/imagens', exigirAdmin, (req, res) => {
  const db = readDB();
  const produto = db.products.find(p => p.id === Number(req.params.id));
  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });
  const { url } = req.body;
  produto.images = (produto.images || []).filter(img => img !== url);
  writeDB(db);
  // tenta apagar o arquivo físico
  if (url) {
    const filePath = path.join(__dirname, '..', url.replace(/^\//, ''));
    fs.unlink(filePath, () => {});
  }
  res.json(produto);
});

// DELETE /api/produtos/:id (somente admin)
router.delete('/:id', exigirAdmin, (req, res) => {
  const db = readDB();
  const idx = db.products.findIndex(p => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ erro: 'Produto não encontrado.' });
  const [removido] = db.products.splice(idx, 1);
  db.favorites = db.favorites.filter(f => f.productId !== removido.id);
  db.cart = db.cart.filter(c => c.productId !== removido.id);
  writeDB(db);
  (removido.images || []).forEach(url => {
    const filePath = path.join(__dirname, '..', url.replace(/^\//, ''));
    fs.unlink(filePath, () => {});
  });
  res.json({ ok: true });
});

module.exports = router;

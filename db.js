// db.js
// Banco de dados simples baseado em arquivo JSON (sem dependências nativas).
// Ideal para um projeto pequeno como o Brechó Curitiba.
// Se no futuro o site crescer muito, isso pode ser migrado para um banco real (MySQL/Postgres).

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function defaultData() {
  return {
    users: [],
    products: [],
    favorites: [], // { userId, productId }
    cart: [],       // { id, userId, productId, size, quantity }
    orders: [],     // { id, userId, customerName, customerEmail, items:[{productId,productName,size,quantity,price}], total, status, baixaEstoque, createdAt, updatedAt }
    settings: {
      whatsapp: '5541999999999',
      instagram: 'https://instagram.com/',
      logoUrl: '/img/logo-padrao.svg',
      nomeLoja: 'Brechó Curitiba',
      categorias: ['Calça', 'Camisa', 'Blusa', 'Bolsa', 'Acessórios', 'Jaquetas', 'Corset', 'Shorts', 'Saia', 'Bermuda', 'Vestidos', 'Casacos', 'Tricô', 'Básicas', 'Calçados', 'Outros']
    },
    nextId: 1
  };
}

function ensureDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData(), null, 2));
  }
}

function readDB() {
  ensureDB();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  const data = JSON.parse(raw);
  if (!data.settings) data.settings = defaultData().settings;
  if (!Array.isArray(data.settings.categorias)) data.settings.categorias = defaultData().settings.categorias;
  // Migração leve: garante que bancos salvos antes da funcionalidade de pedidos não quebrem
  if (!Array.isArray(data.orders)) data.orders = [];

  // Migração leve: usuários de antes do aviso de "pedidos novos" ganham um
  // marco inicial agora, para não aparecer um número gigante com pedidos antigos.
  let usuariosMudaram = false;
  (data.users || []).forEach(u => {
    if (u.lastPedidosSeenAt === undefined) {
      u.lastPedidosSeenAt = new Date().toISOString();
      usuariosMudaram = true;
    }
  });
  if (usuariosMudaram) writeDB(data);

  // Migração leve: produtos cadastrados antes do "status" da logo não têm featuredAt.
  // Usamos a data de cadastro como referência, para que peças antigas não apareçam
  // como novidade dos últimos 24h.
  (data.products || []).forEach(p => {
    if (p.featuredAt === undefined) {
      p.featuredAt = p.featured ? (p.createdAt || null) : null;
    }
    if (p.promo === undefined) p.promo = null;
  });

  // Promoções com prazo: quando o tempo acaba, o preço volta ao normal sozinho.
  if (expirarPromocoes(data)) {
    writeDB(data);
  }

  return data;
}

// Percorre os produtos e encerra as promoções cujo temporizador já venceu,
// devolvendo o preço original. Retorna true se algo mudou (para salvar o arquivo).
function expirarPromocoes(data) {
  let mudou = false;
  const agora = Date.now();
  (data.products || []).forEach(p => {
    if (p.promo && p.promo.endsAt && new Date(p.promo.endsAt).getTime() <= agora) {
      p.price = p.promo.originalPrice;
      p.promo = null;
      mudou = true;
    }
  });
  return mudou;
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function nextId(db) {
  const id = db.nextId || 1;
  db.nextId = id + 1;
  return id;
}

// Cria o usuário admin padrão e produtos de exemplo, apenas na primeira execução
function seedIfEmpty() {
  const db = readDB();
  const bcrypt = require('bcryptjs');

  if (db.users.length === 0) {
    const adminId = nextId(db);
    db.users.push({
      id: adminId,
      name: 'Administrador',
      email: 'admin@brechocuritiba.com',
      password: bcrypt.hashSync('admin123', 10),
      isAdmin: true,
      createdAt: new Date().toISOString()
    });
  }

  if (db.products.length === 0) {
    const exemplos = [
      {
        name: 'Jaqueta Jeans Vintage',
        description: 'Jaqueta jeans clássica, estado excelente, poucos usos.',
        price: 89.9,
        category: 'Jaquetas',
        sizes: { PP: 0, P: 2, M: 3, G: 1, GG: 0 },
        images: [],
        featured: true
      },
      {
        name: 'Vestido Floral Anos 90',
        description: 'Vestido leve, estampa floral, ótimo para o verão.',
        price: 64.9,
        category: 'Vestidos',
        sizes: { PP: 1, P: 2, M: 0, G: 0, GG: 0 },
        images: [],
        featured: true
      },
      {
        name: 'Camisa Social Listrada',
        description: 'Camisa social em ótimo estado, tecido leve.',
        price: 39.9,
        category: 'Camisas',
        sizes: { PP: 0, P: 1, M: 4, G: 2, GG: 1 },
        images: [],
        featured: false
      }
    ];
    exemplos.forEach(p => {
      const agora = new Date().toISOString();
      db.products.push({
        id: nextId(db),
        ...p,
        featuredAt: p.featured ? agora : null,
        createdAt: agora
      });
    });
  }

  writeDB(db);
}

module.exports = { readDB, writeDB, nextId, seedIfEmpty, expirarPromocoes, DB_PATH };

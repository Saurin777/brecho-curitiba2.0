const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { seedIfEmpty } = require('./db');
const { identificarUsuario } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const settingsRoutes = require('./routes/settings');
const favoriteRoutes = require('./routes/favorites');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');

seedIfEmpty(); // cria usuário admin e produtos de exemplo na primeira vez

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(identificarUsuario);

// Arquivos estáticos: site (public) e imagens enviadas (uploads)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/produtos', productRoutes);
app.use('/api/configuracoes', settingsRoutes);
app.use('/api/favoritos', favoriteRoutes);
app.use('/api/carrinho', cartRoutes);
app.use('/api/pedidos', orderRoutes);
app.use('/api/usuarios', userRoutes);

// Tratamento de erros do multer/upload
app.use((err, req, res, next) => {
  if (err) {
    console.error(err);
    return res.status(400).json({ erro: err.message || 'Erro ao processar a requisição.' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`\n🧡 Brechó Curitiba rodando em http://localhost:${PORT}`);
  console.log('   Login admin padrão -> e-mail: admin@brechocuritiba.com | senha: admin123');
  console.log('   (troque essa senha depois de configurar o site!)\n');
});

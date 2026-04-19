'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const prisma = require('./src/database/prisma');

// Middleware
const { authMiddleware } = require('./src/middleware/auth.middleware');
const { geral } = require('./src/middleware/rateLimit.middleware');
const { errorHandler, notFoundHandler } = require('./src/middleware/error.middleware');
const notificacoes = require('./src/services/notification.service');

// Route modules
const authRoutes = require('./src/routes/auth.routes');
const produtosRoutes = require('./src/routes/produtos.routes');
const categoriasRoutes = require('./src/routes/categorias.routes');
const vendasRoutes = require('./src/routes/vendas.routes');
const clientesRoutes = require('./src/routes/clientes.routes');
const cuponsRoutes = require('./src/routes/cupons.routes');
const notificacoesRoutes = require('./src/routes/notificacoes.routes');
const relatoriosRoutes = require('./src/routes/relatorios.routes');
const iaRoutes = require('./src/routes/ia.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Check for stock low notifications every 5 minutes
const estoqueService = require('./src/services/estoque.service');

setInterval(() => {
  estoqueService.verificarEstoqueBaixo();
}, 5 * 60 * 1000);

// ════════════════════════════
// MIDDLEWARE
// ════════════════════════════

app.use(helmet({
  contentSecurityPolicy: false, // Allow static serving
}));

// CORS: permite Vercel em produção, qualquer origem em dev
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:3001', 'http://localhost:3000']
  : true; // true = any origin (development)
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Timeout middleware - kill slow connections after 10s
app.use((req, res, next) => {
  res.setTimeout(10000, () => res.status(408).json({ erro: 'Requisicao excedeu o tempo limite' }));
  next();
});

// Rate limiting
app.use(geral);

app.use(authMiddleware);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ════════════════════════════
// ROUTES
// ════════════════════════════

// Auth
app.use('/api', authRoutes);

// Products
app.use('/api', produtosRoutes);

// Categories
app.use('/api', categoriasRoutes);

// Sales
app.use('/api', vendasRoutes);

// Clients
app.use('/api', clientesRoutes);

// Coupons
app.use('/api', cuponsRoutes);

// Notifications
app.use('/api', notificacoesRoutes);

// Reports
app.use('/api', relatoriosRoutes);

// IA
app.use('/api', iaRoutes);

// Stock
const estoqueRoutes = require('./src/routes/estoque.routes');
app.use('/api', estoqueRoutes);

// ════════════════════════════
// HEARTBEAT
// ════════════════════════════

// Swagger UI
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CortexAI POS API',
      description: 'API REST do CortexAI POS — sistema de Ponto de Venda com inteligência artificial.',
      version: '6.0.0',
    },
    servers: [{ url: `http://localhost:${PORT}`, description: 'Servidor de desenvolvimento' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: [path.join(__dirname, 'src', 'docs', 'openapi.yaml')],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CortexAI POS — API Docs',
}));

// Health check — Railway usa GET para verificar se o serviço está vivo
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Heartbeat route (ESP32 → POST para registrar presença)
let ultimoHeartbeat = null;

app.post('/api/heartbeat', (req, res) => {
  ultimoHeartbeat = Date.now();
  console.log('✅ Heartbeat ESP');
  res.json({ status: 'ok' });
});

app.get('/api/esp-status', (req, res) => {
  const online = ultimoHeartbeat !== null && Date.now() - ultimoHeartbeat < 15000;
  res.json({ online, ultimoHeartbeat });
});

// ════════════════════════════
// STATIC ROUTES
// ════════════════════════════

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ════════════════════════════
// ERROR HANDLING
// ════════════════════════════

app.use(notFoundHandler);
app.use(errorHandler);

// Initial stock check
estoqueService.verificarEstoqueBaixo().then(() => {
  notificacoes.verificarProdutosVencendo();
});

app.listen(PORT, () => {
  console.log('CortexAI POS Server v7.0');
  console.log(`Rodando na porta ${PORT}\n`);
  console.log('📡 APIs disponíveis:');
  console.log('  /api-docs       - Documentação Swagger (interativa)');
  console.log('  /api/auth/*     - Autenticação');
  console.log('  /api/produtos   - Produtos (com paginação)');
  console.log('  /api/categorias - Categorias');
  console.log('  /api/vendas     - Vendas');
  console.log('  /api/clientes   - Clientes');
  console.log('  /api/cupons     - Cupons de desconto');
  console.log('  /api/relatorios/* - Relatórios avançados');
  console.log('  /api/notificacoes/notificações');
  console.log('  /api/processar-texto - IA');
  console.log('  /api/relatorios/estoque-baixo     - Estoque baixo');
  console.log('  /api/relatorios/estoque-resumo    - Resumo estoque');
});

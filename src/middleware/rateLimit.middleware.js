'use strict';

const rateLimit = require('express-rate-limit');

// Relaxed limits — internal dashboard, don't be aggressive
const geral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { erro: 'Muitas requisicoes. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { geral };

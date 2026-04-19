'use strict';

/**
 * Error handler — middleware centralizado de tratamento de erros.
 * Captura erros não tratados, formata a resposta e log.
 */

// Must have 4 params (err, req, res, next) — Express convention
function errorHandler(err, req, res, _next) {
  // Log no formato estruturado
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor';

  if (status >= 500) {
    console.error(`[ERROR] ${err.stack || err.message}`);
  } else {
    console.warn(`[WARN] ${status} ${message}`);
  }

  res.status(status).json({
    erro: message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

/**
 * Wrapper para async route handlers — evita try/catch boilerplate.
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * NotFound — handler para rotas não encontradas.
 * Deve ser registrado por último, antes do errorHandler.
 */
function notFoundHandler(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.path}` });
}

module.exports = { errorHandler, asyncHandler, notFoundHandler };

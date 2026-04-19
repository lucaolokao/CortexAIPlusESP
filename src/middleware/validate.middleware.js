'use strict';

/**
 * Middleware para validação com Zod.
 * Usage: validate(schema) before the route handler.
 * Se a validação falha, retorna 400 com detalhes dos erros.
 */

function validate(schema) {
  return (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ erro: 'Corpo da requisição vazio' });
    }

    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));
      return res.status(400).json({
        erro: 'Dados de entrada inválidos',
        detalhes: errors,
      });
    }

    // Substitui o body com os dados normalizados pelo schema
    req.body = result.data;
    next();
  };
}

module.exports = { validate };

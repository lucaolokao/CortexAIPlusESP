'use strict';

const { verifyToken } = require('../services/auth.service');
const prisma = require('../database/prisma');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }

  req.user = decoded;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ erro: 'Autenticação necessária' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireAuth, requireRole };

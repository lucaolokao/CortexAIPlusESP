'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../database/prisma');
const JWT_SECRET = process.env.JWT_SECRET || 'cortexai-secret-key-change-in-prod';
const JWT_EXPIRES_IN = '24h';

async function hashSenha(senha) {
  return bcrypt.hash(senha, 12);
}

async function verifySenha(senha, hash) {
  return bcrypt.compare(senha, hash);
}

function generateToken(usuario) {
  return jwt.sign(
    { id: usuario.id, login: usuario.login, nome: usuario.nome, role: usuario.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function login(login, senha) {
  const usuario = await prisma.usuario.findUnique({ where: { login } });
  if (!usuario || !usuario.ativo) return null;

  const ok = await verifySenha(senha, usuario.senhaHash);
  if (!ok) return null;

  return {
    usuario: { id: usuario.id, nome: usuario.nome, login: usuario.login, role: usuario.role },
    token: generateToken(usuario),
  };
}

async function loginByPin(pin) {
  const usuario = await prisma.usuario.findFirst({ where: { pin, ativo: true } });
  if (!usuario) return null;

  return {
    usuario: { id: usuario.id, nome: usuario.nome, login: usuario.login, role: usuario.role },
    token: generateToken(usuario),
  };
}

async function registrarUsuario(data) {
  const { nome, login, senha, pin, role } = data;
  const senhaHash = await hashSenha(senha);

  try {
    return await prisma.usuario.create({
      data: {
        nome,
        login,
        senhaHash,
        pin: pin || null,
        role: role || 'operador',
      },
      select: { id: true, nome: true, login: true, role: true, ativo: true, criadoEm: true },
    });
  } catch (e) {
    if (e.code === 'P2002') throw new Error('Login já existe');
    throw e;
  }
}

module.exports = {
  hashSenha,
  verifySenha,
  generateToken,
  verifyToken,
  login,
  loginByPin,
  registrarUsuario,
  JWT_SECRET,
};

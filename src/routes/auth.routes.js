'use strict';

const express = require('express');
const router = express.Router();
const { login, loginByPin, registrarUsuario, hashSenha } = require('../services/auth.service');
const { authMiddleware, requireAuth } = require('../middleware/auth.middleware');
const prisma = require('../database/prisma');

router.post('/auth/login', async (req, res) => {
  try {
    const { login: loginInput, senha, pin } = req.body;

    if (pin) {
      const result = await loginByPin(pin);
      if (!result) return res.status(401).json({ erro: 'PIN inválido' });
      return res.json(result);
    }

    if (!loginInput || !senha) {
      return res.status(400).json({ erro: 'Login e senha são obrigatórios' });
    }

    const result = await login(loginInput, senha);
    if (!result) return res.status(401).json({ erro: 'Login ou senha inválidos' });

    res.json(result);
  } catch (e) {
    console.error('Erro no login:', e);
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

router.post('/auth/register', async (req, res) => {
  try {
    const { nome, login: loginInput, senha, pin, role } = req.body;
    if (!nome || !loginInput || !senha) {
      return res.status(400).json({ erro: 'Nome, login e senha são obrigatórios' });
    }

    const usuario = await registrarUsuario({ nome, login: loginInput, senha, pin, role });
    res.json({ sucesso: true, usuario });
  } catch (e) {
    console.error('Erro ao registrar:', e);
    if (e.message === 'Login já existe') return res.status(400).json({ erro: e.message });
    res.status(500).json({ erro: 'Erro ao registrar usuário' });
  }
});

router.get('/auth/me', authMiddleware, requireAuth, async (req, res) => {
  try {
    const user = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: { id: true, nome: true, login: true, role: true, ativo: true, criadoEm: true },
    });
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(user);
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar usuário' });
  }
});

router.put('/auth/change-pin', authMiddleware, requireAuth, async (req, res) => {
  try {
    const { novoPin } = req.body;
    if (!novoPin || novoPin.length !== 4) {
      return res.status(400).json({ erro: 'PIN deve ter exatamente 4 dígitos' });
    }

    await prisma.usuario.update({
      where: { id: req.user.id },
      data: { pin: novoPin },
    });

    res.json({ sucesso: true, mensagem: 'PIN atualizado com sucesso' });
  } catch (e) {
    console.error('Erro ao alterar PIN:', e);
    res.status(500).json({ erro: 'Erro ao alterar PIN' });
  }
});

module.exports = router;

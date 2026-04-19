'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../database/prisma');
const { validate } = require('../middleware/validate.middleware');
const { criarClienteSchema, deletarClienteSchema } = require('../validators/cliente.validator');

router.get('/clientes', async (req, res) => {
  try {
    const { q, pagina = 1, limite = 50, ativo } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    const where = {};
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { cpf: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { telefone: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (ativo !== undefined) where.ativo = ativo === 'true';

    const [data, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        orderBy: { nome: 'asc' },
        take: parseInt(limite),
        skip: pagina > 1 ? skip : undefined,
      }),
      prisma.cliente.count({ where }),
    ]);

    // Backward compat
    if (!req.query.pagina && !req.query.limite) return res.json(data);

    res.json({ data, total, page: parseInt(pagina), totalPages: Math.ceil(total / parseInt(limite)) });
  } catch (e) {
    console.error('Erro ao buscar clientes:', e);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }
});

router.post('/cliente', validate(criarClienteSchema), async (req, res) => {
  try {
    const { nome, cpf, email, telefone, endereco, obs } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });

    const cliente = await prisma.cliente.create({
      data: {
        nome,
        cpf,
        email,
        telefone,
        endereco,
        obs,
      },
    });
    res.json({ sucesso: true, cliente });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ erro: 'CPF ou email já cadastrado' });
    console.error('Erro ao criar cliente:', e);
    res.status(500).json({ erro: 'Erro ao criar cliente' });
  }
});

router.put('/cliente', async (req, res) => {
  try {
    const { id, ...dados } = req.body;
    if (!id) return res.status(400).json({ erro: 'ID obrigatório' });

    const cliente = await prisma.cliente.update({
      where: { id: parseInt(id) },
      data: { ...dados },
    });
    res.json({ sucesso: true, cliente });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ erro: 'CPF ou email já cadastrado' });
    if (e.code === 'P2025') return res.status(404).json({ erro: 'Cliente não encontrado' });
    console.error('Erro ao atualizar cliente:', e);
    res.status(500).json({ erro: 'Erro ao atualizar cliente' });
  }
});

router.delete('/cliente', validate(deletarClienteSchema), async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ erro: 'ID obrigatório' });

    await prisma.cliente.delete({ where: { id: parseInt(id) } });
    res.json({ sucesso: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ erro: 'Cliente não encontrado' });
    console.error('Erro ao deletar cliente:', e);
    res.status(500).json({ erro: 'Erro ao deletar cliente' });
  }
});

module.exports = router;

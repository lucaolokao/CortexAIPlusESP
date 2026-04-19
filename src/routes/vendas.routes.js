'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../database/prisma');
const cache = require('../services/cache.service');
const { validate } = require('../middleware/validate.middleware');
const { criarVendaSchema } = require('../validators/venda.validator');

// POST venda
router.post('/venda', validate(criarVendaSchema), async (req, res) => {
  console.log('📥 VENDA RECEBIDA:', JSON.stringify(req.body));
  const { produto, quantidade, preco, origem, audioLogId, usuarioId, clienteId, desconto, metodoPagamento, troco, cupomUsado } = req.body;
  const qtd = parseInt(quantidade);
  const prc = parseFloat(preco);
  if (!produto || isNaN(qtd) || isNaN(prc) || qtd <= 0 || prc <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos' });
  }

  try {
    const total = qtd * prc;
    const venda = await prisma.$transaction(async (tx) => {
      const produtoRegistro = await tx.produto.findFirst({
        where: { nome: { equals: produto, mode: 'insensitive' } },
      });
      if (produtoRegistro) {
        if (produtoRegistro.estoque < qtd) {
          throw new Error(`Estoque insuficiente: ${produtoRegistro.nome} tem apenas ${produtoRegistro.estoque} un.`);
        }
        const novoEstoque = produtoRegistro.estoque - qtd;
        await tx.produto.update({
          where: { id: produtoRegistro.id },
          data: { estoque: novoEstoque },
        });
      }

      return tx.venda.create({
        data: {
          produto,
          quantidade: qtd,
          preco: prc,
          total,
          origem: origem || 'manual',
          ...(audioLogId ? { audioLogId: parseInt(audioLogId) } : {}),
          ...(usuarioId ? { usuarioId: parseInt(usuarioId) } : {}),
          ...(clienteId ? { clienteId: parseInt(clienteId) } : {}),
          desconto: desconto || 0,
          metodoPagamento: metodoPagamento || null,
          troco: troco || null,
          cupomUsado: cupomUsado || null,
        },
      });
    });

    console.log(`💰 VENDA OK: ${produto} x${qtd} = R$ ${total.toFixed(2)}`);
    cache.del('/stats');

    res.json({ sucesso: true, total, venda });
  } catch (e) {
    if (e.message.startsWith('Estoque insuficiente')) {
      return res.status(400).json({ erro: e.message });
    }
    console.error('Erro ao registrar venda:', e);
    res.status(500).json({ erro: 'Erro ao registrar venda' });
  }
});

// GET historico (backward compat — returns array)
router.get('/historico', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.dataInicio) where.data = { ...where.data, gte: new Date(req.query.dataInicio) };
    if (req.query.dataFim) where.data = { ...where.data, lte: new Date(req.query.dataFim) };
    if (req.query.origem) where.origem = req.query.origem;
    if (req.query.produto) where.produto = { contains: req.query.produto, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.venda.findMany({
        where,
        orderBy: { data: 'desc' },
        take: limit,
        skip: req.query.page ? skip : undefined,
      }),
      prisma.venda.count({ where }),
    ]);

    const resultado = data.map((v) => ({ ...v, hora: v.data.toLocaleString('pt-BR') }));

    if (!req.query.page && !req.query.limit) {
      return res.json(resultado);
    }

    res.json({
      data: resultado,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasNext: skip + data.length < total,
      hasPrev: page > 1,
    });
  } catch (e) {
    console.error('Erro ao buscar histórico:', e);
    res.status(500).json({ erro: 'Erro ao buscar histórico' });
  }
});

// Alias
router.get('/vendas', async (req, res) => {
  try {
    const vendas = await prisma.venda.findMany({
      orderBy: { data: 'desc' },
      take: parseInt(req.query.limit) || 100,
    });
    const resultado = vendas.map((v) => ({ ...v, hora: v.data.toLocaleString('pt-BR') }));
    res.json(resultado);
  } catch (e) {
    console.error('Erro ao buscar vendas:', e);
    res.status(500).json({ erro: 'Erro ao buscar vendas' });
  }
});

// GET stats
router.get('/stats', cache.middleware(30_000), async (req, res) => {
  try {
    const [vendas, produtos] = await Promise.all([
      prisma.venda.findMany(),
      prisma.produto.findMany(),
    ]);
    const totalVendas = vendas.length;
    const faturamentoTotal = vendas.reduce((a, v) => parseFloat(v.total) + a, 0);
    const ticketMedio = totalVendas > 0 ? faturamentoTotal / totalVendas : 0;
    const produtosUnicos = new Set(vendas.map((v) => v.produto)).size;
    const valorEstoque = produtos.reduce(
      (a, p) => a + p.estoque * parseFloat(p.preco), 0
    );

    res.json({ totalVendas, faturamentoTotal, ticketMedio, produtosUnicos, valorEstoque });
  } catch (e) {
    console.error('Erro ao buscar stats:', e);
    res.status(500).json({ erro: 'Erro ao buscar stats' });
  }
});

// GET vendas 7 dias
router.get('/vendas-7dias', async (req, res) => {
  try {
    const resultado = [];
    for (let i = 6; i >= 0; i--) {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - i);
      inicio.setHours(0, 0, 0, 0);
      const fim = new Date(inicio);
      fim.setHours(23, 59, 59, 999);
      const vendas = await prisma.venda.findMany({
        where: { data: { gte: inicio, lte: fim } },
      });
      const totalDia = vendas.reduce((acc, v) => parseFloat(v.total) + acc, 0);
      const label = inicio.toLocaleDateString('pt-BR', { weekday: 'short' });
      const dia = String(inicio.getDate()).padStart(2, '0');
      const mes = String(inicio.getMonth() + 1).padStart(2, '0');
      const ano = inicio.getFullYear();
      resultado.push({ label, date: `${dia}/${mes}/${ano}`, total: totalDia });
    }
    res.json(resultado);
  } catch (e) {
    console.error('Erro ao buscar vendas 7 dias:', e);
    res.status(500).json({ erro: 'Erro ao buscar vendas 7 dias' });
  }
});

// GET faturamento dia
router.get('/faturamento-dia', async (req, res) => {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vendas = await prisma.venda.findMany({ where: { data: { gte: hoje } } });
    const total = vendas.reduce((acc, v) => parseFloat(v.total) + acc, 0);
    res.json({ valor: total });
  } catch (e) {
    console.error('Erro ao calcular faturamento:', e);
    res.status(500).json({ erro: 'Erro ao calcular faturamento' });
  }
});

module.exports = router;

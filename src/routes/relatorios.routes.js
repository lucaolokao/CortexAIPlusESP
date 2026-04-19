'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../database/prisma');
const cache = require('../services/cache.service');

// GET faturamento por período
router.get('/relatorios/faturamento', async (req, res) => {
  try {
    const { periodo, inicio, fim } = req.query;
    let startDate, endDate;

    if (inicio && fim) {
      startDate = new Date(inicio);
      endDate = new Date(fim);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      switch (periodo) {
        case 'semana':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'mes':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'ano':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
      }
    }

    const vendas = await prisma.venda.findMany({
      where: { data: { gte: startDate, lte: endDate } },
      orderBy: { data: 'desc' },
    });

    const faturamentoTotal = vendas.reduce((a, v) => a + parseFloat(v.total), 0);
    const ticketMedio = vendas.length > 0 ? faturamentoTotal / vendas.length : 0;

    // Group by day
    const porDia = {};
    vendas.forEach((v) => {
      const dia = new Date(v.data).toLocaleDateString('pt-BR');
      if (!porDia[dia]) porDia[dia] = { data: dia, total: 0, count: 0 };
      porDia[dia].total += parseFloat(v.total);
      porDia[dia].count += 1;
    });

    // Group by origin
    const porOrigem = {};
    vendas.forEach((v) => {
      if (!porOrigem[v.origem]) porOrigem[v.origem] = { origem: v.origem, total: 0, count: 0 };
      porOrigem[v.origem].total += parseFloat(v.total);
      porOrigem[v.origem].count += 1;
    });

    res.json({
      faturamentoTotal,
      ticketMedio,
      totalVendas: vendas.length,
      inicio: startDate.toISOString(),
      fim: endDate.toISOString(),
      porDia: Object.values(porDia).sort((a, b) => new Date(a.data) - new Date(b.data)),
      porOrigem: Object.values(porOrigem),
    });
  } catch (e) {
    console.error('Erro ao gerar relatório de faturamento:', e);
    res.status(500).json({ erro: 'Erro ao gerar relatório' });
  }
});

// GET top produtos
router.get('/relatorios/top-produtos', cache.middleware(30_000), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const vendas = await prisma.venda.findMany();

    const map = {};
    vendas.forEach((v) => {
      if (!map[v.produto]) {
        map[v.produto] = { nome: v.produto, total: 0, quantidade: 0, count: 0 };
      }
      map[v.produto].total += parseFloat(v.total);
      map[v.produto].quantidade += v.quantidade;
      map[v.produto].count += 1;
    });

    const result = Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    res.json(result);
  } catch (e) {
    console.error('Erro ao gerar top produtos:', e);
    res.status(500).json({ erro: 'Erro ao gerar relatório' });
  }
});

// GET vendas por dia (custom date range)
router.get('/relatorios/vendas-por-dia', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) {
      return res.status(400).json({ erro: 'Parâmetros inicio e fim são obrigatórios' });
    }

    const startDate = new Date(inicio);
    const endDate = new Date(fim);
    endDate.setHours(23, 59, 59, 999);

    const vendas = await prisma.venda.findMany({
      where: { data: { gte: startDate, lte: endDate } },
      orderBy: { data: 'asc' },
    });

    const porDia = {};
    vendas.forEach((v) => {
      const dia = new Date(v.data).toISOString().split('T')[0];
      if (!porDia[dia]) porDia[dia] = { date: dia, total: 0, count: 0 };
      porDia[dia].total += parseFloat(v.total);
      porDia[dia].count += 1;
    });

    res.json(Object.values(porDia));
  } catch (e) {
    console.error('Erro ao gerar relatório vendas por dia:', e);
    res.status(500).json({ erro: 'Erro ao gerar relatório' });
  }
});

module.exports = router;

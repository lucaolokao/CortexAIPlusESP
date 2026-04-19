'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../database/prisma');
const { validate } = require('../middleware/validate.middleware');
const { criarProdutoSchema, atualizarProdutoSchema, deletarProdutoSchema } = require('../validators/produto.validator');
const cache = require('../services/cache.service');

// GET produtos with pagination and search
router.get('/produtos', cache.middleware(60_000), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const { q, categoria, status } = req.query;

    const where = {};
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { codigoBarras: { contains: q, mode: 'insensitive' } },
        { categoria: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (categoria) where.categoria = categoria;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.produto.findMany({
        where,
        orderBy: { nome: 'asc' },
        take: limit,
        skip,
      }),
      prisma.produto.count({ where }),
    ]);

    // Normalize Decimal fields to plain numbers (required for ESP32 / JSON clients)
    const normalize = (arr) => arr.map(p => ({
      ...p,
      preco:     p.preco     != null ? parseFloat(p.preco)     : null,
      precoCusto: p.precoCusto != null ? parseFloat(p.precoCusto) : null,
    }));

    // If no pagination params, return array for backward compat
    if (!req.query.page && !req.query.limit) {
      return res.json(normalize(data));
    }

    res.json({
      data: normalize(data),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasNext: skip + data.length < total,
      hasPrev: page > 1,
    });
  } catch (e) {
    console.error('Erro ao buscar produtos:', e);
    res.status(500).json({ erro: 'Erro ao buscar produtos' });
  }
});

router.post('/produto', validate(criarProdutoSchema), async (req, res) => {
  try {
    const {
      nome, estoque, preco, categoria,
      sku, codigoBarras, precoCusto, estoqueMinimo, fornecedor,
      validade, lote, localizacao, status, descricao, tags,
    } = req.body;

    const produto = await prisma.produto.create({
      data: {
        nome,
        estoque,
        preco,
        categoria: categoria.toLowerCase(),
        sku: sku || null,
        codigoBarras: codigoBarras || null,
        precoCusto: precoCusto || null,
        estoqueMinimo: estoqueMinimo || null,
        fornecedor: fornecedor || null,
        validade: validade ? new Date(validade) : null,
        lote: lote || null,
        localizacao: localizacao || null,
        status,
        descricao: descricao || null,
        tags: tags || null,
      },
    });

    console.log(`✅ Produto: ${nome} | Estoque: ${estoque} | Preço: R$ ${preco}`);
    cache.flush();
    res.json({ sucesso: true, produto });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ erro: 'Produto já existe' });
    console.error('Erro ao criar produto:', e);
    res.status(500).json({ erro: 'Erro ao criar produto' });
  }
});

router.put('/produto', validate(atualizarProdutoSchema), async (req, res) => {
  try {
    const { nome, ...resto } = req.body;

    const produto = await prisma.produto.findFirst({
      where: { nome: { equals: nome, mode: 'insensitive' } },
    });
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

    if (resto.categoria !== undefined) resto.categoria = resto.categoria.toLowerCase();

    await prisma.produto.update({ where: { id: produto.id }, data: resto });
    cache.flush();
    res.json({ sucesso: true });
  } catch (e) {
    console.error('Erro ao atualizar produto:', e);
    res.status(500).json({ erro: 'Erro ao atualizar produto' });
  }
});

router.delete('/produto', validate(deletarProdutoSchema), async (req, res) => {
  try {
    const { nome } = req.body;

    const produto = await prisma.produto.findFirst({
      where: { nome: { equals: nome, mode: 'insensitive' } },
    });
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

    await prisma.produto.delete({ where: { id: produto.id } });
    console.log(`Produto deletado: ${nome}`);
    cache.flush();
    res.json({ sucesso: true });
  } catch (e) {
    console.error('Erro ao deletar produto:', e);
    res.status(500).json({ erro: 'Erro ao deletar produto' });
  }
});

module.exports = router;

'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../database/prisma');
const cache = require('../services/cache.service');

router.get('/categorias', cache.middleware(60_000), async (req, res) => {
  try {
    const categorias = await prisma.categoria.findMany({ orderBy: { nome: 'asc' } });
    res.json(categorias);
  } catch (e) {
    console.error('Erro ao buscar categorias:', e);
    res.status(500).json({ erro: 'Erro ao buscar categorias' });
  }
});

router.post('/categoria', async (req, res) => {
  try {
    const {
      nome, descricao, tipoProduto, classificacaoBebida, icone, cor,
      margemLucroPadrao, metaVendasMensais, comissaoPorVenda, ordemExibicao,
      status, tags,
    } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });

    const categoria = await prisma.categoria.create({
      data: {
        nome,
        descricao: descricao || null,
        tipoProduto: tipoProduto || null,
        classificacaoBebida: tipoProduto === 'bebida' ? (classificacaoBebida || null) : null,
        icone: icone || null,
        cor: cor || null,
        margemLucroPadrao: margemLucroPadrao ? parseFloat(margemLucroPadrao) : null,
        metaVendasMensais: metaVendasMensais ? parseFloat(metaVendasMensais) : null,
        comissaoPorVenda: comissaoPorVenda ? parseFloat(comissaoPorVenda) : null,
        ordemExibicao: ordemExibicao ? parseInt(ordemExibicao) : null,
        status: status || 'ativa',
        tags: tags || null,
      },
    });
    cache.del('/categorias');
    res.json({ sucesso: true, categoria });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ erro: 'Categoria já existe' });
    console.error('Erro ao criar categoria:', e);
    res.status(500).json({ erro: 'Erro ao criar categoria' });
  }
});

router.put('/categoria', async (req, res) => {
  try {
    const {
      nome, novoNome, descricao, tipoProduto, classificacaoBebida, icone, cor,
      margemLucroPadrao, metaVendasMensais, comissaoPorVenda, ordemExibicao,
      status, tags,
    } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });

    const categoria = await prisma.categoria.findFirst({
      where: { nome: { equals: nome, mode: 'insensitive' } },
    });
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada' });

    const data = {};
    if (novoNome && novoNome !== nome) data.nome = novoNome;
    if (descricao !== undefined) data.descricao = descricao || null;
    if (tipoProduto !== undefined) data.tipoProduto = tipoProduto || null;
    if (classificacaoBebida !== undefined) {
      const tipoFinal = tipoProduto !== undefined ? tipoProduto : categoria.tipoProduto;
      data.classificacaoBebida = tipoFinal === 'bebida' ? (classificacaoBebida || null) : null;
    }
    if (icone !== undefined) data.icone = icone || null;
    if (cor !== undefined) data.cor = cor || null;
    if (margemLucroPadrao !== undefined) data.margemLucroPadrao = margemLucroPadrao ? parseFloat(margemLucroPadrao) : null;
    if (metaVendasMensais !== undefined) data.metaVendasMensais = metaVendasMensais ? parseFloat(metaVendasMensais) : null;
    if (comissaoPorVenda !== undefined) data.comissaoPorVenda = comissaoPorVenda ? parseFloat(comissaoPorVenda) : null;
    if (ordemExibicao !== undefined) data.ordemExibicao = ordemExibicao ? parseInt(ordemExibicao) : null;
    if (status !== undefined) data.status = status || 'ativa';
    if (tags !== undefined) data.tags = tags || null;

    const updated = await prisma.categoria.update({ where: { id: categoria.id }, data });
    cache.del('/categorias');
    res.json({ sucesso: true, categoria: updated });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ erro: 'Nome de categoria já existe' });
    console.error('Erro ao atualizar categoria:', e);
    res.status(500).json({ erro: 'Erro ao atualizar categoria' });
  }
});

router.delete('/categoria', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });

    const categoria = await prisma.categoria.findFirst({
      where: { nome: { equals: nome, mode: 'insensitive' } },
    });
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada' });

    await prisma.categoria.delete({ where: { id: categoria.id } });
    cache.del('/categorias');
    res.json({ sucesso: true });
  } catch (e) {
    console.error('Erro ao deletar categoria:', e);
    res.status(500).json({ erro: 'Erro ao deletar categoria' });
  }
});

module.exports = router;

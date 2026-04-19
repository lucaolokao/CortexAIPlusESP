'use strict';

const express = require('express');
const router = express.Router();
const estoqueService = require('../services/estoque.service');
const cache = require('../services/cache.service');

// GET produtos com estoque baixo, ordenados por urgência
router.get('/relatorios/estoque-baixo', cache.middleware(30_000), async (req, res) => {
  try {
    const produtosBaixo = await estoqueService.getProdutosEstoqueBaixo();
    res.json({ produtos: produtosBaixo, total: produtosBaixo.length });
  } catch (e) {
    console.error('Erro ao buscar estoque baixo:', e);
    res.status(500).json({ erro: 'Erro ao buscar estoque baixo' });
  }
});

// GET resumo de estoque
router.get('/relatorios/estoque-resumo', cache.middleware(60_000), async (req, res) => {
  try {
    const resumo = await estoqueService.getResumoEstoque();
    res.json(resumo);
  } catch (e) {
    console.error('Erro ao buscar resumo de estoque:', e);
    res.status(500).json({ erro: 'Erro ao buscar resumo de estoque' });
  }
});

module.exports = router;

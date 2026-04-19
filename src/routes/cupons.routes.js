'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../database/prisma');
const { validate } = require('../middleware/validate.middleware');
const { criarCupomSchema } = require('../validators/cupom.validator');

router.get('/cupons', async (req, res) => {
  try {
    const dados = await prisma.cupom.findMany({ orderBy: { criadoEm: 'desc' } });
    res.json(dados);
  } catch (e) {
    console.error('Erro ao buscar cupons:', e);
    res.status(500).json({ erro: 'Erro ao buscar cupons' });
  }
});

router.post('/cupom', validate(criarCupomSchema), async (req, res) => {
  try {
    const { codigo, tipo, valor, valorMinimo, validoAte, usosMax } = req.body;
    if (!codigo || !tipo || valor === undefined || !validoAte) {
      return res.status(400).json({ erro: 'Campos obrigatórios: codigo, tipo, valor, validoAte' });
    }

    const cupom = await prisma.cupom.create({
      data: {
        codigo: codigo.toUpperCase(),
        tipo,
        valor: parseFloat(valor),
        valorMinimo: valorMinimo ? parseFloat(valorMinimo) : null,
        validoAte: new Date(validoAte),
        usosMax: parseInt(usosMax) || 1,
      },
    });
    res.json({ sucesso: true, cupom });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ erro: 'Cupom já existe' });
    console.error('Erro ao criar cupom:', e);
    res.status(500).json({ erro: 'Erro ao criar cupom' });
  }
});

router.put('/cupom', async (req, res) => {
  try {
    const { id, ...dados } = req.body;
    if (!id) return res.status(400).json({ erro: 'ID obrigatório' });
    if (dados.codigo) dados.codigo = dados.codigo.toUpperCase();
    if (dados.validoAte) dados.validoAte = new Date(dados.validoAte);
    if (dados.valor !== undefined) dados.valor = parseFloat(dados.valor);
    if (dados.valorMinimo !== undefined) dados.valorMinimo = parseFloat(dados.valorMinimo);
    if (dados.usosMax !== undefined) dados.usosMax = parseInt(dados.usosMax);

    const cupom = await prisma.cupom.update({
      where: { id: parseInt(id) },
      data: { ...dados },
    });
    res.json({ sucesso: true, cupom });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ erro: 'Cupom não encontrado' });
    console.error('Erro ao atualizar cupom:', e);
    res.status(500).json({ erro: 'Erro ao atualizar cupom' });
  }
});

router.delete('/cupom', async (req, res) => {
  try {
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ erro: 'Código obrigatório' });

    await prisma.cupom.delete({ where: { codigo: codigo.toUpperCase() } });
    res.json({ sucesso: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ erro: 'Cupom não encontrado' });
    console.error('Erro ao deletar cupom:', e);
    res.status(500).json({ erro: 'Erro ao deletar cupom' });
  }
});

router.post('/cupons/:codigo/validar', async (req, res) => {
  try {
    const { codigo } = req.params;
    const cupom = await prisma.cupom.findUnique({ where: { codigo: codigo.toUpperCase() } });

    if (!cupom || !cupom.ativo) {
      return res.status(404).json({ erro: 'Cupom não encontrado ou inativo' });
    }

    if (new Date(cupom.validoAte) < new Date()) {
      return res.status(400).json({ erro: 'Cupom expirado' });
    }

    if (cupom.usos >= cupom.usosMax) {
      return res.status(400).json({ erro: 'Cupom usado o máximo permitido' });
    }

    res.json({
      valido: true,
      codigo: cupom.codigo,
      tipo: cupom.tipo,
      valor: parseFloat(cupom.valor),
      valorMinimo: cupom.valorMinimo ? parseFloat(cupom.valorMinimo) : null,
    });
  } catch (e) {
    console.error('Erro ao validar cupom:', e);
    res.status(500).json({ erro: 'Erro ao validar cupom' });
  }
});

module.exports = router;

'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../database/prisma');
const { processarTexto } = require('../modules/ia/ia.service');

const { z } = require('zod');
const textoProcessamentoSchema = z.object({
  texto: z.string().min(1, 'Texto é obrigatório'),
});

router.post('/processar-texto', async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto || typeof texto !== 'string' || texto.trim().length === 0) {
      return res.status(400).json({ erro: 'Campo "texto" obrigatório' });
    }

    const produtos = await prisma.produto.findMany();
    const itensProcessados = processarTexto(texto, produtos);

    const encontrados = itensProcessados.filter((i) => i.encontrado);
    const confiancaMedia =
      encontrados.length > 0
        ? Math.round(encontrados.reduce((a, i) => a + i.confianca, 0) / encontrados.length)
        : 0;

    const totalEstimado = encontrados.reduce(
      (acc, i) => acc + i.quantidade * (i.produto ? parseFloat(i.produto.preco) : 0),
      0
    );

    const audioLog = await prisma.audioLog.create({
      data: {
        textoOriginal: texto,
        resultado: itensProcessados,
        confianca: confiancaMedia,
        sucesso: encontrados.length > 0,
      },
    });

    res.json({
      sucesso: true,
      audioLogId: audioLog.id,
      texto,
      itens: itensProcessados,
      resumo: {
        totalItens: itensProcessados.length,
        encontrados: encontrados.length,
        confiancaMedia,
        totalEstimado: parseFloat(totalEstimado.toFixed(2)),
      },
    });
  } catch (e) {
    console.error('Erro ao processar texto:', e);
    res.status(500).json({ erro: 'Erro ao processar texto' });
  }
});

router.get('/audio-logs', async (req, res) => {
  try {
    const logs = await prisma.audioLog.findMany({
      orderBy: { criadoEm: 'desc' },
      include: { vendas: true },
    });
    res.json(logs);
  } catch (e) {
    console.error('Erro ao buscar logs:', e);
    res.status(500).json({ erro: 'Erro ao buscar logs' });
  }
});

// Audio stub
router.post('/audio', (req, res) => {
  res.json({
    sucesso: false,
    mensagem: 'Endpoint de áudio ainda não implementado. Use /api/processar-texto com o texto transcrito.',
  });
});

module.exports = router;

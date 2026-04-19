'use strict';

const express = require('express');
const router = express.Router();
const notificacoes = require('../services/notification.service');

router.get('/notificacoes', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await notificacoes.getNotificacoes({
      page,
      limit,
      tipo: req.query.tipo,
      lida: req.query.lida === 'true' ? true : req.query.lida === 'false' ? false : undefined,
    });
    res.json(result);
  } catch (e) {
    console.error('Erro ao buscar notificações:', e);
    res.status(500).json({ erro: 'Erro ao buscar notificações' });
  }
});

router.put('/notificacoes/lidas', async (req, res) => {
  try {
    const result = await notificacoes.marcarTodasComoLidas();
    res.json({ sucesso: true, alteradas: result.count });
  } catch (e) {
    console.error('Erro ao marcar notificações:', e);
    res.status(500).json({ erro: 'Erro ao marcar notificações' });
  }
});

router.put('/notificacao/:id/lida', async (req, res) => {
  try {
    await notificacoes.marcarComoLida(parseInt(req.params.id));
    res.json({ sucesso: true });
  } catch (e) {
    console.error('Erro ao marcar notificação:', e);
    res.status(500).json({ erro: 'Erro ao marcar notificação' });
  }
});

router.get('/notificacoes/nao-lidas/count', async (req, res) => {
  try {
    const count = await notificacoes.countNaoLidas();
    res.json({ count });
  } catch (e) {
    console.error('Erro ao contar notificações:', e);
    res.status(500).json({ erro: 'Erro ao contar notificações' });
  }
});

module.exports = router;

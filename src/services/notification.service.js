'use strict';

/**
 * Notification Service
 * Create, list, manage notifications. Checks stock levels periodically.
 */
const prisma = require('../database/prisma');

async function createNotificacao(tipo, titulo, mensagem) {
  try {
    return await prisma.notificacao.create({
      data: {
        tipo,
        titulo,
        mensagem,
      },
    });
  } catch (e) {
    console.error('Erro ao criar notificacao:', e);
    return null;
  }
}

async function getNotificacoes({ page = 1, limit = 20, tipo, lida } = {}) {
  const where = {};
  if (tipo) where.tipo = tipo;
  if (typeof lida === 'boolean') where.lida = lida;

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.notificacao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: limit,
      skip,
    }),
    prisma.notificacao.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    hasPrev: page > 1,
    hasNext: page < Math.ceil(total / limit),
  };
}

async function marcarComoLida(id) {
  return prisma.notificacao.update({
    where: { id },
    data: { lida: true },
  });
}

async function marcarTodasComoLidas() {
  return prisma.notificacao.updateMany({
    where: { lida: false },
    data: { lida: true },
  });
}

async function countNaoLidas() {
  return prisma.notificacao.count({ where: { lida: false } });
}

async function verificarEstoqueBaixo() {
  try {
    const produtosBaixo = await prisma.produto.findMany({
      where: { status: 'ativo' },
    });

    for (const p of produtosBaixo) {
      const limite = p.estoqueMinimo || 5;
      if (p.estoque < limite) {
        await createNotificacao(
          'estoque_baixo',
          `Estoque baixo: ${p.nome}`,
          `${p.nome} tem apenas ${p.estoque} unidades (minimo: ${limite})`
        );
      }
    }
  } catch (e) {
    console.error('Erro ao verificar estoque baixo:', e);
  }
}

async function verificarProdutosVencendo() {
  try {
    const hoje = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + 7);

    const produtosVencendo = await prisma.produto.findMany({
      where: {
        validade: { gte: hoje, lte: limite },
        status: 'ativo',
      },
    });

    for (const p of produtosVencendo) {
      await createNotificacao(
        'produto_vencendo',
        `Produto perto de vencer: ${p.nome}`,
        `${p.nome} vence em ${new Date(p.validade).toLocaleDateString('pt-BR')}`
      );
    }
  } catch (e) {
    console.error('Erro ao verificar produtos vencendo:', e);
  }
}

module.exports = {
  createNotificacao,
  getNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
  countNaoLidas,
  verificarEstoqueBaixo,
  verificarProdutosVencendo,
};

'use strict';

const prisma = require('../database/prisma');
const { createNotificacao } = require('./notification.service');

/**
 * Retorna produtos com estoque abaixo do mínimo configurado.
 * @returns {Promise<Array>}
 */
async function getProdutosEstoqueBaixo() {
  const produtos = await prisma.produto.findMany({
    where: { status: 'ativo' },
    select: {
      id: true,
      nome: true,
      estoque: true,
      estoqueMinimo: true,
      preco: true,
      fornecedor: true,
    },
  });

  return produtos
    .map((p) => ({
      ...p,
      limite: p.estoqueMinimo || 5,
      diferenca: p.limite - p.estoque,
    }))
    .filter((p) => p.estoque < p.limite)
    .sort((a, b) => b.diferenca - a.diferenca);
}

/**
 * Retorna relatório geral de estoque.
 */
async function getResumoEstoque() {
  const produtos = await prisma.produto.findMany({
    where: { status: 'ativo' },
    select: { estoque: true, precoCusto: true },
  });

  const totalItens = produtos.reduce((acc, p) => acc + p.estoque, 0);
  const valorTotalCusto = produtos.reduce(
    (acc, p) => acc + p.estoque * (parseFloat(p.precoCusto) || 0),
    0
  );

  const semEstoque = produtos.filter((p) => p.estoque === 0).length;

  return {
    totalItens,
    valorTotalCusto: parseFloat(valorTotalCusto.toFixed(2)),
    produtosCadastrados: produtos.length,
    semEstoque,
  };
}

/**
 * Verifica estoque baixo e cria notificações APENAS se não houver notificação recente (últimas 6h).
 */
async function verificarEstoqueBaixo() {
  try {
    const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const notificacoesRecentes = await prisma.notificacao.findMany({
      where: {
        tipo: 'estoque_baixo',
        criadoEm: { gte: seisHorasAtras },
      },
    });

    // Evita duplicar: só notifica se ainda não houver notificação para o produto nas últimas 6h
    const produtosNotificados = new Set(
      notificacoesRecentes.map((n) => n.titulo.replace('Estoque baixo: ', ''))
    );

    const produtos = await getProdutosEstoqueBaixo();

    for (const p of produtos) {
      if (!produtosNotificados.has(p.nome)) {
        await createNotificacao(
          'estoque_baixo',
          `Estoque baixo: ${p.nome}`,
          `${p.nome} tem apenas ${p.estoque} unidades (mínimo: ${p.limite})`
        );
      }
    }
  } catch (e) {
    console.error('Erro ao verificar estoque baixo:', e);
  }
}

module.exports = {
  getProdutosEstoqueBaixo,
  getResumoEstoque,
  verificarEstoqueBaixo,
};

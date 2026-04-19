'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { hashSenha } = require('../src/services/auth.service');

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('🌱 Iniciando seed...');

    // Usuário admin padrão
    const senhaHash = await hashSenha('admin123');
    await prisma.usuario.upsert({
      where: { login: 'admin' },
      update: {},
      create: {
        nome: 'Administrador',
        login: 'admin',
        senhaHash,
        pin: '1234',
        role: 'admin',
      },
    });
    console.log('✅ Usuário admin criado (login: admin / senha: admin123 / PIN: 1234)');

    // Categorias iniciais
    const categorias = ['Frios', 'Doce', 'Salgado', 'Bebidas', 'POBRE'];
    for (const nome of categorias) {
      await prisma.categoria.upsert({
        where: { nome },
        update: {},
        create: { nome },
      });
    }
    console.log('✅ Categorias atualizadas');

    // Produtos iniciais
    const produtos = [
      { nome: 'Brigadeiro', estoque: 12, preco: 7.99, categoria: 'doce' },
      { nome: 'Pres. Perdigao', estoque: 118, preco: 14.0, categoria: 'frios' },
      { nome: 'Batata Lays', estoque: 60, preco: 11.4, categoria: 'salgado' },
      { nome: 'Campari', estoque: 1, preco: 62.7, categoria: 'bebidas' },
      { nome: 'TIAGO', estoque: 0, preco: 500.0, categoria: 'pobre' },
      { nome: 'Coca-Cola', estoque: 50, preco: 5.99, categoria: 'bebidas' },
      { nome: 'Agua Mineral', estoque: 100, preco: 2.99, categoria: 'bebidas' },
      { nome: 'Suco de Laranja', estoque: 30, preco: 4.5, categoria: 'bebidas' },
      { nome: 'Pao de Queijo', estoque: 80, preco: 2.5, categoria: 'salgado' },
      { nome: 'Refrigerante Guarana', estoque: 40, preco: 5.5, categoria: 'bebidas' },
    ];

    for (const produto of produtos) {
      await prisma.produto.upsert({
        where: { nome: produto.nome },
        update: {},
        create: produto,
      });
    }
    console.log('✅ Produtos atualizados');

    // Clientes padrão
    const clientes = [
      { nome: 'Consumidor Final' },
      { nome: 'João Silva', cpf: '123.456.789-00', email: 'joao@email.com', telefone: '(11) 99999-9999' },
      { nome: 'Maria Santos', cpf: '987.654.321-00', email: 'maria@email.com', telefone: '(11) 88888-8888' },
    ];

    for (const cliente of clientes) {
      const where = cliente.cpf
        ? { cpf: cliente.cpf }
        : { nome: cliente.nome };
      await prisma.cliente.upsert({
        where,
        update: {},
        create: cliente,
      });
    }
    console.log('✅ Clientes padrão criados');

    // Cupons de desconto
    const cupons = [
      { codigo: 'DESCONTO10', tipo: 'percentual', valor: 10, validoAte: new Date('2026-12-31'), usosMax: 100 },
      { codigo: 'PROMO20', tipo: 'valor', valor: 20, valorMinimo: 100, validoAte: new Date('2026-06-30'), usosMax: 50 },
      { codigo: 'PRIMEIRACOMPRA', tipo: 'percentual', valor: 15, validoAte: new Date('2026-12-31'), usosMax: 10 },
    ];

    for (const cupom of cupons) {
      await prisma.cupom.upsert({
        where: { codigo: cupom.codigo },
        update: {},
        create: cupom,
      });
    }
    console.log('✅ Cupons criados');

    console.log('🚀 Seed concluído com sucesso!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ Erro no seed:', e);
  process.exit(1);
});

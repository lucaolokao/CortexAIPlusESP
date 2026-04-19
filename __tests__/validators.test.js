'use strict';

const { criarProdutoSchema, atualizarProdutoSchema } = require('../src/validators/produto.validator');
const { criarVendaSchema } = require('../src/validators/venda.validator');
const { criarClienteSchema } = require('../src/validators/cliente.validator');
const { criarCupomSchema } = require('../src/validators/cupom.validator');

describe('Produto Validator', () => {
  test('deve aceitar dados válidos de produto', () => {
    const result = criarProdutoSchema.safeParse({ nome: 'Coca-Cola', preco: 5.0, estoque: 100 });
    expect(result.success).toBe(true);
  });

  test('deve rejeitar produto sem nome', () => {
    const result = criarProdutoSchema.safeParse({ preco: 5.0 });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('nome');
  });

  test('deve rejeitar preço negativo', () => {
    const result = criarProdutoSchema.safeParse({ nome: 'Coca', preco: -1 });
    expect(result.success).toBe(false);
  });

  test('deve aceitar estoque=0', () => {
    const result = criarProdutoSchema.safeParse({ nome: 'Coca', preco: 5, estoque: 0 });
    expect(result.success).toBe(true);
  });
});

describe('Venda Validator', () => {
  test('deve aceitar dados válidos de venda', () => {
    const result = criarVendaSchema.safeParse({ produto: 'Coca-Cola', quantidade: 2, preco: 5.0 });
    expect(result.success).toBe(true);
  });

  test('deve rejeitar venda sem produto', () => {
    const result = criarVendaSchema.safeParse({ quantidade: 1, preco: 5 });
    expect(result.success).toBe(false);
  });

  test('deve rejeitar quantidade negativa', () => {
    const result = criarVendaSchema.safeParse({ produto: 'Coca', quantidade: -1, preco: 5 });
    expect(result.success).toBe(false);
  });
});

describe('Cliente Validator', () => {
  test('deve rejeitar sem nome', () => {
    const result = criarClienteSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('deve aceitar cliente mínimo com nome apenas', () => {
    const result = criarClienteSchema.safeParse({ nome: 'João' });
    expect(result.success).toBe(true);
  });

  test('deve rejeitar email inválido', () => {
    const result = criarClienteSchema.safeParse({ nome: 'João', email: 'invalido' });
    expect(result.success).toBe(false);
  });
});

describe('Cupom Validator', () => {
  test('deve aceitar cupom válido', () => {
    const result = criarCupomSchema.safeParse({
      codigo: 'DESCONTO10',
      tipo: 'percentual',
      valor: 10,
      validoAte: '2026-12-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });

  test('deve rejeitar sem campos obrigatórios', () => {
    const result = criarCupomSchema.safeParse({ codigo: 'X' });
    expect(result.success).toBe(false);
  });
});

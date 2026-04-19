'use strict';

const { processarTexto, segmentarTexto } = require('../src/modules/ia/ia.service');

// Mock products for IA testing
const produtosMock = [
  { nome: 'Coca-Cola', preco: 5.0, estoque: 100, categoria: 'bebida' },
  { nome: 'Água Mineral', preco: 2.5, estoque: 200, categoria: 'bebida' },
  { nome: 'Cerveja Lata', preco: 4.0, estoque: 50, categoria: 'bebida' },
  { nome: 'Pão Francês', preco: 0.75, estoque: 300, categoria: 'alimento' },
  { nome: 'Leite Integral', preco: 6.5, estoque: 40, categoria: 'alimento' },
  { nome: 'Presunto e Queijo', preco: 10.0, estoque: 30, categoria: 'salgado' },
  { nome: 'Banana Nanica', preco: 2.0, estoque: 50, categoria: 'fruta' },
  { nome: 'Brigadeiro', preco: 5.0, estoque: 40, categoria: 'doce' },
];

describe('segmentarTexto', () => {
  test('separa por vírgula', () => {
    expect(segmentarTexto('2 coca, 1 agua')).toEqual(['2 coca', '1 agua']);
  });

  test('separa por "e" antes de número', () => {
    expect(segmentarTexto('2 nanaica e 4 brigadeiro')).toEqual(['2 nanaica', '4 brigadeiro']);
  });

  test('separa por número sem separador (modo sem vírgula)', () => {
    expect(segmentarTexto('2 nanaica 4 brigadeiro')).toEqual(['2 nanaica', '4 brigadeiro']);
  });

  test('não separa "e" dentro do nome do produto', () => {
    expect(segmentarTexto('1 presunto e queijo')).toEqual(['1 presunto e queijo']);
  });

  test('caso complexo: número + "e" + nome com "e"', () => {
    const segs = segmentarTexto('2 nanaica e 4 brigadeiro e 1 presunto e queijo');
    expect(segs).toEqual(['2 nanaica', '4 brigadeiro', '1 presunto e queijo']);
  });

  test('caso complexo: sem separador + nome com "e"', () => {
    const segs = segmentarTexto('2 nanaica 4 brigadeiro 1 presunto e queijo');
    expect(segs).toEqual(['2 nanaica', '4 brigadeiro', '1 presunto e queijo']);
  });
});

describe('IA Service - processarTexto', () => {
  test('deve encontrar produtos por nome exato', () => {
    const resultado = processarTexto('Coca-Cola', produtosMock);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].encontrado).toBe(true);
    expect(resultado[0].produto.nome).toBe('Coca-Cola');
    expect(resultado[0].quantidade).toBe(1);
  });

  test('deve extrair quantidade do texto', () => {
    const resultado = processarTexto('2 Coca-Cola', produtosMock);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].encontrado).toBe(true);
    expect(resultado[0].quantidade).toBe(2);
  });

  test('deve processar múltiplos itens separados por vírgula', () => {
    const resultado = processarTexto('1 Coca-Cola, 1 Água Mineral', produtosMock);
    expect(resultado.filter((r) => r.encontrado)).toHaveLength(2);
  });

  test('deve processar múltiplos itens separados por e com número', () => {
    const resultado = processarTexto('1 Pão Francês e 1 Leite Integral', produtosMock);
    const encontrados = resultado.filter((r) => r.encontrado);
    expect(encontrados).toHaveLength(2);
    expect(encontrados[0].quantidade).toBe(1);
    expect(encontrados[1].quantidade).toBe(1);
  });

  test('deve processar múltiplos itens sem separador (apenas números delimitam)', () => {
    const resultado = processarTexto('2 nanaica 4 brigadeiro', produtosMock);
    const encontrados = resultado.filter((r) => r.encontrado);
    expect(encontrados).toHaveLength(2);
    expect(encontrados[0].quantidade).toBe(2);
    expect(encontrados[1].quantidade).toBe(4);
  });

  test('caso real: 2 nanaica e 4 brigadeiro e 1 presunto e queijo', () => {
    const resultado = processarTexto('2 nanaica e 4 brigadeiro e 1 preseunto e queijo', produtosMock);
    const encontrados = resultado.filter((r) => r.encontrado);
    expect(encontrados).toHaveLength(3);
    expect(encontrados[0].quantidade).toBe(2);
    expect(encontrados[1].quantidade).toBe(4);
    expect(encontrados[2].quantidade).toBe(1);
    // "Presunto e Queijo" deve ser UM único produto, não dois
    expect(encontrados[2].produto.nome).toBe('Presunto e Queijo');
  });

  test('caso real: sem separador — 2 nanaica 4 brigadeiro 1 presunto e queijo', () => {
    const resultado = processarTexto('2 nanaica 4 brigadeiro 1 preseunto e queijo', produtosMock);
    const encontrados = resultado.filter((r) => r.encontrado);
    expect(encontrados).toHaveLength(3);
    expect(encontrados[0].quantidade).toBe(2);
    expect(encontrados[1].quantidade).toBe(4);
    expect(encontrados[2].quantidade).toBe(1);
    expect(encontrados[2].produto.nome).toBe('Presunto e Queijo');
  });

  test('não deve duplicar produto com "e" no nome', () => {
    const resultado = processarTexto('1 presunto e queijo', produtosMock);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].encontrado).toBe(true);
    expect(resultado[0].produto.nome).toBe('Presunto e Queijo');
  });

  test('deve retornar encontrado=false quando não encontra o produto', () => {
    const resultado = processarTexto('1 produto inexistente', produtosMock);
    expect(resultado[0].encontrado).toBe(false);
    expect(resultado[0].confianca).toBe(0);
  });

  test('deve retornar lista vazia para texto vazio', () => {
    const resultado = processarTexto('', produtosMock);
    expect(resultado).toHaveLength(0);
  });

  test('deve funcionar com fuzzy match — leve erro de digitação', () => {
    const resultado = processarTexto('1 coca cola', produtosMock);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].encontrado).toBe(true);
    expect(resultado[0].confianca).toBeGreaterThan(50);
  });
});

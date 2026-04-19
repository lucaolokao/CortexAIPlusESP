'use strict';

const { z } = require('zod');

/**
 * Validação para POST /produto
 */
const criarProdutoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  estoque: z.coerce.number().int().min(0).default(0),
  preco: z.coerce.number().positive('Preço deve ser positivo'),
  categoria: z.string().optional().default(''),
  sku: z.string().optional(),
  codigoBarras: z.string().optional(),
  precoCusto: z.coerce.number().positive().optional(),
  estoqueMinimo: z.coerce.number().int().positive().optional(),
  fornecedor: z.string().optional(),
  validade: z.string().datetime().optional(),
  lote: z.string().optional(),
  localizacao: z.string().optional(),
  status: z.string().optional().default('ativo'),
  descricao: z.string().optional(),
  tags: z.string().optional(),
});

/**
 * Validação para PUT /produto
 */
const atualizarProdutoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  estoque: z.coerce.number().int().min(0).optional(),
  preco: z.coerce.number().positive().optional(),
  categoria: z.string().optional(),
  sku: z.string().optional().nullable(),
  codigoBarras: z.string().optional().nullable(),
  precoCusto: z.coerce.number().positive().optional().nullable(),
  estoqueMinimo: z.coerce.number().int().positive().optional().nullable(),
  fornecedor: z.string().optional().nullable(),
  validade: z.string().datetime().optional().nullable(),
  lote: z.string().optional().nullable(),
  localizacao: z.string().optional().nullable(),
  status: z.string().optional(),
  descricao: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
});

/**
 * Validação para DELETE /produto
 */
const deletarProdutoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
});

module.exports = { criarProdutoSchema, atualizarProdutoSchema, deletarProdutoSchema };

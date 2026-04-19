'use strict';

const { z } = require('zod');

/**
 * Validação para POST /categoria
 */
const criarCategoriaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  tipoProduto: z.string().optional().nullable(),
  classificacaoBebida: z.string().optional().nullable(),
  icone: z.string().optional().nullable(),
  cor: z.string().optional().nullable(),
  margemLucroPadrao: z.coerce.number().positive().optional().nullable(),
  metaVendasMensais: z.coerce.number().positive().optional().nullable(),
  comissaoPorVenda: z.coerce.number().positive().optional().nullable(),
  ordemExibicao: z.coerce.number().int().optional().nullable(),
  status: z.string().optional().default('ativa'),
  tags: z.string().optional().nullable(),
});

/**
 * Validação para PUT /categoria
 */
const atualizarCategoriaSchema = z.object({
  nome: z.string().min(1, 'Nome atual é obrigatório para identificar a categoria'),
  novoNome: z.string().optional(),
  descricao: z.string().optional().nullable(),
  tipoProduto: z.string().optional().nullable(),
  classificacaoBebida: z.string().optional().nullable(),
  icone: z.string().optional().nullable(),
  cor: z.string().optional().nullable(),
  margemLucroPadrao: z.coerce.number().positive().optional().nullable(),
  metaVendasMensais: z.coerce.number().positive().optional().nullable(),
  comissaoPorVenda: z.coerce.number().positive().optional().nullable(),
  ordemExibicao: z.coerce.number().int().optional().nullable(),
  status: z.string().optional(),
  tags: z.string().optional().nullable(),
});

/**
 * Validação para DELETE /categoria
 */
const deletarCategoriaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
});

module.exports = { criarCategoriaSchema, atualizarCategoriaSchema, deletarCategoriaSchema };

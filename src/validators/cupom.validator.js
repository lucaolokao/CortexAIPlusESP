'use strict';

const { z } = require('zod');

/**
 * Validação para POST /cupom
 */
const criarCupomSchema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório'),
  tipo: z.string().min(1, 'Tipo é obrigatório'),
  valor: z.coerce.number().min(0, 'Valor deve ser positivo'),
  valorMinimo: z.coerce.number().min(0).optional().nullable(),
  validoAte: z.string().datetime('Data válida no formato ISO é obrigatória'),
  usosMax: z.coerce.number().int().positive().default(1),
});

/**
 * Validação para PUT /cupom
 */
const atualizarCupomSchema = z.object({
  id: z.coerce.number().int().positive('ID é obrigatório'),
  codigo: z.string().min(1).optional(),
  tipo: z.string().min(1).optional(),
  valor: z.coerce.number().min(0).optional(),
  valorMinimo: z.coerce.number().min(0).optional().nullable(),
  validoAte: z.string().datetime().optional(),
  usosMax: z.coerce.number().int().positive().optional(),
  ativo: z.boolean().optional(),
});

/**
 * Validação para DELETE /cupom
 */
const deletarCupomSchema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório'),
});

module.exports = { criarCupomSchema, atualizarCupomSchema, deletarCupomSchema };

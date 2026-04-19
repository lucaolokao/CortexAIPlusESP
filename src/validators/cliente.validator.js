'use strict';

const { z } = require('zod');

/**
 * Validação para POST /cliente
 */
const criarClienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  cpf: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  telefone: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  obs: z.string().optional().nullable(),
});

/**
 * Validação para PUT /cliente
 */
const atualizarClienteSchema = z.object({
  id: z.coerce.number().int().positive('ID é obrigatório'),
  nome: z.string().min(1).optional(),
  cpf: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  telefone: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  obs: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

/**
 * Validação para DELETE /cliente
 */
const deletarClienteSchema = z.object({
  id: z.coerce.number().int().positive('ID é obrigatório'),
});

module.exports = { criarClienteSchema, atualizarClienteSchema, deletarClienteSchema };

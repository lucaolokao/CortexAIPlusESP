'use strict';

const { z } = require('zod');

/**
 * Validação para POST /venda
 */
const criarVendaSchema = z.object({
  produto: z.string().min(1, 'Produto é obrigatório'),
  quantidade: z.coerce.number().int().positive('Quantidade deve ser positiva'),
  preco: z.coerce.number().positive('Preço deve ser positivo'),
  origem: z.string().optional().default('manual'),
  audioLogId: z.coerce.number().int().positive().optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
  clienteId: z.coerce.number().int().positive().optional(),
  desconto: z.coerce.number().min(0).default(0),
  metodoPagamento: z.string().optional(),
  troco: z.coerce.number().optional(),
  cupomUsado: z.string().optional(),
});

module.exports = { criarVendaSchema };

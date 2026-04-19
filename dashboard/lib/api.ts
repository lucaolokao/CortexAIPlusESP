import type { Produto, Categoria, Venda, Stats, VendasDia, EspStatus, Cliente, Cupom, Notificacao, PaginatedResult } from './types';

const BASE_URL = '';

// ═══════════════ Auth helper (for future login) ═══════════════

function withToken(path: string, options?: RequestInit): RequestInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cortexai_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return { ...options, headers };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, withToken(path, options));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ═══════════════ Produtos ═══════════════
export async function getProdutos(): Promise<Produto[]> {
  return request<Produto[]>('/api/produtos');
}

export async function getProdutosPaginado(page: number, limit: number, q?: string, categoria?: string, status?: string): Promise<PaginatedResult<Produto>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q) params.set('q', q);
  if (categoria) params.set('categoria', categoria);
  if (status) params.set('status', status);
  return request<PaginatedResult<Produto>>(`/api/produtos?${params}`);
}

export async function createProduto(data: Record<string, unknown>) {
  return request<Produto>('/api/produto', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateProduto(data: Record<string, unknown>) {
  return request('/api/produto', { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteProduto(nome: string): Promise<void> {
  return request<void>('/api/produto', { method: 'DELETE', body: JSON.stringify({ nome }) });
}

// ═══════════════ Categorias ═══════════════
export async function getCategorias(): Promise<Categoria[]> {
  return request<Categoria[]>('/api/categorias');
}

export async function createCategoria(data: Record<string, unknown>) {
  return request<Categoria>('/api/categoria', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCategoria(data: Record<string, unknown>) {
  return request('/api/categoria', { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteCategoria(nome: string): Promise<void> {
  return request<void>('/api/categoria', { method: 'DELETE', body: JSON.stringify({ nome }) });
}

// ═══════════════ Vendas ═══════════════
export interface VendaInput {
  produto: string;
  quantidade: number;
  preco: number;
  origem?: string;
  usuarioId?: number;
  clienteId?: number;
  desconto?: number;
  metodoPagamento?: string;
  troco?: number;
  cupomUsado?: string;
  audioLogId?: number;
}

export async function registrarVenda(data: VendaInput): Promise<Venda> {
  return request<Venda>('/api/venda', { method: 'POST', body: JSON.stringify(data) });
}

export async function getHistorico(): Promise<Venda[]> {
  return request<Venda[]>('/api/historico');
}

export async function getVendasPaginado(page: number, limit: number, filtros?: {
  dataInicio?: string; dataFim?: string; origem?: string; produto?: string;
}): Promise<PaginatedResult<Venda>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filtros?.dataInicio) params.set('dataInicio', filtros.dataInicio);
  if (filtros?.dataFim) params.set('dataFim', filtros.dataFim);
  if (filtros?.origem) params.set('origem', filtros.origem);
  if (filtros?.produto) params.set('produto', filtros.produto);
  return request<PaginatedResult<Venda>>(`/api/historico?${params}`);
}

// ═══════════════ Stats & Charts ═══════════════
export async function getStats(): Promise<Stats> {
  return request<Stats>('/api/stats');
}

export async function getVendas7Dias(): Promise<VendasDia[]> {
  return request<VendasDia[]>('/api/vendas-7dias');
}

export async function getFaturamentoDia(): Promise<{ valor: number }> {
  return request<{ valor: number }>('/api/faturamento-dia');
}

// ═══════════════ Relatórios ═══════════════
export async function getRelatorioFaturamento(periodo: string, inicio?: string, fim?: string) {
  const params: Record<string, string> = { periodo };
  if (inicio) params.inicio = inicio;
  if (fim) params.fim = fim;
  const qs = new URLSearchParams(params).toString();
  return request(`/api/relatorios/faturamento?${qs}`);
}

export async function getRelatorioTopProdutos(limit?: number) {
  return request(`/api/relatorios/top-produtos?limit=${limit || 10}`);
}

export async function getRelatorioVendasPorDia(inicio: string, fim: string) {
  return request(`/api/relatorios/vendas-por-dia?inicio=${inicio}&fim=${fim}`);
}

// ═══════════════ Clientes ═══════════════
export async function getClientes(): Promise<Cliente[]> {
  return request<Cliente[]>('/api/clientes');
}

export async function createCliente(data: Record<string, unknown>) {
  return request<Cliente>('/api/cliente', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCliente(id: number, data: Record<string, unknown>) {
  return request('/api/cliente', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

export async function deleteCliente(id: number): Promise<void> {
  return request<void>('/api/cliente', { method: 'DELETE', body: JSON.stringify({ id }) });
}

// ═══════════════ Cupons ═══════════════
export async function getCupons(): Promise<Cupom[]> {
  return request<Cupom[]>('/api/cupons');
}

export async function createCupom(data: Record<string, unknown>) {
  return request<Cupom>('/api/cupom', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCupom(id: number, data: Record<string, unknown>) {
  return request('/api/cupom', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

export async function deleteCupom(codigo: string): Promise<void> {
  return request<void>('/api/cupom', { method: 'DELETE', body: JSON.stringify({ codigo }) });
}

export async function validarCupom(codigo: string) {
  return request(`/api/cupons/${codigo}/validar`, { method: 'POST' });
}

// ═══════════════ Notificações ═══════════════
export async function getNotificacoes(naoLidasOnly = false): Promise<Notificacao[]> {
  const lida = naoLidasOnly ? 'false' : undefined;
  const qs = lida ? `?lida=${lida}` : '';
  const result = await request<{ data: Notificacao[] }>(`/api/notificacoes${qs}`);
  return result.data;
}

export async function marcarNaoLidasCount(): Promise<number> {
  const result = await request<{ count: number }>('/api/notificacoes/nao-lidas/count');
  return result.count;
}

export async function marcarNotificacaoLida(id: number): Promise<void> {
  return request<void>(`/api/notificacao/${id}/lida`, { method: 'PUT' });
}

export async function marcarTodasLidas(): Promise<void> {
  return request<void>('/api/notificacoes/lidas', { method: 'PUT' });
}

// ═══════════════ AI ═══════════════
export async function processarTexto(texto: string) {
  return request<{ itens: any[] }>('/api/processar-texto', { method: 'POST', body: JSON.stringify({ texto }) });
}

// ═══════════════ ESP32 ═══════════════
export async function getEspStatus(): Promise<EspStatus> {
  return request<EspStatus>('/api/esp-status');
}

// ═══════════════ Estoque ═══════════════
export async function getEstoqueBaixo(): Promise<{ produtos: Array<{ id: number; nome: string; estoque: number; limite: number; diferenca: number }>; total: number }> {
  return request('/api/relatorios/estoque-baixo');
}

export async function getEstoqueResumo(): Promise<{ totalItens: number; valorTotalCusto: number; produtosCadastrados: number; semEstoque: number }> {
  return request('/api/relatorios/estoque-resumo');
}

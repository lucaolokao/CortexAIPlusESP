export interface Produto {
  id: number;
  nome: string;
  estoque: number;
  preco: number;
  categoria: string;
  criadoEm: string;
  atualizadoEm: string;
  sku?: string | null;
  codigoBarras?: string | null;
  precoCusto?: number | null;
  margemLucro?: number | null;
  estoqueMinimo?: number | null;
  fornecedor?: string | null;
  validade?: string | null;
  lote?: string | null;
  localizacao?: string | null;
  status?: 'ativo' | 'inativo' | 'descontinuado';
  tags?: string | null;
  descricao?: string | null;
}

export interface Categoria {
  id: number;
  nome: string;
  criadoEm: string;
  descricao?: string | null;
  tipoProduto?: 'bebida' | 'comida' | 'eletronico' | 'outro' | null;
  classificacaoBebida?: 'normal' | 'alcoolica' | 'refrigerada' | null;
  icone?: string | null;
  cor?: string | null;
  margemLucroPadrao?: number | null;
  metaVendasMensais?: number | null;
  comissaoPorVenda?: number | null;
  ordemExibicao?: number | null;
  status?: 'ativa' | 'inativa';
  tags?: string | null;
}

export interface Venda {
  id: number;
  produto: string;
  quantidade: number;
  preco: number;
  total: number;
  origem: string;
  data: string;
  hora: string;
  audioLogId?: number | null;
  usuarioId?: number | null;
  clienteId?: number | null;
  desconto?: number;
  metodoPagamento?: string | null;
  troco?: number | null;
  cupomUsado?: string | null;
}

export interface Stats {
  totalVendas: number;
  faturamentoTotal: number;
  ticketMedio: number;
  produtosUnicos: number;
  valorEstoque: number;
}

export interface VendasDia {
  label: string;
  date: string;
  total: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface EspStatus {
  online: boolean;
  ultimoHeartbeat: number | null;
}


export interface Cliente {
  id: number;
  nome: string;
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  obs?: string | null;
  ativo: boolean;
  criadoEm: string;
}

export interface Cupom {
  id: number;
  codigo: string;
  tipo: 'percentual' | 'valor';
  valor: number;
  valorMinimo?: number | null;
  validoAte: string;
  usosMax: number;
  usos: number;
  ativo: boolean;
  criadoEm: string;
}

export interface Notificacao {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  criadoEm: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

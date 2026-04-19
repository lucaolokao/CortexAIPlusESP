'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote,
  QrCode, Hash, User, Tag, Percent, Receipt, Printer, ChevronDown,
  Package, ChevronRight, X, AlertTriangle, Zap
} from 'lucide-react';
import { getProdutos, getClientes, registrarVenda, getCupons } from '@/lib/api';
import { useToast } from '@/lib/context';
import type { Produto, Cliente, Cupom as CupomType } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';

// ═══════════════════════ Types ══════════════════════

interface CarrinhoItem {
  produto: Produto;
  quantidade: number;
  descontoItem: number;
}

interface CupomAplicado {
  codigo: string;
  tipo: 'percentual' | 'valor';
  valor: number;
  desconto: number;
}

type MetodoPagamento = 'dinheiro' | 'cartao' | 'pix' | null;

// ═══════════════════════ Helpers ══════════════════════

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ═══════════════════════ Main Component ══════════════════════

export default function PDVPage() {
  const { addToast } = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [mostrarBusca, setMostrarBusca] = useState(false);

  // Cart
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showClientes, setShowClientes] = useState(false);

  // Discount / Coupon
  const [cupomInput, setCupomInput] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState<CupomAplicado | null>(null);
  const [cupomLoading, setCupomLoading] = useState(false);

  // Payment
  const [metodoPag, setMetodoPag] = useState<MetodoPagamento>(null);
  const [valorRecebido, setValorRecebido] = useState('');
  const [showPagamento, setShowPagamento] = useState(false);

  // Finalize
  const [finalizando, setFinalizando] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);

  // Load
  const loadData = useCallback(async () => {
    try {
      const [prods, clis] = await Promise.allSettled([getProdutos(), getClientes()]);
      if (prods.status === 'fulfilled') setProdutos(prods.value.filter(p => p.status !== 'inativo'));
      if (clis.status === 'fulfilled') setClientes(clis.value.filter(c => c.ativo));
    } catch {
      addToast('error', 'Erro ao carregar dados do PDV');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Keyboard shortcut: F2 to focus search, F4 for payment, F9 cart clear
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'F4' && carrinho.length > 0) { e.preventDefault(); setShowPagamento(true); }
      if (e.key === 'F9') { e.preventDefault(); setCarrinho([]); setCupomAplicado(null); setSelectedCliente(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [carrinho]);

  // ═══════════ Categorias disponíveis ═══════════
  const categorias = useMemo(() => {
    const cats = new Set(produtos.map(p => p.categoria));
    return Array.from(cats).sort();
  }, [produtos]);

  // ═══════════ Produtos filtrados ═══════════
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const q = busca.toLowerCase();
      const matchBusca = !q ||
        p.nome.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.codigoBarras || '').toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q);
      const matchCat = !categoriaFiltro || p.categoria === categoriaFiltro;
      return matchBusca && matchCat;
    }).slice(0, 40);
  }, [produtos, busca, categoriaFiltro]);

  // ═══════════ Carrinho ═══════════
  const subtotal = useMemo(() =>
    carrinho.reduce((s, i) => s + Number(i.produto.preco) * i.quantidade, 0)
  , [carrinho]);

  const descontoCupom = useMemo(() => {
    if (!cupomAplicado) return 0;
    if (cupomAplicado.tipo === 'percentual') return subtotal * (cupomAplicado.valor / 100);
    return Math.min(cupomAplicado.valor, subtotal);
  }, [cupomAplicado, subtotal]);

  const total = subtotal - descontoCupom;

  const troco = useMemo(() => {
    const recebido = parseFloat(valorRecebido);
    if (isNaN(recebido) || recebido <= 0) return 0;
    return Math.max(0, recebido - total);
  }, [valorRecebido, total]);

  function adicionaAoCarrinho(p: Produto) {
    setCarrinho(prev => {
      const existe = prev.find(i => i.produto.id === p.id);
      if (existe) {
        if (existe.quantidade >= p.estoque) {
          addToast('warning', `Estoque insuficiente para ${p.nome}`);
          return prev;
        }
        return prev.map(i => i.produto.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i);
      }
      return [...prev, { produto: p, quantidade: 1, descontoItem: 0 }];
    });
  }

  function alterarQtd(productId: number, delta: number) {
    setCarrinho(prev => {
      return prev.map(item => {
        if (item.produto.id !== productId) return item;
        const newQtd = item.quantidade + delta;
        if (newQtd <= 0) return item; // não remove aqui, usa removerItem
        if (newQtd > item.produto.estoque) {
          addToast('warning', `Estoque máximo: ${item.produto.estoque}`);
          return item;
        }
        return { ...item, quantidade: newQtd };
      });
    });
  }

  function removerItem(productId: number) {
    setCarrinho(prev => prev.filter(i => i.produto.id !== productId));
  }

  function limparCarrinho() {
    setCarrinho([]);
    setCupomAplicado(null);
    setSelectedCliente(null);
    addToast('info', 'Carrinho limpo');
  }

  // ═══════════ Cupom ═══════════
  async function aplicarCupom() {
    if (!cupomInput.trim()) return;
    setCupomLoading(true);
    try {
      // Tenta validar o cupom - se o endpoint não existir, faz check manual
      try {
        const r = await fetch(`/api/cupons/${cupomInput.trim()}/validar`, { method: 'POST' });
        if (r.ok) {
          const data = await r.json();
          const valorNum = Number(data.valor);
          const desc = data.tipo === 'percentual' ? subtotal * (valorNum / 100) : Math.min(valorNum, subtotal);
          setCupomAplicado({ codigo: data.codigo, tipo: data.tipo, valor: valorNum, desconto: desc });
          addToast('success', `Cupom ${data.codigo}: ${data.tipo === 'percentual' ? `${valorNum}%` : fmt(valorNum)} OFF`);
          return;
        }
      } catch { /* endpoint can fail */ }

      // Fallback: tenta em memória dos cupons carregados
      const cuponsData = await getCupons();
      const cupom = cuponsData.find(
        (c: CupomType) => c.codigo.toLowerCase() === cupomInput.trim().toLowerCase() &&
          c.ativo && c.usos < c.usosMax && new Date(c.validoAte) > new Date()
      );
      if (cupom) {
        const valorNum = Number(cupom.valor);
        const desc = cupom.tipo === 'percentual' ? subtotal * (valorNum / 100) : Math.min(valorNum, subtotal);
        setCupomAplicado({ codigo: cupom.codigo, tipo: cupom.tipo, valor: valorNum, desconto: desc });
        addToast('success', `Cupom ${cupom.codigo} aplicado!`);
      } else {
        addToast('error', 'Cupom inválido ou expirado');
      }
    } catch {
      addToast('error', 'Erro ao validar cupom');
    } finally {
      setCupomLoading(false);
      setCupomInput('');
    }
  }

  // ═══════════ Finalizar Venda ═══════════
  async function finalizarVenda() {
    if (showPagamento && !metodoPag) {
      addToast('warning', 'Selecione o método de pagamento');
      return;
    }
    if (metodoPag === 'dinheiro') {
      const recebido = parseFloat(valorRecebido);
      if (isNaN(recebido) || recebido < total) {
        addToast('warning', `Valor recebido insuficiente. Faltam ${fmt(total - (isNaN(recebido) ? 0 : recebido))}`);
        return;
      }
    }

    setFinalizando(true);
    try {
      for (const item of carrinho) {
        if (item.quantidade > (item.produto.estoque || 0)) {
          addToast('error', `Estoque insuficiente: ${item.produto.nome} tem apenas ${item.produto.estoque} un.`);
          return;
        }
      }

      let successCount = 0;
      for (const item of carrinho) {
        await registrarVenda({
          produto: item.produto.nome,
          quantidade: item.quantidade,
          preco: Number(item.produto.preco),
          origem: 'manual',
        });
        successCount++;
      }

      addToast('success', `Venda de ${fmt(total)} registrada!`);

      // Limpa tudo
      setCarrinho([]);
      setCupomAplicado(null);
      setSelectedCliente(null);
      setMetodoPag(null);
      setShowPagamento(false);
      setValorRecebido('');
      loadData();
    } catch (e: any) {
      let msg = 'Erro ao registrar venda';
      if (e?.message) {
        try { msg = JSON.parse(e.message).erro || msg; } catch { msg = e.message; }
      }
      addToast('error', msg);
    } finally {
      setFinalizando(false);
    }
  }

  // ═══════════════════════ RENDER ══════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">

      {/* ═══════ LEFT: Product Grid ═══════ */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex gap-2 items-center">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar produto... (F2)"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="flex-1 text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              {busca && (
                <button onClick={() => setBusca('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Cliente selector */}
            <div className="relative">
              <button
                onClick={() => setShowClientes(!showClientes)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-sm"
              >
                <User className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">
                  {selectedCliente ? selectedCliente.nome : 'Cliente'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showClientes && (
                <div className="absolute top-12 left-0 w-72 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 max-h-64 overflow-y-auto">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                    <input
                      type="text"
                      placeholder="Buscar cliente..."
                      className="w-full text-sm px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    <button
                      onClick={() => { setSelectedCliente(null); setShowClientes(false); }}
                      className="w-full px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 text-left"
                    >
                      Sem cliente (Consumidor Final)
                    </button>
                    {clientes.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCliente(c); setShowClientes(false); }}
                        className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700
                          ${selectedCliente?.id === c.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        <div className="font-medium">{c.nome}</div>
                        <div className="text-xs text-slate-400">{c.cpf || c.email || '—'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Limpar */}
            <button
              onClick={limparCarrinho}
              title="Limpar carrinho (F9)"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Category chips */}
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoriaFiltro('')}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all
                ${!categoriaFiltro
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
              Todos
            </button>
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoriaFiltro(cat)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all
                  ${categoriaFiltro === cat
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {produtosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2 mt-10">
              <Package className="w-10 h-10" />
              <p className="text-sm">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {produtosFiltrados.map(p => {
                const inCart = carrinho.find(i => i.produto.id === p.id);
                const lowStock = p.estoqueMinimo && p.estoque < p.estoqueMinimo;
                return (
                  <button
                    key={p.id}
                    onClick={() => p.estoque > 0 && adicionaAoCarrinho(p)}
                    disabled={p.estoque <= 0}
                    className={`p-3 rounded-xl border text-left transition-all relative
                      ${p.estoque <= 0
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md active:scale-95 cursor-pointer'}`}
                  >
                    {inCart && (
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-indigo-600 text-white
                        text-xs font-black flex items-center justify-center shadow-lg">
                        {inCart.quantidade}
                      </div>
                    )}
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate mb-1">
                      {p.nome}
                    </p>
                    <p className="text-xs text-slate-400 mb-1.5">{p.categoria}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                        R$ {Number(p.preco).toFixed(2)}
                      </span>
                      <span className={`text-[10px] font-bold ${p.estoque <= 5 ? 'text-red-500' : 'text-slate-400'}`}>
                        {p.estoque} un.
                      </span>
                    </div>
                    {lowStock && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] text-amber-600">Estoque baixo</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══════ RIGHT: Cart & Payment ═══════ */}
      <div className="w-full md:w-96 flex flex-col h-[50vh] md:h-screen border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        {/* Cart header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            <h2 className="font-black text-sm uppercase tracking-tight">Carrinho</h2>
            <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 px-2 py-0.5 rounded-full">
              {carrinho.reduce((s, i) => s + i.quantidade, 0)}
            </span>
          </div>
          <button
            onClick={() => setShowPagamento(!showPagamento)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all
              ${showPagamento
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
          >
            {showPagamento ? 'Voltar' : 'Pagamento (F4)'}
          </button>
        </div>

        {/* Cart items */}
        {!showPagamento && (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {carrinho.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                <ShoppingCart className="w-10 h-10 opacity-30" />
                <p className="text-sm">Carrinho vazio</p>
                <p className="text-xs">Clique nos produtos para adicionar</p>
              </div>
            ) : (
              carrinho.map(item => (
                <div key={item.produto.id} className="p-3 flex items-center gap-3 group">
                  {/* Name + price */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                      {item.produto.nome}
                    </p>
                    <p className="text-xs text-slate-400">
                      {fmt(Number(item.produto.preco))} cada
                    </p>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                    <button
                      onClick={() => item.quantidade <= 1 ? removerItem(item.produto.id) : alterarQtd(item.produto.id, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-white dark:bg-slate-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs font-bold transition-all"
                      title={item.quantidade <= 1 ? 'Remover' : 'Diminuir'}
                    >
                      {item.quantidade <= 1 ? <Trash2 className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3" />}
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-slate-900 dark:text-slate-100">
                      {item.quantidade}
                    </span>
                    <button
                      onClick={() => alterarQtd(item.produto.id, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-white dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 text-xs font-bold transition-all"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400 min-w-16 text-right">
                    {fmt(Number(item.produto.preco) * item.quantidade)}
                  </p>

                  {/* Remove */}
                  <button
                    onClick={() => removerItem(item.produto.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Coupon section (always visible when cart has items, outside payment) */}
        {!showPagamento && carrinho.length > 0 && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700">
            {!cupomAplicado ? (
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                  <Tag className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cupom de desconto"
                    value={cupomInput}
                    onChange={e => setCupomInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') aplicarCupom(); }}
                    className="flex-1 text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <button
                  onClick={aplicarCupom}
                  disabled={cupomLoading}
                  className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-600 text-white text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-500 transition-all disabled:opacity-50"
                >
                  {cupomLoading ? <LoadingSpinner size="sm" /> : 'Aplicar'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {cupomAplicado.codigo} — {cupomAplicado.tipo === 'percentual' ? `${cupomAplicado.valor}%` : fmt(cupomAplicado.valor)} OFF
                  </span>
                </div>
                <button
                  onClick={() => setCupomAplicado(null)}
                  className="text-emerald-600 hover:text-emerald-800"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Payment screen */}
        {showPagamento && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Client info */}
            {selectedCliente && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                <User className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                  {selectedCliente.nome}{selectedCliente.cpf ? ` — ${selectedCliente.cpf}` : ''}
                </span>
              </div>
            )}

            {/* Payment methods */}
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                Forma de Pagamento
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { method: 'dinheiro' as const, icon: Banknote, label: 'Dinheiro' },
                  { method: 'cartao' as const, icon: CreditCard, label: 'Cartão' },
                  { method: 'pix' as const, icon: QrCode, label: 'PIX' },
                ].map(({ method, icon: Icon, label }) => (
                  <button
                    key={method}
                    onClick={() => setMetodoPag(method)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-bold
                      ${metodoPag === method
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 text-slate-500 dark:text-slate-400'}`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Valor recebido (dinheiro only) */}
            {metodoPag === 'dinheiro' && (
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                  Valor Recebido
                </p>
                <div className="flex items-center gap-2 px-3 py-3 rounded-xl border-2 border-indigo-200 dark:border-indigo-700 bg-slate-50 dark:bg-slate-900">
                  <span className="text-lg font-black text-slate-600">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorRecebido}
                    onChange={e => setValorRecebido(e.target.value)}
                    className="flex-1 text-2xl font-black bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                    placeholder="0,00"
                    autoFocus
                  />
                </div>
                {/* Quick values */}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[20, 50, 100, 200].map(v => (
                    <button
                      key={v}
                      onClick={() => setValorRecebido(String(v))}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                    >
                      R$ {v}
                    </button>
                  ))}
                  <button
                    onClick={() => setValorRecebido(String(Math.ceil(total)))}
                    className="px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-all"
                  >
                    Exato
                  </button>
                </div>

                {/* Troco */}
                {parseFloat(valorRecebido) >= total && total > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-center">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Troco</p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{fmt(troco)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Total + Action bar */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-slate-50 dark:bg-slate-900/50">
          {carrinho.length > 0 && !showPagamento && (
            <>
              {selectedCliente && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{selectedCliente.nome}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Subtotal:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{fmt(subtotal)}</span>
              </div>
              {descontoCupom > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Desconto:</span>
                  <span className="font-bold text-emerald-600">-{fmt(descontoCupom)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="font-black text-slate-700 dark:text-slate-300">Total:</span>
            <span className={`text-2xl font-black ${carrinho.length > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'}`}>
              {carrinho.length > 0 ? fmt(total) : 'R$ 0,00'}
            </span>
          </div>

          {/* Finalizar button */}
          <button onClick={() => {
              if (showPagamento) {
                finalizarVenda();
              } else if (carrinho.length > 0) {
                setShowPagamento(true);
              }
            }}
            disabled={carrinho.length === 0 || finalizando}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black uppercase tracking-widest
              disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30"
          >
            {finalizando ? (
              <>
                <LoadingSpinner size="sm" />PROCESSANDO...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {showPagamento ? 'FINALIZAR VENDA' : 'COBRAR'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Click outside handler */}
      {mostrarBusca && (
        <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setMostrarBusca(false)} />
      )}
    </div>
  );
}

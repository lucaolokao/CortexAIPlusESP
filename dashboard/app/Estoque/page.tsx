'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Plus, Search, Edit2, Trash2, Package, AlertTriangle,
  Download, X, LayoutGrid, List,
} from 'lucide-react';
import { getProdutos, getCategorias, createProduto, updateProduto, deleteProduto, getEstoqueResumo } from '@/lib/api';
import { useToast } from '@/lib/context';
import type { Produto, Categoria } from '@/lib/types';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

const LS_KEY = 'cortex_produto_extra';

function loadExtras(): Record<number, Partial<Produto>> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch { return {}; }
}

function saveExtra(id: number, data: Partial<Produto>) {
  const all = loadExtras();
  all[id] = { ...all[id], ...data };
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

function deleteExtra(id: number) {
  const all = loadExtras();
  delete all[id];
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

function mergeExtras(produtos: Produto[]): Produto[] {
  const extras = loadExtras();
  return produtos.map((p) => ({ ...p, ...(extras[p.id] || {}) }));
}

// ─── Form initial state ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  nome: '',
  sku: '',
  codigoBarras: '',
  categoria: '',
  estoque: '',
  precoCusto: '',
  preco: '',
  margemLucro: '',
  estoqueMinimo: '',
  fornecedor: '',
  validade: '',
  lote: '',
  localizacao: '',
  status: 'ativo' as 'ativo' | 'inativo' | 'descontinuado',
  descricao: '',
  tags: '',
};

type FormState = typeof EMPTY_FORM;

function calcMargem(custo: string, venda: string): string {
  const c = parseFloat(custo);
  const v = parseFloat(venda);
  if (!c || !v || c <= 0) return '';
  return (((v - c) / c) * 100).toFixed(1);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    ativo: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    inativo: 'bg-slate-100 dark:bg-slate-700 text-slate-500',
    descontinuado: 'bg-red-100 dark:bg-red-900/30 text-red-600',
  };
  const label: Record<string, string> = { ativo: 'Ativo', inativo: 'Inativo', descontinuado: 'Descontinuado' };
  const s = status || 'ativo';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[s] || map.ativo}`}>
      {label[s] || s}
    </span>
  );
}

// ─── Expiry helper (module-level avoids impure Date.now() in render) ─────────

function checkNearExpiry(validade?: string | null): boolean {
  if (!validade) return false;
  const d = new Date(validade);
  const limit = new Date();
  limit.setDate(limit.getDate() + 7);
  return d < limit;
}

// ─── Product card ─────────────────────────────────────────────────────────────

function ProdutoCard({
  produto, onEdit, onDelete,
}: {
  produto: Produto;
  onEdit: (p: Produto) => void;
  onDelete: (p: Produto) => void;
}) {
  const stockPct = produto.estoqueMinimo
    ? Math.min((produto.estoque / produto.estoqueMinimo) * 100, 100)
    : 100;
  const lowStock = produto.estoqueMinimo && produto.estoque < produto.estoqueMinimo;
  const nearExpiry = checkNearExpiry(produto.validade);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200
      dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{produto.nome}</p>
          {produto.sku && <p className="text-xs text-slate-400">SKU: {produto.sku}</p>}
        </div>
        <StatusBadge status={produto.status} />
      </div>

      {/* Category */}
      {produto.categoria && (
        <span className="self-start text-xs font-medium px-2 py-0.5 rounded-full
          bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
          {produto.categoria}
        </span>
      )}

      {/* Alerts */}
      {nearExpiry && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50
          dark:bg-amber-900/20 dark:text-amber-400 px-2 py-1 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5" />
          Vence em {new Date(produto.validade!).toLocaleDateString('pt-BR')}
        </div>
      )}

      {/* Stock bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">Estoque</span>
          <span className={`font-bold ${lowStock ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
            {produto.estoque} un.
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${lowStock ? 'bg-red-500' : 'bg-indigo-500'}`}
            style={{ width: `${stockPct}%` }}
          />
        </div>
      </div>

      {/* Price */}
      <div className="flex items-center justify-between">
        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
          R$ {Number(produto.preco).toFixed(2)}
        </span>
        {produto.margemLucro && (
          <span className="text-xs text-emerald-600 font-medium">
            {Number(produto.margemLucro).toFixed(1)}% margem
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onEdit(produto)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
            bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30
            text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300
            text-xs font-medium transition-all"
        >
          <Edit2 className="w-3.5 h-3.5" />Editar
        </button>
        <button
          onClick={() => onDelete(produto)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
            bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/30
            text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400
            text-xs font-medium transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />Excluir
        </button>
      </div>
    </div>
  );
}

// ─── Shared form helpers (defined outside component to avoid remount on re-render) ─

const inputCls = `w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600
  bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all
  placeholder:text-slate-400 dark:placeholder:text-slate-600`;

function FormField({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EstoquePage() {
  const { addToast } = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridView, setGridView] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editProduto, setEditProduto] = useState<Produto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Produto | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Stock summary
  const [estoqueResumo, setEstoqueResumo] = useState<{ totalItens: number; valorTotalCusto: number; produtosCadastrados: number; semEstoque: number } | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const load = useCallback(async () => {
    try {
      const [prods, cats, resumo] = await Promise.all([getProdutos(), getCategorias(), getEstoqueResumo()]);
      setProdutos(mergeExtras(prods));
      setCategorias(cats);
      setEstoqueResumo(resumo);
    } catch {
      addToast('error', 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  // Auto-calc margem when custo or preco changes — use useEffect to avoid state-during-render bug.
  // `form.margemLucro` is intentionally omitted from deps to prevent circular updates
  // (updating margemLucro would re-trigger this effect).
  useEffect(() => {
    const m = calcMargem(form.precoCusto, form.preco);
    if (m !== form.margemLucro) {
      setForm((f) => ({ ...f, margemLucro: m }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.precoCusto, form.preco]);

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.nome.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q);
      const matchCat = !filterCat || p.categoria === filterCat;
      const matchStatus = !filterStatus || (p.status || 'ativo') === filterStatus;
      return matchSearch && matchCat && matchStatus;
    });
  }, [produtos, search, filterCat, filterStatus]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const lowStockItems = useMemo(
    () => produtos.filter((p) => p.estoqueMinimo && p.estoque < p.estoqueMinimo),
    [produtos]
  );

  function openAdd() {
    setEditProduto(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(p: Produto) {
    setEditProduto(p);
    setForm({
      nome: p.nome,
      sku: p.sku || '',
      codigoBarras: p.codigoBarras || '',
      categoria: p.categoria,
      estoque: String(p.estoque),
      precoCusto: p.precoCusto ? String(p.precoCusto) : '',
      preco: String(p.preco),
      margemLucro: p.margemLucro ? String(p.margemLucro) : '',
      estoqueMinimo: p.estoqueMinimo ? String(p.estoqueMinimo) : '',
      fornecedor: p.fornecedor || '',
      validade: p.validade || '',
      lote: p.lote || '',
      localizacao: p.localizacao || '',
      status: p.status || 'ativo',
      descricao: p.descricao || '',
      tags: typeof p.tags === 'string' ? p.tags : (p.tags || []).join(', '),
    });
    setShowModal(true);
  }

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.nome.trim()) { addToast('error', 'Nome é obrigatório'); return; }
    const estoqueNum = parseInt(form.estoque);
    const precoNum = parseFloat(form.preco);
    if (isNaN(estoqueNum) || estoqueNum < 0) { addToast('error', 'Estoque inválido'); return; }
    if (isNaN(precoNum) || precoNum < 0) { addToast('error', 'Preço inválido'); return; }

    setSaving(true);
    const productData = {
      nome: form.nome.trim(),
      estoque: estoqueNum,
      preco: precoNum,
      categoria: form.categoria,
      sku: form.sku || undefined,
      codigoBarras: form.codigoBarras || undefined,
      precoCusto: form.precoCusto ? parseFloat(form.precoCusto) : undefined,
      estoqueMinimo: form.estoqueMinimo ? parseInt(form.estoqueMinimo) : undefined,
      fornecedor: form.fornecedor || undefined,
      validade: form.validade || undefined,
      lote: form.lote || undefined,
      localizacao: form.localizacao || undefined,
      status: form.status,
      descricao: form.descricao || undefined,
      tags: form.tags || undefined,
    };

    try {
      if (editProduto) {
        await updateProduto({ ...productData, nome: editProduto.nome });
        deleteExtra(editProduto.id);
        addToast('success', 'Produto atualizado!');
      } else {
        const created = await createProduto(productData);
        if (created) deleteExtra(created.id);
        addToast('success', 'Produto criado!');
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduto(deleteTarget.nome);
      deleteExtra(deleteTarget.id);
      addToast('success', 'Produto excluído!');
      setDeleteTarget(null);
      load();
    } catch {
      addToast('error', 'Erro ao excluir produto');
    } finally {
      setDeleting(false);
    }
  }

  function exportCSV() {
    const rows = [
      ['Nome', 'SKU', 'Categoria', 'Estoque', 'Preço', 'Status'].join(','),
      ...filtered.map((p) =>
        [p.nome, p.sku || '', p.categoria, p.estoque, p.preco, p.status || 'ativo'].join(',')
      ),
    ].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows);
    a.download = 'estoque.csv';
    a.click();
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Summary cards */}
      {estoqueResumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total em Estoque</p>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{estoqueResumo.totalItens.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-slate-400">unidades</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Valor de Custo</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">R$ {estoqueResumo.valorTotalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400">investido</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Produtos Cadastrados</p>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{estoqueResumo.produtosCadastrados}</p>
            <p className="text-xs text-slate-400">itens</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sem Estoque</p>
            <p className={`text-2xl font-black ${estoqueResumo.semEstoque > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{estoqueResumo.semEstoque}</p>
            <p className="text-xs text-slate-400">zerados</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded">
              ESTOQUE
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Gestão de Produtos
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            {produtos.length} produto{produtos.length !== 1 ? 's' : ''} cadastrado{produtos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl
          shadow-sm border border-slate-200 dark:border-slate-700">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold
              text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700
              transition-all border border-slate-200 dark:border-slate-600">
            <Download className="w-4 h-4" />CSV
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900
              dark:bg-indigo-600 text-white text-sm font-black uppercase tracking-widest
              hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all active:scale-95">
            <Plus className="w-4 h-4" />NOVO PRODUTO
          </button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20
          border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800 dark:text-amber-400 text-sm">
              {lowStockItems.length} produto(s) com estoque baixo
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              {lowStockItems.slice(0, 3).map((p) => p.nome).join(', ')}
              {lowStockItems.length > 3 ? ` e mais ${lowStockItems.length - 3}...` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white dark:bg-slate-800
          border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, SKU ou categoria..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 text-sm bg-transparent text-slate-900 dark:text-slate-100
              placeholder:text-slate-400 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        <select
          value={filterCat}
          onChange={(e) => { setFilterCat(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300
            focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todas categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300
            focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="descontinuado">Descontinuado</option>
        </select>

        <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <button onClick={() => setGridView(true)}
            className={`px-3 py-2 transition-all ${gridView
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50'}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setGridView(false)}
            className={`px-3 py-2 transition-all ${!gridView
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50'}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <LoadingSpinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
          <Package className="w-10 h-10" />
          <p className="text-sm">Nenhum produto encontrado</p>
        </div>
      ) : gridView ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginated.map((p) => (
            <ProdutoCard key={p.id} produto={p}
              onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200
          dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50">
                  {['Nome', 'SKU', 'Categoria', 'Estoque', 'Preço', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium
                      text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {paginated.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{p.nome}</td>
                    <td className="px-4 py-3 text-slate-500">{p.sku || '—'}</td>
                    <td className="px-4 py-3">
                      {p.categoria && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium
                          bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                          {p.categoria}
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3 font-bold ${p.estoqueMinimo && p.estoque < p.estoqueMinimo ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                      {p.estoque}
                    </td>
                    <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                      R$ {Number(p.preco).toFixed(2)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30
                            text-slate-400 hover:text-indigo-600 transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(p)}
                          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30
                            text-slate-400 hover:text-red-600 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-700
              disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            Anterior
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-700
              disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            Próximo
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editProduto ? 'Editar Produto' : 'Novo Produto'}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300
                bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700
                text-white text-sm font-black uppercase tracking-widest disabled:opacity-50
                transition-all active:scale-95 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
              {saving ? <LoadingSpinner size="sm" /> : null}
              {saving ? 'Salvando...' : editProduto ? 'ATUALIZAR' : 'CRIAR PRODUTO'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nome" required>
            <input type="text" value={form.nome} onChange={(e) => set('nome', e.target.value)}
              className={inputCls} placeholder="Ex: Cerveja Lata 350ml" />
          </FormField>
          <FormField label="SKU">
            <input type="text" value={form.sku} onChange={(e) => set('sku', e.target.value)}
              className={inputCls} placeholder="Ex: CERV-001" />
          </FormField>
          <FormField label="Código de Barras">
            <input type="text" value={form.codigoBarras} onChange={(e) => set('codigoBarras', e.target.value)}
              className={inputCls} placeholder="7891234567890" />
          </FormField>
          <FormField label="Categoria">
            <select value={form.categoria} onChange={(e) => set('categoria', e.target.value)}
              className={inputCls}>
              <option value="">Selecionar...</option>
              {categorias.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </FormField>
          <FormField label="Estoque" required>
            <input type="number" min="0" value={form.estoque} onChange={(e) => set('estoque', e.target.value)}
              className={inputCls} placeholder="0" />
          </FormField>
          <FormField label="Estoque Mínimo">
            <input type="number" min="0" value={form.estoqueMinimo} onChange={(e) => set('estoqueMinimo', e.target.value)}
              className={inputCls} placeholder="0" />
          </FormField>
          <FormField label="Preço de Custo (R$)">
            <input type="number" min="0" step="0.01" value={form.precoCusto} onChange={(e) => set('precoCusto', e.target.value)}
              className={inputCls} placeholder="0.00" />
          </FormField>
          <FormField label="Preço de Venda (R$)" required>
            <input type="number" min="0" step="0.01" value={form.preco} onChange={(e) => set('preco', e.target.value)}
              className={inputCls} placeholder="0.00" />
          </FormField>
          <FormField label="Margem de Lucro (%)">
            <input type="number" value={form.margemLucro} readOnly
              className={`${inputCls} bg-slate-50 dark:bg-slate-800 cursor-default`}
              placeholder="Auto-calculado" />
          </FormField>
          <FormField label="Fornecedor">
            <input type="text" value={form.fornecedor} onChange={(e) => set('fornecedor', e.target.value)}
              className={inputCls} placeholder="Nome do fornecedor" />
          </FormField>
          <FormField label="Data de Validade">
            <input type="date" value={form.validade} onChange={(e) => set('validade', e.target.value)}
              className={inputCls} />
          </FormField>
          <FormField label="Lote / Série">
            <input type="text" value={form.lote} onChange={(e) => set('lote', e.target.value)}
              className={inputCls} placeholder="Ex: LOT-2025-001" />
          </FormField>
          <FormField label="Localização (prateleira)">
            <input type="text" value={form.localizacao} onChange={(e) => set('localizacao', e.target.value)}
              className={inputCls} placeholder="Ex: A3 / Corredor 2" />
          </FormField>
          <FormField label="Status">
            <select value={form.status} onChange={(e) => set('status', e.target.value as FormState['status'])}
              className={inputCls}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="descontinuado">Descontinuado</option>
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Descrição">
              <textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)}
                rows={2} className={`${inputCls} resize-none`} placeholder="Descrição do produto..." />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Tags (separadas por vírgula)">
              <input type="text" value={form.tags} onChange={(e) => set('tags', e.target.value)}
                className={inputCls} placeholder="Ex: gelado, promoção, importado" />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar Exclusão"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300
                bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 transition-all">
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700
                text-white text-sm font-black uppercase tracking-widest disabled:opacity-50
                transition-all active:scale-95">
              {deleting ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
              EXCLUIR
            </button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Tem certeza que deseja excluir <span className="font-bold text-slate-800 dark:text-slate-200">
            {deleteTarget?.nome}
          </span>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}

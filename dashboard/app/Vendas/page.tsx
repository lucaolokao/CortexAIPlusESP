'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Download, Search, X, ShoppingCart, TrendingUp, DollarSign } from 'lucide-react';
import { getHistorico } from '@/lib/api';
import { useToast } from '@/lib/context';
import type { Venda } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function VendasPage() {
  const { addToast } = useToast();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    try {
      const data = await getHistorico();
      setVendas(data.reverse());
    } catch {
      addToast('error', 'Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return vendas.filter((v) => {
      const q = search.toLowerCase();
      const matchSearch = !q || v.produto.toLowerCase().includes(q);
      const matchOrigem = !filterOrigem || v.origem === filterOrigem;
      const matchFrom = !dateFrom || v.data >= dateFrom;
      const matchTo = !dateTo || v.data <= dateTo;
      return matchSearch && matchOrigem && matchFrom && matchTo;
    });
  }, [vendas, search, filterOrigem, dateFrom, dateTo]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const summary = useMemo(() => ({
    total: filtered.length,
    faturamento: filtered.reduce((s, v) => s + Number(v.total), 0),
    ticket: filtered.length ? filtered.reduce((s, v) => s + Number(v.total), 0) / filtered.length : 0,
  }), [filtered]);

  function exportCSV() {
    const rows = [
      ['Produto', 'Quantidade', 'Preço Unit.', 'Total', 'Origem', 'Data', 'Hora'].join(','),
      ...filtered.map((v) =>
        [v.produto, v.quantidade, v.preco, v.total, v.origem, v.data, v.hora].join(',')
      ),
    ].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows);
    a.download = 'vendas.csv';
    a.click();
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded">
              VENDAS
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Histórico de Vendas
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            Histórico completo de vendas registradas
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm
          border border-slate-200 dark:border-slate-700">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900
              dark:bg-slate-700 text-white text-sm font-black uppercase tracking-widest
              hover:bg-slate-800 dark:hover:bg-slate-600 transition-all active:scale-95">
            <Download className="w-4 h-4" />EXPORTAR CSV
          </button>
        </div>
      </div>

      {/* Summary cards — cloneado style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: ShoppingCart, label: 'Total de Vendas', value: String(summary.total), color: 'bg-indigo-600' },
          { icon: DollarSign, label: 'Faturamento', value: fmt(summary.faturamento), color: 'bg-emerald-600' },
          { icon: TrendingUp, label: 'Ticket Médio', value: fmt(summary.ticket), color: 'bg-amber-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white dark:bg-slate-800 p-5 rounded-2xl
            border border-slate-200 dark:border-slate-700 shadow-sm
            hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">{value}</h3>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-white dark:bg-slate-800
          border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar produto..."
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
          value={filterOrigem}
          onChange={(e) => { setFilterOrigem(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300
            focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todas as origens</option>
          <option value="manual">Manual</option>
          <option value="ia">IA</option>
          <option value="esp32">ESP32</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300
            focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300
            focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200
          dark:border-slate-700 overflow-hidden shadow-sm">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
              <ShoppingCart className="w-10 h-10" />
              <p className="text-sm">Nenhuma venda encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    {['Produto', 'Qtd', 'Preço Unit.', 'Total', 'Origem', 'Data', 'Hora'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium
                        text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {paginated.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                        {v.produto}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{v.quantidade}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {fmt(Number(v.preco))}
                      </td>
                      <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                        {fmt(Number(v.total))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                          ${v.origem === 'ia'
                            ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                            : v.origem === 'esp32'
                            ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                          {v.origem}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {v.data ? new Date(v.data).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {v.hora || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-700
              disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all
              text-slate-600 dark:text-slate-400">
            Anterior
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-700
              disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all
              text-slate-600 dark:text-slate-400">
            Próximo
          </button>
        </div>
      )}
    </div>
  );
}

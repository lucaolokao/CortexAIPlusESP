'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, DollarSign, ShoppingCart, Package, BarChart2 } from 'lucide-react';
import { getStats, getVendas7Dias, getHistorico } from '@/lib/api';
import { useToast } from '@/lib/context';
import type { Stats, VendasDia, Venda } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function RelatoriosPage() {
  const { addToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [vendas7, setVendas7] = useState<VendasDia[]>([]);
  const [historico, setHistorico] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, v7, hist] = await Promise.allSettled([
        getStats(), getVendas7Dias(), getHistorico(),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (v7.status === 'fulfilled') setVendas7(v7.value);
      if (hist.status === 'fulfilled') setHistorico(hist.value);
    } catch {
      addToast('error', 'Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  // Top products
  const topProdutos = useMemo(() => {
    const map: Record<string, number> = {};
    historico.forEach((v) => {
      const n = Number(v.total);
      map[v.produto] = (map[v.produto] || 0) + n;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nome, total]) => ({ nome, total }));
  }, [historico]);

  // Category distribution
  const catDist = useMemo(() => {
    const map: Record<string, number> = {};
    historico.forEach((v) => {
      const cat = v.produto.split(' ')[0];
      const n = Number(v.total);
      map[cat] = (map[cat] || 0) + n;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [historico]);

  const tooltipStyle = {
    backgroundColor: '#1e293b',
    border: 'none',
    borderRadius: '12px',
    color: '#f1f5f9',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded">
            RELATÓRIOS
          </span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            Análise de Desempenho
          </h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          Análise de vendas e desempenho geral
        </p>
      </div>

      {/* Summary cards — cloneado style */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: ShoppingCart, label: 'Total Vendas', value: String(stats.totalVendas), color: 'bg-indigo-600' },
            { icon: DollarSign, label: 'Faturamento Total', value: fmt(stats.faturamentoTotal), color: 'bg-emerald-600' },
            { icon: TrendingUp, label: 'Ticket Médio', value: fmt(stats.ticketMedio), color: 'bg-amber-500' },
            { icon: Package, label: 'Produtos Únicos', value: String(stats.produtosUnicos), color: 'bg-violet-600' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white dark:bg-slate-800 p-5 rounded-2xl
              border border-slate-200 dark:border-slate-700 shadow-sm
              hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg ${color}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                {label}
              </p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">{value}</h3>
            </div>
          ))}
        </div>
      )}

      {/* Revenue chart (7 days) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5
        border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
          Faturamento — Últimos 7 dias
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={vendas7} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={tooltipStyle} />
            <Line
              type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={2.5}
              dot={{ fill: '#4f46e5', r: 4 }} activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top products + Category distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top products */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5
          border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
            Top Produtos por Faturamento
          </h2>
          {topProdutos.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm gap-2">
              <BarChart2 className="w-6 h-6" />
              Sem dados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={topProdutos}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={tooltipStyle} />
                <Bar dataKey="total" fill="#4f46e5" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5
          border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
            Distribuição por Categoria
          </h2>
          {catDist.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm gap-2">
              <BarChart2 className="w-6 h-6" />
              Sem dados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={catDist}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {catDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={tooltipStyle} />
                <Legend
                  formatter={(v) => <span className="text-xs text-slate-600 dark:text-slate-300">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Detailed table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200
        dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Top Produtos — Detalhado
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50">
                {['#', 'Produto', 'Total Faturado', '% do Total'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-medium
                    text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {topProdutos.map((p, i) => {
                const grandTotal = topProdutos.reduce((s, x) => s + x.total, 0);
                const pTotal = Number(p.total);
                const pct = grandTotal ? ((pTotal / grandTotal) * 100).toFixed(1) : '0';
                return (
                  <tr key={p.nome} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <td className="px-5 py-3">
                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center
                        text-xs font-bold text-white`}
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">{p.nome}</td>
                    <td className="px-5 py-3 font-bold text-indigo-600 dark:text-indigo-400">{fmt(p.total)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-24">
                          <div className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: COLORS[i % COLORS.length],
                            }} />
                        </div>
                        <span className="text-xs text-slate-500">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

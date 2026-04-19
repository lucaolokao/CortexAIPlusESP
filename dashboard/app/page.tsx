'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ShoppingCart, DollarSign, TrendingUp, Package, Warehouse,
  Wifi, WifiOff, Bot, CheckCircle, Activity, ArrowUpRight,
  Search, RefreshCw,
} from 'lucide-react';
import {
  getStats, getVendas7Dias, getHistorico, getFaturamentoDia,
  getEspStatus, processarTexto, registrarVenda,
} from '@/lib/api';
import { useToast } from '@/lib/context';
import type { Stats, VendasDia, Venda, EspStatus } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function fmt(v: number | undefined) {
  if (!v || isNaN(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Metric card matching cloneado's design: icon top-left, badge top-right, large font-black value
function StatCard({
  icon: Icon, title, value, color, loading, badge,
}: {
  icon: React.ElementType; title: string; value: string;
  color: string; loading: boolean; badge?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200
      dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-200
      dark:hover:border-indigo-800 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {badge && (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400
            bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
        {title}
      </p>
      {loading ? (
        <div className="h-9 w-28 mt-1 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      ) : (
        <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">{value}</h3>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { addToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [faturamentoDia, setFaturamentoDia] = useState<number>(0);
  const [vendas7, setVendas7] = useState<VendasDia[]>([]);
  const [historico, setHistorico] = useState<Venda[]>([]);
  const [esp, setEsp] = useState<EspStatus>({ online: false, ultimoHeartbeat: null });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // AI Widget
  const [aiText, setAiText] = useState('');
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, v7, hist, fat, espSt] = await Promise.allSettled([
        getStats(),
        getVendas7Dias(),
        getHistorico(),
        getFaturamentoDia(),
        getEspStatus(),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (v7.status === 'fulfilled') setVendas7(v7.value);
      if (hist.status === 'fulfilled') setHistorico(hist.value.slice(0, 10));
      if (fat.status === 'fulfilled') setFaturamentoDia(fat.value.valor);
      if (espSt.status === 'fulfilled') setEsp(espSt.value);
    } catch {
      addToast('error', 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
    // Poll ESP status every 5s
    const espInterval = setInterval(async () => {
      try { const s = await getEspStatus(); setEsp(s); } catch {}
    }, 5000);
    // Tick "seconds ago" every second
    const tickInterval = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(espInterval); clearInterval(tickInterval); };
  }, [loadData]);

  async function handleProcessar() {
  if (!aiText.trim()) {
    addToast('warning', 'Digite algo para processar');
    return;
  }
  setAiLoading(true);
  setAiResult(null);
  try {
    const r = await processarTexto(aiText);
    
    if (!r || !r.itens || r.itens.length === 0) {
      addToast('warning', 'Nenhum produto encontrado');
      return;
    }
    
    const encontrados = r.itens.filter((i: any) => i.encontrado);
    if (encontrados.length === 0) {
      addToast('error', 'Nenhum produto identificado com confiança');
      return;
    }
    
    setAiResult(r);
    addToast('success', `✅ ${encontrados.length} produto(s) encontrado(s)!`);
  } catch (e) {
    console.error('Erro:', e);
    addToast('error', 'Erro ao processar texto');
  } finally {
    setAiLoading(false);
  }
}

  async function handleConfirmarVenda() {
  if (!aiResult) return;
  
  setConfirmLoading(true);
  try {
    const primeiroEncontrado = aiResult.itens.find((i: any) => i.encontrado);
    if (!primeiroEncontrado || !primeiroEncontrado.produto) {
      addToast('error', 'Produto não encontrado');
      return;
    }
    
    const produto = primeiroEncontrado.produto;
    await registrarVenda({
      produto: produto.nome,
      quantidade: primeiroEncontrado.quantidade,
      preco: Number(produto.preco),
      origem: 'ia',
      audioLogId: aiResult.audioLogId,
    });

    const total = primeiroEncontrado.quantidade * Number(produto.preco);
    addToast('success', `✅ ${primeiroEncontrado.quantidade}x ${produto.nome} = ${fmt(total)}`);
    
    setAiResult(null);
    setAiText('');
    loadData();
  } catch (e) {
    console.error('Erro:', e);
    addToast('error', 'Erro ao registrar venda');
  } finally {
    setConfirmLoading(false);
  }
}

  const statCards = [
    {
      icon: ShoppingCart,
      title: 'Total de Vendas',
      value: stats ? String(stats.totalVendas) : '—',
      color: 'bg-indigo-600',
      badge: stats && stats.totalVendas > 0 ? '+HOJE' : undefined,
    },
    {
      icon: DollarSign,
      title: 'Faturamento Hoje',
      value: fmt(faturamentoDia),
      color: 'bg-emerald-600',
    },
    {
      icon: TrendingUp,
      title: 'Ticket Médio',
      value: stats ? fmt(stats.ticketMedio) : '—',
      color: 'bg-amber-500',
    },
    {
      icon: Package,
      title: 'Produtos Únicos',
      value: stats ? String(stats.produtosUnicos) : '—',
      color: 'bg-sky-600',
    },
    {
      icon: Warehouse,
      title: 'Valor do Estoque',
      value: stats ? fmt(stats.valorEstoque) : '—',
      color: 'bg-violet-600',
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">

      {/* HEADER — command center style matching cloneado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
              esp.online
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-400 text-white'
            }`}>
              {esp.online ? 'LIVE' : 'OFFLINE'}
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {greeting()} 👋
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            {esp.online
              ? 'Aparelho Online — Transmitindo dados em tempo real'
              : 'Monitorando sistema — Aparelho aguardando conexão'}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-xl
          shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 px-3 border-r border-slate-100 dark:border-slate-700">
            {esp.online
              ? <Wifi size={16} className="text-emerald-500" />
              : <WifiOff size={16} className="text-slate-400" />}
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {esp.online ? 'CONECTADO' : 'DESCONECTADO'}
            </span>
          </div>
          <button
            onClick={loadData}
            className="bg-slate-900 dark:bg-slate-700 text-white px-4 py-2 rounded-lg
              font-black text-xs uppercase tracking-widest hover:bg-slate-800
              dark:hover:bg-slate-600 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            ATUALIZAR
          </button>
        </div>
      </div>

      {/* METRIC CARDS — 5-column grid matching cloneado's card style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((c) => (
          <StatCard key={c.title} {...c} loading={loading} />
        ))}
      </div>

      {/* CHARTS + FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Feed de vendas + gráfico — main column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Sales chart */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200
            dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700
              flex justify-between items-center bg-slate-50/50 dark:bg-slate-700/30">
              <h2 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Activity size={18} className="text-indigo-600" />
                VENDAS — ÚLTIMOS 7 DIAS
              </h2>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="h-48 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={vendas7} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => fmt(Number(v))}
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#f1f5f9',
                      }}
                    />
                    <Bar dataKey="total" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent sales table */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200
            dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700
              flex justify-between items-center bg-slate-50/50 dark:bg-slate-700/30">
              <h2 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ShoppingCart size={18} className="text-indigo-600" />
                ÚLTIMAS VENDAS
              </h2>
              <Search size={18} className="text-slate-400 cursor-pointer" />
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : historico.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Nenhuma venda registrada</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {historico.map((v) => (
                  <div
                    key={v.id}
                    className="p-5 hover:bg-slate-50 dark:hover:bg-slate-700/40
                      transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex gap-4 items-center">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                        ${v.origem === 'ia'
                          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                        {v.origem === 'ia' ? <Bot size={18} /> : <ShoppingCart size={18} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200
                          group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {v.produto}
                        </p>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {v.quantidade} un. • {v.origem}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-indigo-600 dark:text-indigo-400">
                        {fmt(Number(v.total))}
                      </span>
                      <ArrowUpRight size={18}
                        className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Side panels */}
        <div className="space-y-6">

          {/* ESP32 Status — dark panel matching cloneado's control panel */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full
              -mr-16 -mt-16 blur-3xl" />

            <h3 className="font-black text-lg mb-4 flex items-center gap-2 relative z-10">
              <div className={`w-2 h-2 rounded-full ${esp.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              Status do CortexAI (Aparelho)
            </h3>

            <div className="space-y-5 relative z-10">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-slate-400 uppercase">Conexão</span>
                <span className={`text-sm font-black ${esp.online ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {esp.online ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full">
                <div className={`h-full rounded-full transition-all ${
                  esp.online ? 'bg-emerald-500 w-full' : 'bg-slate-600 w-0'
                }`} />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Status</p>
                  <p className="text-lg font-black text-white">
                    {esp.online ? '🟢' : '🔴'}
                  </p>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {esp.ultimoHeartbeat ? 'Último Ping' : 'Latência'}
                  </p>
                  <p className="text-lg font-black text-white">
                    {esp.ultimoHeartbeat
                      ? `${Math.round((now - esp.ultimoHeartbeat) / 1000)}s atrás`
                      : '—'}
                  </p>
                </div>
              </div>

              {esp.online && (
                <div className="flex items-center gap-2 text-xs text-emerald-400
                  bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Transmitindo dados em tempo real
                </div>
              )}
            </div>
          </div>

          {/* AI Widget - Carrinho de Compras */}
        <div className="bg-indigo-50 dark:bg-slate-800 border-2 border-dashed
          border-indigo-200 dark:border-indigo-800 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40
              flex items-center justify-center">
              <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-indigo-900 dark:text-indigo-200 font-black text-sm uppercase tracking-tight">
                🛒 IA — Carrinho de Vendas
              </h4>
            </div>
            {aiResult && aiResult.itens?.filter((i: any) => i.encontrado).length > 0 && (
              <span className="bg-indigo-600 text-white text-xs font-black px-2 py-1 rounded-full">
                {aiResult.itens.filter((i: any) => i.encontrado).length}
              </span>
            )}
          </div>

          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Ex: 1 lays e 2 aguas..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-700
              bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
              text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500
              placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
          <button
            onClick={handleProcessar}
            disabled={aiLoading || !aiText.trim()}
            className="w-full mt-3 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700
              text-white text-xs font-black uppercase tracking-widest
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
          >
            {aiLoading ? <LoadingSpinner size="sm" /> : <Bot className="w-4 h-4" />}
            {aiLoading ? 'PROCESSANDO...' : 'PROCESSAR COM IA'}
          </button>

          {/* CARRINHO */}
          {aiResult && aiResult.itens?.filter((i: any) => i.encontrado).length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-white dark:bg-slate-900
              border border-indigo-200 dark:border-indigo-800 space-y-3 animate-fadeIn">
              
              <p className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                🛒 Seu Carrinho
              </p>

              {/* Itens */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {aiResult.itens.filter((i: any) => i.encontrado).map((item: any, idx: number) => (
                  <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg 
                    border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {item.produto?.nome || '?'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {fmt(Number(item.produto?.preco || 0))} cada
                      </p>
                    </div>

                    {/* Controles de Quantidade */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                      <button
                        onClick={() => {
                          const novoItens = [...aiResult.itens];
                          if (item.quantidade > 1) {
                            novoItens[idx].quantidade -= 1;
                            setAiResult({ ...aiResult, itens: novoItens });
                          }
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-200 
                          dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 
                          text-xs font-bold transition-all active:scale-95"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.quantidade}
                      </span>
                      <button
                        onClick={() => {
                          const novoItens = [...aiResult.itens];
                          novoItens[idx].quantidade += 1;
                          setAiResult({ ...aiResult, itens: novoItens });
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-200 
                          dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 
                          text-xs font-bold transition-all active:scale-95"
                      >
                        +
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right min-w-max">
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {fmt(item.quantidade * Number(item.produto?.preco || 0))}
                      </p>
                      <span className={`text-[10px] font-black px-1 py-0.5 rounded ${
                        item.confianca >= 80
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : item.confianca >= 50
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {item.confianca}%
                      </span>
                    </div>

                    {/* Remover */}
                    <button
                      onClick={() => {
                        const novoItens = aiResult.itens.filter((_: any, i: number) => i !== idx);
                        if (novoItens.filter((i: any) => i.encontrado).length === 0) {
                          setAiResult(null);
                        } else {
                          setAiResult({ ...aiResult, itens: novoItens });
                        }
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded bg-red-100 
                        dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 
                        text-red-600 dark:text-red-400 text-xs font-bold transition-all active:scale-95"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* TOTAL */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Total ({aiResult.itens.filter((i: any) => i.encontrado).reduce((s: number, i: any) => s + i.quantidade, 0)} itens):
                  </span>
                  <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                    {fmt(aiResult.itens.filter((i: any) => i.encontrado).reduce((s: number, i: any) => s + (i.quantidade * Number(i.produto?.preco || 0)), 0))}
                  </span>
                </div>

                <button
                  onClick={async () => {
                    setConfirmLoading(true);
                    try {
                      const encontrados = aiResult.itens.filter((i: any) => i.encontrado);

                      for (const item of encontrados) {
                        if (item.produto && item.quantidade > (item.produto.estoque || 0)) {
                          addToast('error', `Estoque insuficiente: ${item.produto.nome} tem apenas ${item.produto.estoque} un.`);
                          return;
                        }
                      }

                      for (const item of encontrados) {
                        if (item.produto) {
                          await registrarVenda({
                            produto: item.produto.nome,
                            quantidade: item.quantidade,
                            preco: Number(item.produto.preco),
                            origem: 'ia',
                            audioLogId: aiResult.audioLogId,
                          });
                        }
                      }

                        const totalItems = encontrados.length;
                      addToast('success', `✅ ${totalItems} produto(s) registrado(s)!`);
                      setAiResult(null);
                      setAiText('');
                      loadData();
                    } catch (e: any) {
                      let msg = 'Erro ao registrar vendas';
                      if (e?.message) {
                        try { msg = JSON.parse(e.message).erro || msg; } catch { msg = e.message; }
                      }
                      addToast('error', msg);
                    } finally {
                      setConfirmLoading(false);
                    }
                  }}
                  disabled={confirmLoading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700
                    text-white text-xs font-black uppercase tracking-widest
                    flex items-center justify-center gap-2 disabled:opacity-50
                    transition-all active:scale-95"
                >
                  {confirmLoading ? <LoadingSpinner size="sm" /> : <CheckCircle className="w-4 h-4" />}
                  CONFIRMAR TUDO
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

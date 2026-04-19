'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Bell, AlertTriangle, Package, Cpu, Check, CheckCheck, Filter } from 'lucide-react';
import { getNotificacoes, marcarNaoLidasCount, marcarNotificacaoLida, marcarTodasLidas } from '@/lib/api';
import { useToast } from '@/lib/context';
import type { Notificacao } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';

const TYPE_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  estoque_baixo: { icon: <Package className="w-4 h-4" />, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', label: 'Estoque Baixo' },
  produto_vencendo: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-500 bg-red-50 dark:bg-red-900/20', label: 'Produto Vencendo' },
  sistema: { icon: <Cpu className="w-4 h-4" />, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20', label: 'Sistema' },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function NotificacoesPage() {
  const { addToast } = useToast();
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');

  const load = useCallback(async () => {
    try { setNotifs(await getNotificacoes()); } catch { addToast('error', 'Erro ao carregar'); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  const filtered = useMemo(() => filterType ? notifs.filter(n => n.tipo === filterType) : notifs, [notifs, filterType]);
  const unreadCount = useMemo(() => notifs.filter(n => !n.lida).length, [notifs]);

  async function markRead(id: number) {
    await marcarNotificacaoLida(id);
    setNotifs(p => p.map(n => n.id === id ? { ...n, lida: true } : n));
  }

  async function markAllRead() {
    await marcarTodasLidas();
    setNotifs(p => p.map(n => ({ ...n, lida: true })));
    addToast('success', 'Todas marcadas como lidas!');
  }

  const types = useMemo(() => [...new Set(notifs.map(n => n.tipo))], [notifs]);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded">NOTIFICAÇÕES</span>
          <h1 className="text-2xl font-black tracking-tight">Central de Notificações</h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo em dia!'}</p>
      </div>

      <div className="flex items-center gap-3">
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold active:scale-95 transition-all">
            <CheckCheck className="w-4 h-4" />Marcar todas lidas
          </button>
        )}
      </div>

      {types.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <Filter className="w-4 h-4 text-slate-400" />
          <button onClick={() => setFilterType('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!filterType ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}>
            Todas
          </button>
          {types.map(t => {
            const cfg = TYPE_MAP[t] || { icon: <Bell className="w-4 h-4" />, color: '', label: t };
            return (
              <button key={t} onClick={() => setFilterType(filterType === t ? '' : t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {cfg.icon}{cfg.label}
              </button>
            );
          })}
        </div>
      )}

      {loading ? <div className="flex justify-center h-40 items-center"><LoadingSpinner size="lg" /></div> : (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <Bell className="w-10 h-10" /><p className="text-sm">Nenhuma notificação</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(n => {
              const cfg = TYPE_MAP[n.tipo] || TYPE_MAP.sistema;
              return (
                <div key={n.id} className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm transition-all ${n.lida ? 'border-slate-200 dark:border-slate-700 opacity-70' : 'border-indigo-200 dark:border-indigo-800'}`}>
                  <div className="p-4 flex items-start gap-4">
                    <div className={`p-2 rounded-xl flex-shrink-0 ${cfg.color}`}>{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-sm">{n.titulo}</h3>
                        {!n.lida && (
                          <button onClick={() => markRead(n.id)} className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{n.mensagem}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">{cfg.label}</span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-[10px] text-slate-400">{timeAgo(n.criadoEm)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />Atualização automática a cada 30s
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun, Database, Cpu, Info, ArrowDownToLine, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useTheme } from '@/lib/context';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getEspStatus } from '@/lib/api';

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700">
        <div className="p-2 rounded-lg bg-indigo-600">{icon}</div>
        <div><h2 className="font-black text-slate-900 dark:text-slate-100">{title}</h2><p className="text-xs text-slate-400">{subtitle}</p></div>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );
}

function EspStatusBadge() {
  const [status, setStatus] = useState<{ online: boolean; ultimoHeartbeat: number | null } | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchStatus() {
    setLoading(true);
    try {
      const data = await getEspStatus();
      setStatus(data as { online: boolean; ultimoHeartbeat: number | null });
    } catch {
      setStatus({ online: false, ultimoHeartbeat: null });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">Verificando...</span>;
  }

  const online = status?.online ?? false;
  const lastSeen = status?.ultimoHeartbeat;
  const lastSeenText = lastSeen
    ? `Último ping: ${Math.round((Date.now() - lastSeen) / 1000)}s atrás`
    : 'Nunca conectado';

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {loading && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
        <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
          online
            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
      <span className="text-[10px] text-slate-400">{lastSeenText}</span>
    </div>
  );
}

export default function ConfigPage() {
  const { dark, toggleTheme } = useTheme();
  const [backingUp, setBackingUp] = useState(false);

  function handleBackup() {
    setBackingUp(true);
    setTimeout(() => { setBackingUp(false); }, 2000);
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded">CONFIGURAÇÕES</span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Configurações</h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Preferências do sistema</p>
      </div>

      <Section icon={<Moon className="w-5 h-5 text-white" />} title="Aparência" subtitle="Tema do sistema">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {dark ? <Moon className="w-5 h-5 text-indigo-500" /> : <Sun className="w-5 h-5 text-amber-500" />}
            <div><p className="font-bold text-sm">{dark ? 'Modo Escuro' : 'Modo Claro'}</p><p className="text-xs text-slate-400">Alterne entre os temas</p></div>
          </div>
          <button onClick={toggleTheme} className={`relative w-12 h-6 rounded-full transition-all ${dark ? 'bg-indigo-600' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${dark ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </Section>

      <Section icon={<Database className="w-5 h-5 text-white" />} title="Banco de Dados" subtitle="Backup">
        <div className="flex items-center justify-between">
          <div><p className="font-bold text-sm">Exportar Backup</p><p className="text-xs text-slate-400">Faça backup do banco de dados</p></div>
          <button onClick={handleBackup} disabled={backingUp} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-all">
            {backingUp ? <LoadingSpinner size="sm" /> : <ArrowDownToLine className="w-4 h-4" />}{backingUp ? 'Backup...' : 'BACKUP'}
          </button>
        </div>
      </Section>

      <Section icon={<Cpu className="w-5 h-5 text-white" />} title="ESP32-S3" subtitle="Hardware POS Terminal">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">Status do Terminal</p>
            <p className="text-xs text-slate-400">ESP32-S3 + ILI9341 TFT 2.8&quot; — heartbeat a cada 5s</p>
          </div>
          <EspStatusBadge />
        </div>
      </Section>

      <Section icon={<Info className="w-5 h-5 text-white" />} title="Sobre" subtitle="Versão e info">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Versão</span><span className="font-bold">CortexAI POS v7.0</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Frontend</span><span className="font-bold">Next.js 16 + React 19 + Tailwind 4</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Backend</span><span className="font-bold">Express + Prisma + PostgreSQL</span></div>
        </div>
      </Section>
    </div>
  );
}

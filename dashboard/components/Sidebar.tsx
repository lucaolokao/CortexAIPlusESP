'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, Package, Tag, ShoppingCart, BarChart2,
  Cpu, Moon, Sun, Wifi, WifiOff,
  Bell, Settings, Users,
  ArrowLeft, ArrowRight, Zap,
} from 'lucide-react';
import { useTheme, useSidebar } from '@/lib/context';
import { getEspStatus, marcarNaoLidasCount } from '@/lib/api';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'PDV', href: '/PDV', icon: Zap },
  { label: 'Estoque', href: '/Estoque', icon: Package },
  { label: 'Categorias', href: '/Categorias', icon: Tag },
  { label: 'Vendas', href: '/Vendas', icon: ShoppingCart },
  { label: 'Clientes', href: '/Clientes', icon: Users },
  { label: 'Relatórios', href: '/Relatorios', icon: BarChart2 },
  { label: 'Notificações', href: '/Notificacoes', icon: Bell },
  { label: 'Configurações', href: '/Config', icon: Settings },
];

function SidebarContent({ pathname, collapsed, setSidebarOpen, notifsCount }: {
  pathname: string;
  collapsed: boolean;
  setSidebarOpen?: (v: boolean) => void;
  notifsCount: number;
}) {
  const { dark, toggleTheme } = useTheme();
  const [espOnline, setEspOnline] = useState(false);
  const [lastHB, setLastHB] = useState<number | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const s = await getEspStatus();
        setEspOnline(s.online);
        setLastHB(s.ultimoHeartbeat);
      } catch { setEspOnline(false); }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {/* Logo */}
      <div className={`flex items-center border-b border-slate-100 dark:border-slate-800 ${collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-5 py-5'}`}>
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Cpu className="text-white" size={18} />
        </div>
        {!collapsed && (
          <div>
            <span className="font-black text-xl tracking-tighter text-slate-900 dark:text-slate-100 leading-none block">
              CortexAI
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold">POS System</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'px-2 py-2' : 'px-3 py-4 space-y-1'}`}>
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen?.(false)}
              className={`flex items-center gap-3 rounded-xl text-sm font-bold transition-all duration-200 group
                ${collapsed
                  ? `justify-center p-3 ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`
                  : `px-4 py-3 ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'}`
                }`}
            >
              <div className="relative flex-shrink-0">
                <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : ''}`} />
                {href === '/Notificacoes' && notifsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
                    {notifsCount > 9 ? '9+' : notifsCount}
                  </span>
                )}
              </div>
              {!collapsed && (
                <>
                  {label}
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className={`border-t border-slate-100 dark:border-slate-800 ${collapsed ? 'pb-3 pt-2 space-y-2' : 'px-3 pb-4 pt-3 space-y-2'}`}>
        {/* ESP32 */}
        <div className={`${collapsed ? 'flex justify-center p-3' : 'flex items-center gap-3 px-4 py-3'} rounded-xl text-sm ${espOnline
          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
        }`}>
          <div className="relative flex-shrink-0">
            {espOnline
              ? <Wifi className="w-4 h-4" />
              : <WifiOff className="w-4 h-4" />}
            {espOnline && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-black text-xs uppercase tracking-tighter">{espOnline ? 'ESP Online' : 'ESP Offline'}</p>
              {lastHB && <p className="text-[10px] opacity-60 truncate">{Math.round((Date.now() - lastHB) / 1000)}s atrás</p>}
            </div>
          )}
        </div>

        {/* Dark mode */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 ${collapsed ? 'justify-center p-3' : 'px-4 py-3'}`}
        >
          <Moon className="w-5 h-5 dark:hidden flex-shrink-0" />
          <Sun className="w-5 h-5 hidden dark:flex text-amber-500 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="dark:hidden">Modo Escuro</span>
              <span className="hidden dark:inline">Modo Claro</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [notifsCount, setNotifsCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function count() {
      try { const c = await marcarNaoLidasCount(); setNotifsCount(c); } catch { setNotifsCount(0); }
    }
    count();
  }, []);

  return (
    <>
      {/* Mobile overlay + slide-in sidebar */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed top-0 left-0 h-screen w-[260px] flex flex-col z-50
            bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="font-black text-sm text-slate-600 dark:text-slate-300">Menu</span>
              <div className="w-5" />
            </div>
            <SidebarContent pathname={pathname} collapsed={false} setSidebarOpen={setSidebarOpen} notifsCount={notifsCount} />
          </aside>
        </>
      )}

      {/* Desktop fixed sidebar */}
      <aside className={`fixed top-0 left-0 h-screen flex flex-col z-40
        bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 shadow-xl
        transition-all duration-300 hidden md:flex ${collapsed ? 'w-[72px]' : 'w-[260px]'}`}>
        <SidebarContent
          pathname={pathname}
          collapsed={collapsed}
          notifsCount={notifsCount}
        />
        {/* Collapse toggle at bottom */}
        <div className="px-3 pb-3 hidden md:block">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all bg-slate-50 dark:bg-slate-800 p-3"
          >
            {collapsed ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5 flex-shrink-0" />}
            {!collapsed && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recolher</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

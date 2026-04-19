'use client';

import './globals.css';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';
import { ToastProvider, ThemeProvider } from '@/lib/context';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <title>CortexAI POS — Dashboard</title>
        <meta name="description" content="CortexAI POS Dashboard — Gestão de Estoque e Vendas" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75' fill='%234f46e5'>⚡</text></svg>"
        />
        {/* Inline script: apply dark class before first paint to avoid flash */}
        <template dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme');
            if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          } catch(e) {}
        `}} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <Sidebar />
            <main className="ml-[260px] min-h-screen bg-slate-50 dark:bg-slate-900
              text-slate-900 dark:text-slate-100 transition-colors duration-300">
              {children}
            </main>
            <Toast />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

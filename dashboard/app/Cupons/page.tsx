'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Tag, X, Percent } from 'lucide-react';
import { getCupons, createCupom, updateCupom, deleteCupom } from '@/lib/api';
import { useToast } from '@/lib/context';
import type { Cupom } from '@/lib/types';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';

const EMPTY = { codigo: '', tipo: 'percentual' as 'percentual' | 'valor', valor: '', valorMinimo: '', validoAte: '', usosMax: '1' };
const inp = `w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400`;

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>;
}

function isValid(c: Cupom) {
  return c.ativo && new Date(c.validoAte) > new Date() && c.usos < c.usosMax;
}

export default function CuponsPage() {
  const { addToast } = useToast();
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editOne, setEditOne] = useState<Cupom | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Cupom | null>(null);

  const load = useCallback(async () => {
    try { setCupons(await getCupons()); } catch { addToast('error', 'Erro ao carregar'); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => cupons.filter(c => {
    const q = search.toLowerCase();
    return !q || c.codigo.toLowerCase().includes(q);
  }), [cupons, search]);

  function openAdd() { setEditOne(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(c: Cupom) {
    setEditOne(c);
    setForm({ codigo: c.codigo, tipo: c.tipo, valor: String(c.valor), valorMinimo: c.valorMinimo ? String(c.valorMinimo) : '', validoAte: new Date(c.validoAte).toISOString().split('T')[0], usosMax: String(c.usosMax) });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.codigo.trim() || !form.valor || !form.validoAte) { addToast('error', 'Campos obrigatórios'); return; }
    setSaving(true);
    try {
      const data = { ...form, valor: parseFloat(form.valor), usosMax: parseInt(form.valor) || 1, valorMinimo: form.valorMinimo ? parseFloat(form.valorMinimo) : undefined };
      if (editOne) await updateCupom(editOne.id, data);
      else await createCupom(data);
      setShowModal(false); addToast('success', editOne ? 'Atualizado!' : 'Criado!'); load();
    } catch (e: any) { addToast('error', e?.message || 'Erro'); }
    finally { setSaving(false); }
  }

  async function handleDel() {
    if (!delTarget) return;
    try { await deleteCupom(delTarget.codigo); addToast('success', 'Excluído!'); setDelTarget(null); load(); }
    catch { addToast('error', 'Erro ao excluir'); }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded">CUPONS</span>
            <h1 className="text-2xl font-black tracking-tight">Cupons de Desconto</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{cupons.filter(c => isValid(c)).length} ativos de {cupons.length}</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black uppercase active:scale-95 hover:bg-indigo-700 transition-all"><Plus className="w-4 h-4" />Novo</button>
      </div>

      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm max-w-md">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input type="text" placeholder="Buscar cupom..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 text-sm bg-transparent focus:outline-none" />
        {search && <button onClick={() => setSearch('')}><X className="w-4 h-4 text-slate-400" /></button>}
      </div>

      {loading ? <div className="flex justify-center h-40 items-center"><LoadingSpinner size="lg" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(c => {
            const active = isValid(c);
            return (
              <div key={c.id} className={`bg-white dark:bg-slate-800 rounded-2xl p-5 border shadow-sm flex flex-col gap-3 ${active ? 'border-indigo-200 dark:border-indigo-800' : 'border-slate-200 dark:border-slate-700 opacity-70'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${c.tipo === 'percentual' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'}`}>
                      <Tag className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-lg tracking-tight">{c.codigo}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                        {active ? 'Ativo' : 'Inativo/Expirado'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                  {c.tipo === 'percentual' ? `${c.valor}%` : `R$ ${parseFloat(String(c.valor)).toFixed(2)}`}
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  {c.valorMinimo && <p>Compra mín: R$ {parseFloat(String(c.valorMinimo)).toFixed(2)}</p>}
                  <p>Usos: {c.usos}/{c.usosMax}</p>
                  <p>Válido até: {new Date(c.validoAte).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => openEdit(c)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-700 transition-all"><Edit2 className="w-3.5 h-3.5" />Editar</button>
                  <button onClick={() => setDelTarget(c)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 transition-all"><Trash2 className="w-3.5 h-3.5" />Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editOne ? 'Editar Cupom' : 'Novo Cupom'} size="lg" footer={
        <><button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black uppercase active:scale-95 disabled:opacity-50">{saving ? <LoadingSpinner size="sm" /> : null}{editOne ? 'ATUALIZAR' : 'CRIAR'}</button></>
      }>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Código" required><input type="text" value={form.codigo} onChange={e => setForm(f => ({...f, codigo: e.target.value.toUpperCase()}))} className={inp} placeholder="DESCONTO10" /></Field>
          <Field label="Tipo" required><select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value as any}))} className={inp}><option value="percentual">Percentual (%)</option><option value="valor">Valor Fixo (R$)</option></select></Field>
          <Field label="Valor" required><input type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm(f => ({...f, valor: e.target.value}))} className={inp} placeholder="10" /></Field>
          <Field label="Valor Mínimo (R$)"><input type="number" min="0" step="0.01" value={form.valorMinimo} onChange={e => setForm(f => ({...f, valorMinimo: e.target.value}))} className={inp} placeholder="50" /></Field>
          <Field label="Válido Até" required><input type="date" value={form.validoAte} onChange={e => setForm(f => ({...f, validoAte: e.target.value}))} className={inp} /></Field>
          <Field label="Usos Máximos" required><input type="number" min="1" value={form.usosMax} onChange={e => setForm(f => ({...f, usosMax: e.target.value}))} className={inp} placeholder="100" /></Field>
        </div>
      </Modal>

      <Modal isOpen={!!delTarget} onClose={() => setDelTarget(null)} title="Confirmar Exclusão" size="sm" footer={
        <><button onClick={() => setDelTarget(null)} className="px-4 py-2 rounded-xl text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Cancelar</button>
          <button onClick={handleDel} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-black uppercase">Excluir</button></>
      }><p className="text-sm text-slate-600 dark:text-slate-400">Excluir cupom <b>{delTarget?.codigo}</b>?</p></Modal>
    </div>
  );
}

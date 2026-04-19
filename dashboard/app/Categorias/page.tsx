'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, Edit2, Tag, AlertTriangle, Snowflake,
} from 'lucide-react';
import { getCategorias, createCategoria, updateCategoria, deleteCategoria } from '@/lib/api';
import { useToast } from '@/lib/context';
import type { Categoria } from '@/lib/types';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

const LS_KEY = 'cortex_categoria_extra';

function loadExtras(): Record<number, Partial<Categoria>> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}

function saveExtra(id: number, data: Partial<Categoria>) {
  const all = loadExtras();
  all[id] = { ...all[id], ...data };
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

function deleteExtra(id: number) {
  const all = loadExtras();
  delete all[id];
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

function mergeExtras(cats: Categoria[]): Categoria[] {
  const extras = loadExtras();
  return cats.map((c) => ({ ...c, ...(extras[c.id] || {}) }));
}

// ─── Form state ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  nome: '',
  descricao: '',
  tipoProduto: '' as '' | 'bebida' | 'comida' | 'eletronico' | 'outro',
  classificacaoBebida: '' as '' | 'normal' | 'alcoolica' | 'refrigerada',
  icone: '',
  cor: '#4f46e5',
  margemLucroPadrao: '',
  metaVendasMensais: '',
  comissaoPorVenda: '',
  ordemExibicao: '',
  status: 'ativa' as 'ativa' | 'inativa',
  tags: '',
};

type FormState = typeof EMPTY_FORM;

// ─── Category card ────────────────────────────────────────────────────────────

function CategoriaCard({
  categoria, onEdit, onDelete,
}: {
  categoria: Categoria;
  onEdit: (c: Categoria) => void;
  onDelete: (c: Categoria) => void;
}) {
  const tipo = categoria.tipoProduto;
  const classif = categoria.classificacaoBebida;
  const isAlcoolica = tipo === 'bebida' && classif === 'alcoolica';
  const isRefrigerada = tipo === 'bebida' && classif === 'refrigerada';

  const tipoLabel: Record<string, string> = {
    bebida: 'Bebida', comida: 'Comida', eletronico: 'Eletrônico', outro: 'Outro',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200
      dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-3">
      {/* Color + icon */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: (categoria.cor || '#4f46e5') + '22', border: `2px solid ${categoria.cor || '#4f46e5'}` }}
        >
          {categoria.icone || '🏷️'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate">{categoria.nome}</h3>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {tipo && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium
                bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                {tipoLabel[tipo] || tipo}
              </span>
            )}
            {(categoria.status || 'ativa') === 'inativa' && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium
                bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                Inativa
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {categoria.descricao && (
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
          {categoria.descricao}
        </p>
      )}

      {/* Special badges */}
      {isAlcoolica && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl
          bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
            🔞 Bebida Alcoólica — Venda Proibida a Menores
          </span>
        </div>
      )}
      {isRefrigerada && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl
          bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
          <Snowflake className="w-4 h-4 text-sky-600 flex-shrink-0" />
          <span className="text-xs font-bold text-sky-700 dark:text-sky-400">
            ❄️ Refrigerado — Manter em temperatura adequada
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {categoria.margemLucroPadrao != null && (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-2.5 py-2">
            <span className="text-slate-400 block">Margem padrão</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {categoria.margemLucroPadrao}%
            </span>
          </div>
        )}
        {categoria.metaVendasMensais != null && (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-2.5 py-2">
            <span className="text-slate-400 block">Meta mensal</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              R$ {categoria.metaVendasMensais.toLocaleString('pt-BR')}
            </span>
          </div>
        )}
      </div>

      {/* Tags */}
      {categoria.tags && (
        <div className="flex flex-wrap gap-1">
          {String(categoria.tags).split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full
              bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={() => onEdit(categoria)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
            bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30
            text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300
            text-xs font-medium transition-all">
          <Edit2 className="w-3.5 h-3.5" />Editar
        </button>
        <button onClick={() => onDelete(categoria)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
            bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/30
            text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400
            text-xs font-medium transition-all">
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

export default function CategoriasPage() {
  const { addToast } = useToast();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<Categoria | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Categoria | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const cats = await getCategorias();
      setCategorias(mergeExtras(cats));
    } catch {
      addToast('error', 'Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  function set(field: keyof FormState, value: string) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      // Reset classificacaoBebida when tipo changes away from bebida
      if (field === 'tipoProduto' && value !== 'bebida') {
        next.classificacaoBebida = '';
      }
      return next;
    });
  }

  function openAdd() {
    setEditCat(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(c: Categoria) {
    setEditCat(c);
    setForm({
      nome: c.nome,
      descricao: c.descricao || '',
      tipoProduto: (c.tipoProduto as FormState['tipoProduto']) || '',
      classificacaoBebida: (c.classificacaoBebida as FormState['classificacaoBebida']) || '',
      icone: c.icone || '',
      cor: c.cor || '#4f46e5',
      margemLucroPadrao: c.margemLucroPadrao !== undefined ? String(c.margemLucroPadrao) : '',
      metaVendasMensais: c.metaVendasMensais !== undefined ? String(c.metaVendasMensais) : '',
      comissaoPorVenda: c.comissaoPorVenda !== undefined ? String(c.comissaoPorVenda) : '',
      ordemExibicao: c.ordemExibicao !== undefined ? String(c.ordemExibicao) : '',
      status: c.status || 'ativa',
      tags: c.tags ? (typeof c.tags === 'string' ? c.tags : (c.tags as string[]).join(', ')) : '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) { addToast('error', 'Nome é obrigatório'); return; }
    if (!form.descricao.trim()) { addToast('error', 'Descrição é obrigatória'); return; }
    setSaving(true);

    try {
      if (editCat) {
        // Use PUT endpoint to update category with all fields
        await updateCategoria({
          nome: editCat.nome,
          novoNome: form.nome.trim() !== editCat.nome ? form.nome.trim() : undefined,
          descricao: form.descricao || '',
          tipoProduto: form.tipoProduto || '',
          classificacaoBebida: form.classificacaoBebida || '',
          icone: form.icone || '',
          cor: form.cor,
          margemLucroPadrao: form.margemLucroPadrao || '',
          metaVendasMensais: form.metaVendasMensais || '',
          comissaoPorVenda: form.comissaoPorVenda || '',
          ordemExibicao: form.ordemExibicao || '',
          status: form.status,
          tags: form.tags,
        });
        deleteExtra(editCat.id);
        addToast('success', 'Categoria atualizada!');
        setShowModal(false);
        load();
      } else {
        const created = await createCategoria({
          nome: form.nome.trim(),
          descricao: form.descricao || '',
          tipoProduto: form.tipoProduto as Categoria['tipoProduto'],
          classificacaoBebida: form.classificacaoBebida as Categoria['classificacaoBebida'],
          icone: form.icone || '',
          cor: form.cor,
          margemLucroPadrao: form.margemLucroPadrao ? parseFloat(form.margemLucroPadrao) : undefined,
          metaVendasMensais: form.metaVendasMensais ? parseFloat(form.metaVendasMensais) : undefined,
          comissaoPorVenda: form.comissaoPorVenda ? parseFloat(form.comissaoPorVenda) : undefined,
          ordemExibicao: form.ordemExibicao ? parseInt(form.ordemExibicao) : undefined,
          status: form.status,
          tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        });
        // Store any extra client-side data if needed
        if (created) deleteExtra(created.id);
        addToast('success', 'Categoria criada!');
        setShowModal(false);
        load();
      }
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao salvar categoria');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCategoria(deleteTarget.nome);
      deleteExtra(deleteTarget.id);
      addToast('success', 'Categoria excluída!');
      setDeleteTarget(null);
      load();
    } catch {
      addToast('error', 'Erro ao excluir categoria');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded">
              CATEGORIAS
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Gestão de Categorias
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            {categorias.length} categoria{categorias.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm
          border border-slate-200 dark:border-slate-700">
          <button onClick={openAdd}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900
              dark:bg-indigo-600 text-white text-sm font-black uppercase tracking-widest
              hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all active:scale-95">
            <Plus className="w-4 h-4" />NOVA CATEGORIA
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <LoadingSpinner size="lg" />
        </div>
      ) : categorias.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
          <Tag className="w-10 h-10" />
          <p className="text-sm">Nenhuma categoria cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categorias.map((c) => (
            <CategoriaCard key={c.id} categoria={c}
              onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editCat ? 'Editar Categoria' : 'Nova Categoria'}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300
                bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 transition-all">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700
                text-white text-sm font-black uppercase tracking-widest disabled:opacity-50
                transition-all active:scale-95 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
              {saving && <LoadingSpinner size="sm" />}
              {saving ? 'Salvando...' : editCat ? 'ATUALIZAR' : 'CRIAR'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nome" required>
            <input type="text" value={form.nome} onChange={(e) => set('nome', e.target.value)}
              className={inputCls} placeholder="Ex: Bebidas" />
          </FormField>

          <div className="flex gap-3 items-end">
            <FormField label="Ícone / Emoji">
              <input type="text" value={form.icone} onChange={(e) => set('icone', e.target.value)}
                className={inputCls} placeholder="🏷️" maxLength={4} />
            </FormField>
            <FormField label="Cor">
              <input type="color" value={form.cor} onChange={(e) => set('cor', e.target.value)}
                className="w-full h-[38px] px-1 py-1 rounded-xl border border-slate-200
                  dark:border-slate-600 cursor-pointer bg-white dark:bg-slate-900" />
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <FormField label="Descrição" required>
              <textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)}
                rows={2} className={`${inputCls} resize-none`}
                placeholder="Descreva a categoria..." />
            </FormField>
          </div>

          <FormField label="Tipo de Produto">
            <select value={form.tipoProduto} onChange={(e) => set('tipoProduto', e.target.value as FormState['tipoProduto'])}
              className={inputCls}>
              <option value="">Selecionar...</option>
              <option value="bebida">Bebida</option>
              <option value="comida">Comida</option>
              <option value="eletronico">Eletrônico</option>
              <option value="outro">Outro</option>
            </select>
          </FormField>

          {form.tipoProduto === 'bebida' && (
            <FormField label="Classificação de Bebida">
              <select value={form.classificacaoBebida}
                onChange={(e) => set('classificacaoBebida', e.target.value as FormState['classificacaoBebida'])}
                className={inputCls}>
                <option value="">Selecionar...</option>
                <option value="normal">Normal</option>
                <option value="alcoolica">Alcoólica 🔞 +18</option>
                <option value="refrigerada">Refrigerada ❄️</option>
              </select>
            </FormField>
          )}

          <FormField label="Margem de Lucro Padrão (%)">
            <input type="number" min="0" step="0.1" value={form.margemLucroPadrao}
              onChange={(e) => set('margemLucroPadrao', e.target.value)}
              className={inputCls} placeholder="Ex: 30" />
          </FormField>

          <FormField label="Meta de Vendas Mensais (R$)">
            <input type="number" min="0" step="0.01" value={form.metaVendasMensais}
              onChange={(e) => set('metaVendasMensais', e.target.value)}
              className={inputCls} placeholder="Ex: 5000" />
          </FormField>

          <FormField label="Comissão por Venda (%)">
            <input type="number" min="0" step="0.1" value={form.comissaoPorVenda}
              onChange={(e) => set('comissaoPorVenda', e.target.value)}
              className={inputCls} placeholder="Ex: 5" />
          </FormField>

          <FormField label="Ordem de Exibição">
            <input type="number" min="0" value={form.ordemExibicao}
              onChange={(e) => set('ordemExibicao', e.target.value)}
              className={inputCls} placeholder="Ex: 1" />
          </FormField>

          <FormField label="Status">
            <select value={form.status} onChange={(e) => set('status', e.target.value as FormState['status'])}
              className={inputCls}>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </select>
          </FormField>

          <div className="sm:col-span-2">
            <FormField label="Tags (separadas por vírgula)">
              <input type="text" value={form.tags} onChange={(e) => set('tags', e.target.value)}
                className={inputCls} placeholder="Ex: gelado, premium, nacional" />
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
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300
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
          Tem certeza que deseja excluir a categoria{' '}
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {deleteTarget?.nome}
          </span>?
        </p>
      </Modal>
    </div>
  );
}

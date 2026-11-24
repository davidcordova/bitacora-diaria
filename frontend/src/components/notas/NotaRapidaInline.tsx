import React from 'react';
import { StickyNote, X, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { ColorAcentoNota, TipoNota, VisibilidadNota } from '../../types';
import { ACCENT_COLORS, TIPOS_NOTA_CONFIG, VISIBILIDAD_LABELS } from './notaStyles';

export interface QuickNotaDraft {
  open: boolean;
  titulo: string;
  tipo: TipoNota;
  body: string;
  visibilidad: VisibilidadNota;
  color: ColorAcentoNota;
}

export const DEFAULT_QUICK_NOTA_DRAFT: QuickNotaDraft = {
  open: false,
  titulo: '',
  tipo: 'apunte',
  body: '',
  visibilidad: 'personal',
  color: 'sky',
};

interface NotaRapidaInlineProps {
  draft: QuickNotaDraft;
  paraCliente: string;
  error: string | null;
  saving: boolean;
  titleInputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<QuickNotaDraft>) => void;
  onSaveAndAttach: () => void;
  onCancel: () => void;
}

const TIPOS_LIST: TipoNota[] = ['apunte', 'checklist', 'reunion', 'tecnica'];
const COLORES_LIST: ColorAcentoNota[] = ['slate', 'sky', 'emerald', 'amber', 'rose'];

/** Compositor compacto embebido para crear una nota rápida directamente dentro del formulario de actividad. */
export const NotaRapidaInline: React.FC<NotaRapidaInlineProps> = ({
  draft,
  paraCliente,
  error,
  saving,
  titleInputRef,
  onChange,
  onSaveAndAttach,
  onCancel,
}) => {
  if (!draft.open) return null;

  const isChecklist = draft.tipo === 'checklist';

  return (
    <div className="mt-2 p-3 rounded-xl bg-white dark:bg-[#1E222D] border border-sky-200/80 dark:border-sky-500/25 space-y-2.5 animate-in fade-in duration-150">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <StickyNote className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
            Nueva nota rápida vinculada
          </span>
          {paraCliente.trim() && (
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 truncate max-w-[140px]">
              {paraCliente.trim()}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer disabled:opacity-50"
          title="Cerrar nota rápida"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-[11px] text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <input
          ref={titleInputRef}
          type="text"
          value={draft.titulo}
          onChange={(e) => onChange({ titulo: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              onSaveAndAttach();
            }
          }}
          placeholder="Título de la nota rápida (ej: Acuerdos, credencial temporal, pendientes)..."
          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#161922] text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-lg border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-[#161922] focus:border-sky-500 outline-none transition-colors"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {TIPOS_LIST.map((t) => {
            const active = draft.tipo === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ tipo: t })}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/[0.1]'
                }`}
              >
                {TIPOS_NOTA_CONFIG[t].shortLabel}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" title="Color de acento">
            {COLORES_LIST.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ color: c })}
                aria-label={`Color ${ACCENT_COLORS[c].label}`}
                className={`w-3.5 h-3.5 rounded-full ${ACCENT_COLORS[c].dot} cursor-pointer transition-transform ${
                  draft.color === c ? 'ring-2 ring-offset-1 ring-sky-500 dark:ring-offset-[#1E222D] scale-110' : 'opacity-70 hover:opacity-100'
                }`}
              />
            ))}
          </div>

          <div className="relative flex items-center">
            <Lock className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
            <select
              value={draft.visibilidad}
              onChange={(e) => onChange({ visibilidad: e.target.value as VisibilidadNota })}
              className="pl-6 pr-2 py-1 bg-slate-50 dark:bg-[#161922] text-[11px] font-medium text-slate-700 dark:text-slate-200 rounded-md border border-slate-200 dark:border-white/10 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              {(Object.keys(VISIBILIDAD_LABELS) as VisibilidadNota[]).map((v) => (
                <option key={v} value={v}>
                  {VISIBILIDAD_LABELS[v].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <textarea
        rows={isChecklist ? 3 : 2}
        value={draft.body}
        onChange={(e) => onChange({ body: e.target.value })}
        placeholder={
          isChecklist
            ? 'Escribe un ítem por línea...\nEj: Validar acceso VPN\nConfirmar respaldo'
            : TIPOS_NOTA_CONFIG[draft.tipo].placeholder
        }
        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#161922] text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-lg border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-[#161922] focus:border-sky-500 outline-none transition-colors resize-none"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          Se guardará y quedará vinculada a esta actividad.
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSaveAndAttach}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors cursor-pointer disabled:opacity-60"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{saving ? 'Guardando...' : 'Guardar y vincular nota'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

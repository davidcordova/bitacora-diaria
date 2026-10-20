import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CheckCheck, CornerUpLeft, ClipboardCheck, X, Loader2 } from 'lucide-react';
import { Actividad, RevisionDecision, RevisionResult } from '../types';
import { api } from '../services/api';
import { RichHtmlRenderer } from './RichHtmlRenderer';

/**
 * Revisión del líder sobre una tarea "En revisión".
 * El colaborador pide visto bueno (p. ej. un plan de trabajo o una decisión) y el líder elige:
 *  - Aprobar y continuar  -> la tarea vuelve a "En proceso" con la aprobación registrada.
 *  - Aprobar y cerrar     -> la tarea queda "Completada".
 *  - Devolver             -> vuelve a "En proceso" con observaciones obligatorias.
 */

interface RevisionModalProps {
  actividad: (Actividad & { colaborador?: string }) | null;
  initialDecision?: RevisionDecision;
  onClose: () => void;
  onDone: (result: RevisionResult) => void;
}

const OPTIONS: {
  value: RevisionDecision;
  title: string;
  hint: string;
  icon: React.ElementType;
  active: string;
}[] = [
  {
    value: 'aprobada_continuar',
    title: 'Aprobar y continuar',
    hint: 'Da luz verde: la tarea vuelve a "En proceso" para que siga trabajándola.',
    icon: CheckCircle2,
    active: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/30',
  },
  {
    value: 'aprobada_cerrada',
    title: 'Aprobar y cerrar',
    hint: 'El trabajo está conforme: la tarea queda "Completada".',
    icon: CheckCheck,
    active: 'border-[#00A3BF] bg-cyan-50 dark:bg-cyan-950/30 ring-2 ring-[#00F0FF]/30',
  },
  {
    value: 'devuelta',
    title: 'Devolver con observaciones',
    hint: 'Necesita cambios: vuelve a "En proceso" con tu comentario.',
    icon: CornerUpLeft,
    active: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-500/30',
  },
];

export const RevisionModal: React.FC<RevisionModalProps> = ({ actividad, initialDecision, onClose, onDone }) => {
  const [decision, setDecision] = useState<RevisionDecision>(initialDecision || 'aprobada_continuar');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDecision(initialDecision || 'aprobada_continuar');
    setComentario('');
    setError('');
  }, [actividad?.id, initialDecision]);

  useEffect(() => {
    if (!actividad) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actividad, saving, onClose]);

  useEffect(() => {
    if (decision === 'devuelta') textareaRef.current?.focus();
  }, [decision]);

  if (!actividad || typeof actividad.id !== 'number') return null;

  const needsComment = decision === 'devuelta';
  const canSubmit = !saving && (!needsComment || comentario.trim().length > 0);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    const res = await api.revisarActividad(actividad.id as number, decision, comentario.trim());
    setSaving(false);
    if ('data' in res) {
      onDone(res.data);
      return;
    }
    setError(res.error);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revision-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#13141F] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#252636] animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-slate-100 dark:border-[#252636]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-300">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="revision-modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Revisar solicitud de aprobación
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {actividad.colaborador ? <><strong className="text-slate-700 dark:text-slate-200">{actividad.colaborador}</strong> pide tu visto bueno</> : 'El colaborador pide tu visto bueno'}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="revision-modal-close"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A1C29] cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Qué se revisa */}
          <div className="rounded-xl bg-slate-50 dark:bg-[#161722] border border-slate-200/80 dark:border-[#252636] p-3.5 space-y-2">
            <div className="text-sm text-slate-800 dark:text-slate-100 font-medium break-words">
              <RichHtmlRenderer content={actividad.descripcion} />
            </div>
            {actividad.comentarios && (
              <div className="text-xs text-slate-600 dark:text-slate-300 border-t border-slate-200/70 dark:border-[#252636] pt-2 break-words">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Notas del colaborador: </span>
                <RichHtmlRenderer content={actividad.comentarios} />
              </div>
            )}
            <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-3">
              {actividad.tipo_trabajo && <span>Tipo: {actividad.tipo_trabajo}</span>}
              {actividad.para_cliente && <span>Cliente: {actividad.para_cliente}</span>}
            </div>
          </div>

          {/* Decisión */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Tu decisión</legend>
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = decision === opt.value;
              return (
                <label
                  key={opt.value}
                  htmlFor={`revision-opt-${opt.value}`}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selected ? opt.active : 'border-slate-200 dark:border-[#252636] hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    id={`revision-opt-${opt.value}`}
                    name="revision-decision"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setDecision(opt.value)}
                    className="sr-only"
                  />
                  <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${selected ? '' : 'text-slate-400'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">{opt.title}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.hint}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {/* Comentario */}
          <div>
            <label htmlFor="revision-comentario" className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {needsComment ? 'Observaciones (obligatorio)' : 'Comentario para el colaborador (opcional)'}
            </label>
            <textarea
              id="revision-comentario"
              ref={textareaRef}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
              }}
              maxLength={1000}
              rows={3}
              placeholder={needsComment ? '¿Qué debe corregir o completar?' : 'Ej.: Adelante, prioriza la parte de backups.'}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#252636] bg-white dark:bg-[#0D0E16] text-sm text-slate-800 dark:text-slate-100 p-2.5 focus:outline-none focus:ring-2 focus:ring-[#00F0FF]/40 resize-y"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-2.5">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-100 dark:border-[#252636]">
          <span className="text-[11px] text-slate-400 hidden sm:block">El colaborador recibirá una notificación</span>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              id="revision-cancel"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              id="revision-confirm"
              onClick={submit}
              disabled={!canSubmit}
              className="px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] text-slate-950 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar decisión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Etiqueta compacta con la última decisión del líder (texto plano, sin HTML). */
export const RevisionBadge: React.FC<{ actividad: Actividad; compact?: boolean }> = ({ actividad, compact }) => {
  if (actividad.estado === 'en_revision') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
        ⏳ Esperando aprobación del líder
      </span>
    );
  }
  if (!actividad.revision_decision) return null;
  const by = actividad.revisado_por_nombre ? ` · ${actividad.revisado_por_nombre}` : '';
  const map: Record<RevisionDecision, { label: string; cls: string }> = {
    aprobada_continuar: {
      label: '✔ Aprobado para continuar',
      cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    },
    aprobada_cerrada: {
      label: '✔ Aprobado y cerrado',
      cls: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50',
    },
    devuelta: {
      label: '↩ Devuelto con observaciones',
      cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    },
  };
  const info = map[actividad.revision_decision];
  if (!info) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border max-w-full ${info.cls}`} title={actividad.revisado_at || undefined}>
      <span>{info.label}{by}</span>
      {!compact && actividad.revision_comentario && (
        <span className="font-normal break-words">: “{actividad.revision_comentario}”</span>
      )}
    </span>
  );
};

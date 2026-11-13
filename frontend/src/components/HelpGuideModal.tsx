import React from 'react';
import { X, CheckCircle2, ListChecks, Users, Send, Sparkles, BookOpen } from 'lucide-react';
import { useModalBehavior } from '../hooks/useModalBehavior';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ isOpen, onClose }) => {
  useModalBehavior(isOpen, onClose);
  if (!isOpen) return null;

  const steps = [
    {
      number: '1',
      icon: ListChecks,
      title: 'Registra tus actividades del día',
      description:
        'Crea actividades individuales indicando hora, duración y para quién es. Puedes adjuntar capturas pegando con Ctrl+V o arrastrando archivos.',
      badge: 'Paso 1',
    },
    {
      number: '2',
      icon: Users,
      title: 'Coordina tareas en paralelo',
      description:
        'Si estás trabajando en conjunto con otro analista, agrégalo en "Trabajo en Paralelo" para que la tarea se refleje en su bitácora automáticamente.',
      badge: 'Paso 2',
    },
    {
      number: '3',
      icon: Send,
      title: 'Cierra y comparte tu resumen',
      description:
        'Al finalizar tu horario, anota tareas pendientes para mañana y presiona "Generar bitácora del día" para obtener el formato listo para WhatsApp.',
      badge: 'Paso 3',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-[#161922] rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-white/[0.08] flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] my-auto overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08] mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Guía Rápida de Bitácora
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Aprende el flujo de trabajo en 30 segundos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#232836] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 sm:space-y-4 my-2 overflow-y-auto overflow-x-hidden min-h-0 flex-1 pr-1">
          {steps.map((st) => {
            return (
              <div
                key={st.number}
                className="flex items-start gap-3.5 p-3 sm:p-3.5 rounded-2xl bg-slate-50/70 dark:bg-[#1E222D] border border-slate-200/70 dark:border-white/[0.08]"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-xs">
                  {st.number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{st.title}</h4>
                    <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/30">
                      {st.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{st.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-slate-200/80 dark:border-white/[0.08] mt-2 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white rounded-full text-xs font-bold shadow-md shadow-sky-600/15 transition-all cursor-pointer min-h-[40px]"
          >
            ¡Entendido, comenzar!
          </button>
        </div>
      </div>
    </div>
  );
};

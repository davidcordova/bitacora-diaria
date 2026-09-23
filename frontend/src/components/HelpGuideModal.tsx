import React from 'react';
import { X, CheckCircle2, ListChecks, Users, Send, Sparkles, BookOpen } from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ isOpen, onClose }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#13141F] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/90 dark:border-[#252636] flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-[#252636] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Guía Rápida de Bitácora
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aprende el flujo de trabajo en 30 segundos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#1C1D2A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 my-2">
          {steps.map((st) => {
            return (
              <div
                key={st.number}
                className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-[#161722] border border-slate-200/70 dark:border-[#252636]"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] text-slate-950 flex items-center justify-center font-extrabold text-xs shrink-0 shadow-xs">
                  {st.number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{st.title}</h4>
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-[#00F0FF] bg-[#00F0FF]/10 px-2.5 py-0.5 rounded-full border border-[#00F0FF]/30">
                      {st.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{st.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-200/80 dark:border-[#252636] mt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 rounded-full text-xs font-bold shadow-md shadow-[#00F0FF]/20 transition-all cursor-pointer min-h-[44px]"
          >
            ¡Entendido, comenzar!
          </button>
        </div>
      </div>
    </div>
  );
};

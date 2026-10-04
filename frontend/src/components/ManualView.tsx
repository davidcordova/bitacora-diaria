import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Sparkles,
  Clock,
  Camera,
  Users,
  Shield,
  KeyRound,
  Trash2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  CalendarCheck,
  Send,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Laptop,
  Flame,
  FileSpreadsheet,
  LifeBuoy,
  RefreshCw,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { User, ViewMode } from '../types';

interface ManualViewProps {
  currentUser: User | null;
  onNavigateToView: (view: ViewMode) => void;
  onOpenHelpModal?: () => void;
}

interface ManualSection {
  id: string;
  category: 'inicio' | 'roles' | 'jornada' | 'apoyo' | 'boveda' | 'soporte';
  title: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  description: string;
  content: React.ReactNode;
  tags: string[];
}

export const ManualView: React.FC<ManualViewProps> = ({
  currentUser,
  onNavigateToView,
  onOpenHelpModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'filosofia-offline': true,
    'jornada-registro': true,
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    sections.forEach((s) => {
      all[s.id] = true;
    });
    setExpandedSections(all);
  };

  const collapseAll = () => {
    setExpandedSections({});
  };

  const sections: ManualSection[] = [
    {
      id: 'filosofia-offline',
      category: 'inicio',
      title: '1. Filosofía Offline-First & Cero Pérdida de Datos',
      icon: <Flame className="w-5 h-5 text-amber-500" />,
      badge: 'Esencial',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      description: 'Cómo el sistema garantiza que tu información nunca se pierda, incluso ante caídas de internet.',
      tags: ['offline', 'sincronizacion', 'guardado', 'localstorage', 'red', 'seguridad'],
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            El sistema opera bajo una arquitectura <strong>Offline-First</strong> diseñada para eliminar cualquier riesgo de pérdida de horas o tareas:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
              <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-[#00F0FF] text-xs flex items-center justify-center font-black">1</span>
                Escritura Inmediata (0ms)
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cada letra, cambio o tarea se guarda síncronamente en el <code className="bg-slate-200 dark:bg-white/10 px-1 py-0.5 rounded text-[11px]">localStorage</code> de tu equipo.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
              <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center font-black">2</span>
                Sincronización Inteligente
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tras 600ms de inactividad, el motor detecta la huella canónica y transmite los cambios a la nube sin saturar la red.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
              <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs flex items-center justify-center font-black">3</span>
                Auto-Recuperación
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Si cierras la laptop o falla la conexión, al reingresar el sistema sincronizará automáticamente el borrador más completo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-xs text-cyan-800 dark:text-[#00F0FF]">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              <strong>Regla de oro:</strong> Si la barra superior indica <em>"Sin conexión"</em> en rojo, tus tareas siguen perfectamente guardadas en tu equipo. No cierres tu sesión y el sistema subirá todo apenas vuelva la red.
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'matriz-roles',
      category: 'roles',
      title: '2. Matriz de Roles y Alcance del Sistema',
      icon: <Shield className="w-5 h-5 text-indigo-500" />,
      badge: 'Permisos',
      badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      description: 'Conoce los alcances y responsabilidades según tu perfil de usuario.',
      tags: ['roles', 'admin', 'lider', 'analista', 'permisos', 'usuarios'],
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-white font-bold border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Alcance</th>
                  <th className="p-3">Vistas y Acciones Clave</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                <tr className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="p-3 font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span>
                    Analista / Colaborador
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">Personal</td>
                  <td className="p-3">
                    Mi Bitácora, Kanban de tareas, Historial propio, Bóveda de accesos, Buzón de ideas y Papelera personal.
                  </td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="p-3 font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                    Usuario de Apoyo (Delegado)
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">Multinivel asignado</td>
                  <td className="p-3">
                    Modo Apoyo en cabecera: puede seleccionar y registrar bitácoras para 1 o varios compañeros a su cargo sin mezclar borradores.
                  </td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="p-3 font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                    Líder de Equipo (Supervisor)
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">Equipo asignado</td>
                  <td className="p-3">
                    Vista <strong>Supervisión de Equipo</strong> (avance de horas en tiempo real), Tablero Kanban de equipo, Dashboard departamental.
                  </td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="p-3 font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                    Administrador
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">Global (Todo el sistema)</td>
                  <td className="p-3">
                    Panel <strong>Gestión</strong> (creación de usuarios, equipos, delegaciones), configuración institucional y auditoría técnica.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: 'jornada-registro',
      category: 'jornada',
      title: '3. Registro de Actividades & Motor de Horarios Bidireccional',
      icon: <Clock className="w-5 h-5 text-emerald-500" />,
      badge: 'Nuevo en v2.2',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      description: 'Domina el motor de cálculo automático de tiempos, capturas directas y tareas compartidas.',
      tags: ['actividad', 'hora_inicio', 'hora_fin', 'duracion', 'evidencias', 'captura', 'shared_with', 'ctrl+v'],
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Cálculo Bidireccional Automático
            </h4>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <strong>Si ingresas la Duración:</strong> Escribes <span className="font-mono bg-slate-200 dark:bg-white/10 px-1 py-0.5 rounded">90 min</span> con inicio a las <span className="font-mono">09:00</span> ➔ el sistema proyecta la <strong>Hora Fin</strong> a las <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">10:30</span>.
              </li>
              <li>
                <strong>Si ajustas la Hora Fin:</strong> Indicas que concluiste a las <span className="font-mono">11:45</span> ➔ el sistema calcula automáticamente <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">165 min (2h 45m)</span>.
              </li>
              <li>
                <strong>Botón ⚡ Ahora:</strong> Al terminar una tarea en tiempo real, presiona el botón <em>"Ahora"</em> junto a Hora Fin para fijar la hora de tu reloj y calcular el tiempo transcurrido al segundo.
              </li>
              <li>
                <strong>Píldoras Rápidas:</strong> Usa los botones <span className="font-mono text-cyan-600 dark:text-[#00F0FF] font-bold">+15m</span>, <span className="font-mono text-cyan-600 dark:text-[#00F0FF] font-bold">+30m</span> y <span className="font-mono text-cyan-600 dark:text-[#00F0FF] font-bold">+1h</span> para sumar tiempo en un clic.
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 space-y-2">
            <h4 className="font-bold text-cyan-900 dark:text-[#00F0FF] flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Pegado Directo de Capturas con Ctrl + V
            </h4>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              ¡Olvídate de guardar imágenes en tu escritorio para luego subirlas!
            </p>
            <ol className="list-decimal list-inside text-xs space-y-1 text-slate-600 dark:text-slate-400">
              <li>Toma cualquier captura con <code className="bg-white/80 dark:bg-black/40 px-1.5 py-0.5 rounded font-bold">Win + Shift + S</code> o la tecla <code className="bg-white/80 dark:bg-black/40 px-1.5 py-0.5 rounded font-bold">Impr Pant / PrtScr</code>.</li>
              <li>Abre o mantén abierto el modal de la actividad.</li>
              <li>Presiona <code className="bg-cyan-500/20 text-cyan-800 dark:text-[#00F0FF] font-bold px-2 py-0.5 rounded">Ctrl + V</code> en cualquier parte del modal o dentro de la descripción.</li>
              <li>La imagen se subirá automáticamente a los servidores y quedará como evidencia asociada a la tarea.</li>
            </ol>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              Tareas Compartidas en Paralelo (Trabajo en Equipo)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Si trabajaste en una reunión, soporte o despliegue en conjunto con otros compañeros, selecciónalos en el campo <strong>"Compartir con"</strong>. El sistema replicará la tarea en sus respectivas bitácoras sin duplicar trabajo manual.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'cierre-whatsapp',
      category: 'jornada',
      title: '4. Cierre Diario de Jornada & Envío a WhatsApp',
      icon: <Send className="w-5 h-5 text-green-500" />,
      badge: 'Cierre',
      badgeColor: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
      description: 'Cómo formalizar tu bitácora del día y compartir el resumen oficial a tu supervisor o grupo.',
      tags: ['cierre', 'whatsapp', 'pendientes', 'apoyo', 'prioridades', 'reporte'],
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <ol className="list-decimal list-inside space-y-2 text-xs">
            <li>
              <strong>Documenta la sección inferior:</strong>
              <div className="ml-5 mt-1 space-y-1 text-slate-500 dark:text-slate-400">
                <p>• <strong>Tareas Pendientes:</strong> Lo que quedó en curso para continuar mañana.</p>
                <p>• <strong>¿Necesita Apoyo?:</strong> Si seleccionas <em>"Sí"</em>, detalla a qué equipo o líder requieres apoyo para que se genere una alerta en el dashboard.</p>
                <p>• <strong>Prioridad de Mañana:</strong> Tu principal objetivo al iniciar tu próxima jornada.</p>
              </div>
            </li>
            <li>
              <strong>Presiona "🚀 Generar Bitácora":</strong> Se activará la animación de confeti y se guardará el estado formal como cerrada.
            </li>
            <li>
              <strong>Compartir en WhatsApp:</strong> En la ventana emergente, selecciona si deseas enviar a tu líder asignado, a tu propio número o a un número externo. El texto ya viene pre-redactado con formato ejecutivo y emojis profesionales.
            </li>
          </ol>
        </div>
      ),
    },
    {
      id: 'modo-apoyo-delegado',
      category: 'apoyo',
      title: '5. Modo Apoyo: Registro para Uno o Más Colaboradores',
      icon: <Users className="w-5 h-5 text-amber-500" />,
      badge: 'Delegaciones',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      description: 'Guía para usuarios autorizados que deben registrar bitácoras de otros colaboradores.',
      tags: ['modo_apoyo', 'delegacion', 'asistencia', 'colaboradores', 'multiples'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <p>
            Cuando el administrador te asigna permisos de apoyo para uno o varios compañeros, aparece el botón <strong>"Modo Apoyo"</strong> en la cabecera superior.
          </p>
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
            <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              🤝 Pasos para registrar como apoyo:
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              <li>Haz clic en <strong>Modo Apoyo</strong> en la barra superior.</li>
              <li>Selecciona al colaborador en el menú desplegable (si tienes varios, usa el buscador rápido integrado).</li>
              <li>Aparecerá un banner ámbar permanente indicando: <code>🤝 Registrando para: [Nombre del Colaborador]</code>.</li>
              <li>Todas las actividades que agregues se guardarán en la bitácora del colaborador seleccionado.</li>
              <li>Para regresar a tu jornada, presiona <strong>"Volver a mi bitácora"</strong> o haz clic en la <strong>X</strong> del botón superior.</li>
            </ol>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            * Cada colaborador mantiene su propio almacenamiento aislado, por lo que nunca habrá cruce de tareas con tu bitácora personal.
          </p>
        </div>
      ),
    },
    {
      id: 'boveda-accesos',
      category: 'boveda',
      title: '6. Bóveda TI, Credenciales & Importación Masiva Excel',
      icon: <KeyRound className="w-5 h-5 text-cyan-500" />,
      badge: 'Seguridad AES-256',
      badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] border-cyan-500/30',
      description: 'Gestión segura de cuentas de plataformas corporativas y carga masiva mediante planillas Excel.',
      tags: ['boveda', 'vault', 'credenciales', 'excel', 'importar', 'pin', 'aes256'],
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <p>
            La <strong>Bóveda TI</strong> permite almacenar de manera cifrada las credenciales corporativas (accesos a paneles, redes sociales, servidores y clientes):
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
              <h5 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                Carga Masiva desde Excel
              </h5>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Descarga la plantilla oficial en <code>.xlsx</code>, completa los datos de empresas, marcas, plataformas y cuentas, y pulsa <em>"Importar Excel"</em> para crearlas en bloque.
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
              <h5 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-cyan-500" />
                PIN de Desbloqueo Seguro
              </h5>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Las contraseñas no se muestran en texto plano. Cada colaborador autorizado debe configurar su PIN personal de 4 a 6 dígitos para revelar accesos sensibles.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'papelera-buzon',
      category: 'soporte',
      title: '7. Papelera de Reciclaje Inteligente & Buzón de Ideas',
      icon: <Trash2 className="w-5 h-5 text-rose-500" />,
      badge: 'Herramientas',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
      description: 'Cómo recuperar actividades eliminadas accidentalmente y proponer mejoras para el equipo.',
      tags: ['papelera', 'restaurar', 'soft_delete', 'buzon', 'ideas', 'sugerencias'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <h5 className="font-bold text-slate-900 dark:text-white mb-1">♻️ Papelera de Reciclaje:</h5>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Si borraste una actividad por error, abre la <strong>Papelera</strong> desde el menú lateral. Al pulsar <strong>"Restaurar"</strong>, la actividad volverá exactamente a su fecha original con todos sus tiempos, evidencias y comentarios intactos.
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <h5 className="font-bold text-slate-900 dark:text-white mb-1">💡 Buzón de Sugerencias:</h5>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Publica propuestas de optimización de procesos, herramientas o bienestar. Tus compañeros pueden votar por tu idea y los administradores podrán cambiar su estado a <em>Planificada</em> o <em>Implementada</em>.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'diagnostico-soporte',
      category: 'soporte',
      title: '8. Diagnóstico de Errores & Reporte Asistido con Capturas',
      icon: <LifeBuoy className="w-5 h-5 text-cyan-500" />,
      badge: 'Soporte',
      badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] border-cyan-500/30',
      description: 'Qué hacer ante una falla de red y cómo enviar reportes técnicos enriquecidos al equipo de Sistemas.',
      tags: ['diagnostico', 'error', 'reporte', 'soporte', 'sin_conexion', 'sincronizacion'],
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <p>
            El sistema incluye un <strong>Centro de Diagnóstico Integrado</strong> que se activa automáticamente cuando se presenta un error de guardado:
          </p>
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl space-y-2">
            <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              ¿Qué hacer si ves el botón "Sin conexión" o "Ver detalle / Reportar"?
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              <li>Haz clic sobre el botón de advertencia en la cabecera o al pie de las actividades.</li>
              <li>Se abrirá el modal de diagnóstico con el <strong>mensaje técnico exacto</strong> devuelto por el servidor.</li>
              <li>Pega una captura del problema usando <kbd className="bg-rose-200 dark:bg-rose-900 px-1.5 py-0.5 rounded font-mono font-bold">Ctrl + V</kbd>.</li>
              <li>Puedes presionar <strong>"Copiar Reporte"</strong> para pegarlo en tu chat de soporte o <strong>"Reportar a Sistemas"</strong> para que el administrador reciba la incidencia directamente.</li>
              <li>Cuando la red se normalice, presiona <strong>"Reintentar Guardar"</strong> para sincronizar.</li>
            </ol>
          </div>
        </div>
      ),
    },
  ];

  // Atajos de teclado recomendados
  const shortcuts = [
    { key: 'Ctrl + V', desc: 'Pegar captura de pantalla directamente en la actividad o reporte' },
    { key: 'Esc', desc: 'Cerrar cualquier ventana modal o menú abierto' },
    { key: 'Tab', desc: 'Navegar rápidamente entre Hora Inicio, Duración y Hora Fin' },
    { key: 'Enter', desc: 'Confirmar guardado en formularios' },
  ];

  // Filtrado reactivo de secciones
  const filteredSections = useMemo(() => {
    return sections.filter((sec) => {
      const matchesCategory = selectedCategory === 'todos' || sec.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        sec.title.toLowerCase().includes(q) ||
        sec.description.toLowerCase().includes(q) ||
        sec.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [sections, selectedCategory, searchQuery]);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-200">
      {/* 1. Hero Banner Principal */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#12131C] to-slate-950 text-white p-6 sm:p-8 border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              Manual Oficial de Operaciones • v2.2
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-heading">
              Centro de Aprendizaje & Guía Interactiva
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Consulta rápidamente cómo funciona cada proceso de la bitácora: cálculo de horas bidireccional, capturas directas con <kbd className="bg-white/20 px-1 py-0.5 rounded font-mono">Ctrl + V</kbd>, modo apoyo y protocolos de contingencia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            {onOpenHelpModal && (
              <button
                type="button"
                onClick={onOpenHelpModal}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                Tutorial Rápido 3 Pasos
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateToView('lista')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-[#00A3BF] hover:from-cyan-400 hover:to-[#00B4D8] text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-cyan-500/20"
            >
              Ir a Mi Bitácora
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Buscador Rápido Integrado */}
        <div className="relative mt-6 max-w-2xl">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar tema (ej: hora fin, capturas, modo apoyo, excel, whatsapp, sin conexion)..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 dark:bg-black/30 backdrop-blur-md border border-white/20 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-hidden focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-2.5 text-xs text-slate-400 hover:text-white"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* 2. Filtros de Categorías & Controles de Expansión */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Pills de categorías */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs font-semibold">
          {[
            { id: 'todos', label: 'Todos los Temas' },
            { id: 'inicio', label: '1. Inicio & Offline' },
            { id: 'roles', label: '2. Roles & Permisos' },
            { id: 'jornada', label: '3. Jornada & Horarios' },
            { id: 'apoyo', label: '4. Modo Apoyo' },
            { id: 'boveda', label: '5. Bóveda TI & Excel' },
            { id: 'soporte', label: '6. Soporte & Errores' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-700 dark:text-[#00F0FF] font-bold shadow-2xs'
                  : 'bg-white dark:bg-[#12131C] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Acciones globales */}
        <div className="flex items-center gap-2 shrink-0 text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white underline cursor-pointer"
          >
            Expandir todo
          </button>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white underline cursor-pointer"
          >
            Contraer todo
          </button>
        </div>
      </div>

      {/* 3. Secciones Principales del Manual (Acordeones interactivos) */}
      <div className="space-y-4">
        {filteredSections.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#12131C] border border-slate-200 dark:border-white/10 space-y-2">
            <Search className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">No se encontraron temas</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Prueba con otras palabras como <em>"hora fin"</em>, <em>"captura"</em>, <em>"apoyo"</em> o <em>"excel"</em>.
            </p>
          </div>
        ) : (
          filteredSections.map((sec) => {
            const isExpanded = expandedSections[sec.id] ?? false;
            return (
              <div
                key={sec.id}
                className="rounded-3xl bg-white dark:bg-[#12131C] border border-slate-200/90 dark:border-white/10 shadow-xs overflow-hidden transition-all"
              >
                {/* Cabecera del Acordeón */}
                <button
                  type="button"
                  onClick={() => toggleSection(sec.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-4 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 shrink-0">
                      {sec.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                          {sec.title}
                        </h2>
                        {sec.badge && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${sec.badgeColor}`}>
                            {sec.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {sec.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 p-1 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Contenido desplegado */}
                {isExpanded && (
                  <div className="px-5 pb-6 pt-1 border-t border-slate-100 dark:border-white/5 animate-in fade-in duration-150">
                    {sec.content}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Cheat Sheet de Atajos de Teclado */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 text-white border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-[#00F0FF] border border-cyan-500/30">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Atajos de Teclado para Mayor Productividad</h4>
              <p className="text-xs text-slate-400">Ahorra tiempo durante tu jornada diaria</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {shortcuts.map((sh, idx) => (
            <div key={idx} className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
              <kbd className="self-start px-2 py-1 rounded-lg bg-cyan-500/20 text-[#00F0FF] border border-cyan-500/40 text-xs font-bold font-mono shadow-xs mb-2">
                {sh.key}
              </kbd>
              <p className="text-xs text-slate-300">{sh.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

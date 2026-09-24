import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sidebar } from './components/Sidebar';
import { ActividadesLista } from './components/ActividadesLista';
import { CierreJornada } from './components/CierreJornada';
import { ResumenPreview } from './components/ResumenPreview';
import { KanbanBoard } from './components/KanbanBoard';
import { HistorialView } from './components/HistorialView';
import { SummaryDrawer } from './components/SummaryDrawer';
import { DashboardView } from './components/DashboardView';
import { TeamSupervisionView } from './components/TeamSupervisionView';
import { UserManagementView } from './components/UserManagementView';
import { LoginModal } from './components/LoginModal';
import { LoginPage } from './components/LoginPage';
import { WhatsAppShareModal } from './components/WhatsAppShareModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { BottomNav } from './components/BottomNav';
import { HelpGuideModal } from './components/HelpGuideModal';
import { PapeleraModal } from './components/PapeleraModal';
import { TopHeader } from './components/TopHeader';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { Bitacora, Actividad, EstadoActividad, ViewMode, User, Team, SystemSettings } from './types';
import { defaultBitacora } from './utils/initialData';
import { api } from './services/api';
import { getTodayLocalDateStr } from './utils/formatters';

const getDraftKey = (userId?: number, dateStr?: string) => `bitacora_draft_${userId || 'user'}_${dateStr || 'today'}`;

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const lastSavedSignature = React.useRef<string>('');
  const isSwitchingDateRef = React.useRef<boolean>(false);

  const [bitacora, setBitacora] = useState<Bitacora>(() => {
    const todayStr = getTodayLocalDateStr();
    const savedUser = localStorage.getItem('auth_user') ? JSON.parse(localStorage.getItem('auth_user')!) : null;
    const userUid = savedUser?.id;

    if (userUid) {
      const savedDraft = localStorage.getItem(getDraftKey(userUid, todayStr));
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed && parsed.fecha === todayStr) {
            return parsed;
          }
        } catch (e) {}
      }
    }

    const saved = localStorage.getItem('active_bitacora');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.fecha === todayStr) {
          return parsed;
        }
      } catch (e) {}
    }
    return {
      ...defaultBitacora,
      fecha: todayStr,
      colaborador: savedUser?.full_name || '',
      user_id: savedUser?.id,
      area: savedUser?.team_name || 'Sistemas',
      actividades: [],
    };
  });

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [historial, setHistorial] = useState<Bitacora[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [papeleraModalOpen, setPapeleraModalOpen] = useState(false);
  const [papeleraCount, setPapeleraCount] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const refreshPapeleraCount = async () => {
    if (!currentUser) return;
    try {
      const res = await api.getPapelera(currentUser.id, currentUser.id);
      setPapeleraCount(res.total || 0);
    } catch (e) {
      console.warn('Error loading papelera count:', e);
    }
  };

  const showToast = (type: ToastType, message: string, title?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, message, title }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return false;
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('bitacora_theme');
    if (saved !== null) {
      return saved === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('bitacora_theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  // Restrict views based on role
  const role = currentUser?.role || 'analista';
  const isAdmin = role === 'admin';
  const isLider = role === 'lider' || currentUser?.is_leader || isAdmin;

  useEffect(() => {
    // If analista tries to access restricted views, redirect to lista
    if (!isAdmin && viewMode === 'gestion') {
      setViewMode('lista');
    }
    if (!isLider && viewMode === 'dashboard') {
      setViewMode('lista');
    }
  }, [role, viewMode, isAdmin, isLider]);

  // Sync user state
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('auth_user', JSON.stringify(currentUser));
      // Asignar colaborador y usuario si aún no están asignados en la bitácora activa
      setBitacora((prev) => {
        if (!prev.colaborador || prev.colaborador === '') {
          return {
            ...prev,
            colaborador: currentUser.full_name,
            user_id: currentUser.id,
            area: currentUser.team_name || prev.area || 'Sistemas',
          };
        }
        return prev;
      });
    } else {
      localStorage.removeItem('auth_user');
    }
  }, [currentUser]);

  // Auto-guardado local y sincronización debounced con el backend
  useEffect(() => {
    if (isSwitchingDateRef.current) return;

    const uid = bitacora.user_id || currentUser?.id;
    if (bitacora.fecha) {
      localStorage.setItem(getDraftKey(uid, bitacora.fecha), JSON.stringify(bitacora));
      localStorage.setItem('active_bitacora', JSON.stringify(bitacora));
    }

    const colab = bitacora.colaborador || currentUser?.full_name;
    if (!colab || !bitacora.fecha) {
      return;
    }

    const currentSignature = JSON.stringify({
      fecha: bitacora.fecha,
      colaborador: colab,
      user_id: uid,
      actividades: bitacora.actividades,
      pendientes: bitacora.pendientes,
      necesita_apoyo: bitacora.necesita_apoyo,
      apoyo_detalle: bitacora.apoyo_detalle,
      prioridad_siguiente: bitacora.prioridad_siguiente,
      hora_inicio: bitacora.hora_inicio,
    });

    if (currentSignature === lastSavedSignature.current) {
      return;
    }

    setAutoSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const payload: Bitacora = {
          ...bitacora,
          colaborador: colab,
          user_id: uid,
        };
        const result = await api.saveBitacora(payload);
        lastSavedSignature.current = currentSignature;
        setAutoSaveStatus('saved');
        setLastSavedTime(new Date());

        if (result.bitacora) {
          setBitacora((prev) => ({
            ...prev,
            id: result.bitacora.id,
            actividades: result.bitacora.actividades && result.bitacora.actividades.length > 0
              ? result.bitacora.actividades
              : prev.actividades,
          }));
        }

        // Actualizar historial local silenciosamente
        setHistorial((prev) => {
          const idx = prev.findIndex((b) => b.id === result.bitacora.id || (b.fecha === payload.fecha && b.user_id === payload.user_id));
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = result.bitacora;
            return next;
          }
          return [result.bitacora, ...prev];
        });
      } catch (err) {
        console.warn('Auto-save error:', err);
        setAutoSaveStatus('error');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [bitacora, currentUser]);

  // Carga inicial de datos
  const loadInitialData = async () => {
    try {
      const activeUser = currentUser || (localStorage.getItem('auth_user') ? JSON.parse(localStorage.getItem('auth_user')!) : null);
      const [uList, tList, hList, sysSettings] = await Promise.all([
        api.getUsers(),
        api.getTeams().catch(() => []),
        api.getBitacoras(undefined, undefined, undefined, activeUser?.id, activeUser?.id),
        api.getSettings().catch(() => ({ hora_inicio_default: '08:30' })),
      ]);
      setUsers(uList);
      setTeams(tList);
      setHistorial(hList);
      if (sysSettings) {
        setSystemSettings(sysSettings);
      }
      refreshPapeleraCount();

      const todayStr = getTodayLocalDateStr();
      const defaultStart = sysSettings?.hora_inicio_default || '08:30';

      if (activeUser) {
        const todayMatch = hList.find(
          (b) =>
            (b.user_id === activeUser.id ||
              b.colaborador.toLowerCase() === activeUser.full_name.toLowerCase() ||
              (activeUser.username && b.colaborador.toLowerCase() === activeUser.username.toLowerCase())) &&
            b.fecha === todayStr
        );
        if (todayMatch) {
          setBitacora(todayMatch);
          setIsGenerated(todayMatch.estado === 'generada' || todayMatch.estado === 'cerrada' || todayMatch.estado === 'cerrada_sistema');
          lastSavedSignature.current = JSON.stringify({
            fecha: todayMatch.fecha,
            colaborador: todayMatch.colaborador,
            user_id: todayMatch.user_id,
            actividades: todayMatch.actividades,
            pendientes: todayMatch.pendientes,
            necesita_apoyo: todayMatch.necesita_apoyo,
            apoyo_detalle: todayMatch.apoyo_detalle,
            prioridad_siguiente: todayMatch.prioridad_siguiente,
            hora_inicio: todayMatch.hora_inicio,
          });
        } else {
          // Verificar si hay borrador local para hoy
          const draft = localStorage.getItem(getDraftKey(activeUser.id, todayStr));
          if (draft) {
            try {
              const parsedDraft = JSON.parse(draft);
              if (parsedDraft && parsedDraft.fecha === todayStr) {
                setBitacora(parsedDraft);
                return;
              }
            } catch (e) {}
          }
          setBitacora((prev) => {
            if (prev.fecha !== todayStr || !prev.colaborador) {
              return {
                ...defaultBitacora,
                fecha: todayStr,
                hora_inicio: defaultStart,
                colaborador: activeUser.full_name,
                user_id: activeUser.id,
                area: activeUser.team_name || prev.area || 'Sistemas',
                actividades: prev.fecha === todayStr ? prev.actividades : [],
              };
            }
            return prev;
          });
        }
      }
    } catch (e) {
      console.warn('Initial data load error:', e);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Sincronizar título de página y favicon con la configuración institucional
  useEffect(() => {
    if (systemSettings) {
      if (systemSettings.system_title) {
        document.title = systemSettings.system_title;
      }
      if (systemSettings.favicon_url) {
        const link = (document.querySelector("link[rel*='icon']") as HTMLLinkElement) || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = systemSettings.favicon_url;
        document.getElementsByTagName('head')[0].appendChild(link);
      }
    }
  }, [systemSettings]);

  const handleFieldChange = (field: keyof Bitacora, value: any) => {
    setBitacora((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'colaborador' && currentUser?.role === 'admin') {
        const matched = users.find((u) => u.full_name.toLowerCase() === String(value).toLowerCase());
        if (matched) {
          updated.user_id = matched.id;
        }
      }
      return updated;
    });
  };

  const handleDateChange = async (newDate: string) => {
    if (!newDate || newDate === bitacora.fecha) return;
    isSwitchingDateRef.current = true;

    const activeUid = currentUser?.id || bitacora.user_id;
    const activeName = currentUser?.full_name || bitacora.colaborador;

    // 1. Guardar la bitácora del día actual de forma segura antes de cambiar de fecha
    if (bitacora.fecha && activeName) {
      const currentDraftKey = getDraftKey(activeUid, bitacora.fecha);
      localStorage.setItem(currentDraftKey, JSON.stringify(bitacora));

      if (bitacora.actividades.length > 0 || bitacora.pendientes || bitacora.prioridad_siguiente) {
        try {
          await api.saveBitacora({
            ...bitacora,
            colaborador: activeName,
            user_id: activeUid,
          });
        } catch (e) {
          console.warn('Error saving before date switch', e);
        }
      }
    }

    try {
      // 2. Consultar al backend por la bitácora de la nueva fecha
      const serverBitacoras = await api.getBitacoras(newDate, undefined, undefined, activeUid, activeUid);
      const serverMatch = serverBitacoras.find(
        (b) =>
          (b.user_id === activeUid ||
            b.colaborador.toLowerCase() === activeName.toLowerCase() ||
            (currentUser?.username && b.colaborador.toLowerCase() === currentUser.username.toLowerCase())) &&
          b.fecha === newDate
      );

      if (serverMatch) {
        setBitacora(serverMatch);
        setIsGenerated(serverMatch.estado === 'generada' || serverMatch.estado === 'cerrada' || serverMatch.estado === 'cerrada_sistema');
        lastSavedSignature.current = JSON.stringify({
          fecha: serverMatch.fecha,
          colaborador: serverMatch.colaborador,
          user_id: serverMatch.user_id,
          actividades: serverMatch.actividades,
          pendientes: serverMatch.pendientes,
          necesita_apoyo: serverMatch.necesita_apoyo,
          apoyo_detalle: serverMatch.apoyo_detalle,
          prioridad_siguiente: serverMatch.prioridad_siguiente,
          hora_inicio: serverMatch.hora_inicio,
        });
        setAutoSaveStatus('saved');
        setLastSavedTime(new Date());
      } else {
        // 3. Si no existe en el backend, buscar en borrador local de esa fecha
        const localDraft = localStorage.getItem(getDraftKey(activeUid, newDate));
        if (localDraft) {
          try {
            const parsed = JSON.parse(localDraft);
            if (parsed && parsed.fecha === newDate) {
              setBitacora(parsed);
              setIsGenerated(false);
              lastSavedSignature.current = JSON.stringify({
                fecha: parsed.fecha,
                colaborador: parsed.colaborador,
                user_id: parsed.user_id,
                actividades: parsed.actividades,
                pendientes: parsed.pendientes,
                necesita_apoyo: parsed.necesita_apoyo,
                apoyo_detalle: parsed.apoyo_detalle,
                prioridad_siguiente: parsed.prioridad_siguiente,
                hora_inicio: parsed.hora_inicio,
              });
              return;
            }
          } catch (e) {}
        }

        // 4. Si no hay nada, inicializar bitácora limpia vacía para esa fecha
        const cleanBitacora: Bitacora = {
          ...defaultBitacora,
          id: undefined,
          fecha: newDate,
          hora_inicio: systemSettings?.hora_inicio_default || bitacora.hora_inicio || '08:30',
          colaborador: activeName,
          user_id: activeUid,
          area: currentUser?.team_name || bitacora.area || 'Sistemas',
          actividades: [],
          pendientes: '',
          necesita_apoyo: 'No',
          apoyo_detalle: '',
          prioridad_siguiente: '',
        };
        setBitacora(cleanBitacora);
        setIsGenerated(false);
        lastSavedSignature.current = JSON.stringify({
          fecha: cleanBitacora.fecha,
          colaborador: cleanBitacora.colaborador,
          user_id: cleanBitacora.user_id,
          actividades: cleanBitacora.actividades,
          pendientes: cleanBitacora.pendientes,
          necesita_apoyo: cleanBitacora.necesita_apoyo,
          apoyo_detalle: cleanBitacora.apoyo_detalle,
          prioridad_siguiente: cleanBitacora.prioridad_siguiente,
          hora_inicio: cleanBitacora.hora_inicio,
        });
        setAutoSaveStatus('idle');
      }
    } catch (e) {
      console.warn('Error fetching bitacora for date:', newDate, e);
    } finally {
      setTimeout(() => {
        isSwitchingDateRef.current = false;
      }, 300);
    }
  };

  const reloadActiveBitacora = async () => {
    refreshPapeleraCount();
    const activeUid = currentUser?.id || bitacora.user_id;
    const activeName = currentUser?.full_name || bitacora.colaborador;
    try {
      const serverBitacoras = await api.getBitacoras(bitacora.fecha, undefined, undefined, activeUid, activeUid);
      const serverMatch = serverBitacoras.find(
        (b) =>
          (b.user_id === activeUid ||
            b.colaborador.toLowerCase() === activeName.toLowerCase() ||
            (currentUser?.username && b.colaborador.toLowerCase() === currentUser.username.toLowerCase())) &&
          b.fecha === bitacora.fecha
      );
      if (serverMatch) {
        setBitacora(serverMatch);
        setIsGenerated(serverMatch.estado === 'generada' || serverMatch.estado === 'cerrada' || serverMatch.estado === 'cerrada_sistema');
      }
    } catch (e) {
      console.warn('Error reloading bitacora:', e);
    }
  };

  const handleAddActividad = (actData?: Actividad) => {
    const newAct: Actividad = actData || {
      id: `act-${Date.now()}`,
      orden: bitacora.actividades.length,
      hora_inicio: bitacora.hora_inicio || '08:30',
      duracion_min: 30,
      tipo_trabajo: 'Desarrollo',
      descripcion: '',
      para_cliente: '',
      estado: 'completada',
    };
    setBitacora((prev) => ({
      ...prev,
      actividades: [...prev.actividades, newAct],
    }));
  };

  const handleAddActividadConEstado = (estado: EstadoActividad) => {
    const newAct: Actividad = {
      id: `act-${Date.now()}`,
      orden: bitacora.actividades.length,
      hora_inicio: '',
      duracion_min: 30,
      tipo_trabajo: 'Desarrollo',
      descripcion: '',
      para_cliente: '',
      estado: estado,
    };
    setBitacora((prev) => ({
      ...prev,
      actividades: [...prev.actividades, newAct],
    }));
  };

  const handleUpdateActividad = (index: number, field: keyof Actividad, value: any) => {
    setBitacora((prev) => {
      const updated = [...prev.actividades];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return {
        ...prev,
        actividades: updated,
      };
    });
  };

  const handleUpdateActividadDetalle = async (index: number, updatedData: Partial<Actividad>) => {
    const current = bitacora.actividades[index];
    setBitacora((prev) => {
      const updated = [...prev.actividades];
      updated[index] = {
        ...updated[index],
        ...updatedData,
      };
      return {
        ...prev,
        actividades: updated,
      };
    });
    if (current && current.id && typeof current.id === 'number') {
      await api.updateActividadDetalle(current.id, updatedData);
      showToast('success', 'Detalle de actividad guardado');
    }
  };

  const handleUpdateEstado = async (index: number, nuevoEstado: EstadoActividad) => {
    const act = bitacora.actividades[index];
    handleUpdateActividad(index, 'estado', nuevoEstado);
    const label =
      nuevoEstado === 'completada'
        ? 'Completada'
        : nuevoEstado === 'en_revision'
        ? 'En Revisión'
        : 'En Proceso';
    showToast('info', `Tarea marcada como "${label}"`);
    if (act && act.id && typeof act.id === 'number') {
      await api.updateActividadEstado(act.id, nuevoEstado);
    }
  };

  const handleRemoveActividad = async (index: number) => {
    const act = bitacora.actividades[index];
    setBitacora((prev) => ({
      ...prev,
      actividades: prev.actividades.filter((_, i) => i !== index),
    }));
    showToast('info', 'Actividad movida a la papelera (retención 15 días)');
    if (act && act.id && typeof act.id === 'number') {
      try {
        await api.softDeleteActividad(act.id);
        refreshPapeleraCount();
      } catch (e) {
        console.warn('Error soft-deleting act:', e);
      }
    }
  };

  const handleSyncWithBitacora = async () => {
    try {
      const colab = bitacora.colaborador || currentUser?.full_name || 'Juan Pérez García';
      const uid = bitacora.user_id || currentUser?.id;
      const res = await api.importarActividadesPendientes(colab, uid, bitacora.fecha);
      if (res.actividades && res.actividades.length > 0) {
        setBitacora((prev) => {
          const existingIds = new Set(prev.actividades.map((a) => a.id));
          const toAdd = res.actividades.filter((a) => !existingIds.has(a.id));
          return {
            ...prev,
            actividades: [...prev.actividades, ...toAdd],
          };
        });
        showToast('success', `${res.count} tareas activas importadas para hoy`, 'Sincronización Exitosa');
      } else {
        showToast('info', 'No se encontraron tareas pendientes de días anteriores para importar');
      }
    } catch (e: any) {
      console.warn('Sync error', e);
      showToast('error', 'Error al sincronizar actividades pendientes');
    }
    setViewMode('lista');
  };

  const handleGenerateBitacora = async () => {
    setIsSaving(true);
    try {
      const match = users.find((u) => u.full_name === bitacora.colaborador);
      const payload: Bitacora = {
        ...bitacora,
        user_id: match ? match.id : (bitacora.user_id || currentUser?.id),
        estado: 'generada',
      };
      const result = await api.saveBitacora(payload);
      if (result.bitacora && result.bitacora.id) {
        setBitacora(result.bitacora);
      }
      setIsGenerated(true);
      setAutoSaveStatus('saved');
      setLastSavedTime(new Date());
      lastSavedSignature.current = JSON.stringify({
        fecha: payload.fecha,
        colaborador: payload.colaborador,
        user_id: payload.user_id,
        actividades: payload.actividades,
        pendientes: payload.pendientes,
        necesita_apoyo: payload.necesita_apoyo,
        apoyo_detalle: payload.apoyo_detalle,
        prioridad_siguiente: payload.prioridad_siguiente,
        hora_inicio: payload.hora_inicio,
      });

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2563eb', '#38bdf8', '#10b981', '#f59e0b'],
        });
      } catch (e) {}

      showToast('success', '¡Bitácora guardada exitosamente en el historial!', 'Jornada Registrada');

      const updatedHistory = await api.getBitacoras(undefined, undefined, undefined, currentUser?.id);
      setHistorial(updatedHistory);

      // Open WhatsApp Share Modal so user can send link immediately
      setWhatsAppModalOpen(true);

      // Desplegar panel lateral de resumen automáticamente al generar bitácora
      setMobileDrawerOpen(true);
    } catch (e: any) {
      console.error('Error generando bitacora', e);
      showToast('error', e.message || 'Error al guardar la bitácora', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadBitacora = (selected: Bitacora) => {
    setBitacora(selected);
    setViewMode('lista');
    setIsGenerated(true);
    setAutoSaveStatus('saved');
    lastSavedSignature.current = JSON.stringify({
      fecha: selected.fecha,
      colaborador: selected.colaborador,
      user_id: selected.user_id,
      actividades: selected.actividades,
      pendientes: selected.pendientes,
      necesita_apoyo: selected.necesita_apoyo,
      apoyo_detalle: selected.apoyo_detalle,
      prioridad_siguiente: selected.prioridad_siguiente,
      hora_inicio: selected.hora_inicio,
    });
    showToast('info', `Cargada bitácora del ${selected.fecha}`);
  };

  const handleDeleteBitacora = async (id: number) => {
    if (window.confirm('¿Deseas eliminar este registro del historial?')) {
      await api.deleteBitacora(id);
      setHistorial((prev) => prev.filter((b) => b.id !== id));
      showToast('info', 'Registro eliminado del historial');
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'admin' || user.role === 'lider' || user.is_leader) {
      setViewMode('equipo');
    } else {
      setViewMode('lista');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('auth_user');
    setViewMode('lista');
  };

  // Cuando nadie está autenticado, renderizar la pantalla completa de Login
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} systemSettings={systemSettings || undefined} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F7F9] dark:bg-[#0B0F17] text-slate-800 dark:text-slate-100 flex flex-row font-sans transition-colors duration-250">
      {/* Collapsible Sidebar Navigation with Mobile Drawer */}
      <Sidebar
        currentView={viewMode}
        onViewChange={setViewMode}
        activitiesCount={bitacora.actividades.length}
        onOpenMobileSummary={() => setMobileDrawerOpen(true)}
        currentUser={currentUser}
        onOpenLogin={() => setLoginModalOpen(true)}
        onLogout={handleLogout}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenHelp={() => setHelpModalOpen(true)}
        systemSettings={systemSettings || undefined}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenChangePassword={() => setChangePasswordModalOpen(true)}
        onOpenPapelera={() => setPapeleraModalOpen(true)}
        papeleraCount={papeleraCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Header Bar */}
        <TopHeader
          currentUser={currentUser}
          onOpenHelp={() => setHelpModalOpen(true)}
          onOpenChangePassword={() => setChangePasswordModalOpen(true)}
          onOpenPapelera={() => setPapeleraModalOpen(true)}
          papeleraCount={papeleraCount}
        />

        <main className="flex-1 w-full px-3 sm:px-6 py-4 sm:py-5 pb-24 md:pb-6">
          {/* VIEW 1: MI BITÁCORA */}
          {viewMode === 'lista' && (
            <div className="w-full max-w-[1700px] mx-auto space-y-6">
              <ActividadesLista
                actividades={bitacora.actividades}
                onAddActividad={handleAddActividad}
                onUpdateActividad={handleUpdateActividad}
                onUpdateActividadDetalle={handleUpdateActividadDetalle}
                onUpdateEstado={handleUpdateEstado}
                onRemoveActividad={handleRemoveActividad}
                users={users}
                currentUser={currentUser}
                fecha={bitacora.fecha}
                onDateChange={handleDateChange}
                horaInicio={bitacora.hora_inicio}
                onHoraInicioChange={(val) => handleFieldChange('hora_inicio', val)}
                autoSaveStatus={autoSaveStatus}
                lastSavedTime={lastSavedTime}
              />

              <CierreJornada
                pendientes={bitacora.pendientes}
                necesitaApoyo={bitacora.necesita_apoyo}
                apoyoDetalle={bitacora.apoyo_detalle}
                prioridadSiguiente={bitacora.prioridad_siguiente}
                isSaving={isSaving}
                onChange={handleFieldChange}
                onSubmit={handleGenerateBitacora}
              />
            </div>
          )}

          {/* VIEW 2: ACTIVIDADES (KANBAN) */}
          {viewMode === 'kanban' && (
            <KanbanBoard
              actividades={bitacora.actividades}
              onUpdateEstado={handleUpdateEstado}
              onUpdateActividadDetalle={handleUpdateActividadDetalle}
              onAddActividadConEstado={handleAddActividadConEstado}
              onRemoveActividad={handleRemoveActividad}
              onSyncWithBitacora={handleSyncWithBitacora}
              colaborador={bitacora.colaborador}
            />
          )}

          {/* VIEW 3: SEGUIMIENTO DE EQUIPO (Líderes y Admin) */}
          {viewMode === 'equipo' && isLider && (
            <TeamSupervisionView currentUser={currentUser} teams={teams} users={users} />
          )}

          {/* VIEW 4: DASHBOARD DE ANALÍTICA Y KPIS (Líderes y Admin) */}
          {viewMode === 'dashboard' && isLider && (
            <DashboardView currentUser={currentUser} teams={teams} />
          )}

          {/* VIEW 4: GESTIÓN DE USUARIOS Y EQUIPOS (Solo Admin) */}
          {viewMode === 'gestion' && isAdmin && (
            <UserManagementView
              teams={teams}
              onRefreshTeams={loadInitialData}
              systemSettings={systemSettings || undefined}
              onUpdateSettings={setSystemSettings}
            />
          )}

          {/* VIEW 5: HISTORIAL */}
          {viewMode === 'historial' && (
            <HistorialView
              historial={historial}
              users={users}
              currentUser={currentUser}
              onLoadBitacora={handleLoadBitacora}
              onDeleteBitacora={handleDeleteBitacora}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (md:hidden) */}
      <BottomNav
        currentView={viewMode}
        onViewChange={(newView) => {
          setViewMode(newView);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        activitiesCount={bitacora.actividades.length}
        onOpenSummary={() => setMobileDrawerOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen(true)}
        currentUser={currentUser}
      />

      {/* Floating Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 3-Step Visual Help & Onboarding Guide Modal */}
      <HelpGuideModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />

      {/* Panel Lateral Desplegable de Resumen (Slide-over para Desktop y Móvil) */}
      <SummaryDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        bitacora={bitacora}
        isGenerated={isGenerated}
        onOpenWhatsApp={() => setWhatsAppModalOpen(true)}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        systemSettings={systemSettings || undefined}
      />

      {/* WhatsApp Share Modal with leader, collaborator, or custom number options */}
      <WhatsAppShareModal
        isOpen={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        bitacora={bitacora}
        currentUser={currentUser}
        users={users}
        teams={teams}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
        currentUser={currentUser}
        onSuccess={() => showToast('success', 'Contraseña actualizada exitosamente')}
      />

      {/* Papelera Modal */}
      <PapeleraModal
        isOpen={papeleraModalOpen}
        onClose={() => setPapeleraModalOpen(false)}
        currentUser={currentUser}
        onActivityRestored={reloadActiveBitacora}
      />
    </div>
  );
}

export default App;

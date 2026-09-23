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
import { TopHeader } from './components/TopHeader';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { Bitacora, Actividad, EstadoActividad, ViewMode, User, Team, SystemSettings } from './types';
import { defaultBitacora } from './utils/initialData';
import { api } from './services/api';
import { getTodayLocalDateStr } from './utils/formatters';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [bitacora, setBitacora] = useState<Bitacora>(() => {
    const todayStr = getTodayLocalDateStr();
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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
      const todayStr = getTodayLocalDateStr();
      if (currentUser.role !== 'admin') {
        const todayMatch = historial.find(
          (b) => (b.user_id === currentUser.id || b.colaborador === currentUser.full_name) && b.fecha === todayStr
        );
        if (todayMatch) {
          setBitacora(todayMatch);
          setIsGenerated(true);
        } else {
          setBitacora((prev) => ({
            ...prev,
            fecha: todayStr,
            colaborador: currentUser.full_name,
            user_id: currentUser.id,
          }));
        }
      }
    } else {
      localStorage.removeItem('auth_user');
    }
  }, [currentUser, historial]);

  // Auto-save active bitacora locally
  useEffect(() => {
    localStorage.setItem('active_bitacora', JSON.stringify(bitacora));
  }, [bitacora]);

  // Initial load
  const loadInitialData = async () => {
    try {
      const activeUser = currentUser || (localStorage.getItem('auth_user') ? JSON.parse(localStorage.getItem('auth_user')!) : null);
      const [uList, tList, hList, sysSettings] = await Promise.all([
        api.getUsers(),
        api.getTeams().catch(() => []),
        api.getBitacoras(undefined, undefined, undefined, activeUser?.id),
        api.getSettings().catch(() => ({ hora_inicio_default: '08:30' })),
      ]);
      setUsers(uList);
      setTeams(tList);
      setHistorial(hList);
      if (sysSettings) {
        setSystemSettings(sysSettings);
      }

      const todayStr = getTodayLocalDateStr();
      const defaultStart = sysSettings?.hora_inicio_default || '08:30';

      if (activeUser && activeUser.role !== 'admin') {
        const todayMatch = hList.find(
          (b) => (b.user_id === activeUser.id || b.colaborador === activeUser.full_name) && b.fecha === todayStr
        );
        if (todayMatch) {
          setBitacora(todayMatch);
          setIsGenerated(true);
        } else {
          setBitacora((prev) => {
            if (prev.fecha !== todayStr) {
              return {
                ...defaultBitacora,
                fecha: todayStr,
                hora_inicio: defaultStart,
                colaborador: activeUser.full_name,
                user_id: activeUser.id,
                area: prev.area || 'Sistemas',
                actividades: [],
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

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    const activeUid = currentUser?.id || bitacora.user_id;
    const activeName = currentUser?.full_name || bitacora.colaborador;

    // Si ya existe una bitácora en historial para esta fecha y usuario, la cargamos de inmediato
    const match = historial.find(
      (b) => (b.user_id === activeUid || b.colaborador === activeName) && b.fecha === newDate
    );
    if (match) {
      setBitacora(match);
      setIsGenerated(true);
    } else {
      setBitacora((prev) => ({
        ...defaultBitacora,
        id: undefined,
        fecha: newDate,
        hora_inicio: prev.hora_inicio || '08:30',
        colaborador: activeName,
        user_id: activeUid,
        area: currentUser?.team_name || prev.area || 'Sistemas',
        actividades: [],
        pendientes: '',
        necesita_apoyo: 'No',
        apoyo_detalle: '',
        prioridad_siguiente: '',
      }));
      setIsGenerated(false);
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

  const handleRemoveActividad = (index: number) => {
    setBitacora((prev) => ({
      ...prev,
      actividades: prev.actividades.filter((_, i) => i !== index),
    }));
    showToast('info', 'Actividad eliminada de la lista');
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
      const payload = {
        ...bitacora,
        user_id: match ? match.id : (bitacora.user_id || currentUser?.id),
      };
      const result = await api.saveBitacora(payload);
      if (result.bitacora && result.bitacora.id) {
        setBitacora(result.bitacora);
      }
      setIsGenerated(true);

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
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Header Bar */}
        <TopHeader
          currentUser={currentUser}
          onOpenHelp={() => setHelpModalOpen(true)}
          onOpenChangePassword={() => setChangePasswordModalOpen(true)}
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
            <TeamSupervisionView currentUser={currentUser} teams={teams} />
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
    </div>
  );
}

export default App;

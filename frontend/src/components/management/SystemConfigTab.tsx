import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  X,
  Shield,
  ShieldCheck,
  Sparkles,
  Download,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  CalendarCheck,
  Upload,
  Globe,
  LogIn,
  Eye,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { SystemSettings } from '../../types';
import { api } from '../../services/api';
import { alertDialog } from '../DialogHost';
import { McpIntegrationPanel } from '../McpIntegrationPanel';
import { useModalBehavior } from '../../hooks/useModalBehavior';

interface SystemConfigTabProps {
  systemSettings?: SystemSettings;
  onUpdateSettings?: (newSettings: SystemSettings) => void;
  onFeedback: (msg: string) => void;
  onRefreshUsersAndTeams: () => void;
}

export const SystemConfigTab: React.FC<SystemConfigTabProps> = ({
  systemSettings,
  onUpdateSettings,
  onFeedback,
  onRefreshUsersAndTeams,
}) => {
  const [defaultHoraInicio, setDefaultHoraInicio] = useState(systemSettings?.hora_inicio_default || '08:30');
  const [systemTitle, setSystemTitle] = useState(
    systemSettings?.system_title || 'Bitácora Diaria de Actividades | Marketing Alterno Perú'
  );
  const [logoUrl, setLogoUrl] = useState(systemSettings?.logo_url || '');
  const [faviconUrl, setFaviconUrl] = useState(systemSettings?.favicon_url || '');
  const [loginBgUrl, setLoginBgUrl] = useState(systemSettings?.login_bg_url || '');
  const [loginBgType, setLoginBgType] = useState<'gradient' | 'image'>(systemSettings?.login_bg_type || 'gradient');
  const [loginHeading, setLoginHeading] = useState(systemSettings?.login_heading || 'Bitácora Oficial');
  const [loginSubheading, setLoginSubheading] = useState(systemSettings?.login_subheading || 'Marketing Alterno Perú');
  const [systemMode, setSystemMode] = useState<'production' | 'demo'>(systemSettings?.system_mode || 'production');
  const [showDemoLogins, setShowDemoLogins] = useState(systemSettings?.show_demo_logins === 'true');
  const [cleaningData, setCleaningData] = useState(false);
  const [seedingData, setSeedingData] = useState(false);
  const [showCleanConfirmModal, setShowCleanConfirmModal] = useState(false);

  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const loginBgInputRef = useRef<HTMLInputElement>(null);

  useModalBehavior(showCleanConfirmModal, () => setShowCleanConfirmModal(false));

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        if (s) {
          if (s.hora_inicio_default) setDefaultHoraInicio(s.hora_inicio_default);
          if (s.system_title) setSystemTitle(s.system_title);
          if (s.logo_url !== undefined) setLogoUrl(s.logo_url);
          if (s.favicon_url !== undefined) setFaviconUrl(s.favicon_url);
          if (s.login_bg_url !== undefined) setLoginBgUrl(s.login_bg_url);
          if (s.login_bg_type) setLoginBgType(s.login_bg_type);
          if (s.login_heading) setLoginHeading(s.login_heading);
          if (s.login_subheading) setLoginSubheading(s.login_subheading);
          if (s.system_mode) setSystemMode(s.system_mode as 'production' | 'demo');
          if (s.show_demo_logins !== undefined) setShowDemoLogins(s.show_demo_logins === 'true');
        }
      })
      .catch(() => {});
  }, []);

  const handleFileUpload = async (file: File, target: 'logo' | 'favicon' | 'loginBg') => {
    setUploadingTarget(target);
    try {
      const uploaded = await api.uploadFile(file);
      if (target === 'logo') setLogoUrl(uploaded.url);
      if (target === 'favicon') setFaviconUrl(uploaded.url);
      if (target === 'loginBg') {
        setLoginBgUrl(uploaded.url);
        setLoginBgType('image');
      }
      onFeedback('Recurso cargado correctamente. Haz clic en "Guardar Toda la Configuración" para aplicar.');
    } catch (err: any) {
      void alertDialog(err.message || 'Error al subir el archivo');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload: Partial<SystemSettings> = {
        hora_inicio_default: defaultHoraInicio,
        system_title: systemTitle.trim(),
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        login_bg_url: loginBgUrl,
        login_bg_type: loginBgType,
        login_heading: loginHeading.trim(),
        login_subheading: loginSubheading.trim(),
        system_mode: systemMode,
        show_demo_logins: showDemoLogins ? 'true' : 'false',
      };
      const updated = await api.updateSettings(payload);
      if (onUpdateSettings) {
        onUpdateSettings(updated);
      }
      onFeedback('¡Identidad visual, modo de sistema y ajustes guardados con éxito!');
    } catch (err: any) {
      onFeedback(err.message || 'Error al guardar la configuración');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCleanProductionData = async () => {
    setCleaningData(true);
    try {
      const res = await api.cleanProductionData();
      onFeedback(res.message);
      setSystemMode('production');
      setShowDemoLogins(false);
      setShowCleanConfirmModal(false);
      onRefreshUsersAndTeams();
      if (onUpdateSettings) {
        const updated = await api.getSettings();
        onUpdateSettings(updated);
      }
    } catch (err: any) {
      void alertDialog(err.message || 'Error al purgar datos');
    } finally {
      setCleaningData(false);
    }
  };

  const handleSeedDemoData = async () => {
    setSeedingData(true);
    try {
      const res = await api.seedDemoData();
      onFeedback(res.message);
      setSystemMode('demo');
      setShowDemoLogins(true);
      onRefreshUsersAndTeams();
      if (onUpdateSettings) {
        const updated = await api.getSettings();
        onUpdateSettings(updated);
      }
    } catch (err: any) {
      void alertDialog(err.message || 'Error al cargar datos de demostración');
    } finally {
      setSeedingData(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl pb-10">
        {/* Inputs de archivo ocultos */}
        <input
          type="file"
          ref={logoInputRef}
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'logo');
          }}
        />
        <input
          type="file"
          ref={faviconInputRef}
          accept="image/x-icon,image/png,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'favicon');
          }}
        />
        <input
          type="file"
          ref={loginBgInputRef}
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'loginBg');
          }}
        />

        {/* CARD 0: MODO DEL SISTEMA & ENTORNO */}
        <div className="bg-white dark:bg-[#161922] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 shadow-xs">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-white/[0.08] gap-4 flex-wrap">
            <div className="flex items-start gap-3.5">
              <div
                className={`p-2.5 rounded-xl shrink-0 border ${
                  systemMode === 'production'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25'
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/25'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Modo del Sistema y Entorno
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      systemMode === 'production'
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25'
                        : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25'
                    }`}
                  >
                    {systemMode === 'production' ? '● Producción' : '⚡ Demostración'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Define si la plataforma opera para el equipo real de la empresa o en modo demostración para pruebas.
                </p>
              </div>
            </div>

            {/* Botón selector de modo */}
            <div className="flex items-center bg-slate-100 dark:bg-[#1E222D] p-1 rounded-xl border border-slate-200 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setSystemMode('production');
                  setShowDemoLogins(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer min-h-[34px] ${
                  systemMode === 'production'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Producción</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSystemMode('demo');
                  setShowDemoLogins(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer min-h-[34px] ${
                  systemMode === 'demo'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Demostración</span>
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {/* Checkbox accesos rápidos */}
            <label className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] cursor-pointer hover:bg-slate-100/70 dark:hover:bg-[#1E222D] transition-colors">
              <input
                type="checkbox"
                checked={showDemoLogins}
                onChange={(e) => setShowDemoLogins(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 dark:bg-[#161922] dark:border-white/[0.08]"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Mostrar accesos rápidos para demostración en la pantalla de Login
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Muestra los botones de un clic (Admin, Líder, Analista) en la pantalla de inicio de sesión. Desmárcalo en producción para que sólo se ingrese con usuario y contraseña válidos.
                </span>
              </div>
            </label>

            {/* Respaldo en Caliente de Base de Datos */}
            <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/25 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Respaldo de Seguridad en Caliente (SQLite Snapshot)</span>
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Genera una copia exacta y consistente de <code className="font-mono">/data/bitacora.db</code> sin interrumpir a los usuarios conectados. Además, el sistema guarda respaldos automáticos antes de cada actualización de esquema.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.downloadDatabaseBackup();
                    onFeedback('💾 Respaldo SQLite descargado correctamente.');
                  } catch (err: any) {
                    await alertDialog(err?.message || 'No se pudo descargar el respaldo de base de datos.');
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shrink-0 min-h-[38px]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Respaldo (.db)</span>
              </button>
            </div>

            {/* Acciones de Base de Datos y Purga aisladas en acordeón de seguridad */}
            <details className="pt-3 border-t border-slate-100 dark:border-white/[0.08] group">
              <summary className="flex items-center justify-between gap-2 cursor-pointer list-none text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline py-1">
                <span>⚠️ Zona de Mantenimiento y Purga de Entorno (Avanzado)</span>
                <span className="text-[11px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-3 p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-500/10 border border-rose-200/70 dark:border-rose-500/25 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Limpieza y Purga de Datos de Demostración
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Vacía las bitácoras y colaboradores de prueba para dejar el sistema impecable en producción con únicamente el Administrador (Protegido por flag de servidor en producción).
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowCleanConfirmModal(true)}
                    disabled={cleaningData || seedingData}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{cleaningData ? 'Purgando...' : 'Limpiar datos demo (Solo Admin)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSeedDemoData}
                    disabled={cleaningData || seedingData}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#1E222D] hover:bg-slate-200 dark:hover:bg-[#232836] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${seedingData ? 'animate-spin' : ''}`} />
                    <span>{seedingData ? 'Cargando demo...' : 'Restaurar datos demo'}</span>
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* CARD MCP: SERVIDOR MCP Y PUENTE PARA IA EXTERNA */}
        <McpIntegrationPanel />

        {/* CARD 1: IDENTIDAD VISUAL Y MARCA */}
        <div className="bg-white dark:bg-[#161922] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 shadow-xs">
          <div className="flex items-start gap-3.5 mb-5 pb-4 border-b border-slate-100 dark:border-white/[0.08]">
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0 border border-sky-200/80 dark:border-sky-500/25">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Identidad Visual y Marca
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Personaliza el nombre institucional de la plataforma, el logotipo oficial y el favicon visible en la pestaña del navegador.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Título de la Aplicación (Título de Pestaña y Cabecera)
              </label>
              <input
                type="text"
                value={systemTitle}
                onChange={(e) => setSystemTitle(e.target.value)}
                placeholder="Ej. Bitácora Diaria de Actividades | Marketing Alterno Perú"
                className="w-full px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-[#1E222D] outline-none transition-colors"
                required
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Se reflejará en la etiqueta &lt;title&gt; del navegador y en la barra lateral del sistema.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
              {/* Logotipo */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      Logotipo Corporativo
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                      >
                        Quitar logo
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                    Recomendado: SVG o PNG con transparencia (alto máx 48px).
                  </p>

                  <div className="h-20 rounded-xl bg-white dark:bg-[#161922] border border-dashed border-slate-200 dark:border-white/[0.08] flex items-center justify-center p-3 mb-3">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        className="max-h-14 max-w-full object-contain"
                        onError={() => {}}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <CalendarCheck className="w-6 h-6 text-sky-500" />
                        <span className="font-medium text-slate-500 dark:text-slate-400">Logo por defecto (Icono)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={uploadingTarget === 'logo'}
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full btn-pill-outline py-2 text-xs flex items-center justify-center gap-2 cursor-pointer min-h-[38px]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingTarget === 'logo' ? 'Subiendo logo...' : 'Subir Imagen de Logo'}</span>
                  </button>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="O ingresa URL directa del logo..."
                    className="w-full px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 bg-white dark:bg-[#161922] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:border-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Favicon */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      Favicon (Icono de Pestaña)
                    </label>
                    {faviconUrl && (
                      <button
                        type="button"
                        onClick={() => setFaviconUrl('')}
                        className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                      >
                        Restablecer
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                    Recomendado: Archivo .ico o .png cuadrado de 32x32px.
                  </p>

                  <div className="rounded-xl bg-slate-200/70 dark:bg-[#232836] p-2 mb-3">
                    <div className="bg-white dark:bg-[#161922] rounded-t-lg px-3 py-1.5 flex items-center gap-2 border-b border-slate-100 dark:border-white/[0.08] shadow-xs max-w-xs">
                      {faviconUrl ? (
                        <img
                          src={faviconUrl}
                          alt="Favicon"
                          className="w-4 h-4 object-contain rounded-xs shrink-0"
                          onError={() => {}}
                        />
                      ) : (
                        <Globe className="w-4 h-4 text-sky-500 shrink-0" />
                      )}
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {systemTitle.length > 24 ? systemTitle.substring(0, 24) + '...' : systemTitle}
                      </span>
                      <X className="w-3 h-3 text-slate-400 ml-auto shrink-0" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={uploadingTarget === 'favicon'}
                    onClick={() => faviconInputRef.current?.click()}
                    className="w-full btn-pill-outline py-2 text-xs flex items-center justify-center gap-2 cursor-pointer min-h-[38px]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingTarget === 'favicon' ? 'Subiendo favicon...' : 'Subir Archivo Favicon'}</span>
                  </button>
                  <input
                    type="text"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="O ingresa URL del favicon..."
                    className="w-full px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 bg-white dark:bg-[#161922] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:border-sky-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: PERSONALIZACIÓN DE PANTALLA DE LOGIN */}
        <div className="bg-white dark:bg-[#161922] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 shadow-xs">
          <div className="flex items-start gap-3.5 mb-5 pb-4 border-b border-slate-100 dark:border-white/[0.08]">
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0 border border-sky-200/80 dark:border-sky-500/25">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Personalización de Pantalla de Login
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Elige entre el degradado corporativo moderno o un wallpaper con imagen de fondo personalizada.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Tipo de Fondo para Iniciar Sesión
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setLoginBgType('gradient')}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-3 ${
                    loginBgType === 'gradient'
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#1E222D]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F1117] via-[#1E222D] to-sky-500/30 shrink-0 border border-white/10" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Ejecutivo Dark</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Diseño limpio y sobrio</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setLoginBgType('image')}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-3 ${
                    loginBgType === 'image'
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#1E222D]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#232836] flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 border border-slate-200 dark:border-white/[0.08]">
                    <ImageIcon className="w-4 h-4 text-sky-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Wallpaper / Foto</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Imagen personalizada o preset</p>
                  </div>
                </button>
              </div>
            </div>

            {loginBgType === 'image' && (
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/[0.08] space-y-4 animate-in fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    Imagen de Fondo (Subir o URL directa)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={uploadingTarget === 'loginBg'}
                      onClick={() => loginBgInputRef.current?.click()}
                      className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer shrink-0 transition-colors min-h-[38px]"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingTarget === 'loginBg' ? 'Subiendo wallpaper...' : 'Subir Wallpaper'}</span>
                    </button>
                    <input
                      type="text"
                      value={loginBgUrl}
                      onChange={(e) => setLoginBgUrl(e.target.value)}
                      placeholder="https://ejemplo.com/fondo.jpg"
                      className="flex-1 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-[#161922] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:border-sky-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">
                    O selecciona uno de nuestros fondos empresariales recomendados:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      {
                        name: 'Oficina Moderna',
                        url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80',
                      },
                      {
                        name: 'Minimal Urbano',
                        url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
                      },
                      {
                        name: 'Equipo & Espacio',
                        url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80',
                      },
                      {
                        name: 'Geometría Dark',
                        url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
                      },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setLoginBgUrl(preset.url)}
                        className={`group relative h-16 rounded-xl overflow-hidden border transition-all text-left cursor-pointer ${
                          loginBgUrl === preset.url
                            ? 'border-sky-500 ring-2 ring-sky-500/40'
                            : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-slate-900/30 transition-colors" />
                        <span className="absolute bottom-1 left-2 text-[10px] font-bold text-white drop-shadow-sm truncate">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Título Principal en Login
                </label>
                <input
                  type="text"
                  value={loginHeading}
                  onChange={(e) => setLoginHeading(e.target.value)}
                  placeholder="Ej. Bitácora Oficial"
                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-[#1E222D] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Subtítulo / Empresa en Login
                </label>
                <input
                  type="text"
                  value={loginSubheading}
                  onChange={(e) => setLoginSubheading(e.target.value)}
                  placeholder="Ej. Marketing Alterno Perú"
                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-[#1E222D] outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-500" />
                  Previsualización en tiempo real del Login
                </label>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Escala de maqueta interactiva</span>
              </div>

              <div
                className="w-full h-56 rounded-2xl relative overflow-hidden border border-slate-200 dark:border-white/[0.08] shadow-inner flex items-center justify-center p-4 transition-all"
                style={
                  loginBgType === 'image' && loginBgUrl
                    ? {
                        backgroundImage: `url(${loginBgUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : {
                        background: 'linear-gradient(135deg, #0F1117 0%, #1E222D 50%, #0D1B2A 100%)',
                      }
                }
              >
                {loginBgType === 'image' && <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" />}

                <div className="relative z-10 w-full max-w-xs bg-white/95 dark:bg-[#161922]/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/40 dark:border-white/[0.08] text-center pointer-events-none scale-90 sm:scale-100 transition-all">
                  <div className="flex items-center justify-center mb-2">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        className="h-7 max-w-[130px] object-contain"
                        onError={() => {}}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/30">
                        <CalendarCheck className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    {loginHeading || 'Bitácora Oficial'}
                  </h4>
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-2.5">
                    {loginSubheading || 'Marketing Alterno Perú'}
                  </p>

                  <div className="space-y-1.5 opacity-75">
                    <div className="h-6 bg-slate-100 dark:bg-[#1E222D] rounded-lg border border-slate-200 dark:border-white/[0.08] flex items-center px-2 text-[10px] text-slate-400 dark:text-slate-500">
                      usuario
                    </div>
                    <div className="h-6 bg-slate-100 dark:bg-[#1E222D] rounded-lg border border-slate-200 dark:border-white/[0.08] flex items-center px-2 text-[10px] text-slate-400 dark:text-slate-500">
                      ••••••••
                    </div>
                    <div className="h-6 bg-sky-600 rounded-lg text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                      Ingresar
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: AJUSTES DE JORNADA LABORAL */}
        <div className="bg-white dark:bg-[#161922] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 shadow-xs">
          <div className="flex items-start gap-3.5 mb-5 pb-4 border-b border-slate-100 dark:border-white/[0.08]">
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0 border border-sky-200/80 dark:border-sky-500/25">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Ajustes de Jornada Laboral
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configura los parámetros globales que aplican por defecto a todos los colaboradores y a los procesos automatizados.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Hora de Inicio de Jornada (Por Defecto)
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="time"
                  value={defaultHoraInicio}
                  onChange={(e) => setDefaultHoraInicio(e.target.value)}
                  className="px-4 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:border-sky-500 focus:bg-white dark:focus:bg-[#1E222D] outline-none w-36"
                  required
                />
                <span className="text-xs text-slate-400 dark:text-slate-500">(Valor estándar: 08:30 am)</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Esta hora es de carácter referencial. Se asignará automáticamente como valor inicial al abrir nuevas bitácoras y al proceso de arrastre nocturno (rollover) de actividades.
              </p>
            </div>
          </div>
        </div>

        {/* BOTÓN GUARDAR CONFIGURACIÓN */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={savingSettings}
            className="bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white font-semibold px-6 py-2.5 text-sm rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 min-h-[42px]"
          >
            <Check className="w-4 h-4" />
            <span>{savingSettings ? 'Guardando cambios...' : 'Guardar Toda la Configuración'}</span>
          </button>
        </div>
      </form>

      {/* MODAL DE CONFIRMACIÓN PARA LIMPIAR DATOS DE PRUEBA */}
      {showCleanConfirmModal && (
        <div
          onClick={() => setShowCleanConfirmModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] rounded-2xl max-w-md w-full border border-rose-500/30 p-4 sm:p-6 shadow-2xl relative my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3.5 mb-4 text-rose-500">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ¿Purgar todos los datos demo?
                </h3>
                <p className="text-xs text-rose-500 font-semibold mt-0.5">Esta acción es irreversible</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              <p>Se eliminarán de forma permanente:</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400">
                <li>Todas las bitácoras generadas y registros diarios</li>
                <li>Todas las actividades individuales y colaborativas</li>
                <li>Los colaboradores de prueba (Juan, María, Carlos, Pedro)</li>
                <li>Los equipos de demostración</li>
              </ul>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold mt-2">
                ✓ Tu usuario Administrador (<code className="font-mono">admin</code>) se conservará intacto con su contraseña actual.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowCleanConfirmModal(false)}
                disabled={cleaningData}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222D] cursor-pointer min-h-[38px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCleanProductionData}
                disabled={cleaningData}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50 min-h-[38px]"
              >
                <Trash2 className="w-4 h-4" />
                <span>{cleaningData ? 'Purgando...' : 'Sí, Purgar y Dejar en Producción'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

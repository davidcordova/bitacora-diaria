import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  Phone,
  Lock,
  Shield,
  Building2,
  KeyRound,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Save,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { User, Team } from '../types';
import { api } from '../services/api';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  teams?: Team[];
  onUserUpdated: (updatedUser: User) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  teams = [],
  onUserUpdated,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && isOpen) {
      setFullName(currentUser.full_name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
      setErrorMsg(null);
      setSuccessMsg(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const roleLabel =
    currentUser.role === 'admin'
      ? 'ADMINISTRADOR'
      : currentUser.role === 'lider' || currentUser.is_leader
      ? 'LÍDER DE EQUIPO'
      : 'ANALISTA';

  const roleColor =
    currentUser.role === 'admin'
      ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
      : currentUser.role === 'lider' || currentUser.is_leader
      ? 'bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border-[#00F0FF]/30'
      : 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30';

  const teamName =
    currentUser.team_name ||
    teams.find((t) => t.id === currentUser.team_id)?.nombre ||
    'Sin equipo asignado';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('El nombre completo es obligatorio.');
      return;
    }

    if (showPasswordSection && (newPassword || currentPassword)) {
      if (!currentPassword) {
        setErrorMsg('Debes ingresar tu contraseña actual para confirmar el cambio.');
        return;
      }
      if (newPassword.length < 4) {
        setErrorMsg('La nueva contraseña debe tener al menos 4 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('La confirmación de la nueva contraseña no coincide.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: {
        user_id: number;
        full_name: string;
        email?: string;
        phone?: string;
        current_password?: string;
        new_password?: string;
      } = {
        user_id: currentUser.id,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      };

      if (showPasswordSection && newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const res = await api.updateProfile(payload);
      if (res.user) {
        onUserUpdated(res.user);
        setSuccessMsg(res.message || 'Perfil actualizado exitosamente.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordSection(false);
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#13141F] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#252636] flex flex-col max-h-[92dvh] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#252636] bg-slate-50/70 dark:bg-[#161722]/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00F0FF] to-[#00A3BF] text-slate-950 font-black flex items-center justify-center shadow-md shadow-[#00F0FF]/20 text-sm font-heading">
              {currentUser.full_name?.charAt(0) || currentUser.username.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading">
                  Mi Perfil & Cuenta
                </h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${roleColor}`}>
                  {roleLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Gestiona tus datos personales y credenciales de acceso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Read-only System Properties */}
          <div className="bg-slate-50/80 dark:bg-[#161722] border border-slate-200/90 dark:border-[#252636] rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>Propiedades de la Cuenta</span>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Asignado por Administración</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Usuario Login */}
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#1A1C29] border border-slate-200/80 dark:border-[#252636]">
                <span className="text-[10px] font-semibold text-slate-400 block">Usuario</span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                  @{currentUser.username}
                </span>
              </div>

              {/* Rol */}
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#1A1C29] border border-slate-200/80 dark:border-[#252636]">
                <span className="text-[10px] font-semibold text-slate-400 block">Privilegio / Rol</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                  {roleLabel}
                </span>
              </div>

              {/* Equipo */}
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#1A1C29] border border-slate-200/80 dark:border-[#252636]">
                <span className="text-[10px] font-semibold text-slate-400 block">Equipo Asignado</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                  {teamName}
                </span>
              </div>
            </div>
          </div>

          {/* Editable Personal Data */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <UserIcon className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span>Datos Personales</span>
            </h4>

            {/* Nombre Completo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nombre Completo <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre completo"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1A1C29] focus:bg-white dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
                  required
                />
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Grid Correo y Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Correo Electrónico */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1A1C29] focus:bg-white dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Teléfono / WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Teléfono / WhatsApp
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="999 999 999"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1A1C29] focus:bg-white dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Security & Password Section */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#252636]/60">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Seguridad & Contraseña
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordSection(!showPasswordSection)}
                className="text-xs font-bold text-[#0090A0] dark:text-[#00F0FF] hover:underline cursor-pointer"
              >
                {showPasswordSection ? 'Ocultar cambio' : 'Modificar contraseña'}
              </button>
            </div>

            {showPasswordSection && (
              <div className="bg-slate-50/70 dark:bg-[#161722] p-4 rounded-xl border border-slate-200/90 dark:border-[#252636] space-y-3 animate-in fade-in">
                {/* Contraseña Actual */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Contraseña Actual <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Ingresa tu contraseña actual"
                      className="w-full pl-9 pr-10 py-2.5 bg-white dark:bg-[#1A1C29] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 absolute right-2.5 top-2 cursor-pointer"
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Nueva Contraseña y Confirmación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Nueva Contraseña <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 4 caracteres"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-[#1A1C29] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
                      />
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Confirmar Nueva Contraseña <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repite la nueva clave"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-[#1A1C29] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
                      />
                      <Check className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="hidden">
            <button type="submit" id="submit-profile-form">Guardar</button>
          </div>
        </form>

        {/* Sticky Action Footer */}
        <div className="shrink-0 px-6 py-3.5 border-t border-slate-100 dark:border-[#252636] bg-slate-50/90 dark:bg-[#161722]/90 backdrop-blur-md flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#1A1C29] rounded-xl transition-colors cursor-pointer min-h-[40px]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={(e) => {
              const form = document.querySelector('form');
              if (form) form.requestSubmit();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-[#00F0FF]/25 cursor-pointer min-h-[40px]"
          >
            <Save className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

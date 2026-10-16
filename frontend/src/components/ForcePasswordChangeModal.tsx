import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, AlertCircle, ShieldCheck, LogOut, Loader2 } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';

const MIN_LENGTH = 8;

interface ForcePasswordChangeModalProps {
  currentUser: User;
  onChanged: (user: User) => void;
  onLogout: () => void;
}

/**
 * Pantalla bloqueante: aparece cuando la cuenta usa una contraseña temporal o por defecto.
 * El servidor rechaza cualquier escritura (403 password_change_required) hasta completar el cambio.
 */
export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({ currentUser, onChanged, onLogout }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = [
    { ok: newPassword.length >= MIN_LENGTH, label: `Al menos ${MIN_LENGTH} caracteres` },
    { ok: /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword), label: 'Letras y números' },
    { ok: newPassword.length > 0 && newPassword !== currentPassword, label: 'Distinta de la actual' },
    { ok: newPassword.length > 0 && newPassword === confirmPassword, label: 'La confirmación coincide' },
  ];
  const canSubmit = checks.every((c) => c.ok) && currentPassword.length > 0 && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await api.changePassword({ user_id: currentUser.id, current_password: currentPassword, new_password: newPassword });
      onChanged({ ...currentUser, must_change_password: false });
    } catch (err: any) {
      setError(err?.message || 'No se pudo cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00F0FF]/60';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-pw-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-[#13141F] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#252636] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-[#00F0FF] to-blue-500" />
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 id="force-pw-title" className="text-base font-bold text-slate-900 dark:text-white">
                Crea tu contraseña personal
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Hola {currentUser.full_name?.split(' ')[0] || currentUser.username}. Tu cuenta usa una contraseña temporal o
                por defecto. Por seguridad debes cambiarla para seguir registrando tu bitácora.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Contraseña actual (la que usaste para ingresar)</span>
            <input
              id="force-pw-current"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nueva contraseña</span>
            <div className="relative">
              <input
                id="force-pw-new"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label={show ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Repite la nueva contraseña</span>
            <input
              id="force-pw-confirm"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputCls}
            />
          </label>

          <ul className="grid grid-cols-2 gap-1.5 text-[11px]">
            {checks.map((c) => (
              <li
                key={c.label}
                className={`flex items-center gap-1.5 ${c.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{c.label}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              id="force-pw-logout"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
            <button
              type="submit"
              id="force-pw-submit"
              disabled={!canSubmit}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] text-slate-950 text-sm font-bold shadow-md shadow-[#00F0FF]/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all hover:brightness-110"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar y continuar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

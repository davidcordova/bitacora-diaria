import React, { useState } from 'react';
import { Lock, User, Key, ShieldCheck, Shield, Star, AlertCircle, Sparkles } from 'lucide-react';
import { User as UserType, SystemSettings } from '../types';
import { api } from '../services/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserType) => void;
  systemSettings?: SystemSettings;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess, systemSettings }) => {
  const isDemoMode = systemSettings?.system_mode === 'demo' || systemSettings?.show_demo_logins === 'true';
  const [username, setUsername] = useState(isDemoMode ? 'admin' : '');
  const [password, setPassword] = useState(isDemoMode ? 'M1un1c4cl4v3' : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(username, password);
      onLoginSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const setQuickUser = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#13141F] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200/90 dark:border-[#252636] relative">
        <div className="text-center mb-6">
          {systemSettings?.logo_url ? (
            <div className="flex items-center justify-center mb-3">
              <div className="p-2 bg-slate-50 dark:bg-[#161722] border border-slate-200/80 dark:border-[#252636] rounded-2xl shadow-xs inline-flex items-center justify-center">
                <img
                  src={systemSettings.logo_url}
                  alt="Logo"
                  className="max-h-10 max-w-[140px] object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="w-14 h-14 bg-gradient-to-tr from-[#00F0FF] to-[#00A3BF] text-slate-950 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-[#00F0FF]/25">
              <Lock className="w-7 h-7" />
            </div>
          )}
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {systemSettings?.login_heading || 'Iniciar Sesión'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {systemSettings?.login_subheading || 'Accede al sistema de bitácora, gestión de equipos y dashboard'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Usuario</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#161722] text-xs sm:text-sm text-slate-900 dark:text-slate-100 rounded-full border border-slate-200 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-2 focus:ring-[#00F0FF]/20 focus:outline-hidden transition-all"
                placeholder="ej: admin o juan"
                required
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#161722] text-xs sm:text-sm text-slate-900 dark:text-slate-100 rounded-full border border-slate-200 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-2 focus:ring-[#00F0FF]/20 focus:outline-hidden transition-all"
                placeholder="••••••••"
                required
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 rounded-full text-xs sm:text-sm font-bold shadow-md shadow-[#00F0FF]/25 transition-all cursor-pointer"
          >
            {loading ? 'Verificando...' : 'Entrar al Sistema'}
          </button>
        </form>

        {/* Quick Test Demo Buttons (Only in Demo Mode) */}
        {isDemoMode && (
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#252636]">
            <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>Accesos rápidos de prueba</span>
              <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setQuickUser('admin', 'M1un1c4cl4v3')}
                className={`p-2 rounded-full text-[11px] font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[36px] ${
                  username === 'admin'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    : 'bg-slate-50 dark:bg-[#161722] border-slate-200 dark:border-[#252636] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C1D2A]'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Admin</span>
              </button>

              <button
                type="button"
                onClick={() => setQuickUser('juan', '123456')}
                className={`p-2 rounded-full text-[11px] font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[36px] ${
                  username === 'juan'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                    : 'bg-slate-50 dark:bg-[#161722] border-slate-200 dark:border-[#252636] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C1D2A]'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Líder</span>
              </button>

              <button
                type="button"
                onClick={() => setQuickUser('maria', '123456')}
                className={`p-2 rounded-full text-[11px] font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[36px] ${
                  username === 'maria'
                    ? 'bg-[#00F0FF]/15 dark:bg-[#00F0FF]/15 border-[#00F0FF]/40 text-cyan-600 dark:text-[#00F0FF]'
                    : 'bg-slate-50 dark:bg-[#161722] border-slate-200 dark:border-[#252636] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C1D2A]'
                }`}
              >
                <User className="w-3.5 h-3.5 text-[#00A3BF] dark:text-[#00F0FF] shrink-0" />
                <span>Analista</span>
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1"
        >
          Continuar como invitado
        </button>
      </div>
    </div>
  );
};

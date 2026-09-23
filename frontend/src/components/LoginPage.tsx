import React, { useState } from 'react';
import {
  Lock,
  User,
  Key,
  CalendarCheck,
  ShieldCheck,
  Shield,
  Star,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { User as UserType, SystemSettings } from '../types';
import { api } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: UserType) => void;
  systemSettings?: SystemSettings;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, systemSettings }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('M1un1c4cl4v3');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isImageBg = systemSettings?.login_bg_type === 'image' && Boolean(systemSettings?.login_bg_url);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(username.trim(), password);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Error al autenticar credenciales');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden font-sans select-none ${
        isImageBg ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950'
      }`}
      style={
        isImageBg
          ? {
              backgroundImage: `url(${systemSettings?.login_bg_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }
          : undefined
      }
    >
      {/* Si es fondo de imagen, capa oscura para contraste profesional */}
      {isImageBg && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs pointer-events-none z-0" />
      )}

      {/* Dynamic Background Glows */}
      {!isImageBg && (
        <>
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#00C9A7]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00C9A7]/5 rounded-full blur-[120px] pointer-events-none" />
        </>
      )}

      {/* Top Bar: Company Branding */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-3">
          {systemSettings?.logo_url ? (
            <div className="h-11 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/20 flex items-center justify-center">
              <img
                src={systemSettings.logo_url}
                alt="Logo"
                className="max-h-8 max-w-[150px] object-contain"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00C9A7] to-[#00B894] text-white flex items-center justify-center shadow-lg shadow-[#00C9A7]/30">
              <CalendarCheck className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-white text-lg tracking-tight">
                {systemSettings?.login_heading || 'Bitácora'}
              </span>
              <span className="text-[10px] font-bold text-[#00A88B] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#E6F9F5] border border-[#00C9A7]/20">
                Oficial
              </span>
            </div>
            <div className="text-xs text-slate-300 font-medium">
              {systemSettings?.login_subheading || 'Marketing Alterno Perú'}
            </div>
          </div>
        </div>

        {/* Origami Company Logo */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
          <svg className="w-5 h-5 text-red-500 shrink-0" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 5 L95 90 L75 90 L50 40 L25 90 L5 90 Z" />
            <path d="M50 48 L68 85 L32 85 Z" fill="#991b1b" />
          </svg>
          <span className="text-[11px] font-bold text-slate-200 hidden sm:inline tracking-wide">
            Marketing Alterno
          </span>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="w-full max-w-md mx-auto my-auto z-10">
        <div className="bg-white/95 dark:bg-[#13141F]/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40 border border-white/20 dark:border-[#252636] transition-all">
          {/* Card Header */}
          <div className="text-center mb-6">
            {systemSettings?.logo_url ? (
              <div className="flex items-center justify-center mb-3.5">
                <div className="p-2.5 bg-slate-50 dark:bg-[#161722] border border-slate-200/80 dark:border-[#252636] rounded-2xl shadow-xs inline-flex items-center justify-center">
                  <img
                    src={systemSettings.logo_url}
                    alt="Logo"
                    className="max-h-12 max-w-[170px] object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="w-14 h-14 bg-gradient-to-tr from-[#00F0FF] to-[#00A3BF] text-slate-950 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-xl shadow-[#00F0FF]/25">
                <Lock className="w-7 h-7" />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {systemSettings?.login_heading || 'Iniciar Sesión'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              {systemSettings?.login_subheading ? `Bienvenido a ${systemSettings.login_subheading}. Ingresa tus credenciales.` : 'Ingresa tus credenciales para acceder a la bitácora diaria y tus actividades'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-2xl flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Usuario
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100/70 dark:hover:bg-[#1C1D2A] focus:bg-white dark:focus:bg-[#161722] text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 rounded-full border border-slate-200 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-3 focus:ring-[#00F0FF]/20 outline-hidden transition-all placeholder:text-slate-400"
                  placeholder="ej: admin, juan, maria"
                  required
                  autoFocus
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100/70 dark:hover:bg-[#1C1D2A] focus:bg-white dark:focus:bg-[#161722] text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 rounded-full border border-slate-200 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-3 focus:ring-[#00F0FF]/20 outline-hidden transition-all placeholder:text-slate-400"
                  placeholder="Ingresa tu contraseña"
                  required
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 absolute right-3.5 top-3 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-[0.99] text-slate-950 rounded-full text-xs sm:text-sm font-bold shadow-lg shadow-[#00F0FF]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  <span>Validando acceso...</span>
                </>
              ) : (
                <>
                  <span>Ingresar a la Plataforma</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Access Roles Section */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#252636]">
            <div className="flex items-center justify-between mb-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>Accesos rápidos para demostración</span>
              <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'M1un1c4cl4v3')}
                className={`py-2 px-2 rounded-full text-[11px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[38px] ${
                  username === 'admin'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 ring-2 ring-rose-100 dark:ring-rose-900 shadow-2xs'
                    : 'bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#252636]'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Admin</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('juan', '123456')}
                className={`py-2 px-2 rounded-full text-[11px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[38px] ${
                  username === 'juan'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 ring-2 ring-amber-100 dark:ring-amber-900 shadow-2xs'
                    : 'bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#252636]'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Líder</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('maria', '123456')}
                className={`py-2 px-2 rounded-full text-[11px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[38px] ${
                  username === 'maria'
                    ? 'bg-[#00F0FF]/15 dark:bg-[#00F0FF]/15 border-[#00F0FF]/40 text-cyan-600 dark:text-[#00F0FF] ring-2 ring-[#00F0FF]/20 shadow-2xs'
                    : 'bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#252636]'
                }`}
              >
                <User className="w-3.5 h-3.5 text-[#00A3BF] dark:text-[#00F0FF] shrink-0" />
                <span>Analista</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security / System Footer Note */}
        <div className="mt-4 text-center text-slate-400 text-[11px] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span>Sistema institucional protegido • Acceso exclusivo para colaboradores</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-[11px] text-slate-400 z-10 py-2">
        © {new Date().getFullYear()} {systemSettings?.login_subheading || 'Marketing Alterno Perú'}. Todos los derechos reservados.
      </footer>
    </div>
  );
};

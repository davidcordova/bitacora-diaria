import React from 'react';
import {
  ShieldCheck,
  X,
  AlertCircle,
  Key,
  Sparkles,
  Check,
  Copy,
  RefreshCw,
  RotateCcw,
  Send,
} from 'lucide-react';
import { ItPlatformUser } from '../../types';
import { generateVaultPassword } from './VaultConstants';

interface VaultSecurityModalsProps {
  // Unlock modal
  isUnlockModalOpen: boolean;
  onCloseUnlock: () => void;
  hasSecurityPin: boolean;
  unlockMode: 'pin' | 'password';
  setUnlockMode: (mode: 'pin' | 'password') => void;
  unlockPinInput: string;
  setUnlockPinInput: (v: string) => void;
  unlockPasswordInput: string;
  setUnlockPasswordInput: (v: string) => void;
  unlockError: string;
  setUnlockError: (v: string) => void;
  unlocking: boolean;
  onVerifyUnlock: (e: React.FormEvent) => void;

  // PIN config modal
  isPinConfigModalOpen: boolean;
  onClosePinConfig: () => void;
  pinCurrentPass: string;
  setPinCurrentPass: (v: string) => void;
  pinNewPin: string;
  setPinNewPin: (v: string) => void;
  pinConfirmPin: string;
  setPinConfirmPin: (v: string) => void;
  pinConfigError: string;
  savingPin: boolean;
  onSavePin: (e: React.FormEvent) => void;

  // Quick generator modal
  isGenModalOpen: boolean;
  onCloseGen: () => void;
  genLength: number;
  setGenLength: (v: number) => void;
  genIncludeSpecial: boolean;
  setGenIncludeSpecial: (v: boolean) => void;
  genIncludeNumbers: boolean;
  setGenIncludeNumbers: (v: boolean) => void;
  generatedQuickPass: string;
  setGeneratedQuickPass: (v: string) => void;
  copiedId: string | null;
  onCopyText: (
    textOrGetter: string | null | undefined | (() => string),
    label: string,
    credId?: number,
    isPassword?: boolean
  ) => void;
  onUseGeneratedPassForUser: (password: string) => void;

  // Reset password modal
  isResetModalOpen: boolean;
  onCloseReset: () => void;
  selectedUserForReset: ItPlatformUser | null;
  resetGeneratedPass: string;
  setResetGeneratedPass: (v: string) => void;
  resetShareMessage: string;
  setResetShareMessage: (v: string) => void;
  isResetting: boolean;
  onConfirmReset: () => void;
  onSendWhatsApp: (phone?: string, text?: string) => void;
}

export const VaultSecurityModals: React.FC<VaultSecurityModalsProps> = ({
  isUnlockModalOpen,
  onCloseUnlock,
  hasSecurityPin,
  unlockMode,
  setUnlockMode,
  unlockPinInput,
  setUnlockPinInput,
  unlockPasswordInput,
  setUnlockPasswordInput,
  unlockError,
  setUnlockError,
  unlocking,
  onVerifyUnlock,

  isPinConfigModalOpen,
  onClosePinConfig,
  pinCurrentPass,
  setPinCurrentPass,
  pinNewPin,
  setPinNewPin,
  pinConfirmPin,
  setPinConfirmPin,
  pinConfigError,
  savingPin,
  onSavePin,

  isGenModalOpen,
  onCloseGen,
  genLength,
  setGenLength,
  genIncludeSpecial,
  setGenIncludeSpecial,
  genIncludeNumbers,
  setGenIncludeNumbers,
  generatedQuickPass,
  setGeneratedQuickPass,
  copiedId,
  onCopyText,
  onUseGeneratedPassForUser,

  isResetModalOpen,
  onCloseReset,
  selectedUserForReset,
  resetGeneratedPass,
  setResetGeneratedPass,
  resetShareMessage,
  setResetShareMessage,
  isResetting,
  onConfirmReset,
  onSendWhatsApp,
}) => {
  return (
    <>
      {/* MODAL: RESETEO RÁPIDO DE CLAVE Y PLANTILLA DE MENSAJE */}
      {isResetModalOpen && selectedUserForReset && (
        <div
          onClick={onCloseReset}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fadeIn"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/10 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-500" />
                <span>Resetear Contraseña de Soporte</span>
              </h2>
              <button
                type="button"
                onClick={onCloseReset}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-[#1A1E29] p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Colaborador:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                  {selectedUserForReset.colaborador_nombre}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Plataforma:</span>
                <span className="font-semibold text-sky-600 dark:text-sky-400">
                  {selectedUserForReset.plataforma}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Usuario:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold truncate">
                  {selectedUserForReset.usuario_login}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nueva Contraseña Generada
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const np = generateVaultPassword(14);
                    setResetGeneratedPass(np);
                    const empName = selectedUserForReset.empresa_nombre || 'la Empresa';
                    setResetShareMessage(
                      `Hola ${selectedUserForReset.colaborador_nombre}, el área de Sistemas de ${empName} te comparte tus credenciales actualizadas:\n\nPlataforma: ${selectedUserForReset.plataforma}\nUsuario: ${selectedUserForReset.usuario_login}\nContraseña temporal: ${np}\n\nPor favor inicia sesión y cambia tu contraseña por seguridad.`
                    );
                  }}
                  className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Regenerar</span>
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={resetGeneratedPass}
                  onChange={(e) => {
                    setResetGeneratedPass(e.target.value);
                    const empName = selectedUserForReset.empresa_nombre || 'la Empresa';
                    setResetShareMessage(
                      `Hola ${selectedUserForReset.colaborador_nombre}, el área de Sistemas de ${empName} te comparte tus credenciales actualizadas:\n\nPlataforma: ${selectedUserForReset.plataforma}\nUsuario: ${selectedUserForReset.usuario_login}\nContraseña temporal: ${e.target.value}\n\nPor favor inicia sesión y cambia tu contraseña por seguridad.`
                    );
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] font-mono text-xs text-amber-600 dark:text-amber-300 font-bold border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => onCopyText(resetGeneratedPass, 'Contraseña temporal')}
                  className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#222735] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer flex items-center justify-center"
                  title="Copiar contraseña"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Mensaje de Respuesta Listo para Enviar:</span>
                <button
                  type="button"
                  onClick={() => onCopyText(resetShareMessage, 'Mensaje de soporte')}
                  className="text-sky-600 dark:text-sky-400 hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copiar Mensaje</span>
                </button>
              </div>
              <textarea
                rows={4}
                value={resetShareMessage}
                onChange={(e) => setResetShareMessage(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200/80 dark:border-white/[0.08] flex-wrap">
              {selectedUserForReset.colaborador_telefono ? (
                <button
                  type="button"
                  onClick={() => onSendWhatsApp(selectedUserForReset.colaborador_telefono, resetShareMessage)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar por WhatsApp</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onCloseReset}
                  className="px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-semibold cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={onConfirmReset}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {isResetting ? 'Guardando...' : 'Aplicar Reseteo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GENERADOR RÁPIDO DE CLAVES */}
      {isGenModalOpen && (
        <div
          onClick={onCloseGen}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fadeIn"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/10 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>Generador de Contraseñas Seguras</span>
              </h2>
              <button
                type="button"
                onClick={onCloseGen}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-[#1A1E29] p-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-center space-y-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-medium">
                Contraseña Generada
              </span>
              <div className="font-mono text-base font-bold text-sky-600 dark:text-sky-400 select-all break-all tracking-wider">
                {generatedQuickPass}
              </div>
              <button
                type="button"
                onClick={() => onCopyText(generatedQuickPass, 'Contraseña')}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs cursor-pointer transition-colors shadow-xs"
              >
                {copiedId === 'gen-Contraseña' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'gen-Contraseña' ? 'Copiada' : 'Copiar al portapapeles'}</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span>Longitud de caracteres:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">{genLength} caracteres</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="24"
                  value={genLength}
                  onChange={(e) => {
                    const l = Number(e.target.value);
                    setGenLength(l);
                    setGeneratedQuickPass(generateVaultPassword(l, genIncludeSpecial, genIncludeNumbers));
                  }}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={genIncludeSpecial}
                    onChange={(e) => {
                      setGenIncludeSpecial(e.target.checked);
                      setGeneratedQuickPass(generateVaultPassword(genLength, e.target.checked, genIncludeNumbers));
                    }}
                    className="w-4 h-4 rounded accent-sky-600 cursor-pointer"
                  />
                  <span>Incluir caracteres especiales (!@#$%&*)</span>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={genIncludeNumbers}
                    onChange={(e) => {
                      setGenIncludeNumbers(e.target.checked);
                      setGeneratedQuickPass(generateVaultPassword(genLength, genIncludeSpecial, e.target.checked));
                    }}
                    className="w-4 h-4 rounded accent-sky-600 cursor-pointer"
                  />
                  <span>Incluir números (0-9)</span>
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center gap-2 border-t border-slate-200/80 dark:border-white/[0.08] flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setGeneratedQuickPass(generateVaultPassword(genLength, genIncludeSpecial, genIncludeNumbers))
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#222735] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Generar Otra</span>
              </button>

              <button
                type="button"
                onClick={() => onUseGeneratedPassForUser(generatedQuickPass)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                + Usar y Registrar Usuario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DESBLOQUEO DE BÓVEDA TI (PIN / CONTRASEÑA DE SESIÓN) */}
      {isUnlockModalOpen && (
        <div
          onClick={onCloseUnlock}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fadeIn"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/10 rounded-2xl max-w-sm w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/25">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Verificación de Seguridad</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Desbloquea para ver y copiar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseUnlock}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {hasSecurityPin ? (
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-[#1A1E29] rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockMode('pin');
                    setUnlockError('');
                  }}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    unlockMode === 'pin'
                      ? 'bg-white dark:bg-[#222735] text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  PIN de 4 Dígitos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnlockMode('password');
                    setUnlockError('');
                  }}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    unlockMode === 'password'
                      ? 'bg-white dark:bg-[#222735] text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Contraseña de Sesión
                </button>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Ingresa tu contraseña de sesión para desbloquear. Luego podrás configurar un PIN de 4 dígitos para un
                  acceso más ágil.
                </p>
              </div>
            )}

            {unlockError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{unlockError}</span>
              </div>
            )}

            <form onSubmit={onVerifyUnlock} className="space-y-4">
              {unlockMode === 'pin' && hasSecurityPin ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 text-center">
                    Ingresa tu PIN de Seguridad (4-8 dígitos)
                  </label>
                  <input
                    type="password"
                    maxLength={8}
                    required
                    autoFocus
                    placeholder="••••"
                    value={unlockPinInput}
                    onChange={(e) => setUnlockPinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono py-2.5 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Contraseña de tu cuenta en Bitácora
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    placeholder="Tu contraseña de usuario"
                    value={unlockPasswordInput}
                    onChange={(e) => setUnlockPasswordInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>La sesión segura dura 15 minutos</span>
                <span className="font-mono">5 intentos / 15 min</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseUnlock}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={unlocking}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {unlocking ? 'Verificando...' : 'Desbloquear Bóveda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURAR PIN DE SEGURIDAD */}
      {isPinConfigModalOpen && (
        <div
          onClick={onClosePinConfig}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fadeIn"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/10 rounded-2xl max-w-sm w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/25">
                  <Key className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {hasSecurityPin ? 'Cambiar PIN de Bóveda' : 'Configurar PIN de Bóveda'}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Acceso rápido a contraseñas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClosePinConfig}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pinConfigError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pinConfigError}</span>
              </div>
            )}

            <form onSubmit={onSavePin} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Contraseña de inicio de sesión actual *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Tu clave actual en Bitácora"
                  value={pinCurrentPass}
                  onChange={(e) => setPinCurrentPass(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nuevo PIN (4 a 8 dígitos numéricos) *
                </label>
                <input
                  type="password"
                  maxLength={8}
                  required
                  placeholder="ej. 1234"
                  value={pinNewPin}
                  onChange={(e) => setPinNewPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.4em] font-mono py-2 text-base rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirmar Nuevo PIN *
                </label>
                <input
                  type="password"
                  maxLength={8}
                  required
                  placeholder="Confirma el mismo PIN"
                  value={pinConfirmPin}
                  onChange={(e) => setPinConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.4em] font-mono py-2 text-base rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={onClosePinConfig}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPin}
                  className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {savingPin ? 'Guardando...' : 'Guardar PIN de Seguridad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

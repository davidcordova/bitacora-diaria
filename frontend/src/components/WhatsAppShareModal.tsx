import React, { useState, useMemo } from 'react';
import {
  X,
  MessageCircle,
  UserCheck,
  Users,
  Phone,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Send,
} from 'lucide-react';
import { Bitacora, User, Team } from '../types';
import { generateSummaryText, copyToClipboard } from '../utils/formatters';
import { useModalBehavior } from '../hooks/useModalBehavior';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  bitacora: Bitacora;
  currentUser: User | null;
  users: User[];
  teams: Team[];
}

type RecipientMode = 'lider' | 'colaborador' | 'particular';

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  bitacora,
  currentUser,
  users,
  teams,
}) => {
  useModalBehavior(isOpen, onClose);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('lider');
  const [selectedColabId, setSelectedColabId] = useState<number | ''>('');
  const [customPhone, setCustomPhone] = useState('');
  const [customName, setCustomName] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Generate formatted text
  const messageText = useMemo(() => {
    return generateSummaryText(bitacora);
  }, [bitacora]);

  // Find user's team leader
  const teamLeader = useMemo(() => {
    // 1. Check if currentUser belongs to a team with a defined leader
    const userTeamId = currentUser?.team_id || bitacora.team_id;
    if (userTeamId) {
      const team = teams.find((t) => t.id === userTeamId);
      if (team && team.lider_id) {
        const found = users.find((u) => u.id === team.lider_id);
        if (found) return found;
      }
    }
    // 2. Fallback: find any leader user or admin
    return users.find((u) => u.role === 'lider' || u.is_leader) || users.find((u) => u.role === 'admin') || null;
  }, [currentUser, bitacora, teams, users]);

  // Determine current active recipient info
  const activeRecipient = useMemo(() => {
    if (recipientMode === 'lider') {
      return {
        name: teamLeader?.full_name || 'Líder de Equipo',
        phone: teamLeader?.phone || '51987654321',
        role: teamLeader?.role || 'lider',
      };
    }
    if (recipientMode === 'colaborador') {
      const colab = users.find((u) => u.id === selectedColabId);
      return {
        name: colab?.full_name || 'Selecciona colaborador',
        phone: colab?.phone || '',
        role: colab?.role || 'colaborador',
      };
    }
    return {
      name: customName.trim() || 'Contacto Particular',
      phone: customPhone.trim(),
      role: 'particular',
    };
  }, [recipientMode, teamLeader, selectedColabId, customName, customPhone, users]);

  // Clean phone for WhatsApp: remove non-digits; if 9 digits (standard Peru mobile), prepend 51
  const cleanPhone = useMemo(() => {
    const raw = (activeRecipient.phone || '').replace(/\D/g, '');
    if (!raw) return '';
    if (raw.length === 9) {
      return `51${raw}`;
    }
    return raw;
  }, [activeRecipient.phone]);

  const isValidPhone = cleanPhone.length >= 8;

  const whatsappUrl = useMemo(() => {
    if (!cleanPhone) return '';
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
  }, [cleanPhone, messageText]);

  if (!isOpen) return null;

  const handleOpenWhatsApp = () => {
    if (!whatsappUrl) return;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    if (!whatsappUrl) return;
    await copyToClipboard(whatsappUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyMessage = async () => {
    await copyToClipboard(messageText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-[#161922] rounded-2xl sm:rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200/90 dark:border-white/[0.08] flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] my-auto">
        {/* Header */}
        <div className="bg-slate-50 dark:bg-[#1E222D] px-4 sm:px-6 py-3.5 sm:py-4 text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 shrink-0">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">Enviar Bitácora por WhatsApp</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Selecciona el destinatario o introduce un número de contacto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200/60 dark:hover:bg-[#232836] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 space-y-4 sm:space-y-5 flex-1">
          {/* Mode Selector */}
          <div>
            <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Destinatario
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {/* Option 1: Líder */}
              <button
                type="button"
                onClick={() => setRecipientMode('lider')}
                className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  recipientMode === 'lider'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-2 ring-sky-500/20 shadow-xs font-bold'
                    : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#1E222D] hover:bg-slate-100 dark:hover:bg-[#232836] text-slate-600 dark:text-slate-300'
                }`}
              >
                <ShieldCheck
                  className={`w-5 h-5 mb-1.5 ${
                    recipientMode === 'lider' ? 'text-sky-500' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="text-xs font-bold leading-tight">Líder de Equipo</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Jefe directo</span>
              </button>

              {/* Option 2: Colaborador */}
              <button
                type="button"
                onClick={() => setRecipientMode('colaborador')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  recipientMode === 'colaborador'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-2 ring-sky-500/20 shadow-xs font-bold'
                    : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#1E222D] hover:bg-slate-100 dark:hover:bg-[#232836] text-slate-600 dark:text-slate-300'
                }`}
              >
                <Users
                  className={`w-5 h-5 mb-1.5 ${
                    recipientMode === 'colaborador' ? 'text-sky-500' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="text-xs font-bold leading-tight">Colaborador</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Del equipo</span>
              </button>

              {/* Option 3: Particular */}
              <button
                type="button"
                onClick={() => setRecipientMode('particular')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  recipientMode === 'particular'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-2 ring-sky-500/20 shadow-xs font-bold'
                    : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#1E222D] hover:bg-slate-100 dark:hover:bg-[#232836] text-slate-600 dark:text-slate-300'
                }`}
              >
                <Phone
                  className={`w-5 h-5 mb-1.5 ${
                    recipientMode === 'particular' ? 'text-sky-500' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="text-xs font-bold leading-tight">Otro Número</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Personalizado</span>
              </button>
            </div>
          </div>

          {/* Configuration for selected mode */}
          <div className="bg-slate-50/80 dark:bg-[#1E222D] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-3">
            {recipientMode === 'lider' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Líder asignado:</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {teamLeader ? teamLeader.full_name : 'No asignado'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Número de WhatsApp:</span>
                  <span className="text-xs font-mono font-bold text-[#00A88B] dark:text-sky-400">
                    {teamLeader?.phone ? teamLeader.phone : '+51 987 654 321 (por defecto)'}
                  </span>
                </div>
                {teamLeader?.team_name && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-white/[0.08]">
                    Equipo: {teamLeader.team_name}
                  </div>
                )}
              </div>
            )}

            {recipientMode === 'colaborador' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Selecciona el colaborador a contactar:
                </label>
                <select
                  value={selectedColabId}
                  onChange={(e) => setSelectedColabId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-white dark:bg-[#161922] text-xs text-slate-800 dark:text-slate-100 rounded-xl border border-slate-300 dark:border-white/[0.08] focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-hidden transition-all"
                >
                  <option value="" className="dark:bg-[#1E222D]">-- Elige un colaborador --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="dark:bg-[#1E222D]">
                      {u.full_name} ({u.role}) {u.phone ? `• ${u.phone}` : '• Sin teléfono'}
                    </option>
                  ))}
                </select>
                {selectedColabId && !activeRecipient.phone && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-800/60">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Este colaborador no tiene un teléfono registrado. Puedes ingresar uno abajo en "Otro Número".</span>
                  </div>
                )}
              </div>
            )}

            {recipientMode === 'particular' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre o Referencia (Opcional):
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ej: Gerencia, Cliente, Auditor..."
                    className="w-full px-3 py-2 bg-white dark:bg-[#161922] text-xs text-slate-800 dark:text-slate-100 rounded-xl border border-slate-300 dark:border-white/[0.08] focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-hidden transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Número de WhatsApp (con o sin +51):
                  </label>
                  <div className="flex gap-2 items-center">
                    <span className="px-3 py-2 bg-slate-200/80 dark:bg-[#232836] text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold select-none">
                      +51
                    </span>
                    <input
                      type="tel"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="987654321"
                      className="flex-1 px-3 py-2 bg-white dark:bg-[#161922] text-xs font-mono text-slate-800 dark:text-slate-100 rounded-xl border border-slate-300 dark:border-white/[0.08] focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-hidden transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Si ingresas un móvil de 9 dígitos de Perú, el código país 51 se agregará automáticamente.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Generated Link Card */}
          <div className="bg-sky-500/5 dark:bg-sky-500/5 border border-sky-500/20 dark:border-sky-500/20 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-sky-500" />
                Destino listo: {activeRecipient.name}
              </span>
              <span className="font-mono text-[11px] text-[#00A88B] dark:text-sky-400 bg-white dark:bg-[#161922] px-2.5 py-0.5 rounded-full font-bold border border-sky-500/30 shadow-2xs">
                {cleanPhone ? `+${cleanPhone}` : 'Número pendiente'}
              </span>
            </div>

            {/* Message Preview Accordion */}
            <div className="pt-2 border-t border-sky-500/20">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Mensaje a enviar:</div>
              <div className="max-h-20 sm:max-h-28 overflow-y-auto bg-white dark:bg-[#161922] p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-all">
                {messageText}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-[#1E222D] border-t border-slate-200/80 dark:border-white/[0.08] space-y-2 shrink-0">
          {/* Main WhatsApp Open Button */}
          <a
            href={isValidPhone ? whatsappUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!isValidPhone) {
                e.preventDefault();
              }
            }}
            className={`w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] ${
              !isValidPhone ? 'opacity-50 pointer-events-none' : ''
            } text-white py-2.5 sm:py-3 px-4 rounded-full text-xs sm:text-sm font-bold shadow-md shadow-sky-600/20 dark:shadow-sky-600/15 transition-all cursor-pointer min-h-[40px]`}
          >
            <Send className="w-4 h-4 shrink-0" />
            <span className="truncate">Enviar por WhatsApp a {activeRecipient.name}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
          </a>

          {/* Secondary Copy buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!isValidPhone}
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 bg-white dark:bg-[#161922] hover:bg-slate-100 dark:hover:bg-[#232836] border border-slate-200 dark:border-white/[0.08] py-2 sm:py-2.5 px-2.5 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 transition-all cursor-pointer disabled:opacity-50 min-h-[36px]"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate">¡Enlace copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Copiar enlace WA</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyMessage}
              className="flex items-center justify-center gap-1.5 bg-white dark:bg-[#161922] hover:bg-slate-100 dark:hover:bg-[#232836] border border-slate-200 dark:border-white/[0.08] py-2 sm:py-2.5 px-2.5 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 transition-all cursor-pointer min-h-[36px]"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate">¡Texto copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Copiar texto</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

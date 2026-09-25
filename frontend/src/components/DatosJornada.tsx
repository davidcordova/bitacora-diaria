import React from 'react';
import { Calendar, Clock, User, Building2 } from 'lucide-react';
import { User as UserType } from '../types';
import { AREAS } from '../utils/initialData';

interface DatosJornadaProps {
  fecha: string;
  horaInicio: string;
  colaborador: string;
  area: string;
  users: UserType[];
  onChange: (field: string, value: string) => void;
}

export const DatosJornada: React.FC<DatosJornadaProps> = ({
  fecha,
  horaInicio,
  colaborador,
  area,
  users,
  onChange,
}) => {
  return (
    <div className="saas-card p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-4 text-slate-800 dark:text-slate-100">
        <div className="p-2 rounded-xl bg-[#00F0FF]/15 text-[#0090A0] dark:text-[#00F0FF] border border-[#00F0FF]/30">
          <Calendar className="w-5 h-5 text-[#00A3BF] dark:text-[#00F0FF]" />
        </div>
        <h2 className="text-base sm:text-lg font-bold">1. Datos de la jornada</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fecha */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Fecha <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={fecha}
              onChange={(e) => onChange('fecha', e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] focus:bg-white dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-2 focus:ring-[#00F0FF]/20 outline-hidden transition-all"
              required
            />
          </div>
        </div>

        {/* Hora de inicio */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Hora de inicio <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
          </label>
          <div className="relative">
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => onChange('hora_inicio', e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] focus:bg-white dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-2 focus:ring-[#00F0FF]/20 outline-hidden transition-all"
              placeholder="08:00"
            />
            <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Colaborador */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Colaborador <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              value={colaborador}
              onChange={(e) => onChange('colaborador', e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] focus:bg-white dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-2 focus:ring-[#00F0FF]/20 outline-hidden transition-all appearance-none cursor-pointer"
              required
            >
              {users.map((u) => (
                <option key={u.id} value={u.full_name} className="bg-white dark:bg-[#161722]">
                  {u.full_name}
                </option>
              ))}
              {/* Opción personalizada si el valor no está en la lista */}
              {!users.some((u) => u.full_name === colaborador) && (
                <option value={colaborador} className="bg-white dark:bg-[#161722]">{colaborador}</option>
              )}
            </select>
            <User className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Área */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Área <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              value={area}
              onChange={(e) => onChange('area', e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] focus:bg-white dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-2 focus:ring-[#00F0FF]/20 outline-hidden transition-all appearance-none cursor-pointer"
              required
            >
              {AREAS.map((a) => (
                <option key={a} value={a} className="bg-white dark:bg-[#161722]">
                  {a}
                </option>
              ))}
            </select>
            <Building2 className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};

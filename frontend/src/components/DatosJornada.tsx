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
        <div className="p-2 rounded-xl bg-mint-50 dark:bg-teal-950/50 text-[#00A88B] dark:text-[#00C9A7]">
          <Calendar className="w-5 h-5" />
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
              className="w-full pl-3 pr-8 py-2.5 bg-slate-50/50 dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-[#00C9A7] focus:ring-2 focus:ring-mint-100 outline-hidden transition-all"
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
              className="w-full pl-3 pr-8 py-2.5 bg-slate-50/50 dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-[#00C9A7] focus:ring-2 focus:ring-mint-100 outline-hidden transition-all"
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
              className="w-full pl-3 pr-8 py-2.5 bg-slate-50/50 dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-[#00C9A7] focus:ring-2 focus:ring-mint-100 outline-hidden transition-all appearance-none"
              required
            >
              {users.map((u) => (
                <option key={u.id} value={u.full_name}>
                  {u.full_name}
                </option>
              ))}
              {/* Opción personalizada si el valor no está en la lista */}
              {!users.some((u) => u.full_name === colaborador) && (
                <option value={colaborador}>{colaborador}</option>
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
              className="w-full pl-3 pr-8 py-2.5 bg-slate-50/50 dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-[#00C9A7] focus:ring-2 focus:ring-mint-100 outline-hidden transition-all appearance-none"
              required
            >
              {AREAS.map((a) => (
                <option key={a} value={a}>
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

import React, { useState, useEffect } from 'react';
import { Settings, X, Building2, Server, Briefcase, Tag, Trash2 } from 'lucide-react';
import { ItEmpresa, ItPlataforma, ItCargo } from '../../types';
import { api } from '../../services/api';
import { confirmDialog } from '../DialogHost';
import { TIPO_SERVICIOS_PRESET } from './VaultConstants';

export type CatalogTabType = 'empresas' | 'plataformas' | 'cargos';

interface VaultCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab: CatalogTabType;
  empresas: ItEmpresa[];
  plataformasCatalog: ItPlataforma[];
  cargosCatalog: ItCargo[];
  onCatalogsChanged: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const VaultCatalogModal: React.FC<VaultCatalogModalProps> = ({
  isOpen,
  onClose,
  initialTab,
  empresas,
  plataformasCatalog,
  cargosCatalog,
  onCatalogsChanged,
  onShowToast,
}) => {
  const [catalogTab, setCatalogTab] = useState<CatalogTabType>(initialTab);
  const [newPlatNombre, setNewPlatNombre] = useState('');
  const [newPlatTipo, setNewPlatTipo] = useState('Correo Corporativo');
  const [newCargoNombre, setNewCargoNombre] = useState('');
  const [newCargoArea, setNewCargoArea] = useState('Marketing');
  const [newEmpresaNombre, setNewEmpresaNombre] = useState('');
  const [newEmpresaColor, setNewEmpresaColor] = useState('#0284C7');
  const [newMarcaNombre, setNewMarcaNombre] = useState('');
  const [newMarcaEmpresaId, setNewMarcaEmpresaId] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setCatalogTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleCreateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpresaNombre.trim()) return;
    try {
      await api.createItEmpresa({ nombre: newEmpresaNombre.trim(), color: newEmpresaColor });
      setNewEmpresaNombre('');
      onShowToast?.('Empresa creada con éxito', 'success');
      onCatalogsChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al crear empresa', 'error');
    }
  };

  const handleDeleteEmpresa = async (id: number) => {
    if (!(await confirmDialog('¿Eliminar esta empresa y todas sus marcas asociadas?'))) return;
    try {
      await api.deleteItEmpresa(id);
      onShowToast?.('Empresa eliminada', 'info');
      onCatalogsChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al eliminar', 'error');
    }
  };

  const handleCreateMarca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarcaNombre.trim() || !newMarcaEmpresaId) {
      onShowToast?.('Selecciona una empresa e ingresa el nombre de la marca', 'error');
      return;
    }
    try {
      await api.createItMarca({ empresa_id: newMarcaEmpresaId, nombre: newMarcaNombre.trim() });
      setNewMarcaNombre('');
      onShowToast?.('Marca añadida a la empresa', 'success');
      onCatalogsChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al crear marca', 'error');
    }
  };

  const handleDeleteMarca = async (id: number) => {
    if (!(await confirmDialog('¿Eliminar esta marca?'))) return;
    try {
      await api.deleteItMarca(id);
      onShowToast?.('Marca eliminada', 'info');
      onCatalogsChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al eliminar', 'error');
    }
  };

  const handleCreatePlataforma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlatNombre.trim()) return;
    try {
      await api.createItPlataforma({ nombre: newPlatNombre.trim(), tipo_servicio: newPlatTipo });
      setNewPlatNombre('');
      onShowToast?.('Plataforma agregada al catálogo', 'success');
      onCatalogsChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al crear plataforma', 'error');
    }
  };

  const handleDeletePlataforma = async (id: number) => {
    if (!(await confirmDialog('¿Eliminar esta plataforma del catálogo maestro?'))) return;
    try {
      await api.deleteItPlataforma(id);
      onShowToast?.('Plataforma eliminada', 'info');
      onCatalogsChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al eliminar', 'error');
    }
  };

  const handleCreateCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCargoNombre.trim()) return;
    try {
      await api.createItCargo({ nombre: newCargoNombre.trim(), area: newCargoArea.trim() });
      setNewCargoNombre('');
      onShowToast?.('Cargo agregado al catálogo', 'success');
      onCatalogsChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al crear cargo', 'error');
    }
  };

  const handleDeleteCargo = async (id: number) => {
    if (!(await confirmDialog('¿Eliminar este cargo del catálogo maestro?'))) return;
    try {
      await api.deleteItCargo(id);
      onShowToast?.('Cargo eliminado', 'info');
      onCatalogsChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al eliminar', 'error');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fadeIn"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/10 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <span>Gestión de Catálogos TI</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Pestaña del Catálogo */}
        <div className="flex items-center bg-slate-100 dark:bg-[#1A1E29] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setCatalogTab('empresas')}
            className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              catalogTab === 'empresas'
                ? 'bg-white dark:bg-[#222735] text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Empresas & Marcas ({empresas.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setCatalogTab('plataformas')}
            className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              catalogTab === 'plataformas'
                ? 'bg-white dark:bg-[#222735] text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4 shrink-0" />
            <span>Plataformas ({plataformasCatalog.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setCatalogTab('cargos')}
            className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              catalogTab === 'cargos'
                ? 'bg-white dark:bg-[#222735] text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-4 h-4 shrink-0" />
            <span>Cargos & Áreas ({cargosCatalog.length})</span>
          </button>
        </div>

        {/* TAB 1: EMPRESAS & MARCAS */}
        {catalogTab === 'empresas' && (
          <div className="space-y-4 text-xs animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nueva Empresa */}
              <div className="bg-slate-50 dark:bg-[#1A1E29] p-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                  <Building2 className="w-3.5 h-3.5 text-sky-500" />
                  <span>Agregar Empresa</span>
                </h3>
                <form onSubmit={handleCreateEmpresa} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Nombre de la empresa"
                      value={newEmpresaNombre}
                      onChange={(e) => setNewEmpresaNombre(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <input
                      type="color"
                      value={newEmpresaColor}
                      onChange={(e) => setNewEmpresaColor(e.target.value)}
                      className="w-10 h-9 p-0.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E222D] cursor-pointer"
                      title="Color corporativo"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer transition-colors"
                  >
                    + Guardar Empresa
                  </button>
                </form>
              </div>

              {/* Nueva Marca */}
              <div className="bg-slate-50 dark:bg-[#1A1E29] p-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                  <Tag className="w-3.5 h-3.5 text-sky-500" />
                  <span>Agregar Marca</span>
                </h3>
                <form onSubmit={handleCreateMarca} className="space-y-2">
                  <select
                    required
                    value={newMarcaEmpresaId}
                    onChange={(e) => setNewMarcaEmpresaId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value={0}>Selecciona Empresa...</option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombre}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Nombre de la marca o sede"
                      value={newMarcaNombre}
                      onChange={(e) => setNewMarcaNombre(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-sky-600 dark:hover:bg-sky-700 text-white font-semibold cursor-pointer whitespace-nowrap transition-colors"
                    >
                      Vincular
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Listado */}
            <div className="space-y-2">
              <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs">
                Empresas Registradas:
              </span>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {empresas.map((emp) => (
                  <div
                    key={emp.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: emp.color || '#0284C7' }}
                        />
                        <span className="font-bold text-slate-900 dark:text-slate-100">{emp.nombre}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEmpresa(emp.id)}
                        className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer flex items-center justify-center"
                        title="Eliminar empresa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-5">
                      {emp.marcas && emp.marcas.length > 0 ? (
                        emp.marcas.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-[#222735] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10"
                          >
                            <span>{m.nombre}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteMarca(m.id)}
                              className="text-slate-400 hover:text-rose-500 ml-0.5 px-1 cursor-pointer"
                              title="Eliminar marca"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Sin marcas vinculadas</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PLATAFORMAS */}
        {catalogTab === 'plataformas' && (
          <div className="space-y-4 text-xs animate-fadeIn">
            <div className="bg-slate-50 dark:bg-[#1A1E29] p-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] space-y-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                <Server className="w-3.5 h-3.5 text-sky-500" />
                <span>Registrar Nueva Plataforma</span>
              </h3>
              <form onSubmit={handleCreatePlataforma} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="ej. Zimbra, Fortinet VPN, Odoo"
                  value={newPlatNombre}
                  onChange={(e) => setNewPlatNombre(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <select
                  value={newPlatTipo}
                  onChange={(e) => setNewPlatTipo(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {TIPO_SERVICIOS_PRESET.filter((t) => t !== 'Todos').map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer transition-colors"
                >
                  + Agregar Plataforma
                </button>
              </form>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs">
                Plataformas en el Sistema:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                {plataformasCatalog.map((plat) => (
                  <div
                    key={plat.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{plat.nombre}</div>
                      <span className="text-[10px] text-sky-600 dark:text-sky-400">{plat.tipo_servicio}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePlataforma(plat.id)}
                      className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer flex items-center justify-center"
                      title="Eliminar plataforma"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CARGOS / ÁREAS */}
        {catalogTab === 'cargos' && (
          <div className="space-y-4 text-xs animate-fadeIn">
            <div className="bg-slate-50 dark:bg-[#1A1E29] p-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] space-y-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
                <span>Registrar Nuevo Cargo / Puesto</span>
              </h3>
              <form onSubmit={handleCreateCargo} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="ej. Diseñador Gráfico, Contador"
                  value={newCargoNombre}
                  onChange={(e) => setNewCargoNombre(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="text"
                  placeholder="Área (ej. Marketing, Finanzas)"
                  value={newCargoArea}
                  onChange={(e) => setNewCargoArea(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer transition-colors"
                >
                  + Agregar Cargo
                </button>
              </form>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs">
                Cargos Disponibles ({cargosCatalog.length}):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                {cargosCatalog.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{c.nombre}</div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        Área: {c.area || 'General'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCargo(c.id)}
                      className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer flex items-center justify-center"
                      title="Eliminar cargo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end border-t border-slate-200/80 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#222735] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

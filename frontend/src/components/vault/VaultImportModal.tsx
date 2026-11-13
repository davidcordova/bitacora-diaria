import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  X,
  HelpCircle,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Check,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../services/api';

interface ImportPreviewPayload {
  success: boolean;
  filename: string;
  total_filas: number;
  ready_count: number;
  update_count: number;
  invalid_count: number;
  rows: any[];
}

interface VaultImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: number;
  isDownloadingTemplate: boolean;
  onDownloadTemplate: () => void;
  onImported: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const VaultImportModal: React.FC<VaultImportModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  isDownloadingTemplate,
  onDownloadTemplate,
  onImported,
  onShowToast,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewPayload | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'crear_o_actualizar' | 'solo_nuevos'>('crear_o_actualizar');
  const [filterPreviewStatus, setFilterPreviewStatus] = useState<'todos' | 'ready' | 'update' | 'invalid'>('todos');

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPreviewData(null);
      setFilterPreviewStatus('todos');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const processImportFile = async (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      onShowToast?.('Por favor selecciona un archivo Excel (.xlsx, .xls) o CSV (.csv)', 'error');
      return;
    }

    setSelectedFile(file);
    setIsLoadingPreview(true);
    setPreviewData(null);
    try {
      const preview = await api.previewItPlatformUsersImport(file);
      setPreviewData(preview);
      onShowToast?.(
        `Archivo analizado: ${preview.total_filas} filas detectadas (${preview.ready_count} nuevas, ${preview.update_count} a actualizar)`,
        'info'
      );
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al analizar archivo', 'error');
      setSelectedFile(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImportFile(file);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !previewData.rows?.length) return;
    const validRows = previewData.rows.filter((r) => r.status !== 'invalid');
    if (validRows.length === 0) {
      onShowToast?.('No hay filas válidas para importar en este archivo', 'error');
      return;
    }

    try {
      setIsImporting(true);
      const res = await api.importItPlatformUsers({
        rows: validRows,
        modo: importMode,
        created_by: currentUserId,
      });
      onShowToast?.(res.mensaje || 'Importación procesada con éxito', 'success');
      onImported();
      onClose();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al importar datos', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fadeIn"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/10 rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Importación Masiva de Cuentas por Plataforma
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Carga múltiples cuentas de colaboradores mediante archivo Excel (.xlsx) o delimitado (.csv)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer transition-colors flex items-center justify-center shrink-0"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Scrolleable */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          <div className="bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  ¿Aún no tienes el formato estructurado?
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Descarga nuestra plantilla oficial con columnas obligatorias, catálogos y filas de ejemplo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onDownloadTemplate}
              disabled={isDownloadingTemplate}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloadingTemplate ? 'Descargando...' : 'Descargar Plantilla (.xlsx)'}</span>
            </button>
          </div>

          {/* Dropzone */}
          <div className="relative">
            <input
              type="file"
              id="excel-file-upload-input"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {!selectedFile ? (
              <label
                htmlFor="excel-file-upload-input"
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-emerald-500 dark:hover:border-emerald-400 rounded-xl bg-slate-50/50 dark:bg-[#1A1E29]/60 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors cursor-pointer text-center group"
              >
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Haz clic para seleccionar tu archivo Excel o CSV
                </p>
                <p className="text-xs text-slate-400">
                  Formatos compatibles: Microsoft Excel (.xlsx, .xls) o archivo CSV (.csv)
                </p>
              </label>
            ) : (
              <div className="bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="text-xs min-w-0">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block text-sm truncate">
                      {selectedFile.name}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Archivo cargado
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="excel-file-upload-input"
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#222735] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    Cambiar archivo
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewData(null);
                    }}
                    className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center justify-center"
                    title="Quitar archivo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {isLoadingPreview && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin" />
              <p className="text-xs font-medium">
                Analizando filas y cotejando cuentas con la base de datos...
              </p>
            </div>
          )}

          {previewData && !isLoadingPreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/[0.08]">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Total detectadas</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {previewData.total_filas}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25">
                  <span className="text-emerald-700 dark:text-emerald-400 text-[11px] block">Nuevas (Crear)</span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {previewData.ready_count}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25">
                  <span className="text-amber-700 dark:text-amber-400 text-[11px] block">Existentes (Actualizar)</span>
                  <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
                    {previewData.update_count}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25">
                  <span className="text-rose-700 dark:text-rose-400 text-[11px] block">Incompletas / Error</span>
                  <span className="text-lg font-bold text-rose-700 dark:text-rose-300">
                    {previewData.invalid_count}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#1A1E29] p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] space-y-2 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Política de Sincronización para Cuentas Existentes:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      importMode === 'crear_o_actualizar'
                        ? 'bg-white dark:bg-[#222735] border-sky-500 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="crear_o_actualizar"
                      checked={importMode === 'crear_o_actualizar'}
                      onChange={() => setImportMode('crear_o_actualizar')}
                      className="mt-0.5 accent-sky-600"
                    />
                    <div>
                      <span className="font-semibold block">Actualizar datos existentes (Recomendado)</span>
                      <span className="text-[11px] text-slate-400">
                        Actualiza cargo, correo, teléfono y contraseña si coincide en Empresa, Plataforma y Usuario.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      importMode === 'solo_nuevos'
                        ? 'bg-white dark:bg-[#222735] border-sky-500 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="solo_nuevos"
                      checked={importMode === 'solo_nuevos'}
                      onChange={() => setImportMode('solo_nuevos')}
                      className="mt-0.5 accent-sky-600"
                    />
                    <div>
                      <span className="font-semibold block">Solo registrar cuentas nuevas</span>
                      <span className="text-[11px] text-slate-400">
                        Ignora los usuarios que ya existan en la plataforma sin modificar sus registros actuales.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Vista previa de datos a procesar:
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {(['todos', 'ready', 'update', 'invalid'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterPreviewStatus(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        filterPreviewStatus === st
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#222735]'
                      }`}
                    >
                      {st === 'todos' && `Todas (${previewData.total_filas})`}
                      {st === 'ready' && `Nuevas (${previewData.ready_count})`}
                      {st === 'update' && `Actualizar (${previewData.update_count})`}
                      {st === 'invalid' && `Errores (${previewData.invalid_count})`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden max-h-56 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Estado</th>
                      <th className="p-2.5">Empresa</th>
                      <th className="p-2.5">Plataforma</th>
                      <th className="p-2.5">Colaborador</th>
                      <th className="p-2.5">Usuario Login</th>
                      <th className="p-2.5">Contraseña</th>
                      <th className="p-2.5">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-slate-700 dark:text-slate-300">
                    {previewData.rows
                      .filter((r) => filterPreviewStatus === 'todos' || r.status === filterPreviewStatus)
                      .map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                          <td className="p-2.5 font-mono text-[11px] text-slate-400">{row.index}</td>
                          <td className="p-2.5 whitespace-nowrap">
                            {row.status === 'ready' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25">
                                <Check className="w-3 h-3" /> Nueva
                              </span>
                            )}
                            {row.status === 'update' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25">
                                <RotateCcw className="w-3 h-3" /> Existente
                              </span>
                            )}
                            {row.status === 'invalid' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/25">
                                <AlertTriangle className="w-3 h-3" /> Error
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-medium whitespace-nowrap">{row.empresa || '-'}</td>
                          <td className="p-2.5 font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                            {row.plataforma || '-'}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">{row.colaborador_nombre || '-'}</td>
                          <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">{row.usuario_login || '-'}</td>
                          <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">
                            {row.password_actual ? '••••••••' : <span className="text-slate-400 italic">(Autogenerar)</span>}
                          </td>
                          <td
                            className="p-2.5 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate"
                            title={row.status_message}
                          >
                            {row.status_message}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Las contraseñas se guardan cifradas (Fernet: AES-128 + HMAC-SHA256).</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] font-semibold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!previewData || isImporting || (previewData.ready_count === 0 && previewData.update_count === 0)}
              onClick={handleConfirmImport}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importando datos...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    Confirmar e Importar{' '}
                    {previewData
                      ? previewData.ready_count + (importMode === 'crear_o_actualizar' ? previewData.update_count : 0)
                      : 0}{' '}
                    Cuentas
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

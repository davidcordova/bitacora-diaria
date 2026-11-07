import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Globe,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';
import { confirmDialog, alertDialog } from './DialogHost';

interface McpToolInfo {
  name: string;
  description: string;
}

export const McpIntegrationPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [accessMode, setAccessMode] = useState<'read_only' | 'read_write'>('read_only');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('••••••••••••');
  const [showKey, setShowKey] = useState(false);
  const [tools, setTools] = useState<McpToolInfo[]>([]);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);

  // Interactive tester state
  const [selectedTool, setSelectedTool] = useState('resumen_ejecutivo_equipo');
  const [testingTool, setTestingTool] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'mcp_http' | 'rest_openapi' | 'mcp_stdio'>('mcp_http');

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sistemasmkt.net.pe';
  const mcpEndpoint = `${originUrl}/api/mcp`;
  const restQueryEndpoint = `${originUrl}/api/mcp/query`;
  const openApiUrl = `${originUrl}/api/mcp/openapi.json`;

  const loadConfig = async () => {
    setLoading(true);
    try {
      const cfg = await api.getMcpConfig();
      setEnabled(cfg.enabled);
      setAccessMode(cfg.access_mode);
      setApiKey(cfg.api_key);
      setApiKeyMasked(cfg.api_key_masked);
      setTools(cfg.tools || []);
    } catch (err) {
      console.error('Error cargando configuración MCP:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTarget(label);
    setTimeout(() => setCopiedTarget(null), 2200);
  };

  const handleToggleEnabled = async (nextEnabled: boolean) => {
    setSaving(true);
    try {
      const updated = await api.updateMcpConfig({ enabled: nextEnabled });
      setEnabled(updated.enabled);
    } catch (err: any) {
      await alertDialog(err?.message || 'No se pudo actualizar el estado del servidor MCP');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeAccessMode = async (nextMode: 'read_only' | 'read_write') => {
    setSaving(true);
    try {
      const updated = await api.updateMcpConfig({ access_mode: nextMode });
      setAccessMode(updated.access_mode);
    } catch (err: any) {
      await alertDialog(err?.message || 'No se pudo cambiar el modo de acceso MCP');
    } finally {
      setSaving(false);
    }
  };

  const handleRotateKey = async () => {
    const ok = await confirmDialog({
      title: '¿Regenerar Clave MCP?',
      message:
        'La clave actual quedará invalidada de inmediato. Cualquier IA o agente conectado deberá actualizarse con la nueva clave.',
      confirmText: 'Sí, regenerar clave',
      danger: true,
    });
    if (!ok) return;

    setRotating(true);
    try {
      const res = await api.rotateMcpApiKey();
      setApiKey(res.api_key);
      setApiKeyMasked(res.api_key_masked);
      setShowKey(true);
    } catch (err: any) {
      await alertDialog(err?.message || 'Error al regenerar la clave MCP');
    } finally {
      setRotating(false);
    }
  };

  const handleRunLiveTest = async () => {
    setTestingTool(true);
    setTestOutput(null);
    try {
      const res = await api.testMcpTool(selectedTool, {});
      setTestOutput(JSON.stringify(res, null, 2));
    } catch (err: any) {
      setTestOutput(JSON.stringify({ error: err?.message || 'Fallo al ejecutar herramienta MCP' }, null, 2));
    } finally {
      setTestingTool(false);
    }
  };

  const displayedKey = showKey ? apiKey : apiKeyMasked || 'mcp_bita_••••••••••••';

  const snippetMcpHttp = JSON.stringify(
    {
      mcpServers: {
        'bitacora-mkt': {
          url: mcpEndpoint,
          headers: {
            Authorization: `Bearer ${showKey && apiKey ? apiKey : '<TU_MCP_API_KEY>'}`,
          },
        },
      },
    },
    null,
    2
  );

  const snippetCurlRest = `curl -X POST "${restQueryEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${showKey && apiKey ? apiKey : '<TU_MCP_API_KEY>'}" \\
  -d '{"tool": "resumen_ejecutivo_equipo", "arguments": {"periodo": "hoy"}}'`;

  const snippetMcpStdio = JSON.stringify(
    {
      mcpServers: {
        'bitacora-mkt': {
          command: 'python',
          args: ['backend/mcp_server.py'],
          env: {
            BITACORA_MCP_URL: mcpEndpoint,
            BITACORA_MCP_API_KEY: showKey && apiKey ? apiKey : '<TU_MCP_API_KEY>',
          },
        },
      },
    },
    null,
    2
  );

  return (
    <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-[#252636]">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-2xl bg-cyan-50 dark:bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] shrink-0 border border-[#00F0FF]/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Servidor MCP & Puente para Modelos de IA
              </h3>
              <span
                className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                  enabled
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                }`}
              >
                {enabled ? '● MCP Activo' : '○ Desactivado'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Conecta Claude, ChatGPT (Actions), Cursor, Antigravity, Gemini o flujos n8n para consultar en vivo el avance del equipo, horas por cliente y alertas operativas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => handleToggleEnabled(!enabled)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
              enabled
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs hover:bg-emerald-500'
                : 'bg-slate-100 dark:bg-[#161722] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#252636]'
            }`}
          >
            {enabled ? 'Servidor Habilitado' : 'Habilitar Servidor MCP'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400">Cargando configuración del servidor MCP...</div>
      ) : (
        <div className="space-y-5">
          {/* 1. Credenciales y Modo de Permisos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Endpoint & API Key */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161722] border border-slate-200/80 dark:border-[#252636] space-y-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Endpoint MCP (Streamable HTTP JSON-RPC)
                </span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#13141F] border border-slate-200 dark:border-[#252636] text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
                    {mcpEndpoint}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(mcpEndpoint, 'endpoint')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-[#13141F] border border-slate-200 dark:border-[#252636] text-slate-700 dark:text-slate-200 hover:border-cyan-500 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {copiedTarget === 'endpoint' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTarget === 'endpoint' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  OAuth Client ID (Para Gemini / Claude Web)
                </span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#13141F] border border-slate-200 dark:border-[#252636] text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
                    bitacora-mcp
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText('bitacora-mcp', 'clientid')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-[#13141F] border border-slate-200 dark:border-[#252636] text-slate-700 dark:text-slate-200 hover:border-cyan-500 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {copiedTarget === 'clientid' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTarget === 'clientid' ? 'Copiado' : 'Copiar ID'}</span>
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  OAuth Client Secret / MCP API Key
                </span>
                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                  <code className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#13141F] border border-slate-200 dark:border-[#252636] text-xs font-mono text-cyan-700 dark:text-[#00F0FF] truncate">
                    {displayedKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    title={showKey ? 'Ocultar clave' : 'Mostrar clave'}
                    className="p-1.5 rounded-lg bg-white dark:bg-[#13141F] border border-slate-200 dark:border-[#252636] text-slate-600 dark:text-slate-300 hover:border-cyan-500 cursor-pointer"
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(apiKey, 'apikey')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {copiedTarget === 'apikey' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTarget === 'apikey' ? 'Copiada' : 'Copiar Clave'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={rotating}
                    onClick={handleRotateKey}
                    title="Regenerar API Key"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${rotating ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Rotar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Permisos del Agente IA */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161722] border border-slate-200/80 dark:border-[#252636] flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                  Nivel de Acceso para Modelos de IA
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleChangeAccessMode('read_only')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      accessMode === 'read_only'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-200 dark:border-[#252636] bg-white dark:bg-[#13141F]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Solo Lectura (Recomendado)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      La IA puede consultar reportes, actividades, clientes y alertas sin modificar ningún registro.
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleChangeAccessMode('read_write')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      accessMode === 'read_write'
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-200 dark:border-[#252636] bg-white dark:bg-[#13141F]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Lectura y Escritura</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Permite además usar la herramienta <code className="font-mono">registrar_actividad_bitacora</code> desde otra IA.
                    </p>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span>Esquema OpenAPI 3.1 (ChatGPT / OpenWebUI):</span>
                <button
                  type="button"
                  onClick={() => copyText(openApiUrl, 'openapi')}
                  className="font-mono text-cyan-700 dark:text-[#00F0FF] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Globe className="w-3 h-3" />
                  <span>{copiedTarget === 'openapi' ? '¡URL Copiada!' : '/api/mcp/openapi.json'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Snippets de Conexión Rápida */}
          <div className="rounded-xl border border-slate-200 dark:border-[#252636] overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2.5 bg-slate-100/80 dark:bg-[#161722] border-b border-slate-200 dark:border-[#252636]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveSnippetTab('mcp_http')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    activeSnippetTab === 'mcp_http'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-[#1F2130]'
                  }`}
                >
                  MCP Remoto (Claude / Cursor / Antigravity)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSnippetTab('rest_openapi')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    activeSnippetTab === 'rest_openapi'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-[#1F2130]'
                  }`}
                >
                  API REST / n8n / Custom GPT (cURL)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSnippetTab('mcp_stdio')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    activeSnippetTab === 'mcp_stdio'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-[#1F2130]'
                  }`}
                >
                  MCP Local STDIO (Python)
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const raw =
                    activeSnippetTab === 'mcp_http'
                      ? snippetMcpHttp
                      : activeSnippetTab === 'rest_openapi'
                        ? snippetCurlRest
                        : snippetMcpStdio;
                  copyText(raw, 'snippet');
                }}
                className="text-xs font-bold text-cyan-700 dark:text-[#00F0FF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedTarget === 'snippet' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTarget === 'snippet' ? 'Configuración copiada' : 'Copiar bloque'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed">
              {activeSnippetTab === 'mcp_http'
                ? snippetMcpHttp
                : activeSnippetTab === 'rest_openapi'
                  ? snippetCurlRest
                  : snippetMcpStdio}
            </pre>
          </div>

          {/* 3. Catálogo de Herramientas + Probador en Vivo */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-[#161722]/70 border border-slate-200/80 dark:border-[#252636] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-[#00F0FF]" />
                  <span>Herramientas MCP Disponibles ({tools.length}) — Probador en Vivo</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Selecciona una herramienta para simular exactamente lo que otro modelo de IA recibirá al consultar tu sistema.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#13141F] border border-slate-200 dark:border-[#252636] text-slate-800 dark:text-slate-200 outline-none focus:border-cyan-500"
                >
                  {tools
                    .filter((t) => t.name !== 'registrar_actividad_bitacora')
                    .map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={testingTool}
                  onClick={handleRunLiveTest}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer shrink-0"
                >
                  {testingTool ? 'Consultando...' : 'Probar Consulta IA'}
                </button>
              </div>
            </div>

            {testOutput && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Respuesta Estructurada MCP ({selectedTool}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setTestOutput(null)}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Cerrar vista previa ✕
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 text-emerald-300 text-[11px] font-mono max-h-64 overflow-y-auto">
                  {testOutput}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


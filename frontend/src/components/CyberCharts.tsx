import React, { useState } from 'react';
import { formatDuration } from '../utils/formatters';

// ==========================================
// 1. SPLINE AREA CHART (LÍNEAS SUAVES CON ÁREA)
// ==========================================
interface SplineDataPoint {
  fecha: string;
  actividades: number;
  minutos: number;
  completadas?: number;
}

interface SplineAreaChartProps {
  data: SplineDataPoint[];
  metric?: 'actividades' | 'minutos';
  height?: number;
}

export const SplineAreaChart: React.FC<SplineAreaChartProps> = ({
  data,
  metric = 'actividades',
  height = 260,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-slate-400 dark:text-slate-500">
        No hay suficientes datos históricos para trazar la tendencia.
      </div>
    );
  }

  const padding = { top: 25, right: 30, bottom: 40, left: 45 };
  const width = 650;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => (metric === 'actividades' ? d.actividades : d.minutos));
  const maxVal = Math.max(...values, 5);
  const minVal = 0;

  // Generador de coordenadas X e Y
  const getX = (idx: number) => {
    if (data.length === 1) return padding.left + chartW / 2;
    return padding.left + (idx / (data.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    const range = maxVal - minVal || 1;
    return padding.top + chartH - ((val - minVal) / range) * chartH;
  };

  const points = data.map((d, i) => ({
    x: getX(i),
    y: getY(metric === 'actividades' ? d.actividades : d.minutos),
    raw: d,
  }));

  // Generador de curva Bézier Cúbica suave (Catmull-Rom to Cubic Bezier)
  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;

      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const linePath = buildSmoothPath(points);
  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`
    : '';

  // Formato de fecha para etiquetas X (ej: "21 Sep")
  const formatDateLabel = (f: string) => {
    try {
      const parts = f.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      }
    } catch {
      // fallback
    }
    return f;
  };

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          {/* Degradado Neón para el Área de Relleno */}
          <linearGradient id="cyberAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.32" />
            <stop offset="70%" stopColor="#8B5CF6" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#0B0C13" stopOpacity="0" />
          </linearGradient>

          {/* Filtro de resplandor neón */}
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Guías horizontales de fondo */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = padding.top + chartH * (1 - ratio);
          const val = Math.round(minVal + ratio * (maxVal - minVal));
          return (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartW}
                y2={y}
                stroke="currentColor"
                className="text-slate-200 dark:text-white/10"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 3}
                textAnchor="end"
                className="text-[10px] font-mono fill-slate-400 dark:fill-slate-500"
              >
                {metric === 'actividades' ? val : `${Math.round(val / 60)}h`}
              </text>
            </g>
          );
        })}

        {/* Área Sombreada con Curva Cúbica */}
        {areaPath && (
          <path d={areaPath} fill="url(#cyberAreaGrad)" className="transition-all duration-300" />
        )}

        {/* Línea Principal Brillante */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#00F0FF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#neonGlow)"
            className="transition-all duration-300"
          />
        )}

        {/* Marcadores de eje X */}
        {points.map((pt, i) => (
          <g key={i}>
            <text
              x={pt.x}
              y={padding.top + chartH + 20}
              textAnchor="middle"
              className={`text-[10px] font-semibold transition-colors ${
                hoveredIdx === i
                  ? 'fill-[#00F0FF] font-bold'
                  : 'fill-slate-500 dark:fill-slate-400'
              }`}
            >
              {formatDateLabel(pt.raw.fecha)}
            </text>
          </g>
        ))}

        {/* Puntos interactivos con anillos concéntricos */}
        {points.map((pt, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <g
              key={i}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
            >
              {/* Área invisible amplia para captura de mouse */}
              <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" />

              {/* Anillo exterior pulsante en hover */}
              {isHovered && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="10"
                  fill="#00F0FF"
                  fillOpacity="0.25"
                  className="animate-ping"
                />
              )}

              {/* Anillo medio */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 7 : 4.5}
                fill={isHovered ? '#00F0FF' : '#0B0C13'}
                stroke="#00F0FF"
                strokeWidth={isHovered ? 2.5 : 2}
                className="transition-all duration-200"
              />

              {/* Centro luminoso */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 3 : 2}
                fill="#FFFFFF"
              />
            </g>
          );
        })}

        {/* Línea vertical de tracking en hover */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={padding.top}
            x2={activePoint.x}
            y2={padding.top + chartH}
            stroke="#00F0FF"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            className="opacity-70 pointer-events-none"
          />
        )}
      </svg>

      {/* Tooltip flotante interactivo de alta fidelidad */}
      {activePoint && (
        <div
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full px-3.5 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-[#13141F]/95 backdrop-blur-md border border-[#00F0FF]/40 shadow-xl shadow-cyan-500/10 text-white transition-all duration-150"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${Math.max(10, (activePoint.y / height) * 100 - 12)}%`,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-xs shadow-cyan-400" />
            <span className="text-[11px] font-bold text-slate-200">
              {formatDateLabel(activePoint.raw.fecha)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block">Tareas</span>
              <span className="font-extrabold text-[#00F0FF] text-sm">
                {activePoint.raw.actividades}
              </span>
            </div>
            <div className="border-l border-slate-700 pl-3">
              <span className="text-slate-400 text-[10px] block">Horas</span>
              <span className="font-bold text-slate-100">
                {formatDuration(activePoint.raw.minutos)}
              </span>
            </div>
            {activePoint.raw.completadas !== undefined && (
              <div className="border-l border-slate-700 pl-3">
                <span className="text-slate-400 text-[10px] block">Completadas</span>
                <span className="font-bold text-emerald-400">
                  {activePoint.raw.completadas}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// ==========================================
// 2. GRADIENT BAR CHART (BARRAS CON DEGRADADO NEÓN)
// ==========================================
interface BarDataItem {
  label: string;
  value: number;
  secondaryValue?: number;
  sublabel?: string;
  color?: string;
}

interface GradientBarChartProps {
  data: BarDataItem[];
  valueFormatter?: (val: number) => string;
  height?: number;
}

export const GradientBarChart: React.FC<GradientBarChartProps> = ({
  data,
  valueFormatter = (val) => String(val),
  height = 240,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-slate-400 dark:text-slate-500">
        Sin datos de barras registrados.
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const padding = { top: 20, right: 20, bottom: 45, left: 35 };
  const width = 600;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const barCount = data.length;
  const step = chartW / barCount;
  const barWidth = Math.min(48, Math.max(22, step * 0.55));

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="cyberBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>

          <linearGradient id="cyberBarHoverGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3DF3FF" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>

        {/* Guías de fondo horizontales */}
        {[0, 0.33, 0.66, 1].map((ratio, idx) => {
          const y = padding.top + chartH * (1 - ratio);
          return (
            <line
              key={idx}
              x1={padding.left}
              y1={y}
              x2={padding.left + chartW}
              y2={y}
              stroke="currentColor"
              className="text-slate-200 dark:text-white/8"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          );
        })}

        {/* Barras verticales */}
        {data.map((item, idx) => {
          const x = padding.left + idx * step + (step - barWidth) / 2;
          const barH = (item.value / maxVal) * chartH;
          const y = padding.top + chartH - barH;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={idx}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setHoveredIdx(idx)}
            >
              {/* Área de barra de fondo sutil */}
              <rect
                x={x}
                y={padding.top}
                width={barWidth}
                height={chartH}
                rx="6"
                className="fill-slate-100/50 dark:fill-white/3"
              />

              {/* Barra Activa */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(4, barH)}
                rx="6"
                fill={isHovered ? 'url(#cyberBarHoverGrad)' : 'url(#cyberBarGradient)'}
                className="transition-all duration-300"
                style={{
                  filter: isHovered ? 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.45))' : 'none',
                }}
              />

              {/* Valor encima de la barra */}
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                className={`text-[10px] font-extrabold transition-colors ${
                  isHovered ? 'fill-[#00F0FF]' : 'fill-slate-700 dark:fill-slate-300'
                }`}
              >
                {valueFormatter(item.value)}
              </text>

              {/* Etiqueta del eje X */}
              <text
                x={x + barWidth / 2}
                y={padding.top + chartH + 18}
                textAnchor="middle"
                className={`text-[10px] font-semibold transition-colors ${
                  isHovered ? 'fill-[#00F0FF] font-bold' : 'fill-slate-500 dark:fill-slate-400'
                }`}
              >
                {item.label.length > 12 ? `${item.label.slice(0, 10)}..` : item.label}
              </text>

              {/* Subetiqueta (ej: % de completadas) */}
              {item.sublabel && (
                <text
                  x={x + barWidth / 2}
                  y={padding.top + chartH + 30}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-400 dark:fill-slate-500"
                >
                  {item.sublabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};


// ==========================================
// 3. CYBER DONUT / PASTEL CHART (DONA CON REMATES REDONDOS)
// ==========================================
interface DonutSlice {
  label: string;
  value: number;
  color?: string;
  sublabel?: string;
}

interface CyberDonutChartProps {
  data: DonutSlice[];
  centerTitle?: string;
  centerSubtitle?: string;
  valueFormatter?: (val: number) => string;
}

// Paleta Cyberpunk neón para rebanadas de dona
const CYBER_PALETTE = [
  '#00F0FF', // Electric Cyan
  '#EC4899', // Vivid Magenta
  '#8B5CF6', // Radiant Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#06B6D4', // Deep Cyan
  '#F43F5E', // Rose
  '#6366F1', // Indigo
];

export const CyberDonutChart: React.FC<CyberDonutChartProps> = ({
  data,
  centerTitle,
  centerSubtitle = 'Total',
  valueFormatter = (val) => String(val),
}) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0 || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-slate-400 dark:text-slate-500">
        Sin datos disponibles para graficar dona.
      </div>
    );
  }

  const size = 220;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Cálculo de los arcos de circunferencia usando strokeDasharray y strokeDashoffset
  let accumulatedAngle = 0;
  const slicesWithOffsets = data.map((item, idx) => {
    const fraction = item.value / total;
    const strokeDash = fraction * circumference;
    const offset = -accumulatedAngle;
    accumulatedAngle += strokeDash;
    const color = item.color || CYBER_PALETTE[idx % CYBER_PALETTE.length];
    const pct = Math.round(fraction * 100);

    return {
      ...item,
      color,
      fraction,
      strokeDash,
      offset,
      pct,
    };
  });

  const activeSlice = activeIdx !== null ? slicesWithOffsets[activeIdx] : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 w-full select-none">
      {/* Gráfico Circular SVG */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          {/* Anillo de fondo sombreado */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-white/5"
          />

          {/* Segmentos de la dona */}
          {slicesWithOffsets.map((slice, idx) => {
            const isHovered = activeIdx === idx;
            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${Math.max(0, slice.strokeDash - 4)} ${circumference}`}
                strokeDashoffset={slice.offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="cursor-pointer transition-all duration-300"
                style={{
                  filter: isHovered ? `drop-shadow(0 0 10px ${slice.color})` : 'none',
                }}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
              />
            );
          })}
        </svg>

        {/* Centro de telemetría de la dona */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest line-clamp-1">
            {activeSlice ? activeSlice.label : centerSubtitle}
          </span>
          <span
            className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading mt-0.5 transition-colors"
            style={{ color: activeSlice ? activeSlice.color : undefined }}
          >
            {activeSlice ? valueFormatter(activeSlice.value) : (centerTitle || valueFormatter(total))}
          </span>
          {activeSlice && (
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full mt-1"
              style={{
                backgroundColor: `${activeSlice.color}25`,
                color: activeSlice.color,
              }}
            >
              {activeSlice.pct}%
            </span>
          )}
        </div>
      </div>

      {/* Leyenda interactiva lateral */}
      <div className="flex-1 w-full space-y-2 max-h-[220px] overflow-y-auto pr-1">
        {slicesWithOffsets.map((slice, idx) => {
          const isHovered = activeIdx === idx;
          return (
            <div
              key={idx}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                isHovered
                  ? 'bg-slate-50 dark:bg-white/8 border-[#00F0FF]/40 shadow-xs'
                  : 'bg-transparent border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                  style={{
                    backgroundColor: slice.color,
                    boxShadow: isHovered ? `0 0 8px ${slice.color}` : 'none',
                  }}
                />
                <span
                  className={`font-semibold truncate ${
                    isHovered ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                  }`}
                  title={slice.label}
                >
                  {slice.label}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-slate-900 dark:text-white">
                  {valueFormatter(slice.value)}
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                  style={{
                    backgroundColor: `${slice.color}20`,
                    color: slice.color,
                  }}
                >
                  {slice.pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

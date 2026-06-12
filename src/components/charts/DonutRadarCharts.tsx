import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  clampIndex,
  describeArc,
  formatPercent,
  formatValue,
  type DonutChartProps,
  type RadarChartProps,
} from './chartPrimitiveUtils';

export function DonutChart({
  data,
  size = 250,
  thickness = 30,
}: DonutChartProps) {
  const reducedMotion = useReducedMotion();
  const [selectedIndex, setSelectedIndex] = useState(() => 0);
  const safeIndex = clampIndex(selectedIndex, data.length);
  const total = Math.max(1, data.reduce((sum, entry) => sum + entry.value, 0));
  const radius = size * 0.34;
  const center = size / 2;
  const arcs = useMemo(() => {
    let cursor = 0;

    return data.map((entry) => {
      const share = entry.value / total;
      const startAngle = cursor;
      const endAngle = cursor + Math.max(share * 360, entry.value > 0 ? 0.8 : 0);
      cursor = endAngle;

      return {
        ...entry,
        share,
        path: describeArc(center, center, radius, startAngle, endAngle),
        startAngle,
        endAngle,
      };
    });
  }, [center, data, radius, total]);

  const selected = data[safeIndex];

  return (
    <div className="space-y-4">
      {selected ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{selected.label}</p>
            <p className="text-xs text-muted-foreground">
              {formatValue(selected.value)} von {formatValue(total)} {formatPercent(selected.value / total)}
            </p>
          </div>
          <span className="rounded-full bg-background/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Vokabeln
          </span>
        </div>
      ) : null}

      <div className="relative mx-auto flex max-w-[18rem] items-center justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full overflow-visible">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--border) / 0.4)"
            strokeWidth={thickness}
          />

          {arcs.map((arc, index) => (
            <motion.path
              key={arc.label}
              d={arc.path}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              initial={reducedMotion ? false : { pathLength: 0, opacity: 0.45 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.55, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
              onMouseEnter={() => setSelectedIndex(index)}
              onFocus={() => setSelectedIndex(index)}
              onClick={() => setSelectedIndex(index)}
              className="cursor-pointer"
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Gesamt</p>
          <p className="mt-1 text-3xl font-black tracking-[-0.06em] text-foreground">{formatValue(total)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.map((entry, index) => (
          <motion.button
            key={entry.label}
            type="button"
            onMouseEnter={() => setSelectedIndex(index)}
            onFocus={() => setSelectedIndex(index)}
            onClick={() => setSelectedIndex(index)}
            whileHover={reducedMotion ? undefined : { y: -2, scale: 1.02 }}
            whileTap={reducedMotion ? undefined : { y: 1, scale: 0.985 }}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
              index === safeIndex
                ? 'border-border bg-background text-foreground'
                : 'border-border bg-background/55 text-muted-foreground'
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export function RadarProfileChart({
  data,
  maxValue,
  size = 260,
}: RadarChartProps) {
  const reducedMotion = useReducedMotion();
  const [selectedIndex, setSelectedIndex] = useState(() => 0);
  const safeIndex = clampIndex(selectedIndex, data.length);
  const resolvedMaxValue = Math.max(maxValue ?? 0, 1, ...data.map((entry) => entry.value));
  const center = size / 2;
  const radius = size * 0.33;

  const gridPolygons = [0.25, 0.5, 0.75, 1].map((level) =>
    data
      .map((_, index) => {
        const angle = (-Math.PI / 2) + (index / data.length) * Math.PI * 2;
        const x = center + Math.cos(angle) * radius * level;
        const y = center + Math.sin(angle) * radius * level;
        return `${x},${y}`;
      })
      .join(' '),
  );

  const dataPolygon = data
    .map((entry, index) => {
      const angle = (-Math.PI / 2) + (index / data.length) * Math.PI * 2;
      const entryRadius = radius * (entry.value / resolvedMaxValue);
      const x = center + Math.cos(angle) * entryRadius;
      const y = center + Math.sin(angle) * entryRadius;
      return `${x},${y}`;
    })
    .join(' ');

  const selected = data[safeIndex];

  return (
    <div className="space-y-4">
      {selected ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{selected.label}</p>
            <p className="text-xs text-muted-foreground">{formatValue(selected.value)} Treffer im Profil</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            Fokuspunkt
          </span>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-[18rem] justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full overflow-visible">
          {gridPolygons.map((polygon, index) => (
            <polygon
              key={polygon}
              points={polygon}
              fill="none"
              stroke="hsl(var(--border) / 0.55)"
              strokeDasharray={index === gridPolygons.length - 1 ? '0' : '4 8'}
            />
          ))}

          {data.map((entry, index) => {
            const angle = (-Math.PI / 2) + (index / data.length) * Math.PI * 2;
            const axisX = center + Math.cos(angle) * radius;
            const axisY = center + Math.sin(angle) * radius;
            const labelX = center + Math.cos(angle) * (radius + 28);
            const labelY = center + Math.sin(angle) * (radius + 28);
            const valueRadius = radius * (entry.value / resolvedMaxValue);
            const pointX = center + Math.cos(angle) * valueRadius;
            const pointY = center + Math.sin(angle) * valueRadius;
            const isSelected = index === safeIndex;

            return (
              <g key={entry.label}>
                <line
                  x1={center}
                  y1={center}
                  x2={axisX}
                  y2={axisY}
                  stroke="hsl(var(--border) / 0.5)"
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={Math.abs(labelX - center) < 12 ? 'middle' : labelX < center ? 'end' : 'start'}
                  dominantBaseline="middle"
                  fill="hsl(var(--muted-foreground))"
                  fontSize="10"
                  fontWeight="700"
                >
                  {entry.label}
                </text>
                <circle
                  cx={pointX}
                  cy={pointY}
                  r={isSelected ? 6 : 4}
                  fill={isSelected ? 'hsl(var(--accent))' : 'hsl(var(--primary))'}
                  stroke="white"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          <motion.polygon
            points={dataPolygon}
            fill="hsl(var(--primary) / 0.18)"
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
            initial={reducedMotion ? false : { pathLength: 0, opacity: 0.45 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.map((entry, index) => (
          <motion.button
            key={entry.label}
            type="button"
            onMouseEnter={() => setSelectedIndex(index)}
            onFocus={() => setSelectedIndex(index)}
            onClick={() => setSelectedIndex(index)}
            whileHover={reducedMotion ? undefined : { y: -2, scale: 1.02 }}
            whileTap={reducedMotion ? undefined : { y: 1, scale: 0.985 }}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
              index === safeIndex
                ? 'border-primary/40 bg-primary/12 text-primary'
                : 'border-border bg-background/55 text-muted-foreground'
            }`}
          >
            {entry.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

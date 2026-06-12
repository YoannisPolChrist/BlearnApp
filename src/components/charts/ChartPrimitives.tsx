import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  buildSmoothLinePath,
  clampIndex,
  describeArc,
  formatPercent,
  formatValue,
  getSelectableColumns,
  type ComparisonLineChartProps,
  type GroupedBarChartProps,
} from './chartPrimitiveUtils';
export { DonutChart, RadarProfileChart } from './DonutRadarCharts';

export function ComparisonLineChart({
  data,
  height = 220,
  labelStep = 1,
}: ComparisonLineChartProps) {
  const reducedMotion = useReducedMotion();
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(data.length - 1, 0));
  const safeIndex = clampIndex(selectedIndex, data.length);
  const width = 640;
  const paddingTop = 18;
  const paddingRight = 16;
  const paddingBottom = 36;
  const paddingLeft = 16;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(
    1,
    ...data.flatMap((entry) => entry.series.map((series) => series.value)),
  );
  const columns = useMemo(
    () => getSelectableColumns(data, paddingLeft, chartWidth),
    [chartWidth, data, paddingLeft],
  );

  const [primaryPath, secondaryPath, primaryAreaPath] = useMemo(() => {
    const points = data.map((entry, index) => {
      const x =
        paddingLeft + (chartWidth * index) / Math.max(data.length - 1, 1);
      const primaryY =
        paddingTop + chartHeight - (entry.series[0].value / maxValue) * chartHeight;
      const secondaryY =
        paddingTop + chartHeight - (entry.series[1].value / maxValue) * chartHeight;

      return {
        x,
        primaryY,
        secondaryY,
      };
    });

    const primaryPoints = points.map((point) => ({ x: point.x, y: point.primaryY }));
    const secondaryPoints = points.map((point) => ({ x: point.x, y: point.secondaryY }));
    const linePath = buildSmoothLinePath(primaryPoints);
    const secondaryLinePath = buildSmoothLinePath(secondaryPoints);
    const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? paddingLeft} ${paddingTop + chartHeight} L ${points[0]?.x ?? paddingLeft} ${paddingTop + chartHeight} Z`;

    return [linePath, secondaryLinePath, areaPath];
  }, [chartHeight, chartWidth, data, maxValue, paddingLeft, paddingTop]);

  const selected = data[safeIndex];
  const selectedX =
    paddingLeft + (chartWidth * safeIndex) / Math.max(data.length - 1, 1);
  const selectedPrimaryY =
    paddingTop + chartHeight - (((selected?.series[0].value) ?? 0) / maxValue) * chartHeight;
  const selectedSecondaryY =
    paddingTop + chartHeight - (((selected?.series[1].value) ?? 0) / maxValue) * chartHeight;

  return (
    <div className="relative">
      {selected ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{selected.label}</p>
            <p className="text-xs text-muted-foreground">
              {selected.series[0].label}: {formatValue(selected.series[0].value)} | {selected.series[1].label}:{' '}
              {formatValue(selected.series[1].value)}
            </p>
          </div>
          <div className="flex gap-3 text-[11px] font-bold uppercase tracking-[0.16em]">
            {selected.series.map((series, index) => (
              <motion.span
                key={series.key}
                className="inline-flex items-center gap-2 text-muted-foreground"
                initial={reducedMotion ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: series.color }}
                />
                {series.label}
              </motion.span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="relative h-[220px] overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/45">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          <defs>
            <linearGradient id="chart-area-primary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={data[0]?.series[0].color ?? 'currentColor'} stopOpacity="0.34" />
              <stop offset="100%" stopColor={data[0]?.series[0].color ?? 'currentColor'} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = paddingTop + chartHeight * step;
            return (
              <line
                key={step}
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="hsl(var(--border) / 0.5)"
                strokeDasharray="4 10"
              />
            );
          })}

          <motion.path
            d={primaryAreaPath}
            fill="url(#chart-area-primary)"
            initial={reducedMotion ? false : { opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
          <motion.path
            d={secondaryPath}
            fill="none"
            stroke={data[0]?.series[1].color}
            strokeWidth="3"
            strokeLinecap="round"
            initial={reducedMotion ? false : { pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.path
            d={primaryPath}
            fill="none"
            stroke={data[0]?.series[0].color}
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={reducedMotion ? false : { pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
          />

          {selected ? (
            <>
                <motion.line
                  x1={selectedX}
                  y1={paddingTop}
                  x2={selectedX}
                  y2={paddingTop + chartHeight}
                stroke="hsl(var(--foreground) / 0.18)"
                strokeDasharray="5 8"
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18 }}
              />
              <motion.circle
                cx={selectedX}
                cy={selectedPrimaryY}
                r="6"
                fill={selected.series[0].color}
                stroke="white"
                strokeWidth="2"
                initial={reducedMotion ? false : { scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
              <motion.circle
                cx={selectedX}
                cy={selectedSecondaryY}
                r="5"
                fill={selected.series[1].color}
                stroke="white"
                strokeWidth="2"
                initial={reducedMotion ? false : { scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.04 }}
              />
            </>
          ) : null}

          {data.map((entry, index) => {
            if (index % labelStep !== 0 && index !== data.length - 1) {
              return null;
            }

            const x =
              paddingLeft + (chartWidth * index) / Math.max(data.length - 1, 1);

            return (
              <text
                key={entry.label}
                x={x}
                y={height - 12}
                textAnchor="middle"
                fill="hsl(var(--muted-foreground))"
                fontSize="10"
                fontWeight="700"
              >
                {entry.label}
              </text>
            );
          })}
        </svg>

        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))` }}>
          {columns.map((column) => (
            <button
              key={column.label}
              type="button"
              aria-label={`Zeige Werte für ${column.label}`}
              className="h-full w-full"
              onFocus={() => setSelectedIndex(column.index)}
              onMouseEnter={() => setSelectedIndex(column.index)}
              onClick={() => setSelectedIndex(column.index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function GroupedBarChart({
  data,
  height = 180,
  labelStep = 1,
}: GroupedBarChartProps) {
  const reducedMotion = useReducedMotion();
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(data.length - 1, 0));
  const safeIndex = clampIndex(selectedIndex, data.length);
  const width = 640;
  const paddingTop = 14;
  const paddingRight = 16;
  const paddingBottom = 34;
  const paddingLeft = 16;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(
    1,
    ...data.flatMap((entry) => entry.series.map((series) => series.value)),
  );
  const columns = useMemo(
    () => getSelectableColumns(data, paddingLeft, chartWidth),
    [chartWidth, data, paddingLeft],
  );
  const selected = data[safeIndex];

  return (
    <div className="relative">
      {selected ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{selected.label}</p>
            <p className="text-xs text-muted-foreground">
              {selected.series.map((series, index) => (
                <span key={series.key}>
                  {index > 0 ? ' | ' : ''}
                  {series.label}: {formatValue(series.value)}
                </span>
              ))}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] font-bold uppercase tracking-[0.16em]">
            {selected.series.map((series, index) => (
              <motion.span
                key={series.key}
                className="inline-flex items-center gap-2 text-muted-foreground"
                initial={reducedMotion ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: series.color }}
                />
                {series.label}
              </motion.span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="relative h-[180px] overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/45">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = paddingTop + chartHeight * step;
            return (
              <line
                key={step}
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="hsl(var(--border) / 0.5)"
                strokeDasharray="4 10"
              />
            );
          })}

          {data.map((entry, index) => {
            const groupWidth = chartWidth / Math.max(data.length, 1);
            const seriesCount = Math.max(entry.series.length, 1);
            const barWidth = Math.max(groupWidth * (seriesCount > 2 ? 0.18 : 0.24), 8);
            const centerX = paddingLeft + groupWidth * index + groupWidth / 2;
            const gap = seriesCount > 2 ? 4 : 6;
            const totalBarWidth = barWidth * seriesCount + gap * Math.max(seriesCount - 1, 0);

            return entry.series.map((series, seriesIndex) => {
              const barHeight = (series.value / maxValue) * chartHeight;
              const x = centerX - totalBarWidth / 2 + seriesIndex * (barWidth + gap);
              const y = paddingTop + chartHeight - barHeight;
              const isSelected = index === safeIndex;

              return (
                <g key={`${entry.label}-${series.key}`}>
                  <rect
                    x={x}
                    y={paddingTop}
                    width={barWidth}
                    height={chartHeight}
                    rx="8"
                    fill="hsl(var(--muted) / 0.34)"
                  />
                  <motion.rect
                    initial={{ y: paddingTop + chartHeight, height: 0 }}
                    animate={{ y, height: barHeight }}
                    transition={{ duration: 0.55, delay: index * 0.02, ease: [0.16, 1, 0.3, 1] }}
                    x={x}
                    width={barWidth}
                    rx="8"
                    fill={series.color}
                    opacity={isSelected ? 1 : 0.82}
                  />
                </g>
              );
            });
          })}

          {data.map((entry, index) => {
            if (index % labelStep !== 0 && index !== data.length - 1) {
              return null;
            }

            const x = paddingLeft + (chartWidth * index) / Math.max(data.length - 1, 1);

            return (
              <text
                key={entry.label}
                x={x}
                y={height - 10}
                textAnchor="middle"
                fill="hsl(var(--muted-foreground))"
                fontSize="10"
                fontWeight="700"
              >
                {entry.label}
              </text>
            );
          })}
        </svg>

        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))` }}>
          {columns.map((column) => (
            <button
              key={column.label}
              type="button"
              aria-label={`Zeige Stimmung für ${column.label}`}
              className="h-full w-full"
              onFocus={() => setSelectedIndex(column.index)}
              onMouseEnter={() => setSelectedIndex(column.index)}
              onClick={() => setSelectedIndex(column.index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

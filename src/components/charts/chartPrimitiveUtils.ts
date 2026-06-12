export interface BaseDatum {
  label: string;
}

export interface LineSeries {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface ComparisonLineDatum extends BaseDatum {
  series: [LineSeries, LineSeries];
}

export interface ComparisonLineChartProps {
  data: ComparisonLineDatum[];
  height?: number;
  labelStep?: number;
}

export interface BarSeries {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface GroupedBarDatum extends BaseDatum {
  series: BarSeries[];
}

export interface GroupedBarChartProps {
  data: GroupedBarDatum[];
  height?: number;
  labelStep?: number;
}

export interface DonutDatum extends BaseDatum {
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
}

export interface RadarDatum extends BaseDatum {
  value: number;
}

export interface RadarChartProps {
  data: RadarDatum[];
  maxValue?: number;
  size?: number;
}

export function clampIndex(index: number, max: number) {
  if (max <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, max - 1));
}

export function formatValue(value: number) {
  return new Intl.NumberFormat('de-DE').format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildSmoothLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

export function getSelectableColumns<T extends BaseDatum>(
  data: T[],
  chartLeft: number,
  chartWidth: number,
) {
  return data.map((entry, index) => {
    const columnWidth = chartWidth / Math.max(data.length, 1);
    return {
      ...entry,
      index,
      x: chartLeft + columnWidth * index,
      width: columnWidth,
    };
  });
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

export function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ');
}

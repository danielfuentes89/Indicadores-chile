import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkAreaComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'preact/hooks';
import type { Lang } from '../i18n/ui.ts';
import { formatCompact, formatDate, formatNumber } from '../lib/format.ts';
import type { Freq, Obs } from '../lib/series.ts';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent, CanvasRenderer]);

export interface ChartSeries {
  name: string;
  data: Obs[];
  /** Posición en la paleta categórica (1 = Chile). El color sigue a la entidad, no al orden. */
  slot: 1 | 2 | 3 | 4;
}

interface Props {
  series: ChartSeries[];
  freq: Freq;
  lang: Lang;
  decimals: number;
  kind: 'line' | 'bar';
  ariaLabel: string;
  projectionFrom?: string;
  projectionLabel?: string;
  height?: number;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    text: v('--text'),
    text2: v('--text-2'),
    muted: v('--muted'),
    grid: v('--grid'),
    axis: v('--axis'),
    surface: v('--surface'),
    border: v('--border'),
    projection: v('--projection'),
    series: [v('--series-1'), v('--series-2'), v('--series-3'), v('--series-4')],
  };
}

function buildOption(p: Props) {
  const tk = readTokens();
  const toTs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  const isBar = p.kind === 'bar';
  const multi = p.series.length > 1;

  return {
    animation: false,
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: tk.text2 },
    grid: { left: 8, right: 16, top: multi ? 40 : 16, bottom: 8, containLabel: true },
    legend: multi
      ? {
          top: 0,
          left: 0,
          icon: isBar ? 'roundRect' : 'path://M0,4 L24,4 L24,7 L0,7 Z',
          itemWidth: isBar ? 12 : 18,
          itemHeight: isBar ? 12 : 6,
          textStyle: { color: tk.text2, fontSize: 12 },
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: isBar ? 'shadow' : 'line', lineStyle: { color: tk.axis }, shadowStyle: { color: tk.projection } },
      backgroundColor: tk.surface,
      borderColor: tk.border,
      textStyle: { color: tk.text, fontSize: 12 },
      confine: true,
      formatter: (params: { axisValue: number; seriesName: string; value: [number, number]; color: string }[]) => {
        if (!params.length) return '';
        const iso = new Date(params[0].axisValue).toISOString().slice(0, 10);
        const rows = params
          .map(
            (s) =>
              `<div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:12px;height:3px;border-radius:2px;background:${s.color}"></span><strong>${escapeHtml(formatNumber(s.value[1], p.lang, p.decimals))}</strong><span style="color:${tk.muted}">${escapeHtml(s.seriesName)}</span></div>`,
          )
          .join('');
        return `<div style="color:${tk.text2};margin-bottom:4px">${escapeHtml(formatDate(iso, p.freq, p.lang))}</div>${rows}`;
      },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: tk.axis } },
      axisTick: { show: false },
      axisLabel: { color: tk.muted, hideOverlap: true, fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: !isBar,
      axisLabel: { color: tk.muted, fontSize: 11, formatter: (v: number) => formatCompact(v, p.lang) },
      splitLine: { lineStyle: { color: tk.grid, width: 1 } },
      axisLine: { show: false },
    },
    series: p.series.map((s, i) => {
      const color = tk.series[s.slot - 1];
      const base = {
        name: s.name,
        type: p.kind,
        data: s.data.map(([d, v]) => [toTs(d), v]),
        itemStyle: { color, borderRadius: isBar ? [4, 4, 0, 0] : undefined },
        emphasis: { disabled: !isBar },
        z: p.series.length - i + 1,
      };
      const projection =
        i === 0 && p.projectionFrom
          ? {
              markArea: {
                silent: true,
                itemStyle: { color: tk.projection },
                label: { show: true, position: 'insideTopLeft', color: tk.muted, fontSize: 11, formatter: p.projectionLabel ?? '' },
                data: [[{ xAxis: toTs(`${p.projectionFrom}-01-01`) - 182 * 86_400_000 }, { xAxis: 'max' }]],
              },
            }
          : {};
      return isBar
        ? { ...base, ...projection, barMaxWidth: 24, barGap: '15%' }
        : {
            ...base,
            ...projection,
            showSymbol: s.data.length < 40,
            symbolSize: 6,
            sampling: 'lttb',
            lineStyle: { width: 2, color },
          };
    }),
  };
}

export default function Chart(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const redraw = () => chart.setOption(buildOption(propsRef.current), { notMerge: true });
    redraw();
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    // Volver a leer los tokens cuando cambia el tema (botón o preferencia del sistema).
    const mo = new MutationObserver(redraw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', redraw);
    return () => {
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener('change', redraw);
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(buildOption(props), { notMerge: true });
  }, [props.series, props.kind, props.freq, props.lang, props.decimals, props.projectionFrom]);

  return <div ref={ref} role="img" aria-label={props.ariaLabel} style={{ width: '100%', height: `${props.height ?? 320}px` }} />;
}

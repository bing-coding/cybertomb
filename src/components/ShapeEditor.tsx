import type { TombShapeConfig } from '../lib/tombstoneShape';
import { DEFAULT_SHAPE_CONFIG } from '../lib/tombstoneShape';
import { TombstoneRenderer } from './TombstoneRenderer';

// ─── Types & constants ────────────────────────────────────────────────────────

interface Props {
  value: TombShapeConfig;
  onChange: (cfg: TombShapeConfig) => void;
}

const HEAD_TYPES: { id: TombShapeConfig['headType']; label: string; symbol: string }[] = [
  { id: 'arch',    label: '穹顶', symbol: '⌒' },
  { id: 'pointed', label: '尖顶', symbol: '△' },
  { id: 'flat',    label: '平顶', symbol: '▭' },
  { id: 'cross',   label: '十字', symbol: '✝' },
  { id: 'obelisk', label: '方尖', symbol: '◇' },
];

const MATERIALS: { id: TombShapeConfig['material']; label: string; hex: string }[] = [
  { id: 'dark',    label: '深岩', hex: '#252230' },
  { id: 'granite', label: '花岗', hex: '#3e3a4c' },
  { id: 'marble',  label: '大理', hex: '#d8d4e8' },
];

const PORTRAIT_SHAPES: { id: TombShapeConfig['portraitShape']; label: string }[] = [
  { id: 'oval',   label: '椭圆' },
  { id: 'circle', label: '圆形' },
  { id: 'rect',   label: '方形' },
  { id: 'none',   label: '无框' },
];

const BORDERS: { id: TombShapeConfig['borderStyle']; label: string }[] = [
  { id: 'none',   label: '无' },
  { id: 'single', label: '单线' },
  { id: 'double', label: '双线' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function RangeSlider({
  label, value, min, max, step = 1, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[9px] tracking-[0.4em] uppercase text-[#888] font-light">{label}</span>
        <span className="text-[9px] text-[#555] font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

const BTN_BASE = 'border transition-all duration-300 cursor-pointer text-center text-[8px] tracking-widest uppercase font-light';
const BTN_ON   = 'border-[#F5F5F5] bg-[#F5F5F5]/8 text-[#F5F5F5]';
const BTN_OFF  = 'border-[#C0C6CF]/15 text-[#666] hover:border-[#C0C6CF]/40 hover:text-[#999]';

// ─── Main component ───────────────────────────────────────────────────────────

export function ShapeEditor({ value: cfg, onChange }: Props) {
  const set = <K extends keyof TombShapeConfig>(k: K, v: TombShapeConfig[K]) =>
    onChange({ ...cfg, [k]: v });

  // Dummy tomb used for the live preview
  const previewTomb = {
    name: '归  处',
    birth_date: '1940-03-12' as string | null,
    death_date:  '2024-11-08' as string | null,
    epitaph: '此生无憾，安然归处。',
    images:  [] as string[],
    shape:   'arch' as const,
    shape_config: cfg,
  };

  const sectionLabel = 'text-[9px] tracking-[0.5em] uppercase text-[#666] font-light block mb-3';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">

      {/* ── Left: controls ── */}
      <div className="space-y-9">

        {/* Head type */}
        <div>
          <span className={sectionLabel}>顶部形状 / Head</span>
          <div className="grid grid-cols-5 gap-2">
            {HEAD_TYPES.map(h => (
              <button
                key={h.id}
                type="button"
                onClick={() => set('headType', h.id)}
                className={`${BTN_BASE} py-3 flex flex-col items-center gap-1.5 ${cfg.headType === h.id ? BTN_ON : BTN_OFF}`}
              >
                <span className="text-sm leading-none">{h.symbol}</span>
                <span>{h.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Arch curve depth */}
        {cfg.headType === 'arch' && (
          <RangeSlider
            label="弧度 / Curve"
            value={cfg.headCurveDepth}
            min={10} max={95}
            onChange={v => set('headCurveDepth', v)}
          />
        )}

        {/* Obelisk taper */}
        {cfg.headType === 'obelisk' && (
          <RangeSlider
            label="收窄 / Taper"
            value={Math.round(cfg.taperRatio * 100)}
            min={30} max={95}
            onChange={v => set('taperRatio', v / 100)}
          />
        )}

        {/* Base toggle */}
        <div>
          <span className={sectionLabel}>基座 / Base</span>
          <div className="flex gap-3">
            {[{ v: true, l: '有基座' }, { v: false, l: '无基座' }].map(({ v, l }) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => set('hasBase', v)}
                className={`${BTN_BASE} flex-1 py-2.5 ${cfg.hasBase === v ? BTN_ON : BTN_OFF}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Base width */}
        {cfg.hasBase && (
          <RangeSlider
            label="基座宽度 / Width"
            value={Math.round(cfg.baseWidthRatio * 100)}
            min={100} max={165}
            onChange={v => set('baseWidthRatio', v / 100)}
          />
        )}

        {/* Material */}
        <div>
          <span className={sectionLabel}>材质 / Material</span>
          <div className="flex gap-3">
            {MATERIALS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => set('material', m.id)}
                className={`${BTN_BASE} flex-1 py-3 flex flex-col items-center gap-2 ${cfg.material === m.id ? 'border-[#F5F5F5]' : 'border-[#C0C6CF]/15 hover:border-[#C0C6CF]/35'}`}
              >
                <div
                  className="w-6 h-5 rounded-sm border border-white/10"
                  style={{ background: m.hex }}
                />
                <span className="text-[8px] tracking-widest text-[#888]">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Portrait shape */}
        <div>
          <span className={sectionLabel}>相框 / Portrait Frame</span>
          <div className="grid grid-cols-4 gap-2">
            {PORTRAIT_SHAPES.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => set('portraitShape', p.id)}
                className={`${BTN_BASE} py-2.5 ${cfg.portraitShape === p.id ? BTN_ON : BTN_OFF}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Border style */}
        <div>
          <span className={sectionLabel}>边框 / Border</span>
          <div className="flex gap-3">
            {BORDERS.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => set('borderStyle', b.id)}
                className={`${BTN_BASE} flex-1 py-2.5 ${cfg.borderStyle === b.id ? BTN_ON : BTN_OFF}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={() => onChange(DEFAULT_SHAPE_CONFIG)}
          className="text-[8px] tracking-[0.45em] uppercase text-[#555] hover:text-[#888] transition-colors duration-300"
        >
          重置默认 / Reset to Default
        </button>
      </div>

      {/* ── Right: live preview ── */}
      <div className="flex flex-col items-center gap-6">
        <span className="text-[9px] tracking-[0.5em] uppercase text-[#666] font-light">
          实时预览 / Live Preview
        </span>
        <div className="w-44">
          <TombstoneRenderer tomb={previewTomb} size="card" />
        </div>
      </div>
    </div>
  );
}

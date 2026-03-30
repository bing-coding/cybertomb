// ─── Tombstone shape configuration & SVG path utilities ──────────────────────

export interface TombShapeConfig {
  headType: 'arch' | 'pointed' | 'flat' | 'cross' | 'obelisk';
  headCurveDepth: number;   // 0–100 (arch only)
  hasBase: boolean;
  baseWidthRatio: number;   // 1.0–1.6  (base width / body width)
  taperRatio: number;       // 0.3–1.0  (obelisk top width fraction)
  material: 'dark' | 'granite' | 'marble';
  portraitShape: 'oval' | 'rect' | 'circle' | 'none';
  borderStyle: 'none' | 'single' | 'double';
}

export const DEFAULT_SHAPE_CONFIG: TombShapeConfig = {
  headType: 'arch',
  headCurveDepth: 65,
  hasBase: true,
  baseWidthRatio: 1.28,
  taperRatio: 0.75,
  material: 'dark',
  portraitShape: 'oval',
  borderStyle: 'single',
};

// SVG viewBox dimensions — all path coordinates are in this space
export const VB_W = 100;
export const VB_H = 160;

export interface ShapePaths {
  main: string;
  base: string | null;
  border: string | null;
}

export function buildShapePaths(cfg: TombShapeConfig): ShapePaths {
  const bodyBottom = cfg.hasBase ? 130 : VB_H;
  const baseExtraW = cfg.hasBase ? (cfg.baseWidthRatio - 1) * VB_W / 2 : 0;
  const headY = 45;

  let main: string;

  switch (cfg.headType) {
    case 'arch': {
      const peakY = Math.max(3, headY * (1 - (cfg.headCurveDepth / 100) * 0.91));
      main = `M 0 ${headY} Q 50 ${peakY.toFixed(1)} 100 ${headY} L 100 ${bodyBottom} L 0 ${bodyBottom} Z`;
      break;
    }
    case 'pointed':
      main = `M 0 ${headY} L 50 5 L 100 ${headY} L 100 ${bodyBottom} L 0 ${bodyBottom} Z`;
      break;
    case 'flat':
      main = `M 0 10 L 100 10 L 100 ${bodyBottom} L 0 ${bodyBottom} Z`;
      break;
    case 'obelisk': {
      const halfTopW = (cfg.taperRatio * VB_W) / 2;
      const leftTop = (VB_W / 2 - halfTopW).toFixed(1);
      const rightTop = (VB_W / 2 + halfTopW).toFixed(1);
      main = `M 0 ${bodyBottom} L ${leftTop} 10 L ${rightTop} 10 L 100 ${bodyBottom} Z`;
      break;
    }
    case 'cross': {
      const bx1 = 33, bx2 = 67, armTop = 16, armBot = 52;
      main = [
        `M ${bx1} 4`, `L ${bx2} 4`, `L ${bx2} ${armTop}`,
        `L 100 ${armTop}`, `L 100 ${armBot}`, `L ${bx2} ${armBot}`,
        `L ${bx2} ${bodyBottom}`, `L ${bx1} ${bodyBottom}`, `L ${bx1} ${armBot}`,
        `L 0 ${armBot}`, `L 0 ${armTop}`, `L ${bx1} ${armTop}`, 'Z',
      ].join(' ');
      break;
    }
    default:
      main = `M 0 ${headY} Q 50 5 100 ${headY} L 100 ${bodyBottom} L 0 ${bodyBottom} Z`;
  }

  const base = cfg.hasBase
    ? `M ${(-baseExtraW).toFixed(1)} ${bodyBottom} L ${(VB_W + baseExtraW).toFixed(1)} ${bodyBottom} L ${(VB_W + baseExtraW).toFixed(1)} ${VB_H} L ${(-baseExtraW).toFixed(1)} ${VB_H} Z`
    : null;

  // Approximate inset border path (only for simpler shapes)
  let border: string | null = null;
  if (cfg.borderStyle !== 'none') {
    const ins = 4.5;
    if (cfg.headType === 'arch') {
      const peakY = Math.max(3, headY * (1 - (cfg.headCurveDepth / 100) * 0.91));
      const bPeak = Math.max(peakY + ins * 0.6, 6);
      border = `M ${ins} ${(headY + ins * 0.35).toFixed(1)} Q 50 ${bPeak.toFixed(1)} ${100 - ins} ${(headY + ins * 0.35).toFixed(1)} L ${100 - ins} ${bodyBottom - ins} L ${ins} ${bodyBottom - ins} Z`;
    } else if (cfg.headType === 'flat') {
      border = `M ${ins} ${10 + ins} L ${100 - ins} ${10 + ins} L ${100 - ins} ${bodyBottom - ins} L ${ins} ${bodyBottom - ins} Z`;
    } else if (cfg.headType === 'pointed') {
      border = `M ${ins} ${(headY + ins * 0.5).toFixed(1)} L 50 ${(5 + ins * 1.4).toFixed(1)} L ${100 - ins} ${(headY + ins * 0.5).toFixed(1)} L ${100 - ins} ${bodyBottom - ins} L ${ins} ${bodyBottom - ins} Z`;
    }
  }

  return { main, base, border };
}

// ─── Material colour themes ───────────────────────────────────────────────────

export interface MaterialTheme {
  faceStart: string;
  faceEnd: string;
  baseColor: string;
  textColor: string;
  borderColor: string;
  shadowColor: string;
}

export function getMaterialTheme(material: TombShapeConfig['material']): MaterialTheme {
  switch (material) {
    case 'granite':
      return {
        faceStart: '#3e3a4c', faceEnd: '#2a2836', baseColor: '#201c2c',
        textColor: '#c8c0d8', borderColor: '#5a5468', shadowColor: 'rgba(0,0,0,0.72)',
      };
    case 'marble':
      return {
        faceStart: '#e0dce8', faceEnd: '#c8c4d8', baseColor: '#b0acbc',
        textColor: '#282040', borderColor: '#8880a0', shadowColor: 'rgba(0,0,0,0.4)',
      };
    case 'dark':
    default:
      return {
        faceStart: '#252230', faceEnd: '#16141e', baseColor: '#0e0c14',
        textColor: '#a098b8', borderColor: '#38304c', shadowColor: 'rgba(0,0,0,0.82)',
      };
  }
}

// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatDateRange(birth: string | null, death: string | null): string {
  if (!birth && !death) return '';
  const b = birth ? birth.replace(/-/g, '.') : '?';
  const d = death ? death.replace(/-/g, '.') : '?';
  if (!birth) return `— ${d}`;
  if (!death) return `${b} —`;
  return `${b}  —  ${d}`;
}

// ─── Backward-compat: map legacy TombShape → TombShapeConfig ─────────────────

export function getEffectiveConfig(
  tomb: { shape?: string; shape_config?: TombShapeConfig | null }
): TombShapeConfig {
  if (tomb.shape_config) return tomb.shape_config;

  const legacyMap: Record<string, Partial<TombShapeConfig>> = {
    arch:    { headType: 'arch',    headCurveDepth: 65 },
    rect:    { headType: 'flat',    hasBase: false, borderStyle: 'none' },
    pillar:  { headType: 'obelisk', hasBase: false, taperRatio: 0.55, borderStyle: 'none' },
    rounded: { headType: 'arch',    headCurveDepth: 28, borderStyle: 'none' },
  };

  return { ...DEFAULT_SHAPE_CONFIG, ...(legacyMap[tomb.shape ?? ''] ?? {}) };
}

// ─── Content padding per head type (% of VB_H) ───────────────────────────────

export const CONTENT_PADDING_TOP: Record<TombShapeConfig['headType'], string> = {
  arch:    '28%',
  pointed: '31%',
  flat:    '12%',
  cross:   '38%',   // arm ends at ~33 %, leave buffer
  obelisk: '12%',
};

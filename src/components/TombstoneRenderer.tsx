import { useId } from 'react';
import { motion } from 'motion/react';
import type { Tombstone } from '../lib/supabase';
import {
  buildShapePaths,
  getMaterialTheme,
  getEffectiveConfig,
  formatDateRange,
  CONTENT_PADDING_TOP,
  VB_W,
  VB_H,
} from '../lib/tombstoneShape';

// ─── Types ────────────────────────────────────────────────────────────────────

type TombData = Pick<Tombstone, 'name' | 'birth_date' | 'death_date' | 'epitaph' | 'images' | 'shape' | 'shape_config'>;

interface Props {
  tomb: TombData;
  size?: 'card' | 'detail';
  animated?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TombstoneRenderer({ tomb, size = 'card', animated = false }: Props) {
  const rawId = useId();
  // SVG IDs must not start with a digit and must not contain colons
  const uid = 't' + rawId.replace(/[^a-zA-Z0-9]/g, '');

  const cfg = getEffectiveConfig(tomb);
  const paths = buildShapePaths(cfg);
  const theme = getMaterialTheme(cfg.material);

  const gradId   = `${uid}-grad`;
  const shadowId = `${uid}-shad`;

  const portrait  = tomb.images?.[0];
  const dateStr   = formatDateRange(tomb.birth_date, tomb.death_date);
  const isDetail  = size === 'detail';

  const paddingTop    = CONTENT_PADDING_TOP[cfg.headType];
  const paddingBottom = cfg.hasBase ? '22%' : '10%';

  // Portrait frame border-radius
  const portraitRadius =
    cfg.portraitShape === 'circle' ? '50%' :
    cfg.portraitShape === 'oval'   ? '50% / 44%' :
    cfg.portraitShape === 'rect'   ? '3px' : '0';

  const portraitAspect =
    cfg.portraitShape === 'oval' ? '4 / 5' : '1';

  return (
    <motion.div
      className={`relative select-none ${isDetail ? 'w-52 md:w-64' : 'w-full'}`}
      style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
      {...(animated ? {
        initial:    { y: 32, opacity: 0 },
        animate:    { y: 0,  opacity: 1 },
        transition: { duration: 1.8, ease: 'easeOut' },
      } : {})}
    >
      {/* ── SVG tombstone background ── */}
      <svg
        className="absolute inset-0 w-full h-full overflow-visible"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%"   stopColor={theme.faceStart} />
            <stop offset="100%" stopColor={theme.faceEnd} />
          </linearGradient>
          <filter id={shadowId} x="-25%" y="-10%" width="155%" height="130%">
            <feDropShadow dx="2" dy="6" stdDeviation="4" floodColor={theme.shadowColor} />
          </filter>
        </defs>

        {/* Pedestal / base */}
        {paths.base && (
          <path d={paths.base} fill={theme.baseColor} filter={`url(#${shadowId})`} />
        )}

        {/* Main face */}
        <path d={paths.main} fill={`url(#${gradId})`} filter={`url(#${shadowId})`} />

        {/* Subtle highlight on left edge — 3-D depth suggestion */}
        <path
          d={paths.main}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="2"
        />

        {/* Border engraving */}
        {paths.border && (
          <path
            d={paths.border}
            fill="none"
            stroke={theme.borderColor}
            strokeWidth={cfg.borderStyle === 'double' ? '1' : '0.6'}
            opacity="0.5"
          />
        )}
        {cfg.borderStyle === 'double' && paths.border && (
          <path
            d={paths.border}
            fill="none"
            stroke={theme.borderColor}
            strokeWidth="0.4"
            opacity="0.28"
            transform="scale(0.965) translate(1.8, 2.5)"
          />
        )}
      </svg>

      {/* ── Content overlay ── */}
      <div
        className="absolute inset-0 flex flex-col items-center overflow-hidden"
        style={{ paddingTop, paddingBottom, paddingLeft: '10%', paddingRight: '10%' }}
      >
        {/*
          Portrait area — always reserves the same vertical space.
          When there is no photo (or shape = none) the block is an
          invisible placeholder so name/dates stay in the lower half.
        */}
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{
            width: isDetail ? '42%' : '38%',
            aspectRatio: portraitAspect,
            borderRadius: (portrait && cfg.portraitShape !== 'none') ? portraitRadius : undefined,
            border: (portrait && cfg.portraitShape !== 'none')
              ? `1px solid ${theme.borderColor}`
              : 'none',
            opacity: 0.9,
            marginBottom: '4%',
          }}
        >
          {portrait && cfg.portraitShape !== 'none' && (
            <img
              src={portrait}
              alt=""
              className="w-full h-full object-cover grayscale"
              style={{ opacity: cfg.material === 'marble' ? 0.6 : 0.48 }}
            />
          )}
        </div>

        {/* Divider */}
        <div
          className="flex-shrink-0"
          style={{
            width: '28%', height: '1px',
            backgroundColor: theme.borderColor,
            opacity: 0.45,
            marginBottom: '4%',
          }}
        />

        {/* Name */}
        <div
          className="font-light tracking-widest text-center leading-snug flex-shrink-0 px-1 w-full"
          style={{
            color: theme.textColor,
            fontSize: isDetail ? '0.9rem' : 'clamp(0.42rem, 2vw, 0.75rem)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {tomb.name}
        </div>

        {/* Dates */}
        {dateStr && (
          <div
            className="text-center flex-shrink-0 font-light tracking-wider w-full px-1"
            style={{
              color: theme.borderColor,
              fontSize: isDetail ? '0.6rem' : 'clamp(0.3rem, 1.3vw, 0.55rem)',
              marginTop: '3%',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {dateStr}
          </div>
        )}

        {/* Epitaph — engraved on the stone in both card and detail modes */}
        {tomb.epitaph && (
          <>
            <div style={{
              width: '28%', height: '1px',
              backgroundColor: theme.borderColor,
              opacity: 0.3,
              margin: isDetail ? '5% 0 4%' : '3% 0 2.5%',
              flexShrink: 0,
            }} />
            <p
              className="text-center font-light italic leading-relaxed px-1 flex-shrink-0 w-full"
              style={{
                color: theme.textColor,
                fontSize: isDetail ? '0.52rem' : 'clamp(0.28rem, 1.1vw, 0.42rem)',
                opacity: 0.65,
                display: '-webkit-box',
                WebkitLineClamp: isDetail ? 4 : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {tomb.epitaph}
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}

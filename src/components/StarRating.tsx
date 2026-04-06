import React, { useState, useId } from 'react';

/* =========================================
   Types
========================================= */

export interface StarRatingProps {
  /** Decimal rating value, e.g. 3.7, 4.5. Range: 0–5 */
  rating: number;
  /** Called with the new value when user clicks a star (input mode) */
  onChange?: (value: number) => void;
  /** If true, stars are purely display — no interaction */
  readonly?: boolean;
  /** Visual size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Show numeric value next to stars */
  showValue?: boolean;
  /** Optionally show total count, e.g. "(12 ratings)" */
  totalRatings?: number;
}

/* =========================================
   Helpers
========================================= */

const TOTAL = 5;

const SIZES = {
  sm: { px: 16, gap: 2, valueClass: 'text-xs' },
  md: { px: 22, gap: 3, valueClass: 'text-sm' },
  lg: { px: 28, gap: 4, valueClass: 'text-base' },
};

type FillType = 'full' | 'half' | 'empty';

function getFill(starIdx: number, rating: number): FillType {
  const diff = rating - starIdx;
  if (diff >= 0.75) return 'full';
  if (diff >= 0.25) return 'half';
  return 'empty';
}

/* =========================================
   Star SVG — supports full / half / empty
   Uses a unique gradient ID per star instance
========================================= */

const Star: React.FC<{
  fill: FillType;
  size: number;
  lit?: boolean; // true when hovered in input mode
}> = ({ fill, size, lit = false }) => {
  const uid = useId();
  const gradId = `hg-${uid}`;

  const GOLD  = lit ? '#FBBF24' : '#F59E0B';
  const EMPTY = '#E5E7EB';
  const STROKE = fill === 'empty' ? EMPTY : GOLD;

  const pts =
    '12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26';

  let fillAttr: string;
  if (fill === 'full')  fillAttr = GOLD;
  else if (fill === 'empty') fillAttr = 'transparent';
  else fillAttr = `url(#${gradId})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {fill === 'half' && (
        <defs>
          <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor={GOLD} />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      )}
      <polygon
        points={pts}
        fill={fillAttr}
        stroke={STROKE}
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{ transition: 'fill 0.12s ease, stroke 0.12s ease' }}
      />
    </svg>
  );
};

/* =========================================
   Main Component
========================================= */

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onChange,
  readonly = false,
  size = 'md',
  showValue = true,
  totalRatings,
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const { px, gap, valueClass } = SIZES[size];

  // clamp to [0, 5]
  const effectiveRating = Math.max(0, Math.min(5, hover ?? rating));

  /* helper: given a star div + mouse x, return 0.5 or 1.0 increment */
  const valueAt = (e: React.MouseEvent<HTMLDivElement>, idx: number): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? idx + 0.5 : idx + 1;
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: gap * 2 }}>

      {/* ── Star row ── */}
      <div
        role={readonly ? undefined : 'group'}
        aria-label={readonly ? `Rating: ${rating} out of 5` : 'Star rating input'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap,
          cursor: readonly ? 'default' : 'pointer',
        }}
        onMouseLeave={() => !readonly && setHover(null)}
      >
        {Array.from({ length: TOTAL }, (_, i) => {
          const fill = getFill(i, effectiveRating);
          const lit  = !readonly && hover !== null && i < Math.ceil(hover);

          return (
            <div
              key={i}
              aria-label={readonly ? undefined : `${i + 0.5} or ${i + 1} stars`}
              onMouseMove={!readonly ? (e) => setHover(valueAt(e, i)) : undefined}
              onClick={!readonly && onChange ? (e) => onChange(valueAt(e, i)) : undefined}
              style={{
                display: 'inline-flex',
                transform: lit ? 'scale(1.18)' : 'scale(1)',
                transition: 'transform 0.1s ease',
                userSelect: 'none',
              }}
            >
              <Star fill={fill} size={px} lit={lit} />
            </div>
          );
        })}
      </div>

      {/* ── Numeric label ── */}
      {showValue && (
        <span
          className={valueClass}
          style={{ fontWeight: 600, color: '#92400E', letterSpacing: '-0.01em' }}
        >
          {effectiveRating.toFixed(1)}
          {totalRatings !== undefined && (
            <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: 4 }}>
              ({totalRatings})
            </span>
          )}
        </span>
      )}
    </div>
  );
};

export default StarRating;
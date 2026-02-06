import React from 'react';

/**
 * Preppr Logo Component
 *
 * A cohesive logo combining an icon (fork & leaf symbolizing meal planning and nutrition)
 * with clean typography. Designed to work at various sizes from 24px to 200px height.
 *
 * Props:
 * - height: Height in pixels (default: 36)
 * - variant: 'full' | 'icon' | 'text' (default: 'full')
 * - className: Additional CSS classes
 */
export function Logo({ height = 36, variant = 'full', className = '' }) {
  const scale = height / 36; // Base height is 36px
  const iconSize = 32 * scale;
  const fontSize = 20 * scale;
  const gap = 8 * scale;

  // Calculate total width based on variant
  const iconWidth = variant === 'text' ? 0 : iconSize;
  const textWidth = variant === 'icon' ? 0 : 85 * scale;
  const totalWidth = iconWidth + (variant === 'full' ? gap : 0) + textWidth;

  return (
    <svg
      width={totalWidth}
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Preppr"
    >
      {/* Icon: Fork & Leaf */}
      {variant !== 'text' && (
        <g transform={`scale(${scale})`}>
          {/* Background circle with gradient */}
          <defs>
            <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#059669', stopOpacity: 1 }} />
            </linearGradient>
          </defs>

          <circle cx="16" cy="18" r="15" fill="url(#logo-gradient)" />

          {/* Fork & Leaf Icon */}
          <g transform="translate(16, 18)">
            {/* Left leaf with fork */}
            <path
              d="M-6,-8 Q-7,-5 -7,-2 L-7,4 Q-7,6 -5,6 Q-3,6 -3,4 L-3,0 L-2.5,0 L-2.5,4 Q-2.5,6 -0.5,6 Q1.5,6 1.5,4 L1.5,0 L2,0 L2,4 Q2,6 4,6 Q6,6 6,4 L6,-2 Q6,-5 5,-8 Q3,-10 0,-10 Q-3,-10 -6,-8 Z"
              fill="white"
              fillOpacity="0.95"
            />

            {/* Right leaf (spoon/leaf hybrid) */}
            <path
              d="M8,-6 Q10,-3 10,0 Q10,4 7,7 Q5,8 3,7 L3,3 Q5,3 6,2 Q7,1 7,0 Q7,-2 6,-4 Q5,-5 4,-5 Q3,-5 2,-4 L2,-8 Q4,-7 6,-7 Q7,-7 8,-6 Z"
              fill="white"
              fillOpacity="0.9"
            />

            {/* Stem connecting both elements */}
            <path
              d="M0,6 L0,8 Q0,9 1,9 Q2,9 2,8 L2,6"
              fill="white"
              fillOpacity="0.8"
            />
          </g>
        </g>
      )}

      {/* Text: Preppr */}
      {variant !== 'icon' && (
        <g transform={`translate(${variant === 'full' ? iconSize + gap : 0}, ${height / 2})`}>
          <text
            x="0"
            y="0"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif"
            fontSize={fontSize}
            fontWeight="700"
            fill="currentColor"
            dominantBaseline="central"
            letterSpacing="-0.02em"
          >
            Preppr
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * Alternative: Simple inline logo for header use
 * Uses the original logo PNG with clean text styling
 */
export function LogoInline({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/logo.png"
        alt="Preppr"
        className="w-10 h-10"
      />
      <span className="font-bold text-xl tracking-tight text-foreground">
        Preppr
      </span>
    </div>
  );
}

export default Logo;

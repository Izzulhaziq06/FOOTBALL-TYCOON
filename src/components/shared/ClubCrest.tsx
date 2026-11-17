import React from 'react';
import { CrestIdentifier } from '../../types';

interface ClubCrestProps {
  crest: CrestIdentifier;
  size?: number;
  className?: string;
}

export const ClubCrest: React.FC<ClubCrestProps> = ({ crest, size = 40, className = '' }) => {
  const clipId = React.useId();
  const glossId = React.useId();

  const renderShapePath = () => {
    switch (crest.shape) {
      case 'circle':
        return 'M 32 4 A 28 28 0 1 1 31.99 4 Z';
      case 'diamond':
        return 'M 32 3 L 60 32 L 32 61 L 4 32 Z';
      case 'banner':
        return 'M 10 6 H 54 V 44 L 32 60 L 10 44 Z';
      case 'shield':
      default:
        return 'M 32 4 L 56 12 V 32 C 56 46 44 56 32 60 C 20 56 8 46 8 32 V 12 Z';
    }
  };

  const shapePath = renderShapePath();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={shapePath} />
        </clipPath>
        <linearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="64" height="64" fill={crest.primaryColor} />

        {crest.pattern === 'vertical' && (
          <>
            <rect x="14" y="0" width="10" height="64" fill={crest.secondaryColor} opacity="0.9" />
            <rect x="40" y="0" width="10" height="64" fill={crest.secondaryColor} opacity="0.9" />
          </>
        )}

        {crest.pattern === 'horizontal' && (
          <rect x="0" y="23" width="64" height="18" fill={crest.secondaryColor} opacity="0.92" />
        )}

        {crest.pattern === 'halves' && (
          <rect x="32" y="0" width="32" height="64" fill={crest.secondaryColor} opacity="0.9" />
        )}

        {crest.pattern === 'diagonal' && (
          <polygon points="0,64 48,0 64,0 16,64" fill={crest.secondaryColor} opacity="0.9" />
        )}

        {crest.pattern === 'cross' && (
          <>
            <rect x="26" y="0" width="12" height="64" fill={crest.secondaryColor} opacity="0.88" />
            <rect x="0" y="26" width="64" height="12" fill={crest.secondaryColor} opacity="0.88" />
          </>
        )}

        {crest.pattern === 'diamond' && (
          <polygon points="32,12 52,32 32,52 12,32" fill={crest.secondaryColor} opacity="0.85" />
        )}

        <rect x="0" y="0" width="64" height="64" fill={`url(#${glossId})`} />
      </g>

      <path d={shapePath} fill="none" stroke={crest.accentColor} strokeWidth="2.5" />
      <path d={shapePath} fill="none" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="0.8" />

      <rect
        x="13"
        y="22.5"
        width="38"
        height="19"
        rx="2"
        fill="#070B14"
        fillOpacity="0.88"
        stroke={crest.accentColor}
        strokeWidth="1.1"
      />
      <text
        x="32"
        y="35.5"
        textAnchor="middle"
        fill="#F4F5F0"
        fontSize={crest.monogram.length > 3 ? '9.5' : '11'}
        fontWeight="800"
        fontFamily="Barlow Condensed, sans-serif"
        letterSpacing="0.6"
      >
        {crest.monogram}
      </text>
    </svg>
  );
};

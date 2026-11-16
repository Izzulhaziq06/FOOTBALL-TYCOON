import React from 'react';

interface PlayerAvatarProps {
  playerId: string;
  fullName: string;
  primaryColor?: string;
  size?: number;
  className?: string;
}

const SKIN_TONES = ['#F3D0B5', '#E2B493', '#C98E68', '#9D6644', '#6E4229'];
const HAIR_COLORS = ['#18181B', '#27201C', '#4A3222', '#7C5430', '#B0894D'];

function hashId(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(h);
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  playerId,
  fullName,
  primaryColor = '#10B981',
  size = 44,
  className = '',
}) => {
  const h = hashId(playerId + fullName);
  const skin = SKIN_TONES[h % SKIN_TONES.length];
  const hair = HAIR_COLORS[(h >> 3) % HAIR_COLORS.length];
  const hairStyle = (h >> 5) % 4;
  const hasBeard = (h >> 7) % 3 === 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`rounded-md border border-slate-700/70 bg-[#121824] shrink-0 ${className}`}
      aria-label={fullName}
    >
      <rect x="0" y="0" width="64" height="64" fill="#141C2B" />
      <circle cx="32" cy="58" r="24" fill={primaryColor} opacity="0.92" />
      <path d="M 24 41 L 32 49 L 40 41 Z" fill="#F8FAFC" opacity="0.9" />
      {/* Neck */}
      <rect x="27" y="34" width="10" height="10" rx="4" fill={skin} />
      {/* Head */}
      <ellipse cx="32" cy="26" rx="11.5" ry="13.5" fill={skin} />
      {/* Eyes */}
      <circle cx="27.5" cy="25" r="1.4" fill="#0F172A" />
      <circle cx="36.5" cy="25" r="1.4" fill="#0F172A" />
      {/* Mouth */}
      <path d="M 28.5 31.5 Q 32 33.5 35.5 31.5" stroke="#7C2D12" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      {/* Beard */}
      {hasBeard && (
        <path
          d="M 21.5 29 C 22 36.5 27 39.5 32 39.5 C 37 39.5 42 36.5 42.5 29 C 40 34 36 35.5 32 35.5 C 28 35.5 24 34 21.5 29 Z"
          fill={hair}
          opacity="0.72"
        />
      )}
      {/* Hair */}
      {hairStyle === 0 && (
        <path d="M 20 24 C 20 12 44 12 44 24 C 41 17 23 17 20 24 Z" fill={hair} />
      )}
      {hairStyle === 1 && (
        <path d="M 19.5 23 C 19 11 45 10 44.5 23 C 42 15 35 14 27 16 C 23 17 21 20 19.5 23 Z" fill={hair} />
      )}
      {hairStyle === 2 && (
        <path d="M 20.5 21 C 21 12 43 12 43.5 21 L 41 17 H 23 Z" fill={hair} />
      )}
      {hairStyle === 3 && (
        <path d="M 20.5 23 C 22 14 42 14 43.5 23 C 39 18 25 18 20.5 23 Z" fill={hair} opacity="0.85" />
      )}
    </svg>
  );
};

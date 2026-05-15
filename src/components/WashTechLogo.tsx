import React from 'react';

export default function WashTechLogo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Blue droplet with power icon */}
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Water droplet shape */}
        <path
          d="M20 4 C20 4 8 16 8 24 C8 31.732 13.373 37 20 37 C26.627 37 32 31.732 32 24 C32 16 20 4 20 4Z"
          fill="#2563EB"
        />
        {/* Power button icon (white) */}
        <path
          d="M20 14 L20 21"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M15 16.5 C13.1 17.9 12 20.1 12 22.5 C12 26.6 15.6 30 20 30 C24.4 30 28 26.6 28 22.5 C28 20.1 26.9 17.9 25 16.5"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {/* WashTech text */}
      <span className="font-bold text-slate-800 dark:text-white" style={{ fontSize: size * 0.5 }}>
        WashTech
      </span>
    </div>
  );
}

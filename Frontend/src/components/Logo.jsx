import React from 'react';

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

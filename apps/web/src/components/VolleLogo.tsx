import React from 'react';

export function VolleLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="currentColor" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Volle Logo"
    >
      {/* V */}
      <path d="M 5 10 L 14.5 10 L 25 34.5 L 35.5 10 L 45 10 L 30 45 L 20 45 Z" />
      
      {/* O */}
      <circle cx="73" cy="27.5" r="13" fill="none" stroke="currentColor" strokeWidth="9" />
      
      {/* L */}
      <path d="M 5 55 L 14 55 L 14 81 L 30 81 L 30 90 L 5 90 Z" />
      
      {/* L */}
      <path d="M 37 55 L 46 55 L 46 81 L 62 81 L 62 90 L 37 90 Z" />
      
      {/* E */}
      <path d="M 69 55 L 94 55 L 94 64 L 78 64 L 78 68 L 90 68 L 90 77 L 78 77 L 78 81 L 94 81 L 94 90 L 69 90 Z" />
    </svg>
  );
}

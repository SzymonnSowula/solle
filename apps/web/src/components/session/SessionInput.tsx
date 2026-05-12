'use client';

import { useState } from 'react';
import { Mic, ArrowRight } from 'lucide-react';

interface SessionInputProps {
  onStartSession: (input: string) => void;
  onStartVoice: () => void;
  disabled?: boolean;
  placeholder?: string;
  size?: 'lg' | 'md';
}

export function SessionInput({ onStartSession, onStartVoice, disabled, placeholder, size = 'md' }: SessionInputProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onStartSession(input.trim());
    setInput('');
  };

  const isLarge = size === 'lg';

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`
          relative flex items-center gap-3 rounded-xl border bg-neutral-950 shadow-sm transition-all duration-200
          ${isFocused ? 'border-black ring-1 ring-black/5 shadow-md' : 'border-white/10'}
          ${isLarge ? 'px-5 py-3.5' : 'px-4 py-3'}
        `}
      >
        <button
          type="button"
          onClick={onStartVoice}
          disabled={disabled}
          className={`
            flex shrink-0 items-center justify-center rounded-lg transition-all duration-200
            ${isLarge ? 'h-9 w-9' : 'h-8 w-8'}
            ${disabled ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-200 hover:text-white'}
          `}
          title="Start live voice"
        >
          <Mic className={isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || "Ask Volle anything..."}
          disabled={disabled}
          className={`
            flex-1 bg-transparent outline-none placeholder:text-neutral-400 text-white
            ${isLarge ? 'text-base py-1' : 'text-sm'}
          `}
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className={`
            flex shrink-0 items-center justify-center rounded-lg transition-all duration-200
            ${isLarge ? 'h-9 w-9' : 'h-8 w-8'}
            ${disabled || !input.trim()
              ? 'bg-neutral-800 text-neutral-300'
              : 'bg-red-500/100 text-white hover:bg-red-400'}
          `}
        >
          <ArrowRight className={isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        </button>
      </div>
    </form>
  );
}

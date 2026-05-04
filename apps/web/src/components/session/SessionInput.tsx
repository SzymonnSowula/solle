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
          relative flex items-center gap-3 rounded-2xl border bg-white shadow-sm transition-all duration-200
          ${isFocused ? 'border-teal-500 ring-2 ring-teal-500/10 shadow-md' : 'border-cream-300'}
          ${isLarge ? 'px-6 py-4' : 'px-4 py-3'}
        `}
      >
        <button
          type="button"
          onClick={onStartVoice}
          disabled={disabled}
          className={`
            flex shrink-0 items-center justify-center rounded-xl transition-all duration-200
            ${isLarge ? 'h-10 w-10' : 'h-8 w-8'}
            ${disabled ? 'bg-cream-200 text-cream-500' : 'bg-cream-100 text-ink-500 hover:bg-cream-200 hover:text-teal-600'}
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
          placeholder={placeholder || "Ask Solli anything..."}
          disabled={disabled}
          className={`
            flex-1 bg-transparent outline-none placeholder:text-ink-300 text-ink-800
            ${isLarge ? 'text-lg py-1' : 'text-base'}
          `}
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className={`
            flex shrink-0 items-center justify-center rounded-xl transition-all duration-200
            ${isLarge ? 'h-10 w-10' : 'h-8 w-8'}
            ${disabled || !input.trim()
              ? 'bg-cream-200 text-cream-500'
              : 'bg-ink-800 text-white hover:bg-ink-700'}
          `}
        >
          <ArrowRight className={isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        </button>
      </div>
    </form>
  );
}

'use client';

interface VoiceOrbProps {
  status: 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error';
}

export function VoiceOrb({ status }: VoiceOrbProps) {
  const isActive = status === 'connected' || status === 'listening' || status === 'speaking';
  const isListening = status === 'listening';
  const isSpeaking = status === 'speaking';

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer ring */}
      <div
        className={`
          h-20 w-20 rounded-full transition-all duration-500
          ${isListening ? 'bg-red-100 scale-110' : isSpeaking ? 'bg-red-200 scale-125' : isActive ? 'bg-red-50' : 'bg-cream-100'}
        `}
      />
      {/* Middle ring */}
      <div
        className={`
          absolute h-14 w-14 rounded-full transition-all duration-300
          ${isListening ? 'bg-red-200 scale-110' : isSpeaking ? 'bg-red-300 scale-125' : isActive ? 'bg-red-100' : 'bg-cream-200'}
        `}
      />
      {/* Core */}
      <div
        className={`
          absolute h-8 w-8 rounded-full transition-all duration-200
          ${isListening ? 'bg-red-500 animate-pulse' : isSpeaking ? 'bg-red-600 scale-125' : isActive ? 'bg-red-500' : 'bg-cream-300'}
        `}
      />
    </div>
  );
}

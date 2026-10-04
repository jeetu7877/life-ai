import React from 'react';

interface VoiceWaveformProps {
  isActive: boolean;
  color?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  isActive,
  color = 'bg-gradient-to-t from-[#00A8FF] to-[#00D9FF]'
}) => {
  return (
    <div className="flex items-center justify-center gap-1.5 h-10 px-4">
      {[0.4, 0.7, 1.0, 0.6, 0.9, 0.5, 0.8, 1.2, 0.6, 0.4].map((scale, i) => (
        <span
          key={i}
          className={`w-1 rounded-full transition-all duration-300 ${color} ${
            isActive ? 'animate-wave' : 'h-2 opacity-30 bg-[#202B3D]'
          }`}
          style={{
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${0.8 + (i % 3) * 0.2}s`,
            height: isActive ? `${Math.max(8, scale * 26)}px` : '4px'
          }}
        />
      ))}
    </div>
  );
};

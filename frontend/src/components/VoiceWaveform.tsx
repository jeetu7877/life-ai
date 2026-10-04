import React from 'react';

interface VoiceWaveformProps {
  isActive: boolean;
  inputVolume?: number; // 0.0 - 1.0 (Live microphone input)
  audioEnergy?: number; // 0.0 - 1.0 (Live TTS speaking energy)
  color?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  isActive,
  inputVolume = 0,
  audioEnergy = 0,
  color = 'from-[#00A8FF] to-[#00D9FF]'
}) => {
  // Use either active mic volume or TTS output energy
  const currentEnergy = Math.max(inputVolume, audioEnergy);
  const bars = [0.35, 0.6, 0.85, 0.5, 0.95, 0.75, 1.1, 0.9, 1.25, 0.8, 1.0, 0.65, 0.45, 0.3];

  return (
    <div className="flex items-center justify-center gap-1.5 h-10 px-4 select-none">
      {bars.map((scaleMultiplier, i) => {
        // Base idle height: 4px
        // When active: height scales directly with real-time sound energy
        let heightPx = 4;
        let opacity = 'opacity-35';

        if (isActive) {
          if (currentEnergy > 0.04) {
            // Live energy-driven height (up to 36px)
            heightPx = Math.min(38, Math.max(6, Math.round(currentEnergy * 32 * scaleMultiplier)));
            opacity = 'opacity-100';
          } else {
            // Subtle ambient breathing when listening/active but silent
            heightPx = 5 + (i % 3) * 2;
            opacity = 'opacity-60';
          }
        }

        return (
          <span
            key={i}
            className={`w-1 rounded-full transition-all duration-100 bg-gradient-to-t ${color} ${opacity}`}
            style={{
              height: `${heightPx}px`,
              transform: isActive && currentEnergy > 0.04 ? 'scaleY(1)' : 'scaleY(0.9)'
            }}
          />
        );
      })}
    </div>
  );
};

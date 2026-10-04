import React, { useEffect, useRef } from 'react';
import { VoiceState, DetailedVoiceState } from '../types';
import { voiceEngine } from '../services/voiceEngine';
import idleImage from '../assets/companion/companion-idle.jpg';
import speakingMouthImage from '../assets/companion/companion-mouth-open.png';
import eyelidsImage from '../assets/companion/companion-eyelids.png';

interface LivingAvatarProps {
  voiceState: VoiceState;
  detailedVoiceState: DetailedVoiceState;
  isConversationActive: boolean;
  isWakeWordEnabled: boolean;
  inputVolume?: number;
  className?: string;
  onClick?: () => void;
}

export const LivingAvatar: React.FC<LivingAvatarProps> = ({
  voiceState,
  detailedVoiceState,
  isConversationActive,
  isWakeWordEnabled,
  inputVolume = 0,
  className = '',
  onClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageGroupRef = useRef<HTMLDivElement>(null);
  const mouthRef = useRef<HTMLImageElement>(null);
  const eyelidsRef = useRef<HTMLImageElement>(null);

  // Keep state refs for 60fps RAF loop without triggering re-renders
  const stateRef = useRef({
    voiceState,
    detailedVoiceState,
    isConversationActive,
    inputVolume
  });

  useEffect(() => {
    stateRef.current = {
      voiceState,
      detailedVoiceState,
      isConversationActive,
      inputVolume
    };
  }, [voiceState, detailedVoiceState, isConversationActive, inputVolume]);

  useEffect(() => {
    let animId: number;
    let startTime = performance.now();

    // Blink state
    let nextBlinkTime = performance.now() + 2500 + Math.random() * 2500;
    let isBlinking = false;
    let blinkStartTime = 0;
    let isDoubleBlink = false;

    // Smoothed values
    let currentMouthOpenness = 0;
    let currentEyelidOpacity = 0;
    let currentHeadTilt = 0;
    let currentHeadY = 0;
    let currentScale = 1.0;

    const updateLoop = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const { voiceState: vs, inputVolume: iv } = stateRef.current;

      // =====================================================================
      // 1. BLINK TIMING & ENVELOPE (NATURAL HUMAN INTERVALS)
      // =====================================================================
      if (!isBlinking && now >= nextBlinkTime) {
        isBlinking = true;
        blinkStartTime = now;
        isDoubleBlink = Math.random() < 0.2; // 20% chance of double blink
      }

      let targetEyelid = 0;
      if (isBlinking) {
        const blinkElapsed = now - blinkStartTime;
        const blinkDuration = 160; // 160ms natural human blink

        if (blinkElapsed < 50) {
          // Closing: 0 -> 1
          targetEyelid = blinkElapsed / 50;
        } else if (blinkElapsed < 90) {
          // Closed hold
          targetEyelid = 1.0;
        } else if (blinkElapsed < blinkDuration) {
          // Re-opening: 1 -> 0
          targetEyelid = 1.0 - (blinkElapsed - 90) / 70;
        } else {
          // Blink finished
          targetEyelid = 0;
          isBlinking = false;
          if (isDoubleBlink) {
            nextBlinkTime = now + 140; // Immediate second blink
            isDoubleBlink = false;
          } else {
            // Next blink in 3.2s to 6s
            nextBlinkTime = now + 3200 + Math.random() * 2800;
          }
        }
      }

      currentEyelidOpacity += (targetEyelid - currentEyelidOpacity) * 0.45;
      if (eyelidsRef.current) {
        eyelidsRef.current.style.opacity = Math.max(0, Math.min(1, currentEyelidOpacity)).toFixed(3);
      }

      // =====================================================================
      // 2. REAL AUDIO-DRIVEN MOUTH LIP-SYNC ANIMATION
      // =====================================================================
      let targetMouth = 0;
      if (vs === 'speaking') {
        const audioEnergy = voiceEngine.getAudioEnergy();
        const isSpeakingSound = voiceEngine.getIsAudioSpeaking();

        if (isSpeakingSound && audioEnergy > 0.05) {
          // Map audio energy smoothly to mouth openness
          // audioEnergy is 0.0 to 1.0
          // Low: 0.2 - 0.4 (small syllables)
          // Med: 0.5 - 0.7 (normal voice)
          // High: 0.85 - 1.0 (loud vowels)
          targetMouth = Math.min(1.0, Math.max(0.18, audioEnergy * 1.35));
        } else {
          // Natural pause / silence between words
          targetMouth = 0.0;
        }
      } else {
        // Not speaking -> closed mouth
        targetMouth = 0.0;
      }

      // Smooth interpolation for elastic lip movement (prevents snapping)
      currentMouthOpenness += (targetMouth - currentMouthOpenness) * (vs === 'speaking' ? 0.32 : 0.4);
      if (currentMouthOpenness < 0.01) currentMouthOpenness = 0;

      if (mouthRef.current) {
        mouthRef.current.style.opacity = currentMouthOpenness.toFixed(3);
        // Subtle vertical lip stretch for expressive acoustic dynamics
        const mouthScaleY = 0.94 + 0.16 * currentMouthOpenness;
        mouthRef.current.style.transform = `scaleY(${mouthScaleY.toFixed(3)})`;
      }

      // =====================================================================
      // 3. SUBTLE NATURAL HEAD, BREATHING & POSTURE DYNAMICS
      // =====================================================================
      // Gentle natural breathing rhythm (period ~ 3.6 seconds)
      const breathingWave = Math.sin(elapsed * 1.74);
      let targetTilt = 0;
      let targetY = breathingWave * 1.2; // 1.2px subtle vertical breathing
      let targetScaleVal = 1.0 + breathingWave * 0.004;

      if (vs === 'listening') {
        // Attentive lean: slight forward scale + gentle tilt towards user
        targetTilt = 0.75;
        targetScaleVal = 1.012;
        targetY -= 1.5;

        // Reactive nod when user speaks loudly into mic
        if (iv > 0.15) {
          targetY += Math.min(3, iv * 4);
          targetTilt += 0.5;
        }
      } else if (vs === 'thinking') {
        // Thoughtful tilt in the other direction + slight upward gaze
        targetTilt = -1.2;
        targetY -= 2.0;
        targetScaleVal = 1.008;
      } else if (vs === 'speaking') {
        // Conversational head nod & cadence sway synced with speech rhythm
        const speechCadence = Math.sin(elapsed * 7.5); // ~1.2 Hz conversational sway
        const headNod = Math.sin(elapsed * 11.0);
        targetTilt = speechCadence * (0.4 + currentMouthOpenness * 0.6);
        targetY += headNod * (0.8 + currentMouthOpenness * 1.5);
        targetScaleVal = 1.008 + currentMouthOpenness * 0.006;
      } else if (vs === 'error') {
        targetTilt = -0.6;
        targetY += 1.0;
      }

      // Smoothly interpolate head transform
      currentHeadTilt += (targetTilt - currentHeadTilt) * 0.08;
      currentHeadY += (targetY - currentHeadY) * 0.08;
      currentScale += (targetScaleVal - currentScale) * 0.08;

      if (stageGroupRef.current) {
        stageGroupRef.current.style.transform = `translate3d(0, ${currentHeadY.toFixed(2)}px, 0) scale(${currentScale.toFixed(4)}) rotate(${currentHeadTilt.toFixed(2)}deg)`;
      }

      animId = requestAnimationFrame(updateLoop);
    };

    animId = requestAnimationFrame(updateLoop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`relative w-full h-full overflow-hidden select-none bg-black cursor-pointer flex items-center justify-center ${className}`}
      title="Tap companion to speak"
    >
      {/* Hardware-accelerated Character Stage Group */}
      <div
        ref={stageGroupRef}
        className="relative w-full h-full will-change-transform"
        style={{
          transformOrigin: '50% 65%',
          backfaceVisibility: 'hidden'
        }}
      >
        {/* Layer 1: Base Character Frame (Eyes open, gentle smile) */}
        <img
          src={idleImage}
          alt="Life AI Companion"
          className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
          draggable={false}
        />

        {/* Layer 2: Audio-Synchronized Speaking Mouth Overlay (Feathered Alpha) */}
        <img
          ref={mouthRef}
          src={speakingMouthImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none will-change-opacity"
          style={{
            opacity: 0,
            transformOrigin: '50% 56%'
          }}
          draggable={false}
        />

        {/* Layer 3: Natural Eye Blink Overlay (Feathered Alpha) */}
        <img
          ref={eyelidsRef}
          src={eyelidsImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none will-change-opacity"
          style={{
            opacity: 0
          }}
          draggable={false}
        />
      </div>

      {/* Subtle Cinematic Bottom Vignette Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/75 pointer-events-none z-10" />

      {/* Subtle Tech Scanline & Ambient State Sheen */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
        style={{
          background:
            voiceState === 'listening'
              ? 'radial-gradient(circle at 50% 40%, rgba(0, 217, 255, 0.08) 0%, transparent 70%)'
              : voiceState === 'thinking'
              ? 'radial-gradient(circle at 50% 40%, rgba(139, 92, 246, 0.08) 0%, transparent 70%)'
              : voiceState === 'speaking'
              ? 'radial-gradient(circle at 50% 40%, rgba(236, 72, 153, 0.08) 0%, transparent 70%)'
              : 'none'
        }}
      />
    </div>
  );
};

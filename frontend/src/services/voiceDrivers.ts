import { handsFreeService } from './handsFreeService';

export interface VoiceDriverCallbacks {
  onListeningStarted?: () => void;
  onListeningEnded?: () => void;
  onSpeechStarted?: () => void;
  onSpeechEnded?: () => void;
  onPartialResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onRmsUpdate?: (rmsdB: number) => void;
  onError?: (error: string) => void;
  onTtsFinished?: (utteranceId: string) => void;
  onStateChanged?: (state: string) => void;
}

export interface IVoiceEngineDriver {
  readonly name: 'AndroidVoiceEngine' | 'WebVoiceEngine';
  init(callbacks: VoiceDriverCallbacks): Promise<void>;
  startListening(): Promise<boolean>;
  stopListening(): Promise<boolean>;
  isListening(): Promise<boolean>;
  getPermissionStatus(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  openSettings(): Promise<void>;
  speak(text: string, utteranceId?: string): Promise<boolean>;
  stopSpeaking(): Promise<boolean>;
  destroy(): void;
}

/**
 * AndroidVoiceEngine:
 * High-performance, battery-conscious driver utilizing native Android SpeechRecognizer
 * and TextToSpeech through the HandsFreeVoice foreground service plugin.
 * Never touches WebView SpeechRecognition or getUserMedia to guarantee 100% Android stability.
 */
export class AndroidVoiceEngine implements IVoiceEngineDriver {
  public readonly name = 'AndroidVoiceEngine' as const;
  private callbacks: VoiceDriverCallbacks = {};
  private listeners: any[] = [];
  private isDestroyed = false;

  public async init(callbacks: VoiceDriverCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.cleanListeners();

    try {
      const l1 = await handsFreeService.addListener('transcriptUpdate', (data: { transcript: string; isFinal: boolean }) => {
        if (this.isDestroyed) return;
        if (data.isFinal) {
          console.log('[ANDROID-VOICE] final result: ' + data.transcript);
          console.log('[ANDROID-VOICE] transcript received: ' + data.transcript);
          this.callbacks.onFinalResult?.(data.transcript);
        } else {
          console.log('[ANDROID-VOICE] partial result: ' + data.transcript);
          this.callbacks.onPartialResult?.(data.transcript);
        }
      });
      this.listeners.push(l1);

      const l2 = await handsFreeService.addListener('rmsUpdate', (data: { rmsdB: number }) => {
        if (this.isDestroyed) return;
        this.callbacks.onRmsUpdate?.(data.rmsdB);
      });
      this.listeners.push(l2);

      const l3 = await handsFreeService.addListener('voiceStateChanged', (data: { state: string }) => {
        if (this.isDestroyed) return;
        this.callbacks.onStateChanged?.(data.state);
        if (data.state === 'user_listening') {
          this.callbacks.onListeningStarted?.();
        } else if (data.state === 'stopped') {
          this.callbacks.onListeningEnded?.();
        }
      });
      this.listeners.push(l3);

      const l4 = await handsFreeService.addListener('voiceError', (data: { error: string }) => {
        if (this.isDestroyed) return;
        console.warn('[ANDROID-VOICE] recognition error: ' + data.error);
        this.callbacks.onError?.(data.error);
      });
      this.listeners.push(l4);

      const l5 = await handsFreeService.addListener('ttsFinished', (data: { utteranceId: string }) => {
        if (this.isDestroyed) return;
        console.log('[ANDROID-VOICE] TTS finished: ' + data.utteranceId);
        this.callbacks.onTtsFinished?.(data.utteranceId);
      });
      this.listeners.push(l5);
    } catch (e) {
      console.warn('[ANDROID-VOICE] Failed to register native listeners:', e);
    }
  }

  public async startListening(): Promise<boolean> {
    console.log('[ANDROID-VOICE] listening started');
    return await handsFreeService.startListening();
  }

  public async stopListening(): Promise<boolean> {
    console.log('[ANDROID-VOICE] recognition ended');
    return await handsFreeService.stopListening();
  }

  public async isListening(): Promise<boolean> {
    return await handsFreeService.isListening();
  }

  public async getPermissionStatus(): Promise<boolean> {
    const res = await handsFreeService.checkPermissions();
    return res.microphone;
  }

  public async requestPermission(): Promise<boolean> {
    const granted = await handsFreeService.requestMicPermission();
    if (granted) {
      console.log('[ANDROID-VOICE] permission granted');
    }
    return granted;
  }

  public async openSettings(): Promise<void> {
    await handsFreeService.openAppSettings();
  }

  public async speak(text: string, utteranceId?: string): Promise<boolean> {
    console.log('[ANDROID-VOICE] TTS started: ' + (utteranceId || 'direct'));
    return await handsFreeService.speak(text, utteranceId);
  }

  public async stopSpeaking(): Promise<boolean> {
    return await handsFreeService.stopSpeaking();
  }

  private cleanListeners(): void {
    for (const l of this.listeners) {
      try {
        if (typeof l?.remove === 'function') l.remove();
      } catch (_) {}
    }
    this.listeners = [];
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.cleanListeners();
  }
}

/**
 * WebVoiceEngine:
 * Preserves 100% of browser Web Speech API & Web Audio API functionality for desktop and mobile browsers.
 */
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

export class WebVoiceEngine implements IVoiceEngineDriver {
  public readonly name = 'WebVoiceEngine' as const;
  private callbacks: VoiceDriverCallbacks = {};
  private recognition: any = null;
  private isListeningActive = false;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  public async init(callbacks: VoiceDriverCallbacks): Promise<void> {
    this.callbacks = callbacks;
    const SpeechRecognitionClass =
      (window as unknown as IWindow).SpeechRecognition ||
      (window as unknown as IWindow).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-IN'; // Indian English / Roman Hinglish

      this.recognition.onstart = () => {
        this.isListeningActive = true;
        this.callbacks.onListeningStarted?.();
      };

      this.recognition.onspeechstart = () => {
        this.callbacks.onSpeechStarted?.();
      };

      this.recognition.onspeechend = () => {
        this.callbacks.onSpeechEnded?.();
      };

      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = res[0].transcript;
          if (res.isFinal) {
            this.callbacks.onFinalResult?.(text);
          } else {
            this.callbacks.onPartialResult?.(text);
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        this.callbacks.onError?.(event.error || 'Recognition error');
      };

      this.recognition.onend = () => {
        this.isListeningActive = false;
        this.callbacks.onListeningEnded?.();
      };
    }
  }

  public async startListening(): Promise<boolean> {
    if (!this.recognition) return false;
    try {
      this.recognition.start();
      this.isListeningActive = true;
      this.startAudioMeter().catch(() => {});
      return true;
    } catch (e: any) {
      if (e.name === 'InvalidStateError') {
        return true;
      }
      return false;
    }
  }

  public async stopListening(): Promise<boolean> {
    if (!this.recognition) return false;
    try {
      this.recognition.stop();
      this.isListeningActive = false;
      this.stopAudioMeter();
      return true;
    } catch (_) {
      return false;
    }
  }

  public async isListening(): Promise<boolean> {
    return this.isListeningActive;
  }

  public async getPermissionStatus(): Promise<boolean> {
    try {
      if (navigator.permissions && (navigator.permissions as any).query) {
        const res = await (navigator.permissions as any).query({ name: 'microphone' });
        return res.state === 'granted';
      }
    } catch (_) {}
    return true;
  }

  public async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (_) {
      return false;
    }
  }

  public async openSettings(): Promise<void> {
    // Browser settings not programmatically openable
  }

  public async speak(text: string, utteranceId?: string): Promise<boolean> {
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-IN';
    utt.onend = () => {
      this.callbacks.onTtsFinished?.(utteranceId || 'web_tts');
    };
    utt.onerror = () => {
      this.callbacks.onTtsFinished?.(utteranceId || 'web_tts');
    };
    window.speechSynthesis.speak(utt);
    return true;
  }

  public async stopSpeaking(): Promise<boolean> {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    return true;
  }

  private async startAudioMeter(): Promise<void> {
    try {
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const checkLevel = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1.0, avg / 128);
        this.callbacks.onRmsUpdate?.(normalized);
        this.animFrameId = requestAnimationFrame(checkLevel);
      };
      checkLevel();
    } catch (_) {}
  }

  private stopAudioMeter(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  public destroy(): void {
    this.stopListening();
    this.stopSpeaking();
  }
}

import { registerPlugin, Capacitor } from '@capacitor/core';
import { getServerHostUrl } from './api';

export type NativeVoiceState = 
  | 'stopped' 
  | 'wake_listening' 
  | 'wake_detected' 
  | 'greeting' 
  | 'user_listening' 
  | 'processing' 
  | 'tts' 
  | 'cooldown' 
  | 'error' 
  | 'idle' 
  | 'listening' 
  | 'speaking';

export interface HandsFreeVoicePlugin {
  startHandsFree(options: {
    serverUrl?: string;
    token?: string;
    wakeWord?: string;
    voiceResponse?: boolean;
    silenceTimeout?: number;
  }): Promise<{ success: boolean; running: boolean; wakeWord?: string }>;

  stopHandsFree(): Promise<{ success: boolean; running: boolean }>;

  isHandsFreeRunning(): Promise<{ running: boolean; state: string }>;

  triggerListen(): Promise<{ success: boolean }>;

  checkPermissions(): Promise<{ microphone: boolean; notifications: boolean }>;

  requestMicPermission(): Promise<{ granted: boolean }>;

  openAppSettings(): Promise<{ success: boolean }>;

  updateAuth(options: { token?: string; serverUrl?: string }): Promise<{ success: boolean }>;

  setMusicPlaying(options: { playing: boolean }): Promise<{ success: boolean }>;

  checkBatteryOptimization(): Promise<{ isIgnoringBatteryOptimizations: boolean }>;

  requestIgnoreBatteryOptimization(): Promise<{ success: boolean }>;

  addListener(
    eventName: 'voiceStateChanged',
    listenerFunc: (data: { state: string }) => void
  ): Promise<any>;

  addListener(
    eventName: 'transcriptUpdate',
    listenerFunc: (data: { transcript: string; isFinal: boolean }) => void
  ): Promise<any>;

  addListener(
    eventName: 'assistantResponse',
    listenerFunc: (data: { response: string; conversationId?: string }) => void
  ): Promise<any>;

  addListener(
    eventName: 'rmsUpdate',
    listenerFunc: (data: { rmsdB: number }) => void
  ): Promise<any>;

  addListener(
    eventName: 'voiceError',
    listenerFunc: (data: { error: string }) => void
  ): Promise<any>;
}

const NativeHandsFree = registerPlugin<HandsFreeVoicePlugin>('HandsFreeVoice');

class HandsFreeService {
  private isNative: boolean = false;

  constructor() {
    this.isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  public isNativeAvailable(): boolean {
    return this.isNative;
  }

  public isEnabledLocally(): boolean {
    const val = localStorage.getItem('life_hands_free_enabled');
    return val === 'true';
  }

  public setEnabledLocally(enabled: boolean): void {
    localStorage.setItem('life_hands_free_enabled', enabled ? 'true' : 'false');
  }

  public getWakeWord(): string {
    return localStorage.getItem('life_wake_word') || 'Hey Life';
  }

  public setWakeWord(word: string): void {
    localStorage.setItem('life_wake_word', word);
  }

  public isVoiceResponseEnabled(): boolean {
    const val = localStorage.getItem('life_voice_response_enabled');
    return val !== 'false'; // default true
  }

  public setVoiceResponseEnabled(enabled: boolean): void {
    localStorage.setItem('life_voice_response_enabled', enabled ? 'true' : 'false');
  }

  public async start(): Promise<boolean> {
    const token = localStorage.getItem('life_token') || localStorage.getItem('jeet_token') || '';
    const serverUrl = getServerHostUrl();
    const wakeWord = this.getWakeWord();
    const voiceResponse = this.isVoiceResponseEnabled();

    if (this.isNative) {
      try {
        const res = await NativeHandsFree.startHandsFree({
          serverUrl,
          token,
          wakeWord,
          voiceResponse
        });
        this.setEnabledLocally(true);
        return res.running;
      } catch (err) {
        console.error('Failed to start native HandsFreeVoice service:', err);
        throw err;
      }
    } else {
      // In web browser, mark enabled locally
      this.setEnabledLocally(true);
      return true;
    }
  }

  public async triggerListen(): Promise<boolean> {
    if (this.isNative) {
      try {
        const res = await NativeHandsFree.triggerListen();
        return res.success;
      } catch (err) {
        console.error('Failed to trigger native listen:', err);
        throw err;
      }
    }
    return false;
  }

  public async checkPermissions(): Promise<{ microphone: boolean; notifications: boolean }> {
    if (this.isNative) {
      try {
        return await NativeHandsFree.checkPermissions();
      } catch (err) {
        console.warn('Failed to check native permissions:', err);
        return { microphone: false, notifications: false };
      }
    }
    return { microphone: true, notifications: true };
  }

  public async requestMicPermission(): Promise<boolean> {
    if (this.isNative) {
      try {
        const res = await NativeHandsFree.requestMicPermission();
        return res.granted;
      } catch (err) {
        console.warn('Failed to request mic permission:', err);
        return false;
      }
    }
    return true;
  }

  public async openAppSettings(): Promise<void> {
    if (this.isNative) {
      try {
        await NativeHandsFree.openAppSettings();
      } catch (err) {
        console.warn('Failed to open app settings:', err);
      }
    }
  }

  public async stop(): Promise<boolean> {
    this.setEnabledLocally(false);
    if (this.isNative) {
      try {
        const res = await NativeHandsFree.stopHandsFree();
        return !res.running;
      } catch (err) {
        console.error('Failed to stop native HandsFreeVoice service:', err);
        return false;
      }
    }
    return true;
  }

  public async isRunning(): Promise<boolean> {
    if (this.isNative) {
      try {
        const res = await NativeHandsFree.isHandsFreeRunning();
        return res.running;
      } catch (_) {
        return false;
      }
    }
    return this.isEnabledLocally();
  }

  public async updateAuth(): Promise<void> {
    if (this.isNative) {
      const token = localStorage.getItem('life_token') || localStorage.getItem('jeet_token') || '';
      const serverUrl = getServerHostUrl();
      try {
        await NativeHandsFree.updateAuth({ token, serverUrl });
      } catch (e) {
        console.warn('updateAuth failed:', e);
      }
    }
  }

  public async setMusicPlaying(playing: boolean): Promise<void> {
    if (this.isNative) {
      try {
        await NativeHandsFree.setMusicPlaying({ playing });
      } catch (_) {}
    }
  }

  public async getState(): Promise<string> {
    if (this.isNative) {
      try {
        const res = await NativeHandsFree.isHandsFreeRunning();
        return res.state || (res.running ? 'wake_listening' : 'stopped');
      } catch (_) {
        return 'stopped';
      }
    }
    return this.isEnabledLocally() ? 'wake_listening' : 'stopped';
  }

  public async checkBatteryOptimization(): Promise<boolean> {
    if (this.isNative) {
      try {
        const res = await NativeHandsFree.checkBatteryOptimization();
        return res.isIgnoringBatteryOptimizations;
      } catch (e) {
        console.warn('checkBatteryOptimization failed:', e);
        return true;
      }
    }
    return true;
  }

  public async requestIgnoreBatteryOptimization(): Promise<void> {
    if (this.isNative) {
      try {
        await NativeHandsFree.requestIgnoreBatteryOptimization();
      } catch (e) {
        console.warn('requestIgnoreBatteryOptimization failed:', e);
      }
    }
  }

  public addListener(
    eventName: 'voiceStateChanged' | 'transcriptUpdate' | 'assistantResponse' | 'rmsUpdate' | 'voiceError',
    callback: (data: any) => void
  ) {
    if (this.isNative) {
      return NativeHandsFree.addListener(eventName as any, callback);
    }
    return Promise.resolve({ remove: () => {} });
  }
}

export const handsFreeService = new HandsFreeService();

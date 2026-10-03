import { registerPlugin, Capacitor } from '@capacitor/core';
import { getServerHostUrl } from './api';

export type NativeVoiceState = 'idle' | 'wake_detected' | 'listening' | 'processing' | 'speaking' | 'cooldown';

export interface HandsFreeVoicePlugin {
  startHandsFree(options: {
    serverUrl?: string;
    token?: string;
    wakeWord?: string;
    voiceResponse?: boolean;
  }): Promise<{ success: boolean; running: boolean; wakeWord?: string }>;

  stopHandsFree(): Promise<{ success: boolean; running: boolean }>;

  isHandsFreeRunning(): Promise<{ running: boolean; state: string }>;

  updateAuth(options: { token?: string; serverUrl?: string }): Promise<{ success: boolean }>;

  addListener(
    eventName: 'voiceStateChanged',
    listenerFunc: (data: { state: NativeVoiceState }) => void
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

  public addListener(
    eventName: 'voiceStateChanged' | 'transcriptUpdate' | 'assistantResponse' | 'voiceError',
    callback: (data: any) => void
  ) {
    if (this.isNative) {
      return NativeHandsFree.addListener(eventName as any, callback);
    }
    return Promise.resolve({ remove: () => {} });
  }
}

export const handsFreeService = new HandsFreeService();

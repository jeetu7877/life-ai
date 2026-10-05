import { registerPlugin, Capacitor } from '@capacitor/core';
import { api } from './api';

export interface AlarmItem {
  id: string;
  timeStr: string;         // e.g. "06:00 AM"
  triggerMillis: number;   // Epoch timestamp for next ring
  label: string;           // e.g. "Wake Up"
  days?: string[];         // ["Mon", "Tue"]
  enabled: boolean;
  sound?: boolean;
  vibrate?: boolean;
}

interface AlarmPluginInterface {
  setAlarm(options: {
    id?: string;
    triggerMillis: number;
    timeStr: string;
    label?: string;
    sound?: boolean;
    vibrate?: boolean;
  }): Promise<{ success: boolean; id: string; triggerMillis: number; timeStr: string; label: string }>;
  cancelAlarm(options: { id: string }): Promise<{ success: boolean; id: string }>;
  getAlarms(): Promise<{ alarms: any[] }>;
  testAlarm(): Promise<{ success: boolean; message: string }>;
  dismissActiveAlarm(): Promise<{ success: boolean }>;
  canScheduleExactAlarms(): Promise<{ canSchedule: boolean }>;
  openAlarmSettings(): Promise<{ opened: boolean }>;
}

const NativeAlarm = registerPlugin<AlarmPluginInterface>('AlarmPlugin');

class AlarmService {
  private static instance: AlarmService;
  private localStoreKey = 'life_ai_web_alarms';

  private constructor() {}

  public static getInstance(): AlarmService {
    if (!AlarmService.instance) {
      AlarmService.instance = new AlarmService();
    }
    return AlarmService.instance;
  }

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Retrieves all alarms, preferring native storage on Android,
   * falling back to local web storage and syncing with backend.
   */
  public async getAlarms(): Promise<AlarmItem[]> {
    let items: AlarmItem[] = [];

    if (this.isNative()) {
      try {
        const res = await NativeAlarm.getAlarms();
        if (res && Array.isArray(res.alarms)) {
          items = res.alarms.map((a: any) => ({
            id: String(a.id),
            timeStr: a.timeStr || '',
            triggerMillis: Number(a.triggerMillis || 0),
            label: a.label || 'Alarm',
            enabled: a.enabled !== false,
            sound: a.sound !== false,
            vibrate: a.vibrate !== false
          }));
        }
      } catch (err) {
        console.warn('[ALARM] Native getAlarms error:', err);
      }
    }

    if (items.length === 0) {
      try {
        const raw = localStorage.getItem(this.localStoreKey);
        if (raw) {
          items = JSON.parse(raw);
        }
      } catch (e) {
        console.warn('[ALARM] Web localStorage read error:', e);
      }
    }

    // Background sync with backend API if online
    if (navigator.onLine) {
      api.getAlarms?.()
        .then((remoteAlarms: any[]) => {
          if (Array.isArray(remoteAlarms) && remoteAlarms.length > 0 && items.length === 0) {
            // Restore from remote
            const converted = remoteAlarms.map((r: any) => ({
              id: r.id,
              timeStr: r.time_str,
              triggerMillis: r.timestamp_ms || Date.now() + 3600000,
              label: r.label,
              days: r.days,
              enabled: r.enabled,
              sound: r.sound,
              vibrate: r.vibrate
            }));
            this.saveLocalWebAlarms(converted);
          }
        })
        .catch(() => {});
    }

    return items;
  }

  /**
   * Schedules a new alarm or updates an existing one.
   */
  public async setAlarm(alarm: Partial<AlarmItem>): Promise<AlarmItem> {
    const id = alarm.id || `alarm_${Date.now()}`;
    const timeStr = alarm.timeStr || '07:00 AM';
    const label = alarm.label || 'Alarm';
    const sound = alarm.sound !== false;
    const vibrate = alarm.vibrate !== false;
    const enabled = alarm.enabled !== false;

    let triggerMillis = alarm.triggerMillis;
    if (!triggerMillis || triggerMillis <= Date.now()) {
      triggerMillis = this.calculateNextTriggerMillis(timeStr);
    }

    const fullItem: AlarmItem = {
      id,
      timeStr,
      triggerMillis,
      label,
      days: alarm.days || [],
      enabled,
      sound,
      vibrate
    };

    // 1. Android Native AlarmManager
    if (this.isNative()) {
      try {
        await NativeAlarm.setAlarm({
          id,
          triggerMillis,
          timeStr,
          label,
          sound,
          vibrate
        });
        console.log('[ALARM] Native Alarm scheduled successfully for', timeStr);
      } catch (nativeErr) {
        console.error('[ALARM] Native alarm schedule failed:', nativeErr);
      }
    } else {
      // Browser fallback (Web Audio tone simulator)
      this.scheduleWebNotification(fullItem);
    }

    // 2. Local Web Cache
    const all = await this.getAlarms();
    const idx = all.findIndex((x) => x.id === id);
    if (idx >= 0) {
      all[idx] = fullItem;
    } else {
      all.push(fullItem);
    }
    this.saveLocalWebAlarms(all);

    // 3. Backend PostgreSQL sync
    if (navigator.onLine) {
      api.createAlarm?.({
        id: fullItem.id,
        time_str: fullItem.timeStr,
        timestamp_ms: fullItem.triggerMillis,
        label: fullItem.label,
        days: fullItem.days,
        enabled: fullItem.enabled,
        sound: fullItem.sound,
        vibrate: fullItem.vibrate
      }).catch((e) => console.warn('[ALARM] Backend sync notice:', e));
    }

    return fullItem;
  }

  /**
   * Toggle enable / disable status of an alarm.
   */
  public async toggleAlarm(id: string, enabled: boolean): Promise<AlarmItem | null> {
    const alarms = await this.getAlarms();
    const item = alarms.find((a) => a.id === id);
    if (!item) return null;

    item.enabled = enabled;
    if (enabled) {
      item.triggerMillis = this.calculateNextTriggerMillis(item.timeStr);
      if (this.isNative()) {
        try {
          await NativeAlarm.setAlarm({
            id: item.id,
            triggerMillis: item.triggerMillis,
            timeStr: item.timeStr,
            label: item.label,
            sound: item.sound,
            vibrate: item.vibrate
          });
        } catch (e) {
          console.warn('[ALARM] Toggle native error:', e);
        }
      }
    } else {
      if (this.isNative()) {
        try {
          await NativeAlarm.cancelAlarm({ id: item.id });
        } catch (e) {
          console.warn('[ALARM] Cancel native error:', e);
        }
      }
    }

    this.saveLocalWebAlarms(alarms);

    if (navigator.onLine) {
      api.updateAlarm?.(id, { enabled }).catch(() => {});
    }

    return item;
  }

  /**
   * Delete an alarm permanently.
   */
  public async deleteAlarm(id: string): Promise<void> {
    if (this.isNative()) {
      try {
        await NativeAlarm.cancelAlarm({ id });
      } catch (e) {
        console.warn('[ALARM] Native delete error:', e);
      }
    }

    const alarms = (await this.getAlarms()).filter((a) => a.id !== id);
    this.saveLocalWebAlarms(alarms);

    if (navigator.onLine) {
      api.deleteAlarm?.(id).catch(() => {});
    }
  }

  /**
   * Test native alarm ring (sounds for 5s to verify audio & vibration).
   */
  public async testAlarm(): Promise<void> {
    if (this.isNative()) {
      await NativeAlarm.testAlarm();
    } else {
      // Play web audio beep test
      this.playWebAudioTestBeep();
    }
  }

  /**
   * Dismiss active ringing alarm.
   */
  public async dismissActiveAlarm(): Promise<void> {
    if (this.isNative()) {
      try {
        await NativeAlarm.dismissActiveAlarm();
      } catch (e) {
        console.warn('[ALARM] Dismiss active error:', e);
      }
    }
  }

  /**
   * Snooze alarm for specified minutes (default 5).
   */
  public async snoozeAlarm(id: string, minutes: number = 5): Promise<void> {
    const alarms = await this.getAlarms();
    const item = alarms.find((a) => a.id === id);
    const snoozeMillis = Date.now() + minutes * 60 * 1000;

    await this.setAlarm({
      id: `snooze_${Date.now()}`,
      timeStr: `Snooze (+${minutes}m)`,
      label: item ? `Snoozed: ${item.label}` : 'Snoozed Alarm',
      triggerMillis: snoozeMillis,
      enabled: true,
      sound: true,
      vibrate: true
    });
  }

  // ==================== HELPER METHODS ====================

  public calculateNextTriggerMillis(timeStr: string): number {
    const now = new Date();
    const parts = timeStr.trim().split(/[:\s]/);
    let hours = parseInt(parts[0], 10) || 7;
    const minutes = parseInt(parts[1], 10) || 0;
    const isPM = timeStr.toLowerCase().includes('pm');
    const isAM = timeStr.toLowerCase().includes('am');

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }

  private saveLocalWebAlarms(list: AlarmItem[]): void {
    try {
      localStorage.setItem(this.localStoreKey, JSON.stringify(list));
    } catch (_) {}
  }

  private scheduleWebNotification(alarm: AlarmItem): void {
    const diff = alarm.triggerMillis - Date.now();
    if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        this.playWebAudioTestBeep();
        if (Notification.permission === 'granted') {
          new Notification(`⏰ ${alarm.label}`, {
            body: `Alarm is ringing! Time: ${alarm.timeStr}`,
            requireInteraction: true
          });
        }
      }, diff);
    }
  }

  private playWebAudioTestBeep(): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime + 0.3); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.3);
    } catch (_) {}
  }
}

export const alarmService = AlarmService.getInstance();

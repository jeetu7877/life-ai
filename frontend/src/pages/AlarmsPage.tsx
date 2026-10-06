import React, { useState, useEffect } from 'react';
import {
  AlarmClock,
  Plus,
  Trash2,
  BellRing,
  Volume2,
  Vibrate,
  Check,
  X,
  Sparkles,
  Info,
  Clock,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { alarmService, AlarmItem } from '../services/alarmService';

export const AlarmsPage: React.FC = () => {
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [activeAlarmTab, setActiveAlarmTab] = useState<'Alarms' | 'Reminders' | 'Routines'>('Alarms');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // New Alarm Form State
  const [formTime, setFormTime] = useState<string>('06:00');
  const [formPeriod, setFormPeriod] = useState<'AM' | 'PM'>('AM');
  const [formLabel, setFormLabel] = useState<string>('Wake Up');
  const [formVibrate, setFormVibrate] = useState<boolean>(true);
  const [formSound, setFormSound] = useState<boolean>(true);

  const isNative = alarmService.isNative();

  const loadAlarms = async () => {
    setIsLoading(true);
    try {
      const list = await alarmService.getAlarms();
      setAlarms(list);
    } catch (err) {
      console.error('Failed to load alarms:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlarms();
  }, []);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const updated = await alarmService.toggleAlarm(id, !currentStatus);
    if (updated) {
      setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !currentStatus } : a)));
    }
  };

  const handleDelete = async (id: string) => {
    await alarmService.deleteAlarm(id);
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const handleCreateAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    const timeStr = `${formTime} ${formPeriod}`;
    const nextTrigger = alarmService.calculateNextTriggerMillis(timeStr);

    const newAlarm = await alarmService.setAlarm({
      timeStr,
      triggerMillis: nextTrigger,
      label: formLabel.trim() || 'Alarm',
      enabled: true,
      sound: formSound,
      vibrate: formVibrate
    });

    setAlarms((prev) => [newAlarm, ...prev.filter((a) => a.id !== newAlarm.id)]);
    setIsModalOpen(false);
    setFormLabel('Wake Up');
  };

  const handleQuickPreset = async (presetTime: string, label: string) => {
    const nextTrigger = alarmService.calculateNextTriggerMillis(presetTime);
    const newAlarm = await alarmService.setAlarm({
      timeStr: presetTime,
      triggerMillis: nextTrigger,
      label,
      enabled: true,
      sound: true,
      vibrate: true
    });
    setAlarms((prev) => [newAlarm, ...prev.filter((a) => a.id !== newAlarm.id)]);
  };

  const handleTestAlarm = async () => {
    setTestStatus('Scheduling 4-second test alarm...');
    try {
      await alarmService.testAlarm();
      setTestStatus('Test alarm triggered! Phone will ring in 4 seconds.');
      setTimeout(() => setTestStatus(null), 7000);
    } catch (e: any) {
      setTestStatus('Test failed: ' + (e?.message || 'Unknown error'));
      setTimeout(() => setTestStatus(null), 5000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 max-w-4xl mx-auto w-full custom-scrollbar pb-24 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
              <AlarmClock size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Smart Alarms
                <span className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                  OS-Level Native
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Guaranteed to ring even when phone is locked, app is closed, or Render is sleeping.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleTestAlarm}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-300 border border-slate-700 active:scale-95 transition-all"
            title="Ring test alarm in 4 seconds"
          >
            <Zap size={14} className="text-yellow-400" />
            Test Ring (4s)
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
          >
            <Plus size={16} />
            Add Alarm
          </button>
        </div>
      </div>

      {/* Test Notification Banner */}
      {testStatus && (
        <div className="mb-4 p-3 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-xs flex items-center gap-2 animate-pulse">
          <Sparkles size={16} className="text-cyan-400 shrink-0" />
          <span>{testStatus}</span>
        </div>
      )}

      {/* Android Device Status Card */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 to-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">
              {isNative ? 'Android AlarmManager Active' : 'Web Preview Alarm Mode'}
            </h4>
            <p className="text-[11px] text-slate-400">
              {isNative
                ? 'Registered with native Android exact alarm clock & boot survival.'
                : 'Running on web browser with audio simulator and local storage.'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Voice Tip */}
      <div className="mb-6 p-3.5 rounded-2xl bg-[#0F172A]/70 border border-[#202B3D] flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
          <Sparkles size={16} />
        </div>
        <div className="text-xs">
          <span className="font-semibold text-slate-200">Voice Control Enabled: </span>
          <span className="text-slate-400">
            Say <span className="text-cyan-300 font-medium">"Hey Life, mujhe kal subah 6 baje utha dena"</span> or{' '}
            <span className="text-cyan-300 font-medium">"Life, alarm band karo"</span> hands-free anytime!
          </span>
        </div>
      </div>

      {/* Screen 4: Navigation Tabs (Alarms, Reminders, Routines) */}
      <div className="flex items-center gap-2 mb-5">
        {(['Alarms', 'Reminders', 'Routines'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveAlarmTab(tab)}
            className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
              activeAlarmTab === tab
                ? 'bg-gradient-to-r from-[#00A8FF]/20 to-[#8B5CF6]/20 text-[#00D9FF] border border-[#00D9FF]/40 shadow-[0_0_15px_rgba(0,217,255,0.2)]'
                : 'bg-[#101722] border border-[#202B3D] text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Screen 4: Quick Action Modes (Sleep, Focus, Pomodoro, Habit) */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
          Quick Modes
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => handleQuickPreset('10:30 PM', 'Bedtime Sleep Routine')}
            className="p-3 rounded-2xl bg-[#0E1622] hover:bg-[#141C28] border border-[#202B3D] hover:border-[#00D9FF]/40 text-left transition-all active:scale-95 group shadow-sm"
          >
            <div className="text-sm font-bold text-white group-hover:text-[#00D9FF]">Sleep</div>
            <div className="text-[10px] text-slate-400">10:30 PM Bedtime</div>
          </button>
          <button
            onClick={async () => {
              const target = Date.now() + 45 * 60 * 1000;
              const date = new Date(target);
              const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
              const newAlarm = await alarmService.setAlarm({
                timeStr,
                triggerMillis: target,
                label: '45-Min Deep Focus',
                enabled: true,
                sound: true,
                vibrate: true
              });
              setAlarms((prev) => [newAlarm, ...prev.filter((a) => a.id !== newAlarm.id)]);
            }}
            className="p-3 rounded-2xl bg-[#0E1622] hover:bg-[#141C28] border border-[#202B3D] hover:border-purple-500/40 text-left transition-all active:scale-95 group shadow-sm"
          >
            <div className="text-sm font-bold text-purple-400">Focus</div>
            <div className="text-[10px] text-slate-400">+45 Mins Sprint</div>
          </button>
          <button
            onClick={async () => {
              const target = Date.now() + 25 * 60 * 1000;
              const date = new Date(target);
              const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
              const newAlarm = await alarmService.setAlarm({
                timeStr,
                triggerMillis: target,
                label: 'Pomodoro Interval',
                enabled: true,
                sound: true,
                vibrate: true
              });
              setAlarms((prev) => [newAlarm, ...prev.filter((a) => a.id !== newAlarm.id)]);
            }}
            className="p-3 rounded-2xl bg-[#0E1622] hover:bg-[#141C28] border border-[#202B3D] hover:border-amber-500/40 text-left transition-all active:scale-95 group shadow-sm"
          >
            <div className="text-sm font-bold text-amber-400">Pomodoro</div>
            <div className="text-[10px] text-slate-400">+25 Mins Work</div>
          </button>
          <button
            onClick={() => handleQuickPreset('07:00 AM', 'Daily Morning Habit')}
            className="p-3 rounded-2xl bg-[#0E1622] hover:bg-[#141C28] border border-[#202B3D] hover:border-emerald-500/40 text-left transition-all active:scale-95 group shadow-sm"
          >
            <div className="text-sm font-bold text-emerald-400">Habit</div>
            <div className="text-[10px] text-slate-400">07:00 AM Morning</div>
          </button>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
          Quick Presets
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => handleQuickPreset('06:00 AM', 'Subah 6:00 AM')}
            className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-all active:scale-95 group"
          >
            <div className="text-sm font-bold text-white group-hover:text-cyan-400">06:00 AM</div>
            <div className="text-[10px] text-slate-400">Early Morning</div>
          </button>
          <button
            onClick={() => handleQuickPreset('07:00 AM', 'Subah 7:00 AM')}
            className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-all active:scale-95 group"
          >
            <div className="text-sm font-bold text-white group-hover:text-cyan-400">07:00 AM</div>
            <div className="text-[10px] text-slate-400">Morning Start</div>
          </button>
          <button
            onClick={() => handleQuickPreset('08:00 AM', 'Subah 8:00 AM')}
            className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-all active:scale-95 group"
          >
            <div className="text-sm font-bold text-white group-hover:text-cyan-400">08:00 AM</div>
            <div className="text-[10px] text-slate-400">Work Routine</div>
          </button>
          <button
            onClick={async () => {
              const target = Date.now() + 20 * 60 * 1000;
              const date = new Date(target);
              const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
              const newAlarm = await alarmService.setAlarm({
                timeStr,
                triggerMillis: target,
                label: '20-Min Power Nap',
                enabled: true,
                sound: true,
                vibrate: true
              });
              setAlarms((prev) => [newAlarm, ...prev.filter((a) => a.id !== newAlarm.id)]);
            }}
            className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-all active:scale-95 group"
          >
            <div className="text-sm font-bold text-cyan-400">+20 Mins</div>
            <div className="text-[10px] text-slate-400">Power Nap</div>
          </button>
        </div>
      </div>

      {/* Alarms List */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
          Your Alarms ({alarms.length})
        </h3>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading alarms...</div>
        ) : alarms.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center">
            <AlarmClock size={32} className="mx-auto mb-2 text-slate-600" />
            <p className="text-xs font-semibold text-slate-300">No alarms scheduled yet</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Add one above or say "Hey Life, kal subah 6 baje utha dena"
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alarms.map((alarm) => (
              <div
                key={alarm.id}
                className={`p-4 rounded-2xl border transition-all ${
                  alarm.enabled
                    ? 'bg-[#0E1524] border-[#1E293B] hover:border-cyan-500/40'
                    : 'bg-slate-900/40 border-slate-800/60 opacity-60'
                } flex items-center justify-between gap-4`}
              >
                {/* Time & Details */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-mono">
                        {alarm.timeStr.replace(/\s*(am|pm)/i, '')}
                      </span>
                      <span className="text-xs font-bold text-cyan-400 uppercase">
                        {alarm.timeStr.includes('PM') ? 'PM' : 'AM'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-medium text-slate-300 truncate max-w-[180px] sm:max-w-xs">
                        {alarm.label}
                      </span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
                        {alarm.sound !== false && <span title="Sound enabled"><Volume2 size={12} /></span>}
                        {alarm.vibrate !== false && <span title="Vibration enabled"><Vibrate size={12} /></span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Switch & Delete */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* Toggle switch */}
                  <button
                    onClick={() => handleToggle(alarm.id, alarm.enabled)}
                    className={`w-12 h-6 rounded-full transition-colors p-0.5 relative ${
                      alarm.enabled ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        alarm.enabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(alarm.id)}
                    className="w-8 h-8 rounded-xl bg-slate-800/60 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all"
                    title="Delete alarm"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Alarm Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0F172A] border border-slate-700/80 p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlarmClock size={16} className="text-cyan-400" />
                Schedule New Alarm
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateAlarm} className="space-y-4">
              {/* Time Picker */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  Select Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    required
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
                  />
                  <div className="flex rounded-xl bg-slate-900 border border-slate-700 p-0.5">
                    <button
                      type="button"
                      onClick={() => setFormPeriod('AM')}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        formPeriod === 'AM' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPeriod('PM')}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        formPeriod === 'PM' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Label */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  Alarm Label
                </label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. Wake up, Meeting"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSound}
                    onChange={(e) => setFormSound(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Ringtone Sound</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formVibrate}
                    onChange={(e) => setFormVibrate(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Vibration</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-cyan-500/20"
                >
                  Save Alarm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

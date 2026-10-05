/**
 * Life AI Client-Side Tool Executor
 * Automatically triggers real native device features (YouTube music playback, native alarm scheduling)
 * when returned by backend orchestrator tools_executed or local agent pipelines.
 */

import { musicService, Track } from './musicService';
import { alarmService } from './alarmService';

export interface ExecutedTool {
  tool: string;
  intent?: string;
  action?: string;
  query?: string;
  track?: any;
  time_str?: string;
  timestamp_ms?: number;
  label?: string;
  days?: string[];
}

export async function executeServerTools(tools: ExecutedTool[] | undefined | null): Promise<void> {
  if (!tools || !Array.isArray(tools) || tools.length === 0) return;

  for (const t of tools) {
    try {
      if (t.tool === 'music_play') {
        console.log('[TOOL_EXECUTOR] Executing music_play:', t);
        if (t.track && t.track.id) {
          const mappedTrack: Track = {
            id: t.track.id,
            title: t.track.title || 'Playing Track',
            artist: t.track.artist || t.track.channel || 'Official Audio',
            channel: t.track.channel || t.track.artist,
            thumbnail: t.track.thumbnail || `https://i.ytimg.com/vi/${t.track.id}/hqdefault.jpg`,
            duration: t.track.duration || '3:30',
            durationSeconds: t.track.durationSeconds || 210,
            source: 'youtube',
            videoId: t.track.videoId || t.track.id,
            url: t.track.url || `https://www.youtube.com/watch?v=${t.track.id}`
          };
          await musicService.play(mappedTrack);
        } else if (t.query) {
          await musicService.searchAndPlay(t.query);
        }
      } else if (t.tool === 'music_control') {
        console.log('[TOOL_EXECUTOR] Executing music_control action:', t.action);
        if (t.action === 'pause') {
          musicService.pause();
        } else if (t.action === 'resume') {
          musicService.resume();
        } else if (t.action === 'next') {
          musicService.next();
        } else if (t.action === 'previous') {
          musicService.previous();
        }
      } else if (t.tool === 'alarm_create') {
        console.log('[TOOL_EXECUTOR] Executing alarm_create:', t);
        if (t.time_str) {
          await alarmService.setAlarm({
            timeStr: t.time_str,
            triggerMillis: t.timestamp_ms || Date.now() + 3600000,
            label: t.label || 'Alarm',
            enabled: true,
            sound: true,
            vibrate: true
          });
        }
      }
    } catch (err) {
      console.warn('[TOOL_EXECUTOR] Tool execution warning:', err);
    }
  }
}

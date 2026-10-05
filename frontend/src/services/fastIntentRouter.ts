import { alarmService } from './alarmService';
import { musicService, CURATED_TRACKS } from './musicService';

export interface IntentResult {
  handled: boolean;
  responseText: string;
}

export class FastIntentRouter {
  private static instance: FastIntentRouter;

  private constructor() {}

  public static getInstance(): FastIntentRouter {
    if (!FastIntentRouter.instance) {
      FastIntentRouter.instance = new FastIntentRouter();
    }
    return FastIntentRouter.instance;
  }

  /**
   * Evaluates user spoken text against fast device intents.
   * Returns handled=true with confirmation text if matched.
   */
  public async route(rawQuery: string): Promise<IntentResult> {
    if (!rawQuery || !rawQuery.trim()) {
      return { handled: false, responseText: '' };
    }

    const q = rawQuery.toLowerCase().trim();

    // ==========================================
    // 1. SMART ALARM INTENTS
    // ==========================================

    // A. Alarm Dismiss / Stop
    if (
      q.includes('alarm band karo') ||
      q.includes('alram band karo') ||
      q.includes('alarm roko') ||
      q.includes('alram roko') ||
      q.includes('dismiss alarm') ||
      q.includes('stop alarm') ||
      q.includes('alarm band kar do') ||
      q.includes('alram band kar do') ||
      q.includes('alarm off karo') ||
      q.includes('alram off karo')
    ) {
      await alarmService.dismissActiveAlarm();
      return {
        handled: true,
        responseText: 'Alarm band kar diya hai.'
      };
    }

    // B. Snooze Alarm
    if (q.includes('snooze') || q.includes('5 minute baad bajana') || q.includes('snooze karo')) {
      await alarmService.snoozeAlarm('active_snooze', 5);
      return {
        handled: true,
        responseText: 'Alarm ko 5 minute ke liye snooze kar diya hai.'
      };
    }

    // B.5 Indian Standard Time (IST) & Date Voice Query
    if (
      q.includes('kya time') ||
      q.includes('kitne baje') ||
      q.includes('time batao') ||
      q.includes('current time') ||
      q.includes('what time') ||
      q.includes('aaj ki date') ||
      q.includes('aaj kya date') ||
      q.includes('today date') ||
      q.includes('what date is today') ||
      q.includes('aaj kaun sa din') ||
      q.includes('what day is today')
    ) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const dateStr = now.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      if (q.includes('date') || q.includes('din')) {
        return {
          handled: true,
          responseText: `Aaj ${dateStr} hai, aur abhi Indian Standard Time ke hisaab se ${timeStr} ho rahe hain.`
        };
      } else {
        return {
          handled: true,
          responseText: `Abhi Indian Standard Time ke hisaab se ${timeStr} ho rahe hain.`
        };
      }
    }

    // C. List Alarms
    if (
      q.includes('mere alarm') ||
      q.includes('mere alram') ||
      q.includes('alarms batao') ||
      q.includes('alram batao') ||
      q.includes('show alarms') ||
      q.includes('list alarms') ||
      q.includes('kitne alarm') ||
      q.includes('kitne alram') ||
      q.includes('alarm dikhao') ||
      q.includes('alram dikhao')
    ) {
      const alarms = await alarmService.getAlarms();
      const active = alarms.filter((a) => a.enabled);
      if (active.length === 0) {
        return {
          handled: true,
          responseText: 'Aapka koi bhi active alarm set nahi hai.'
        };
      }
      const times = active.map((a) => a.timeStr).join(', ');
      return {
        handled: true,
        responseText: `Aapke ${active.length} active alarm hain: ${times}.`
      };
    }

    // D. Alarm Creation (Natural Language)
    const isAlarmCreation =
      q.includes('alarm') ||
      q.includes('alram') ||
      q.includes('elarm') ||
      q.includes('utha dena') ||
      q.includes('wake me up') ||
      q.includes('jagana') ||
      q.includes('jaga dena') ||
      q.includes('baje utha');

    if (isAlarmCreation) {
      const alarmScheduled = await this.parseAndScheduleAlarm(q);
      if (alarmScheduled) {
        return {
          handled: true,
          responseText: alarmScheduled
        };
      }
    }

    // ==========================================
    // 2. VOICE-CONTROLLED MUSIC INTENTS
    // ==========================================

    // A. Pause / Stop Music
    if (
      q.includes('gaana roko') ||
      q.includes('gaana pause') ||
      q.includes('pause music') ||
      q.includes('stop music') ||
      q.includes('music band karo') ||
      q.includes('music roko') ||
      q.includes('song pause') ||
      q.includes('ye gaana pause karo') ||
      q.includes('isko band karo') ||
      q === 'stop' ||
      q === 'pause'
    ) {
      musicService.pause();
      return {
        handled: true,
        responseText: 'Gaana pause kar diya hai.'
      };
    }

    // B. Resume / Play current Music
    if (
      q === 'resume' ||
      q === 'resume karo' ||
      q === 'gaana chalu karo' ||
      q === 'play karo' ||
      q === 'continue music' ||
      q.includes('phir se chalao') ||
      q.includes('ye phir se chalao') ||
      q.includes('resume music')
    ) {
      musicService.resume();
      const current = musicService.getState().currentTrack;
      const title = current ? current.title : 'gaana';
      return {
        handled: true,
        responseText: `${title} resume kar diya.`
      };
    }

    // C. Next / Skip Song
    if (
      q.includes('next song') ||
      q.includes('agla gaana') ||
      q.includes('change song') ||
      q.includes('gaana badlo') ||
      q.includes('next track') ||
      q === 'agla' ||
      q === 'next'
    ) {
      musicService.next();
      const current = musicService.getState().currentTrack;
      const title = current ? current.title : 'agla track';
      return {
        handled: true,
        responseText: `Agla gaana chala rahi hoon: ${title}.`
      };
    }

    // D. Previous Song
    if (
      q.includes('previous song') ||
      q.includes('pichhla gaana') ||
      q.includes('pichla gana') ||
      q === 'previous' ||
      q === 'pichhla'
    ) {
      musicService.previous();
      const current = musicService.getState().currentTrack;
      const title = current ? current.title : 'pichhla track';
      return {
        handled: true,
        responseText: `Pichhla gaana chala rahi hoon: ${title}.`
      };
    }

    // E. Volume Control
    const volumeMatch = q.match(/volume\s*(\d{1,3})\s*(percent|%)?/i);
    if (volumeMatch && volumeMatch[1]) {
      const volNum = parseInt(volumeMatch[1], 10);
      musicService.setVolume(volNum);
      return {
        handled: true,
        responseText: `Volume ${volNum} percent kar diya hai.`
      };
    }
    if (q.includes('volume badhao') || q.includes('aawaz badhao') || q.includes('increase volume')) {
      const cur = musicService.getState().volume;
      const targetVol = Math.min(100, cur + 20);
      musicService.setVolume(targetVol);
      return {
        handled: true,
        responseText: `Volume badha diya hai (${targetVol}%).`
      };
    }
    if (q.includes('volume kam karo') || q.includes('aawaz kam karo') || q.includes('decrease volume')) {
      const cur = musicService.getState().volume;
      const targetVol = Math.max(10, cur - 20);
      musicService.setVolume(targetVol);
      return {
        handled: true,
        responseText: `Volume kam kar diya hai (${targetVol}%).`
      };
    }

    // F. Add to Queue Intent
    if (q.includes('queue me daal do') || q.includes('queue me add karo') || q.includes('add to queue')) {
      const current = musicService.getState().currentTrack;
      if (current) {
        musicService.addToQueue(current);
        return {
          handled: true,
          responseText: `${current.title} ko queue me add kar diya hai.`
        };
      }
    }

    // G. Play Specific Song or Dynamic Music Search
    const hasMusicAction =
      q.includes('chalao') ||
      q.includes('chlao') ||
      q.includes('chala do') ||
      q.includes('chla do') ||
      q.includes('chala de') ||
      q.includes('chla de') ||
      q.includes('chalana') ||
      q.includes('chalu karo') ||
      q.includes('bajao') ||
      q.includes('bjao') ||
      q.includes('baja do') ||
      q.includes('bja do') ||
      q.includes('baja de') ||
      q.includes('bja de') ||
      q.includes('lagao') ||
      q.includes('lgao') ||
      q.includes('laga do') ||
      q.includes('lga do') ||
      q.includes('lagana') ||
      q.includes('laga de') ||
      q.includes('lga de') ||
      q.includes('sunao') ||
      q.includes('suna do') ||
      q.includes('suna de') ||
      q.includes('suno') ||
      q.includes('play');

    const isMusicPlay =
      hasMusicAction ||
      q.includes('gaana') ||
      q.includes('gana') ||
      q.includes('geet') ||
      q.includes('music') ||
      q.includes('song') ||
      q.includes('track');

    if (isMusicPlay && hasMusicAction) {
      // Extract clean song or artist search term
      let songQuery = q
        .replace(/^(hey\s*life|life|ai|hey\s*ai|plz|please|yaar|bhai|sun|suno)\s*/i, '')
        .replace(/(gaana chalao|gana chalao|gaana chlao|gana chlao|gaana bajao|gana bajao|gaana bjao|song chalao|song chlao|music chalao|music chlao|music play|song play|play music|play song|play karo|play kar do|play|chalao|chlao|chala do|chla do|chala de|chla de|chalana|chalu karo|bajao|bjao|baja do|bja do|baja de|bja de|lagao|lgao|laga do|lga do|lagana|laga de|lga de|sunao|suna do|suna de|suno|ke gaane|ke gane)/gi, '')
        .replace(/\b(ka|ke|ki|ko|me|mein|se|pe|par)\b/gi, ' ')
        .replace(/\b(ye|yeh|koi|ek|achha|accha|naya|purana|favourite|favorite|top|hit|song|gaana|gana|geet|music|track)\b/gi, ' ')
        .trim();

      // If query becomes empty after removing action keywords (e.g. "ye song chlao", "gana chalao", "koi song sunao")
      if (!songQuery || songQuery.length < 2) {
        console.log('[FAST_INTENT] Spoken query was generic music action. Playing top hit track...');
        const track = await musicService.searchAndPlay('Bollywood Top Hits');
        return {
          handled: true,
          responseText: `Theek hai! ${track.title} gaana chala rahi hoon.`
        };
      } else {
        console.log(`[FAST_INTENT] Spoken song search query extracted: "${songQuery}"`);
        const track = await musicService.searchAndPlay(songQuery);
        return {
          handled: true,
          responseText: `Theek hai! ${track.title} gaana chala rahi hoon.`
        };
      }
    }

    // Not a device intent -> delegate to LLM
    return { handled: false, responseText: '' };
  }

  /**
   * Natural language time & relative delay parser for alarms.
   */
  private async parseAndScheduleAlarm(q: string): Promise<string | null> {
    try {
      const now = new Date();
      let targetDate = new Date();

      const isTomorrow = q.includes('kal') || q.includes('tomorrow');
      const isPM = q.includes('pm') || q.includes('shaam') || q.includes('sham') || q.includes('dopahar') || q.includes('raat') || q.includes('night') || q.includes('evening');
      const isAM = q.includes('am') || q.includes('subah') || q.includes('morning') || q.includes('bhor');

      // 1. Check for "in X minutes" / "X minute baad"
      const minMatch = q.match(/(\d+)\s*(?:minute|min|minto?)\s*(?:baad|later|me|mein)?/i);
      if (minMatch) {
        const mins = parseInt(minMatch[1], 10);
        const triggerMillis = Date.now() + mins * 60 * 1000;
        const target = new Date(triggerMillis);
        const timeStr = target.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        await alarmService.setAlarm({
          timeStr,
          triggerMillis,
          label: `${mins} Minute Quick Alarm`,
          enabled: true,
          sound: true,
          vibrate: true
        });

        return `Done! ${mins} minute baad (${timeStr}) ka alarm set kar diya hai.`;
      }

      // 2. Hindi number word normalization (e.g. "chhe baje" -> "6 baje", "saat baje" -> "7 baje")
      let normalized = q;
      const hindiNums: Record<string, string> = {
        'ek': '1', 'do': '2', 'teen': '3', 'char': '4', 'chaar': '4',
        'paanch': '5', 'panch': '5', 'chhe': '6', 'che': '6', 'chhah': '6',
        'saat': '7', 'sat': '7', 'aath': '8', 'ath': '8', 'nau': '9', 'no': '9',
        'das': '10', 'dus': '10', 'gyarah': '11', 'barah': '12'
      };
      for (const [w, n] of Object.entries(hindiNums)) {
        normalized = normalized.replace(new RegExp(`\\b${w}\\b(?=\\s*(?:baje|am|pm))`, 'gi'), n);
      }

      // 3. Extract hour & optional minute (e.g., "6 baje", "6:30 baje", "6 am", "7:45 pm")
      const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(?:baje|am|pm|o'clock)?/i;
      const match = normalized.match(timeRegex);

      if (!match) {
        // User asked for alarm without specifying time (e.g. "alram bhi aeise hi set kar de" or "alarm laga do")
        return "Aapko kitne baje ka alarm lagana hai? Jaise bolein: 'kal subah 6 baje ka alarm laga do'.";
      }

      let hour = parseInt(match[1], 10);
      const minute = match[2] ? parseInt(match[2], 10) : 0;

      if (isNaN(hour) || hour < 0 || hour > 24) {
        return "Aapko kitne baje ka alarm lagana hai? Jaise bolein: 'kal subah 6 baje ka alarm laga do'.";
      }

      if (isPM && hour < 12) hour += 12;
      if (isAM && hour === 12) hour = 0;
      if (!isPM && !isAM) {
        // Contextual guess: if user says 8 baje and it's daytime, assume night 8 PM
        if (hour >= 8 && hour <= 11 && now.getHours() >= 12 && now.getHours() < 22) {
          hour += 12;
        }
      }

      targetDate.setHours(hour, minute, 0, 0);

      if (isTomorrow || targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      const formattedTime = targetDate.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const label = isTomorrow ? `Kal ${formattedTime} Alarm` : `${formattedTime} Alarm`;

      await alarmService.setAlarm({
        timeStr: formattedTime,
        triggerMillis: targetDate.getTime(),
        label,
        enabled: true,
        sound: true,
        vibrate: true
      });

      const dayWord = isTomorrow ? 'kal ' : '';
      return `Done! ${dayWord}${formattedTime} ka alarm set kar diya hai.`;
    } catch (err) {
      console.error('[FAST INTENT] Alarm parse error:', err);
      return "Alarm set karne mein dikkat aayi. Kripya time dobara batayein.";
    }
  }
}

export const fastIntentRouter = FastIntentRouter.getInstance();

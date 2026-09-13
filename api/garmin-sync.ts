// Vercel Serverless Function: Live Garmin Connect Sync & Push Engine
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';

const require = createRequire(import.meta.url);
let garminPkg: any;
try {
  garminPkg = require('@flow-js/garmin-connect');
} catch (loadErr) {
  console.error('Failed to load @flow-js/garmin-connect:', loadErr);
}

const GarminConnect =
  garminPkg?.GarminConnect ||
  garminPkg?.default?.GarminConnect ||
  garminPkg?.default ||
  garminPkg;
const WorkoutBuilder = garminPkg?.WorkoutBuilder || garminPkg?.default?.WorkoutBuilder;
const WorkoutType = garminPkg?.WorkoutType || garminPkg?.default?.WorkoutType;
const Step = garminPkg?.Step || garminPkg?.default?.Step;
const StepType = garminPkg?.StepType || garminPkg?.default?.StepType;
const TimeDuration = garminPkg?.TimeDuration || garminPkg?.default?.TimeDuration;
const DistanceDuration = garminPkg?.DistanceDuration || garminPkg?.default?.DistanceDuration;
const LapPressDuration = garminPkg?.LapPressDuration || garminPkg?.default?.LapPressDuration;
const HrmZoneTarget = garminPkg?.HrmZoneTarget || garminPkg?.default?.HrmZoneTarget;
const HrmTarget = garminPkg?.HrmTarget || garminPkg?.default?.HrmTarget;
const PaceTarget = garminPkg?.PaceTarget || garminPkg?.default?.PaceTarget;
const NoTarget = garminPkg?.NoTarget || garminPkg?.default?.NoTarget;

/**
 * Self-contained deduplication utilities to avoid fragile cross-directory imports from src/.
 */
function hasGarminEmojiOrSpecialSymbols(text: string): boolean {
  if (!text) return false;
  return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}➔➜➝➞•●▪–—]/u.test(text);
}

function normalizeWorkoutTitleForMatching(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[➔➜➝➞•●▪–—\-_/\\|:;,()[\]{}"'`~*+?&!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function areWorkoutsEquivalent(title1: string, title2: string): boolean {
  const norm1 = normalizeWorkoutTitleForMatching(title1);
  const norm2 = normalizeWorkoutTitleForMatching(title2);

  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;

  const minLen = Math.min(norm1.length, norm2.length);
  if (minLen >= 10 && (norm1.startsWith(norm2.slice(0, minLen)) || norm2.startsWith(norm1.slice(0, minLen)))) {
    return true;
  }

  const tokens1 = norm1.split(' ').filter((t: string) => t.length >= 3);
  const tokens2 = norm2.split(' ').filter((t: string) => t.length >= 3);
  if (tokens1.length > 0 && tokens2.length > 0) {
    const intersection = tokens1.filter((t: string) => tokens2.includes(t));
    const overlap1 = intersection.length / tokens1.length;
    const overlap2 = intersection.length / tokens2.length;
    if (overlap1 >= 0.8 || overlap2 >= 0.8) {
      return true;
    }
  }

  return false;
}

function parsePaceSeconds(paceStr?: string): number {
  if (!paceStr) return 0;
  const parts = paceStr.split(':').map(p => parseInt(p.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  const val = parseFloat(paceStr);
  return isNaN(val) ? 0 : Math.round(val * 60);
}

/**
 * Self-contained Garmin activity type classifier for Vercel Serverless execution.
 * Avoids fragile cross-directory TypeScript imports from src/.
 */
function classifyGarminActivityType(rawTypeKey?: string, activityName?: string): string {
  const key = String(rawTypeKey || '').toLowerCase();
  const name = String(activityName || '').toLowerCase();

  if (
    key.includes('climb') ||
    key.includes('boulder') ||
    name.includes('grimp') ||
    name.includes('climb') ||
    name.includes('boulder') ||
    name.includes('escalade') ||
    name.includes('bloc')
  ) {
    return 'CLIMBING';
  }

  if (
    key.includes('trail') ||
    name.includes('trail') ||
    name.includes('côte') ||
    name.includes('cotes') ||
    name.includes('mont-royal') ||
    name.includes('mont royal') ||
    name.includes('qmt') ||
    name.includes('rando-course') ||
    name.includes('d+')
  ) {
    return 'TRAIL_RUNNING';
  }

  if (
    key.includes('run') ||
    name.includes('course') ||
    name.includes('footing') ||
    name.includes('jog')
  ) {
    return 'RUNNING';
  }

  if (
    key.includes('strength') ||
    key.includes('weight') ||
    key.includes('gym') ||
    key.includes('fitness') ||
    key.includes('cardio') ||
    key.includes('hiit') ||
    name.includes('muscu') ||
    name.includes('calisth') ||
    name.includes('force') ||
    name.includes('renfo') ||
    name.includes('gainage') ||
    name.includes('pompe') ||
    name.includes('traction')
  ) {
    return 'STRENGTH_TRAINING';
  }

  if (
    key.includes('cycl') ||
    key.includes('bike') ||
    name.includes('vélo') ||
    name.includes('bike')
  ) {
    return 'CYCLING';
  }

  if (
    key.includes('walk') ||
    key.includes('hike') ||
    name.includes('marche') ||
    name.includes('walk') ||
    name.includes('randonnée')
  ) {
    return 'WALKING';
  }

  return 'OTHER';
}

const SESSION_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), '.garmin_session.json')
  : path.resolve(process.cwd(), '.garmin_session.json');

function loadCachedSession(): { username?: string; tokens?: any } | null {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const content = fs.readFileSync(SESSION_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn('Could not read cached Garmin session:', e);
  }
  return null;
}

function saveCachedSession(username: string, tokens: any) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ username, tokens, savedAt: new Date().toISOString() }, null, 2));
  } catch (e) {
    console.warn('Could not save cached Garmin session:', e);
  }
}

function sanitizeGarminText(text: string, maxLength?: number): string {
  if (!text) return '';
  let cleaned = text
    .replace(/[➔➜➝➞]/g, '->')
    .replace(/[•●▪]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength).trim();
  }
  return cleaned;
}


export default async function handler(req: any, res: any) {
  // Polyfill response helpers for Node/Vite connect middleware
  if (!res.status) {
    res.status = (code: number) => { res.statusCode = code; return res; };
  }
  if (!res.json) {
    res.json = (data: any) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };
  }
  if (!res.send) {
    res.send = (data: any) => {
      res.end(data);
    };
  }

  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse stream body for Node connect middleware if not already parsed
  if (!req.body && req.method === 'POST') {
    try {
      const readBodyPromise = new Promise<string>((resolve) => {
        let buf = '';
        req.on('data', (c: any) => buf += c);
        req.on('end', () => resolve(buf));
        req.on('error', () => resolve(''));
        setTimeout(() => resolve(buf), 4000);
      });
      const raw = await readBodyPromise;
      if (raw) {
        req.body = JSON.parse(raw);
      }
    } catch {
      req.body = {};
    }
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const username = body.email || process.env.GARMIN_EMAIL;
  const password = body.password || process.env.GARMIN_PASSWORD;
  const action = body.action || 'sync'; // 'sync' | 'push-workout' | 'get-wellness'

  try {
    let gc = new GarminConnect({ username: username || 'user', password: password || 'pass' });
    const cached = loadCachedSession();
    let isAuthenticated = false;

    // 1. Try reusing cached OAuth tokens
    if (cached?.tokens?.oauth1 && cached?.tokens?.oauth2 && (!username || cached.username === username)) {
      try {
        gc.loadToken(cached.tokens.oauth1, cached.tokens.oauth2);
        isAuthenticated = true;
      } catch (tokenErr) {
        console.warn('Cached Garmin token expired or invalid, will re-authenticate:', tokenErr);
        isAuthenticated = false;
      }
    }

    // 2. Authenticate if no valid cached session
    if (!isAuthenticated) {
      if (!username || !password) {
        res.status(400).json({
          error: 'Veuillez renseigner votre email et mot de passe Garmin Connect (ou configurer GARMIN_EMAIL/PASSWORD).'
        });
        return;
      }

      gc = new GarminConnect({ username, password });
      await gc.login();

      try {
        const tokens = gc.exportToken();
        saveCachedSession(username, tokens);
      } catch (tokenExportErr) {
        console.warn('Could not export tokens:', tokenExportErr);
      }
    }

    // ----------------------------------------------------
    // ACTION: PUSH WORKOUT TO GARMIN CONNECT & SCHEDULE
    // ----------------------------------------------------
    if (action === 'push-workout') {
      const workout = body.workout;
      if (!workout || !workout.title || !workout.steps) {
        res.status(400).json({ success: false, error: 'Workout payload with title and steps is required.' });
        return;
      }

      const isFR55 = workout.targetWatch === 'FORERUNNER_55' || true;
      let wt = WorkoutType.Running;

      if (workout.sportType === 'CARDIO') {
        wt = WorkoutType.Cardio;
      } else if (workout.sportType === 'STRENGTH') {
        // Forerunner 55 lacks native Strength profile, so we format it as structured Cardio
        // with exercise descriptions and intervals so it runs smoothly on FR55!
        wt = isFR55 ? WorkoutType.Cardio : WorkoutType.Strength;
      }

      const cleanTitle = sanitizeGarminText(workout.title, 36);
      const cleanDesc = sanitizeGarminText(workout.description || 'Seance QMT-80 Performance Hub', 250);

      // 1. Déduplication automatique : Nettoyer tout ancien entraînement équivalent sur Garmin Connect (avec émojis, ancienne version, etc.)
      try {
        const existingWorkouts: any[] = await gc.getWorkouts(1, 100);
        if (Array.isArray(existingWorkouts)) {
          for (const ew of existingWorkouts) {
            const ewName = ew.workoutName || '';
            if (areWorkoutsEquivalent(ewName, workout.title) || areWorkoutsEquivalent(ewName, cleanTitle)) {
              try {
                await gc.deleteWorkout({ workoutId: String(ew.workoutId) });
                console.log(`[Deduplication] Deleted duplicate Garmin workout ${ew.workoutId} ("${ewName}") before recreating clean version`);
              } catch (delErr) {
                console.warn(`[Deduplication] Could not delete duplicate workout ${ew.workoutId}:`, delErr);
              }
            }
          }
        }
      } catch (fetchErr) {
        console.warn('[Deduplication] Could not fetch existing workouts for deduplication:', fetchErr);
      }

      const wb = new WorkoutBuilder(wt, cleanTitle, cleanDesc);

      for (const st of workout.steps) {
        let stepType = StepType.Run;
        if (st.stepType === 'WARMUP') stepType = StepType.WarmUp;
        else if (st.stepType === 'INTERVAL') stepType = (wt === WorkoutType.Running ? StepType.Run : StepType.Interval || StepType.Run);
        else if (st.stepType === 'RECOVERY') stepType = StepType.Recovery;
        else if (st.stepType === 'COOLDOWN') stepType = StepType.CoolDown;

        let duration: any;
        if (st.durationSeconds) {
          duration = new TimeDuration(st.durationSeconds);
        } else if (st.durationMeters) {
          duration = new DistanceDuration(st.durationMeters);
        } else {
          duration = new LapPressDuration();
        }

        let target: any = new NoTarget();
        if (st.targetType === 'PACE') {
          if (st.targetPaceLowMinKm && st.targetPaceHighMinKm) {
            const lowSec = parsePaceSeconds(st.targetPaceLowMinKm);
            const highSec = parsePaceSeconds(st.targetPaceHighMinKm);
            if (lowSec > 0 && highSec > 0) {
              const fast = Math.min(lowSec, highSec);
              const slow = Math.max(lowSec, highSec);
              target = new PaceTarget(1000 / slow, 1000 / fast);
            }
          } else if (st.targetPaceMinKm) {
            const baseSec = parsePaceSeconds(st.targetPaceMinKm);
            const margin = st.targetPaceMarginSeconds || 18;
            if (baseSec > 0) {
              const slow = baseSec + margin;
              const fast = Math.max(30, baseSec - margin);
              target = new PaceTarget(1000 / slow, 1000 / fast);
            }
          }
        } else if (st.targetType === 'HR_RANGE' && st.targetHrLow && st.targetHrHigh) {
          const mid = Math.round((st.targetHrLow + st.targetHrHigh) / 2);
          const delta = Math.max(5, Math.round((st.targetHrHigh - st.targetHrLow) / 2));
          target = HrmTarget.hrm(mid, delta);
        } else if (st.targetType === 'HR_ZONE' && st.targetHrLow) {
          target = new HrmZoneTarget(st.targetHrLow);
        }

        wb.addStep(new Step(stepType, duration, target, sanitizeGarminText(st.stepNotes || '', 48)));
      }

      const builtWorkout = wb.build();
      const createdWorkout: any = await gc.createWorkout(builtWorkout);

      let scheduledDateResult = workout.scheduledDate;
      if (workout.scheduledDate && createdWorkout?.workoutId) {
        try {
          await gc.scheduleWorkout({ workoutId: String(createdWorkout.workoutId) }, workout.scheduledDate);
        } catch (schedErr) {
          console.warn('Could not schedule workout to calendar:', schedErr);
        }
      }

      res.status(200).json({
        success: true,
        workoutId: createdWorkout?.workoutId ? String(createdWorkout.workoutId) : undefined,
        workoutName: workout.title,
        scheduledDate: scheduledDateResult,
        sportType: workout.sportType,
        message: `Séance "${workout.title}" créée et programmée avec succès sur votre Garmin !`
      });
      return;
    }

    // ----------------------------------------------------
    // ACTION: CLEAN DUPLICATE WORKOUTS ON GARMIN CONNECT
    // ----------------------------------------------------
    if (action === 'clean-duplicates') {
      try {
        const workouts: any[] = await gc.getWorkouts(1, 100);
        if (!Array.isArray(workouts) || workouts.length === 0) {
          res.status(200).json({
            success: true,
            deletedCount: 0,
            deletedNames: [],
            message: 'Aucun entraînement trouvé sur votre compte Garmin.'
          });
          return;
        }

        const groups: Array<{ canonicalTitle: string; workouts: any[] }> = [];
        for (const w of workouts) {
          const title = w.workoutName || '';
          const matchGroup = groups.find(g => areWorkoutsEquivalent(g.canonicalTitle, title));
          if (matchGroup) {
            matchGroup.workouts.push(w);
          } else {
            groups.push({ canonicalTitle: title, workouts: [w] });
          }
        }

        let deletedCount = 0;
        const deletedNames: string[] = [];

        for (const group of groups) {
          if (group.workouts.length <= 1) continue;

          // Trier: sans émojis d'abord, puis date la plus récente, puis ID le plus élevé
          const sorted = [...group.workouts].sort((a, b) => {
            const aEmoji = hasGarminEmojiOrSpecialSymbols(a.workoutName);
            const bEmoji = hasGarminEmojiOrSpecialSymbols(b.workoutName);
            if (aEmoji !== bEmoji) return aEmoji ? 1 : -1;

            const aTime = a.updateDate ? new Date(a.updateDate).getTime() : 0;
            const bTime = b.updateDate ? new Date(b.updateDate).getTime() : 0;
            if (aTime !== bTime) return bTime - aTime;

            const aId = parseInt(String(a.workoutId) || '0', 10);
            const bId = parseInt(String(b.workoutId) || '0', 10);
            return bId - aId;
          });

          // Garder le premier (le plus propre/récent), supprimer tous les autres
          const toDelete = sorted.slice(1);
          for (const d of toDelete) {
            try {
              await gc.deleteWorkout({ workoutId: String(d.workoutId) });
              deletedCount++;
              deletedNames.push(d.workoutName);
            } catch (delErr) {
              console.warn(`Could not delete duplicate workout ${d.workoutId}:`, delErr);
            }
          }
        }

        res.status(200).json({
          success: true,
          deletedCount,
          deletedNames,
          message: deletedCount > 0
            ? `${deletedCount} entraînement${deletedCount > 1 ? 's' : ''} en double supprimé${deletedCount > 1 ? 's' : ''} de votre compte Garmin Connect !`
            : 'Aucun doublon détecté sur votre compte Garmin.'
        });
        return;
      } catch (cleanErr: any) {
        res.status(500).json({
          success: false,
          error: cleanErr?.message || 'Erreur lors du nettoyage des doublons Garmin.'
        });
        return;
      }
    }

    // ----------------------------------------------------
    // WELLNESS & ACTIVITIES EXTRACTION (Concurrent with timeouts)
    // ----------------------------------------------------
    const timeoutPromise = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
      Promise.race([promise, new Promise<T>(res => setTimeout(() => res(fallback), ms))]);

    let wellness: any = null;
    const getLocalFallbackDate = () => {
      try {
        return new Intl.DateTimeFormat('fr-CA', {
          timeZone: 'America/Montreal',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date());
      } catch {
        return new Date().toISOString().slice(0, 10);
      }
    };
    const todayStr = (req.body?.clientDate && /^\d{4}-\d{2}-\d{2}$/.test(req.body.clientDate))
      ? req.body.clientDate
      : getLocalFallbackDate();
    const today = new Date(todayStr + 'T12:00:00');

    const syncMode = body.syncMode || body.mode || 'incremental';

    const fetchSleep = async () => {
      try {
        const sleepRes: any = await timeoutPromise(gc.getSleepData(today), 8000, null);
        if (sleepRes?.dailySleepDTO) {
          const dto = sleepRes.dailySleepDTO;
          return {
            score: dto.sleepScores?.overall?.value || dto.sleepScoreFeedback || undefined,
            totalMinutes: dto.sleepTimeSeconds ? Math.round(dto.sleepTimeSeconds / 60) : 0,
            deepMinutes: dto.deepSleepSeconds ? Math.round(dto.deepSleepSeconds / 60) : undefined,
            remMinutes: dto.remSleepSeconds ? Math.round(dto.remSleepSeconds / 60) : undefined,
            lightMinutes: dto.lightSleepSeconds ? Math.round(dto.lightSleepSeconds / 60) : undefined,
            awakeMinutes: dto.awakeSleepSeconds ? Math.round(dto.awakeSleepSeconds / 60) : undefined,
            qualityMessage: dto.sleepScores?.overall?.qualifierKey || undefined
          };
        }
      } catch (sleepErr) {
        console.warn('Could not fetch sleep data:', sleepErr);
      }
      return null;
    };

    const fetchHr = async () => {
      try {
        const hrRes: any = await timeoutPromise(gc.getHeartRate(today), 8000, null);
        if (typeof hrRes?.restingHeartRate === 'number') {
          return hrRes.restingHeartRate;
        }
      } catch (hrErr) {
        console.warn('Could not fetch HR data:', hrErr);
      }
      return undefined;
    };

    const fetchHrv = async () => {
      try {
        const hrvRes: any = await timeoutPromise((gc.client as any).get(`https://connectapi.garmin.com/hrv-service/hrv/${todayStr}`), 8000, null);
        if (hrvRes?.hrvSummary) {
          const hs = hrvRes.hrvSummary;
          return {
            lastNightAvg: hs.lastNightAvg || undefined,
            weeklyAvg: hs.weeklyAvg || undefined,
            baselineLow: hs.baseline?.lowUpper || undefined,
            baselineHigh: hs.baseline?.balancedLow || undefined,
            status: hs.status || 'UNKNOWN'
          };
        }
      } catch (hrvErr) {
        console.warn('Could not fetch HRV data:', hrvErr);
      }
      return null;
    };

    const fetchReadiness = async () => {
      try {
        const trRes: any = await timeoutPromise((gc.client as any).get(`https://connectapi.garmin.com/metrics-service/metrics/trainingreadiness/${todayStr}`), 8000, null);
        if (Array.isArray(trRes) && trRes.length > 0 && typeof trRes[0]?.score === 'number') {
          return trRes[0].score;
        } else if (typeof trRes?.score === 'number') {
          return trRes.score;
        }
      } catch (trErr) {
        console.warn('Could not fetch Training Readiness:', trErr);
      }
      return undefined;
    };

    const fetchActs = async () => {
      if (action === 'get-wellness') return [];
      if (syncMode === 'full') {
        const pageSize = 100;
        const maxActivities = 1500;
        let offset = 0;
        const acts: any[] = [];
        while (offset < maxActivities) {
          try {
            const page: any[] = await timeoutPromise(gc.getActivities(offset, pageSize), 15000, []);
            if (!Array.isArray(page) || page.length === 0) break;
            acts.push(...page);
            if (page.length < pageSize) break;
            offset += page.length;
          } catch (pageErr) {
            console.warn(`[Garmin Full Sync] Error fetching activities at offset ${offset}:`, pageErr);
            break;
          }
        }
        return acts;
      } else {
        const limit = Math.min(100, Math.max(20, body.limit || 50));
        return (await timeoutPromise(gc.getActivities(0, limit), 15000, [])) || [];
      }
    };

    const [sleepSummary, restingHeartRate, hrvSummary, trainingReadinessScore, acts] = await Promise.all([
      fetchSleep(),
      fetchHr(),
      fetchHrv(),
      fetchReadiness(),
      fetchActs()
    ]);

    wellness = {
      date: todayStr,
      sleep: sleepSummary,
      restingHeartRate,
      hrv: hrvSummary,
      trainingReadinessScore,
      syncedAt: new Date().toISOString()
    };

    if (action === 'get-wellness') {
      res.status(200).json({ success: true, wellness });
      return;
    }

    let rawActivities: any[] = acts || [];

    const activities = (rawActivities || []).map((a: any) => {
      const typeKey = String((typeof a.activityType === 'object' ? a.activityType?.typeKey : a.activityType) || '');
      let actName = String(a.activityName || '');
      const activityType = classifyGarminActivityType(typeKey, actName);

      if (
        actName.trim().toLowerCase() === 'cardio' ||
        actName.trim().toLowerCase() === 'cardio training' ||
        actName.trim().toLowerCase() === 'indoor cardio' ||
        actName.trim().toLowerCase() === 'indoor_cardio' ||
        actName.trim().toLowerCase() === 'entraînement cardio'
      ) {
        actName = 'Calisthénie / Renforcement';
      }

      const movingDurSec = a.movingDuration || a.duration || a.elapsedDuration || 0;
      const elapsedDurSec = a.elapsedDuration || a.duration || 0;
      const isStrengthOrClimb =
        activityType === 'STRENGTH_TRAINING' || activityType === 'CLIMBING' || activityType === 'FITNESS_EQUIPMENT';
      const effectiveDurSec = isStrengthOrClimb ? elapsedDurSec : (movingDurSec || elapsedDurSec);
      const durMin = Math.max(1, Math.round(effectiveDurSec / 60));

      const distKm = a.distance ? parseFloat((a.distance / 1000).toFixed(2)) : undefined;
      const eleGain = a.elevationGain !== undefined && a.elevationGain !== null ? Math.round(a.elevationGain) : undefined;
      const eleLoss = a.elevationLoss !== undefined && a.elevationLoss !== null ? Math.round(a.elevationLoss) : undefined;
      const avgHr = a.averageHR ? Math.round(a.averageHR) : undefined;
      const maxHr = a.maxHR ? Math.round(a.maxHR) : undefined;
      const avgCadence = a.averageRunningCadenceInStepsPerMinute
        ? Math.round(a.averageRunningCadenceInStepsPerMinute)
        : (a.averageBikingCadenceInRevPerMinute ? Math.round(a.averageBikingCadenceInRevPerMinute) : undefined);

      let avgPaceMinKm: string | undefined = undefined;
      if (
        (activityType === 'RUNNING' || activityType === 'TRAIL_RUNNING' || activityType === 'WALKING') &&
        distKm &&
        distKm > 0.1 &&
        effectiveDurSec > 0
      ) {
        const paceSecPerKm = effectiveDurSec / distKm;
        const pMin = Math.floor(paceSecPerKm / 60);
        const pSec = Math.round(paceSecPerKm % 60);
        if (pMin < 30) {
          avgPaceMinKm = `${pMin}:${String(pSec).padStart(2, '0')} /km`;
        }
      }

      return {
        activityId: String(a.activityId || `${Date.now()}-${Math.random()}`),
        activityName: actName || 'Garmin Activity',
        activityType,
        garminTypeKey: typeKey || undefined,
        startTimeLocal: a.startTimeLocal || a.startTimeGMT || new Date().toISOString(),
        durationMinutes: durMin,
        elapsedDurationMinutes: elapsedDurSec ? Math.round(elapsedDurSec / 60) : undefined,
        movingDurationMinutes: movingDurSec ? Math.round(movingDurSec / 60) : undefined,
        distanceKm: distKm,
        elevationGainM: eleGain,
        elevationLossM: eleLoss,
        avgHeartRate: avgHr,
        maxHeartRate: maxHr,
        avgCadence,
        avgPaceMinKm,
        calories: a.calories ? Math.round(a.calories) : undefined,
        aerobicTrainingEffect:
          typeof a.aerobicTrainingEffect === 'number' ? parseFloat(a.aerobicTrainingEffect.toFixed(1)) : undefined,
        anaerobicTrainingEffect:
          typeof a.anaerobicTrainingEffect === 'number' ? parseFloat(a.anaerobicTrainingEffect.toFixed(1)) : undefined,
        trainingLoad: a.activityTrainingLoad ? Math.round(a.activityTrainingLoad) : undefined,
        trainingEffectLabel: a.trainingEffectLabel ? String(a.trainingEffectLabel) : undefined,
        vo2MaxValue: typeof a.vO2MaxValue === 'number' ? Math.round(a.vO2MaxValue) : undefined,
        source: 'GARMIN_CONNECT'
      };
    });

    let athleteMaxHr: number | undefined = undefined;
    try {
      const userSettings: any = await gc.getUserSettings();
      const settingsMax = userSettings?.userData?.maxHeartRate || userSettings?.userProfile?.maxHeartRate || userSettings?.maxHeartRate;
      if (typeof settingsMax === 'number' && settingsMax > 140 && settingsMax < 240) {
        athleteMaxHr = Math.round(settingsMax);
      }
    } catch (settingsErr) {
      console.warn('Could not fetch user settings for maxHeartRate:', settingsErr);
    }

    // Fallback or validation: check actual highest peak heart rate recorded in activities
    if (activities.length > 0) {
      const recordedPeaks = activities
        .map((a: any) => a.maxHeartRate)
        .filter((hr: any) => typeof hr === 'number' && hr > 150 && hr < 240);
      if (recordedPeaks.length > 0) {
        const peakRecorded = Math.max(...recordedPeaks);
        if (!athleteMaxHr || peakRecorded > athleteMaxHr) {
          athleteMaxHr = peakRecorded;
        }
      }
    }

    res.status(200).json({ success: true, count: activities.length, activities, wellness, athleteMaxHr, syncMode });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      activities: [],
      wellness: null,
      count: 0,
      error: err.message || 'Erreur lors de la communication avec Garmin Connect'
    });
  }
}

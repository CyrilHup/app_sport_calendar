// Vercel Serverless Function: Live Garmin Connect Sync & Push Engine
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { normalizeGarminActivities } from '../src/server/garminActivityNormalizer.js';
import { fetchGarminWellness, getGarminLocalDate } from '../src/server/garminWellness.js';
import { sanitizeGarminText } from '../src/services/garminText.js';
import { GARMIN_TRAINING_POLICY, isValidGarminMaxHeartRate, isValidRecordedHeartRatePeak } from '../src/services/garminTrainingPolicy.js';
import { applyApiCors, ensureResponseHelpers, requireAuthenticatedUser } from '../src/server/requestSecurity.js';
import { validateGarminRequest } from '../src/server/garminRequest.js';
import { fetchGarminActivityBatch } from '../src/server/garminPagination.js';
import { claimGarminRunLease } from '../src/server/garminRunLease.js';
import {
  assertNoConflictingScheduledQmtRun,
  finishWorkoutReplacement,
  scheduleWorkoutWithReadback,
  verifyReplaceableWorkout
} from '../src/server/garminWorkoutReplacement.js';

// Resolve from the project root so the handler works in both Vercel's ESM
// build and local/CommonJS middleware without relying on import.meta.url.
const require = createRequire(path.join(process.cwd(), 'package.json'));
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

function parsePaceSeconds(paceStr?: string): number {
  if (!paceStr) return 0;
  const parts = paceStr.split(':').map(p => parseInt(p.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  const val = parseFloat(paceStr);
  return isNaN(val) ? 0 : Math.round(val * 60);
}

function getSessionFile(userId: string): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `.garmin_session_${safeUserId}.json`;
  return process.env.VERCEL ? path.join(os.tmpdir(), filename) : path.resolve(process.cwd(), filename);
}

function loadCachedSession(userId: string): { username?: string; tokens?: any } | null {
  try {
    const sessionFile = getSessionFile(userId);
    if (fs.existsSync(sessionFile)) {
      const content = fs.readFileSync(sessionFile, 'utf-8');
      const cached = JSON.parse(content);
      const savedAt = Date.parse(cached.savedAt || '');
      if (!Number.isFinite(savedAt) || Date.now() - savedAt > 24 * 60 * 60 * 1000) {
        fs.unlinkSync(sessionFile);
        return null;
      }
      return cached;
    }
  } catch (e) {
    console.warn('Could not read cached Garmin session:', e);
  }
  return null;
}

function saveCachedSession(userId: string, username: string, tokens: any) {
  try {
    fs.writeFileSync(getSessionFile(userId), JSON.stringify({ username, tokens, savedAt: new Date().toISOString() }), { mode: 0o600 });
    fs.chmodSync(getSessionFile(userId), 0o600);
  } catch (e) {
    console.warn('Could not save cached Garmin session:', e);
  }
}


export default async function handler(req: any, res: any) {
  ensureResponseHelpers(res);
  if (!applyApiCors(req, res, 'POST,OPTIONS')) return;

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const apiUser = await requireAuthenticatedUser(req, res);
  if (!apiUser) return;

  // Parse stream body for Node connect middleware if not already parsed
  if (!req.body && req.method === 'POST') {
    try {
      const readBodyPromise = new Promise<string>((resolve, reject) => {
        let buf = '';
        let tooLarge = false;
        const timer = setTimeout(() => reject(new Error('Request timeout')), 4000);
        req.on('data', (chunk: any) => {
          if (tooLarge) return;
          buf += String(chunk);
          if (buf.length > 65_536) {
            tooLarge = true;
            clearTimeout(timer);
            reject(new Error('Request too large'));
          }
        });
        req.on('end', () => { clearTimeout(timer); resolve(buf); });
        req.on('error', (error: unknown) => { clearTimeout(timer); reject(error); });
      });
      const raw = await readBodyPromise;
      if (raw) {
        req.body = JSON.parse(raw);
      }
    } catch (error) {
      res.status(error instanceof Error && error.message === 'Request too large' ? 413 : 400)
        .json({ error: error instanceof Error ? error.message : 'Invalid request body.' });
      return;
    }
  }

  let rawBody = req.body || {};
  if (typeof rawBody === 'string') {
    try {
      rawBody = JSON.parse(rawBody);
    } catch {
      res.status(400).json({ error: 'Invalid JSON request body.' });
      return;
    }
  }

  if (JSON.stringify(rawBody).length > 65_536) {
    res.status(413).json({ error: 'Request too large.' });
    return;
  }

  let body: ReturnType<typeof validateGarminRequest>;
  try {
    body = validateGarminRequest(rawBody);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid Garmin request.' });
    return;
  }

  const username = body.email;
  const password = body.password;
  const action = body.action;

  try {
    let gc = new GarminConnect({ username: username || 'user', password: password || 'pass' });
    const cached = loadCachedSession(apiUser.id);
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
          code: 'GARMIN_AUTH_REQUIRED',
          error: 'Veuillez renseigner votre email et mot de passe Garmin Connect.'
        });
        return;
      }

      gc = new GarminConnect({ username, password });
      await gc.login();

      try {
        const tokens = gc.exportToken();
        saveCachedSession(apiUser.id, username, tokens);
      } catch (tokenExportErr) {
        console.warn('Could not export tokens:', tokenExportErr);
      }
    }

    // ----------------------------------------------------
    // ACTION: PUSH WORKOUT TO GARMIN CONNECT & SCHEDULE
    // ----------------------------------------------------
    if (action === 'push-workout') {
      const workout = body.workout;
      if (!workout) {
        res.status(400).json({ success: false, error: 'Workout payload with title and steps is required.' });
        return;
      }

      const runLease = workout.sportType === 'RUNNING'
        ? await claimGarminRunLease(req, workout.scheduledDate, workout.replaceWorkoutId)
        : null;
      let pushResponse: Record<string, unknown>;
      try {

      const isFR55 = workout.targetWatch === 'FORERUNNER_55';
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

      // A replacement is allowed only for the exact Garmin ID previously stored
      // by this app. Verify it still resolves to one of our workouts before
      // creating anything; never fall back to a title-based search.
      if (workout.replaceWorkoutId) {
        await verifyReplaceableWorkout(gc, workout.replaceWorkoutId);
      }
      if (workout.sportType === 'RUNNING') {
        await assertNoConflictingScheduledQmtRun(gc, workout.scheduledDate, workout.replaceWorkoutId);
      }

      const wb = new WorkoutBuilder(wt, cleanTitle, cleanDesc);

      for (const st of workout.steps as any[]) {
        let stepType = StepType.Run;
        if (st.stepType === 'WARMUP') stepType = StepType.WarmUp;
        else if (st.stepType === 'INTERVAL') stepType = wt === WorkoutType.Running ? StepType.Run : (StepType.Exercise || StepType.Run);
        else if (st.stepType === 'RECOVERY') stepType = StepType.Recovery;
        else if (st.stepType === 'REST') stepType = StepType.Rest;
        // @flow-js/garmin-connect exposes `Cooldown` (lowercase d), not `CoolDown`.
        // The old property was undefined and made Step.build() crash on every workout
        // containing a cooldown with: "Cannot read properties of undefined (reading 'build')".
        else if (st.stepType === 'COOLDOWN') stepType = StepType.Cooldown;

        if (!stepType || typeof stepType.build !== 'function') {
          throw new Error(`Type d’étape Garmin non supporté: ${st.stepType || 'inconnu'}`);
        }

        let duration: any;
        if (st.durationSeconds) {
          duration = new TimeDuration(st.durationSeconds);
        } else if (st.distanceMeters) {
          duration = new DistanceDuration(st.distanceMeters);
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
            const margin = st.targetPaceMarginSeconds || GARMIN_TRAINING_POLICY.defaultPaceMarginSeconds;
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

      const createdWorkoutId = createdWorkout?.workoutId ? String(createdWorkout.workoutId) : '';
      if (!createdWorkoutId) {
        throw new Error('Garmin Connect a créé la séance sans retourner son identifiant. La programmation a été annulée.');
      }

      if (!workout.scheduledDate) {
        throw new Error('La date de programmation Garmin est manquante.');
      }

      runLease?.markScheduled();
      await scheduleWorkoutWithReadback(gc, createdWorkoutId, workout.scheduledDate);

      if (workout.replaceWorkoutId) {
        await finishWorkoutReplacement(gc, workout.replaceWorkoutId, createdWorkoutId);
      }
      await runLease?.confirm(createdWorkoutId);

      pushResponse = {
        success: true,
        workoutId: createdWorkoutId,
        workoutName: workout.title,
        scheduledDate: workout.scheduledDate,
        sportType: workout.sportType,
        message: `Séance "${workout.title}" créée et programmée avec succès sur votre Garmin !`
      };
      } finally {
        if (runLease) {
          try { await runLease.release(); }
          catch (releaseError) { console.warn('Garmin run lease release failed; it will expire:', releaseError); }
        }
      }
      res.status(200).json(pushResponse);
      return;
    }

    // ----------------------------------------------------
    // WELLNESS & ACTIVITIES EXTRACTION (Concurrent with timeouts)
    // ----------------------------------------------------
    const requiredWithin = <T>(promise: Promise<T>, ms: number): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Garmin activity page timed out.')), ms);
        promise.then(
          value => { clearTimeout(timer); resolve(value); },
          error => { clearTimeout(timer); reject(error); }
        );
      });

    let wellness: any = null;
    const todayStr = body.clientDate || getGarminLocalDate();

    const syncMode = body.syncMode;

    let nextOffset: number | null = null;
    let historyTruncated = false;
    const fetchActs = async () => {
      if (action === 'get-wellness') return [];
      if (syncMode === 'full') {
        const batch = await fetchGarminActivityBatch<any>(
          (offset, limit) => requiredWithin<any[]>(gc.getActivities(offset, limit), 15_000),
          body.offset
        );
        nextOffset = batch.nextOffset;
        historyTruncated = batch.truncated;
        return batch.activities;
      } else {
        const limit = body.limit;
        return (await requiredWithin<any[]>(gc.getActivities(0, limit), 15000)) || [];
      }
    };

    const includeWellness = action === 'get-wellness' || syncMode !== 'full' || body.offset === 0;
    const [wellnessResult, acts] = await Promise.all([
      includeWellness ? fetchGarminWellness(gc, todayStr) : Promise.resolve(null),
      fetchActs()
    ]);
    wellness = wellnessResult;

    if (action === 'get-wellness') {
      res.status(200).json({ success: true, wellness });
      return;
    }

    const { activities, skippedActivityCount } = normalizeGarminActivities(acts || []);

    let athleteMaxHr: number | undefined = undefined;
    if (syncMode !== 'full' || body.offset === 0) {
      try {
        const userSettings: any = await requiredWithin(gc.getUserSettings(), 5_000);
        const settingsMax = userSettings?.userData?.maxHeartRate || userSettings?.userProfile?.maxHeartRate || userSettings?.maxHeartRate;
        if (isValidGarminMaxHeartRate(settingsMax)) {
          athleteMaxHr = Math.round(settingsMax);
        }
      } catch (settingsErr) {
        console.warn('Could not fetch user settings for maxHeartRate:', settingsErr);
      }
    }

    // Fallback or validation: check actual highest peak heart rate recorded in activities
    if (activities.length > 0) {
      const recordedPeaks = activities
        .map((a: any) => a.maxHeartRate)
        .filter(isValidRecordedHeartRatePeak);
      if (recordedPeaks.length > 0) {
        const peakRecorded = Math.max(...recordedPeaks);
        if (!athleteMaxHr || peakRecorded > athleteMaxHr) {
          athleteMaxHr = peakRecorded;
        }
      }
    }

    res.status(200).json({ success: true, count: activities.length, activities, skippedActivityCount, wellness, athleteMaxHr, syncMode, nextOffset, historyTruncated });
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

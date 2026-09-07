// Vercel Serverless Function: Live Garmin Connect Sync & Push Engine
import garminPkg from '@flow-js/garmin-connect';
const GarminConnect = (garminPkg as any).GarminConnect || (garminPkg as any).default || garminPkg;
const WorkoutBuilder = (garminPkg as any).WorkoutBuilder;
const WorkoutType = (garminPkg as any).WorkoutType;
const Step = (garminPkg as any).Step;
const StepType = (garminPkg as any).StepType;
const TimeDuration = (garminPkg as any).TimeDuration;
const DistanceDuration = (garminPkg as any).DistanceDuration;
const LapPressDuration = (garminPkg as any).LapPressDuration;
const HrmZoneTarget = (garminPkg as any).HrmZoneTarget;
const HrmTarget = (garminPkg as any).HrmTarget;
const NoTarget = (garminPkg as any).NoTarget;

import fs from 'fs';
import path from 'path';
import os from 'os';

function classifyActivity(typeKey?: string, name?: string): string {
  const k = String(typeKey || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  if (k.includes('climb') || k.includes('boulder') || n.includes('grimp') || n.includes('escalade')) return 'CLIMBING';
  if (k.includes('trail')) return 'TRAIL_RUNNING';
  if (k.includes('run') || n.includes('course') || n.includes('footing') || n.includes('jog')) return 'RUNNING';
  if (k.includes('strength') || k.includes('weight') || k.includes('gym') || n.includes('muscu') || n.includes('calisth')) return 'STRENGTH_TRAINING';
  if (k.includes('cycl') || k.includes('bike') || n.includes('vélo')) return 'CYCLING';
  if (k.includes('walk') || n.includes('marche')) return 'WALKING';
  if (k.includes('swim') || n.includes('natation')) return 'SWIMMING';
  if (k.includes('cardio') || k.includes('hiit')) return 'CARDIO';
  return 'OTHER';
}

const SESSION_FILE = path.join(os.tmpdir(), '.garmin_session.json');

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

export default async function handler(req: any, res: any) {
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

      const wb = new WorkoutBuilder(wt, workout.title, workout.description || 'Séance QMT-80 Performance Hub');

      for (const st of workout.steps) {
        let stepType = StepType.Run;
        if (st.stepType === 'WARMUP') stepType = StepType.WarmUp;
        else if (st.stepType === 'INTERVAL') stepType = (wt === WorkoutType.Running ? StepType.Run : StepType.Interval || StepType.Run);
        else if (st.stepType === 'RECOVERY') stepType = StepType.Recovery;
        else if (st.stepType === 'REST') stepType = StepType.Rest;
        else if (st.stepType === 'COOLDOWN') stepType = StepType.Cooldown;

        let duration: any = new LapPressDuration();
        if (st.durationSeconds && st.durationSeconds > 0) {
          duration = TimeDuration.fromSeconds(st.durationSeconds);
        } else if (st.distanceMeters && st.distanceMeters > 0) {
          duration = DistanceDuration.fromMeters(st.distanceMeters);
        }

        let target: any = new NoTarget();
        if (st.targetType === 'HR_RANGE' && st.targetHrLow && st.targetHrHigh) {
          const mid = Math.round((st.targetHrLow + st.targetHrHigh) / 2);
          const delta = Math.max(5, Math.round((st.targetHrHigh - st.targetHrLow) / 2));
          target = HrmTarget.hrm(mid, delta);
        } else if (st.targetType === 'HR_ZONE' && st.targetHrLow) {
          target = new HrmZoneTarget(st.targetHrLow);
        }

        wb.addStep(new Step(stepType, duration, target, st.stepNotes || ''));
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
    // WELLNESS DATA EXTRACTION (Sleep, HRV, Resting HR, Readiness)
    // ----------------------------------------------------
    let wellness: any = null;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    try {
      let sleepSummary: any = null;
      try {
        const sleepRes: any = await gc.getSleepData(today);
        if (sleepRes?.dailySleepDTO) {
          const dto = sleepRes.dailySleepDTO;
          sleepSummary = {
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

      let restingHeartRate: number | undefined = undefined;
      try {
        const hrRes: any = await gc.getHeartRate(today);
        if (typeof hrRes?.restingHeartRate === 'number') {
          restingHeartRate = hrRes.restingHeartRate;
        }
      } catch (hrErr) {
        console.warn('Could not fetch HR data:', hrErr);
      }

      let hrvSummary: any = null;
      try {
        const hrvRes: any = await (gc.client as any).get(`https://connectapi.garmin.com/hrv-service/hrv/daily/${todayStr}`);
        if (hrvRes?.hrvSummary) {
          const hs = hrvRes.hrvSummary;
          hrvSummary = {
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

      let trainingReadinessScore: number | undefined = undefined;
      try {
        const trRes: any = await (gc.client as any).get(`https://connectapi.garmin.com/metrics-service/metrics/trainingreadiness/${todayStr}`);
        if (Array.isArray(trRes) && trRes.length > 0 && typeof trRes[0]?.score === 'number') {
          trainingReadinessScore = trRes[0].score;
        } else if (typeof trRes?.score === 'number') {
          trainingReadinessScore = trRes.score;
        }
      } catch (trErr) {
        console.warn('Could not fetch Training Readiness:', trErr);
      }

      wellness = {
        date: todayStr,
        sleep: sleepSummary,
        restingHeartRate,
        hrv: hrvSummary,
        trainingReadinessScore,
        syncedAt: new Date().toISOString()
      };
    } catch (wellnessErr) {
      console.warn('General wellness extraction failure:', wellnessErr);
    }

    if (action === 'get-wellness') {
      res.status(200).json({ success: true, wellness });
      return;
    }

    // ----------------------------------------------------
    // ACTION: SYNC ACTIVITIES
    // ----------------------------------------------------
    const rawActivities = await gc.getActivities(0, 100);

    const activities = (rawActivities || []).map((a: any) => {
      const typeKey = String((typeof a.activityType === 'object' ? a.activityType?.typeKey : a.activityType) || '');
      const actName = String(a.activityName || '');
      const activityType = classifyActivity(typeKey, actName);

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
        activityName: a.activityName || 'Garmin Activity',
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

    res.status(200).json({ success: true, count: activities.length, activities, wellness, athleteMaxHr });
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

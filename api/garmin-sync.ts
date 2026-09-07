// Vercel Serverless Function: Live Garmin Connect Sync
import { GarminConnect } from '@flow-js/garmin-connect';
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

  try {
    let gc = new GarminConnect({ username: username || 'user', password: password || 'pass' });
    let rawActivities: any[] | null = null;
    const cached = loadCachedSession();

    // 1. Try reusing cached OAuth tokens
    if (cached?.tokens?.oauth1 && cached?.tokens?.oauth2 && (!username || cached.username === username)) {
      try {
        gc.loadToken(cached.tokens.oauth1, cached.tokens.oauth2);
        rawActivities = await gc.getActivities(0, 100);
      } catch (tokenErr) {
        console.warn('Cached Garmin token expired or invalid, will re-authenticate:', tokenErr);
        rawActivities = null;
      }
    }

    // 2. Authenticate if no valid cached session
    if (!rawActivities) {
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

      rawActivities = await gc.getActivities(0, 100);
    }

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

    res.status(200).json({ success: true, count: activities.length, activities });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      activities: [],
      count: 0,
      error: err.message || 'Erreur lors de la synchronisation Garmin Connect'
    });
  }
}

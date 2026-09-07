import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { parseICSString, buildCompleteCalendar } from './src/services/icsParser';
import { generateICSContent } from './src/services/googleCalendarService';
import { classifyGarminActivityType } from './src/services/activityClassifier';
import garminPkg from '@flow-js/garmin-connect';
const GarminConnect = (garminPkg as any).GarminConnect || garminPkg;
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ICAL_URL = env.ICAL_FEED_URL || env.VITE_ICAL_FEED_URL || process.env.ICAL_FEED_URL || process.env.VITE_ICAL_FEED_URL || '';

  // Forward env to process.env for Node middleware usage
  for (const [key, val] of Object.entries(env)) {
    process.env[key] = val;
  }

  return {
    plugins: [
      react(),
      {
        name: 'academic-ical-and-garmin-proxy',
        configureServer(server) {
          server.middlewares.use('/api/ets-ical', async (_req, res) => {
            try {
              if (!ICAL_URL) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'No VITE_ICAL_FEED_URL configured in .env' }));
                return;
              }
              const response = await fetch(ICAL_URL);
              if (!response.ok) {
                res.statusCode = response.status;
                res.end(JSON.stringify({ error: `Failed to fetch iCal: ${response.statusText}` }));
                return;
              }
              const icsText = await response.text();
              res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
              res.end(icsText);
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message || 'Error fetching iCal' }));
            }
          });

          let sessionGarminUser = process.env.GARMIN_EMAIL || '';
          let sessionGarminPass = process.env.GARMIN_PASSWORD || '';
          const SESSION_FILE = path.resolve(process.cwd(), '.garmin_session.json');

          const loadCachedSession = (): { username?: string; tokens?: any } | null => {
            try {
              if (fs.existsSync(SESSION_FILE)) {
                const content = fs.readFileSync(SESSION_FILE, 'utf-8');
                return JSON.parse(content);
              }
            } catch (e) {
              console.warn('Could not read cached garmin session:', e);
            }
            return null;
          };

          const saveCachedSession = (username: string, tokens: any) => {
            try {
              fs.writeFileSync(SESSION_FILE, JSON.stringify({ username, tokens, savedAt: new Date().toISOString() }, null, 2));
            } catch (e) {
              console.warn('Could not save cached garmin session:', e);
            }
          };

          // Live Garmin Connect synchronization endpoint
          server.middlewares.use('/api/garmin-sync', async (req, res) => {
            const handleGarminRequest = async (user?: string, pass?: string, action: string = 'sync', workoutPayload?: any) => {
              try {
                let gc = new GarminConnect({ username: user || 'user', password: pass || 'pass' });
                const cached = loadCachedSession();
                let isAuthenticated = false;

                // 1. Try reusing cached OAuth tokens without repeating SSO login
                if (cached?.tokens?.oauth1 && cached?.tokens?.oauth2 && (!user || cached.username === user)) {
                  try {
                    gc.loadToken(cached.tokens.oauth1, cached.tokens.oauth2);
                    isAuthenticated = true;
                  } catch (tokenErr) {
                    console.warn('Cached Garmin token expired or invalid, will re-authenticate:', tokenErr);
                    isAuthenticated = false;
                  }
                }

                // 2. If no valid cached session, authenticate with username and password
                if (!isAuthenticated) {
                  if (!user || !pass) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Please provide your Garmin Connect username/email and password' }));
                    return;
                  }

                  gc = new GarminConnect({ username: user, password: pass });
                  await gc.login();
                  sessionGarminUser = user;
                  sessionGarminPass = pass;

                  try {
                    const tokens = gc.exportToken();
                    saveCachedSession(user, tokens);
                  } catch (tokenExportErr) {
                    console.warn('Could not export tokens:', tokenExportErr);
                  }
                }

                // ACTION: PUSH WORKOUT
                if (action === 'push-workout' && workoutPayload) {
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

                  const isFR55 = workoutPayload.targetWatch === 'FORERUNNER_55' || true;
                  let wt = WorkoutType.Running;
                  if (workoutPayload.sportType === 'CARDIO') {
                    wt = WorkoutType.Cardio;
                  } else if (workoutPayload.sportType === 'STRENGTH') {
                    wt = isFR55 ? WorkoutType.Cardio : WorkoutType.Strength;
                  }

                  const wb = new WorkoutBuilder(wt, workoutPayload.title, workoutPayload.description || 'Séance QMT-80 Performance Hub');

                  for (const st of workoutPayload.steps || []) {
                    let stepType = StepType.Run;
                    if (st.stepType === 'WARMUP') stepType = StepType.WarmUp;
                    else if (st.stepType === 'INTERVAL') stepType = (wt === WorkoutType.Running ? StepType.Run : StepType.Exercise || StepType.Run);
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

                  const built = wb.build();
                  const createdWorkout: any = await gc.createWorkout(built);

                  if (workoutPayload.scheduledDate && createdWorkout?.workoutId) {
                    try {
                      await gc.scheduleWorkout({ workoutId: String(createdWorkout.workoutId) }, workoutPayload.scheduledDate);
                    } catch (schedErr) {
                      console.warn('Could not schedule workout:', schedErr);
                    }
                  }

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    workoutId: createdWorkout?.workoutId ? String(createdWorkout.workoutId) : undefined,
                    workoutName: workoutPayload.title,
                    scheduledDate: workoutPayload.scheduledDate,
                    sportType: workoutPayload.sportType,
                    message: `Séance "${workoutPayload.title}" créée et programmée sur votre Garmin !`
                  }));
                  return;
                }

                // WELLNESS EXTRACTION
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
                  } catch (e) {
                    console.warn('Dev middleware sleep error:', e);
                  }

                  let restingHeartRate: number | undefined = undefined;
                  try {
                    const hrRes: any = await gc.getHeartRate(today);
                    if (typeof hrRes?.restingHeartRate === 'number') {
                      restingHeartRate = hrRes.restingHeartRate;
                    }
                  } catch (e) {
                    console.warn('Dev middleware HR error:', e);
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
                  } catch (e) {
                    console.warn('Dev middleware HRV error:', e);
                  }

                  let trainingReadinessScore: number | undefined = undefined;
                  try {
                    const trRes: any = await (gc.client as any).get(`https://connectapi.garmin.com/metrics-service/metrics/trainingreadiness/${todayStr}`);
                    if (Array.isArray(trRes) && trRes.length > 0 && typeof trRes[0]?.score === 'number') {
                      trainingReadinessScore = trRes[0].score;
                    } else if (typeof trRes?.score === 'number') {
                      trainingReadinessScore = trRes.score;
                    }
                  } catch (e) {
                    console.warn('Dev middleware readiness error:', e);
                  }

                  wellness = {
                    date: todayStr,
                    sleep: sleepSummary,
                    restingHeartRate,
                    hrv: hrvSummary,
                    trainingReadinessScore,
                    syncedAt: new Date().toISOString()
                  };
                } catch (wErr) {
                  console.warn('Dev middleware general wellness err:', wErr);
                }

                if (action === 'get-wellness') {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, wellness }));
                  return;
                }

                // DEFAULT: GET ACTIVITIES
                const rawActivities = await gc.getActivities(0, 100);

                const activities = (rawActivities || []).map((a: any) => {
                  const typeKey = String((typeof a.activityType === 'object' ? a.activityType?.typeKey : a.activityType) || '');
                  const actName = String(a.activityName || '');
                  const activityType = classifyGarminActivityType(typeKey, actName);

                  const movingDurSec = a.movingDuration || a.duration || a.elapsedDuration || 0;
                  const elapsedDurSec = a.elapsedDuration || a.duration || 0;
                  const isStrengthOrClimb = activityType === 'STRENGTH_TRAINING' || activityType === 'CLIMBING' || activityType === 'FITNESS_EQUIPMENT';
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
                  if ((activityType === 'RUNNING' || activityType === 'TRAIL_RUNNING' || activityType === 'WALKING') && distKm && distKm > 0.1 && effectiveDurSec > 0) {
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
                    aerobicTrainingEffect: typeof a.aerobicTrainingEffect === 'number' ? parseFloat(a.aerobicTrainingEffect.toFixed(1)) : undefined,
                    anaerobicTrainingEffect: typeof a.anaerobicTrainingEffect === 'number' ? parseFloat(a.anaerobicTrainingEffect.toFixed(1)) : undefined,
                    trainingLoad: a.activityTrainingLoad ? Math.round(a.activityTrainingLoad) : undefined,
                    trainingEffectLabel: a.trainingEffectLabel ? String(a.trainingEffectLabel) : undefined,
                    vo2MaxValue: typeof a.vO2MaxValue === 'number' ? Math.round(a.vO2MaxValue) : undefined,
                    source: 'GARMIN_CONNECT'
                  };
                });

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, count: activities.length, activities, wellness }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Garmin Connect authentication failed. Verify credentials.' }));
              }
            };

            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', () => {
                let parsed: any = {};
                try { parsed = JSON.parse(body); } catch {}
                const user = parsed.username || parsed.email || sessionGarminUser || process.env.GARMIN_EMAIL;
                const pass = parsed.password || sessionGarminPass || process.env.GARMIN_PASSWORD;
                const act = parsed.action || 'sync';
                handleGarminRequest(user, pass, act, parsed.workout);
              });
            } else {
              const user = sessionGarminUser || process.env.GARMIN_EMAIL;
              const pass = sessionGarminPass || process.env.GARMIN_PASSWORD;
              handleGarminRequest(user, pass, 'sync');
            }
          });


          // Live subscription endpoint for Google Calendar / Apple Calendar
          server.middlewares.use('/api/calendar.ics', async (_req, res) => {
            try {
              let rawCourses: any[] = [];
              if (ICAL_URL) {
                try {
                  const response = await fetch(ICAL_URL);
                  if (response.ok) {
                    const rawIcs = await response.text();
                    rawCourses = parseICSString(rawIcs);
                  }
                } catch (e) {
                  console.warn('Could not fetch remote iCal, using fallback', e);
                }
              }

              // Compute start from Monday of current week
              const now = new Date();
              const day = (now.getDay() + 6) % 7;
              const startMonday = new Date(now);
              startMonday.setDate(now.getDate() - day);
              startMonday.setHours(0, 0, 0, 0);

              const { allEvents } = buildCompleteCalendar(rawCourses, startMonday, 90);
              const fullIcsContent = generateICSContent(allEvents);

              res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
              res.setHeader('Content-Disposition', 'inline; filename="qmt80_training_schedule.ics"');
              res.end(fullIcsContent);
            } catch (err: any) {
              res.statusCode = 500;
              res.end(`Error generating calendar subscription: ${err.message || 'Unknown'}`);
            }
          });
        }
      }
    ],
    server: {
      port: 5173,
      host: true
    }
  };
});

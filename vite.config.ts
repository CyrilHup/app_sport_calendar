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
            const handleSync = async (username?: string, password?: string) => {
              try {
                let gc = new GarminConnect({ username: username || 'user', password: password || 'pass' });
                let rawActivities: any[] | null = null;
                const cached = loadCachedSession();

                // 1. Try reusing cached OAuth tokens without repeating SSO login
                if (cached?.tokens?.oauth1 && cached?.tokens?.oauth2 && (!username || cached.username === username)) {
                  try {
                    gc.loadToken(cached.tokens.oauth1, cached.tokens.oauth2);
                    rawActivities = await gc.getActivities(0, 100);
                  } catch (tokenErr) {
                    console.warn('Cached Garmin token expired or invalid, will re-authenticate:', tokenErr);
                    rawActivities = null;
                  }
                }

                // 2. If no valid cached session, authenticate with username and password
                if (!rawActivities) {
                  if (!username || !password) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Please provide your Garmin Connect username/email and password' }));
                    return;
                  }

                  gc = new GarminConnect({ username, password });
                  await gc.login();
                  sessionGarminUser = username;
                  sessionGarminPass = password;

                  // Export and cache tokens for all subsequent requests
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
                  const activityType = classifyGarminActivityType(typeKey, actName);

                  // Durations:
                  // For gym / strength / calisthenics / climbing: elapsed time reflects the total workout session at the gym
                  // For running / trail: moving duration is net running time
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

                  // Compute real pace in min/km (e.g. "5:12 /km")
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
                res.end(JSON.stringify({ success: true, count: activities.length, activities }));
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
                handleSync(user, pass);
              });
            } else {
              const user = sessionGarminUser || process.env.GARMIN_EMAIL;
              const pass = sessionGarminPass || process.env.GARMIN_PASSWORD;
              handleSync(user, pass);
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

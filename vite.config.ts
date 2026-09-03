import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { parseICSString, buildCompleteCalendar } from './src/services/icsParser';
import { generateICSContent } from './src/services/googleCalendarService';
import garminPkg from '@flow-js/garmin-connect';
const GarminConnect = (garminPkg as any).GarminConnect || garminPkg;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ICAL_URL = env.VITE_ICAL_FEED_URL || process.env.VITE_ICAL_FEED_URL || '';

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

          // Live Garmin Connect synchronization endpoint
          server.middlewares.use('/api/garmin-sync', async (req, res) => {
            const handleSync = async (username?: string, password?: string) => {
              if (!username || !password) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Please provide your Garmin Connect username/email and password' }));
                return;
              }

              try {
                const gc = new GarminConnect({ username, password });
                await gc.login();
                const rawActivities = await gc.getActivities(0, 40);

                const activities = (rawActivities || []).map((a: any) => {
                  const typeKey = (typeof a.activityType === 'object' ? a.activityType?.typeKey : a.activityType) || '';
                  const k = String(typeKey).toLowerCase();
                  let activityType = 'OTHER';
                  if (k.includes('trail')) activityType = 'TRAIL_RUNNING';
                  else if (k.includes('run')) activityType = 'RUNNING';
                  else if (k.includes('strength') || k.includes('weight') || k.includes('gym')) activityType = 'STRENGTH_TRAINING';
                  else if (k.includes('cycl') || k.includes('bike')) activityType = 'CYCLING';
                  else if (k.includes('walk') || k.includes('hike')) activityType = 'WALKING';

                  const durMin = a.duration ? Math.round(a.duration / 60) : (a.elapsedDuration ? Math.round(a.elapsedDuration / 60) : 0);
                  const distKm = a.distance ? parseFloat((a.distance / 1000).toFixed(2)) : undefined;
                  const eleGain = a.elevationGain ? Math.round(a.elevationGain) : undefined;
                  const avgHr = a.averageHR ? Math.round(a.averageHR) : undefined;
                  const maxHr = a.maxHR ? Math.round(a.maxHR) : undefined;
                  const avgCadence = a.averageRunningCadenceInStepsPerMinute ? Math.round(a.averageRunningCadenceInStepsPerMinute) : undefined;

                  return {
                    activityId: String(a.activityId || `${Date.now()}-${Math.random()}`),
                    activityName: a.activityName || 'Garmin Activity',
                    activityType,
                    startTimeLocal: a.startTimeLocal || a.startTimeGMT || new Date().toISOString(),
                    durationMinutes: durMin,
                    distanceKm: distKm,
                    elevationGainM: eleGain,
                    avgHeartRate: avgHr,
                    maxHeartRate: maxHr,
                    avgCadence,
                    calories: a.calories ? Math.round(a.calories) : undefined,
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
                const user = parsed.username || parsed.email || process.env.GARMIN_EMAIL;
                const pass = parsed.password || process.env.GARMIN_PASSWORD;
                handleSync(user, pass);
              });
            } else {
              const user = process.env.GARMIN_EMAIL;
              const pass = process.env.GARMIN_PASSWORD;
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

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ICAL_URL = env.VITE_ICAL_FEED_URL || process.env.VITE_ICAL_FEED_URL || '';

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

          // Live subscription endpoint for Google Calendar / Apple Calendar
          server.middlewares.use('/api/calendar.ics', async (_req, res) => {
            try {
              if (!ICAL_URL) {
                res.statusCode = 404;
                res.end('No calendar configured');
                return;
              }
              const response = await fetch(ICAL_URL);
              const rawIcs = response.ok ? await response.text() : '';
              res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
              res.setHeader('Content-Disposition', 'inline; filename="training_schedule.ics"');
              res.end(rawIcs);
            } catch {
              res.statusCode = 500;
              res.end('Error generating calendar subscription');
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

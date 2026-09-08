import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import etsIcalHandler from './api/ets-ical';
import garminSyncHandler from './api/garmin-sync';
import calendarIcsHandler from './api/calendar';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Forward env to process.env for Node middleware usage
  for (const [key, val] of Object.entries(env)) {
    process.env[key] = val;
  }

  return {
    plugins: [
      react(),
      {
        name: 'api-proxy-handlers',
        configureServer(server) {
          server.middlewares.use('/api/ets-ical', (req, res) => etsIcalHandler(req, res));
          server.middlewares.use('/api/garmin-sync', (req, res) => garminSyncHandler(req, res));
          server.middlewares.use('/api/calendar.ics', (req, res) => calendarIcsHandler(req, res));
        }
      }
    ],
    server: {
      port: 5173,
      host: true
    }
  };
});

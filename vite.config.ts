import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import garminSyncHandler from './api/garmin-sync';

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
          server.middlewares.use('/api/garmin-sync', (req, res) => garminSyncHandler(req, res));
        }
      }
    ],
    server: {
      port: 5173,
      host: env.GARMIN_PERSONAL_OWNER_ID === 'local-development' ? '127.0.0.1' : true
    }
  };
});

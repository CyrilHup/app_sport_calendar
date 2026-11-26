# Sport Calendar

A personal training calendar for the QMT-80 plan, with Garmin Connect workouts and activity history. Built with React, TypeScript and Vite; Supabase stores account settings and training data. Capacitor provides the Android app.

Plan, move, swap and review sessions in the app. Changes are sent to Garmin Connect, with a visible confirmation or retry message. Strength sessions remain flexible within the week. The app also supports GPX activity imports, wellness history and training statistics.

iCal feeds, calendar exports and Google Calendar synchronization have been removed. Google sign-in remains available through Supabase.

## Development

Install dependencies with `npm ci`, copy `.env.example` to `.env`, then run `npm run dev`. The development server handles the Garmin API locally.

Before release, run:

```sh
npm run typecheck
npm test
npm run build
```

For Android, run `npm run cap:sync` and `npm run cap:open`.

## Garmin synchronization

For activity and supported wellness reads, [create a Garmin Connect Personal API key](https://connect.garmin.com/app/settings/personalApiToken). Store it as `GARMIN_PERSONAL_API_KEY` in the git-ignored `.env.local` or in the deployment's server environment. Set `GARMIN_PERSONAL_OWNER_ID` to your Supabase Auth user ID. For a loopback-only local preview without Supabase sign-in, use `GARMIN_PERSONAL_OWNER_ID=local-development`. Restart Vite after editing the environment. A fresh library automatically imports its history. Choose **Importer l’historique Garmin** in Garmin settings to repeat a full import.

The [Garmin Connect Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-faq) reads activities, resting heart rate, sleep and HRV when Garmin returns them. Workout publishing uses the existing Garmin Connect session described below. Rotate the API key in Garmin before it expires, update the server environment and restart.

Garmin credentials are entered at runtime; passwords remain session-only. The server caches user-scoped OAuth tokens for up to 24 hours. Workout replacement uses the exact saved Garmin ID and its confirmed source date. The replacement is scheduled and verified before the old workout is removed. Unknown IDs and ambiguous Garmin responses require review instead of guessing which workout to delete.

Supabase migrations in `supabase/migrations/` must be applied in order. `supabase_schema.sql` is the initial bootstrap. Moving sessions requires `20260929211025_garmin_move_source_replacement.sql`, which adds source-date claims and signed confirmations and makes swap registry updates transactional. Apply it before deploying the corresponding server code.

Local tests use simulated Garmin responses. Production verification must additionally move and swap a future session, check Garmin Connect, and read back the registry. A successful build alone does not establish that Garmin has received changes.

See [architecture](docs/architecture.md) for ownership and synchronization details. The training prescriptions remain specific to this personal plan.

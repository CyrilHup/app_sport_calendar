# Data flow and ownership

The application has three external inputs: an academic iCal feed, Garmin Connect,
and Supabase. A calendar refresh is coordinated by `src/services/asyncCoordinator.ts`
and `src/App.tsx`; simultaneous refresh triggers coalesce into one active run and
one latest rerun. Garmin workout pushes have their own latest-request coordinator
in `src/services/garminAutoSyncService.ts`. Automatic foreground/visibility
triggers are registered through `autoRefreshTriggers.ts`; late Capacitor listener
registration is cleaned up after unmount and periodic refresh pauses while hidden.

## Calendar

1. `api/ets-ical.ts` fetches the configured or authenticated user's iCal URL.
   `src/server/icalFeedClient.ts` validates the URL and redirects.
2. `src/services/icsParser.ts` parses courses and builds the base academic/training
   calendar using an immutable `AppConfig` snapshot from
   `src/services/periodizationEngine.ts`.
3. `src/services/calendarPipeline.ts` applies postponements and adaptive changes
   to the base calendar. Both the visible calendar and Garmin push requests use
   this projection; derived events are not stored as a second mutable React state.
4. Snapshot downloads serialize the same canonical event collection currently
   displayed in the UI. Direct Google synchronization consumes that collection
   through the App-level calendar action boundary as well.

## Activities and comparisons

1. Garmin and GPX records merge through `src/services/activityRepository.ts`.
   `activityId` is the identity key; later non-empty fields win, while
   earlier-only metrics survive partial responses. Source order is explicit
   at each boundary (local → cloud during login, cached → live Garmin refresh).
2. `garminActivities` in `App.tsx` is the UI's canonical activity collection.
   Components receive that collection and use `daySelectors.ts` for day views.
3. Workout comparisons and transformed schedules are derived from the canonical
   inputs. Local/cloud settings use per-domain update timestamps to decide which
   copy wins, including when the winning value is empty.
   Cloud mutations are serialized and checked for explicit `false` results as
   well as exceptions. Failed required writes remain local, show a retry banner,
   and retry from the latest in-memory snapshot; wellness cloud storage remains
   optional when its table is unavailable.
4. Pure physiological calculations accept activities and athlete parameters.
   `getStoredAthleteProfile()` is the storage-facing Garmin adapter. The plan
   and Garmin workout builder share Karvonen zone boundaries from
   `heartRateZones.ts`; the app feeds the plan its latest resting-HR baseline.
   Comparisons, weekly telemetry, day cards, and workout details receive the
   same athlete parameters instead of independently choosing a default FCmax.
5. Wellness records from Garmin, local storage, and Supabase merge by their
   `syncedAt` timestamp per day. Missing fields in a newer partial response are
   filled from the older record instead of erasing measurements.
6. Training-load windows and automatic activity-matching policy live in
   `trainingModelConfig.ts`. Calculations and UI labels consume the same named
   values rather than duplicating durations or numeric rejection sentinels.

## Boundaries and operational notes

- Garmin passwords are session-only. The server caches user-scoped OAuth tokens
  for at most 24 hours in owner-readable files. It never automatically deletes
  older Garmin workouts by fuzzy title matching during a push.
- Confirmed workout pushes store the exact Garmin workout ID. If the workout
  definition changes, the server verifies that ID and its app prefix, schedules
  the replacement, then deletes only that previous ID. If deletion fails it
  rolls back the new workout; ambiguous failures stop automatic retries for
  manual review. Older sync records without an ID are left untouched.
- The former manual duplicate-purge button and title-similarity deletion
  endpoint were removed. Duplicate prevention belongs to the ID-based sync
  path, not a separate destructive cleanup path.
- Garmin activity synchronization no longer sends workouts from a potentially
  stale calendar in the account tab. The central refresh rebuilds the plan first,
  then passes the same athlete profile used for the UI preview into workout push.
- Refresh, calendar actions, and workout details now request pushes through one
  App-level entry point. It reads the current base calendar and overrides before
  calling the queued Garmin sync service; views no longer submit their own
  potentially stale event arrays.
- A full Garmin history sync requests bounded batches of up to two 100-activity
  pages per server call. The client follows `nextOffset`, persists each successful
  page, and reports an error instead of silently treating a timed-out page as
  complete history. A 5,000-activity safety limit is reported as incomplete,
  never as a successful full sync.
- The Garmin activity normalizer accepts only records with a stable activity ID
  and parseable start time. It reports skipped malformed records as an incomplete
  sync instead of inventing random IDs or today's date.
- Optional sleep, resting-heart-rate, HRV, and readiness calls are isolated in
  `src/server/garminWellness.ts`. Each signal times out independently, so an
  unavailable wellness endpoint cannot fail the required activity page.
- `ICAL_FEED_URL` is a server-only variable; do not use a `VITE_` prefix for a URL
  containing a private calendar token.
- The former public calendar subscription endpoint was removed: it rebuilt a
  global server calendar that could diverge from the user's profile and expose a
  private academic feed. The supported paths are explicit snapshot download and
  authenticated Google synchronization from the canonical visible events.
- Supabase settings migration is in `supabase_schema.sql`. The API and browser
  code have separate TypeScript checks via `npm run typecheck`.

## Remaining work

- Local activity, wellness, and override storage is intentionally shared on one
  device because this is a personal-use app, not a multi-account product.
- `CalendarView.tsx`, `StatsDashboard.tsx`, and several other views are still
  large and need feature-level decomposition with integration tests. The Garmin
  API handler is being decomposed into tested request, pagination, activity,
  wellness, and replacement adapters.
- Garmin Connect's installed client library has create/delete/schedule operations
  but no supported update operation. Legacy scheduled workouts without an exact
  stored Garmin ID still need manual handling; they are never guessed by title.
- The QMT training prescription, simulator, and several physiological thresholds
  remain race/athlete-specific. They must be separated from reusable scheduling
  logic before claiming the app is configurable for arbitrary races or athletes.

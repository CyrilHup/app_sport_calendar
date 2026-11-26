# Data flow and ownership

## Calendar

`calendarBuilder.ts` generates training sessions from dates, an immutable configuration and Garmin history. `calendarPipeline.ts` applies postponements and adaptive overrides. Both the screen and Garmin synchronization consume this same effective calendar.

`App.tsx` owns persistence. Postponement and adaptive helpers are pure transformations. Undoing a reciprocal swap removes both overrides. Moving a session across weeks removes adaptations belonging to its original week.

Session edits request synchronization directly, without downloading Garmin history or rebuilding the entire calendar. Pending event IDs retain a generation number so an edit made during an in-flight request is sent afterward. Account changes invalidate pending work. The screen distinguishes local save, Garmin confirmation and failure, with a retry action.

Full refreshes coalesce through `asyncCoordinator.ts`. Visibility and mobile resume triggers use `autoRefreshTriggers.ts` and pause periodic refreshes while hidden.

## Garmin workouts

`garminAutoSyncService.ts` sends current-week sessions, explicit edits and previously published future sessions. This includes moves across a week boundary without publishing the whole future plan. Completed sessions are protected.

The account registry records event ID, date, exact Garmin ID and the complete workout signature. The server claims source and target dates before changing a run. It verifies the saved ID on the source date, schedules and reads back the replacement, removes only the exact previous ID, then confirms the new ID and signature in Supabase. An ambiguous create result keeps its lease until expiry.

For swaps, each occupied date receives its replacement first. A single database transaction then exchanges the two event owners, checking both exact IDs and signatures. A lost client response can be recovered from those server-confirmed signatures. There is no non-atomic delete/insert fallback and no title-based adoption of an unknown workout.

The source-date protocol requires `20260929211025_garmin_move_source_replacement.sql`. Migration deployment and live Garmin verification are separate from local test validation. Supabase row-level security scopes registry and lease access to the authenticated account.

## Recorded data

`activityRepository.ts` merges Garmin and GPX records by activity ID, retaining defined metrics from partial responses. `garminActivities` is the canonical collection in the app. Comparisons and statistics are derived from it.

Local and cloud settings use per-domain timestamps, including empty values. Cloud writes are serialized; failures remain local and show a retry message. Device data is scoped to its account through `localAccountScope.ts`. Wellness records merge by date and synchronization timestamp without discarding missing fields from partial responses.

The plan and Garmin workout builder share heart-rate boundaries from `heartRateZones.ts`. Training-load windows live in `trainingModelConfig.ts`; these estimates describe recorded training rather than establish an individual injury diagnosis.

## Integrations

Garmin Connect, GPX imports and Supabase are the supported data paths. iCal feeds, calendar exports and Google Calendar synchronization have been removed. Google sign-in remains an authentication option.

Garmin passwords remain session-only. The server caches account-scoped OAuth tokens for at most 24 hours. Legacy workouts without an exact stored ID require manual review in Garmin Connect.

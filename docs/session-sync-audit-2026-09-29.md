# Session changes and Garmin: audit, 29 September 2026

The calendar-change trigger exists. The main failure is that Garmin replacement
assumes the old workout is already scheduled on the destination date. An ordinary
postponement cannot satisfy that assumption. Additional problems affect moves
across weeks, undoing exchanges, recovery, and visibility of failures.

This is an audit, not an implemented repair. Three subagents independently reviewed
the session flow, Garmin replacement/registry, and simplification opportunities.
Application code, Garmin data, and database state were not changed. Only this
report is retained; temporary reproduction tests were removed after running.

## Verified checks and limits

- Clean Git working tree at the start.
- `npm test -- --reporter=dot`: 45 files, 307 tests passed.
- `npm run typecheck`: browser and API checks passed.
- Two temporary deterministic probes reproduced the source-date rejection and
  a swap retry blocked after a server-confirmed push response was lost. Both
  probes passed by asserting the current incorrect behavior, not a repair.
- `npm run build`: passed. Warnings concern mixed static/dynamic imports and a
  638.20 kB main JavaScript chunk (187.30 kB gzip); these do not explain the move failure.
- Read-only inspection of live Supabase function definitions confirmed the same
  destination-date assumptions in `claim_garmin_run_sync` and
  `confirm_garmin_run_sync`. The live database also contains
  `reconcile_garmin_run_swap`, which the current client does not call.
- No authenticated Garmin mutation or browser end-to-end test was performed.
  Passing tests do not establish successful Garmin synchronization.

## Findings, in repair order

### 1. Ordinary postponements check the old workout on the wrong day — high

Example: a workout with stored Garmin ID 123 moves from Tuesday to Thursday.
The client sends Thursday and ID 123, but no previous scheduled date.
The server searches Thursday for ID 123. Since it is still scheduled on Tuesday,
the server returns `GARMIN_REPLACE_MISSING` before creating the new version.

Evidence: `src/services/garminService.ts:1198-1217`,
`api/garmin-sync.ts:278-283`,
`src/server/garminWorkoutReplacement.ts:289-318`.
Replacement cleanup also reads the destination day for the old ID
(`garminWorkoutReplacement.ts:431-499`). The cloud client hydrates IDs by
destination date rather than first recovering the moved event's source identity
(`garminAutoSyncService.ts:429-445`), so a storage reset makes moves harder to recover.

Minimal repair: represent the previous confirmed Garmin date and exact ID
explicitly. Verify that source, create and verify the destination version, then
retire only the verified old ID and confirm the new registry mapping. If creating
or scheduling fails, retain the original. The server registry transaction must
support moving an existing row; changing only the browser request is insufficient.

### 2. Moving outside the current week omits the changed session — high

Example: Sunday to the following Monday. Sync filters by the new event date, so
the moved event disappears from the current-week batch. Its source placeholder
is excluded too. There is no general reconciliation of removed/moved events;
explicit adapted REST cancellation is a separate path. The old Garmin workout
can remain, while the new date receives no workout from this pass.

Evidence: `src/services/garminAutoSyncService.ts:132-147,218-232,370-427`.

Minimal repair: keep weekly automatic publication, but synchronize explicit edits
by changed event identity and both confirmed source and requested destination.
Define how unfinalized future-week adaptations interact with that edit; do not
publish the entire 84-day calendar to compensate for one moved session.

### 3. Undoing an exchange restores only one member — high

A two-run exchange creates two reciprocal postponement overrides. Undo removes
only the selected event's override. The other workout remains moved onto the
restored workout's original date, leaving two runs that day. Garmin sync then
deliberately suspends synchronization for that date.

Evidence: `src/App.tsx:857-864,878-889`,
`src/services/postponeService.ts:109-140,349-370`,
`src/services/garminAutoSyncService.ts:448-453`.

Minimal repair: undo a reciprocal exchange as one calendar action, restoring both
members, followed by the same synchronization path as other edits.

### 4. Session-edit sync failures are hidden — high

The edit handler requests `autoRechargeAll({ refreshGarmin: false })`, without
`manual: true`. The worker logs a workout error but displays it only for a manual
refresh. The detail modal immediately confirms that the local session moved and
closes, without waiting for Garmin confirmation. This can reasonably look like
successful synchronization even when Garmin rejected it.

Evidence: `src/App.tsx:701-709,811-816`,
`src/components/WorkoutDetailModal.tsx:176-201`.

Minimal repair: distinguish calendar saved, Garmin syncing, Garmin confirmed,
and Garmin failed. Surface failure for a user-triggered edit. Reuse existing sync
results and UI; a second status framework is unnecessary.

### 5. Swap recovery combines competing ID mappings — medium

The swap path assigns each event the ID occupying its destination day. Cloud event
ownership is reconciled only after both members succeed. If the server commits a
new ID but that member's response is lost, while the other member succeeds, the
next batch can compare the stale local ID with the server-confirmed destination
ID and classify it as a conflict. The cloud-only healing branch requires both
fresh signatures, so it does not cover that intermediate state.

Evidence: `src/services/garminAutoSyncService.ts:293-315,324-357,429-445,577-599`.
A temporary deterministic probe reproduced the conflict and skipped retry. The
first-success-response/second-failure case is different and must not be assumed
to have the same failure. Mocked probes do not validate real Garmin recovery.

Minimal repair: preserve the pair's confirmed source/target state across partial
success. Remove heuristics that declare fresh content merely because exactly one
foreign QMT ID is reported on each date (`garminAutoSyncService.ts:617-654`). An
exact ID and day prove presence, not equivalence to the requested workout.

### 6. Failed atomic registry updates fall back to delete/insert — medium

If the swap RPC fails for any reason, the client deletes both registry records
and attempts a separate insert. If insertion fails or another client interleaves,
the exact IDs needed for safe recovery can be lost. A transactional RPC rejection
should not trigger a less reliable destructive fallback.

Evidence: `src/services/supabaseClient.ts:387-447`.

Minimal repair: use one verified transactional operation, return the failure,
retain the records and exact IDs, and expose retry. Remove the browser fallback.

### 7. Old-week adaptations can follow a later move — medium

An adaptation may still match a moved workout through `metadata.originalDate`.
Cross-week cleanup runs when building the weekly decision, but an existing
decision causes the App and CalendarView to skip that work. A later move into an
already-decided week can therefore retain a source-week adaptation.

Evidence: `src/services/adaptivePlanEngine.ts:396-409,463-472`,
`src/App.tsx:893-897`, `src/components/CalendarView.tsx:713-717`.
Existing tests cover cleanup when creating the destination decision, not the
later-edit sequence. This is a state-flow finding, not a measured training outcome.

Minimal repair: reconcile the touched event's weekly adaptation on cross-week
edit without recomputing unrelated frozen decisions.

## Simplifications with a concrete benefit

1. **Separate data refresh from calendar edits.** The existing
   `syncPlannedWorkouts` helper builds the effective calendar from current refs.
   Calling it through the existing synchronization coordinator can avoid iCal
   fetching, complete base-calendar regeneration, and activity/wellness cloud
   writes for a simple move. Preserve account hydration, frozen-week policy, and
   serialization with active refreshes. Evidence: `App.tsx:276-321,525-545,631-665,811-816`.
2. **Give persistence one owner.** Postponement helpers save storage internally;
   App handlers save the same value again. Make the helpers pure and persist once
   at the action boundary. Evidence: `postponeService.ts:342,368`, `App.tsx:867,882`.
3. **Use one exact replacement contract.** Content changes, moves, exchanges,
   and undo should share confirmed event ID, Garmin ID, scheduled date, and
   requested version. Keep exact-ID verification and concurrency protection;
   remove divergent recovery/fallback paths as their behavior is consolidated.

A broad rewrite or new generic orchestration layer would add scope without
solving the observed mismatch. Repair the date/identity contract and visible
status first; simplify the refresh and persistence paths around that contract.

## Acceptance checks for the repair

- Change duration on the same date; verify the exact new Garmin definition.
- Move to a free day, including Sunday to Monday; confirm the destination and
  removal of only the old source ID.
- Exchange two sessions; undo either member; confirm both calendar and Garmin.
- Interrupt after the first exchange member; retry without duplicates or lost IDs.
- Repeat after browser storage reset, using cloud-confirmed IDs.
- Reject unknown IDs and preserve completed workouts/activities.
- Simulate failed schedule, lost response, failed registry write, and concurrent
  refresh/edit; report the failure and retain enough exact state for recovery.
- Finish with authenticated Garmin calendar readback and registry readback after
  deployment. Unit tests and a successful build alone are insufficient.


## Repair implementation and local validation

The repair is implemented in the working tree. The user approved the production migration and deployment; release verification is recorded below. It has not been committed.

- Session replacement now carries the confirmed source date, exact Garmin ID, event ID and complete signature through the browser and server. The server checks the old ID at its source and verifies the replacement at its destination before removal. Cross-week moves and previously published future sessions remain eligible for retries, including a future run changed to rest.
- Swaps are detected from confirmed registry placement. Undo removes both reciprocal postponements. Lost client responses recover only from matching server-confirmed signatures. The exchange RPC checks both signed IDs and owners and commits the mapping in one transaction; the non-atomic fallback is removed.
- Calendar edits synchronize directly. App owns persistence, keeps newer edits pending during in-flight synchronization and invalidates them on account changes. Visible pending, confirmed and failed states include retry. Duplicate error messages are collapsed. The browser no longer writes the run registry after a server-confirmed push, avoiding a redundant competing write.
- Moving across weeks removes an adaptation belonging to the original week.
- iCal feed fetching, parsing, cache, exports, Google Calendar synchronization and the account calendar tab are removed. A pure training-calendar builder replaces the parser/generator combination. Google sign-in remains. Environment examples and documentation reflect the supported app/Garmin workflow.

Validation on the final patch:

- `npm run typecheck`: passed for browser and API.
- `npm test -- --reporter=dot`: 44 files, 312 tests passed. Added regression coverage includes source-date replacement across months, an occupied destination, complete signed confirmation, cross-week moves/rest, interrupted exchanges, lost responses, undo and preservation after a rejected transaction.
- `npm run build`: passed. Existing warnings remain for chunk size and mixed static/dynamic imports; no build error.
- Migration executed against a temporary local PGlite 0.5.8 PostgreSQL instance with matching registry uniqueness constraints and account-owner policies. Source relocation, repeat confirmation, competing claims, occupied-target rollback, signed exchange, repeat exchange, failed-exchange rollback, null-ID rejection and account isolation passed. This is local SQL validation, not a production migration or proof of distributed Garmin atomicity.
- Browser: the local calendar loads; postponement persists, undo restores the session, account settings contain no calendar integration tab. A local API origin rejection leaves the edit saved and shows a single failure message plus retry. No live Garmin success is claimed from this check.
- `git diff --check`: passed.

Release requirements: apply `supabase/migrations/20260929211025_garmin_move_source_replacement.sql` to the production Supabase project before deploying this server code. Production project `qmt80-sport-calendar` was checked read-only and does not yet contain this migration. After deployment, verify a future move and swap in Garmin Connect and read back the exact registry rows. The user subsequently approved applying the migration and deploying the app.

Production migration applied successfully to `qmt80-sport-calendar` (`iolvxwvjasawlnsxlmpi`). Readback confirmed the three RPCs exist, use invoker permissions, permit authenticated execution and deny anonymous execution. Vercel deployment completed: `dpl_GcQxQcp8i49qPQjbdh94cmxZvAAJ` is READY and aliased to `https://appsportcalendar.vercel.app`. The authenticated CLI could inspect the project; CLI 61.1.0 rejected the deployment, while compatible CLI 48.0.2 completed it. No project dependencies were changed.

Public release verification: HTTP 200, new training-calendar title, edit confirmation and source-date protocol present in the served JavaScript; retired feed and Google Calendar API absent. Deployment inspection lists only the Garmin API function. Garmin API GET returns 405 and unauthenticated POST returns 401, establishing handler startup and authentication enforcement. The production browser renders the calendar and the three remaining account tabs with no captured console errors. No live Garmin workout was changed during these read-only release checks, so authenticated Garmin readback remains unverified.

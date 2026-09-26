-- Atomic two-day exchange for the Garmin run registry.
--
-- Context: swapping two planned sessions (A on 2026-09-26, B on 2026-09-27)
-- cannot be persisted with two sequential upserts. The table carries
-- primary key (user_id, event_id) plus unique (user_id, workout_date) and
-- unique (user_id, workout_id), so writing the first swapped row always
-- collides with the second row that still holds the old date/ID. Clients
-- ended up with "Identifiant Garmin du ... non sauvegardé dans le cloud."
-- looping forever while the watch already showed the swapped sessions.
--
-- This function moves both rows in a single transaction by deleting both
-- event rows and inserting the desired final state. Re-running it with the
-- same final state is a no-op, so a lost response can safely be retried.

create or replace function public.exchange_garmin_run_registry_entries(
  p_a_event_id text,
  p_a_workout_date date,
  p_a_workout_id text,
  p_a_signature text,
  p_b_event_id text,
  p_b_workout_date date,
  p_b_workout_id text,
  p_b_signature text
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authenticated Garmin registry exchange required.';
  end if;
  if p_a_event_id is null or length(p_a_event_id) = 0
    or p_b_event_id is null or length(p_b_event_id) = 0
    or p_a_event_id = p_b_event_id then
    raise exception 'Invalid exchanged Garmin event pair.';
  end if;
  if p_a_workout_date is null or p_b_workout_date is null
    or p_a_workout_date = p_b_workout_date then
    raise exception 'Exchanged Garmin workouts must target two distinct dates.';
  end if;
  if p_a_workout_id !~ '^[1-9][0-9]{0,19}$'
    or p_b_workout_id !~ '^[1-9][0-9]{0,19}$'
    or p_a_workout_id = p_b_workout_id then
    raise exception 'Invalid exchanged Garmin workout IDs.';
  end if;
  if p_a_signature is null or p_b_signature is null then
    raise exception 'Exchanged Garmin signatures are required.';
  end if;

  -- Serialize with any concurrent writer touching either event row.
  perform 1 from public.garmin_run_registry
  where user_id = v_user_id and event_id in (p_a_event_id, p_b_event_id)
  for update;

  delete from public.garmin_run_registry
  where user_id = v_user_id and event_id in (p_a_event_id, p_b_event_id);

  insert into public.garmin_run_registry
    (user_id, event_id, workout_date, workout_id, signature, updated_at)
  values
    (v_user_id, p_a_event_id, p_a_workout_date, p_a_workout_id, p_a_signature, now()),
    (v_user_id, p_b_event_id, p_b_workout_date, p_b_workout_id, p_b_signature, now());

  return true;
end;
$$;

revoke execute on function public.exchange_garmin_run_registry_entries(text, date, text, text, text, date, text, text) from public, anon;
grant execute on function public.exchange_garmin_run_registry_entries(text, date, text, text, text, date, text, text) to authenticated;

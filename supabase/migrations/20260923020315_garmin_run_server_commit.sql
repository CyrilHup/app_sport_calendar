-- The API records the exact new Garmin ID before releasing the date lease.
-- This closes the gap between its response and the browser's cloud write.
create or replace function public.claim_garmin_run_sync(
  p_lock_date date,
  p_replace_workout_id text,
  p_claim_id uuid
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_lock_key text;
  v_lock_keys text[] := array['date:' || p_lock_date::text];
  v_current_id text;
begin
  if v_user_id is null or p_lock_date is null or p_claim_id is null then
    raise exception 'Authenticated Garmin sync claim required.';
  end if;
  if p_replace_workout_id is not null then
    if p_replace_workout_id !~ '^[1-9][0-9]{0,19}$' then
      raise exception 'Invalid exact Garmin workout ID.';
    end if;
    v_lock_keys := array_append(v_lock_keys, 'id:' || p_replace_workout_id);
  end if;

  foreach v_lock_key in array v_lock_keys loop
    insert into public.garmin_run_sync_leases (user_id, lock_key, claim_id, expires_at)
    values (v_user_id, v_lock_key, p_claim_id, clock_timestamp() + interval '10 minutes')
    on conflict (user_id, lock_key) do update
      set claim_id = excluded.claim_id, expires_at = excluded.expires_at
      where public.garmin_run_sync_leases.expires_at < clock_timestamp();
    if not found then
      raise exception 'Garmin run sync already in progress for %.', v_lock_key;
    end if;
  end loop;

  select workout_id into v_current_id
  from public.garmin_run_registry
  where user_id = v_user_id and workout_date = p_lock_date;
  if v_current_id is not null and v_current_id is distinct from p_replace_workout_id then
    raise exception 'Garmin run exact ID mismatch for %. Manual review required.', p_lock_date;
  end if;
  return true;
end;
$$;

create or replace function public.confirm_garmin_run_sync(
  p_lock_date date,
  p_previous_workout_id text,
  p_new_workout_id text,
  p_claim_id uuid
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_current_id text;
begin
  if v_user_id is null or p_lock_date is null or p_claim_id is null or
    p_new_workout_id !~ '^[1-9][0-9]{0,19}$' then
    raise exception 'Invalid confirmed Garmin run.';
  end if;
  if not exists (
    select 1 from public.garmin_run_sync_leases
    where user_id = v_user_id and lock_key = 'date:' || p_lock_date::text
      and claim_id = p_claim_id and expires_at > clock_timestamp()
  ) then
    raise exception 'Garmin run claim expired. Manual review required.';
  end if;

  select workout_id into v_current_id
  from public.garmin_run_registry
  where user_id = v_user_id and workout_date = p_lock_date for update;
  if v_current_id is not null and v_current_id is distinct from p_previous_workout_id
    and v_current_id is distinct from p_new_workout_id then
    raise exception 'Garmin run exact ID changed. Manual review required.';
  end if;

  insert into public.garmin_run_registry
    (user_id, event_id, workout_date, workout_id, signature)
  values
    (v_user_id, 'garmin-date:' || p_lock_date::text, p_lock_date, p_new_workout_id, 'pending-server-confirmation')
  on conflict (user_id, workout_date) do update
    set workout_id = excluded.workout_id,
        signature = excluded.signature,
        updated_at = now();
  return true;
end;
$$;

revoke execute on function public.confirm_garmin_run_sync(date, text, text, uuid) from public, anon;
grant execute on function public.confirm_garmin_run_sync(date, text, text, uuid) to authenticated;

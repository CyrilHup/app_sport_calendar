-- Versioned RPCs let the server verify and move an exact workout from its
-- source date while keeping the existing claim/confirm protocol in place.
create or replace function public.claim_garmin_run_sync_v2(
  p_lock_date date,
  p_replace_workout_id text,
  p_claim_id uuid,
  p_replace_workout_date date default null
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_replace_date date := coalesce(p_replace_workout_date, p_lock_date);
  v_lock_key text;
  v_lock_keys text[];
  v_current_id text;
begin
  if v_user_id is null or p_lock_date is null or v_replace_date is null or p_claim_id is null then
    raise exception 'Authenticated Garmin sync claim required.';
  end if;
  if p_replace_workout_id is not null then
    if p_replace_workout_id !~ '^[1-9][0-9]{0,19}$' then
      raise exception 'Invalid exact Garmin workout ID.';
    end if;
  elsif v_replace_date <> p_lock_date then
    raise exception 'A source date requires an exact Garmin workout ID.';
  end if;

  select array_agg(lock_key order by lock_key) into v_lock_keys
  from (
    select distinct lock_key
    from unnest(
      array['date:' || p_lock_date::text, 'date:' || v_replace_date::text] ||
        case when p_replace_workout_id is null then array[]::text[]
          else array['id:' || p_replace_workout_id] end
    ) as lock_key
  ) as ordered_keys;

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

  if p_replace_workout_id is null then
    if exists (
      select 1 from public.garmin_run_registry
      where user_id = v_user_id and workout_date = p_lock_date
    ) then
      raise exception 'Garmin run already registered for %. Manual review required.', p_lock_date;
    end if;
  else
    select workout_id into v_current_id
    from public.garmin_run_registry
    where user_id = v_user_id and workout_date = v_replace_date;
    if v_current_id is not null and v_current_id is distinct from p_replace_workout_id then
      raise exception 'Garmin run exact ID mismatch for %. Manual review required.', v_replace_date;
    end if;
    if v_replace_date <> p_lock_date and exists (
      select 1 from public.garmin_run_registry
      where user_id = v_user_id and workout_date = p_lock_date
    ) then
      raise exception 'Garmin target date % is already registered. Manual review required.', p_lock_date;
    end if;
  end if;
  return true;
end;
$$;

create or replace function public.confirm_garmin_run_sync_v2(
  p_lock_date date,
  p_previous_workout_id text,
  p_new_workout_id text,
  p_claim_id uuid,
  p_replace_workout_date date default null,
  p_event_id text default null,
  p_signature text default null
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_replace_date date := coalesce(p_replace_workout_date, p_lock_date);
  v_signature text := coalesce(p_signature, 'pending-server-confirmation');
  v_lock_key text;
  v_lock_keys text[];
  v_event_id text := coalesce(p_event_id, 'garmin-date:' || p_lock_date::text);
  v_current_event_id text;
  v_current_id text;
  v_current_signature text;
begin
  if v_user_id is null or p_lock_date is null or v_replace_date is null or p_claim_id is null or
    p_new_workout_id is null or p_new_workout_id !~ '^[1-9][0-9]{0,19}$' or length(v_event_id) = 0 or length(v_event_id) > 200 or
    length(v_signature) = 0 or length(v_signature) > 16000 then
    raise exception 'Invalid confirmed Garmin run.';
  end if;
  if p_previous_workout_id is not null and p_previous_workout_id !~ '^[1-9][0-9]{0,19}$' then
    raise exception 'Invalid previous Garmin workout ID.';
  end if;
  if p_previous_workout_id is null and v_replace_date <> p_lock_date then
    raise exception 'A source date requires an exact Garmin workout ID.';
  end if;

  select array_agg(lock_key order by lock_key) into v_lock_keys
  from (
    select distinct lock_key
    from unnest(
      array['date:' || p_lock_date::text, 'date:' || v_replace_date::text] ||
        case when p_previous_workout_id is null then array[]::text[]
          else array['id:' || p_previous_workout_id] end
    ) as lock_key
  ) as ordered_keys;
  foreach v_lock_key in array v_lock_keys loop
    if not exists (
      select 1 from public.garmin_run_sync_leases
      where user_id = v_user_id and lock_key = v_lock_key
        and claim_id = p_claim_id and expires_at > clock_timestamp()
    ) then
      raise exception 'Garmin run claim expired. Manual review required.';
    end if;
  end loop;

  if p_previous_workout_id is null then
    select event_id, workout_id, signature
    into v_current_event_id, v_current_id, v_current_signature
    from public.garmin_run_registry
    where user_id = v_user_id and workout_date = p_lock_date
    for update;
    if found then
      if v_current_id = p_new_workout_id and v_current_signature = v_signature then
        return true;
      end if;
      raise exception 'Garmin target date % changed before confirmation.', p_lock_date;
    end if;
    insert into public.garmin_run_registry
      (user_id, event_id, workout_date, workout_id, signature, updated_at)
    values (v_user_id, v_event_id, p_lock_date, p_new_workout_id, v_signature, now());
    return true;
  end if;

  if v_replace_date = p_lock_date then
    select event_id, workout_id, signature
    into v_current_event_id, v_current_id, v_current_signature
    from public.garmin_run_registry
    where user_id = v_user_id and workout_date = p_lock_date
    for update;
    if not found then
      insert into public.garmin_run_registry
        (user_id, event_id, workout_date, workout_id, signature, updated_at)
      values (v_user_id, v_event_id, p_lock_date, p_new_workout_id, v_signature, now());
      return true;
    end if;
    if v_current_id = p_new_workout_id and v_current_signature = v_signature then
      return true;
    end if;
    if v_current_id is distinct from p_previous_workout_id then
      raise exception 'Garmin run exact ID changed before confirmation for %. ', p_lock_date;
    end if;
    -- Keep the destination slot's event owner until the client commits a swap.
    update public.garmin_run_registry
    set workout_id = p_new_workout_id, signature = v_signature, updated_at = now()
    where user_id = v_user_id and workout_date = p_lock_date
      and workout_id = p_previous_workout_id;
    if not found then raise exception 'Garmin run confirmation lost its exact target row.'; end if;
    return true;
  end if;

  -- Moving one event: atomically relocate its source row only after Garmin has
  -- scheduled the replacement and removed the exact old ID from the source.
  select event_id, workout_id, signature
  into v_current_event_id, v_current_id, v_current_signature
  from public.garmin_run_registry
  where user_id = v_user_id and workout_date = v_replace_date
  for update;
  if found then
    if v_current_id = p_new_workout_id and v_current_signature = v_signature then
      return true;
    end if;
    if v_current_id is distinct from p_previous_workout_id then
      raise exception 'Garmin source ID changed before confirmation for %. ', v_replace_date;
    end if;
    if exists (
      select 1 from public.garmin_run_registry
      where user_id = v_user_id and workout_date = p_lock_date
    ) then
      raise exception 'Garmin target date % changed before confirmation.', p_lock_date;
    end if;
    update public.garmin_run_registry
    set workout_date = p_lock_date, workout_id = p_new_workout_id,
        signature = v_signature, updated_at = now()
    where user_id = v_user_id and workout_date = v_replace_date
      and workout_id = p_previous_workout_id;
    if not found then raise exception 'Garmin source move lost its exact registry row.'; end if;
    return true;
  end if;

  select event_id, workout_id, signature
  into v_current_event_id, v_current_id, v_current_signature
  from public.garmin_run_registry
  where user_id = v_user_id and workout_date = p_lock_date
  for update;
  if found and v_current_id = p_new_workout_id and v_current_signature = v_signature then
    return true;
  end if;
  if found then raise exception 'Garmin target date % changed before confirmation.', p_lock_date; end if;
  insert into public.garmin_run_registry
    (user_id, event_id, workout_date, workout_id, signature, updated_at)
  values (v_user_id, v_event_id, p_lock_date, p_new_workout_id, v_signature, now());
  return true;
end;
$$;

-- Reconcile only after both dates contain the exact signed workouts. The
-- current row owners must be either already-correct or the opposite owners
-- produced by the per-date replacement confirms above.
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
  v_claim_id uuid := pg_catalog.gen_random_uuid();
  v_lock_key text;
  v_lock_keys text[];
  v_a_owner text;
  v_a_id text;
  v_a_signature text;
  v_b_owner text;
  v_b_id text;
  v_b_signature text;
begin
  if v_user_id is null then
    raise exception 'Authenticated Garmin registry exchange required.';
  end if;
  if p_a_event_id is null or length(p_a_event_id) = 0 or length(p_a_event_id) > 200
    or p_b_event_id is null or length(p_b_event_id) = 0 or length(p_b_event_id) > 200
    or p_a_event_id = p_b_event_id then
    raise exception 'Invalid exchanged Garmin event pair.';
  end if;
  if p_a_workout_date is null or p_b_workout_date is null
    or p_a_workout_date = p_b_workout_date then
    raise exception 'Exchanged Garmin workouts must target two distinct dates.';
  end if;
  if p_a_workout_id is null or p_b_workout_id is null or p_a_workout_id !~ '^[1-9][0-9]{0,19}$'
    or p_b_workout_id !~ '^[1-9][0-9]{0,19}$'
    or p_a_workout_id = p_b_workout_id then
    raise exception 'Invalid exchanged Garmin workout IDs.';
  end if;
  if p_a_signature is null or length(p_a_signature) = 0 or length(p_a_signature) > 16000
    or p_b_signature is null or length(p_b_signature) = 0 or length(p_b_signature) > 16000 then
    raise exception 'Exchanged Garmin signatures are required.';
  end if;

  select array_agg(lock_key order by lock_key) into v_lock_keys
  from (
    select distinct lock_key
    from unnest(array[
      'date:' || p_a_workout_date::text,
      'date:' || p_b_workout_date::text
    ]) as lock_key
  ) as ordered_keys;
  foreach v_lock_key in array v_lock_keys loop
    insert into public.garmin_run_sync_leases (user_id, lock_key, claim_id, expires_at)
    values (v_user_id, v_lock_key, v_claim_id, clock_timestamp() + interval '1 minute')
    on conflict (user_id, lock_key) do update
      set claim_id = excluded.claim_id, expires_at = excluded.expires_at
      where public.garmin_run_sync_leases.expires_at < clock_timestamp();
    if not found then
      raise exception 'Garmin run sync already in progress for %.', v_lock_key;
    end if;
  end loop;

  perform 1 from public.garmin_run_registry
  where user_id = v_user_id and
    (event_id in (p_a_event_id, p_b_event_id) or workout_date in (p_a_workout_date, p_b_workout_date))
  order by workout_date, event_id
  for update;

  select event_id, workout_id, signature into v_a_owner, v_a_id, v_a_signature
  from public.garmin_run_registry
  where user_id = v_user_id and workout_date = p_a_workout_date;
  select event_id, workout_id, signature into v_b_owner, v_b_id, v_b_signature
  from public.garmin_run_registry
  where user_id = v_user_id and workout_date = p_b_workout_date;

  if v_a_id is distinct from p_a_workout_id or v_a_signature is distinct from p_a_signature
    or v_b_id is distinct from p_b_workout_id or v_b_signature is distinct from p_b_signature then
    raise exception 'Garmin registry does not contain both exact signed exchange targets.';
  end if;
  if not (
    (v_a_owner = p_a_event_id and v_b_owner = p_b_event_id) or
    (v_a_owner = p_b_event_id and v_b_owner = p_a_event_id)
  ) then
    raise exception 'Garmin registry event owners do not match this exact exchange.';
  end if;

  delete from public.garmin_run_registry
  where user_id = v_user_id and (event_id in (p_a_event_id, p_b_event_id)
    or workout_date in (p_a_workout_date, p_b_workout_date));
  insert into public.garmin_run_registry
    (user_id, event_id, workout_date, workout_id, signature, updated_at)
  values
    (v_user_id, p_a_event_id, p_a_workout_date, p_a_workout_id, p_a_signature, now()),
    (v_user_id, p_b_event_id, p_b_workout_date, p_b_workout_id, p_b_signature, now());

  delete from public.garmin_run_sync_leases
  where user_id = v_user_id and claim_id = v_claim_id;
  return true;
end;
$$;

revoke execute on function public.claim_garmin_run_sync_v2(date, text, uuid, date) from public, anon;
revoke execute on function public.confirm_garmin_run_sync_v2(date, text, text, uuid, date, text, text) from public, anon;
revoke execute on function public.exchange_garmin_run_registry_entries(text, date, text, text, text, date, text, text) from public, anon;
grant execute on function public.claim_garmin_run_sync_v2(date, text, uuid, date) to authenticated;
grant execute on function public.confirm_garmin_run_sync_v2(date, text, text, uuid, date, text, text) to authenticated;
grant execute on function public.exchange_garmin_run_registry_entries(text, date, text, text, text, date, text, text) to authenticated;

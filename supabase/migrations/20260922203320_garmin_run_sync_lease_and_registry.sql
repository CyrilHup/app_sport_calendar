-- Persist the exact Garmin ID for each app-managed running session across
-- browsers/devices. One row per date prevents two different plans claiming
-- to be the app's running workout for the same day.
create table if not exists public.garmin_run_registry (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null check (length(event_id) > 0),
  workout_date date not null,
  workout_id text not null check (workout_id ~ '^[1-9][0-9]{0,19}$'),
  signature text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id),
  unique (user_id, workout_date),
  unique (user_id, workout_id)
);

alter table public.garmin_run_registry enable row level security;
create policy "Users manage own Garmin run registry"
  on public.garmin_run_registry for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.garmin_run_registry to authenticated;

-- A short-lived cross-device claim protects the create/schedule/delete
-- sequence. A crashed function cannot permanently lock an athlete out.
create table if not exists public.garmin_run_sync_leases (
  user_id uuid not null references auth.users(id) on delete cascade,
  lock_key text not null,
  claim_id uuid not null,
  expires_at timestamptz not null,
  primary key (user_id, lock_key)
);

alter table public.garmin_run_sync_leases enable row level security;
create policy "Users manage own Garmin run leases"
  on public.garmin_run_sync_leases for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.garmin_run_sync_leases to authenticated;

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
  return true;
end;
$$;

create or replace function public.release_garmin_run_sync(p_claim_id uuid)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or p_claim_id is null then
    raise exception 'Authenticated Garmin sync release required.';
  end if;
  delete from public.garmin_run_sync_leases
  where user_id = auth.uid() and claim_id = p_claim_id;
end;
$$;

revoke execute on function public.claim_garmin_run_sync(date, text, uuid) from public, anon;
revoke execute on function public.release_garmin_run_sync(uuid) from public, anon;
grant execute on function public.claim_garmin_run_sync(date, text, uuid) to authenticated;
grant execute on function public.release_garmin_run_sync(uuid) to authenticated;

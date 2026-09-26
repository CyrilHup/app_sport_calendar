create table if not exists public.activity_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null,
  garmin_feedback jsonb,
  manual_feedback jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

alter table public.activity_feedback enable row level security;
revoke all on public.activity_feedback from anon, public;
grant select, insert, update, delete on public.activity_feedback to authenticated;

create policy "Users manage own private activity feedback"
  on public.activity_feedback for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

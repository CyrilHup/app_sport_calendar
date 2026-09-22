-- Track independent client domains instead of treating every user_settings
-- update as a change to every override or manual-pair collection.
alter table public.user_settings
  add column if not exists manual_pairs_updated_at timestamptz,
  add column if not exists adaptive_overrides_updated_at timestamptz,
  add column if not exists postpone_overrides_updated_at timestamptz;

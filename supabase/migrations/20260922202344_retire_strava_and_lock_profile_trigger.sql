-- Strava is no longer a supported integration. The retired table has no rows
-- or external dependencies in production; RESTRICT fails safely if that changes.
drop table if exists public.strava_connections restrict;

-- The signup trigger needs definer privileges to create the profile, but it
-- must not be exposed as a privileged RPC to application clients.
alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

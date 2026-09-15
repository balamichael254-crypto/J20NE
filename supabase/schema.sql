-- ===========================================================================
-- Moonpie: every table the /api functions expect.
--
-- These were created by hand in the Supabase dashboard and never written
-- down, which is why "vault sync failed" was impossible to diagnose from the
-- repo: there was nothing to compare the live database against. Run this on
-- a fresh project and every feature that needs the server works.
--
--   Supabase dashboard -> SQL Editor -> paste -> Run
--
-- It is safe to run more than once; everything is IF NOT EXISTS.
--
-- Access model: only the serverless functions talk to these, using the
-- service-role key, which bypasses row level security. RLS is still switched
-- on with no policies, so that if the anon key ever leaks into the client by
-- mistake it reads nothing rather than everything.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- The shared shelf. Notes, doodles and composed letters all live here, and
-- so do bubble scores, duel sessions and Our Eyes Only, which are all just
-- widgets with their own room or a reserved id.
-- api/widgets.js, api/scores.js, api/duel.js, api/vault.js
-- --------------------------------------------------------------------------
create table if not exists public.moonpie_widgets (
  room_hash  text        not null,
  id         text        not null,
  type       text        not null default 'text',
  value      text        not null,
  sender     text,
  created_at bigint      not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (room_hash, id)
);
create index if not exists moonpie_widgets_room_created
  on public.moonpie_widgets (room_hash, created_at desc);

-- --------------------------------------------------------------------------
-- Tap counters: the thinking-of-you heart and the distance signal.
-- api/counter.js
-- --------------------------------------------------------------------------
create table if not exists public.moonpie_counters (
  room_hash text   not null,
  key       text   not null,
  value     bigint not null default 0,
  primary key (room_hash, key)
);

-- One tap is one increment. Doing it in the database rather than
-- read-then-write means two taps at the same moment cannot lose one of each
-- other, which read-modify-write across two phones absolutely would.
create or replace function public.moonpie_increment_counter(
  p_room_hash text, p_key text, p_by int default 1
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
begin
  insert into public.moonpie_counters (room_hash, key, value)
  values (p_room_hash, p_key, greatest(p_by, 0))
  on conflict (room_hash, key)
    do update set value = public.moonpie_counters.value + greatest(p_by, 0)
  returning value into next_value;
  return next_value;
end;
$$;

-- --------------------------------------------------------------------------
-- Today's question. One row per person per day; neither answer is readable
-- by the other until both exist, which is enforced in api/daily-question.js.
-- --------------------------------------------------------------------------
create table if not exists public.moonpie_daily_answers (
  room_hash  text   not null,
  day        text   not null,          -- UTC date, 'YYYY-MM-DD'
  profile    text   not null,
  answer     text   not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (room_hash, day, profile)
);

-- --------------------------------------------------------------------------
-- Push subscriptions, one per person per room. api/push-subscribe.js
-- --------------------------------------------------------------------------
create table if not exists public.moonpie_push_subs (
  room_hash    text   not null,
  profile      text   not null,
  subscription text   not null,        -- JSON: a web-push endpoint or an Expo token
  updated_at   bigint not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (room_hash, profile)
);

-- --------------------------------------------------------------------------
-- Locked to the service role only.
-- --------------------------------------------------------------------------
alter table public.moonpie_widgets       enable row level security;
alter table public.moonpie_counters      enable row level security;
alter table public.moonpie_daily_answers enable row level security;
alter table public.moonpie_push_subs     enable row level security;

revoke all on public.moonpie_widgets       from anon, authenticated;
revoke all on public.moonpie_counters      from anon, authenticated;
revoke all on public.moonpie_daily_answers from anon, authenticated;
revoke all on public.moonpie_push_subs     from anon, authenticated;
revoke all on function public.moonpie_increment_counter(text, text, int) from anon, authenticated;

create table if not exists public.moonpie_widgets (
  room_hash text not null,
  id text not null,
  type text not null check (type in ('text', 'doodle')),
  value text not null,
  sender text not null default 'one of us',
  created_at bigint not null,
  primary key (room_hash, id)
);

create index if not exists moonpie_widgets_room_created_idx
  on public.moonpie_widgets (room_hash, created_at desc);

alter table public.moonpie_widgets enable row level security;

comment on table public.moonpie_widgets is
  'Private cross-device love notes. Access is restricted to the Vercel API service role.';

-- Our Eyes Only + Collective Memories. Every row's value/ct is AES-GCM
-- ciphertext, encrypted in the browser before it ever reaches this table -
-- the server (and anyone who dumps this table) only ever holds ciphertext.
--
-- `to_profile` is how the two features differ:
--   a real name ('Michelle' / 'Michael')  -> Our Eyes Only: a one-way send,
--     readable only by a client asking for that name. The sender's own GET
--     never matches its own sends, which is what makes it one-way - not a
--     shared gallery both can scroll.
--   'shared'                              -> Collective Memories: both
--     profiles query to_profile='shared' and see everything either of you
--     added.
--
-- This is enforced by the query, not by separate encryption keys - both
-- phones hold the same passphrase-derived key. Someone deliberately poking
-- at the API could fetch anything; a normal use of the app cannot.
create table if not exists public.moonpie_vault_items (
  room_hash text not null,
  id text not null,
  to_profile text not null,
  from_profile text not null,
  type text not null,
  iv text not null,
  ct text not null,
  created_at bigint not null,
  primary key (room_hash, id)
);

create index if not exists moonpie_vault_items_room_to_idx
  on public.moonpie_vault_items (room_hash, to_profile, created_at desc);

alter table public.moonpie_vault_items enable row level security;

comment on table public.moonpie_vault_items is
  'Our Eyes Only + Collective Memories. Column values are AES-GCM ciphertext - this table never holds a readable photo. Access is restricted to the Vercel API service role.';

-- Real cross-device push. One row per profile per room; subscribing again
-- (a new device, a reinstalled PWA) just overwrites the old subscription.
create table if not exists public.moonpie_push_subs (
  room_hash text not null,
  profile text not null,
  subscription text not null,
  updated_at bigint not null,
  primary key (room_hash, profile)
);

alter table public.moonpie_push_subs enable row level security;

comment on table public.moonpie_push_subs is
  'Web Push subscriptions, one per profile. Lets the care screen actually notify the other phone. Access is restricted to the Vercel API service role.';

-- Shared atomic counters - the "Thinking of You" tap tally lives here. A
-- plain read-then-write from two phones tapping in the same second would
-- lose one of the taps; the upsert below is atomic at the database level,
-- so concurrent taps from both phones always both land.
create table if not exists public.moonpie_counters (
  room_hash text not null,
  key text not null,
  value bigint not null default 0,
  updated_at bigint not null default 0,
  primary key (room_hash, key)
);

alter table public.moonpie_counters enable row level security;

comment on table public.moonpie_counters is
  'Shared tap/event counters (e.g. "Thinking of You"). Access is restricted to the Vercel API service role.';

create or replace function public.moonpie_increment_counter(p_room_hash text, p_key text, p_by bigint default 1)
returns bigint
language plpgsql
as $$
declare
  new_value bigint;
begin
  insert into public.moonpie_counters (room_hash, key, value, updated_at)
  values (p_room_hash, p_key, p_by, (extract(epoch from now()) * 1000)::bigint)
  on conflict (room_hash, key)
  do update set
    value = public.moonpie_counters.value + excluded.value,
    updated_at = excluded.updated_at
  returning value into new_value;
  return new_value;
end;
$$;

comment on function public.moonpie_increment_counter is
  'Atomically bumps a shared counter by p_by (default 1) and returns the new total. Called via PostgREST RPC from api/counter.js.';

-- Daily Couple Question. One question per day (picked deterministically by
-- date, so both phones see the same one without asking the server "which
-- question"), each profile answers once; the API only reveals both answers
-- once both exist, so nobody sees the other's answer before submitting
-- their own.
create table if not exists public.moonpie_daily_answers (
  room_hash text not null,
  day text not null,
  profile text not null,
  answer text not null,
  created_at bigint not null,
  primary key (room_hash, day, profile)
);

create index if not exists moonpie_daily_answers_room_day_idx
  on public.moonpie_daily_answers (room_hash, day);

alter table public.moonpie_daily_answers enable row level security;

comment on table public.moonpie_daily_answers is
  'Daily Couple Question answers, revealed to both only once both have answered. Access is restricted to the Vercel API service role.';

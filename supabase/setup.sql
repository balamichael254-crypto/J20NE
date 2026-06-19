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

alter table public.leads
add column if not exists contacted boolean not null default false,
add column if not exists contacted_at timestamptz null,
add column if not exists notes text null,
add column if not exists archived boolean not null default false;

create index if not exists leads_contacted_idx on public.leads (contacted);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

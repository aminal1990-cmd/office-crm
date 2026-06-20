create table if not exists public.crm_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.crm_state enable row level security;

drop policy if exists "crm_state_read" on public.crm_state;
drop policy if exists "crm_state_insert" on public.crm_state;
drop policy if exists "crm_state_update" on public.crm_state;

create policy "crm_state_read"
on public.crm_state
for select
to anon
using (true);

create policy "crm_state_insert"
on public.crm_state
for insert
to anon
with check (true);

create policy "crm_state_update"
on public.crm_state
for update
to anon
using (true)
with check (true);

insert into public.crm_state (id, payload)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

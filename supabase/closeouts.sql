-- Run this once in Supabase SQL Editor after schema.sql.
-- It creates the permanent sales-closeout history used to reset the live dashboard.

create table if not exists public.daily_closeouts (
  id uuid primary key default gen_random_uuid(),
  closed_at timestamptz not null default now(),
  total_sales numeric(10, 2) not null check (total_sales >= 0),
  cash_collected numeric(10, 2) not null check (cash_collected >= 0),
  qr_collected numeric(10, 2) not null check (qr_collected >= 0),
  order_count integer not null check (order_count >= 0)
);

create index if not exists daily_closeouts_closed_at_idx on public.daily_closeouts (closed_at desc);

alter table public.daily_closeouts enable row level security;
create policy "development public closeouts" on public.daily_closeouts for all to anon using (true) with check (true);

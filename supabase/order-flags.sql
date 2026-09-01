-- Run this once in Supabase SQL Editor.
-- Flagged orders remain visible for review but are excluded from live sales and closeout totals.

alter table public.orders add column if not exists is_flagged boolean not null default false;
alter table public.orders add column if not exists flag_reason text;

create index if not exists orders_is_flagged_idx on public.orders (is_flagged);

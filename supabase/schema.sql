-- Spud Station: initial Supabase schema
-- Run this once in Supabase Dashboard → SQL Editor → New query.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  category text not null check (char_length(trim(category)) > 0),
  price numeric(10, 2) not null check (price >= 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  payment_method text not null check (payment_method in ('cash', 'qr')),
  status text not null default 'completed' check (status in ('completed', 'preparing', 'ready', 'collected', 'cancelled'))
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0)
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);

-- Development-only access policies.
-- The current app has no staff sign-in yet, so these let the browser app use the anon key.
-- Replace these with authenticated, role-based policies before publishing the app.
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "development public products" on public.products for all to anon using (true) with check (true);
create policy "development public orders" on public.orders for all to anon using (true) with check (true);
create policy "development public order items" on public.order_items for all to anon using (true) with check (true);

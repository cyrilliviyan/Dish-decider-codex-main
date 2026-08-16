create extension if not exists "pgcrypto";

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null default '',
  owner_name text not null default '',
  mobile_number text not null default '',
  email text not null default '',
  owner_pin text not null default '',
  budget_split jsonb not null default '{"starters": 0.35, "mains": 0.65}'::jsonb,
  currency text not null default 'INR',
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  category text not null check (category in ('starter', 'main', 'bread', 'rice', 'dessert', 'drink')),
  price numeric(10, 2) not null check (price >= 0),
  veg_flag boolean not null default true,
  spice_level text not null check (spice_level in ('mild', 'medium', 'hot')),
  serves_count integer not null default 1 check (serves_count > 0),
  must_try boolean not null default false,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  party_size integer not null check (party_size > 0),
  budget numeric(10, 2) not null check (budget >= 0),
  veg_pref text not null check (veg_pref in ('veg', 'non_veg', 'mixed')),
  spice_pref text not null check (spice_pref in ('mild', 'medium', 'hot')),
  allergies text,
  ai_suggested_items jsonb not null default '[]'::jsonb,
  final_items jsonb not null default '[]'::jsonb,
  total_price numeric(10, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  rating integer check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_hotel_available_idx on public.menu_items (hotel_id, is_available);
create index if not exists orders_hotel_created_idx on public.orders (hotel_id, created_at desc);

alter table public.hotels enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Public can read hotels" on public.hotels;
create policy "Public can read hotels"
  on public.hotels for select
  using (true);

drop policy if exists "Public can read available menu items" on public.menu_items;
create policy "Public can read available menu items"
  on public.menu_items for select
  using (is_available = true);

drop policy if exists "Public can manage hotels" on public.hotels;
create policy "Public can manage hotels"
  on public.hotels for all
  using (true)
  with check (true);

drop policy if exists "Public can manage menu items" on public.menu_items;
create policy "Public can manage menu items"
  on public.menu_items for all
  using (true)
  with check (true);

drop policy if exists "Public can insert orders" on public.orders;
create policy "Public can insert orders"
  on public.orders for insert
  with check (true);

drop policy if exists "Public can update pending orders" on public.orders;
create policy "Public can update pending orders"
  on public.orders for update
  using (status = 'pending')
  with check (status in ('pending', 'confirmed', 'cancelled'));

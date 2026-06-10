-- BOLIHON Beach Resort cottage booking schema for Supabase PostgreSQL.
-- Run on a new Supabase project, or adapt into migrations for existing data.

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

create type public.app_role as enum ('guest', 'staff', 'admin');
create type public.room_type as enum ('cove', 'rock', 'rd', 'hall', 'pavillon');
create type public.booking_status as enum (
  'draft',
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show'
);
create type public.payment_status as enum (
  'unpaid',
  'authorized',
  'deposit_paid',
  'paid',
  'partially_refunded',
  'refunded',
  'failed'
);
create type public.payment_method as enum ('card', 'bank_transfer', 'cash', 'paypal', 'stripe');
create type public.promo_type as enum ('percentage', 'fixed_amount');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  role public.app_role not null default 'guest',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id text primary key,
  slug text not null unique,
  name text not null,
  type public.room_type not null,
  description text not null,
  long_description text,
  price_per_night numeric(10, 2) not null check (price_per_night > 0),
  max_guests integer not null check (max_guests > 0),
  bedrooms integer not null default 1 check (bedrooms >= 0),
  bathrooms numeric(3, 1) not null default 1 check (bathrooms >= 0),
  size_sq_ft integer check (size_sq_ft > 0),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_images (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  image_url text not null,
  alt_text text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text,
  category text,
  description text,
  created_at timestamptz not null default now()
);

create table public.room_amenities (
  room_id text not null references public.rooms(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete cascade,
  primary key (room_id, amenity_id)
);

create table public.promos (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  type public.promo_type not null,
  value numeric(10, 2) not null check (value > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  minimum_nights integer not null default 1 check (minimum_nights > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_promo_window check (ends_at is null or ends_at > starts_at),
  constraint valid_promo_discount check (
    (type = 'percentage' and value <= 100)
    or type = 'fixed_amount'
  )
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique default ('BK-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  user_id uuid references public.users(id) on delete set null,
  room_id text not null references public.rooms(id) on delete restrict,
  promo_id uuid references public.promos(id) on delete set null,
  guest_name text not null,
  guest_email text,
  guest_phone text,
  check_in date not null,
  check_out date not null,
  guest_count integer not null check (guest_count > 0),
  nightly_rate numeric(10, 2) not null check (nightly_rate >= 0),
  subtotal_amount numeric(10, 2) not null check (subtotal_amount >= 0),
  discount_amount numeric(10, 2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(10, 2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  status public.booking_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  special_requests text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_booking_dates check (check_out >= check_in),
  constraint valid_cancellation check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled')
  )
);

-- Room availability guard: active pending/confirmed stays for the same room cannot overlap.
alter table public.bookings
  add constraint no_overlapping_active_bookings
  exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[]') with &&
  )
  where (status in ('pending', 'confirmed', 'checked_in'));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  currency char(3) not null default 'PHP',
  method public.payment_method,
  status public.payment_status not null default 'unpaid',
  provider text,
  provider_payment_id text,
  paid_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  room_id text not null references public.rooms(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resort_settings (
  id boolean primary key default true,
  resort_name text not null default 'BOLIHON Beach Resort',
  contact_email text not null,
  contact_phone text,
  address text,
  check_in_time time not null default '15:00',
  check_out_time time not null default '11:00',
  tax_rate numeric(5, 4) not null default 0.1200 check (tax_rate >= 0),
  currency char(3) not null default 'PHP',
  minimum_booking_nights integer not null default 1 check (minimum_booking_nights > 0),
  cancellation_policy text,
  updated_at timestamptz not null default now(),
  constraint one_resort_settings_row check (id)
);

create index rooms_active_featured_idx on public.rooms (is_active, is_featured, sort_order);
create index room_images_room_sort_idx on public.room_images (room_id, sort_order);
create index bookings_user_idx on public.bookings (user_id);
create index bookings_room_dates_idx on public.bookings (room_id, check_in, check_out);
create index bookings_status_idx on public.bookings (status, payment_status);
create index payments_booking_idx on public.payments (booking_id);
create index reviews_room_published_idx on public.reviews (room_id, is_published);
create index promos_code_active_idx on public.promos (code, is_active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_rooms_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();
create trigger set_promos_updated_at before update on public.promos
  for each row execute function public.set_updated_at();
create trigger set_bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();
create trigger set_payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger set_reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role in ('admin', 'staff')
  );
$$;

create or replace function public.is_room_available(
  requested_room_id text,
  requested_check_in date,
  requested_check_out date,
  ignored_booking_id uuid default null
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = requested_room_id
      and r.is_active = true
      and requested_check_out >= requested_check_in
  )
  and not exists (
    select 1
    from public.bookings b
    where b.room_id = requested_room_id
      and b.status in ('pending', 'confirmed', 'checked_in')
      and (ignored_booking_id is null or b.id <> ignored_booking_id)
      and daterange(b.check_in, b.check_out, '[]') && daterange(requested_check_in, requested_check_out, '[]')
  );
$$;

create or replace function public.can_cancel_booking(booking_check_in date)
returns boolean
language sql
stable
as $$
  select current_date <= booking_check_in - 7;
$$;

alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.room_images enable row level security;
alter table public.amenities enable row level security;
alter table public.room_amenities enable row level security;
alter table public.promos enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.resort_settings enable row level security;

create policy "Guests can read own user profile" on public.users
  for select using (auth.uid() = id or public.is_admin());
create policy "Guests can update own user profile" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id and role = 'guest');
create policy "Admins can manage users" on public.users
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read active rooms" on public.rooms
  for select using (is_active = true or public.is_admin());
create policy "Admins can manage rooms" on public.rooms
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read active room images" on public.room_images
  for select using (
    public.is_admin()
    or exists (select 1 from public.rooms r where r.id = room_id and r.is_active)
  );
create policy "Admins can manage room images" on public.room_images
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read amenities" on public.amenities
  for select using (true);
create policy "Admins can manage amenities" on public.amenities
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read room amenities" on public.room_amenities
  for select using (true);
create policy "Admins can manage room amenities" on public.room_amenities
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Guests can read active promos" on public.promos
  for select using (
    public.is_admin()
    or (
      is_active
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
      and (max_redemptions is null or redeemed_count < max_redemptions)
    )
  );
create policy "Admins can manage promos" on public.promos
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Guests can read own bookings" on public.bookings
  for select using (public.is_admin() or user_id = auth.uid());
create policy "Guests can create own bookings" on public.bookings
  for insert with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and status in ('draft', 'pending')
    and public.is_room_available(room_id, check_in, check_out)
  );
create policy "Guests can cancel own pending bookings" on public.bookings
  for update using (
    user_id = auth.uid()
    and status in ('draft', 'pending', 'confirmed')
    and public.can_cancel_booking(check_in)
  )
  with check (
    user_id = auth.uid()
    and status = 'cancelled'
    and cancelled_at is not null
  );
create policy "Admins can manage bookings" on public.bookings
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Guests can read payments for own bookings" on public.payments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.user_id = auth.uid()
    )
  );
create policy "Admins can manage payments" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read published reviews" on public.reviews
  for select using (is_published = true or user_id = auth.uid() or public.is_admin());
create policy "Guests can create reviews for own completed bookings" on public.reviews
  for insert with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.user_id = auth.uid()
        and b.room_id = room_id
        and b.status = 'checked_out'
    )
  );
create policy "Guests can update own unpublished reviews" on public.reviews
  for update using (user_id = auth.uid() and is_published = false)
  with check (user_id = auth.uid() and is_published = false);
create policy "Admins can manage reviews" on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read resort settings" on public.resort_settings
  for select using (true);
create policy "Admins can manage resort settings" on public.resort_settings
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.resort_settings (
  contact_email,
  contact_phone,
  address,
  cancellation_policy
) values (
  'reservations@bolihon.test',
  '+1 808 555 0188',
  'BOLIHON Beach Resort',
  'Free cancellation until 7 days before check-in. One-day deposit retained after that window.'
)
on conflict (id) do nothing;

insert into public.rooms (
  id,
  slug,
  name,
  type,
  description,
  long_description,
  price_per_night,
  max_guests,
  bedrooms,
  bathrooms,
  size_sq_ft,
  is_featured,
  sort_order
) 
select
  'cottage_cove_' || n,
  'cove-' || n,
  'Cove ' || n,
  'cove'::public.room_type,
  'Beachside cottage close to the cove path and resort gardens.',
  'A relaxed BOLIHON cottage with air-conditioned sleeping space, private bath, shaded porch, and quick access to the beach path.',
  700,
  4,
  1,
  1,
  42,
  n <= 3,
  n
from generate_series(1, 45) as n
union all
select
  'cottage_rock_' || n,
  'rock-' || n,
  'Rock ' || n,
  'rock'::public.room_type,
  'Larger cottage near the rock garden with extra living space.',
  'Rock cottages are designed for families and groups who want more floor area, a quiet porch, and easy access to the scenic rock garden.',
  800,
  5,
  2,
  1,
  55,
  n = 1,
  100 + n
from generate_series(1, 6) as n
union all
select
  'cottage_rd_' || n,
  'rd-' || n,
  'RD ' || n,
  'rd'::public.room_type,
  'Comfortable RD cottage with convenient access to resort facilities.',
  'RD cottages balance privacy and convenience with bright interiors, a private bathroom, and a short walk to dining, reception, and the beach.',
  800,
  4,
  1,
  1,
  48,
  n = 1,
  200 + n
from generate_series(1, 8) as n
union all
select
  'cottage_vgp_hall',
  'vgp-hall',
  'VGP Hall',
  'hall'::public.room_type,
  'Large BOLIHON event cottage for gatherings, meetings, and celebrations.',
  'VGP Hall is a spacious bookable cottage-style venue at BOLIHON with flexible seating, private facilities, and admin-editable rate, details, and image controls.',
  4500,
  60,
  0,
  2,
  null,
  true,
  300
union all
select
  'cottage_pavillon',
  'pavillon',
  'Pavillon',
  'pavillon'::public.room_type,
  'Open-air BOLIHON pavillon cottage for casual events and family stays.',
  'The Pavillon is a breezy bookable cottage-style space with shaded gathering areas, nearby resort facilities, and editable admin details.',
  3500,
  40,
  0,
  1,
  null,
  true,
  301
on conflict (id) do nothing;

insert into public.room_images (room_id, image_url, alt_text, is_primary, sort_order)
select
  r.id,
  case r.type
    when 'cove' then 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1400&q=80'
    when 'rock' then 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1400&q=80'
    when 'rd' then 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80'
    when 'hall' then 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1400&q=80'
    else 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=1400&q=80'
  end,
  r.name || ' cottage image',
  true,
  10
from public.rooms r
where r.id like 'cottage_%';

insert into public.amenities (name, icon, category) values
('Ocean view', 'waves', 'room'),
('Air conditioning', 'snowflake', 'room'),
('Breakfast included', 'coffee', 'dining'),
('Beach access', 'umbrella', 'resort'),
('Private bath', 'shower-head', 'room'),
('Outdoor seating', 'chair', 'room'),
('Event space', 'calendar-days', 'venue'),
('Open-air space', 'tent', 'venue')
on conflict (name) do nothing;

insert into public.room_amenities (room_id, amenity_id)
select r.id, a.id
from public.rooms r
join public.amenities a on (
  (r.type = 'cove' and a.name in ('Air conditioning', 'Private bath', 'Beach access'))
  or (r.type = 'rock' and a.name in ('Air conditioning', 'Private bath', 'Outdoor seating'))
  or (r.type = 'rd' and a.name in ('Air conditioning', 'Private bath', 'Breakfast included'))
  or (r.type = 'hall' and a.name in ('Event space', 'Private bath', 'Outdoor seating'))
  or (r.type = 'pavillon' and a.name in ('Open-air space', 'Private bath', 'Beach access'))
)
on conflict do nothing;

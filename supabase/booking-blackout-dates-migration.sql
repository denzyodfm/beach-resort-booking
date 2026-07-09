-- Run this once on an existing Supabase project to enable no-booking holiday dates.

create table if not exists public.booking_blackout_dates (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null unique,
  label text not null default 'Philippine holiday',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_blackout_dates_date_idx
  on public.booking_blackout_dates (blocked_date);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_booking_blackout_dates_updated_at'
  ) then
    create trigger set_booking_blackout_dates_updated_at
      before update on public.booking_blackout_dates
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.booking_blackout_dates enable row level security;

drop policy if exists "Anyone can read booking blackout dates" on public.booking_blackout_dates;
create policy "Anyone can read booking blackout dates" on public.booking_blackout_dates
  for select using (true);

drop policy if exists "Admins can manage booking blackout dates" on public.booking_blackout_dates;
create policy "Admins can manage booking blackout dates" on public.booking_blackout_dates
  for all using (public.is_admin()) with check (public.is_admin());

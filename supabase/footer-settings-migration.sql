-- Run this once on an existing Supabase project to make the footer "Powered by"
-- lockup editable from Admin > Users & settings.

create table if not exists public.site_footer_settings (
  id text primary key default 'footer',
  powered_by_label text not null default 'Powered by',
  company_initial text not null default 'V',
  company_name text not null default 'VALDEMEER RESOURCES, INC',
  team_label text not null default 'IT TEAM - KAMARU',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single global row. The footer renders once for the whole site.
insert into public.site_footer_settings (id)
  values ('footer')
  on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_site_footer_settings_updated_at'
  ) then
    create trigger set_site_footer_settings_updated_at
      before update on public.site_footer_settings
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.site_footer_settings enable row level security;

drop policy if exists "Anyone can read footer settings" on public.site_footer_settings;
create policy "Anyone can read footer settings" on public.site_footer_settings
  for select using (true);

drop policy if exists "Admins can manage footer settings" on public.site_footer_settings;
create policy "Admins can manage footer settings" on public.site_footer_settings
  for all using (public.is_admin()) with check (public.is_admin());

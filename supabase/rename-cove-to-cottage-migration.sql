-- Rename "Cove 1..45" to "Cottage 1..45".
--
-- What changes:  rooms.name, rooms.slug, room_images.alt_text,
--                room_categories row 'cove' (label + description),
--                the default-rates auto-reply text.
-- What does NOT change: rooms.id (cottage_cove_N) and room_categories.id ('cove'),
--                so bookings, reviews, images and amenities keep their foreign keys.
--
-- Safe to re-run. Every value it touches is snapshotted first into a
-- *_rename_backup_cove table, and supabase/rename-cove-to-cottage-rollback.sql
-- restores those exact originals.
--
-- Take a database backup first if you want a second restore point (see docs/backup.md).

begin;

------------------------------------------------------------------
-- 0. Pre-flight. Fail loudly rather than half-renaming.
------------------------------------------------------------------
do $$
declare
  clashing text;
begin
  select string_agg(slug, ', ')
  into clashing
  from public.rooms
  where slug ~ '^cottage-[0-9]+$'
    and category_id is distinct from 'cove';

  if clashing is not null then
    raise exception
      'Slug conflict: % already exist outside the cove category. Resolve these before renaming.',
      clashing;
  end if;

  if exists (
    select 1 from public.room_categories where name = 'Cottages' and id <> 'cove'
  ) then
    raise exception 'A different category is already named "Cottages". Resolve before renaming.';
  end if;
end $$;

------------------------------------------------------------------
-- 1. Snapshot the originals.
--    "on conflict do nothing" keeps the FIRST snapshot if this is re-run,
--    so the rollback always returns to the pre-rename state.
------------------------------------------------------------------
create table if not exists public.rooms_rename_backup_cove (
  id text primary key,
  name text not null,
  slug text not null,
  backed_up_at timestamptz not null default now()
);
alter table public.rooms_rename_backup_cove enable row level security;

insert into public.rooms_rename_backup_cove (id, name, slug)
select id, name, slug
from public.rooms
where category_id = 'cove'
  and name ~ '^Cove [0-9]+$'
on conflict (id) do nothing;

create table if not exists public.room_images_rename_backup_cove (
  id uuid primary key,
  alt_text text,
  backed_up_at timestamptz not null default now()
);
alter table public.room_images_rename_backup_cove enable row level security;

insert into public.room_images_rename_backup_cove (id, alt_text)
select i.id, i.alt_text
from public.room_images i
join public.rooms r on r.id = i.room_id
where r.category_id = 'cove'
  and i.alt_text ~ '^Cove [0-9]+ '
on conflict (id) do nothing;

create table if not exists public.room_categories_rename_backup_cove (
  id text primary key,
  name text not null,
  description text,
  backed_up_at timestamptz not null default now()
);
alter table public.room_categories_rename_backup_cove enable row level security;

insert into public.room_categories_rename_backup_cove (id, name, description)
select id, name, description
from public.room_categories
where id = 'cove'
on conflict (id) do nothing;

create table if not exists public.auto_reply_rename_backup_cove (
  id text primary key,
  response text not null,
  backed_up_at timestamptz not null default now()
);
alter table public.auto_reply_rename_backup_cove enable row level security;

insert into public.auto_reply_rename_backup_cove (id, response)
select id, response
from public.auto_reply_knowledge
where response like '%Php700 for Cove cottages%'
on conflict (id) do nothing;

------------------------------------------------------------------
-- 2. Rename. In UPDATE, every right-hand expression reads the OLD row,
--    so slug can be derived from the pre-rename name.
------------------------------------------------------------------
update public.rooms
set
  name = 'Cottage ' || (regexp_match(name, '^Cove ([0-9]+)$'))[1],
  slug = 'cottage-' || (regexp_match(name, '^Cove ([0-9]+)$'))[1]
where category_id = 'cove'
  and name ~ '^Cove [0-9]+$';

update public.room_images i
set alt_text = 'Cottage ' || substring(i.alt_text from '^Cove (.*)$')
from public.rooms r
where r.id = i.room_id
  and r.category_id = 'cove'
  and i.alt_text ~ '^Cove [0-9]+ ';

update public.room_categories
set
  name = 'Cottages',
  description = 'Cottage 1 to 45 - Php700/day'
where id = 'cove';

update public.auto_reply_knowledge
set response = replace(response, 'Php700 for Cove cottages', 'Php700 for Cottages 1 to 45')
where response like '%Php700 for Cove cottages%';

------------------------------------------------------------------
-- 3. Report anything that still says "Cove" so it can be reviewed by hand.
--    Free-text prose about the physical cove (for example "close to the cove
--    path") is intentionally left alone.
------------------------------------------------------------------
do $$
declare
  leftovers text;
begin
  select string_agg(id, ', ')
  into leftovers
  from public.rooms
  where category_id = 'cove'
    and (name like '%Cove %' or long_description like '%Cove %');

  if leftovers is not null then
    raise notice 'Still mention "Cove" and may need a manual edit: %', leftovers;
  end if;
end $$;

commit;

------------------------------------------------------------------
-- 4. Verify.
------------------------------------------------------------------
select
  (select count(*) from public.rooms where category_id = 'cove' and name ~ '^Cottage [0-9]+$') as renamed_rooms,
  (select count(*) from public.rooms where category_id = 'cove' and name ~ '^Cove [0-9]+$') as still_named_cove,
  (select count(*) from public.rooms_rename_backup_cove) as rows_in_backup,
  (select name from public.room_categories where id = 'cove') as category_name;

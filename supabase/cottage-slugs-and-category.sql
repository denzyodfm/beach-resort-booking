-- Slugs and category label for the Cove -> Cottage rename.
--
-- Companion to renaming the 45 cottage names by hand in the admin dashboard,
-- which cannot edit either of these fields.
--
-- Changes:    rooms.slug            cove-N -> cottage-N
--             room_categories 'cove'  name -> 'Cottages'
--                                     description -> 'Cottage 1 to 45 - Php700/day'
-- Unchanged:  rooms.id, rooms.name, room_categories.id
--
-- Keyed off the slug rather than the name, so it works whether or not the
-- dashboard renames are finished. Safe to re-run. Snapshots the originals for
-- cottage-slugs-and-category-rollback.sql.

begin;

-- Fail rather than half-apply.
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
    raise exception 'Slug conflict: % already used outside the cove category.', clashing;
  end if;

  if exists (select 1 from public.room_categories where name = 'Cottages' and id <> 'cove') then
    raise exception 'A different category is already named "Cottages".';
  end if;
end $$;

create table if not exists public.rename_backup_slugs_cove (
  id text primary key,
  slug text not null,
  backed_up_at timestamptz not null default now()
);
alter table public.rename_backup_slugs_cove enable row level security;

insert into public.rename_backup_slugs_cove (id, slug)
select id, slug
from public.rooms
where category_id = 'cove'
  and slug ~ '^cove-[0-9]+$'
on conflict (id) do nothing;

create table if not exists public.rename_backup_category_cove (
  id text primary key,
  name text not null,
  description text,
  backed_up_at timestamptz not null default now()
);
alter table public.rename_backup_category_cove enable row level security;

insert into public.rename_backup_category_cove (id, name, description)
select id, name, description
from public.room_categories
where id = 'cove'
on conflict (id) do nothing;

update public.rooms
set slug = 'cottage-' || (regexp_match(slug, '^cove-([0-9]+)$'))[1]
where category_id = 'cove'
  and slug ~ '^cove-[0-9]+$';

update public.room_categories
set
  name = 'Cottages',
  description = 'Cottage 1 to 45 - Php700/day'
where id = 'cove';

commit;

select
  (select count(*) from public.rooms where category_id = 'cove' and slug ~ '^cottage-[0-9]+$') as new_slugs,
  (select count(*) from public.rooms where category_id = 'cove' and slug ~ '^cove-[0-9]+$') as old_slugs_left,
  (select name from public.room_categories where id = 'cove') as category_name;

-- Undo supabase/cottage-slugs-and-category.sql.
--
-- Restores the exact slugs and category label captured before the change.
-- Does not touch rooms.name, which is managed by hand in the admin dashboard.
-- Safe to re-run. Aborts if the snapshot is missing rather than guessing.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'rename_backup_slugs_cove'
  ) then
    raise exception 'No snapshot table found. The slug change either never ran here, or the backup was dropped.';
  end if;
end $$;

update public.rooms r
set slug = b.slug
from public.rename_backup_slugs_cove b
where r.id = b.id
  and r.slug is distinct from b.slug;

update public.room_categories c
set
  name = b.name,
  description = b.description
from public.rename_backup_category_cove b
where c.id = b.id
  and (c.name, c.description) is distinct from (b.name, b.description);

commit;

select
  (select count(*) from public.rooms where category_id = 'cove' and slug ~ '^cove-[0-9]+$') as restored_slugs,
  (select name from public.room_categories where id = 'cove') as category_name;

-- Once satisfied, drop the snapshots:
--   drop table public.rename_backup_slugs_cove;
--   drop table public.rename_backup_category_cove;

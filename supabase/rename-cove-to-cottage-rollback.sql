-- Undo supabase/rename-cove-to-cottage-migration.sql.
--
-- Restores the exact names, slugs, alt texts, category label and auto-reply
-- text captured in the *_rename_backup_cove tables before the rename ran.
-- Safe to re-run. Aborts if the snapshot is missing rather than guessing.
--
-- After running this, revert the matching code changes too, otherwise the
-- seed data in src/lib/resort-data.ts and the database will disagree in
-- demo mode. See the "How to undo" notes that came with the rename.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'rooms_rename_backup_cove'
  ) then
    raise exception
      'No snapshot table found. The rename either never ran here, or the backup was dropped.';
  end if;

  if not exists (select 1 from public.rooms_rename_backup_cove) then
    raise exception 'Snapshot table is empty, so there is nothing to restore.';
  end if;
end $$;

update public.rooms r
set
  name = b.name,
  slug = b.slug
from public.rooms_rename_backup_cove b
where r.id = b.id
  and (r.name, r.slug) is distinct from (b.name, b.slug);

update public.room_images i
set alt_text = b.alt_text
from public.room_images_rename_backup_cove b
where i.id = b.id
  and i.alt_text is distinct from b.alt_text;

update public.room_categories c
set
  name = b.name,
  description = b.description
from public.room_categories_rename_backup_cove b
where c.id = b.id
  and (c.name, c.description) is distinct from (b.name, b.description);

update public.auto_reply_knowledge k
set response = b.response
from public.auto_reply_rename_backup_cove b
where k.id = b.id
  and k.response is distinct from b.response;

commit;

------------------------------------------------------------------
-- Verify the restore.
------------------------------------------------------------------
select
  (select count(*) from public.rooms where category_id = 'cove' and name ~ '^Cove [0-9]+$') as restored_rooms,
  (select count(*) from public.rooms where category_id = 'cove' and name ~ '^Cottage [0-9]+$') as still_renamed,
  (select name from public.room_categories where id = 'cove') as category_name;

------------------------------------------------------------------
-- Once you are satisfied the restore is correct, drop the snapshots:
--
--   drop table public.rooms_rename_backup_cove;
--   drop table public.room_images_rename_backup_cove;
--   drop table public.room_categories_rename_backup_cove;
--   drop table public.auto_reply_rename_backup_cove;
------------------------------------------------------------------

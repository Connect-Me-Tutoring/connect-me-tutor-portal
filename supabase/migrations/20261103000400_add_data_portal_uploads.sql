-- Data Portal uploads: CSV files an admin uploads become tables every admin
-- can use. No tutor or student can ever reach them.
--
-- Some of what the analyses need is not in the portal's own tables: the
-- application spreadsheets, Zoom exports, school-system exports. An admin
-- uploads the CSV from the Data Portal page and it becomes uploads.<name>,
-- shared by every admin.
--
--   - The original file goes to the private data-portal-uploads bucket and
--     stays there. Only Active Admins can read or add files, and nobody can
--     change or delete one, so every version ever uploaded can be recovered.
--   - The rows go to a table in the uploads schema. That schema is not
--     exposed through the API and no client role holds any privilege on it,
--     so the tables are reachable only through the functions below.
--   - Uploading the same dataset name again replaces its table. The import
--     fills a staging table first and swaps it in at the end, so a failed or
--     half-finished upload never leaves a dataset partly replaced.
--
-- Every function decides who is calling from auth.uid() on the caller's own
-- session and refuses anyone whose active profile is not an Active Admin:
-- private.is_admin(), the same gate as data_portal_overview(). Every value is
-- stored as text: the CSV is kept exactly as uploaded and the analyses decide
-- how to read it.
--
-- Dataset and column names reach dynamic SQL only after they match
-- ^[a-z_][a-z0-9_]*$, and are quoted with %I on top of that.

begin;

-- The gate is private.is_admin() (20261103000100_admin_requires_active_profile):
-- the caller's active profile is their own, an Admin, and Active. The storage
-- policies below use it too, so there is one definition of admin.

-- ---------------------------------------------------------------------------
-- Where the rows live, and the catalog of what has been uploaded
-- ---------------------------------------------------------------------------

create schema if not exists uploads;
revoke all on schema uploads from public, anon, authenticated;

create schema if not exists analysis;

-- One row per dataset that currently has a table.
create table if not exists analysis.uploaded_datasets (
  name text primary key check (name ~ '^[a-z][a-z0-9_]{0,47}$'),
  title text not null check (char_length(title) between 1 and 120),
  columns text[] not null,
  row_count integer not null,
  storage_path text not null,
  original_filename text not null,
  uploaded_by_profile uuid not null,
  uploaded_at timestamptz not null default now()
);

-- One row per upload ever attempted, including the ones that were replaced
-- or never finished. storage_path is where that upload's original file is.
create table if not exists analysis.dataset_uploads (
  id uuid primary key default gen_random_uuid(),
  dataset_name text not null,
  title text not null,
  columns text[] not null,
  storage_path text not null,
  original_filename text not null,
  uploaded_by uuid not null,
  uploaded_by_profile uuid not null,
  status text not null default 'importing'
    check (status in ('importing', 'ready', 'failed')),
  row_count integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists dataset_uploads_name_idx
  on analysis.dataset_uploads (dataset_name, started_at desc);

alter table analysis.uploaded_datasets enable row level security;
alter table analysis.dataset_uploads enable row level security;
revoke all on analysis.uploaded_datasets from public, anon, authenticated;
revoke all on analysis.dataset_uploads from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internals
-- ---------------------------------------------------------------------------

create or replace function analysis.require_active_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Admin access required';
  end if;
end;
$$;

revoke all on function analysis.require_active_admin() from public;

create or replace function analysis.upload_staging_table(p_upload_id uuid)
returns text
language sql
immutable
as $$
  select '_import_' || replace(p_upload_id::text, '-', '');
$$;

revoke all on function analysis.upload_staging_table(uuid) from public;

-- The upload must exist, still be importing, and belong to the caller.
create or replace function analysis.claim_upload(p_upload_id uuid)
returns analysis.dataset_uploads
language plpgsql
security definer
set search_path = public, analysis, pg_temp
as $$
declare
  v_upload analysis.dataset_uploads;
begin
  select * into v_upload
  from analysis.dataset_uploads
  where id = p_upload_id
  for update;

  if not found or v_upload.uploaded_by is distinct from (select auth.uid()) then
    raise exception 'Unknown upload';
  end if;
  if v_upload.status <> 'importing' then
    raise exception 'This upload is already %', v_upload.status;
  end if;
  return v_upload;
end;
$$;

revoke all on function analysis.claim_upload(uuid) from public;

-- ---------------------------------------------------------------------------
-- The import: begin, append rows in chunks, then finish or cancel
-- ---------------------------------------------------------------------------

create or replace function public.data_portal_begin_upload(
  p_name text,
  p_title text,
  p_columns text[],
  p_storage_path text,
  p_filename text
)
returns uuid
language plpgsql
security definer
set search_path = public, analysis, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile uuid;
  v_id uuid := gen_random_uuid();
  v_stale record;
begin
  perform analysis.require_active_admin();

  if p_name is null or p_name !~ '^[a-z][a-z0-9_]{0,47}$' then
    raise exception 'Invalid dataset name';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then
    raise exception 'Invalid dataset title';
  end if;
  if p_filename is null or char_length(p_filename) not between 1 and 255 then
    raise exception 'Invalid file name';
  end if;
  if p_columns is null
     or cardinality(p_columns) not between 1 and 200
     or exists (select 1 from unnest(p_columns) c where c is null or c !~ '^[a-z_][a-z0-9_]{0,62}$')
     or (select count(distinct c) from unnest(p_columns) c) <> cardinality(p_columns) then
    raise exception 'Invalid column names';
  end if;
  -- The original file must already be in the bucket, in this dataset's folder.
  if p_storage_path is null
     or p_storage_path !~ ('^datasets/' || p_name || '/[A-Za-z0-9_.-]{1,120}\.csv$') then
    raise exception 'Invalid storage path';
  end if;
  -- Nested so the inner query is only planned where storage.objects exists.
  if to_regclass('storage.objects') is not null then
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'data-portal-uploads' and o.name = p_storage_path
    ) then
      raise exception 'The uploaded file was not found';
    end if;
  end if;

  select us.last_active_profile_id into v_profile
  from public.user_settings us
  where us.user_id = v_uid;

  -- Imports nobody finished within a day are abandoned. Clear them away.
  for v_stale in
    select id from analysis.dataset_uploads
    where status = 'importing' and started_at < now() - interval '1 day'
    for update skip locked
  loop
    execute format('drop table if exists uploads.%I', analysis.upload_staging_table(v_stale.id));
    update analysis.dataset_uploads
    set status = 'failed', finished_at = now()
    where id = v_stale.id;
  end loop;

  insert into analysis.dataset_uploads (
    id, dataset_name, title, columns, storage_path, original_filename,
    uploaded_by, uploaded_by_profile
  )
  values (
    v_id, p_name, btrim(p_title), p_columns, p_storage_path, p_filename,
    v_uid, v_profile
  );

  execute format(
    'create table uploads.%I (%s)',
    analysis.upload_staging_table(v_id),
    (select string_agg(format('%I text', c), ', ' order by ord)
     from unnest(p_columns) with ordinality as t(c, ord))
  );

  return v_id;
end;
$$;

-- p_rows is a JSON array of rows, each an array of string-or-null values in
-- the order of the upload's columns.
create or replace function public.data_portal_append_upload_rows(
  p_upload_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, analysis, pg_temp
as $$
declare
  v_upload analysis.dataset_uploads;
  v_width integer;
  v_count integer;
begin
  perform analysis.require_active_admin();
  v_upload := analysis.claim_upload(p_upload_id);
  v_width := cardinality(v_upload.columns);

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows must be an array';
  end if;
  v_count := jsonb_array_length(p_rows);
  if v_count = 0 or v_count > 5000 then
    raise exception 'Send between 1 and 5000 rows at a time';
  end if;
  if v_upload.row_count + v_count > 200000 then
    raise exception 'A dataset can hold at most 200000 rows';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where jsonb_typeof(r) <> 'array'
       or jsonb_array_length(r) <> v_width
       or exists (
         select 1 from jsonb_array_elements(r) v
         where jsonb_typeof(v) not in ('string', 'null')
       )
  ) then
    raise exception 'Every row must hold % text values', v_width;
  end if;

  execute format(
    'insert into uploads.%I (%s) select %s from jsonb_array_elements($1) as r',
    analysis.upload_staging_table(v_upload.id),
    (select string_agg(format('%I', c), ', ' order by ord)
     from unnest(v_upload.columns) with ordinality as t(c, ord)),
    (select string_agg(format('r ->> %s', ord - 1), ', ' order by ord)
     from unnest(v_upload.columns) with ordinality as t(c, ord))
  ) using p_rows;

  update analysis.dataset_uploads
  set row_count = row_count + v_count
  where id = v_upload.id;

  return v_upload.row_count + v_count;
end;
$$;

create or replace function public.data_portal_finish_upload(p_upload_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, analysis, pg_temp
as $$
declare
  v_upload analysis.dataset_uploads;
begin
  perform analysis.require_active_admin();
  v_upload := analysis.claim_upload(p_upload_id);

  if v_upload.row_count = 0 then
    raise exception 'The upload has no rows';
  end if;

  -- Two admins replacing the same dataset at once take turns.
  perform pg_advisory_xact_lock(hashtextextended('data_portal_upload:' || v_upload.dataset_name, 0));

  execute format('drop table if exists uploads.%I', v_upload.dataset_name);
  execute format(
    'alter table uploads.%I rename to %I',
    analysis.upload_staging_table(v_upload.id),
    v_upload.dataset_name
  );

  insert into analysis.uploaded_datasets (
    name, title, columns, row_count, storage_path, original_filename,
    uploaded_by_profile, uploaded_at
  )
  values (
    v_upload.dataset_name, v_upload.title, v_upload.columns, v_upload.row_count,
    v_upload.storage_path, v_upload.original_filename, v_upload.uploaded_by_profile, now()
  )
  on conflict (name) do update set
    title = excluded.title,
    columns = excluded.columns,
    row_count = excluded.row_count,
    storage_path = excluded.storage_path,
    original_filename = excluded.original_filename,
    uploaded_by_profile = excluded.uploaded_by_profile,
    uploaded_at = excluded.uploaded_at;

  update analysis.dataset_uploads
  set status = 'ready', finished_at = now()
  where id = v_upload.id;

  return jsonb_build_object(
    'name', v_upload.dataset_name,
    'title', v_upload.title,
    'columns', to_jsonb(v_upload.columns),
    'rowCount', v_upload.row_count
  );
end;
$$;

create or replace function public.data_portal_cancel_upload(p_upload_id uuid)
returns void
language plpgsql
security definer
set search_path = public, analysis, pg_temp
as $$
declare
  v_upload analysis.dataset_uploads;
begin
  perform analysis.require_active_admin();
  v_upload := analysis.claim_upload(p_upload_id);

  execute format('drop table if exists uploads.%I', analysis.upload_staging_table(v_upload.id));
  update analysis.dataset_uploads
  set status = 'failed', finished_at = now()
  where id = v_upload.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading: what exists, and a look at the first rows of one
-- ---------------------------------------------------------------------------

create or replace function public.data_portal_list_datasets()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, analysis, pg_temp
as $$
begin
  perform analysis.require_active_admin();

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'name', d.name,
        'title', d.title,
        'columns', to_jsonb(d.columns),
        'rowCount', d.row_count,
        'originalFilename', d.original_filename,
        'uploadedAt', d.uploaded_at,
        'uploadedBy', nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
        'versions', (
          select count(*) from analysis.dataset_uploads u
          where u.dataset_name = d.name and u.status = 'ready'
        )
      )
      order by d.uploaded_at desc
    )
    from analysis.uploaded_datasets d
    left join public."Profiles" p on p.id = d.uploaded_by_profile
  ), '[]'::jsonb);
end;
$$;

create or replace function public.data_portal_dataset_preview(p_name text, p_limit integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, analysis, pg_temp
as $$
declare
  v_dataset analysis.uploaded_datasets;
  v_rows jsonb;
begin
  perform analysis.require_active_admin();

  select * into v_dataset from analysis.uploaded_datasets where name = p_name;
  if not found then
    raise exception 'Unknown dataset';
  end if;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_array(%s)), ''[]''::jsonb)
     from (select * from uploads.%I limit %s) as t',
    (select string_agg(format('t.%I', c), ', ' order by ord)
     from unnest(v_dataset.columns) with ordinality as x(c, ord)),
    v_dataset.name,
    least(greatest(coalesce(p_limit, 25), 1), 100)
  ) into v_rows;

  return jsonb_build_object(
    'name', v_dataset.name,
    'columns', to_jsonb(v_dataset.columns),
    'rowCount', v_dataset.row_count,
    'rows', v_rows
  );
end;
$$;

revoke all on function public.data_portal_begin_upload(text, text, text[], text, text) from public, anon;
revoke all on function public.data_portal_append_upload_rows(uuid, jsonb) from public, anon;
revoke all on function public.data_portal_finish_upload(uuid) from public, anon;
revoke all on function public.data_portal_cancel_upload(uuid) from public, anon;
revoke all on function public.data_portal_list_datasets() from public, anon;
revoke all on function public.data_portal_dataset_preview(text, integer) from public, anon;

grant execute on function public.data_portal_begin_upload(text, text, text[], text, text) to authenticated;
grant execute on function public.data_portal_append_upload_rows(uuid, jsonb) to authenticated;
grant execute on function public.data_portal_finish_upload(uuid) to authenticated;
grant execute on function public.data_portal_cancel_upload(uuid) to authenticated;
grant execute on function public.data_portal_list_datasets() to authenticated;
grant execute on function public.data_portal_dataset_preview(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- The bucket for the original files
-- ---------------------------------------------------------------------------
-- Skipped where the storage schema does not exist, which is only the bare
-- Postgres image the access-control tests run on.

do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'storage schema not present; skipping the data-portal-uploads bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('data-portal-uploads', 'data-portal-uploads', false, 26214400, array['text/csv'])
  on conflict (id) do update set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "Data portal uploads: admins read" on storage.objects';
  execute $p$
    create policy "Data portal uploads: admins read"
    on storage.objects for select to authenticated
    using (bucket_id = 'data-portal-uploads' and private.is_admin())
  $p$;

  -- Insert only, into a dataset's own folder. With no update or delete
  -- policy, a file can never be overwritten or removed.
  execute 'drop policy if exists "Data portal uploads: admins add files" on storage.objects';
  execute $p$
    create policy "Data portal uploads: admins add files"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'data-portal-uploads'
      and private.is_admin()
      and name ~ '^datasets/[a-z][a-z0-9_]{0,47}/[A-Za-z0-9_.-]{1,120}\.csv$'
    )
  $p$;
end
$$;

commit;

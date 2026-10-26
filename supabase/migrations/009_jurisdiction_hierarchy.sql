-- Automatic jurisdiction: every report records its administrative area
-- (State > District > Taluka > Local body > Ward > PIN), whether that area is urban or
-- rural, and where the labels came from. Apply after 008. Safe to re-run.
--   area_source = 'verified'  : labels from a verified authority hub
--               = 'directory' : India Post PIN directory / OpenStreetMap, not verified
-- The responsible level of government (Union / State / local body) is derived from the
-- complaint and these fields by the application (lib/jurisdiction.ts).

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'withdraw_issue') then
    raise exception 'Apply 003 to 008 before 009_jurisdiction_hierarchy.sql';
  end if;
end $$;

alter table public.issues add column if not exists sub_district text;
alter table public.issues add column if not exists local_body_type text not null default 'unknown';
alter table public.issues add column if not exists area_source text not null default 'none';
alter table public.issues drop constraint if exists issues_local_body_type_check;
alter table public.issues add constraint issues_local_body_type_check check (local_body_type in ('urban', 'rural', 'unknown'));
alter table public.issues drop constraint if exists issues_area_source_check;
alter table public.issues add constraint issues_area_source_check check (area_source in ('verified', 'directory', 'none'));

-- Reports filed with a verified hub already carry verified labels.
update public.issues set area_source = 'verified'
where area_source = 'none' and (state is not null or district is not null or municipality is not null or ward is not null);

grant select (sub_district, local_body_type, area_source) on public.issues to anon, authenticated;
create index if not exists idx_issues_admin_area on public.issues(state, district, sub_district, municipality);

create or replace function public.civicchai_schema_version()
returns integer language sql immutable security definer set search_path = public
as $$ select 9 $$;
revoke all on function public.civicchai_schema_version() from public, anon, authenticated;
grant execute on function public.civicchai_schema_version() to service_role;

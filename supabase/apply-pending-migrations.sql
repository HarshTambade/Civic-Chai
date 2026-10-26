-- One-paste repair: runs migrations 003 to 008 in order inside one transaction.
-- Every statement is idempotent, so this is safe on a database that already has some of them.
-- Paste the whole file into the Supabase SQL Editor and press Run.

begin;

-- ===== migrations/003_pilot_hardening.sql =====
-- Pilot hardening: safe jurisdiction snapshots and role-specific issue transitions.
alter table public.issues add column if not exists state text;
alter table public.issues add column if not exists district text;
alter table public.issues add column if not exists municipality text;
alter table public.issues add column if not exists ward text;
alter table public.issues add column if not exists has_evidence boolean not null default false;
update public.issues set has_evidence = (coalesce(cardinality(evidence_urls), 0) > 0 or image_url is not null) where not has_evidence;

create index if not exists idx_issues_geographic_scope
  on public.issues(state, district, municipality, ward, pin);

-- Backfill only when one verified hub unambiguously represents a PIN.
with unique_verified_hubs as (
  select pin, min(state) as state, min(district) as district,
         min(municipality) as municipality, min(ward) as ward
  from public.authority_hubs
  where is_verified
  group by pin
  having count(*) = 1
)
update public.issues i
set state = coalesce(i.state, h.state),
    district = coalesce(i.district, h.district),
    municipality = coalesce(i.municipality, h.municipality),
    ward = coalesce(i.ward, h.ward)
from unique_verified_hubs h
where h.pin = i.pin
  and (i.state is null or i.district is null or i.municipality is null or i.ward is null);

-- These broad area labels are safe for the public queue; coordinates and reporter data remain private.
grant select (state, district, municipality, ward, has_evidence) on public.issues to anon, authenticated;
revoke update (status, priority, priority_score, priority_factors, trust, trust_factors,
  department, officer, hub, sla_due_at, duplicate_of, duplicate_decision,
  resolution_evidence_url, community_verified_at, closed_at, days_unresolved,
  chai_heat, supporters, reports, comments) on public.issues from anon, authenticated;
revoke update on public.issues from anon, authenticated;
revoke insert on public.status_events, public.issue_official_notes from anon, authenticated;

create or replace function public.apply_issue_action(
  p_issue_id uuid,
  p_actor_id uuid,
  p_status text,
  p_department text,
  p_officer text,
  p_note text,
  p_resolution_evidence text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_row public.issues%rowtype;
  actor_role text;
  actor_pin text;
  actor_department text;
  actor_jurisdiction uuid;
  next_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Issue actions must be executed by the CivicChai server';
  end if;
  if p_actor_id is null then raise exception 'An authenticated staff account is required'; end if;

  select role, pin, department, jurisdiction_id
    into actor_role, actor_pin, actor_department, actor_jurisdiction
    from public.profiles where id = p_actor_id;
  if actor_role not in ('department_operator', 'department_supervisor', 'authority_admin') then
    raise exception 'This role cannot change issue operations';
  end if;

  select * into issue_row from public.issues where id = p_issue_id for update;
  if not found then raise exception 'Issue not found'; end if;

  if actor_role = 'authority_admin' then
    if not ((actor_jurisdiction is not null and actor_jurisdiction = issue_row.jurisdiction_id) or (actor_pin is not null and actor_pin = issue_row.pin)) then
      raise exception 'Issue is outside the authority administrator jurisdiction';
    end if;
  else
    if actor_department is null or actor_department <> issue_row.department
       or not ((actor_jurisdiction is not null and actor_jurisdiction = issue_row.jurisdiction_id) or (actor_pin is not null and actor_pin = issue_row.pin)) then
      raise exception 'Issue is outside the assigned department and jurisdiction';
    end if;
  end if;

  if actor_role = 'department_operator' and (p_department is not null or p_officer is not null) then
    raise exception 'Department operators cannot assign issues';
  end if;
  if actor_role = 'department_supervisor' and p_department is not null then
    raise exception 'Department supervisors cannot route issues to another department';
  end if;

  next_status := coalesce(p_status, issue_row.status);
  if next_status is distinct from issue_row.status then
    if actor_role = 'department_operator' and next_status not in ('Acknowledged', 'In Progress', 'Resolved', 'Under Review') then
      raise exception 'Status is outside the department operator workflow';
    end if;
    if actor_role = 'department_supervisor' and next_status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then
      raise exception 'Status is outside the department supervisor workflow';
    end if;
    if actor_role = 'authority_admin' and next_status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then
      raise exception 'Status is outside the authority administrator workflow';
    end if;
    if next_status = 'Closed' and issue_row.status <> 'Resolved' then raise exception 'Only resolved issues can be closed'; end if;
    if next_status = 'Resolved' and (
      p_resolution_evidence is null or
      p_resolution_evidence !~* '^https://([a-z0-9-]+\.)*(gov\.in|nic\.in)(/|$)'
    ) then raise exception 'Resolution requires an official HTTPS evidence URL'; end if;
  end if;

  update public.issues set
    status = next_status,
    department = coalesce(p_department, department),
    officer = coalesce(p_officer, officer),
    resolution_evidence_url = coalesce(p_resolution_evidence, resolution_evidence_url),
    updated_at = now()
  where id = p_issue_id;

  if next_status is distinct from issue_row.status then
    insert into public.status_events(issue_id, old_status, new_status, actor_id, note, evidence_url)
    values (p_issue_id, issue_row.status, next_status, p_actor_id, nullif(p_note, ''), p_resolution_evidence);
  end if;
  if nullif(p_note, '') is not null then
    insert into public.issue_official_notes(issue_id, author_id, body) values (p_issue_id, p_actor_id, p_note);
  end if;
  insert into public.audit_logs(issue_id, actor_id, action, details)
  values (p_issue_id, p_actor_id,
    case when next_status is distinct from issue_row.status then 'issue.status_changed' else 'issue.assignment_changed' end,
    jsonb_build_object('from', issue_row.status, 'to', next_status, 'department', p_department, 'officer', p_officer, 'note', p_note));
  return p_issue_id;
end;
$$;
revoke all on function public.apply_issue_action(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_issue_action(uuid, uuid, text, text, text, text, text) to service_role;

create or replace function public.civicchai_schema_version()
returns integer language sql immutable security definer set search_path = public
as $$ select 3 $$;
revoke all on function public.civicchai_schema_version() from public, anon, authenticated;
grant execute on function public.civicchai_schema_version() to service_role;

create or replace function public.enforce_issue_manager_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := public.current_app_role();
begin
  -- Server-only service-role workflows (citizen verification and duplicate review)
  -- use auth.uid() = NULL and have their own explicit route authorization.
  if auth.uid() is null then
    return new;
  end if;

  if actor_role not in ('department_operator', 'department_supervisor', 'authority_admin') then
    raise exception 'This role cannot change issue operations';
  end if;

  if actor_role = 'department_operator'
     and (new.department is distinct from old.department or new.officer is distinct from old.officer) then
    raise exception 'Department operators cannot assign issues';
  end if;

  if actor_role = 'department_supervisor'
     and new.department is distinct from old.department then
    raise exception 'Department supervisors cannot route outside their department';
  end if;

  if new.status is distinct from old.status then
    if actor_role = 'department_operator'
       and new.status not in ('Acknowledged', 'In Progress', 'Resolved', 'Under Review') then
      raise exception 'Status is outside the department operator workflow';
    end if;
    if actor_role = 'department_supervisor'
       and new.status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then
      raise exception 'Status is outside the department supervisor workflow';
    end if;
    if actor_role = 'authority_admin'
       and new.status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then
      raise exception 'Status is outside the authority administrator workflow';
    end if;
    if new.status = 'Closed' and old.status <> 'Resolved' then
      raise exception 'Only resolved issues can be closed';
    end if;
    if new.status = 'Resolved' and (
      new.resolution_evidence_url is null or
      new.resolution_evidence_url !~* '^https://([a-z0-9-]+\.)*(gov\.in|nic\.in)(/|$)'
    ) then
      raise exception 'Resolution requires an official HTTPS evidence URL';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists issues_manager_transition_guard on public.issues;
create trigger issues_manager_transition_guard
before update on public.issues
for each row execute function public.enforce_issue_manager_transition();

-- ===== migrations/004_staff_mfa_rls.sql =====
-- Require Supabase's aal2 claim for staff access even when a client calls the
-- PostgREST API directly instead of going through CivicChai's route handlers.
create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public
as $$
  select case
    when p.role = 'citizen' or coalesce(auth.jwt()->>'aal', '') = 'aal2' then p.role
    else null
  end
  from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.issue_is_in_scope(p_issue_id uuid)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare r text; p_pin text; p_department text; i_pin text; i_department text; i_jurisdiction uuid; p_jurisdiction uuid;
begin
  select role, pin, department, jurisdiction_id
    into r, p_pin, p_department, p_jurisdiction
    from public.profiles where id = auth.uid();
  if not found or (r is distinct from 'citizen' and coalesce(auth.jwt()->>'aal', '') <> 'aal2') then
    return false;
  end if;
  select pin, department, jurisdiction_id
    into i_pin, i_department, i_jurisdiction
    from public.issues where id = p_issue_id;
  if not found then return false; end if;
  if r = 'authority_admin' then
    return (p_jurisdiction is not null and p_jurisdiction = i_jurisdiction)
      or (p_pin is not null and p_pin = i_pin);
  end if;
  if r in ('department_operator', 'department_supervisor') then
    return p_department is not null and p_department = i_department
      and ((p_jurisdiction is not null and p_jurisdiction = i_jurisdiction)
        or (p_pin is not null and p_pin = i_pin));
  end if;
  return false;
end
$$;

drop policy if exists "jurisdiction public verified" on public.jurisdictions;
create policy "jurisdiction public verified" on public.jurisdictions
  for select using (is_verified or public.can_manage_registry(pin));

create or replace function public.civicchai_schema_version()
returns integer language sql immutable security definer set search_path = public
as $$ select 4 $$;
revoke all on function public.civicchai_schema_version() from public, anon, authenticated;
grant execute on function public.civicchai_schema_version() to service_role;

-- ===== migrations/005_pilot_workflow.sql =====
-- Pilot workflow fixes: a fallback route for general civic issues, resolution
-- records that do not depend on a government web page existing, and closure
-- timestamps. Apply after 004_staff_mfa_rls.sql. Safe to apply more than once.

-- Stop early when earlier migrations are missing; otherwise the version marker
-- below would report a schema the database does not actually have.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'issues' and column_name = 'has_evidence') then
    raise exception 'Apply 003_pilot_hardening.sql and 004_staff_mfa_rls.sql before 005_pilot_workflow.sql';
  end if;
end $$;

-- General civic issues are routed here by the classifier; the department must
-- exist for staff routing and SLA lookups to work.
insert into public.departments(slug,name) values ('municipal-operations','Municipal Operations')
on conflict (slug) do nothing;

create index if not exists idx_issue_reports_reporter on public.issue_reports(issue_id, reporter_id);

-- Field teams rarely have an official web page for each repair. A resolution now
-- needs either an official HTTPS .gov.in/.nic.in record or a public resolution
-- note describing the action taken. A supplied URL must still be official.
create or replace function public.apply_issue_action(
  p_issue_id uuid,
  p_actor_id uuid,
  p_status text,
  p_department text,
  p_officer text,
  p_note text,
  p_resolution_evidence text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_row public.issues%rowtype;
  actor_role text;
  actor_pin text;
  actor_department text;
  actor_jurisdiction uuid;
  next_status text;
  official_url constant text := '^https://([a-z0-9-]+\.)*(gov\.in|nic\.in)(/|$)';
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Issue actions must be executed by the CivicChai server';
  end if;
  if p_actor_id is null then raise exception 'An authenticated staff account is required'; end if;

  select role, pin, department, jurisdiction_id
    into actor_role, actor_pin, actor_department, actor_jurisdiction
    from public.profiles where id = p_actor_id;
  if actor_role not in ('department_operator', 'department_supervisor', 'authority_admin') then
    raise exception 'This role cannot change issue operations';
  end if;

  select * into issue_row from public.issues where id = p_issue_id for update;
  if not found then raise exception 'Issue not found'; end if;

  if actor_role = 'authority_admin' then
    if not ((actor_jurisdiction is not null and actor_jurisdiction = issue_row.jurisdiction_id) or (actor_pin is not null and actor_pin = issue_row.pin)) then
      raise exception 'Issue is outside the authority administrator jurisdiction';
    end if;
  else
    if actor_department is null or actor_department <> issue_row.department
       or not ((actor_jurisdiction is not null and actor_jurisdiction = issue_row.jurisdiction_id) or (actor_pin is not null and actor_pin = issue_row.pin)) then
      raise exception 'Issue is outside the assigned department and jurisdiction';
    end if;
  end if;

  if actor_role = 'department_operator' and (p_department is not null or p_officer is not null) then
    raise exception 'Department operators cannot assign issues';
  end if;
  if actor_role = 'department_supervisor' and p_department is not null then
    raise exception 'Department supervisors cannot route issues to another department';
  end if;
  if p_department is not null and not exists (select 1 from public.departments where name = p_department and is_active) then
    raise exception 'Route issues only to a configured department';
  end if;
  if nullif(p_resolution_evidence, '') is not null and p_resolution_evidence !~* official_url then
    raise exception 'Resolution evidence must be an official HTTPS .gov.in or .nic.in record';
  end if;

  next_status := coalesce(p_status, issue_row.status);
  if next_status is distinct from issue_row.status then
    if actor_role = 'department_operator' and next_status not in ('Acknowledged', 'In Progress', 'Resolved', 'Under Review') then
      raise exception 'Status is outside the department operator workflow';
    end if;
    if actor_role = 'department_supervisor' and next_status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then
      raise exception 'Status is outside the department supervisor workflow';
    end if;
    if actor_role = 'authority_admin' and next_status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then
      raise exception 'Status is outside the authority administrator workflow';
    end if;
    if next_status = 'Closed' and issue_row.status not in ('Resolved', 'Community Verified') then
      raise exception 'Only resolved issues can be closed';
    end if;
    if next_status = 'Resolved' and nullif(p_resolution_evidence, '') is null and char_length(coalesce(trim(p_note), '')) < 15 then
      raise exception 'Resolution requires a public note describing the action taken or an official evidence URL';
    end if;
  end if;

  update public.issues set
    status = next_status,
    department = coalesce(p_department, department),
    officer = coalesce(p_officer, officer),
    resolution_evidence_url = coalesce(nullif(p_resolution_evidence, ''), resolution_evidence_url),
    closed_at = case when next_status = 'Closed' then now() else closed_at end,
    updated_at = now()
  where id = p_issue_id;

  if next_status is distinct from issue_row.status then
    insert into public.status_events(issue_id, old_status, new_status, actor_id, note, evidence_url)
    values (p_issue_id, issue_row.status, next_status, p_actor_id, nullif(p_note, ''), nullif(p_resolution_evidence, ''));
  end if;
  if nullif(p_note, '') is not null then
    insert into public.issue_official_notes(issue_id, author_id, body) values (p_issue_id, p_actor_id, p_note);
  end if;
  insert into public.audit_logs(issue_id, actor_id, action, details)
  values (p_issue_id, p_actor_id,
    case when next_status is distinct from issue_row.status then 'issue.status_changed' else 'issue.assignment_changed' end,
    jsonb_build_object('from', issue_row.status, 'to', next_status, 'department', p_department, 'officer', p_officer, 'note', p_note, 'resolution_evidence_url', nullif(p_resolution_evidence, '')));
  return p_issue_id;
end;
$$;
revoke all on function public.apply_issue_action(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_issue_action(uuid, uuid, text, text, text, text, text) to service_role;

create or replace function public.civicchai_schema_version()
returns integer language sql immutable security definer set search_path = public
as $$ select 5 $$;
revoke all on function public.civicchai_schema_version() from public, anon, authenticated;
grant execute on function public.civicchai_schema_version() to service_role;

-- ===== migrations/006_anonymous_handles.sql =====
-- Anonymous public handles: every account gets a stable pseudonym such as
-- "KadakKulhad-3F9A". Public surfaces (comments, community views) show only the
-- handle; real names and emails are never exposed. Apply after 005. Safe to re-run.

do $$
begin
  if not exists (select 1 from public.departments where slug = 'municipal-operations')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'issues' and column_name = 'has_evidence') then
    raise exception 'Apply 003, 004 and 005 before 006_anonymous_handles.sql';
  end if;
end $$;

-- Mirrors anonymousHandle() in lib/anonymity.ts so local preview and database agree.
create or replace function public.civicchai_handle(p_id uuid)
returns text language sql immutable set search_path = public
as $$
  with h as (select replace(p_id::text, '-', '') as hex)
  select (array['Kadak','Masala','Adrak','Elaichi','Tulsi','Cutting','Kesar','Pudina'])[(('x' || substr(hex, 1, 2))::bit(8)::int % 8) + 1]
      || (array['Chai','Kulhad','Tapri','Biscuit','Samosa','Rusk','Kettle','Patti'])[(('x' || substr(hex, 3, 2))::bit(8)::int % 8) + 1]
      || '-' || upper(substr(hex, 5, 4))
  from h
$$;

alter table public.profiles add column if not exists public_handle text;
update public.profiles set public_handle = public.civicchai_handle(id) where public_handle is null;

create or replace function public.assign_public_handle()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- The handle is derived from the account id and cannot be chosen or changed by the user.
  new.public_handle := public.civicchai_handle(new.id);
  return new;
end
$$;
drop trigger if exists trg_profiles_public_handle on public.profiles;
create trigger trg_profiles_public_handle before insert or update on public.profiles for each row execute function public.assign_public_handle();

-- New accounts no longer default their private display name to the email prefix.
create or replace function public.provision_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name, preferred_language, role)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), public.civicchai_handle(new.id)), coalesce(new.raw_user_meta_data->>'preferred_language','en'), 'citizen')
  on conflict (id) do nothing;
  return new;
end
$$;

-- Comments carry the author's handle so public reads never need the profile table.
alter table public.issue_comments add column if not exists author_handle text;
update public.issue_comments c set author_handle = public.civicchai_handle(c.author_id) where c.author_handle is null and c.author_id is not null;

create or replace function public.assign_comment_handle()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.author_handle := case when new.author_id is null then 'Community member' else public.civicchai_handle(new.author_id) end;
  return new;
end
$$;
drop trigger if exists trg_issue_comments_handle on public.issue_comments;
create trigger trg_issue_comments_handle before insert on public.issue_comments for each row execute function public.assign_comment_handle();

grant select (public_handle) on public.profiles to authenticated;
grant select (author_handle) on public.issue_comments to anon, authenticated;

create or replace function public.civicchai_schema_version()
returns integer language sql immutable security definer set search_path = public
as $$ select 6 $$;
revoke all on function public.civicchai_schema_version() from public, anon, authenticated;
grant execute on function public.civicchai_schema_version() to service_role;

-- ===== migrations/007_service_area_pins.sql =====
-- Multi-PIN service areas: an authority (and its department staff) usually covers
-- several PIN codes, not one. Staff can now be given extra `service_pins` in addition
-- to their primary `pin`. Apply after 006. Safe to re-run.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'public_handle') then
    raise exception 'Apply 003, 004, 005 and 006 before 007_service_area_pins.sql';
  end if;
end $$;

alter table public.profiles add column if not exists service_pins text[] not null default '{}'::text[];
alter table public.profiles drop constraint if exists profiles_service_pins_check;
alter table public.profiles add constraint profiles_service_pins_check
  check (array_to_string(service_pins, ',') ~ '^([0-9]{6}(,[0-9]{6})*)?$');

-- Coverage is part of RBAC: only the provisioning process (service role) may change it.
create or replace function public.protect_profile_rbac()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and auth.uid() is not null and (
    new.role is distinct from old.role or new.department is distinct from old.department
    or new.jurisdiction_id is distinct from old.jurisdiction_id or new.pin is distinct from old.pin
    or new.service_pins is distinct from old.service_pins or new.is_demo is distinct from old.is_demo
  ) then
    raise exception 'Role and jurisdiction fields can only be changed by a privileged provisioning process';
  end if;
  new.updated_at = now();
  return new;
end
$$;

create or replace function public.issue_is_in_scope(p_issue_id uuid)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare r text; p_pin text; p_pins text[]; p_department text; i_pin text; i_department text; i_jurisdiction uuid; p_jurisdiction uuid; covers boolean;
begin
  select role, pin, service_pins, department, jurisdiction_id
    into r, p_pin, p_pins, p_department, p_jurisdiction
    from public.profiles where id = auth.uid();
  if not found or (r is distinct from 'citizen' and coalesce(auth.jwt()->>'aal', '') <> 'aal2') then
    return false;
  end if;
  select pin, department, jurisdiction_id
    into i_pin, i_department, i_jurisdiction
    from public.issues where id = p_issue_id;
  if not found then return false; end if;
  covers := (p_jurisdiction is not null and p_jurisdiction = i_jurisdiction)
    or (p_pin is not null and p_pin = i_pin)
    or i_pin = any(coalesce(p_pins, '{}'::text[]));
  if r = 'authority_admin' then return covers; end if;
  if r in ('department_operator', 'department_supervisor') then
    return p_department is not null and p_department = i_department and covers;
  end if;
  return false;
end
$$;

create or replace function public.can_manage_registry(p_pin text)
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_app_role() = 'authority_admin' and exists (
  select 1 from public.profiles p where p.id = auth.uid() and (
    p.pin = p_pin or p_pin = any(p.service_pins)
    or (p.jurisdiction_id is not null and exists (select 1 from public.jurisdictions j where j.id = p.jurisdiction_id and j.pin = p_pin))
  )
) $$;

-- Same as 005, with coverage extended to the actor's service PINs.
create or replace function public.apply_issue_action(
  p_issue_id uuid,
  p_actor_id uuid,
  p_status text,
  p_department text,
  p_officer text,
  p_note text,
  p_resolution_evidence text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_row public.issues%rowtype;
  actor_role text;
  actor_pin text;
  actor_pins text[];
  actor_department text;
  actor_jurisdiction uuid;
  actor_covers boolean;
  next_status text;
  official_url constant text := '^https://([a-z0-9-]+\.)*(gov\.in|nic\.in)(/|$)';
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Issue actions must be executed by the CivicChai server';
  end if;
  if p_actor_id is null then raise exception 'An authenticated staff account is required'; end if;

  select role, pin, service_pins, department, jurisdiction_id
    into actor_role, actor_pin, actor_pins, actor_department, actor_jurisdiction
    from public.profiles where id = p_actor_id;
  if actor_role not in ('department_operator', 'department_supervisor', 'authority_admin') then
    raise exception 'This role cannot change issue operations';
  end if;

  select * into issue_row from public.issues where id = p_issue_id for update;
  if not found then raise exception 'Issue not found'; end if;

  actor_covers := (actor_jurisdiction is not null and actor_jurisdiction = issue_row.jurisdiction_id)
    or (actor_pin is not null and actor_pin = issue_row.pin)
    or issue_row.pin = any(coalesce(actor_pins, '{}'::text[]));
  if actor_role = 'authority_admin' then
    if not actor_covers then raise exception 'Issue is outside the authority administrator jurisdiction'; end if;
  else
    if actor_department is null or actor_department <> issue_row.department or not actor_covers then
      raise exception 'Issue is outside the assigned department and jurisdiction';
    end if;
  end if;

  if actor_role = 'department_operator' and (p_department is not null or p_officer is not null) then
    raise exception 'Department operators cannot assign issues';
  end if;
  if actor_role = 'department_supervisor' and p_department is not null then
    raise exception 'Department supervisors cannot route issues to another department';
  end if;
  if p_department is not null and not exists (select 1 from public.departments where name = p_department and is_active) then
    raise exception 'Route issues only to a configured department';
  end if;
  if nullif(p_resolution_evidence, '') is not null and p_resolution_evidence !~* official_url then
    raise exception 'Resolution evidence must be an official HTTPS .gov.in or .nic.in record';
  end if;

  next_status := coalesce(p_status, issue_row.status);
  if next_status is distinct from issue_row.status then
    if actor_role = 'department_operator' and next_status not in ('Acknowledged', 'In Progress', 'Resolved', 'Under Review') then
      raise exception 'Status is outside the department operator workflow';
    end if;
    if actor_role = 'department_supervisor' and next_status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then
      raise exception 'Status is outside the department supervisor workflow';
    end if;
    if actor_role = 'authority_admin' and next_status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then
      raise exception 'Status is outside the authority administrator workflow';
    end if;
    if next_status = 'Closed' and issue_row.status not in ('Resolved', 'Community Verified') then
      raise exception 'Only resolved issues can be closed';
    end if;
    if next_status = 'Resolved' and nullif(p_resolution_evidence, '') is null and char_length(coalesce(trim(p_note), '')) < 15 then
      raise exception 'Resolution requires a public note describing the action taken or an official evidence URL';
    end if;
  end if;

  update public.issues set
    status = next_status,
    department = coalesce(p_department, department),
    officer = coalesce(p_officer, officer),
    resolution_evidence_url = coalesce(nullif(p_resolution_evidence, ''), resolution_evidence_url),
    closed_at = case when next_status = 'Closed' then now() else closed_at end,
    updated_at = now()
  where id = p_issue_id;

  if next_status is distinct from issue_row.status then
    insert into public.status_events(issue_id, old_status, new_status, actor_id, note, evidence_url)
    values (p_issue_id, issue_row.status, next_status, p_actor_id, nullif(p_note, ''), nullif(p_resolution_evidence, ''));
  end if;
  if nullif(p_note, '') is not null then
    insert into public.issue_official_notes(issue_id, author_id, body) values (p_issue_id, p_actor_id, p_note);
  end if;
  insert into public.audit_logs(issue_id, actor_id, action, details)
  values (p_issue_id, p_actor_id,
    case when next_status is distinct from issue_row.status then 'issue.status_changed' else 'issue.assignment_changed' end,
    jsonb_build_object('from', issue_row.status, 'to', next_status, 'department', p_department, 'officer', p_officer, 'note', p_note, 'resolution_evidence_url', nullif(p_resolution_evidence, '')));
  return p_issue_id;
end;
$$;
revoke all on function public.apply_issue_action(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_issue_action(uuid, uuid, text, text, text, text, text) to service_role;

grant select (service_pins) on public.profiles to authenticated;

-- The seeded demo staff cover the whole demo area so reports from any demo PIN reach a team.
update public.profiles
set service_pins = array['401208', '401209', '401210', '401211']
where is_demo and role in ('department_operator', 'department_supervisor', 'authority_admin', 'auditor');

create or replace function public.civicchai_schema_version()
returns integer language sql immutable security definer set search_path = public
as $$ select 7 $$;
revoke all on function public.civicchai_schema_version() from public, anon, authenticated;
grant execute on function public.civicchai_schema_version() to service_role;


-- ===== 008_reporter_withdrawal.sql =====
-- Reporters can take back their own complaint. Apply after 007. Safe to re-run.
--   * Nobody has acted on it yet (Filed / AI Classified, no other reporter, supporter or
--     comment): it is deleted permanently.
--   * Otherwise (already routed or worked on): it becomes "Withdrawn", is removed from
--     public view and staff queues, and keeps its status history for the audit trail.
-- A complaint that other neighbours joined cannot be withdrawn by one of them.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'service_pins') then
    raise exception 'Apply 003 to 007 before 008_reporter_withdrawal.sql';
  end if;
end $$;

alter table public.issues drop constraint if exists issues_status_check;
alter table public.issues add constraint issues_status_check check (status in (
  'Filed','AI Classified','Assigned','Acknowledged','In Progress','Resolved','Community Verified','Closed','Duplicate','Under Review','Withdrawn'
));

-- The reporter keeps seeing a withdrawn complaint in My Charcha; the public does not.
drop policy if exists "public or scoped issue read" on public.issues;
create policy "public or scoped issue read" on public.issues for select
  using (is_public or created_by = auth.uid() or public.can_manage_issue(id));

create or replace function public.withdraw_issue(p_issue_id uuid, p_actor_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_row public.issues%rowtype;
  reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
  others integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Withdrawals must be executed by the CivicChai server';
  end if;
  select * into issue_row from public.issues where id = p_issue_id for update;
  if not found then raise exception 'Issue not found'; end if;
  if p_actor_id is null or issue_row.created_by is distinct from p_actor_id then
    raise exception 'Only the person who filed this complaint can withdraw it';
  end if;
  if issue_row.status in ('Resolved', 'Community Verified', 'Closed', 'Duplicate', 'Withdrawn') then
    raise exception 'This complaint is already %, so it can no longer be withdrawn', lower(issue_row.status);
  end if;
  select count(*) into others from public.issue_reports where issue_id = p_issue_id and reporter_id is distinct from p_actor_id;
  if others > 0 or coalesce(issue_row.reports, 1) > 1 then
    raise exception 'Other neighbours have joined this complaint, so it stays open for them';
  end if;

  if issue_row.status in ('Filed', 'AI Classified')
     and coalesce(issue_row.supporters, 0) = 0 and coalesce(issue_row.comments, 0) = 0
     and not exists (select 1 from public.issue_official_notes where issue_id = p_issue_id) then
    delete from public.issues where id = p_issue_id;
    insert into public.audit_logs(issue_id, actor_id, action, details)
    values (null, p_actor_id, 'issue.deleted_by_reporter',
      jsonb_build_object('issue_id', p_issue_id, 'document_id', issue_row.document_id, 'pin', issue_row.pin, 'department', issue_row.department, 'status', issue_row.status, 'reason', reason));
    return 'deleted';
  end if;

  update public.issues set status = 'Withdrawn', is_public = false, updated_at = now() where id = p_issue_id;
  insert into public.status_events(issue_id, old_status, new_status, actor_id, note)
  values (p_issue_id, issue_row.status, 'Withdrawn', p_actor_id, coalesce('Withdrawn by the reporter: ' || reason, 'Withdrawn by the reporter.'));
  insert into public.audit_logs(issue_id, actor_id, action, details)
  values (p_issue_id, p_actor_id, 'issue.withdrawn_by_reporter', jsonb_build_object('from', issue_row.status, 'reason', reason));
  return 'withdrawn';
end;
$$;
revoke all on function public.withdraw_issue(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.withdraw_issue(uuid, uuid, text) to service_role;

create or replace function public.civicchai_schema_version()
returns integer language sql immutable security definer set search_path = public
as $$ select 8 $$;
revoke all on function public.civicchai_schema_version() from public, anon, authenticated;
grant execute on function public.civicchai_schema_version() to service_role;

commit;

-- Expect 8, true and true:
select public.civicchai_schema_version() as schema_version,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'service_pins') as service_pins_ok,
       exists (select 1 from pg_proc where proname = 'withdraw_issue') as withdrawal_ok;

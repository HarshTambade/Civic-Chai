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

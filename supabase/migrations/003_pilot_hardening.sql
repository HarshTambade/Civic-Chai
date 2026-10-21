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

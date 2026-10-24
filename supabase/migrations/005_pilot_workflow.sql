-- Pilot workflow fixes: a fallback route for general civic issues, resolution
-- records that do not depend on a government web page existing, and closure
-- timestamps. Apply after 004_staff_mfa_rls.sql. Safe to apply more than once.

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

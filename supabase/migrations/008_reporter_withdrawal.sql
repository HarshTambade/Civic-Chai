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

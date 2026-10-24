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

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

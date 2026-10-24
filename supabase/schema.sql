-- Combined fresh-install schema: equivalent to applying migrations in order.

-- Initial migration for CivicChai application data.
-- This file mirrors the schema in supabase/schema.sql and is intended for migration-based workflows.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  city text,
  ward text,
  pin text,
  preferred_language text default 'en',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  document_id text not null unique,
  title text not null,
  description text not null,
  category text not null,
  department text not null,
  pin text not null,
  locality text not null,
  status text not null check (
    status in (
      'Filed',
      'AI Classified',
      'Assigned',
      'Acknowledged',
      'In Progress',
      'Resolved',
      'Community Verified'
    )
  ),
  priority text not null check (priority in ('Critical', 'High', 'Moderate', 'Low')),
  trust integer not null default 0 check (trust between 0 and 100),
  chai_heat integer not null default 0 check (chai_heat between 0 and 100),
  supporters integer not null default 0,
  reports integer not null default 0,
  comments integer not null default 0,
  days_unresolved integer not null default 0,
  officer text,
  hub text,
  image_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.issue_comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.issue_supports (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (issue_id, user_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_issues_status_priority on public.issues(status, priority);
create index if not exists idx_issues_pin_locality on public.issues(pin, locality);
create index if not exists idx_issues_created_at on public.issues(created_at desc);
create index if not exists idx_issue_comments_issue_id on public.issue_comments(issue_id, created_at desc);
create index if not exists idx_issue_supports_issue_id on public.issue_supports(issue_id);
create index if not exists idx_audit_logs_issue_id on public.audit_logs(issue_id, created_at desc);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();

create trigger trg_issues_updated_at
before update on public.issues
for each row execute function public.handle_updated_at();

create or replace function public.update_issue_counts()
returns trigger as $$
begin
  if tg_table_name = 'issue_comments' then
    update public.issues
    set comments = (
      select count(*) from public.issue_comments where issue_id = new.issue_id
    )
    where id = new.issue_id;
  end if;

  if tg_table_name = 'issue_supports' then
    update public.issues
    set supporters = (
      select count(*) from public.issue_supports where issue_id = new.issue_id
    )
    where id = new.issue_id;
  end if;

  return null;
end;
$$ language plpgsql;

create trigger trg_issue_comments_count
after insert or delete on public.issue_comments
for each row execute function public.update_issue_counts();

create trigger trg_issue_supports_count
after insert or delete on public.issue_supports
for each row execute function public.update_issue_counts();
-- CivicChai platform model: roles, scoped administration, reports, routing,
-- evidence, status history, registry, moderation and auditable scoring.
-- Apply after 001_init.sql. Safe to apply more than once.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.jurisdictions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.jurisdictions(id) on delete set null,
  level text not null check (level in ('state','district','municipality','ward','pin','locality')),
  name text not null,
  pin text,
  authority_name text,
  source_url text,
  source_version text not null default '1',
  is_verified boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (level, name, pin)
);

alter table public.profiles add column if not exists role text not null default 'citizen';
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists locality text;
alter table public.profiles add column if not exists preferred_pin text check (preferred_pin is null or preferred_pin ~ '^[0-9]{6}$');
alter table public.profiles add column if not exists jurisdiction_id uuid references public.jurisdictions(id) on delete set null;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists consent_preferences jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists notification_preferences jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists privacy_notice_version text;
alter table public.profiles add column if not exists privacy_notice_at timestamptz;
alter table public.profiles add column if not exists is_demo boolean not null default false;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('citizen','moderator','department_operator','department_supervisor','authority_admin','system_admin','auditor'));

alter table public.departments add column if not exists jurisdiction_id uuid references public.jurisdictions(id) on delete set null;
alter table public.departments add column if not exists source_url text;
alter table public.departments add column if not exists is_active boolean not null default true;
alter table public.categories add column if not exists department_id uuid references public.departments(id) on delete set null;
alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete set null;
alter table public.categories add column if not exists is_active boolean not null default true;

create table if not exists public.officer_registry (
  id uuid primary key default gen_random_uuid(), name text not null, role text not null, department text not null,
  pin text not null, hub text not null, contact text, created_at timestamptz not null default now()
);
create table if not exists public.official_documents (
  id uuid primary key default gen_random_uuid(), title text not null, authority text not null, document_number text,
  source_url text, published_at timestamptz not null default now(), version text default '1.0', checksum text,
  created_at timestamptz not null default now()
);
create table if not exists public.issue_evidence (
  id uuid primary key default gen_random_uuid(), issue_id uuid not null references public.issues(id) on delete cascade,
  image_url text, caption text, uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.authority_hubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  pin text not null check (pin ~ '^[0-9]{6}$'),
  ward text,
  municipality text,
  district text,
  state text,
  public_phone text,
  public_email text,
  source_url text,
  source_version text not null default '1',
  is_verified boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  jurisdiction_id uuid references public.jurisdictions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.officer_registry add column if not exists public_phone text;
alter table public.officer_registry add column if not exists public_email text;
alter table public.officer_registry add column if not exists source_url text;
alter table public.officer_registry add column if not exists source_version text not null default '1';
alter table public.officer_registry add column if not exists is_verified boolean not null default false;
alter table public.officer_registry add column if not exists verified_at timestamptz;
alter table public.officer_registry add column if not exists verified_by uuid references auth.users(id) on delete set null;
alter table public.officer_registry add column if not exists jurisdiction_id uuid references public.jurisdictions(id) on delete set null;
-- Existing starter contacts are not verified authority contacts.
update public.officer_registry set contact = null, public_phone = null, public_email = null, source_url = null, is_verified = false, verified_at = null, verified_by = null;

alter table public.official_documents add column if not exists effective_at timestamptz;
alter table public.official_documents add column if not exists source_version text not null default '1';
alter table public.official_documents add column if not exists issuing_authority text;
alter table public.official_documents add column if not exists is_verified boolean not null default false;
alter table public.official_documents add column if not exists verified_at timestamptz;
alter table public.official_documents add column if not exists verified_by uuid references auth.users(id) on delete set null;
alter table public.official_documents add column if not exists jurisdiction_id uuid references public.jurisdictions(id) on delete set null;
update public.official_documents set is_verified = false, verified_at = null, verified_by = null,
  source_url = case when source_url like 'https://example.gov.in/%' then null else source_url end;

alter table public.issues add column if not exists original_text text;
alter table public.issues add column if not exists normalized_text text;
alter table public.issues add column if not exists source_channel text not null default 'web' check (source_channel in ('web','pwa','voice','keypad','assisted'));
alter table public.issues add column if not exists language text not null default 'Unknown';
alter table public.issues add column if not exists ai_confidence integer not null default 0 check (ai_confidence between 0 and 100);
alter table public.issues add column if not exists model_version text not null default 'civicchai-rules-v1';
alter table public.issues add column if not exists priority_score integer not null default 0 check (priority_score between 0 and 100);
alter table public.issues add column if not exists priority_factors jsonb not null default '{}'::jsonb;
alter table public.issues add column if not exists trust_factors jsonb not null default '{}'::jsonb;
alter table public.issues add column if not exists sla_due_at timestamptz;
alter table public.issues add column if not exists jurisdiction_id uuid references public.jurisdictions(id) on delete set null;
alter table public.issues add column if not exists is_public boolean not null default true;
alter table public.issues add column if not exists is_demo boolean not null default false;
alter table public.issues add column if not exists community_verified_at timestamptz;
alter table public.issues add column if not exists closed_at timestamptz;
alter table public.issues add column if not exists duplicate_of uuid references public.issues(id) on delete set null;
alter table public.issues add column if not exists duplicate_decision text check (duplicate_decision is null or duplicate_decision in ('suggested','joined','distinct','merged','unmerged'));
alter table public.issues add column if not exists resolution_evidence_url text;
alter table public.issues add column if not exists evidence_urls text[] not null default '{}'::text[];
alter table public.issues add column if not exists priority_severity integer not null default 40 check (priority_severity between 0 and 100);
alter table public.issues add column if not exists location_precision text not null default 'locality' check (location_precision in ('locality','approximate','exact'));
alter table public.issues add column if not exists location_lat numeric(9,6);
alter table public.issues add column if not exists location_lng numeric(9,6);
alter table public.issues drop constraint if exists issues_status_check;
alter table public.issues add constraint issues_status_check check (status in ('Filed','AI Classified','Assigned','Acknowledged','In Progress','Resolved','Community Verified','Closed','Duplicate','Under Review'));
update public.issues set original_text = coalesce(original_text, description), normalized_text = coalesce(normalized_text, description),
  location_precision = case when location_lat is null or location_lng is null then 'locality' else 'exact' end;
update public.issues set
  description = regexp_replace(regexp_replace(regexp_replace(coalesce(description,''), '\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b', '[email hidden]', 'gi'), '(?:\\+?91[[:space:]-]?)?[6-9][0-9]{4}[[:space:]-]?[0-9]{5}', '[phone hidden]', 'g'), '\\b[0-9]{12}\\b', '[identity number hidden]', 'g'),
  normalized_text = regexp_replace(regexp_replace(coalesce(normalized_text,''), '\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b', '[email hidden]', 'gi'), '(?:\\+?91[[:space:]-]?)?[6-9][0-9]{4}[[:space:]-]?[0-9]{5}', '[phone hidden]', 'g'),
  officer = 'Assignment pending', hub = 'No verified authority hub';
update public.issue_comments set body = regexp_replace(regexp_replace(coalesce(body,''), '\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b', '[email hidden]', 'gi'), '(?:\\+?91[[:space:]-]?)?[6-9][0-9]{4}[[:space:]-]?[0-9]{5}', '[phone hidden]', 'g');

create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  source_channel text not null default 'web' check (source_channel in ('web','pwa','voice','keypad','assisted')),
  original_text text not null,
  language text not null default 'Unknown',
  evidence_count integer not null default 0,
  location_lat numeric(9,6),
  location_lng numeric(9,6),
  priority_severity integer not null default 40 check (priority_severity between 0 and 100),
  trust_score integer not null default 0 check (trust_score between 0 and 100),
  trust_factors jsonb not null default '{}'::jsonb,
  model_version text not null default 'civicchai-rules-v1',
  consent jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.issue_follows (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (issue_id, user_id)
);

alter table public.issue_evidence alter column image_url drop not null;
alter table public.issue_evidence add column if not exists storage_path text;
alter table public.issue_evidence add column if not exists media_type text;
alter table public.issue_evidence add column if not exists file_size_bytes bigint;
alter table public.issue_evidence add column if not exists visibility text not null default 'private' check (visibility in ('private','authority','public'));
alter table public.issue_evidence add column if not exists verified_at timestamptz;
alter table public.issue_comments add column if not exists status text not null default 'visible' check (status in ('visible','hidden','under_review','removed'));
alter table public.issue_comments add column if not exists updated_at timestamptz not null default now();
alter table public.issue_comments add column if not exists edited_at timestamptz;

create table if not exists public.issue_official_notes (
  id uuid primary key default gen_random_uuid(), issue_id uuid not null references public.issues(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null, body text not null check (char_length(body) between 1 and 2000),
  visibility text not null default 'public' check (visibility in ('public','authority')), evidence_url text, created_at timestamptz not null default now()
);
create table if not exists public.status_events (
  id uuid primary key default gen_random_uuid(), issue_id uuid not null references public.issues(id) on delete cascade,
  old_status text, new_status text not null, actor_id uuid references public.profiles(id) on delete set null,
  note text, evidence_url text, created_at timestamptz not null default now()
);
create table if not exists public.duplicate_links (
  id uuid primary key default gen_random_uuid(), issue_a uuid not null references public.issues(id) on delete cascade,
  issue_b uuid not null references public.issues(id) on delete cascade, similarity numeric(4,3) not null check (similarity between 0 and 1),
  model_version text not null default 'civicchai-jaccard-v1', decision text not null default 'suggested' check (decision in ('suggested','joined','distinct','merged','unmerged')),
  decided_by uuid references public.profiles(id) on delete set null, decided_at timestamptz, previous_status text, created_at timestamptz not null default now(),
  check (issue_a <> issue_b), unique (issue_a, issue_b)
);
alter table public.duplicate_links add column if not exists previous_status text;
create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid references public.profiles(id) on delete set null,
  issue_id uuid references public.issues(id) on delete cascade, comment_id uuid references public.issue_comments(id) on delete cascade,
  reason text not null check (reason in ('abuse','personal_data','spam','misinformation','other')), details text,
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed','appealed')),
  reviewed_by uuid references public.profiles(id) on delete set null, moderator_note text,
  created_at timestamptz not null default now(), reviewed_at timestamptz,
  check (issue_id is not null or comment_id is not null)
);
alter table public.moderation_reports add column if not exists appeal_details text;
alter table public.moderation_reports add column if not exists appealed_at timestamptz;
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  issue_id uuid references public.issues(id) on delete cascade, kind text not null, title text not null, body text not null,
  read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.data_rights_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('access','correction','erasure','grievance')),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'received' check (status in ('received','in_review','fulfilled','declined')),
  response_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.sla_targets (
  id uuid primary key default gen_random_uuid(), jurisdiction_id uuid references public.jurisdictions(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade, category_id uuid references public.categories(id) on delete cascade,
  target_hours integer not null check (target_hours between 1 and 87600), source_url text not null, source_version text not null,
  is_verified boolean not null default false, effective_at timestamptz, expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.voice_sessions (
  call_sid text primary key, stage text not null default 'language', language text not null default 'English',
  complaint_text text, pin text, locality text, duration text, has_evidence boolean, consented_at timestamptz,
  issue_id uuid references public.issues(id) on delete set null, expires_at timestamptz not null default now() + interval '1 hour',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.api_rate_limits (
  key_hash text primary key, window_started_at timestamptz not null,
  hit_count integer not null default 0, expires_at timestamptz not null
);

create index if not exists idx_issues_queue on public.issues(status, priority_score desc, created_at desc);
create index if not exists idx_issues_scope on public.issues(pin, department, category, status);
create index if not exists idx_issues_sla on public.issues(sla_due_at) where sla_due_at is not null;
create index if not exists idx_issues_location on public.issues(location_lat, location_lng) where location_lat is not null;
create index if not exists idx_issues_search on public.issues using gin ((coalesce(title,'') || ' ' || coalesce(original_text, description)) gin_trgm_ops);
create index if not exists idx_issue_reports_issue on public.issue_reports(issue_id, created_at desc);
create index if not exists idx_issue_follows_user on public.issue_follows(user_id, created_at desc);
create index if not exists idx_issue_status_history on public.status_events(issue_id, created_at desc);
create index if not exists idx_duplicate_links_issue_a on public.duplicate_links(issue_a, created_at desc);
create index if not exists idx_audit_actor_time on public.audit_logs(actor_id, created_at desc);
create index if not exists idx_notifications_user_time on public.notifications(user_id, created_at desc);

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
  select role, pin, department, jurisdiction_id into r, p_pin, p_department, p_jurisdiction from public.profiles where id = auth.uid();
  if r is distinct from 'citizen' and coalesce(auth.jwt()->>'aal', '') <> 'aal2' then return false; end if;
  select pin, department, jurisdiction_id into i_pin, i_department, i_jurisdiction from public.issues where id = p_issue_id;
  if not found then return false; end if;
  if r = 'authority_admin' then return (p_jurisdiction is not null and p_jurisdiction = i_jurisdiction) or (p_pin is not null and p_pin = i_pin); end if;
  if r in ('department_operator','department_supervisor') then
    return p_department is not null and p_department = i_department and ((p_jurisdiction is not null and p_jurisdiction = i_jurisdiction) or (p_pin is not null and p_pin = i_pin));
  end if;
  return false;
end
$$;
create or replace function public.can_manage_issue(p_issue_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_app_role() in ('department_operator','department_supervisor','authority_admin') and public.issue_is_in_scope(p_issue_id) $$;
create or replace function public.can_manage_registry(p_pin text)
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_app_role() = 'authority_admin' and exists (select 1 from public.profiles p where p.id = auth.uid() and (p.pin = p_pin or (p.jurisdiction_id is not null and exists(select 1 from public.jurisdictions j where j.id = p.jurisdiction_id and j.pin = p_pin)))) $$;

create or replace function public.protect_profile_rbac()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and auth.uid() is not null and (new.role is distinct from old.role or new.department is distinct from old.department or new.jurisdiction_id is distinct from old.jurisdiction_id or new.pin is distinct from old.pin or new.is_demo is distinct from old.is_demo) then
    raise exception 'Role and jurisdiction fields can only be changed by a privileged provisioning process';
  end if;
  new.updated_at = now();
  return new;
end
$$;
drop trigger if exists trg_profiles_protect_rbac on public.profiles;
create trigger trg_profiles_protect_rbac before update on public.profiles for each row execute function public.protect_profile_rbac();

create or replace function public.provision_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name, preferred_language, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), coalesce(new.raw_user_meta_data->>'preferred_language','en'), 'citizen')
  on conflict (id) do nothing;
  return new;
end
$$;
drop trigger if exists trg_auth_user_profile on auth.users;
create trigger trg_auth_user_profile after insert on auth.users for each row execute function public.provision_profile_for_auth_user();

create or replace function public.refresh_issue_signals(p_issue_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_support integer; v_reports integer; v_comments integer; v_days integer; v_heat integer; v_severity numeric; v_geo numeric; v_evidence numeric; v_sla numeric; v_support_score numeric; v_corroboration numeric; v_persistence numeric; v_priority integer;
begin
  select count(*) into v_support from public.issue_supports where issue_id = p_issue_id;
  select greatest(1, count(*)) into v_reports from public.issue_reports where issue_id = p_issue_id;
  select count(*) into v_comments from public.issue_comments where issue_id = p_issue_id and status = 'visible';
  select greatest(0, floor(extract(epoch from (now() - created_at)) / 86400))::integer into v_days from public.issues where id = p_issue_id;
  v_heat := least(100, round(12 * ln(v_support + 1) + 16 * ln(v_reports + 1))::integer);
  select coalesce((priority_factors->>'severity')::numeric, priority_severity, 40), coalesce((priority_factors->>'geographic_impact')::numeric,20), coalesce((priority_factors->>'evidence')::numeric,20), case when sla_due_at is not null and sla_due_at < now() then 100 else coalesce((priority_factors->>'sla')::numeric,10) end into v_severity,v_geo,v_evidence,v_sla from public.issues where id = p_issue_id;
  v_support_score := least(100, round(ln(v_support + 1) * 22));
  v_corroboration := least(100, round(ln(v_reports + 1) * 28));
  v_persistence := least(100, v_days * 4);
  v_priority := least(100, round(v_severity*0.25 + v_support_score*0.25 + v_corroboration*0.15 + v_persistence*0.10 + v_geo*0.10 + v_evidence*0.10 + v_sla*0.05));
  update public.issues set supporters = v_support, reports = v_reports, comments = v_comments, days_unresolved = v_days, chai_heat = v_heat, priority_score = v_priority,
    priority_factors = jsonb_build_object('severity',v_severity,'community_support',v_support_score,'corroboration',v_corroboration,'persistence',v_persistence,'geographic_impact',v_geo,'evidence',v_evidence,'sla',v_sla),
    priority = case when v_priority >= 82 then 'Critical' when v_priority >= 65 then 'High' when v_priority >= 40 then 'Moderate' else 'Low' end
  where id = p_issue_id;
end
$$;
revoke all on function public.refresh_issue_signals(uuid) from public, anon, authenticated;
create or replace function public.refresh_issue_signals_trigger()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.refresh_issue_signals(coalesce(new.issue_id, old.issue_id));
  return null;
end
$$;
drop trigger if exists trg_refresh_issue_supports on public.issue_supports;
create trigger trg_refresh_issue_supports after insert or delete on public.issue_supports for each row execute function public.refresh_issue_signals_trigger();
drop trigger if exists trg_refresh_issue_comments on public.issue_comments;
create trigger trg_refresh_issue_comments after insert or delete or update on public.issue_comments for each row execute function public.refresh_issue_signals_trigger();
drop trigger if exists trg_refresh_issue_reports on public.issue_reports;
create trigger trg_refresh_issue_reports after insert or delete on public.issue_reports for each row execute function public.refresh_issue_signals_trigger();

create or replace function public.audit_issue_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status or new.department is distinct from old.department or new.officer is distinct from old.officer or new.duplicate_of is distinct from old.duplicate_of then
    insert into public.audit_logs(issue_id, actor_id, action, details)
    values (new.id, auth.uid(), case when new.status is distinct from old.status then 'issue.status_or_assignment_changed' else 'issue.assignment_or_duplicate_changed' end,
      jsonb_build_object('before',jsonb_build_object('status',old.status,'department',old.department,'officer',old.officer,'duplicate_of',old.duplicate_of),'after',jsonb_build_object('status',new.status,'department',new.department,'officer',new.officer,'duplicate_of',new.duplicate_of)));
  end if;
  return new;
end
$$;
drop trigger if exists trg_issues_audit on public.issues;
create trigger trg_issues_audit after update on public.issues for each row execute function public.audit_issue_change();

create or replace function public.my_issue_ids()
returns table(issue_id uuid, relationship text) language sql stable security definer set search_path = public
as $$
  select i.id,
    case when i.created_by = auth.uid() then 'filed'
      when exists (select 1 from public.issue_supports s where s.issue_id = i.id and s.user_id = auth.uid()) then 'supported'
      else 'followed' end::text
  from public.issues i
  where i.created_by = auth.uid()
    or exists (select 1 from public.issue_supports s where s.issue_id = i.id and s.user_id = auth.uid())
    or exists (select 1 from public.issue_follows f where f.issue_id = i.id and f.user_id = auth.uid())
$$;
revoke all on function public.my_issue_ids() from public;
grant execute on function public.my_issue_ids() to authenticated;

create or replace function public.consume_api_rate_limit(p_key_hash text, p_window_seconds integer, p_limit integer)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_hits integer;
begin
  insert into public.api_rate_limits(key_hash,window_started_at,hit_count,expires_at)
  values (p_key_hash,now(),1,now()+make_interval(secs => p_window_seconds))
  on conflict (key_hash) do update set
    window_started_at = case when public.api_rate_limits.window_started_at <= now()-make_interval(secs => p_window_seconds) then now() else public.api_rate_limits.window_started_at end,
    hit_count = case when public.api_rate_limits.window_started_at <= now()-make_interval(secs => p_window_seconds) then 1 else public.api_rate_limits.hit_count+1 end,
    expires_at = now()+make_interval(secs => p_window_seconds)
  returning hit_count into v_hits;
  return v_hits <= p_limit;
end
$$;
revoke all on function public.consume_api_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text,integer,integer) to service_role;

create or replace view public.public_issue_timeline with (security_invoker = true) as
  select id, issue_id, old_status, new_status, note, evidence_url, created_at from public.status_events;

alter table public.jurisdictions enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.departments enable row level security;
alter table public.authority_hubs enable row level security;
alter table public.officer_registry enable row level security;
alter table public.official_documents enable row level security;
alter table public.issues enable row level security;
alter table public.issue_reports enable row level security;
alter table public.issue_evidence enable row level security;
alter table public.issue_comments enable row level security;
alter table public.issue_supports enable row level security;
alter table public.issue_follows enable row level security;
alter table public.issue_official_notes enable row level security;
alter table public.status_events enable row level security;
alter table public.duplicate_links enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.data_rights_requests enable row level security;
alter table public.sla_targets enable row level security;
alter table public.voice_sessions enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.audit_logs enable row level security;

-- Remove the intentionally broad prototype policies created by 001/schema.sql.
drop policy if exists "Profiles are viewable by owner or authenticated user" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Issues are viewable by anyone" on public.issues;
drop policy if exists "Authenticated users can insert issues" on public.issues;
drop policy if exists "Authenticated users can update issues" on public.issues;
drop policy if exists "Issue comments are viewable by anyone" on public.issue_comments;
drop policy if exists "Authenticated users can create comments" on public.issue_comments;
drop policy if exists "Users can update own comments" on public.issue_comments;
drop policy if exists "Issue supports are viewable by anyone" on public.issue_supports;
drop policy if exists "Authenticated users can manage supports" on public.issue_supports;
drop policy if exists "Users can delete own support" on public.issue_supports;
drop policy if exists "Audit logs are readable for authenticated users" on public.audit_logs;
drop policy if exists "Officer registry is readable by all" on public.officer_registry;
drop policy if exists "Authenticated users can manage registry" on public.officer_registry;
drop policy if exists "Official documents are readable by all" on public.official_documents;
drop policy if exists "Authenticated users can manage official documents" on public.official_documents;

-- Idempotently replace this migration's own policies.
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname='public' and policyname in (
    'profile owner read','profile owner update','jurisdiction public verified','categories public read','departments public read',
    'hub public verified','hub admin manage','officer public verified','officer admin manage','official documents public verified',
    'official documents authority manage','public or scoped issue read','issue service insert','issue authorized update',
    'reporter or authority report read','evidence owner or authority read','evidence owner insert','public comments visible',
    'signed in comment insert','comment owner edit','moderator comment control','support public read own','support one per user',
    'support owner delete','issue follow own read','issue follow own insert','issue follow owner delete','official notes scoped read','official note authorized insert','status event scoped read',
    'status event manager insert','duplicate public read','duplicate manager update','moderation report owner read',
    'moderation report owner create','moderator report review','support one per citizen','notifications owner','notifications owner update',
    'privacy request owner read','privacy request owner create','privacy request compliance read',
    'sla verified public read','sla authority manager','voice sessions server only','audit authorized read','audit server write','public status timeline','rate limits service only'
  ) loop execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename); end loop;
end $$;

create policy "profile owner read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profile owner update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "jurisdiction public verified" on public.jurisdictions for select using (is_verified or public.can_manage_registry(pin));
create policy "categories public read" on public.categories for select using (true);
create policy "departments public read" on public.departments for select using (is_active);
create policy "hub public verified" on public.authority_hubs for select using (is_verified or public.can_manage_registry(pin));
create policy "hub admin manage" on public.authority_hubs for all to authenticated using (public.can_manage_registry(pin)) with check (public.can_manage_registry(pin));
create policy "officer public verified" on public.officer_registry for select using (is_verified or public.can_manage_registry(pin));
create policy "officer admin manage" on public.officer_registry for all to authenticated using (public.can_manage_registry(pin)) with check (public.can_manage_registry(pin));
create policy "official documents public verified" on public.official_documents for select using (is_verified or public.current_app_role() = 'authority_admin');
create policy "official documents authority manage" on public.official_documents for all to authenticated using (public.current_app_role() = 'authority_admin') with check (public.current_app_role() = 'authority_admin');
create policy "public or scoped issue read" on public.issues for select using (is_public or public.can_manage_issue(id));
create policy "issue authorized update" on public.issues for update to authenticated using (public.can_manage_issue(id)) with check (public.can_manage_issue(id));
create policy "reporter or authority report read" on public.issue_reports for select to authenticated using (reporter_id = auth.uid() or public.can_manage_issue(issue_id));
create policy "evidence owner or authority read" on public.issue_evidence for select to authenticated using (uploaded_by = auth.uid() or public.can_manage_issue(issue_id));
create policy "evidence owner insert" on public.issue_evidence for insert to authenticated with check (uploaded_by = auth.uid());
create policy "public comments visible" on public.issue_comments for select using (status = 'visible' and exists (select 1 from public.issues i where i.id = issue_id and i.is_public));
create policy "signed in comment insert" on public.issue_comments for insert to authenticated with check (author_id = auth.uid() and char_length(body) between 1 and 2000);
create policy "comment owner edit" on public.issue_comments for update to authenticated using (author_id = auth.uid() and status = 'visible') with check (author_id = auth.uid() and status = 'visible');
create policy "moderator comment control" on public.issue_comments for update to authenticated using (public.current_app_role() in ('moderator','authority_admin')) with check (public.current_app_role() in ('moderator','authority_admin'));
create policy "support public read own" on public.issue_supports for select to authenticated using (user_id = auth.uid());
create policy "support one per citizen" on public.issue_supports for insert to authenticated with check (user_id = auth.uid() and public.current_app_role() = 'citizen');
create policy "support owner delete" on public.issue_supports for delete to authenticated using (user_id = auth.uid());
create policy "issue follow own read" on public.issue_follows for select to authenticated using (user_id = auth.uid());
create policy "issue follow own insert" on public.issue_follows for insert to authenticated with check (user_id = auth.uid());
create policy "issue follow owner delete" on public.issue_follows for delete to authenticated using (user_id = auth.uid());
create policy "official notes scoped read" on public.issue_official_notes for select to authenticated using (visibility = 'public' or public.can_manage_issue(issue_id));
create policy "official note authorized insert" on public.issue_official_notes for insert to authenticated with check (author_id = auth.uid() and public.can_manage_issue(issue_id));
create policy "status event scoped read" on public.status_events for select to authenticated using (public.can_manage_issue(issue_id));
create policy "public status timeline" on public.status_events for select using (exists (select 1 from public.issues i where i.id = issue_id and i.is_public));
create policy "status event manager insert" on public.status_events for insert to authenticated with check (actor_id = auth.uid() and public.can_manage_issue(issue_id));
create policy "duplicate public read" on public.duplicate_links for select using (decision in ('suggested','joined','distinct','merged','unmerged'));
create policy "duplicate manager update" on public.duplicate_links for all to authenticated using (public.can_manage_issue(issue_a) and public.can_manage_issue(issue_b)) with check (public.can_manage_issue(issue_a) and public.can_manage_issue(issue_b));
create policy "moderation report owner read" on public.moderation_reports for select to authenticated using (reporter_id = auth.uid() or public.current_app_role() in ('moderator','authority_admin'));
create policy "moderation report owner create" on public.moderation_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "moderator report review" on public.moderation_reports for update to authenticated using (public.current_app_role() in ('moderator','authority_admin')) with check (public.current_app_role() in ('moderator','authority_admin'));
create policy "notifications owner" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications owner update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "privacy request owner read" on public.data_rights_requests for select to authenticated using (user_id = auth.uid());
create policy "privacy request owner create" on public.data_rights_requests for insert to authenticated with check (user_id = auth.uid());
create policy "privacy request compliance read" on public.data_rights_requests for select to authenticated using (public.current_app_role() = 'system_admin');
create policy "sla verified public read" on public.sla_targets for select using (is_verified or public.current_app_role() = 'authority_admin');
create policy "sla authority manager" on public.sla_targets for all to authenticated using (public.current_app_role() = 'authority_admin') with check (public.current_app_role() = 'authority_admin');
create policy "voice sessions server only" on public.voice_sessions for all using (false) with check (false);
create policy "rate limits service only" on public.api_rate_limits for all using (false) with check (false);
create policy "audit authorized read" on public.audit_logs for select to authenticated using (public.current_app_role() in ('auditor','authority_admin') and (issue_id is null or public.issue_is_in_scope(issue_id)));
create policy "audit server write" on public.audit_logs for insert to service_role with check (true);

-- Public key can read only fields safe for the community feed. Exact coordinates,
-- reporter identity, private media paths and legacy private contacts stay server-side.
revoke select on public.issues, public.profiles, public.authority_hubs, public.officer_registry, public.official_documents, public.issue_comments, public.status_events, public.issue_official_notes, public.duplicate_links from anon, authenticated;
grant select (id,document_id,title,description,normalized_text,category,department,pin,locality,status,priority,trust,chai_heat,supporters,reports,comments,days_unresolved,officer,hub,priority_score,priority_factors,trust_factors,ai_confidence,language,source_channel,model_version,sla_due_at,created_at,updated_at,duplicate_of,duplicate_decision,is_public,is_demo) on public.issues to anon, authenticated;
grant select on public.categories, public.departments, public.jurisdictions to anon, authenticated;
grant select (id,name,address,pin,ward,municipality,district,state,public_phone,public_email,source_url,source_version,is_verified,verified_at,jurisdiction_id,created_at,updated_at) on public.authority_hubs to anon, authenticated;
grant select (id,name,role,department,pin,hub,public_phone,public_email,source_url,source_version,is_verified,verified_at,jurisdiction_id,created_at) on public.officer_registry to anon, authenticated;
grant select (id,title,authority,document_number,source_url,published_at,version,checksum,effective_at,source_version,issuing_authority,is_verified,verified_at,jurisdiction_id,created_at) on public.official_documents to anon, authenticated;
grant select on public.public_issue_timeline to anon, authenticated;
grant select (id,issue_id,body,status,created_at,updated_at,edited_at) on public.issue_comments to anon, authenticated;
grant insert (issue_id,author_id,body) on public.issue_comments to authenticated;
grant update (body,edited_at,updated_at,status) on public.issue_comments to authenticated;
grant select, insert, delete on public.issue_supports to authenticated;
grant select, insert, delete on public.issue_follows to authenticated;
grant select (id,display_name,role,pin,preferred_pin,department,preferred_language,locality,city,ward,avatar_url,notification_preferences,consent_preferences,privacy_notice_version,privacy_notice_at,created_at,updated_at) on public.profiles to authenticated;
grant update (display_name,city,ward,locality,preferred_pin,preferred_language,avatar_url,phone,consent_preferences,notification_preferences,privacy_notice_version,privacy_notice_at) on public.profiles to authenticated;
grant select (id,issue_id,old_status,new_status,note,evidence_url,created_at) on public.status_events to anon, authenticated;
grant select on public.issue_official_notes, public.moderation_reports, public.notifications to authenticated;
grant select on public.sla_targets to anon, authenticated;
grant insert on public.moderation_reports to authenticated;
grant update on public.moderation_reports, public.notifications to authenticated;
grant select, insert on public.data_rights_requests to authenticated;
revoke update, delete on public.data_rights_requests from anon, authenticated;
grant update (status,response_note,reviewed_by,reviewed_at) on public.data_rights_requests to service_role;
grant insert on public.issue_official_notes, public.status_events to authenticated;
revoke update on public.issues from anon, authenticated;
grant update (status,priority,priority_score,priority_factors,trust,trust_factors,department,officer,hub,sla_due_at,duplicate_of,duplicate_decision,resolution_evidence_url,community_verified_at,closed_at,days_unresolved,chai_heat,supporters,reports,comments) on public.issues to authenticated;
grant select on public.audit_logs to authenticated;
grant all on public.jurisdictions, public.authority_hubs, public.issue_reports, public.issue_evidence, public.voice_sessions to service_role;

-- Pilot hardening: safe jurisdiction snapshots and role-specific issue transitions.
alter table public.issues add column if not exists state text;
alter table public.issues add column if not exists district text;
alter table public.issues add column if not exists municipality text;
alter table public.issues add column if not exists ward text;
alter table public.issues add column if not exists has_evidence boolean not null default false;
update public.issues set has_evidence = (coalesce(cardinality(evidence_urls), 0) > 0 or image_url is not null) where not has_evidence;
create index if not exists idx_issues_geographic_scope on public.issues(state, district, municipality, ward, pin);
with unique_verified_hubs as (
  select pin, min(state) as state, min(district) as district, min(municipality) as municipality, min(ward) as ward
  from public.authority_hubs where is_verified group by pin having count(*) = 1
)
update public.issues i set state = coalesce(i.state, h.state), district = coalesce(i.district, h.district),
  municipality = coalesce(i.municipality, h.municipality), ward = coalesce(i.ward, h.ward)
from unique_verified_hubs h where h.pin = i.pin and (i.state is null or i.district is null or i.municipality is null or i.ward is null);
grant select (state, district, municipality, ward, has_evidence) on public.issues to anon, authenticated;
revoke update (status, priority, priority_score, priority_factors, trust, trust_factors, department, officer, hub, sla_due_at, duplicate_of, duplicate_decision, resolution_evidence_url, community_verified_at, closed_at, days_unresolved, chai_heat, supporters, reports, comments) on public.issues from anon, authenticated;
revoke update on public.issues from anon, authenticated;
revoke insert on public.status_events, public.issue_official_notes from anon, authenticated;

create or replace function public.apply_issue_action(p_issue_id uuid, p_actor_id uuid, p_status text, p_department text, p_officer text, p_note text, p_resolution_evidence text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare issue_row public.issues%rowtype; actor_role text; actor_pin text; actor_department text; actor_jurisdiction uuid; next_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Issue actions must be executed by the CivicChai server'; end if;
  if p_actor_id is null then raise exception 'An authenticated staff account is required'; end if;
  select role, pin, department, jurisdiction_id into actor_role, actor_pin, actor_department, actor_jurisdiction from public.profiles where id = p_actor_id;
  if actor_role not in ('department_operator', 'department_supervisor', 'authority_admin') then raise exception 'This role cannot change issue operations'; end if;
  select * into issue_row from public.issues where id = p_issue_id for update;
  if not found then raise exception 'Issue not found'; end if;
  if actor_role = 'authority_admin' then
    if not ((actor_jurisdiction is not null and actor_jurisdiction = issue_row.jurisdiction_id) or (actor_pin is not null and actor_pin = issue_row.pin)) then raise exception 'Issue is outside the authority administrator jurisdiction'; end if;
  else
    if actor_department is null or actor_department <> issue_row.department or not ((actor_jurisdiction is not null and actor_jurisdiction = issue_row.jurisdiction_id) or (actor_pin is not null and actor_pin = issue_row.pin)) then raise exception 'Issue is outside the assigned department and jurisdiction'; end if;
  end if;
  if actor_role = 'department_operator' and (p_department is not null or p_officer is not null) then raise exception 'Department operators cannot assign issues'; end if;
  if actor_role = 'department_supervisor' and p_department is not null then raise exception 'Department supervisors cannot route issues to another department'; end if;
  next_status := coalesce(p_status, issue_row.status);
  if next_status is distinct from issue_row.status then
    if actor_role = 'department_operator' and next_status not in ('Acknowledged', 'In Progress', 'Resolved', 'Under Review') then raise exception 'Status is outside the department operator workflow'; end if;
    if actor_role = 'department_supervisor' and next_status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then raise exception 'Status is outside the department supervisor workflow'; end if;
    if actor_role = 'authority_admin' and next_status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then raise exception 'Status is outside the authority administrator workflow'; end if;
    if next_status = 'Closed' and issue_row.status <> 'Resolved' then raise exception 'Only resolved issues can be closed'; end if;
    if next_status = 'Resolved' and (p_resolution_evidence is null or p_resolution_evidence !~* '^https://([a-z0-9-]+\.)*(gov\.in|nic\.in)(/|$)') then raise exception 'Resolution requires an official HTTPS evidence URL'; end if;
  end if;
  update public.issues set status = next_status, department = coalesce(p_department, department), officer = coalesce(p_officer, officer), resolution_evidence_url = coalesce(p_resolution_evidence, resolution_evidence_url), updated_at = now() where id = p_issue_id;
  if next_status is distinct from issue_row.status then insert into public.status_events(issue_id,old_status,new_status,actor_id,note,evidence_url) values (p_issue_id,issue_row.status,next_status,p_actor_id,nullif(p_note,''),p_resolution_evidence); end if;
  if nullif(p_note,'') is not null then insert into public.issue_official_notes(issue_id,author_id,body) values (p_issue_id,p_actor_id,p_note); end if;
  insert into public.audit_logs(issue_id,actor_id,action,details) values (p_issue_id,p_actor_id,case when next_status is distinct from issue_row.status then 'issue.status_changed' else 'issue.assignment_changed' end,jsonb_build_object('from',issue_row.status,'to',next_status,'department',p_department,'officer',p_officer,'note',p_note));
  return p_issue_id;
end;
$$;
revoke all on function public.apply_issue_action(uuid,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_issue_action(uuid,uuid,text,text,text,text,text) to service_role;
create or replace function public.civicchai_schema_version()
returns integer language sql immutable security definer set search_path = public as $$ select 4 $$;
revoke all on function public.civicchai_schema_version() from public, anon, authenticated;
grant execute on function public.civicchai_schema_version() to service_role;

create or replace function public.enforce_issue_manager_transition()
returns trigger language plpgsql security definer set search_path = public
as $$
declare actor_role text := public.current_app_role();
begin
  if auth.uid() is null then return new; end if;
  if actor_role not in ('department_operator', 'department_supervisor', 'authority_admin') then raise exception 'This role cannot change issue operations'; end if;
  if actor_role = 'department_operator' and (new.department is distinct from old.department or new.officer is distinct from old.officer) then raise exception 'Department operators cannot assign issues'; end if;
  if actor_role = 'department_supervisor' and new.department is distinct from old.department then raise exception 'Department supervisors cannot route outside their department'; end if;
  if new.status is distinct from old.status then
    if actor_role = 'department_operator' and new.status not in ('Acknowledged', 'In Progress', 'Resolved', 'Under Review') then raise exception 'Status is outside the department operator workflow'; end if;
    if actor_role = 'department_supervisor' and new.status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then raise exception 'Status is outside the department supervisor workflow'; end if;
    if actor_role = 'authority_admin' and new.status not in ('Assigned', 'Acknowledged', 'In Progress', 'Resolved', 'Under Review', 'Closed') then raise exception 'Status is outside the authority administrator workflow'; end if;
    if new.status = 'Closed' and old.status <> 'Resolved' then raise exception 'Only resolved issues can be closed'; end if;
    if new.status = 'Resolved' and (new.resolution_evidence_url is null or new.resolution_evidence_url !~* '^https://([a-z0-9-]+\.)*(gov\.in|nic\.in)(/|$)') then raise exception 'Resolution requires an official HTTPS evidence URL'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists issues_manager_transition_guard on public.issues;
create trigger issues_manager_transition_guard before update on public.issues for each row execute function public.enforce_issue_manager_transition();

-- Private evidence bucket, scoped to the uploader's account.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('issue-evidence','issue-evidence',false,15728640,array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set public=false,file_size_limit=15728640,allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm'];
drop policy if exists "citizen uploads own evidence" on storage.objects;
create policy "citizen uploads own evidence" on storage.objects for insert to authenticated with check (bucket_id='issue-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "citizen reads own evidence" on storage.objects;
create policy "citizen reads own evidence" on storage.objects for select to authenticated using (bucket_id='issue-evidence' and (storage.foldername(name))[1]=auth.uid()::text);

insert into public.departments(slug,name) values
  ('roads','PWD — Roads Division'),('lighting','Municipal Public Lighting'),('solid-waste','Solid Waste Management'),
  ('water-works','Water Works Department'),('drainage','Drainage & Sewerage'),('traffic','Traffic Police / PWD'),('public-health','Public Health Office')
on conflict (slug) do nothing;
insert into public.categories(name) values ('Roads & Potholes'),('Public Lighting'),('Sanitation'),('Water Supply'),('Drainage'),('Traffic'),('Public Health'),('General civic issue')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 005_pilot_workflow.sql (included so a fresh import matches the ordered migrations)
-- ---------------------------------------------------------------------------

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

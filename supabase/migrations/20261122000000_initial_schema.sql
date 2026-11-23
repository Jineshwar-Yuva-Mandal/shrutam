create extension if not exists pgcrypto;

create type public.paathshala_role as enum ('platform_admin', 'admin', 'teacher', 'parent', 'student');
create type public.membership_status as enum ('pending', 'active', 'suspended');
create type public.request_status as enum ('pending', 'approved', 'rejected');
create type public.attendance_status as enum ('present', 'absent', 'excused');
create type public.event_status as enum ('draft', 'published', 'cancelled');

create table public.paathshalas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  city text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.paathshala_memberships (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.paathshala_role not null check (role <> 'platform_admin'),
  status public.membership_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (paathshala_id, user_id, role)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  learning_level text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (paathshala_id, id)
);

create table public.parent_student_links (
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (parent_user_id, student_id),
  foreign key (paathshala_id, student_id) references public.students(paathshala_id, id) on delete cascade
);

create table public.family_join_requests (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  learner_name text not null,
  requested_level text not null default '',
  status public.request_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  student_id uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  foreign key (paathshala_id, student_id) references public.students(paathshala_id, id) on delete set null (student_id)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  name text not null,
  learning_level text not null default '',
  teacher_user_id uuid references auth.users(id) on delete set null,
  weekday smallint check (weekday between 0 and 6),
  starts_at time,
  room text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (paathshala_id, id)
);

create table public.class_enrollments (
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  class_id uuid not null,
  student_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id),
  foreign key (paathshala_id, class_id) references public.classes(paathshala_id, id) on delete cascade,
  foreign key (paathshala_id, student_id) references public.students(paathshala_id, id) on delete cascade
);

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  class_id uuid not null,
  session_date date not null,
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, session_date),
  unique (paathshala_id, id),
  foreign key (paathshala_id, class_id) references public.classes(paathshala_id, id) on delete cascade
);

create table public.attendance_records (
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  session_id uuid not null,
  student_id uuid not null,
  status public.attendance_status not null,
  note text,
  marked_at timestamptz not null default now(),
  primary key (session_id, student_id),
  foreign key (paathshala_id, session_id) references public.attendance_sessions(paathshala_id, id) on delete cascade,
  foreign key (paathshala_id, student_id) references public.students(paathshala_id, id) on delete cascade
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  venue text not null default '',
  status public.event_status not null default 'draft',
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (paathshala_id, id)
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  event_id uuid not null,
  registrant_user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid,
  created_at timestamptz not null default now(),
  foreign key (paathshala_id, event_id) references public.events(paathshala_id, id) on delete cascade,
  foreign key (paathshala_id, student_id) references public.students(paathshala_id, id) on delete cascade,
  unique nulls not distinct (event_id, registrant_user_id, student_id)
);

create index memberships_user_tenant_idx on public.paathshala_memberships(user_id, paathshala_id, status);
create index students_tenant_name_idx on public.students(paathshala_id, full_name);
create index parent_student_parent_idx on public.parent_student_links(parent_user_id, paathshala_id);
create index classes_tenant_teacher_idx on public.classes(paathshala_id, teacher_user_id, is_active);
create index class_enrollments_student_idx on public.class_enrollments(student_id, class_id);
create index attendance_sessions_tenant_date_idx on public.attendance_sessions(paathshala_id, session_date desc);
create index attendance_records_student_idx on public.attendance_records(student_id, session_id);
create index events_tenant_start_idx on public.events(paathshala_id, starts_at) where status = 'published';
create index event_registrations_user_idx on public.event_registrations(registrant_user_id, event_id);

create function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create function public.has_paathshala_role(p_paathshala_id uuid, p_roles public.paathshala_role[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.paathshala_memberships m
    where m.paathshala_id = p_paathshala_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

create function public.can_view_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and (
        s.user_id = auth.uid()
        or exists (
          select 1 from public.parent_student_links p
          where p.student_id = s.id and p.parent_user_id = auth.uid()
        )
        or public.has_paathshala_role(s.paathshala_id, array['admin']::public.paathshala_role[])
        or exists (
          select 1
          from public.class_enrollments ce
          join public.classes c on c.id = ce.class_id and c.paathshala_id = ce.paathshala_id
          where ce.student_id = s.id
            and c.teacher_user_id = auth.uid()
            and c.is_active
            and public.has_paathshala_role(s.paathshala_id, array['teacher']::public.paathshala_role[])
        )
      )
  );
$$;

create function public.can_manage_class(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classes c
    where c.id = p_class_id
      and (
        public.has_paathshala_role(c.paathshala_id, array['admin']::public.paathshala_role[])
        or (c.teacher_user_id = auth.uid() and public.has_paathshala_role(c.paathshala_id, array['teacher']::public.paathshala_role[]))
      )
  );
$$;

create function public.can_manage_attendance(p_session_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.attendance_sessions a
    where a.id = p_session_id and public.can_manage_class(a.class_id)
  );
$$;

create function public.create_profile_for_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create function public.provision_paathshala(p_name text, p_slug text, p_city text, p_admin_user_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  new_paathshala_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform administrator can provision a paathshala';
  end if;

  insert into public.paathshalas (name, slug, city)
  values (trim(p_name), lower(trim(p_slug)), trim(coalesce(p_city, '')))
  returning id into new_paathshala_id;

  insert into public.paathshala_memberships (paathshala_id, user_id, role, status)
  values (new_paathshala_id, p_admin_user_id, 'admin', 'active');

  return new_paathshala_id;
end;
$$;

create function public.approve_family_join_request(p_request_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  join_request public.family_join_requests%rowtype;
  new_student_id uuid;
begin
  select * into join_request
  from public.family_join_requests
  where id = p_request_id
  for update;

  if not found or not public.has_paathshala_role(join_request.paathshala_id, array['admin']::public.paathshala_role[]) then
    raise exception 'Join request not found or not authorized';
  end if;
  if join_request.status <> 'pending' then
    raise exception 'Join request has already been reviewed';
  end if;

  insert into public.students (paathshala_id, full_name, learning_level)
  values (join_request.paathshala_id, join_request.learner_name, join_request.requested_level)
  returning id into new_student_id;

  insert into public.parent_student_links (paathshala_id, parent_user_id, student_id)
  values (join_request.paathshala_id, join_request.requester_user_id, new_student_id);

  insert into public.paathshala_memberships (paathshala_id, user_id, role, status)
  values (join_request.paathshala_id, join_request.requester_user_id, 'parent', 'active')
  on conflict (paathshala_id, user_id, role) do update set status = 'active';

  update public.family_join_requests
  set status = 'approved', student_id = new_student_id, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  return new_student_id;
end;
$$;

alter table public.paathshalas enable row level security;
alter table public.platform_admins enable row level security;
alter table public.profiles enable row level security;
alter table public.paathshala_memberships enable row level security;
alter table public.students enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.family_join_requests enable row level security;
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

create policy "active paathshalas are discoverable" on public.paathshalas
  for select using (is_active or public.is_platform_admin());
create policy "platform admins manage paathshalas" on public.paathshalas
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "platform admins read platform admin list" on public.platform_admins
  for select using (user_id = auth.uid() or public.is_platform_admin());

create policy "users read their profile" on public.profiles
  for select using (user_id = auth.uid() or public.is_platform_admin());
create policy "users update their profile" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members read tenant memberships" on public.paathshala_memberships
  for select using (
    user_id = auth.uid()
    or public.has_paathshala_role(paathshala_id, array['admin', 'teacher']::public.paathshala_role[])
  );
create policy "admins manage tenant memberships" on public.paathshala_memberships
  for all using (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]));

create policy "authorized users read students" on public.students
  for select using (public.can_view_student(id));
create policy "staff manage students" on public.students
  for all using (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]));

create policy "families and staff read family links" on public.parent_student_links
  for select using (
    parent_user_id = auth.uid()
    or public.has_paathshala_role(paathshala_id, array['admin', 'teacher']::public.paathshala_role[])
  );
create policy "admins manage family links" on public.parent_student_links
  for all using (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]));

create policy "requesters and admins read join requests" on public.family_join_requests
  for select using (
    requester_user_id = auth.uid()
    or public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[])
  );
create policy "authenticated users request to join" on public.family_join_requests
  for insert with check (requester_user_id = auth.uid() and status = 'pending');
create policy "admins review join requests" on public.family_join_requests
  for update using (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]));

create policy "members read classes" on public.classes
  for select using (public.has_paathshala_role(paathshala_id, array['admin', 'teacher', 'parent', 'student']::public.paathshala_role[]));
create policy "admins manage classes" on public.classes
  for all using (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]));

create policy "families and staff read class enrollments" on public.class_enrollments
  for select using (
    public.can_view_student(student_id)
    or public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[])
  );
create policy "staff manage class enrollments" on public.class_enrollments
  for all using (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]));

create policy "members read attendance sessions" on public.attendance_sessions
  for select using (public.has_paathshala_role(paathshala_id, array['admin', 'teacher', 'parent', 'student']::public.paathshala_role[]));
create policy "assigned teachers and admins manage sessions" on public.attendance_sessions
  for all using (public.can_manage_class(class_id)) with check (public.can_manage_class(class_id));

create policy "families and staff read attendance records" on public.attendance_records
  for select using (public.can_view_student(student_id));
create policy "assigned teachers and admins manage attendance" on public.attendance_records
  for all using (public.can_manage_attendance(session_id)) with check (public.can_manage_attendance(session_id));

create policy "members read published events" on public.events
  for select using (
    (status = 'published' and public.has_paathshala_role(paathshala_id, array['admin', 'teacher', 'parent', 'student']::public.paathshala_role[]))
    or public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[])
  );
create policy "admins manage events" on public.events
  for all using (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['admin']::public.paathshala_role[]));

create policy "members read event registrations" on public.event_registrations
  for select using (
    registrant_user_id = auth.uid()
    or (student_id is not null and public.can_view_student(student_id))
    or public.has_paathshala_role(paathshala_id, array['admin', 'teacher']::public.paathshala_role[])
  );
create policy "families register for tenant events" on public.event_registrations
  for insert with check (
    registrant_user_id = auth.uid()
    and public.has_paathshala_role(paathshala_id, array['parent', 'student', 'admin', 'teacher']::public.paathshala_role[])
    and (student_id is null or public.can_view_student(student_id))
  );
create policy "users cancel their event registration" on public.event_registrations
  for delete using (registrant_user_id = auth.uid());

grant execute on function public.provision_paathshala(text, text, text, uuid) to authenticated;
grant execute on function public.approve_family_join_request(uuid) to authenticated;
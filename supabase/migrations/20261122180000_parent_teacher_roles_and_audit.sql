begin;

alter table public.paathshala_memberships
  drop constraint if exists paathshala_memberships_role_check;
alter table public.paathshala_memberships
  add constraint paathshala_memberships_role_parent_teacher_check
  check (role in ('teacher', 'parent'));

alter table public.students drop column if exists user_id;

create or replace function public.can_view_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and (
        exists (
          select 1 from public.parent_student_links p
          where p.student_id = s.id and p.parent_user_id = auth.uid()
        )
        or public.has_paathshala_role(s.paathshala_id, array['teacher']::public.paathshala_role[])
      )
  );
$$;

create or replace function public.can_manage_class(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classes c
    where c.id = p_class_id
      and public.has_paathshala_role(c.paathshala_id, array['teacher']::public.paathshala_role[])
  );
$$;

create function public.validate_class_teacher_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.teacher_user_id is not null and not exists (
    select 1
    from public.paathshala_memberships m
    where m.paathshala_id = new.paathshala_id
      and m.user_id = new.teacher_user_id
      and m.role = 'teacher'
      and m.status = 'active'
  ) then
    raise exception 'Assigned teacher must have an active teacher membership in this paathshala';
  end if;
  return new;
end;
$$;

create trigger validate_class_teacher_assignment
  before insert or update of teacher_user_id, paathshala_id on public.classes
  for each row execute procedure public.validate_class_teacher_assignment();

create or replace function public.can_view_paathshala_contact(p_contact_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.paathshala_memberships viewer
    join public.paathshala_memberships teacher on teacher.paathshala_id = viewer.paathshala_id
    where viewer.user_id = auth.uid()
      and viewer.status = 'active'
      and teacher.user_id = p_contact_user_id
      and (
        (viewer.role = 'teacher' and teacher.role in ('teacher', 'parent') and teacher.status in ('pending', 'active'))
        or (viewer.role = 'parent' and teacher.role = 'teacher' and teacher.status = 'active')
      )
  );
$$;

drop function public.provision_paathshala(text, text, text, uuid);
create function public.provision_paathshala(p_name text, p_slug text, p_city text, p_teacher_user_id uuid default null)
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

  if p_teacher_user_id is not null then
    insert into public.paathshala_memberships (paathshala_id, user_id, role, status)
    values (new_paathshala_id, p_teacher_user_id, 'teacher', 'active');
  end if;

  return new_paathshala_id;
end;
$$;

create or replace function public.approve_family_join_request(p_request_id uuid)
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

  if not found or not public.has_paathshala_role(join_request.paathshala_id, array['teacher']::public.paathshala_role[]) then
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

create function public.approve_teacher_membership(p_membership_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  requested_membership public.paathshala_memberships%rowtype;
begin
  select * into requested_membership
  from public.paathshala_memberships
  where id = p_membership_id
  for update;

  if not found or requested_membership.role <> 'teacher' or requested_membership.status <> 'pending'
    or not public.is_platform_admin()
      and not public.has_paathshala_role(requested_membership.paathshala_id, array['teacher']::public.paathshala_role[]) then
    raise exception 'Teacher request not found or not authorized';
  end if;

  update public.paathshala_memberships
  set status = 'active'
  where id = p_membership_id;
end;
$$;

drop policy if exists "admins manage tenant memberships" on public.paathshala_memberships;
drop policy if exists "members read tenant memberships" on public.paathshala_memberships;
drop policy if exists "teachers request membership" on public.paathshala_memberships;
create policy "members read tenant memberships" on public.paathshala_memberships
  for select using (
    user_id = auth.uid()
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );
create policy "teachers request membership" on public.paathshala_memberships
  for insert with check (user_id = auth.uid() and role = 'teacher' and status = 'pending');

drop policy if exists "staff manage students" on public.students;
create policy "teachers manage students" on public.students
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

drop policy if exists "admins manage family links" on public.parent_student_links;
drop policy if exists "teachers manage family links" on public.parent_student_links;
drop policy if exists "families and staff read family links" on public.parent_student_links;
create policy "families and teachers read family links" on public.parent_student_links
  for select using (
    parent_user_id = auth.uid()
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );
create policy "teachers manage family links" on public.parent_student_links
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

drop policy if exists "admins review join requests" on public.family_join_requests;
drop policy if exists "requesters and admins read join requests" on public.family_join_requests;
drop policy if exists "requesters and teachers read join requests" on public.family_join_requests;
create policy "requesters and teachers read join requests" on public.family_join_requests
  for select using (
    requester_user_id = auth.uid()
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );
drop policy if exists "teachers review join requests" on public.family_join_requests;
create policy "teachers review join requests" on public.family_join_requests
  for update using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

drop policy if exists "admins manage classes" on public.classes;
drop policy if exists "teachers manage classes" on public.classes;
drop policy if exists "members read classes" on public.classes;
create policy "members read classes" on public.classes
  for select using (public.has_paathshala_role(paathshala_id, array['teacher', 'parent']::public.paathshala_role[]));
create policy "teachers manage classes" on public.classes
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

drop policy if exists "staff manage class enrollments" on public.class_enrollments;
drop policy if exists "teachers manage class enrollments" on public.class_enrollments;
drop policy if exists "families and staff read class enrollments" on public.class_enrollments;
drop policy if exists "families and teachers read class enrollments" on public.class_enrollments;
create policy "families and teachers read class enrollments" on public.class_enrollments
  for select using (public.can_view_student(student_id));
create policy "teachers manage class enrollments" on public.class_enrollments
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

drop policy if exists "admins manage events" on public.events;
drop policy if exists "teachers manage events" on public.events;
drop policy if exists "members read published events" on public.events;
create policy "members read published events" on public.events
  for select using (
    (status = 'published' and public.has_paathshala_role(paathshala_id, array['teacher', 'parent']::public.paathshala_role[]))
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );
create policy "teachers manage events" on public.events
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

drop policy if exists "members read attendance sessions" on public.attendance_sessions;
create policy "members read attendance sessions" on public.attendance_sessions
  for select using (public.has_paathshala_role(paathshala_id, array['teacher', 'parent']::public.paathshala_role[]));
drop policy if exists "assigned teachers and admins manage sessions" on public.attendance_sessions;
drop policy if exists "teachers manage attendance sessions" on public.attendance_sessions;
create policy "teachers manage attendance sessions" on public.attendance_sessions
  for all using (public.can_manage_class(class_id)) with check (public.can_manage_class(class_id));

drop policy if exists "families and staff read attendance records" on public.attendance_records;
drop policy if exists "families and teachers read attendance records" on public.attendance_records;
create policy "families and teachers read attendance records" on public.attendance_records
  for select using (public.can_view_student(student_id));
drop policy if exists "assigned teachers and admins manage attendance" on public.attendance_records;
drop policy if exists "teachers manage attendance records" on public.attendance_records;
create policy "teachers manage attendance records" on public.attendance_records
  for all using (public.can_manage_attendance(session_id)) with check (public.can_manage_attendance(session_id));

drop policy if exists "members read event registrations" on public.event_registrations;
create policy "members read event registrations" on public.event_registrations
  for select using (
    registrant_user_id = auth.uid()
    or (student_id is not null and public.can_view_student(student_id))
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );
drop policy if exists "families register for tenant events" on public.event_registrations;
create policy "families register for tenant events" on public.event_registrations
  for insert with check (
    registrant_user_id = auth.uid()
    and public.has_paathshala_role(paathshala_id, array['parent', 'teacher']::public.paathshala_role[])
    and (student_id is null or public.can_view_student(student_id))
  );

create policy "members read teacher profiles" on public.profiles
  for select using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or public.can_view_paathshala_contact(user_id)
  );

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid references public.paathshalas(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  table_name text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  record_id text not null,
  old_values jsonb,
  new_values jsonb,
  changed_at timestamptz not null default now()
);

create index audit_logs_tenant_changed_idx on public.audit_logs(paathshala_id, changed_at desc);

create function public.write_audit_log()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  row_data jsonb;
  old_data jsonb;
  tenant_id uuid;
  row_id text;
  actor_id uuid := auth.uid();
  actor_label text;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
    old_data := row_data;
  else
    row_data := to_jsonb(new);
    if tg_op = 'UPDATE' then old_data := to_jsonb(old); end if;
  end if;

  if tg_table_name = 'paathshalas' then
    tenant_id := (row_data ->> 'id')::uuid;
  elsif row_data ? 'paathshala_id' then
    tenant_id := nullif(row_data ->> 'paathshala_id', '')::uuid;
  end if;

  row_id := coalesce(row_data ->> 'id', row_data ->> 'user_id', row_data ->> 'student_id', row_data ->> 'class_id', row_data ->> 'session_id', row_data ->> 'event_id', 'unknown');
  select coalesce(nullif(p.full_name, ''), auth.jwt() ->> 'email', actor_id::text, 'system')
    into actor_label from (select 1) singleton left join public.profiles p on p.user_id = actor_id;

  insert into public.audit_logs (paathshala_id, actor_user_id, actor_name, table_name, operation, record_id, old_values, new_values)
  values (tenant_id, actor_id, actor_label, tg_table_name, tg_op, row_id, old_data, case when tg_op = 'DELETE' then null else row_data end);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_paathshalas after insert or update or delete on public.paathshalas for each row execute function public.write_audit_log();
create trigger audit_platform_admins after insert or update or delete on public.platform_admins for each row execute function public.write_audit_log();
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function public.write_audit_log();
create trigger audit_paathshala_memberships after insert or update or delete on public.paathshala_memberships for each row execute function public.write_audit_log();
create trigger audit_students after insert or update or delete on public.students for each row execute function public.write_audit_log();
create trigger audit_parent_student_links after insert or update or delete on public.parent_student_links for each row execute function public.write_audit_log();
create trigger audit_family_join_requests after insert or update or delete on public.family_join_requests for each row execute function public.write_audit_log();
create trigger audit_classes after insert or update or delete on public.classes for each row execute function public.write_audit_log();
create trigger audit_class_enrollments after insert or update or delete on public.class_enrollments for each row execute function public.write_audit_log();
create trigger audit_attendance_sessions after insert or update or delete on public.attendance_sessions for each row execute function public.write_audit_log();
create trigger audit_attendance_records after insert or update or delete on public.attendance_records for each row execute function public.write_audit_log();
create trigger audit_events after insert or update or delete on public.events for each row execute function public.write_audit_log();
create trigger audit_event_registrations after insert or update or delete on public.event_registrations for each row execute function public.write_audit_log();

alter table public.audit_logs enable row level security;
create policy "teachers and platform admins read audit logs" on public.audit_logs
  for select using (
    public.is_platform_admin()
    or (paathshala_id is not null and public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  );

grant execute on function public.provision_paathshala(text, text, text, uuid) to authenticated;
grant execute on function public.approve_family_join_request(uuid) to authenticated;
grant execute on function public.approve_teacher_membership(uuid) to authenticated;

commit;
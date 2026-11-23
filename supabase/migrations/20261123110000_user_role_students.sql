begin;

alter table public.paathshala_memberships
  drop constraint if exists paathshala_memberships_role_parent_teacher_check;
alter table public.paathshala_memberships
  drop constraint if exists paathshala_memberships_role_check;
delete from public.paathshala_memberships where role = 'parent';
alter table public.paathshala_memberships
  add constraint paathshala_memberships_role_teacher_student_check
  check (role in ('teacher', 'student'));

alter table public.students
  add column user_id uuid references auth.users(id) on delete set null;
alter table public.students
  add constraint students_paathshala_user_id_key unique (paathshala_id, user_id);
update public.students set is_active = false where user_id is null;

drop function if exists public.approve_family_join_request(uuid);
drop table public.parent_student_links;
drop table public.family_join_requests;
drop type public.request_status;

create or replace function public.can_view_paathshala_contact(p_contact_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.paathshala_memberships viewer
    join public.paathshala_memberships contact on contact.paathshala_id = viewer.paathshala_id
    where viewer.user_id = auth.uid()
      and viewer.status = 'active'
      and contact.user_id = p_contact_user_id
      and (
        (viewer.role = 'teacher' and contact.role in ('teacher', 'student') and contact.status in ('pending', 'active'))
        or (viewer.role = 'student' and contact.role = 'teacher' and contact.status = 'active')
      )
  );
$$;

create or replace function public.can_view_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and (s.user_id = auth.uid() or public.has_paathshala_role(s.paathshala_id, array['teacher']::public.paathshala_role[]))
  );
$$;

create or replace function public.can_view_class(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and (
        public.has_paathshala_role(c.paathshala_id, array['teacher']::public.paathshala_role[])
        or exists (
          select 1
          from public.class_enrollments e
          join public.students s on s.id = e.student_id
          where e.class_id = c.id
            and s.user_id = auth.uid()
            and s.is_active
        )
      )
  );
$$;

drop policy if exists "teachers request membership" on public.paathshala_memberships;
create policy "users request membership" on public.paathshala_memberships
  for insert with check (user_id = auth.uid() and role in ('teacher', 'student') and status = 'pending');

drop policy if exists "members read classes" on public.classes;
create policy "members read classes" on public.classes
  for select using (public.can_view_class(id));

drop policy if exists "families and teachers read class enrollments" on public.class_enrollments;
create policy "students and teachers read class enrollments" on public.class_enrollments
  for select using (
    public.can_view_student(student_id)
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );

drop policy if exists "members read attendance sessions" on public.attendance_sessions;
create policy "members read attendance sessions" on public.attendance_sessions
  for select using (public.can_view_class(class_id));

drop policy if exists "families and teachers read attendance records" on public.attendance_records;
create policy "students and teachers read attendance records" on public.attendance_records
  for select using (public.can_view_student(student_id));

drop policy if exists "members read published events" on public.events;
create policy "members read published events" on public.events
  for select using (
    (status = 'published' and public.has_paathshala_role(paathshala_id, array['teacher', 'student']::public.paathshala_role[]))
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );

drop policy if exists "families register for tenant events" on public.event_registrations;
create policy "members register for tenant events" on public.event_registrations
  for insert with check (
    registrant_user_id = auth.uid()
    and public.has_paathshala_role(paathshala_id, array['student', 'teacher']::public.paathshala_role[])
    and (student_id is null or public.can_view_student(student_id))
  );

drop policy if exists "members read tenant courses" on public.courses;
create policy "members read tenant courses" on public.courses
  for select using (public.has_paathshala_role(paathshala_id, array['teacher', 'student']::public.paathshala_role[]));

drop policy if exists "members read class courses" on public.class_courses;
create policy "members read class courses" on public.class_courses
  for select using (public.can_view_class(class_id));

drop policy if exists "members read student trackers" on public.student_trackers;
create policy "members read student trackers" on public.student_trackers
  for select using (
    public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
    or exists (
      select 1
      from public.student_tracker_classes tc
      where tc.tracker_id = id
        and public.can_view_class(tc.class_id)
    )
  );

drop policy if exists "members read tracker classes" on public.student_tracker_classes;
create policy "members read tracker classes" on public.student_tracker_classes
  for select using (public.can_view_class(class_id));

drop policy if exists "families and teachers read tracker records" on public.student_tracker_records;
create policy "students and teachers read tracker records" on public.student_tracker_records
  for select using (
    public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
    or public.can_view_student(student_id)
  );

create function public.approve_student_membership(p_membership_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  requested_membership public.paathshala_memberships%rowtype;
  student_name text;
  new_student_id uuid;
begin
  select * into requested_membership
  from public.paathshala_memberships
  where id = p_membership_id
  for update;

  if not found or requested_membership.role <> 'student' or requested_membership.status <> 'pending'
    or not public.is_platform_admin()
      and not public.has_paathshala_role(requested_membership.paathshala_id, array['teacher']::public.paathshala_role[]) then
    raise exception 'Student request not found or not authorized';
  end if;

  select coalesce(nullif(p.full_name, ''), 'Student') into student_name
  from public.profiles p where p.user_id = requested_membership.user_id;
  student_name := coalesce(student_name, 'Student');

  update public.paathshala_memberships set status = 'active' where id = p_membership_id;

  insert into public.students (paathshala_id, user_id, full_name)
  values (requested_membership.paathshala_id, requested_membership.user_id, student_name)
  on conflict (paathshala_id, user_id) do update set is_active = true
  returning id into new_student_id;

  return new_student_id;
end;
$$;

grant execute on function public.approve_student_membership(uuid) to authenticated;

commit;

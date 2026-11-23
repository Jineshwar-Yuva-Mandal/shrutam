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
create policy "members read teacher profiles" on public.profiles
  for select using (public.can_view_paathshala_contact(user_id));
create policy "users update their profile" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members read tenant memberships" on public.paathshala_memberships
  for select using (
    user_id = auth.uid()
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );
create policy "teachers request membership" on public.paathshala_memberships
  for insert with check (user_id = auth.uid() and role = 'teacher' and status = 'pending');

create policy "authorized users read students" on public.students
  for select using (public.can_view_student(id));
create policy "teachers manage students" on public.students
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

create policy "families and teachers read family links" on public.parent_student_links
  for select using (
    parent_user_id = auth.uid()
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );
create policy "teachers manage family links" on public.parent_student_links
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

create policy "requesters and teachers read join requests" on public.family_join_requests
  for select using (
    requester_user_id = auth.uid()
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );
create policy "authenticated users request to join" on public.family_join_requests
  for insert with check (requester_user_id = auth.uid() and status = 'pending');
create policy "teachers review join requests" on public.family_join_requests
  for update using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

create policy "members read classes" on public.classes
  for select using (public.has_paathshala_role(paathshala_id, array['teacher', 'parent']::public.paathshala_role[]));
create policy "teachers manage classes" on public.classes
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

create policy "families and teachers read class enrollments" on public.class_enrollments
  for select using (
    public.can_view_student(student_id)
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );
create policy "teachers manage class enrollments" on public.class_enrollments
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

create policy "members read attendance sessions" on public.attendance_sessions
  for select using (public.has_paathshala_role(paathshala_id, array['teacher', 'parent']::public.paathshala_role[]));
create policy "teachers manage attendance sessions" on public.attendance_sessions
  for all using (public.can_manage_class(class_id)) with check (public.can_manage_class(class_id));

create policy "families and teachers read attendance records" on public.attendance_records
  for select using (public.can_view_student(student_id));
create policy "teachers manage attendance records" on public.attendance_records
  for all using (public.can_manage_attendance(session_id)) with check (public.can_manage_attendance(session_id));

create policy "members read published events" on public.events
  for select using (
    (status = 'published' and public.has_paathshala_role(paathshala_id, array['teacher', 'parent']::public.paathshala_role[]))
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );
create policy "teachers manage events" on public.events
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

create policy "members read event registrations" on public.event_registrations
  for select using (
    registrant_user_id = auth.uid()
    or (student_id is not null and public.can_view_student(student_id))
    or public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
  );
create policy "families register for tenant events" on public.event_registrations
  for insert with check (
    registrant_user_id = auth.uid()
    and public.has_paathshala_role(paathshala_id, array['parent', 'teacher']::public.paathshala_role[])
    and (student_id is null or public.can_view_student(student_id))
  );
create policy "users cancel their event registration" on public.event_registrations
  for delete using (registrant_user_id = auth.uid());

grant execute on function public.provision_paathshala(text, text, text, uuid) to authenticated;
grant execute on function public.approve_family_join_request(uuid) to authenticated;
grant execute on function public.approve_teacher_membership(uuid) to authenticated;
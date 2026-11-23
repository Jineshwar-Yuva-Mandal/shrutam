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

create function public.can_view_paathshala_contact(p_contact_user_id uuid)
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
        exists (
          select 1 from public.parent_student_links p
          where p.student_id = s.id and p.parent_user_id = auth.uid()
        )
        or public.has_paathshala_role(s.paathshala_id, array['teacher']::public.paathshala_role[])
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
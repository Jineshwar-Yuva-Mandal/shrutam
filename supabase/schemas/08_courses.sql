create table public.courses (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  parent_course_id uuid,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (paathshala_id, id),
  foreign key (paathshala_id, parent_course_id) references public.courses(paathshala_id, id) on delete set null (parent_course_id)
);

create table public.class_courses (
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  class_id uuid not null,
  course_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (class_id, course_id),
  foreign key (paathshala_id, class_id) references public.classes(paathshala_id, id) on delete cascade,
  foreign key (paathshala_id, course_id) references public.courses(paathshala_id, id) on delete cascade
);

create index courses_tenant_parent_idx on public.courses(paathshala_id, parent_course_id, sort_order);
create index class_courses_course_idx on public.class_courses(paathshala_id, course_id, class_id);

alter table public.courses enable row level security;
alter table public.class_courses enable row level security;

create policy "members read tenant courses" on public.courses
  for select using (public.has_paathshala_role(paathshala_id, array['teacher', 'student']::public.paathshala_role[]));
create policy "teachers manage tenant courses" on public.courses
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

create policy "members read class courses" on public.class_courses
  for select using (public.can_view_class(class_id));
create policy "teachers manage class courses" on public.class_courses
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

create trigger audit_courses after insert or update or delete on public.courses for each row execute function public.write_audit_log();
create trigger audit_class_courses after insert or update or delete on public.class_courses for each row execute function public.write_audit_log();
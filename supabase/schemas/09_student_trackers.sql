create table public.student_trackers (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  title text not null,
  description text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (paathshala_id, id)
);

create table public.student_tracker_classes (
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  tracker_id uuid not null,
  class_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tracker_id, class_id),
  foreign key (paathshala_id, tracker_id) references public.student_trackers(paathshala_id, id) on delete cascade,
  foreign key (paathshala_id, class_id) references public.classes(paathshala_id, id) on delete cascade
);

create table public.student_tracker_records (
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  tracker_id uuid not null,
  student_id uuid not null,
  is_marked boolean not null default false,
  marked_by uuid references auth.users(id) on delete set null,
  marked_at timestamptz not null default now(),
  primary key (tracker_id, student_id),
  foreign key (paathshala_id, tracker_id) references public.student_trackers(paathshala_id, id) on delete cascade,
  foreign key (paathshala_id, student_id) references public.students(paathshala_id, id) on delete cascade
);

create index student_trackers_tenant_created_idx on public.student_trackers(paathshala_id, created_at desc);
create index student_tracker_classes_class_idx on public.student_tracker_classes(paathshala_id, class_id, tracker_id);
create index student_tracker_records_student_idx on public.student_tracker_records(student_id, tracker_id);

alter table public.student_trackers enable row level security;
alter table public.student_tracker_classes enable row level security;
alter table public.student_tracker_records enable row level security;

create policy "members read student trackers" on public.student_trackers
  for select using (public.has_paathshala_role(paathshala_id, array['teacher', 'parent']::public.paathshala_role[]));
create policy "teachers manage student trackers" on public.student_trackers
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

create policy "members read tracker classes" on public.student_tracker_classes
  for select using (public.has_paathshala_role(paathshala_id, array['teacher', 'parent']::public.paathshala_role[]));
create policy "teachers manage tracker classes" on public.student_tracker_classes
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

create policy "families and teachers read tracker records" on public.student_tracker_records
  for select using (
    public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[])
    or public.can_view_student(student_id)
  );
create policy "teachers manage tracker records" on public.student_tracker_records
  for all using (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  with check (public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]));

create trigger audit_student_trackers after insert or update or delete on public.student_trackers for each row execute function public.write_audit_log();
create trigger audit_student_tracker_classes after insert or update or delete on public.student_tracker_classes for each row execute function public.write_audit_log();
create trigger audit_student_tracker_records after insert or update or delete on public.student_tracker_records for each row execute function public.write_audit_log();

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  name text not null,
  learning_level text not null default '',
  teacher_user_id uuid references auth.users(id) on delete set null,
  weekdays smallint[] not null default array[0]::smallint[] check (cardinality(weekdays) > 0 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
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

create index classes_tenant_teacher_idx on public.classes(paathshala_id, teacher_user_id, is_active);
create index class_enrollments_student_idx on public.class_enrollments(student_id, class_id);
create index attendance_sessions_tenant_date_idx on public.attendance_sessions(paathshala_id, session_date desc);
create index attendance_records_student_idx on public.attendance_records(student_id, session_id);
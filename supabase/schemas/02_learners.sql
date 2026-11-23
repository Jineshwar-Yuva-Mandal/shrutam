create table public.students (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
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

create index students_tenant_name_idx on public.students(paathshala_id, full_name);
create index parent_student_parent_idx on public.parent_student_links(parent_user_id, paathshala_id);
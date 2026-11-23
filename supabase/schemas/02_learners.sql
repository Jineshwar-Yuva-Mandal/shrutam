create table public.students (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  learning_level text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (paathshala_id, id),
  unique (paathshala_id, user_id)
);

create index students_tenant_name_idx on public.students(paathshala_id, full_name);
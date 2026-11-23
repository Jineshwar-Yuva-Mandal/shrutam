create table public.paathshalas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  area text not null default '',
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
  role public.paathshala_role not null,
  status public.membership_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (paathshala_id, user_id, role),
  constraint paathshala_memberships_role_parent_teacher_check check (role in ('teacher', 'parent'))
);

create index memberships_user_tenant_idx on public.paathshala_memberships(user_id, paathshala_id, status);
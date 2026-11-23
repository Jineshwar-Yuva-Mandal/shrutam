create table public.events (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  venue text not null default '',
  is_paid boolean not null default false,
  status public.event_status not null default 'draft',
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (paathshala_id, id)
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid not null references public.paathshalas(id) on delete cascade,
  event_id uuid not null,
  registrant_user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid,
  created_at timestamptz not null default now(),
  foreign key (paathshala_id, event_id) references public.events(paathshala_id, id) on delete cascade,
  foreign key (paathshala_id, student_id) references public.students(paathshala_id, id) on delete cascade,
  unique nulls not distinct (event_id, registrant_user_id, student_id)
);

create index events_tenant_start_idx on public.events(paathshala_id, starts_at) where status = 'published';
create index event_registrations_user_idx on public.event_registrations(registrant_user_id, event_id);
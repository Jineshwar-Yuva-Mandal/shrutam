create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  paathshala_id uuid references public.paathshalas(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  table_name text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  record_id text not null,
  old_values jsonb,
  new_values jsonb,
  changed_at timestamptz not null default now()
);

create index audit_logs_tenant_changed_idx on public.audit_logs(paathshala_id, changed_at desc);

create function public.write_audit_log()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  row_data jsonb;
  old_data jsonb;
  tenant_id uuid;
  row_id text;
  actor_id uuid := auth.uid();
  actor_label text;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
    old_data := row_data;
  else
    row_data := to_jsonb(new);
    if tg_op = 'UPDATE' then old_data := to_jsonb(old); end if;
  end if;

  if tg_table_name = 'paathshalas' then
    tenant_id := (row_data ->> 'id')::uuid;
  elsif row_data ? 'paathshala_id' then
    tenant_id := nullif(row_data ->> 'paathshala_id', '')::uuid;
  end if;

  row_id := coalesce(
    row_data ->> 'id',
    row_data ->> 'user_id',
    row_data ->> 'student_id',
    row_data ->> 'class_id',
    row_data ->> 'session_id',
    row_data ->> 'event_id',
    'unknown'
  );

  select coalesce(nullif(p.full_name, ''), auth.jwt() ->> 'email', actor_id::text, 'system')
  into actor_label
  from (select 1) as singleton
  left join public.profiles p on p.user_id = actor_id;

  insert into public.audit_logs (
    paathshala_id, actor_user_id, actor_name, table_name, operation,
    record_id, old_values, new_values
  ) values (
    tenant_id, actor_id, actor_label, tg_table_name, tg_op,
    row_id, old_data, case when tg_op = 'DELETE' then null else row_data end
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_paathshalas after insert or update or delete on public.paathshalas for each row execute function public.write_audit_log();
create trigger audit_platform_admins after insert or update or delete on public.platform_admins for each row execute function public.write_audit_log();
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function public.write_audit_log();
create trigger audit_paathshala_memberships after insert or update or delete on public.paathshala_memberships for each row execute function public.write_audit_log();
create trigger audit_students after insert or update or delete on public.students for each row execute function public.write_audit_log();
create trigger audit_parent_student_links after insert or update or delete on public.parent_student_links for each row execute function public.write_audit_log();
create trigger audit_family_join_requests after insert or update or delete on public.family_join_requests for each row execute function public.write_audit_log();
create trigger audit_classes after insert or update or delete on public.classes for each row execute function public.write_audit_log();
create trigger audit_class_enrollments after insert or update or delete on public.class_enrollments for each row execute function public.write_audit_log();
create trigger audit_attendance_sessions after insert or update or delete on public.attendance_sessions for each row execute function public.write_audit_log();
create trigger audit_attendance_records after insert or update or delete on public.attendance_records for each row execute function public.write_audit_log();
create trigger audit_events after insert or update or delete on public.events for each row execute function public.write_audit_log();
create trigger audit_event_registrations after insert or update or delete on public.event_registrations for each row execute function public.write_audit_log();

alter table public.audit_logs enable row level security;
create policy "teachers and platform admins read audit logs" on public.audit_logs
  for select using (
    public.is_platform_admin()
    or (paathshala_id is not null and public.has_paathshala_role(paathshala_id, array['teacher']::public.paathshala_role[]))
  );
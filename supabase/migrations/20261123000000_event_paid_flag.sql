begin;

alter table public.events
  add column is_paid boolean not null default false;

commit;

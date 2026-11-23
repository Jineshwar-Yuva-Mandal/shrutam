alter table public.classes
  add column weekdays smallint[] not null default array[0]::smallint[];

update public.classes
set weekdays = array[weekday]::smallint[]
where weekday between 0 and 6;

alter table public.classes
  drop column weekday,
  add constraint classes_weekdays_valid_check
    check (cardinality(weekdays) > 0 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

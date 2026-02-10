alter table public.questions
  add column if not exists answer_method text not null default 'checkbox';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_answer_method_check'
  ) then
    alter table public.questions
      add constraint questions_answer_method_check
      check (answer_method in ('dropdown', 'checkbox'));
  end if;
end $$;


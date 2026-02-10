-- Allow multi correct answers like "A,B,C" for checkbox-type questions.
-- Existing constraint from init.sql only allowed a single letter.

do $$
declare
  c record;
begin
  -- Drop any old CHECK constraints that mention correct_answer (name may differ by environment).
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.questions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%correct_answer%'
  loop
    execute format('alter table public.questions drop constraint if exists %I', c.conname);
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.questions'::regclass
      and conname = 'questions_correct_answer_format_check'
  ) then
    execute $sql$
      alter table public.questions
        add constraint questions_correct_answer_format_check
        check (correct_answer ~ '^(?:[ABCD](?:,[ABCD])*)$')
    $sql$;
  end if;
end $$;

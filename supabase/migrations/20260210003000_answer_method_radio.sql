-- Replace dropdown answer method with radio.

do $$
declare
  c record;
begin
  -- Drop any existing CHECK constraints that mention answer_method (name may differ per env).
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.questions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%answer_method%'
  loop
    execute format('alter table public.questions drop constraint if exists %I', c.conname);
  end loop;

  -- Update existing rows now that old constraint is removed.
  execute $sql$
    update public.questions
    set answer_method = 'radio'
    where answer_method = 'dropdown'
  $sql$;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.questions'::regclass
      and conname = 'questions_answer_method_check'
  ) then
    execute $sql$
      alter table public.questions
        add constraint questions_answer_method_check
        check (answer_method in ('radio', 'checkbox'))
    $sql$;
  end if;
end $$;

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://zskaabmjbbjienwgnchw.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpza2FhYm1qYmJqaWVud2duY2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MTE2NTgsImV4cCI6MjExMTE4NzY1OH0.lszKxXjXyB9gDGVyVolDkQfTPhBXADgZsVpRuKfQFJc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export const SUPABASE_GRANT_FIX_SQL = `grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

do $$
declare
  tbl text;
  pol record;
  all_tables text[] := array[
    'user_profiles', 'academic_modules', 'academic_assessments', 'study_resources',
    'planner_tasks', 'routines', 'life_goals', 'focus_sessions',
    'finance_accounts', 'finance_transactions', 'finance_budgets', 'savings_goals',
    'diary_entries', 'life_notes', 'cyber_skills', 'cyber_logs'
  ];
begin
  foreach tbl in array all_tables loop
    execute format('alter table public.%I drop constraint if exists %I;', tbl, tbl || '_user_id_fkey');
    execute format('alter table public.%I alter column user_id set default ''00000000-0000-0000-0000-000000000001''::uuid;', tbl);
    execute format('alter table public.%I enable row level security;', tbl);

    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tbl loop
      execute format('drop policy if exists %I on public.%I;', pol.policyname, tbl);
    end loop;

    execute format(
      'create policy "My Life OS personal owner sync" on public.%I for all to anon, authenticated using (user_id = ''00000000-0000-0000-0000-000000000001''::uuid or auth.uid() = user_id) with check (user_id = ''00000000-0000-0000-0000-000000000001''::uuid or auth.uid() = user_id);',
      tbl
    );
  end loop;
end $$;`;

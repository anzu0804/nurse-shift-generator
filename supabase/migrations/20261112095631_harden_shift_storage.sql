-- Incremental migration for the existing five shift-storage tables.
-- Production already received this DDL in SQL Editor on 2026-11-12.
-- For that database, verify the schema and baseline this version as applied
-- in Supabase migration history before running db push.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';

ALTER TABLE public.public_holiday_balances
  ADD CONSTRAINT chk_public_holiday_balances_half_day
  CHECK (
    mod(calculated_holidays, 0.5) = 0
    AND mod(carried_over_holidays, 0.5) = 0
    AND mod(available_holidays, 0.5) = 0
    AND mod(used_current_holidays, 0.5) = 0
    AND mod(used_carried_holidays, 0.5) = 0
    AND mod(remaining_holidays, 0.5) = 0
  );

-- The existing composite UNIQUE allows multiple NULL week_number values.
CREATE UNIQUE INDEX uq_shift_sheets_monthly_version
  ON public.shift_sheets (sheet_type, target_year, target_month, version)
  WHERE week_number IS NULL;

DO $migration$
DECLARE
  -- Match the current single-user admin policy without publishing its UUID.
  admin_pattern constant text :=
    $pattern$^\(\( SELECT auth\.uid\(\) AS uid\) = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'::uuid\)$$pattern$;
  admin_id uuid;
  target text;
BEGIN
  SELECT (regexp_match(qual, admin_pattern))[1]::uuid
    INTO STRICT admin_id
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'staffs'
    AND roles = ARRAY['authenticated']::name[]
    AND cmd = 'ALL'
    AND permissive = 'PERMISSIVE'
    AND qual = with_check
    AND qual ~ admin_pattern;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = admin_id AND NOT is_anonymous
  ) THEN
    RAISE EXCEPTION 'Existing staff administrator account could not be verified';
  END IF;

  FOREACH target IN ARRAY ARRAY[
    'shift_sheets',
    'shift_assignments',
    'shift_validation_results',
    'shift_backups',
    'public_holiday_balances'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname = target
        AND relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Expected RLS enabled on public.%', target;
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING ((SELECT auth.uid()) = %L::uuid)
       WITH CHECK ((SELECT auth.uid()) = %L::uuid)',
      target || '_admin_all', target, admin_id, admin_id
    );
  END LOOP;
END
$migration$;

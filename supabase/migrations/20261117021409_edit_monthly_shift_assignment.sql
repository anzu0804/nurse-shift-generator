CREATE FUNCTION public.edit_monthly_shift_assignment(
  p_assignment_id bigint,
  p_expected_version integer,
  p_changes jsonb,
  p_validation jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  sheet public.shift_sheets%ROWTYPE;
  cell public.shift_assignments%ROWTYPE;
  edited public.shift_assignments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authenticated administrator required';
  END IF;

  IF p_expected_version IS NULL OR p_expected_version NOT BETWEEN 1 AND 2147483646
    OR jsonb_typeof(p_changes) IS DISTINCT FROM 'object' OR p_changes = '{}'::jsonb
    OR jsonb_typeof(p_validation) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid edit payload';
  END IF;

  IF p_changes - ARRAY['shift_code', 'team_assignment', 'assignment_role', 'work_amount', 'note'] <> '{}'::jsonb
    OR (p_changes ? 'shift_code' AND (
      jsonb_typeof(p_changes -> 'shift_code') <> 'string' OR btrim(p_changes ->> 'shift_code') = ''))
    OR (p_changes ? 'work_amount' AND CASE
      WHEN jsonb_typeof(p_changes -> 'work_amount') = 'number' THEN
        (p_changes ->> 'work_amount')::numeric NOT BETWEEN 0 AND 99.9
        OR mod((p_changes ->> 'work_amount')::numeric, 0.1) <> 0
      ELSE true
    END)
    OR EXISTS (
      SELECT 1 FROM jsonb_each(p_changes) AS field(key, value)
      WHERE field.key IN ('team_assignment', 'assignment_role', 'note')
        AND jsonb_typeof(field.value) NOT IN ('string', 'null')
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid assignment fields';
  END IF;

  -- The editor takes this lock before reading the backup, so two saves cannot
  -- commit against the same sheet version.
  SELECT s.* INTO STRICT sheet
    FROM public.shift_sheets AS s
    JOIN public.shift_assignments AS a ON a.shift_sheet_id = s.id
    WHERE a.id = p_assignment_id
    FOR UPDATE OF s;

  IF sheet.sheet_type <> 'monthly_schedule' OR sheet.week_number IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Monthly schedule required';
  END IF;

  IF sheet.version <> p_expected_version OR EXISTS (
    SELECT 1 FROM public.shift_sheets AS newer
    WHERE newer.sheet_type = sheet.sheet_type AND newer.target_year = sheet.target_year
      AND newer.target_month = sheet.target_month AND newer.week_number IS NULL
      AND newer.version > sheet.version
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Schedule version changed';
  END IF;

  SELECT * INTO STRICT cell FROM public.shift_assignments
    WHERE id = p_assignment_id AND shift_sheet_id = sheet.id FOR UPDATE;
  IF extract(year FROM cell.work_date) <> sheet.target_year OR extract(month FROM cell.work_date) <> sheet.target_month THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Assignment outside schedule month';
  END IF;

  edited := jsonb_populate_record(cell, p_changes);

  INSERT INTO public.shift_backups (shift_sheet_id, version, backup_data)
    SELECT sheet.id, sheet.version, jsonb_build_object(
      'sheet', to_jsonb(sheet), 'assignments', jsonb_agg(to_jsonb(a) ORDER BY a.id)
    )
    FROM public.shift_assignments AS a
    WHERE a.shift_sheet_id = sheet.id;

  UPDATE public.shift_assignments
    SET shift_code = edited.shift_code, team_assignment = edited.team_assignment,
        assignment_role = edited.assignment_role, work_amount = edited.work_amount,
        note = edited.note, is_manual_edit = true, updated_at = statement_timestamp()
    WHERE id = cell.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Assignment update denied';
  END IF;

  UPDATE public.shift_validation_results
    SET is_resolved = true
    WHERE shift_sheet_id = sheet.id AND NOT is_resolved AND severity IN ('error', 'warning');

  INSERT INTO public.shift_validation_results (shift_sheet_id, staff_id, work_date, severity, validation_code, message)
    SELECT sheet.id, issue.staff_id, issue.work_date, issue.severity, issue.validation_code, issue.message
    FROM jsonb_to_recordset(p_validation) AS issue(staff_id bigint, work_date date, severity text, validation_code text, message text);

  UPDATE public.shift_sheets
    SET version = sheet.version + 1, status = '編集中', updated_at = statement_timestamp()
    WHERE id = sheet.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Schedule update denied';
  END IF;

  RETURN sheet.version + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.edit_monthly_shift_assignment(bigint, integer, jsonb, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.edit_monthly_shift_assignment(bigint, integer, jsonb, jsonb) TO authenticated;

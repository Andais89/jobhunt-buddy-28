-- Add archive support to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS applications_archived_at_idx ON public.applications (archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS applications_user_archived_idx ON public.applications (user_id, archived_at);

-- Auto-recalc follow_up_at when applied_at or follow_up_days change.
-- If follow_up_at was previously equal to applied_at + follow_up_days, keep it auto.
-- If user set a custom follow_up_at, leave it alone.
CREATE OR REPLACE FUNCTION public.applications_sync_follow_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  prev_auto date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- On insert, if no manual follow_up_at provided, compute it.
    IF NEW.follow_up_at IS NULL AND NEW.follow_up_days IS NOT NULL AND NEW.applied_at IS NOT NULL THEN
      NEW.follow_up_at := NEW.applied_at + NEW.follow_up_days;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  prev_auto := OLD.applied_at + COALESCE(OLD.follow_up_days, 30);

  -- If applied_at or follow_up_days changed, and the existing follow_up_at
  -- matched the previous auto value (or was NULL), recompute.
  IF (NEW.applied_at IS DISTINCT FROM OLD.applied_at)
     OR (NEW.follow_up_days IS DISTINCT FROM OLD.follow_up_days) THEN
    IF NEW.follow_up_at IS NULL OR NEW.follow_up_at = prev_auto THEN
      NEW.follow_up_at := NEW.applied_at + COALESCE(NEW.follow_up_days, 30);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applications_sync_follow_up ON public.applications;
CREATE TRIGGER trg_applications_sync_follow_up
BEFORE INSERT OR UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.applications_sync_follow_up();

-- Backfill follow_up_at for existing rows where null
UPDATE public.applications
SET follow_up_at = applied_at + COALESCE(follow_up_days, 30)
WHERE follow_up_at IS NULL;

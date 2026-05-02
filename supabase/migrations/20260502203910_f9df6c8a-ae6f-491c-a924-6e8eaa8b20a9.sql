-- 1. New columns on applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS match_score INTEGER,
  ADD COLUMN IF NOT EXISTS gap_analysis JSONB,
  ADD COLUMN IF NOT EXISTS interviewer_name TEXT,
  ADD COLUMN IF NOT EXISTS interviewer_linkedin TEXT,
  ADD COLUMN IF NOT EXISTS interview_questions TEXT;

-- Validation: match_score must be 0-100
ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_match_score_range;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_match_score_range
  CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100));

-- Indices for duplicate detection
CREATE INDEX IF NOT EXISTS idx_applications_user_job_url
  ON public.applications (user_id, job_url) WHERE job_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_user_company_role
  ON public.applications (user_id, lower(company), lower(role));

-- 2. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  cv_text TEXT,
  skills TEXT,
  experience_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_select_profiles ON public.profiles;
CREATE POLICY own_select_profiles ON public.profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS own_insert_profiles ON public.profiles;
CREATE POLICY own_insert_profiles ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS own_update_profiles ON public.profiles;
CREATE POLICY own_update_profiles ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS own_delete_profiles ON public.profiles;
CREATE POLICY own_delete_profiles ON public.profiles FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();